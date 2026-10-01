# Dars 6 — Fayl o'qish

> **Natija:** vaziyatga qarab to'g'ri vosita tanlash, jonli log'ni kuzatish, katta fayllar bilan xavfsiz ishlash. Page cache, log rotation strategiyalari, o'chirilgan lekin ochiq fayl, binary va encoding muammolari.

## 1. Linux'da hamma narsa fayl ("everything is a file")

Linux'da text, config, log, device (`/dev/sda`), process ma'lumoti (`/proc`), hatto kernel parametrlari (`/sys`) — hammasi fayl interfeysi orqali o'qiladi. Bir xil vositalar (`cat`, `less`, `grep`) hamma joyda ishlaydi.

```bash
file /etc/passwd        # ASCII text
file /bin/ls            # ELF 64-bit executable
file data.gz            # gzip compressed data
cat /proc/loadavg       # kernel'dan jonli ma'lumot, diskda yo'q
```

> **Tuzoq:** binary faylni `cat` qilmang — terminal'ga control belgilar yuboriladi va u buziladi (g'alati belgilar, kursor yo'qoladi). Tuzatish: `reset`. Binary ichini ko'rish: `xxd file | head` yoki `strings file | less`.

## 2. Qaysi holatda qaysi buyruq

| Vaziyat | Vosita | Nega |
|---|---|---|
| Kichik fayl (< bir necha yuz qator) | `cat` | Butun fayl bir zumda |
| Katta fayl, ko'rib chiqish kerak | `less` | Butun faylni RAM'ga yuklamaydi, sahifalab o'qiydi |
| Format/header'ni bilish | `head -n 20` | Faqat boshi |
| Oxirgi event'lar | `tail -n 200` | Faqat oxiri, fayl oxiridan o'qiydi |
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

### Nega `tail` 20 GB faylda ham bir zumda?

`tail` faylni boshidan o'qimaydi: `lseek()` bilan oxiriga sakraydi va orqaga qarab qator qidiradi. `wc -l` esa butun faylni o'qishi shart — 20 GB'da sekin. Vositaning **ichida nima qilishini** bilish — performance intuition'ning asosi.

## 3. `less` — katta fayllarni o'qishning asosiy vositasi

| Key | Vazifa |
|---|---|
| `g / G` | Boshi / oxiri |
| `/error`, `?error` | Pastga / yuqoriga qidiruv |
| `n / N` | Keyingi / oldingi natija |
| `&error` | Faqat mos qatorlarni ko'rsatish (filter) |
| `F` | Follow mode (`tail -f` kabi), `Ctrl+C` — to'xtatib ko'rib chiqish |
| `-S` | Uzun qatorlarni o'ramaslik (JSON log'lar uchun) |
| `-N` | Qator raqamlari |
| `:n` | Keyingi fayl (`less a.log b.log`) |

**Ish tartibi:** `less +F app.log` — jonli kuzatasiz; muammo ko'rinsa `Ctrl+C` — to'xtab, `?ERROR` bilan orqaga qidirasiz; `F` — yana jonli rejimga. `tail -f` bunday qila olmaydi.

## 4. Page cache — nega fayl ikkinchi marta tezroq o'qiladi

```
 1-marta: less big.log -> kernel diskdan o'qiydi -> page cache (RAM) -> sizga
 2-marta: less big.log -> kernel page cache'dan beradi (disk yo'q)    -> juda tez
```

- Kernel bo'sh RAM'ni disk cache uchun ishlatadi. `free -h`'da bu `buff/cache` ustuni.
- **"RAM tugadi" deb vahima qilmang:** `free`'da `available` ustuniga qarang — cache kerak bo'lsa bo'shatiladi.
- Benchmark tuzog'i: ikkinchi ishga tushirish har doim tezroq — cache isigan. Haqiqiy disk tezligini o'lchash uchun cold cache kerak.

> **Production'dagi nozik jihat:** 50 GB log'ni `cat` / `grep` qilish page cache'ni "ifloslaydi" — DB yoki app'ning issiq data'si cache'dan siqib chiqarilishi mumkin va ular sekinlashadi. Yuklangan prod server'da katta tahlilni `nice -n 19 ionice -c3` bilan yoki log'ni boshqa joyga ko'chirib bajaring.

## 5. Log rotation va `tail -f` bilan `tail -F` farqi

**Muammo:** log cheksiz o'sadi va disk'ni to'ldiradi. **Yechim:** `logrotate` (yoki app'ning o'zi) log'ni muntazam aylantiradi.

