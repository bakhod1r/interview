# Dars 7 — Qidirish (grep, find)

> **Natija:** fayl ichidan matnni (`grep`) va diskdan faylni (`find`) topish, pipe bilan vositalarni zanjir qilish, log'dan tez javob olish. Regex turlari, `find` bilan xavfsiz ommaviy amallar, `xargs` va probel bor nomlar, performance, qachon `grep` yetmaydi.

## 1. Muammo — minglab fayl ichidan xatoni qanday topish kerak?

Server'da minglab fayl va millionlab log qatori bor. Incident paytida savollar:
- "Oxirgi 10 daqiqada qancha 500 xato bo'ldi?"
- "`PermitRootLogin` qaysi config'da yozilgan?"
- "Disk'ni qaysi fayl to'ldirdi?"

Ko'z bilan javob topib bo'lmaydi. Ikkita fundamental savol, ikkita vosita:

| Savol | Vosita | Nima bo'yicha qidiradi |
|---|---|---|
| Fayl **ichida** nima bor? | `grep` | Mazmun |
| Fayl **qayerda**? | `find` | Metadata: nom, hajm, vaqt, egasi, turi |

## 2. grep — fayl ichidagi matnni qidirish

```bash
grep "error" app.log            # oddiy qidiruv
grep -i "error" app.log         # katta-kichik harf farqsiz
grep -n "error" app.log         # qator raqami bilan
grep -v "DEBUG" app.log         # mos KELMAYDIGAN qatorlar
grep -c "error" app.log         # mos qatorlar soni
grep -r "listen" /etc/nginx     # papka bo'yicha rekursiv
grep -l "root" /etc/*           # faqat file nomlari
grep -w "fail" app.log          # butun so'z: "failed" mos kelmaydi
grep -E "error|fail" app.log    # extended regex (yoki)
grep -F "a.b[1]" app.log        # fixed string: regex emas, tez
grep -o "user=[a-z]*" app.log   # faqat mos qism
grep -A 3 -B 1 "panic" app.log  # topilgandan keyin 3, oldin 1 qator (-C 2 = ikki tomondan)
grep -m 1 "ERROR" app.log       # birinchisini topib to'xtash
```

### Regex turlari — ko'p xatolar shu yerdan chiqadi

| Rejim | Flag | `+ ? \| ( ) { }` | Qachon |
|---|---|---|---|
| Basic (BRE) | default | `\+`, `\|` kabi escape kerak | Eski script'lar |
| Extended (ERE) | `-E` | To'g'ridan-to'g'ri ishlaydi | Odatiy tanlov |
| Fixed | `-F` | Hech qanday maxsus belgi yo'q | Aniq matn, IP, path |
| Perl (PCRE) | `-P` | `\d`, lookahead | GNU grep, har joyda yo'q |

```bash
grep "1.2.3.4" log      # XATO: "." istalgan belgi -> "1x2y3z4" ham mos keladi
grep -F "1.2.3.4" log   # TO'G'RI: aniq matn
```

> **Qoida:** regex kerak bo'lmasa — `-F`. Tezroq va kutilmagan moslik yo'q.

### grep'ning exit code'i — script'larda ishlatish

`grep` topsa `0`, topmasa `1`, xato bo'lsa `2` qaytaradi.

```bash
if grep -q "ready" /var/log/app.log; then echo "app tayyor"; fi   # -q: hech narsa chiqarmaydi
```

> **Tuzoq:** `set -e` + `pipefail` bilan `grep` hech narsa topmasa script to'xtaydi (exit 1). Bu ko'pincha xato emas, kutilgan holat: `grep ... || true`.

## 3. find — faylni nomi, hajmi, vaqti bo'yicha qidirish

```bash
find /etc -name "*.conf"                  # nom bo'yicha (pattern qo'shtirnoqda!)
find / -iname "nginx*" 2>/dev/null        # katta-kichik farqsiz, xatolarni yashirish
find /var/log -type f -size +100M         # 100 MB dan katta file'lar
find ~ -type d -name "logs"               # faqat papkalar
find /tmp -mtime -1                       # oxirgi 24 soatda o'zgargan
find /tmp -mmin -30                       # oxirgi 30 daqiqada
find /srv -user www-data                  # egasi bo'yicha
find /srv -perm -o+w                      # hamma yoza oladigan (security audit)
find / -xdev -size +1G                    # faqat shu filesystem (/proc, NFS'ga kirmaydi)
find . -maxdepth 2 -name "*.yml"          # chuqurlikni cheklash
```

