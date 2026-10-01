# Dars 5 — Navigatsiya

> **Natija:** filesystem'da erkin harakat qilish, absolute/relative path, glob, xavfsiz file operatsiyalari. Senior darajada: inode, hard link va symlink farqi, `mv` va `cp` ichkarida nima qiladi, atomic yozish, script'larda path bilan bog'liq xavflar.

## 1. Problem — fayllar qayerda va qanday topiladi?

Server'da GUI file manager yo'q. Siz bilishingiz kerak:
- hozir qayerdaman;
- kerakli file qayerda (config, log, app);
- uni qanday qilib **xavfsiz** ko'chirish, nusxalash, o'chirish mumkin.

Server'da `rm` xatosi qaytarilmaydi — **Korzina yo'q**. Shuning uchun bu dars nafaqat "qanday", balki "qanday qilib buzmaslik" haqida.

## 2. Mental model — bitta tree

Linux'da hammasi bitta tree, uning root'i — `/`. Disk'lar shu tree'ga **mount** qilinadi (Windows'dagi `C:` / `D:` kabi harflar yo'q).

```
/                         <- root
+-- etc/                  <- config'lar
+-- home/
|   +-- student/          <- ~ (home directory)
|       +-- docs/
|       +-- notes.txt
+-- var/
|   +-- log/              <- log'lar
+-- mnt/data/             <- boshqa disk shu yerga mount qilingan bo'lishi mumkin
```

```bash
findmnt          # qaysi disk/filesystem qaysi papkaga mount qilingan
df -h .          # joriy papka qaysi filesystem'da
```

> **Nega bu muhim:** `/var/log` to'lsa, bu `/` ham to'ladi degani bo'lishi mumkin (agar ular bitta filesystem'da bo'lsa). Production'da `/var` yoki data papkalari ko'pincha alohida disk'ka chiqariladi — log to'lsa ham OS ishlayveradi.

## 3. Asosiy command'lar

```bash
pwd                   # current (working) directory
ls -lah               # long, all (hidden), human-readable
ls -lt                # vaqt bo'yicha, yangisi tepada
ls -ld /etc           # directory'ning o'zi, ichidagilari emas
cd /etc               # absolute path
cd ..                 # parent directory
cd ~   yoki  cd       # home
cd -                  # oldingi directory
pushd /var/log; popd  # directory stack
tree -L 2             # tree ko'rinishi (alohida o'rnatiladi)
```

`ls -l` chiqishini o'qish:

```
-rw-r--r-- 1 student student 1.2K Oct  1 10:00 notes.txt
|          | |       |       |    |            +-- nom
|          | |       |       |    +-- oxirgi o'zgarish vaqti (mtime)
|          | |       |       +-- hajm
|          | +-------+-- owner va group (9-11 darslar)
|          +-- hard link soni
+-- tur (- file, d directory, l symlink) + ruxsatlar (10-dars)
```

> **Gotcha:** `.` bilan boshlangan file'lar (`.bashrc`, `.env`, `.git`) yashirin. `ls` ularni ko'rsatmaydi — `ls -a` kerak. Ko'p "file yo'q" degan xatolar aslida yashirin file.

## 4. Absolute vs relative path

| Tur | Boshlanishi | Misol | Qayerda ishlatiladi |
|---|---|---|---|
| Absolute | `/` | `/var/log/nginx` | Script, cron, systemd unit, config |
| Relative | current dir'dan | `../logs` | Interaktiv ishda |

Relative path **har doim joriy directory'ga nisbatan**. Joriy directory esa process'ning holati — u kimga bog'liq, qayerdan ishga tushirilganiga.

> **Senior gotcha:** cron va systemd script'ni **boshqa working directory**'da ishga tushiradi (odatda `/` yoki home). Script ichida `./config.yml` bo'lsa, u topilmaydi. Yechimlar:
> - absolute path ishlatish;
> - script o'z papkasiga o'tishi: `cd "$(dirname "$(readlink -f "$0")")"`;
> - systemd'da `WorkingDirectory=/opt/app`.

## 5. File operatsiyalari — naive vs xavfsiz

