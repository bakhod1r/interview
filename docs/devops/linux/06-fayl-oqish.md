# Dars 6 — File o'qish

> **Natija:** vaziyatga qarab to'g'ri tool tanlash, jonli log'ni kuzatish, katta file'lar bilan xavfsiz ishlash. Senior darajada: page cache, log rotation strategiyalari, o'chirilgan lekin ochiq file, binary va encoding muammolari.

## 1. Problem — "file'ni ochib ko'r" nega oddiy emas

Laptop'da file'ni editor'da ochasiz. Production server'da:
- log file 20 GB bo'lishi mumkin — editor RAM'ni yeb, server'ni sekinlashtiradi;
- log har soniyada o'sib boradi — sizga jonli oqim kerak;
- log'lar har kecha **rotate** qilinadi — kuzatayotgan tool yangi file'ni "yo'qotib" qo'yishi mumkin;
- server yuklangan — sizning debug'ingiz incident'ni og'irlashtirmasligi kerak.

**Asosiy savol:** "Kerakli qismni **minimal resurs** bilan qanday ko'raman?"

## 2. Mental model — "Everything is a file"

Linux'da text, config, log, device (`/dev/sda`), process ma'lumoti (`/proc`), hatto kernel parametrlari (`/sys`) — hammasi file interfeysi orqali o'qiladi. Bir xil tool'lar (`cat`, `less`, `grep`) hamma joyda ishlaydi.

```bash
file /etc/passwd        # ASCII text
file /bin/ls            # ELF 64-bit executable
file data.gz            # gzip compressed data
cat /proc/loadavg       # kernel'dan jonli ma'lumot, diskda yo'q
```

> **Gotcha:** binary file'ni `cat` qilmang — terminal'ga control belgilar yuboriladi va u buziladi (g'alati belgilar, kursor yo'qoladi). Tuzatish: `reset`. Binary ichini ko'rish: `xxd file | head` yoki `strings file | less`.

## 3. Tool tanlash — qaror jadvali

| Vaziyat | Tool | Nega |
|---|---|---|
| Kichik file (< bir necha yuz qator) | `cat` | Butun file bir zumda |
| Katta file, ko'rib chiqish kerak | `less` | Butun file'ni RAM'ga yuklamaydi, sahifalab o'qiydi |
| Format/header'ni bilish | `head -n 20` | Faqat boshi |
| Oxirgi event'lar | `tail -n 200` | Faqat oxiri, file oxiridan o'qiydi |
| Jonli kuzatish | `tail -F` | Rotation'ga chidamli (pastda) |
| Aniq qator oralig'i | `sed -n '100,120p'` | Kerakli qism |
| Faqat sanash | `wc -l`, `grep -c` | Chiqarmasdan hisoblaydi |
| Siqilgan log | `zless`, `zcat`, `zgrep` | Ochmasdan o'qiydi |

```bash
cat -A file           # yashirin belgilar: ^M (CRLF), ^I (tab), $ (qator oxiri)
less +G big.log       # oxiridan ochish
head -c 100 file      # birinchi 100 bayt
tail -n +5 file       # 5-qatordan boshlab (header'ni tashlab ketish)
sed -n '100,120p' f   # 100–120 qatorlar
```

### Nega `tail` 20 GB file'da ham bir zumda?

`tail` file'ni boshidan o'qimaydi: `lseek()` bilan oxiriga sakraydi va orqaga qarab qator qidiradi. `wc -l` esa butun file'ni o'qishi shart — 20 GB'da sekin. Tool'ning **ichida nima qilishini** bilish — performance intuition'ning asosi.

## 4. `less` — production'da asosiy tool

| Key | Vazifa |
|---|---|
| `g / G` | Boshi / oxiri |
| `/error`, `?error` | Pastga / yuqoriga qidiruv |
| `n / N` | Keyingi / oldingi natija |
| `&error` | Faqat mos qatorlarni ko'rsatish (filter) |
| `F` | Follow mode (`tail -f` kabi), `Ctrl+C` — to'xtatib ko'rib chiqish |
| `-S` | Uzun qatorlarni o'ramaslik (JSON log'lar uchun) |
| `-N` | Qator raqamlari |
| `:n` | Keyingi file (`less a.log b.log`) |

**Workflow:** `less +F app.log` — jonli kuzatasiz; muammo ko'rinsa `Ctrl+C` — to'xtab, `?ERROR` bilan orqaga qidirasiz; `F` — yana jonli rejimga. `tail -f` bunday qila olmaydi.

## 5. Page cache — nega ikkinchi o'qish tezroq?

```
 1-marta: less big.log -> kernel diskdan o'qiydi -> page cache (RAM) -> sizga
 2-marta: less big.log -> kernel page cache'dan beradi (disk yo'q)    -> juda tez
```