```
 logrotate:  app.log --rename--> app.log.1     yangi bo'sh app.log yaratiladi
                                 app.log.1 --> app.log.2.gz (siqiladi) ...

 tail -f  ->  file descriptor (inode) bo'yicha kuzatadi
              -> app.log.1 da qoladi, yangi log'lar ko'rinmaydi

 tail -F  ->  NOM bo'yicha kuzatadi, file almashsa qayta ochadi
              -> yangi app.log'ga o'tadi
```

Production'da doim `tail -F` (= `--follow=name --retry`).

### Log'ni aylantirish usullari: afzallik va kamchiliklar

| Usul | Qanday | Afzallik | Xavf |
|---|---|---|---|
| **create + signal** | rename, yangi fayl, app'ga signal (`SIGHUP`/`SIGUSR1`) — app faylni qayta ochadi | Log yo'qolmaydi | App signal'ni qo'llab-quvvatlashi kerak |
| **copytruncate** | Nusxa oladi, keyin original'ni 0 ga qisqartiradi | App'ni o'zgartirish shart emas | Nusxa va truncate o'rtasida yozilgan qatorlar **yo'qoladi**; katta faylda nusxa sekin |
| **App o'zi rotate qiladi** | Logging kutubxonasi (lumberjack va h.k.) | To'liq nazorat | Har app o'zicha sozlanadi |
| **stdout -> journald / container runtime** | App faqat stdout'ga yozadi | App fayl haqida umuman bilmaydi | Rotation runtime sozlamalariga bog'liq |

> **Zamonaviy yondashuv (12-factor):** app log'ni **stdout**'ga yozadi, fayl bilan ishlamaydi. Rotation, saqlash va markazlashtirish — platformaning ishi (systemd-journald, Docker log driver, Kubernetes + Loki/ELK). Bu app'ni soddalashtiradi va disk to'lishi muammosini bir joyda hal qiladi.

## 6. Tuzoq: fayl o'chirildi, lekin disk bo'shamadi

**Holat:** disk 100%. Katta log'ni `rm` qildingiz, `df` hali ham 100%.

**Asl sabab:** `rm` faqat directory entry'ni o'chiradi (inode link count -> 0). Lekin process faylni hali ochiq ushlab turibdi. Kernel inode va data'ni **oxirgi fd yopilgandagina** bo'shatadi.

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
| Servisni reload/restart (fayl qayta ochiladi) | Qisqa uzilish mumkin bo'lsa |
| `: > /proc/<PID>/fd/<N>` — ochiq fd orqali truncate | Restart qilib bo'lmasa, darhol joy kerak |
| Kelajakda: `rm` emas, `truncate -s 0 app.log` | Profilaktika |

> **Qoida:** ishlayotgan servis log'ini `rm` qilmang — **truncate** qiling yoki logrotate'ga topshiring.

## 7. Katta fayllar

```bash
ls -lh big.log; du -h big.log      # hajm (du — diskda haqiqatda egallagan joy)
wc -l big.log                      # qator soni (butun file o'qiladi)
grep -c ERROR big.log              # sanash
zcat app.log.2.gz | less           # siqilgan log
zgrep ERROR app.log.*.gz           # siqilganlar ichida qidirish
split -l 1000000 big.log part_     # bo'laklarga ajratish
```

> 10 GB faylni editor'da (`vim`, `nano`) ochmang — butun fayl RAM'ga yuklanadi, server swap'ga tushishi mumkin. `less` ishlating.

