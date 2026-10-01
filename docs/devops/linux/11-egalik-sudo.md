# Dars 11 — Egalik va sudo

> **Natija:** fayl egasini o'zgartirish, `sudo`'ni to'g'ri ishlatish va sozlash, eng kam huquq tamoyili tamoyilini amalda qo'llash. Nega faqat root `chown` qila oladi, `sudo` ichkarida qanday ishlaydi, sudoers'dagi "yashirin root" teshiklari, audit va zamonaviy alternativalar.

## 1. Fayl egasi

Har inode'da ikkita identity: **owner (UID)** va **group (GID)**. 10-darsdagi ruxsatlar shu ikkisiga nisbatan tekshiriladi.

```
-rw-r----- 1 ali deploy 120 Oct 1 report.txt
              |   +-- group
              +------ owner
```

Yangi fayl **yaratgan process'ning** effective UID'iga va (odatda) primary group'iga tegishli bo'ladi. Istisno: SGID papka ichida — papka group'i (10-dars).

> **Production'dagi nozik jihat:** faylni kim yaratganini ko'pincha "siz" emas, **servis** hal qiladi. `sudo` bilan yaratilgan fayl root'niki bo'ladi va keyin servis uni o'qiy/yoza olmaydi — juda ko'p uchraydigan `Permission denied` sababi.

## 2. chown / chgrp

```bash
sudo chown vali report.txt            # owner
sudo chown vali:deploy report.txt     # owner + group
sudo chown :deploy report.txt         # faqat group
sudo chgrp deploy report.txt          # faqat group
sudo chown -R www-data:www-data /var/www/site
sudo chown --reference=a.txt b.txt    # boshqa file'dagidek
```

### Nega faylni boshqa user'ga faqat root o'tkaza oladi?

Agar oddiy user o'z faylini boshqasiga bera olsa:
1. **Disk quota'ni chetlab o'tish** — katta faylni boshqa user'ga "sovg'a" qilish va uning kvotasini to'ldirish.
2. **Ayblash** — zararli faylni boshqa user nomiga o'tkazish.
3. **SUID hujumi** — tarixda: SUID faylni root'ga berish = root dastur.

