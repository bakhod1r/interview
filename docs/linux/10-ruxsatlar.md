# Dars 10 — Ruxsatlar (rwx, chmod)

> **Natija:** `ls -l` natijasini o'qish, `chmod`'ni symbolic va octal usulda ishlatish, `Permission denied`'ni tizimli diagnostika qilish. Senior darajada: kernel tekshiruv algoritmi, papkadagi ruxsatlarning haqiqiy ma'nosi, umask, maxsus bit'lar (SUID, SGID, sticky), ACL va least privilege.

## 1. Problem — kim nimani qila oladi?

9-darsda identity'ni (user, group) ko'rdik. Endi savol: **shu identity aniq bir file bilan nima qila oladi?**

- `.env` file'idagi DB parolini kim o'qiy oladi?
- Deploy script'ini kim ishga tushira oladi?
- `/var/www`'ga kim yangi file qo'sha oladi?

Linux'ning klassik javobi — har file'da 9 bit: **3 ta toifa x 3 ta amal**. Oddiy, tez, 50 yildan beri ishlaydi. Cheklovlari ham bor (7-bo'lim).

## 2. rwx — file va papka uchun boshqa ma'no

| Belgi | File'ga | Papkaga |
|---|---|---|
| `r` (4) | Mazmunni o'qish | Ichidagi **nomlar** ro'yxatini ko'rish (`ls`) |
| `w` (2) | Mazmunni o'zgartirish | Ichida file **yaratish, o'chirish, nomini o'zgartirish** |
| `x` (1) | Dastur sifatida ishga tushirish | Ichiga **kirish** (`cd`) va ichidagi file'larga murojaat |

### Mental model: papka — bu "nom -> inode" jadvali

5-darsdan eslang: papka — nomlar ro'yxati. Shunda:
- `r` — jadvalni o'qish (nomlarni ko'rish).
- `w` — jadvalni o'zgartirish (qator qo'shish/o'chirish = file yaratish/o'chirish).
- `x` — jadval orqali inode'ga o'tish (file'ni ochish).

Bundan kelib chiqadigan, ko'pchilikni hayron qoldiradigan faktlar:

| Holat | Natija | Nega |
|---|---|---|
| File'da `w` yo'q, papkada `w` bor | File'ni **o'chira olasiz** | O'chirish — papka jadvalini o'zgartirish |
| File'da `w` bor, papkada `w` yo'q | Mazmunni o'zgartira olasiz, o'chira olmaysiz | |
| Papkada `r` bor, `x` yo'q | Nomlarni ko'rasiz, file'larni ocholmaysiz | Inode'ga o'tolmaysiz |
| Papkada `x` bor, `r` yo'q | Nomni bilsangiz ochasiz, `ls` ishlamaydi | "Yashirin" papka |
| `/a/b/c/file.txt` | **Yo'ldagi har bir papkada** `x` kerak | Har qadamda jadval orqali o'tiladi |

## 3. Owner / group / other

```
 -rwxr-x---  1 ali deploy  script.sh
 |\_/\_/\_/
 | |  |  +-- other : ---  = 0
 | |  +----- group : r-x  = 5
 | +-------- owner : rwx  = 7     -> chmod 750
 +---------- tur: - file, d papka, l symlink, s socket, p pipe, c/b device
```

### Kernel tekshiruv algoritmi

```
 Process (UID, GID'lar) file'ga murojaat qildi
   |
   +-- UID == 0 (root)?        -> deyarli hammasiga ruxsat (pastda istisno)
   +-- UID == file owner?      -> FAQAT owner bit'lari ishlatiladi. Tamom.
   +-- GID'lardan biri == file group? -> FAQAT group bit'lari. Tamom.
   +-- aks holda               -> other bit'lari
```

**Birinchi mos kelgan toifa ishlatiladi, qolganlari tekshirilmaydi.** Natija — paradoks:

```
 ----rwx---  ali deploy  file
 ali (owner, deploy group'ida ham) -> owner bit'lari "---" -> RUXSAT YO'Q
 vali (deploy group'ida)           -> group bit'lari "rwx" -> ruxsat bor
```

Root istisnosi: root `r` va `w` tekshiruvlarini chetlab o'tadi, lekin `x` bit'i **hech kimda** bo'lmagan file'ni ishga tushira olmaydi.

## 4. Octal hisob

```
r=4  w=2  x=1
rwx = 4+2+1 = 7
rw- = 4+2   = 6
r-x = 4+1   = 5
r-- = 4     = 4
--- = 0
```

**Nega aynan 4-2-1?** Har amal — bitta bit. 3 bit = bitta octal raqam (0–7). Har raqam yagona kombinatsiyani bildiradi.

| Octal | Ma'no | Qayerda |
|---|---|---|
| `644` | rw-r--r-- | Oddiy file, public config |
| `640` | rw-r----- | Servis group'i o'qiydigan config |
| `600` | rw------- | Maxfiy: SSH private key, `.env`, token |
| `755` | rwxr-xr-x | Script, binary, papka |
| `750` | rwxr-x--- | Faqat jamoa uchun papka |
| `700` | rwx------ | `~/.ssh`, shaxsiy papka |
| `777` | Hamma hammasi | **Deyarli hech qachon** |

### Nega `777` — "tuzatish" emas

`Permission denied` chiqdi -> `chmod -R 777` -> ishladi. Bu symptom'ni yashiradi, root cause'ni emas:
- Server'dagi **istalgan** process (buzilgan web app ham) file'ni o'zgartira oladi -> kodni almashtirish, backdoor.
- Ba'zi tool'lar xavfli ruxsatni rad etadi: SSH `UNPROTECTED PRIVATE KEY FILE` deb kalitni ishlatmaydi.
- Haqiqiy savol javobsiz qoladi: "**qaysi** user'ga **qanday** ruxsat kerak edi?"

## 5. chmod

```bash
chmod 644 file.txt
chmod 755 deploy.sh
chmod u+x deploy.sh          # owner'ga x qo'shish
chmod g-w file.txt           # group'dan w olish
chmod o= secret.txt          # other'dan hammasini olish
chmod u=rw,g=r,o= a.txt      # = 640
chmod -R g+rX /srv/site      # katta X: faqat papkalarga va allaqachon x bor file'larga
```

### Rekursiv chmod — naive vs to'g'ri

```bash
# Naive: barcha file'lar ham executable bo'lib qoladi
chmod -R 755 /srv/site

# Better: papka va file'ga alohida
find /srv/site -type d -exec chmod 755 {} +
find /srv/site -type f -exec chmod 644 {} +

# Yoki symbolic katta X bilan
chmod -R u=rwX,g=rX,o= /srv/site
```

> **Ehtiyot:** `chmod -R` va `chown -R`'ni `/` yoki noto'g'ri papkada ishga tushirish tizimni buzadi (`sudo`, `ssh` ishlamay qoladi). Avval `ls -ld` bilan path'ni tekshiring.

## 6. umask — yangi file'larning default ruxsati

Yangi file qanday ruxsat bilan yaratiladi? Dastur so'raydi (file uchun odatda `666`, papka uchun `777`), **umask** esa undan bit'larni olib tashlaydi.

```
 umask 022:   file  666 - 022 -> 644 (rw-r--r--)
              papka 777 - 022 -> 755 (rwxr-xr-x)
 umask 077:   file  -> 600,  papka -> 700   (maxfiy muhit)
 umask 002:   file  -> 664,  papka -> 775   (jamoaviy ish, User Private Group bilan)
```

(Aniq aytganda bu ayirish emas, `mode & ~umask` bit amali, lekin natija odatda bir xil.)

```bash
umask           # 0022
umask 077       # shu shell uchun
```

- Servis uchun: systemd'da `UMask=0027`.
- Script maxfiy file yaratsa: avval `umask 077`, keyin yozish. `touch` + `chmod 600` — **poyga holati**: ikki command orasida file boshqalarga ochiq turadi.

## 7. Maxsus bit'lar — SUID, SGID, sticky

9 bitdan tashqari yana 3 bit bor (to'rtinchi octal raqam):

| Bit | Octal | File'da | Papkada | Misol |
|---|---|---|---|---|
| **SUID** | 4000 | Dastur **owner** huquqi bilan ishlaydi | (ta'siri yo'q) | `/usr/bin/passwd` (`-rwsr-xr-x`) |
| **SGID** | 2000 | Dastur **group** huquqi bilan ishlaydi | Yangi file'lar papka group'ini meros oladi | Jamoaviy papka |
| **Sticky** | 1000 | (eskirgan) | Faqat file **egasi** o'chira oladi | `/tmp` (`drwxrwxrwt`) |

**SUID — qanday problem'ni hal qiladi:** oddiy user parolini o'zgartirishi kerak, lekin `/etc/shadow`'ga faqat root yozadi. `passwd` SUID root — u root huquqi bilan ishlaydi, lekin faqat **sizning** parolingizni o'zgartiradi.

> **Security:** SUID root dasturdagi har bug — root'ga yo'l (privilege escalation). Audit: `find / -xdev -perm -4000 -type f 2>/dev/null`. Ro'yxatda kutilmagan file bo'lsa — jiddiy signal. Script'larda (bash) SUID kernel tomonidan e'tiborsiz qoldiriladi — bu ataylab.

**SGID papka — jamoaviy ish pattern'i:**

```bash
sudo mkdir /srv/shared
sudo chgrp deploy /srv/shared
sudo chmod 2775 /srv/shared       # SGID + rwxrwxr-x
# endi har kim yaratgan file deploy group'iga tegishli bo'ladi
```

**Sticky — nega `/tmp`'da kerak:** `/tmp` hamma uchun `w` — demak har kim istalgan file'ni o'chira olardi (2-bo'lim). Sticky bit buni cheklaydi: faqat egasi (yoki root) o'chiradi.

## 8. Klassik model cheklovlari va ACL

9 bit modeli: bitta owner, **bitta** group. Problem: "`/srv/app/logs`'ni `deploy` group'i yozsin, `audit` group'i faqat o'qisin" — bitta group bilan ifodalab bo'lmaydi.

**Yechim — ACL (Access Control List):**

```bash
setfacl -m g:audit:rx /srv/app/logs            # qo'shimcha group'ga ruxsat
setfacl -d -m g:audit:rx /srv/app/logs         # default: yangi file'lar ham meros oladi
getfacl /srv/app/logs
ls -l   # ruxsat oxirida "+" belgisi: drwxrwx---+  -> ACL bor
```

**Trade-off:** ACL kuchli, lekin "yashirin" — `ls -l`'da faqat `+` ko'rinadi, ko'pchilik unga e'tibor bermaydi; backup/ko'chirish tool'lari ACL'ni saqlamasligi mumkin (`cp -a`, `rsync -A`, `tar --acls` kerak). **Qoida:** avval group'lar bilan hal qilishga urining; ACL — haqiqatan kerak bo'lganda.

Bundan ham yuqori qatlamlar (keyingi mavzular): capabilities (root'ning bo'laklari), SELinux/AppArmor (MAC — hatto root'ni cheklaydi), `chattr +i` (immutable file).

## 9. `Permission denied` — tizimli diagnostika

Tasodifiy `chmod` emas — algoritm:

```
 1. Kim?         id                         -> UID, group'lar (session yangimi?)
 2. Nima?        ls -l file                 -> owner, group, rwx
 3. Yo'l         namei -l /full/path/file   -> yo'ldagi HAR papkaning ruxsati
 4. Toifa        men owner'manmi? group'damanmi? -> qaysi 3 bit ishlatiladi
 5. Qo'shimcha   getfacl, lsattr, mount (noexec/ro), SELinux (ls -Z, ausearch)
 6. Minimal fix  aynan kerakli bit'ni, aynan kerakli toifaga
```

```bash
namei -l /srv/app/config/db.yml
# f: /srv/app/config/db.yml
# drwxr-xr-x root  root   /
# drwxr-xr-x root  root   srv
# drwx------ ali   ali    app       <- shu yerda: boshqalar x yo'q
# ...
```

| Symptom | Ehtimoliy root cause |
|---|---|
| `./script.sh: Permission denied` | `x` yo'q -> `chmod u+x` (yoki `bash script.sh`) |
| File `rwx`, lekin baribir denied | Yo'ldagi papkada `x` yo'q |
| `x` bor, baribir denied | Filesystem `noexec` bilan mount qilingan (`/tmp` ko'pincha) |
| Root ham o'zgartira olmaydi | `chattr +i` (`lsattr` bilan tekshiring) yoki read-only mount |
| Ruxsatlar to'g'ri, baribir denied | SELinux/AppArmor; yoki group'ga yangi qo'shilgan (qayta login) |
| Servis file'ni o'qiy olmaydi, siz o'qiysiz | Servis boshqa user nomidan ishlaydi: `ps -o user= -p <PID>` |

## 10. Production pattern'lari

```
 /etc/myapp/config.yml   root:myapp  640   <- servis o'qiydi, o'zgartira olmaydi
 /etc/myapp/secret.env   root:myapp  640   <- (yoki secret manager)
 /opt/myapp/bin/myapp    root:root   755   <- servis o'z binary'sini o'zgartira olmaydi
 /var/lib/myapp/         myapp:myapp 750   <- faqat servis yozadi
 ~/.ssh/                 user        700
 ~/.ssh/authorized_keys  user        600
```

**Asosiy tamoyil:** servis o'z **kodi va config'ini** o'zgartira olmasligi kerak — faqat data papkasiga yozadi. Shunda buzilgan servis o'zini "doimiy" qila olmaydi (backdoor yozolmaydi).

## Amaliy mashg'ulot

1. `secret.txt` yarating, faqat o'zingiz o'qiy oladigan qiling (`600`), `ali` nomidan o'qib ko'ring.
2. `hello.sh` script yozing, `x`siz ishga tushiring -> xato -> tuzating. `bash hello.sh` nega `x`siz ishlaydi?
3. Papkadan `x`'ni oling (`chmod 644 dir`) va `ls dir`, `cat dir/file`, `cd dir` natijalarini solishtiring.
4. Paradoks: `chmod 070 file` (owner'da hech narsa yo'q) — o'zingiz o'qiy olasizmi? Group'dagi boshqa user-chi?
5. O'chirish: `w` yo'q file'ni `w` bor papkada o'chiring.
6. `umask 077`, yangi file va papka yarating, ruxsatlarni tekshiring.
7. SGID jamoaviy papka yarating va `ali`, `vali` yaratgan file'lar group'ini tekshiring.
8. `namei -l` bilan ataylab buzilgan yo'lni diagnostika qiling.
9. Audit: `find / -xdev -perm -4000 -type f 2>/dev/null`.

## Uy vazifa

1. 10 ta `ls -l` qatorini o'qib, har birini octal'ga o'giring va "kim nima qila oladi" deb yozing.
2. `myapp` uchun papkalar va ruxsatlar jadvalini tuzing (binary, config, secret, data, log). Har biri uchun **nega** shunday ekanini tushuntiring.
3. "`chmod 777` qildim, ishladi" degan hamkasbingizga xabar yozing: nega bu xavfli va to'g'ri diagnostika qanday.

## Test savollari

1. `640` — group nima qila oladi? other-chi?
2. Papkaga `x` va `r` nima beradi? Faqat `x` bo'lsa-chi?
3. File'ni o'chirish uchun qayerda `w` kerak?
4. Kernel tekshiruv tartibi qanday? Owner o'z file'ini o'qiy olmasligi mumkinmi?
5. Nega `chmod 777` yomon "tuzatish"?
6. `umask 027` bo'lsa yangi file va papka qanday ruxsat oladi?
7. SUID qaysi problem'ni hal qiladi va qanday xavf tug'diradi?
8. Nega `/tmp`'da sticky bit bor?
9. Qachon ACL kerak va uning trade-off'i nima?
10. `x` bit bor, lekin script ishlamayapti — 2 ta mumkin bo'lgan sabab?

## Common mistakes

- `chmod -R 777` bilan "tuzatish".
- `chmod -R 755` — barcha file'larni executable qilish.
- Yo'ldagi papkalar ruxsatini tekshirmaslik.
- `touch` + `chmod 600` o'rniga `umask` ishlatmaslik (poyga holati).
- Servisga o'z config va binary'sini yozish huquqini berish.
- ACL `+` belgisini e'tiborsiz qoldirish.

## Senior xulosa

- 9 bit = `rwx` x `owner/group/other`. Kernel **birinchi mos toifani** ishlatadi.
- Papkada `w` — file yaratish/o'chirish, `x` — ichiga kirish. Yo'ldagi har papka muhim.
- Default ruxsatni `umask` belgilaydi; maxfiy file'ni yaratishda umask, keyin chmod emas.
- SUID/SGID/sticky — aniq problem'lar uchun aniq vosita; SUID — audit qilinadigan xavf.
- `Permission denied` — algoritm bilan: `id`, `ls -l`, `namei -l`, mount, ACL, SELinux. `777` — hech qachon javob emas.
- Least privilege: servis faqat o'z data'siga yozadi, kodi va config'ini o'qiydi xolos.