- Kernel bo'sh RAM'ni disk cache uchun ishlatadi. `free -h`'da bu `buff/cache` ustuni.
- **"RAM tugadi" deb vahima qilmang:** `free`'da `available` ustuniga qarang — cache kerak bo'lsa bo'shatiladi.
- Benchmark gotcha: ikkinchi ishga tushirish har doim tezroq — cache isigan. Haqiqiy disk tezligini o'lchash uchun cold cache kerak.

> **Production nuance:** 50 GB log'ni `cat` / `grep` qilish page cache'ni "ifloslaydi" — DB yoki app'ning issiq data'si cache'dan siqib chiqarilishi mumkin va ular sekinlashadi. Yuklangan prod server'da katta tahlilni `nice -n 19 ionice -c3` bilan yoki log'ni boshqa joyga ko'chirib bajaring.

## 6. Log rotation va `tail -f` vs `tail -F`

**Problem:** log cheksiz o'sadi va disk'ni to'ldiradi. **Yechim:** `logrotate` (yoki app'ning o'zi) log'ni muntazam aylantiradi.

```
 logrotate:  app.log --rename--> app.log.1     yangi bo'sh app.log yaratiladi
                                 app.log.1 --> app.log.2.gz (siqiladi) ...

 tail -f  ->  file descriptor (inode) bo'yicha kuzatadi
              -> app.log.1 da qoladi, yangi log'lar ko'rinmaydi

 tail -F  ->  NOM bo'yicha kuzatadi, file almashsa qayta ochadi
              -> yangi app.log'ga o'tadi
```

Production'da doim `tail -F` (= `--follow=name --retry`).

### Rotation strategiyalari — trade-off

| Usul | Qanday | Afzallik | Xavf |
|---|---|---|---|
| **create + signal** | rename, yangi file, app'ga signal (`SIGHUP`/`SIGUSR1`) — app file'ni qayta ochadi | Log yo'qolmaydi | App signal'ni qo'llab-quvvatlashi kerak |
| **copytruncate** | Nusxa oladi, keyin original'ni 0 ga qisqartiradi | App'ni o'zgartirish shart emas | Nusxa va truncate o'rtasida yozilgan qatorlar **yo'qoladi**; katta file'da nusxa sekin |
| **App o'zi rotate qiladi** | Logging kutubxonasi (lumberjack va h.k.) | To'liq nazorat | Har app o'zicha sozlanadi |
| **stdout -> journald / container runtime** | App faqat stdout'ga yozadi | App file haqida umuman bilmaydi | Rotation runtime sozlamalariga bog'liq |

> **Zamonaviy yondashuv (12-factor):** app log'ni **stdout**'ga yozadi, file bilan ishlamaydi. Rotation, saqlash va markazlashtirish — platformaning ishi (systemd-journald, Docker log driver, Kubernetes + Loki/ELK). Bu app'ni soddalashtiradi va disk to'lishi muammosini bir joyda hal qiladi.

## 7. Senior gotcha: o'chirilgan, lekin ochiq file

**Holat:** disk 100%. Katta log'ni `rm` qildingiz, `df` hali ham 100%.

**Root cause:** `rm` faqat directory entry'ni o'chiradi (inode link count -> 0). Lekin process file'ni hali ochiq ushlab turibdi. Kernel inode va data'ni **oxirgi fd yopilgandagina** bo'shatadi.

```
 rm app.log:   "app.log" --X--> inode (link=0, lekin app fd=3 ochiq)
                                  data hali diskda, app hali yozyapti
```

Debugging:

```bash
sudo lsof +L1                         # link count < 1, lekin ochiq file'lar
sudo lsof -nP | grep '(deleted)'
ls -l /proc/<PID>/fd | grep deleted   # aniq process'da
```

Yechim variantlari:

| Variant | Qachon |
|---|---|
| Servisni reload/restart (file qayta ochiladi) | Qisqa uzilish mumkin bo'lsa |
| `: > /proc/<PID>/fd/<N>` — ochiq fd orqali truncate | Restart qilib bo'lmasa, darhol joy kerak |
| Kelajakda: `rm` emas, `truncate -s 0 app.log` | Profilaktika |

> **Qoida:** ishlayotgan servis log'ini `rm` qilmang — **truncate** qiling yoki logrotate'ga topshiring.

## 8. Katta file'lar

```bash
ls -lh big.log; du -h big.log      # hajm (du — diskda haqiqatda egallagan joy)
wc -l big.log                      # qator soni (butun file o'qiladi)
grep -c ERROR big.log              # sanash
zcat app.log.2.gz | less           # siqilgan log
zgrep ERROR app.log.*.gz           # siqilganlar ichida qidirish
split -l 1000000 big.log part_     # bo'laklarga ajratish
```

> 10 GB file'ni editor'da (`vim`, `nano`) ochmang — butun file RAM'ga yuklanadi, server swap'ga tushishi mumkin. `less` ishlating.

**`ls -l` va `du` farqi:** `ls` file'ning "mantiqiy" hajmini, `du` diskda egallagan joyni ko'rsatadi. **Sparse file**'larda (VM disk image, ba'zi DB file'lar) `ls` 100 GB, `du` 2 GB ko'rsatishi mumkin.