**`ls -l` va `du` farqi:** `ls` faylning "mantiqiy" hajmini, `du` diskda egallagan joyni ko'rsatadi. **Sparse fayl**'larda (VM disk image, ba'zi DB fayllar) `ls` 100 GB, `du` 2 GB ko'rsatishi mumkin.

## 8. Kodlash (encoding) va qator oxiri belgilari

- Windows fayllari `\r\n` (CRLF) bilan tugaydi -> script'da `bad interpreter: /bin/bash^M` yoki `$'\r': command not found` xatosi.
- Tekshirish: `cat -A script.sh` (qator oxirida `^M$`) yoki `file script.sh` (`with CRLF line terminators`).
- Tuzatish: `dos2unix script.sh` yoki `sed -i 's/\r$//' script.sh`.
- **Profilaktika:** repo'da `.gitattributes` ichida `*.sh text eol=lf` — git o'zi to'g'ri saqlaydi.

Encoding:

```bash
file -i notes.txt                       # charset=utf-8 yoki iso-8859-1
iconv -f WINDOWS-1251 -t UTF-8 old.txt > new.txt
```

> **UTF-8 BOM tuzog'i:** ba'zi Windows editor'lar fayl boshiga ko'rinmas `EF BB BF` baytlarini qo'yadi. Natija: `#!/bin/bash` birinchi qator bo'lib tanilmaydi, JSON parser xato beradi. Tekshirish: `head -c 3 file | xxd`.

## 9. Nima buzilishi mumkin

| Belgi | Sabab | Tekshirish |
|---|---|---|
| `tail -f` yangi log'ni ko'rsatmay qoldi | Rotation, fd eski faylda | `tail -F` ishlating |
| Disk to'la, `rm` yordam bermadi | Ochiq fd | `lsof +L1` |
| Log'da qatorlar yo'qolgan | `copytruncate` poygasi | Rotation usulini o'zgartirish |
| Terminal buzildi | Binary `cat` qilindi | `reset` |
| Script `^M` xatosi | CRLF | `cat -A`, `dos2unix` |
| Debug paytida prod sekinlashdi | Katta fayl o'qish page cache va I/O'ni bosdi | `ionice`, boshqa joyda tahlil |

## Amaliy mashg'ulot

1. Terminal 1: `tail -F /var/log/syslog`. Terminal 2: `logger "hello devops"`.
2. `less +F /var/log/syslog`: `Ctrl+C`, `?hello`, `F` ish tartibini sinab ko'ring; `&sshd` filter'i.
3. Rotation simulyatsiyasi: `while true; do date >> /tmp/r.log; sleep 1; done &`. Bir terminalda `tail -f /tmp/r.log`, boshqasida `tail -F /tmp/r.log`. `mv /tmp/r.log /tmp/r.log.1` qiling — farqni kuzating.
4. Ochiq fayl: `python3 -c "f=open('/tmp/big','w'); f.write('x'*100_000_000); f.flush(); import time; time.sleep(600)" &`, keyin `df -h /tmp`, `rm /tmp/big`, yana `df -h /tmp`, `lsof +L1` bilan toping va process'ni to'xtatib joy bo'shaganini ko'ring.
5. `printf 'echo hi\r\n' > w.sh; bash w.sh` — xatoni o'qing va tuzating.

## Uy vazifa

1. `logrotate`'dagi `copytruncate` va `create` + `postrotate` (signal) usullarini solishtiring: qaysi biri log yo'qotishi mumkin va nega? Diagramma bilan.
2. `/etc/logrotate.d/` ichidan bitta config'ni o'qing va har qatorni tushuntiring.
3. `free -h` chiqishini tushuntiring: `used`, `buff/cache`, `available` farqi.

## Test savollari

1. 20 GB log'ning oxirgi 100 qatorini ko'rish uchun qaysi vosita va nega u tez?
2. `tail -f` va `tail -F` farqi? Qaysi holatda `-f` "jim" bo'lib qoladi?
3. Log o'chirildi, lekin disk bo'shamadi — asl sabab va 2 ta yechim?
4. `copytruncate`'ning xavfi nima?
5. Nega zamonaviy app'lar log'ni stdout'ga yozadi?
6. `free`'da RAM deyarli to'la ko'rinsa, bu muammomi?
7. `^M` va BOM belgilari qanday muammo chiqaradi va qanday tekshiriladi?

## Ko'p uchraydigan xatolar

- Katta faylni editor'da ochish.
- `tail -f` bilan rotation'dan keyin "log to'xtadi" deb o'ylash.
- Ishlayotgan servis log'ini `rm` qilish.
- `buff/cache`'ni "band RAM" deb hisoblash.
- Yuklangan prod server'da og'ir log tahlilini ehtiyotsiz ishga tushirish.

## Xulosa

- O'qish — `less`, kuzatish — `tail -F`, tozalash — `truncate`. Disk bo'shamasa — `lsof +L1`.
- Vosita ichida nima qilishini biling: `tail` oxiriga sakraydi, `wc -l` hammasini o'qiydi.
- Kernel page cache — RAM'dagi disk nusxasi: ikkinchi o'qish tez, `available` — haqiqiy bo'sh xotira.
- Log rotation — dizayn qarori: signal bilan qayta ochish xavfsiz, `copytruncate` log yo'qotishi mumkin, stdout + platforma — eng sodda.