> **Tuzoq:** `find . -name *.conf` — qo'shtirnoqsiz. Joriy papkada `.conf` fayl bo'lsa, shell glob'ni **oldindan** ochadi va `find` noto'g'ri argument oladi. Har doim `-name "*.conf"`.

### Topilgan fayllar ustida amal bajarish — xavfsiz usul

```bash
# Naive: probel yoki yangi qator bor nomlarda buziladi
find /data -name "*.tmp" | xargs rm

# Better: null-separated — har qanday nom xavfsiz
find /data -name "*.tmp" -print0 | xargs -0 rm --

# Production: avval ko'r, keyin o'chir, ko'p file'da samarali
find /data -name "*.tmp" -mtime +7 -print | head        # 1) nima o'chishini ko'rish
find /data -name "*.tmp" -mtime +7 -delete              # 2) o'chirish
find /data -name "*.log" -exec gzip {} +                # bir gzip ga ko'p file
```

| Variant | Process soni | Probelli nom |
|---|---|---|
| `-exec cmd {} \;` | Har fayl uchun bitta (sekin) | Xavfsiz |
| `-exec cmd {} +` | Iloji boricha kam (tez) | Xavfsiz |
| `\| xargs cmd` | Kam | **Xavfli** |
| `-print0 \| xargs -0 cmd` | Kam, `-P 4` bilan parallel | Xavfsiz |

> **`-delete` tartibi tuzoq:** `find . -delete -name "*.tmp"` — **hamma narsani** o'chiradi, chunki `find` ifodalarni chapdan o'ngga bajaradi va `-delete` filterdan oldin turibdi. `-delete` doim oxirida. Avval `-delete`siz ishga tushirib natijani ko'ring.

## 4. Pipe (`|`) — buyruqlarni zanjir qilib ulash

Bir vositaning stdout'i keyingisining stdin'i. Har vosita kichik, birgalikda — kuchli.

```
access.log --> grep " 404 " --> awk '{print $7}' --> sort --> uniq -c --> sort -nr --> head
               (filter)         (ustun ajratish)    (guruhlash uchun) (sanash) (top)
```

```bash
grep " 404 " access.log | awk '{print $7}' | sort | uniq -c | sort -nr | head -5
```

**Nega `uniq`'dan oldin `sort`?** `uniq` faqat **ketma-ket** takrorlarni birlashtiradi. Saralanmagan ma'lumotda bir xil URL har xil joylarda bo'lsa, ular alohida sanaladi.

### Tayyor foydali zanjirlar

```bash
# Eng faol 10 IP
awk '{print $1}' access.log | sort | uniq -c | sort -nr | head

# Daqiqa bo'yicha 500 xatolar (spike'ni ko'rish)
grep '" 500 ' access.log | awk '{print substr($4,2,17)}' | uniq -c

# Eng katta 10 papka
sudo du -xh / 2>/dev/null | sort -rh | head

# Status kod taqsimoti
awk '{print $9}' access.log | sort | uniq -c | sort -nr
```

### Tezlik

- Filter'ni **birinchi** qo'ying: `grep` ma'lumotni kamaytiradi, keyingi qadamlar kam ish qiladi.
- `cat file | grep x` — ortiqcha process ("useless use of cat"). `grep x file` yetarli.
- Katta log'larda `LC_ALL=C grep ...` — locale/UTF-8 ishlovini o'chiradi, bir necha barobar tez bo'lishi mumkin (faqat ASCII qidiruvda).
- Kodda qidirish uchun `ripgrep` (`rg`) — `.gitignore`'ni hisobga oladi, parallel, juda tez.

## 5. grep yetmay qoladigan holatlar

| Vaziyat | Muammo | Yaxshiroq vosita |
|---|---|---|
| JSON log'lar | Regex bilan nested field'ni ishonchli olib bo'lmaydi | `jq` |
| 50 ta server log'i | Har biriga SSH qilish | Markazlashgan logging: Loki, ELK, CloudWatch |
| Bir necha oylik tarix | Fayllar rotate qilib o'chirilgan | Log retention siyosati + storage |
| Metric savollar ("P99 latency qancha?") | Log'dan hisoblash sekin va qimmat | Metrics (Prometheus) |