## 9. Encoding va line ending

- Windows file'lari `\r\n` (CRLF) bilan tugaydi -> script'da `bad interpreter: /bin/bash^M` yoki `$'\r': command not found` xatosi.
- Tekshirish: `cat -A script.sh` (qator oxirida `^M$`) yoki `file script.sh` (`with CRLF line terminators`).
- Tuzatish: `dos2unix script.sh` yoki `sed -i 's/\r$//' script.sh`.
- **Profilaktika:** repo'da `.gitattributes` ichida `*.sh text eol=lf` — git o'zi to'g'ri saqlaydi.

Encoding:

```bash
file -i notes.txt                       # charset=utf-8 yoki iso-8859-1
iconv -f WINDOWS-1251 -t UTF-8 old.txt > new.txt
```

> **UTF-8 BOM gotcha:** ba'zi Windows editor'lar file boshiga ko'rinmas `EF BB BF` baytlarini qo'yadi. Natija: `#!/bin/bash` birinchi qator bo'lib tanilmaydi, JSON parser xato beradi. Tekshirish: `head -c 3 file | xxd`.

## 10. Failure modes

| Symptom | Sabab | Tekshirish |
|---|---|---|
| `tail -f` yangi log'ni ko'rsatmay qoldi | Rotation, fd eski file'da | `tail -F` ishlating |
| Disk to'la, `rm` yordam bermadi | Ochiq fd | `lsof +L1` |
| Log'da qatorlar yo'qolgan | `copytruncate` poygasi | Rotation usulini o'zgartirish |
| Terminal buzildi | Binary `cat` qilindi | `reset` |
| Script `^M` xatosi | CRLF | `cat -A`, `dos2unix` |
| Debug paytida prod sekinlashdi | Katta file o'qish page cache va I/O'ni bosdi | `ionice`, boshqa joyda tahlil |

## Amaliy mashg'ulot

1. Terminal 1: `tail -F /var/log/syslog`. Terminal 2: `logger "hello devops"`.
2. `less +F /var/log/syslog`: `Ctrl+C`, `?hello`, `F` workflow'ini sinab ko'ring; `&sshd` filter'i.
3. Rotation simulyatsiyasi: `while true; do date >> /tmp/r.log; sleep 1; done &`. Bir terminalda `tail -f /tmp/r.log`, boshqasida `tail -F /tmp/r.log`. `mv /tmp/r.log /tmp/r.log.1` qiling — farqni kuzating.
4. Ochiq file: `python3 -c "f=open('/tmp/big','w'); f.write('x'*100_000_000); f.flush(); import time; time.sleep(600)" &`, keyin `df -h /tmp`, `rm /tmp/big`, yana `df -h /tmp`, `lsof +L1` bilan toping va process'ni to'xtatib joy bo'shaganini ko'ring.
5. `printf 'echo hi\r\n' > w.sh; bash w.sh` — xatoni o'qing va tuzating.

## Uy vazifa

1. `logrotate`'dagi `copytruncate` va `create` + `postrotate` (signal) usullarini solishtiring: qaysi biri log yo'qotishi mumkin va nega? Diagramma bilan.
2. `/etc/logrotate.d/` ichidan bitta config'ni o'qing va har qatorni tushuntiring.
3. `free -h` chiqishini tushuntiring: `used`, `buff/cache`, `available` farqi.

## Test savollari

1. 20 GB log'ning oxirgi 100 qatorini ko'rish uchun qaysi tool va nega u tez?
2. `tail -f` va `tail -F` farqi? Qaysi holatda `-f` "jim" bo'lib qoladi?
3. Log o'chirildi, lekin disk bo'shamadi — root cause va 2 ta yechim?
4. `copytruncate`'ning xavfi nima?
5. Nega zamonaviy app'lar log'ni stdout'ga yozadi?
6. `free`'da RAM deyarli to'la ko'rinsa, bu muammomi?
7. `^M` va BOM belgilari qanday muammo chiqaradi va qanday tekshiriladi?

## Common mistakes

- Katta file'ni editor'da ochish.
- `tail -f` bilan rotation'dan keyin "log to'xtadi" deb o'ylash.
- Ishlayotgan servis log'ini `rm` qilish.
- `buff/cache`'ni "band RAM" deb hisoblash.
- Yuklangan prod server'da og'ir log tahlilini ehtiyotsiz ishga tushirish.

## Senior xulosa

- O'qish — `less`, kuzatish — `tail -F`, tozalash — `truncate`. Disk bo'shamasa — `lsof +L1`.
- Tool ichida nima qilishini biling: `tail` oxiriga sakraydi, `wc -l` hammasini o'qiydi.
- Kernel page cache — RAM'dagi disk nusxasi: ikkinchi o'qish tez, `available` — haqiqiy bo'sh xotira.
- Log rotation — dizayn qarori: signal bilan qayta ochish xavfsiz, `copytruncate` log yo'qotishi mumkin, stdout + platforma — eng sodda.