```bash
mkdir -p a/b/c                  # nested; mavjud bo'lsa xato bermaydi (idempotent)
mkdir -p proj/{src,logs,tmp}    # brace expansion
touch file.txt                  # bo'sh file yaratadi yoki timestamp'ni yangilaydi
cp -a src/ dst/                 # archive: permission, owner, timestamp, symlink saqlanadi
cp -i a b                       # overwrite'dan oldin so'raydi
mv -n a b                       # mavjud file'ni ustidan yozmaydi
rm -i file                      # so'rab o'chiradi
rm -rf dir/                     # QAYTARIB BO'LMAYDI
```

### Idempotency — automation'ning asosiy xususiyati

**Idempotent** — necha marta ishga tushirsangiz ham natija bir xil.

| Command | Idempotent? | Ikkinchi marta |
|---|---|---|
| `mkdir dir` | Yo'q | `File exists` xatosi, script to'xtaydi |
| `mkdir -p dir` | Ha | Hech narsa qilmaydi |
| `rm file` | Yo'q | `No such file` xatosi |
| `rm -f file` | Ha | Jim |
| `echo x >> file` | Yo'q | Qator ikki marta qo'shiladi |

Deploy script'lar qayta ishga tushirilishi kerak (xato bo'lsa, retry). Shuning uchun idempotent command'larni tanlang. Ansible, Terraform kabi tool'lar shu g'oya ustiga qurilgan.

### `rm -rf` va bo'sh o'zgaruvchi

> **Ogohlantirish:** `rm -rf "$DIR/"*` — agar `$DIR` bo'sh yoki e'lon qilinmagan bo'lsa, `rm -rf /*` ga aylanadi va butun tizimni o'chiradi. Bu real incident'lar sababi bo'lgan.

```bash
# Naive (xavfli)
rm -rf "$DIR/"*

# Better
set -u                                   # e'lon qilinmagan o'zgaruvchi = xato
rm -rf "${DIR:?DIR o'rnatilmagan}/"*     # bo'sh bo'lsa to'xtaydi

# Production
[[ "$DIR" == /opt/app/releases/* ]] || { echo "kutilmagan path: $DIR" >&2; exit 1; }
rm -rf -- "$DIR"
```