Shuning uchun Linux'da `chown` (owner o'zgarishi) — faqat root (aniqrog'i `CAP_CHOWN` capability). Oddiy user faqat **o'z faylining group'ini** o'zi a'zo bo'lgan group'ga o'zgartira oladi.

> **Tuzoq:** `chown` SUID/SGID bit'larini **o'chiradi** — xavfsizlik uchun. Binary'ni deploy qilib, keyin `chown` qilsangiz, maxsus bit'larni qayta qo'yishingiz kerak bo'lishi mumkin.

> **Ehtiyot:** `chown -R` symlink'lar bo'ylab yurmaydi (default `-P`), lekin noto'g'ri path'da (`chown -R app: / var/www` — probel!) butun tizim egaligini buzadi. Har doim path'ni qo'shtirnoq ichida va avval `ls -ld` bilan tekshiring.

## 3. sudo qanday ishlaydi

```
 student: sudo systemctl restart nginx
   |
   v
 /usr/bin/sudo  (SUID root -> root huquqi bilan ishga tushadi)
   |
   +-- 1. Kim chaqirdi? (real UID = student)
   +-- 2. /etc/sudoers + /etc/sudoers.d/* -> student'ga bu command ruxsatmi?
   +-- 3. Autentifikatsiya: STUDENT'ning paroli (PAM orqali); ~15 daqiqa cache
   +-- 4. Muhitni tozalash (env_reset, secure_path)
   +-- 5. Log: /var/log/auth.log (yoki journal), kim / qachon / qayerda / nima
   v
 systemctl restart nginx   <- UID 0 sifatida
```

**Nega root paroli emas, o'z parolingiz:** har odam alohida autentifikatsiya qilinadi va log'da **aniq ism** qoladi. Xodim ketganda — faqat uning account'i yopiladi, root paroli almashtirilmaydi.

```bash
sudo apt update
sudo -l                    # menga nima ruxsat berilgan?
sudo -u postgres psql      # boshqa user nomidan (root emas!)
sudo -i                    # root login shell (ehtiyot)
sudo -s                    # root shell, joriy muhit bilan
sudo -k                    # parol cache'ini tozalash
sudoedit /etc/hosts        # file'ni xavfsiz tahrirlash (pastda)
```

Kim sudo qila oladi: Ubuntu'da `sudo` group'i, RHEL'da `wheel`.

```bash
sudo usermod -aG sudo ali
sudo visudo                               # asosiy file
sudo visudo -f /etc/sudoers.d/deploy      # drop-in
```

### Nega sudoers'ni faqat `visudo` bilan tahrirlash kerak

`visudo` faylni lock qiladi, vaqtinchalik nusxada tahrirlaydi va **saqlashdan oldin sintaksisni tekshiradi**. `/etc/sudoers`'ni `nano` bilan buzsangiz — `sudo` butunlay ishlamaydi va root paroli yo'q server'da (Ubuntu default) tuzatish uchun recovery mode yoki konsol kerak bo'ladi.

## 4. sudoers qoidalarini yozish — xavfli va to'g'ri usul

Sintaksis: `KIM  QAYERDA=(KIM_SIFATIDA)  COMMAND'LAR`

```text
# Naive: hamma narsa, parolsiz
deploy ALL=(ALL) NOPASSWD: ALL

# Better: faqat kerakli command, to'liq path bilan
deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart myapp, /usr/bin/systemctl reload nginx

# Group uchun
%ops   ALL=(ALL) ALL
```

### Bilmasdan to'liq root berib qo'yish holatlari

Ko'p buyruqlar **shell ochish yoki fayl yozish** imkonini beradi. Ularga sudo berish = to'liq root berish:

| sudoers'da ruxsat | Root'ga yo'l |
|---|---|
| `vim`, `less`, `more`, `man` | Ichidan `:!bash` yoki `!sh` |
| `find` | `find . -exec /bin/sh \;` |
| `tar`, `zip`, `rsync` | Checkpoint / `-e` opsiyalari bilan buyruq bajarish |
| `cp`, `tee`, `dd` | `/etc/sudoers` yoki `/etc/shadow`'ni ustidan yozish |
| `chmod`, `chown` | `/etc/shadow`'ni ochish |
| `systemctl` (argumentsiz) | Zararli unit yaratib ishga tushirish; `systemctl edit` |
| `python`, `perl`, `node` | `python -c 'import os; os.system("sh")'` |
| `docker` | `docker run -v /:/host ...` |
| Script, agar user uni tahrirlay olsa | Script'ni o'zgartirish |
| Wildcard: `/usr/bin/systemctl restart *` | `restart foo --some-flag` kabi kutilmagan argumentlar |

(Bunday hujumlar katalogi: GTFOBins.)

**Qoidalar:**
- Buyruqni **to'liq path va aniq argumentlar** bilan yozing.
- Wildcard'lardan qoching.
- Ruxsat berilgan script'ni **root egaligida** va user yozolmaydigan joyda saqlang.
- Fayl tahrirlash kerak bo'lsa — `sudoedit` (pastda), editor'ning o'ziga sudo emas.

### `sudoedit` — nega xavfsizroq

`sudo vim /etc/hosts` — vim root sifatida ishlaydi, ichidan shell ochish mumkin. `sudoedit /etc/hosts` — fayl nusxasini **sizning** huquqingiz bilan ochadi, saqlaganda root uni joyiga ko'chiradi. Editor hech qachon root bo'lmaydi.

```text
%webadmins ALL=(root) sudoedit /etc/nginx/sites-available/*
```

### Parolsiz sudo (`NOPASSWD`) qachon to'g'ri

| Holat | NOPASSWD? |
|---|---|
| CI/CD runner, avtomatlashtirish account (parolni kim kiritadi?) | Ha — lekin **aniq buyruqlar** bilan |
| Odam, interaktiv ish | Yo'q — parol "ikkinchi o'ylash" lahzasi va o'g'irlangan session'dan himoya |

## 5. Ko'p uchraydigan tuzoqlar

### `sudo echo ... > /etc/file` ishlamaydi

```bash
sudo echo "1" > /proc/sys/net/ipv4/ip_forward
# bash: /proc/sys/...: Permission denied
```

**Asl sabab:** redirect'ni (`>`) **sizning** shell'ingiz ochadi — sudo'dan oldin. `sudo` faqat `echo`'ga qo'llanadi.

```bash
echo "1" | sudo tee /proc/sys/net/ipv4/ip_forward >/dev/null   # tee root sifatida yozadi
echo "line" | sudo tee -a /etc/file                              # qo'shib yozish
sudo sh -c 'echo 1 > /proc/sys/net/ipv4/ip_forward'              # alternativa
```

### `sudo` va PATH / env

`sudo` muhitni tozalaydi (`env_reset`) va `secure_path` ishlatadi. Natija: `~/bin/mytool` oddiy shell'da ishlaydi, `sudo mytool` — `command not found`. Bu **xato emas, himoya**: aks holda hujumchi `PATH`'ga zararli `ls` qo'yib, sizning sudo'ingiz bilan ishga tushirardi. Yechim: to'liq path.

### `sudo` bilan yaratilgan fayllar

```bash
sudo git clone ... /opt/app      # hamma file root'niki
# keyin: app user'i yozolmaydi, dasturchi git pull qilolmaydi
```

To'g'ri: `sudo -u app git clone ...` yoki papka egasini oldindan to'g'ri qilish.

## 6. Audit — kim nima qildi?

```bash
sudo grep sudo /var/log/auth.log | tail             # Ubuntu
sudo journalctl _COMM=sudo --since today
last -n 20                                          # login'lar
```

Log'da: `student : TTY=pts/0 ; PWD=/home/student ; USER=root ; COMMAND=/usr/bin/systemctl restart nginx`.

**Cheklov:** `sudo -i` yoki `sudo bash` dan keyingi buyruqlar **alohida** log'ga tushmaydi — faqat "bash ochildi" yoziladi. Shuning uchun root shell'larni cheklash va kerak bo'lsa session recording (`sudo` I/O log, `auditd`, Teleport) ishlatish.

> **Chuqurroq qarash:** server'dagi log'ni root o'chirib yuborishi mumkin. Haqiqiy audit uchun log'lar **darhol markaziy joyga** (SIEM, log server) yuboriladi — hujumchi u yerga yeta olmaydi.

## 7. Eng kam huquq tamoyili — huquq darajalari

```
 Eng ko'p kuch                                           Eng kam kuch
 root shell  >  sudo ALL  >  sudo aniq command  >  capability  >  oddiy user
```

| Tamoyil | Amalda |
|---|---|
| Eng kam huquq tamoyili | Har kimga va har servisga — faqat kerakli minimum |
| root bilan ishlamaslik | Har amal uchun `sudo`, root shell — favqulodda |
| Servis o'z user'ida | `www-data`, `postgres`, `myapp` (9-dars) |
| Root o'rniga capability | Port 80 uchun root emas: `AmbientCapabilities=CAP_NET_BIND_SERVICE` (systemd) |
| Vaqtinchalik kirish | Doimiy sudo o'rniga — so'rov bo'yicha, muddatli (Teleport, Vault, AWS SSM) |
| Audit | Log'lar markazlashtirilgan |

### Eng yaxshi yechim: server'ga umuman kirmaslik

Eng yaxshi sudo — **ishlatilmaydigan** sudo. Agar o'zgarishlar CI/CD va IaC orqali bo'lsa, odamlarga prod'da sudo kerak emas. Kirish faqat incident uchun ("break-glass"), qisqa muddatli va to'liq yozib olinadi.

## 8. Nima buzilishi mumkin

| Belgi | Asl sabab | Yechim |
|---|---|---|
| `user is not in the sudoers file` | Group'da emas yoki session eski | `usermod -aG sudo`, qayta login |
| `sudo` umuman ishlamaydi, `parse error` | sudoers buzilgan | Recovery mode / `pkexec visudo` / konsol |
| `sudo echo > file` denied | Redirect sudo'dan tashqarida | `tee` |
| `sudo: mytool: command not found` | `secure_path` | To'liq path |
| Servis faylni o'qiy olmaydi | Fayl `sudo` bilan yaratilgan, root'niki | `chown`, keyingi safar to'g'ri user bilan yaratish |
| `sudo` sekin (bir necha soniya) | Hostname resolve bo'lmayapti | `/etc/hosts`'ga hostname qo'shish |

## Amaliy mashg'ulot

1. `/srv/project` yarating. Egasi `root:deploy`, ruxsat `2775` (SGID bilan).
2. `ali` (deploy'da) fayl yaratsin — ishlaydi va group `deploy`; `student` (deploy'da emas) — `Permission denied`.
3. `ali`'ga faqat `systemctl restart nginx` uchun sudo bering (`visudo -f /etc/sudoers.d/ali`). `sudo -l` bilan tekshiring; `sudo systemctl stop nginx` rad etilishini ko'ring.
4. "Yashirin root": vaqtincha `ali ALL=(root) /usr/bin/less` bering va `sudo less /etc/hosts` ichidan `!id` qiling — natija? Keyin qoidani o'chiring.
5. `sudo echo test > /root/x` xatosini ko'ring va `tee` bilan tuzating.
6. `auth.log`'dan bugungi sudo yozuvlarini toping.

## Uy vazifa

1. CI/CD runner uchun sudoers qoidasini yozing: faqat `myapp`'ni restart qilish va `/opt/myapp/releases/` ichiga yangi release'ni joylashtirish. Har bir "teshik"ni qanday yopganingizni tushuntiring.
2. Nega `NOPASSWD: /usr/bin/vim` amalda `NOPASSWD: ALL` bilan teng?
3. Port 80'da ishlaydigan Go servis uchun root'siz yechimni yozing (systemd capability).

## Test savollari

1. `chown :deploy file` nima qiladi?
2. Nega oddiy user o'z faylini boshqasiga bera olmaydi?
3. `sudo` qaysi parolni so'raydi va nega?
4. Nega `sudo -i` bilan doim ishlash yomon (2 ta sabab)?
5. `/etc/sudoers` qanday tahrirlanadi va nega?
6. `sudo echo 1 > /etc/x` nega ishlamaydi?
7. `find`, `vim` yoki `python`'ga sudo berishning xavfi?
8. `sudoedit` `sudo vim`'dan nimasi bilan xavfsizroq?
9. Port 80 uchun root o'rniga nima ishlatish mumkin?

## Ko'p uchraydigan xatolar

- `NOPASSWD: ALL` "qulaylik uchun".
- Editor, interpreter yoki `find`'ga sudo berish.
- sudoers'ni `visudo`'siz tahrirlash.
- `sudo` bilan app papkasida ishlash va keyin `Permission denied` bilan kurashish.
- Audit log'larini faqat server'ning o'zida saqlash.
- Servisni root sifatida faqat "port 80 kerak" deb ishga tushirish.

## Xulosa

- Egalik — kimniki, ruxsat — nima qila oladi, sudo — vaqtincha, aniq va iz qoldiradigan kuch.
- `chown` faqat root'da — quota, ayblash va SUID hujumlaridan himoya.
- sudo qoidasi = aniq buyruq + aniq argument + to'liq path. Shell ochadigan har vosita — yashirin root.
- `sudo` muhitni tozalaydi va redirect'ga ta'sir qilmaydi: `tee`, to'liq path.
- Root o'rniga capability, doimiy sudo o'rniga vaqtinchalik kirish, server'dagi log o'rniga markaziy audit.