```bash
jq -r 'select(.level=="error") | .msg' app.json.log
```

> **Chuqurroq qarash:** server'ga SSH qilib `grep` qilish — kichik tizim yoki favqulodda holat uchun. Masshtabda bu ishlamaydi: log'lar markazlashtirilishi, structured (JSON) bo'lishi va correlation ID bilan bog'lanishi kerak. Lekin markaziy tizim ishlamay qolganda (va bu bo'ladi) — `grep`, `awk`, `sort` sizni qutqaradi.

## 6. Xatoni qidirish tartibi

```
 1. Scope       qaysi servis? qachondan beri? log qayerda? (journalctl / /var/log / stdout)
 2. Oxiri       tail -n 200          -> oxirgi voqealar
 3. Filter      grep -iE "error|fail|denied|timeout|refused"
 4. Kontekst    grep -B 5 -A 10      -> xatodan oldin nima bo'ldi
 5. Vaqt        grep "2026-10-01T14:" -> incident oynasiga toraytirish
 6. Miqdor      ... | uniq -c        -> bitta xato yoki minglab? qachon boshlandi?
 7. Korrelyatsiya request ID / trace ID bo'yicha boshqa servislar log'ida
```

> **Belgi va asl sabab:** log'dagi birinchi `ERROR` ko'pincha **oqibat**. Masalan, `connection refused` — belgi; asl sabab — DB OOM bilan o'lgan. Vaqt bo'yicha **eng birinchi** anomaliyani qidiring.

## Amaliy mashg'ulot

Tayyor `access.log` (o'qituvchi beradi) bilan:
1. Jami so'rovlar soni.
2. 500 xatolar soni va ular qaysi daqiqada eng ko'p bo'lgan.
3. Eng ko'p 404 bergan 5 ta URL.
4. Eng faol 3 ta IP.
5. `/etc` ichida `PermitRootLogin` qaysi faylda (`grep -rn`).
6. `/var` ichidagi 50 MB dan katta fayllar.
7. Probelli nomli fayllar yarating (`touch "a b.tmp" "c d.tmp"`) va `find | xargs rm` vs `find -print0 | xargs -0 rm` farqini ko'ring.

## Uy vazifa

1. Home papkangizdagi oxirgi 2 kunda o'zgargan barcha `.txt` fayllarni toping.
2. `/etc` ichida `127.0.0.1` uchragan fayllarni chiqaring (regex emas, `-F` bilan — nega?).
3. Script yozing: `/var/log/app/` ichidagi 7 kundan eski `.log`'larni siqadi, 30 kundan eskilarini o'chiradi. Avval `-print` bilan quruq ishga tushirish rejimi bo'lsin.

## Test savollari

1. `grep -v`, `-w`, `-F` nima qiladi?
2. `grep "1.2.3.4"` nega noto'g'ri natija berishi mumkin?
3. `find / -name x 2>/dev/null`'da `2>` nima?
4. Nega `find -name *.conf` qo'shtirnoqsiz xavfli?
5. `find | xargs rm` nega xavfli va qanday tuzatiladi?
6. Nega `uniq -c` dan oldin `sort` kerak?
7. `find . -delete -name "*.tmp"` nima qiladi?
8. Qachon `grep` o'rniga `jq` yoki markaziy logging kerak?

## Ko'p uchraydigan xatolar

- Regex belgilari (`.`, `*`, `[`) borligini unutish.
- `find` usulini qo'shtirnoqsiz yozish.
- `xargs`'ni null-separator'siz ishlatish.
- `-delete`'ni oldindan quruq ishga tushirmasdan bajarish.
- Log'dagi birinchi ko'ringan xatoni asl sabab deb hisoblash.

## Xulosa

- `grep` — mazmun, `find` — metadata, `|` — ularni birlashtiradigan kuch.
- Regex kerak bo'lmasa `-F`; `find` usuli qo'shtirnoqda; ommaviy amalda `-print0 | xargs -0` yoki `-exec +`.
- Avval ko'r, keyin o'chir: `-delete` va `rm`'dan oldin quruq ishga tushirish.
- Filter'ni boshiga qo'ying, keraksiz process'larni olib tashlang.
- Masshtabda — structured log + markaziy tizim; favqulodda holatda — `grep/awk/sort`.