Production versiyada qo'shimcha himoya: o'chiriladigan path kutilgan joyda ekanini tekshirish (allowlist) va `--` (path `-` bilan boshlansa ham option deb o'qilmaydi).

### `mv` ichkarida nima qiladi

```
 Bir filesystem ichida:     mv = rename() syscall
                            - bir zumda (1 GB file ham)
                            - ATOMIC: boshqa process yo eski, yo yangi holatni ko'radi

 Boshqa filesystem'ga:      mv = copy + delete
                            - sekin, hajmga bog'liq
                            - atomic EMAS: o'rtada uzilsa, yarim file qoladi
```

### Atomic yozish pattern'i (production)

Config yoki muhim file'ni to'g'ridan-to'g'ri ustidan yozsangiz, o'qiyotgan process yarim yozilgan file'ni ko'rishi mumkin.

```bash
# Naive: o'qiyotgan app yarim file'ni ko'rishi mumkin
generate_config > /etc/app/config.yml

# Production: yonida yozib, atomic rename
tmp=$(mktemp /etc/app/.config.yml.XXXXXX)
generate_config > "$tmp"
mv "$tmp" /etc/app/config.yml      # bir filesystem -> rename(), atomic
```

Muhim: vaqtinchalik file **o'sha papkada** (o'sha filesystem'da) bo'lishi kerak, `/tmp`'da emas — aks holda `mv` atomic bo'lmaydi.

### Deploy'da symlink switch

```bash
/opt/app/releases/v41/
/opt/app/releases/v42/
/opt/app/current -> releases/v42      # app shu yerdan ishlaydi

ln -sfn releases/v43 /opt/app/current.tmp && mv -T /opt/app/current.tmp /opt/app/current
```

Yangi versiyaga o'tish — bitta atomic rename. Rollback — symlink'ni eski versiyaga qaytarish. Capistrano va ko'p deploy tool'lari shunday ishlaydi.

## 6. Glob (wildcard)

```bash
ls *.log             # .log bilan tugaganlar
ls app-?.log         # bitta istalgan belgi
ls file[0-9].txt     # diapazon
ls {a,b}.txt         # brace expansion (glob emas: file mavjudligini tekshirmaydi)
```

**Glob'ni shell ochadi, command emas.** `ls *.log` -> bash uni `ls a.log b.log` ga aylantiradi, `ls` faqat tayyor ro'yxatni ko'radi.

Natijalar:
- Mos file topilmasa, bash pattern'ni o'zgarishsiz uzatadi: `ls *.xyz` -> `cannot access '*.xyz'`.
- `*` yashirin (`.` bilan boshlangan) file'larni olmaydi.
- File juda ko'p bo'lsa: `rm *.tmp` -> `Argument list too long`. Yechim: `find . -name '*.tmp' -delete`.

> **Security gotcha:** `-rf` nomli file yaratilsa, `rm *` uni option deb o'qiydi. Har doim `rm -- *` yoki `rm ./*` yozing.

## 7. inode — file aslida nima

File nomi — faqat **directory entry**. Haqiqiy file — **inode**: metadata (owner, permission, size, vaqtlar, data block'lar manzili). **Nom inode ichida yo'q.**

```
 directory entry          inode #1234                 data blocks
 "notes.txt" ---------->  owner, mode, size  ------->  [....]
 "backup.txt" --------->  link count = 2
```

```bash
ls -li                 # inode raqami birinchi ustunda
stat notes.txt         # inode'ning barcha metadata'si
df -i                  # inode'lar ishlatilishi
```

### Bundan kelib chiqadigan production faktlar

1. **Disk bo'sh, lekin `No space left on device`.** Inode'lar tugagan: millionlab mayda file (session, cache, mail queue). Tekshirish: `df -i`. Topish: `sudo du --inodes -x / | sort -n | tail`.
2. **File o'chirildi, lekin disk bo'shamadi.** File inode'ni ochiq ushlab turgan process bor (masalan, log yozayotgan app). Data link count 0 bo'lib, **barcha fd'lar yopilgandagina** o'chadi. Topish: `sudo lsof +L1`. Yechim: process'ni restart yoki log'ni o'chirish o'rniga `truncate -s 0 file` (6-darsda chuqurroq).
3. **`mv` bir filesystem ichida bir zumda** — faqat directory entry o'zgaradi, data ko'chmaydi.

## 8. Hard link vs symlink

```bash
ln file.txt hard.txt        # hard link — o'sha inode'ga yangi nom
ln -s /etc/nginx cfg        # symlink — path'ni saqlovchi kichik file
```

```
 Hard link                          Symlink
 "file.txt" --+                     "cfg" --> "/etc/nginx" (matn) --> inode
 "hard.txt" --+--> inode #1234      original o'chirilsa: "cfg" -> yo'q joy (broken)
 ikkala nom teng huquqli
```

| | Hard link | Symlink |
|---|---|---|
| Nimaga ishora qiladi | inode | path (matn) |
| Original o'chirilsa | Ishlayveradi (link count > 0) | **Broken link** |
| Directory uchun | yo'q | ha |
| Boshqa filesystem'ga | yo'q (inode raqami faqat FS ichida unikal) | ha |
| Ko'rinishi | Oddiy file, ajratib bo'lmaydi | `ls -l` da `l` va `->` |

**Real misollar:**
- `/etc/nginx/sites-enabled/site -> ../sites-available/site` — config'ni yoqish/o'chirish.
- `/opt/app/current -> releases/v42` — deploy (yuqorida).
- `/usr/bin/python3 -> python3.12` — versiyalar.

> **Gotcha:** relative symlink **link joylashgan papkaga** nisbatan hisoblanadi, siz turgan joyga emas. `ln -s ../sites-available/site /etc/nginx/sites-enabled/` — to'g'ri; `ln -s sites-available/site ...` — broken bo'ladi.

> **Security gotcha (Staff darajada):** root ishlaydigan script `/tmp/report.txt`'ga yozsa, hujumchi oldindan `/tmp/report.txt -> /etc/passwd` symlink yaratib qo'yishi mumkin (symlink attack). Yechim: `mktemp` ishlating, oldindan ma'lum nomlarni emas.

## 9. Path xatolari va debugging

| Symptom | Sabab | Yechim |
|---|---|---|
| `No such file or directory`, lekin file bor | Typo, case (`Docs` != `docs`) | `Tab`, `ls` |
| Nomda probel | Shell ikki so'zga bo'ladi | `"My Docs"` yoki `My\ Docs` |
| Symlink ishlamaydi | Broken link | `ls -l`, `readlink -f` |
| Script'da ishlaydi, cron'da yo'q | Working directory boshqa | Absolute path |
| `No space left`, `df -h` bo'sh | Inode tugagan | `df -i` |
| `rm` qildim, disk bo'shamadi | Ochiq fd | `lsof +L1` |

> **Qoida:** script'larda har doim o'zgaruvchilarni qo'shtirnoq ichiga oling: `"$file"`. Qo'shtirnoqsiz `$file` probel bor nomda ikki argumentga bo'linadi va noto'g'ri file ustida ish qiladi.

## Amaliy mashg'ulot

1. `mkdir -p ~/lab/{src,logs,backup}`, `tree ~/lab` yoki `find ~/lab`.
2. `cp` va `cp -a` farqini `ls -l` timestamp'larida ko'ring.
3. Hard link va symlink yarating, `ls -li` bilan inode'larni solishtiring. Original'ni o'chiring — qaysi biri ishlayveradi?
4. Atomic switch: `releases/v1`, `releases/v2` yarating, `current` symlink'ni `ln -sfn` + `mv -T` bilan almashtiring.
5. Buzib-tuzat: `python3 -c "f=open('/tmp/big','w'); import time; time.sleep(600)" &` bilan file ochiq qoldiring, `rm /tmp/big`, keyin `lsof +L1` bilan topib, sababni tushuntiring.
6. `touch -- -rf` yarating va `rm *` nima qilishini o'ylab ko'ring (ishga tushirmasdan). Keyin xavfsiz o'chiring.

## Uy vazifa

1. Script yozing: `TARGET` papkasini tozalaydi. `set -u`, `${TARGET:?}` va allowlist tekshiruvi bilan. `TARGET`siz va `TARGET=/` bilan ishga tushirib, himoya ishlaganini ko'rsating.
2. Config file'ni atomic yangilaydigan script yozing va nega `mktemp` `/tmp`'da emas, o'sha papkada bo'lishi kerakligini tushuntiring.
3. 10 000 ta bo'sh file yarating (`touch f{1..10000}`), `df -i` qanday o'zgarganini ko'ring, keyin `find . -name 'f*' -delete` bilan tozalang.

## Test savollari

1. Nega cron script'ida relative path xavfli? 3 ta yechim ayting.
2. Idempotent command nima? `mkdir` va `mkdir -p` misolida tushuntiring.
3. `rm -rf "$DIR/"*` nega xavfli va qanday himoyalanadi?
4. Nega bir filesystem ichida `mv` atomic, boshqasiga esa yo'q?
5. Hard link va symlink farqi? Nega hard link boshqa filesystem'ga qilinmaydi?
6. Disk bo'sh, lekin `No space left` — 2 ta mumkin bo'lgan sabab?
7. File o'chirildi, lekin disk bo'shamadi — nega va qanday topasiz?
8. Glob'ni kim ochadi — shell'mi yoki command? Bundan qanday xavf kelib chiqadi?

## Common mistakes

- Script'da relative path va qo'shtirnoqsiz o'zgaruvchilar.
- `rm -rf` dan oldin o'zgaruvchini tekshirmaslik.
- Muhim file'ni joyida qayta yozish (atomic emas).
- `mkdir` / `echo >>` bilan idempotent bo'lmagan deploy script.
- Disk muammosida faqat `df -h`'ga qarash, `df -i` va `lsof +L1`'ni unutish.

## Senior xulosa

- Linux'da bitta tree, disk'lar unga mount qilinadi. Qaysi papka qaysi disk'da — `findmnt`, `df`.
- Nom — faqat ishora, file — inode. Bundan: hard link, inode tugashi, "o'chirilgan, lekin joy egallagan" file.
- Bir filesystem ichida `rename()` atomic — atomic config yozish va symlink deploy shunga tayanadi.
- Script'larda: absolute path, qo'shtirnoq, `set -u`, `${VAR:?}`, `--`, idempotent command'lar.
- Server'da Korzina yo'q: har xavfli operatsiyadan oldin "noto'g'ri bo'lsa nima bo'ladi?" deb so'rang.
