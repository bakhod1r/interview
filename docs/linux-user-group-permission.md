# Linux: User, Group, Permission (Senior level)

> Asosiy g'oya: **jarayon** (process) **faylga** kirmoqchi. Kernel jarayonning kimligini (UID, GID, guruhlar, capabilities, MAC label) faylning egasi va huquqlari bilan solishtiradi.

```
+-------------------------+          +-------------------------+
| JARAYON (process)       |          | FAYL (inode)            |
|                         |  open()  |                         |
|  euid = 1001 (ali)      | -------> |  owner = 1001 (ali)     |
|  egid = 1001 (ali)      |          |  group = 2000 (devs)    |
|  groups = 27, 2000      |          |  mode  = rwx r-x ---    |
|  caps = (bo'sh)         |          |  ACL, xattr, label      |
+-------------------------+          +-------------------------+
              \                                   /
               \                                 /
                +------> KERNEL tekshiradi <----+
                         natija: ruxsat / EACCES
```

---

## 1. User

Kernel uchun user bu **raqam** (UID). Ism faqat odam uchun: `/etc/passwd` yoki LDAP orqali UID ga aylantiriladi.

| Turi        | UID         | Misol                              |
|-------------|-------------|------------------------------------|
| root        | 0           | barcha DAC tekshiruvlardan o'tadi  |
| system user | 1 - 999     | nginx, postgres, sshd              |
| oddiy user  | 1000+       | ali, vali                          |
| nobody      | 65534       | NFS squash, huquqsiz servislar     |

`/etc/passwd` qatori:

```
ali:x:1001:1001:Ali Valiyev:/home/ali:/bin/bash
 |  |  |    |       |           |         |
 |  |  |    |       |           |         +-- login shell
 |  |  |    |       |           +------------ home papka
 |  |  |    |       +------------------------ izoh (GECOS)
 |  |  |    +-------------------------------- primary GID
 |  |  +------------------------------------- UID
 |  +---------------------------------------- parol bu yerda emas: /etc/shadow
 +------------------------------------------- login nomi
```

```sh
id ali
sudo useradd -m -s /bin/bash ali
sudo useradd -r -s /usr/sbin/nologin myapp   # system user: login yo'q
sudo passwd ali
sudo userdel -r ali
```

**Senior nuqtalar**
- Kernel ismni bilmaydi. UID 0 bo'lgan har qanday nom (`toor`) = root. Audit: `awk -F: '$3==0' /etc/passwd`.
- `/etc/shadow` dagi hash formati: `$6$` SHA-512, `$y$` yescrypt (zamonaviy default). `!` yoki `*` = parol bilan kirib bo'lmaydi (lekin SSH key bilan kirish mumkin).
- Servis user'larga shell `/usr/sbin/nologin`, home yo'q yoki read-only.
- User o'chirilsa fayllari eski UID bilan qoladi. Shu UID keyin yangi user'ga berilsa, u **eski fayllarni meros oladi**. Tozalash: `find / -nouser`.
- Ko'p serverli muhitda UID hamma joyda bir xil bo'lishi shart (NFS, backup, konteyner volume). Yechim: LDAP / FreeIPA / AD + SSSD.

---

## 2. Group

Group: bir nechta userga birdaniga huquq berish.

```
+--------------- group: devs (GID 2000) ---------------+
|                                                      |
|     ali (1001)      vali (1002)      sardor (1003)   |
|                                                      |
+--------------------------+---------------------------+
                           |
                           | group huquqi: rwx
                           v
                    /srv/project
```

| Tur                  | Soni | Vazifasi                                         |
|----------------------|------|--------------------------------------------------|
| primary group        | 1    | yangi fayl shu guruhga tegishli bo'ladi          |
| supplementary groups | 0..N | qo'shimcha a'zolik: `sudo`, `docker`, `devs`     |

```sh
sudo groupadd devs
sudo usermod -aG devs ali     # -a bo'lmasa boshqa barcha guruhlardan chiqaradi
getent group devs
newgrp devs                   # yoki qayta login
```

**Senior nuqtalar**
- Guruhlar ro'yxati jarayonga **login paytida** yoziladi va bolalariga meros o'tadi. Ishlab turgan jarayon (tmux, systemd servis, IDE) yangi guruhni ko'rmaydi: qayta login yoki servis restart kerak.
- Ba'zi guruhlar amalda root'ga teng: `docker`, `lxd`, `disk` (blok qurilmani to'g'ridan-to'g'ri o'qiydi), `shadow`. Ularga qo'shish = privilegiya berish.
- `wheel` / `sudo` guruhi: sudoers orqali admin. Guruhning o'zi hech narsa bermaydi, kuchni `/etc/sudoers` beradi.
- Per-user private group (UPG): har user'ning o'z nomidagi guruhi bor, shuning uchun `umask 002` xavfsiz va jamoaviy papkalar qulay.

---

## 3. Permission: rwx

### `ls -l` ni o'qish

```
-rwxr-x---  1  ali  devs  4096  Oct 1  deploy.sh
|\_/\_/\_/      |    |
| |  |  |       |    +-- group egasi
| |  |  |       +------- owner
| |  |  +--------------- others: ---
| |  +------------------ group : r-x
| +--------------------- owner : rwx
+----------------------- tur: - fayl, d papka, l symlink, s socket, p pipe, c/b qurilma
```

### Fayl va papkada ma'nosi farq qiladi

| Bit | Faylda              | Papkada                                       |
|-----|---------------------|-----------------------------------------------|
| r   | ichini o'qish       | ichidagi nomlarni ro'yxatlash (`ls`)          |
| w   | ichini o'zgartirish | ichida fayl yaratish, o'chirish, nomlash      |
| x   | ishga tushirish     | ichiga kirish, nom orqali inode'ga yetish     |

### Octal

```
r = 4    w = 2    x = 1

chmod 750 deploy.sh
       |||
       ||+-- others: 0 = ---
       |+--- group : 5 = r-x   (4+1)
       +---- owner : 7 = rwx   (4+2+1)
```

| Octal | Ko'rinish   | Qayerda                        |
|-------|-------------|--------------------------------|
| 644   | rw-r--r--   | oddiy fayl                     |
| 755   | rwxr-xr-x   | script, papka                  |
| 640   | rw-r-----   | config (servis guruhi o'qiydi) |
| 600   | rw-------   | ssh key, .env, secret          |
| 700   | rwx------   | ~/.ssh                         |

```sh
chmod 640 app.conf
chmod u+x,g-w,o= run.sh
chmod -R u=rwX,g=rX,o= /srv/app     # X: faqat papka va executable'ga x
chown ali:devs app.conf
```

**Senior nuqtalar**
- Faylni o'chirish = papkadan nomni olib tashlash. Shuning uchun faylning emas, **papkaning `w` + `x`** huquqi kerak.
- Yo'ldagi **har bir** papkada `x` kerak: `/srv/app/conf/a.txt` ni o'qish uchun `/`, `/srv`, `/srv/app`, `/srv/app/conf` hammasida `x`.
- Papkada `r` bor, `x` yo'q: nomlar ko'rinadi, lekin fayllarni ochib bo'lmaydi. `x` bor, `r` yo'q: nomni bilsang ochasan, ro'yxat ko'rinmaydi.
- Script ishga tushishi uchun `x` + `r` kerak (interpreter uni o'qiydi). Binary uchun faqat `x` yetarli.
- Huquq `open()` paytida tekshiriladi. Keyin `chmod 000` qilish ochiq file descriptor'ni yopmaydi.
- `chmod -R 755` hamma faylni executable qiladi. To'g'risi: katta `X` yoki `find -type d` / `find -type f` bilan alohida.

---

## 4. Kernel qanday tekshiradi

Kernel **birinchi mos kelgan** toifani oladi va to'xtaydi. Toifalar qo'shilmaydi.

```
          jarayon faylga kirmoqchi
                     |
                     v
          +---------------------+   ha
          | CAP_DAC_OVERRIDE ?  | ------> ruxsat (root odatda shunday)
          +----------+----------+
                     | yo'q
                     v
          +---------------------+   ha
          | euid == owner ?     | ------> faqat OWNER bitlari  -> tamom
          +----------+----------+
                     | yo'q
                     v
          +---------------------+   ha
          | ACL named user ?    | ------> ACL yozuvi AND mask  -> tamom
          +----------+----------+
                     | yo'q
                     v
          +---------------------+   ha
          | guruhlarimdan biri  | ------> GROUP bitlari        -> tamom
          | == file group ?     |         (ACL bo'lsa AND mask)
          +----------+----------+
                     | yo'q
                     v
              faqat OTHERS bitlari
                     |
                     v
          keyin: MAC (SELinux / AppArmor) ham ruxsat berishi kerak
```

**Senior nuqtalar**
- `----rwx---` faylida owner hech narsa qila olmaydi, garchi guruhda bo'lsa ham.
- Root uchun ham `x`: root faylni faqat **kamida bitta** `x` biti bo'lsa ishga tushira oladi.
- DAC dan o'tish yetarli emas: mount opsiyalari (`ro`, `noexec`, `nosuid`, `nodev`), `chattr` atributlari va MAC ham tekshiriladi.

---

## 5. Maxsus bitlar: SUID, SGID, Sticky

| Bit    | Octal | Faylda                          | Papkada                                     |
|--------|-------|---------------------------------|---------------------------------------------|
| SUID   | 4000  | fayl **egasi** nomidan ishlaydi | (ta'siri yo'q)                              |
| SGID   | 2000  | fayl **guruhi** nomidan ishlaydi| yangi fayllar papka guruhini meros oladi    |
| Sticky | 1000  | (ta'siri yo'q)                  | faqat o'z faylingni o'chira olasan          |

```
-rwsr-xr-x  root root  /usr/bin/passwd    s = SUID + x
                                          S = SUID, lekin x yo'q (odatda xato)
drwxrwsr-x  root devs  /srv/project       s group joyida = SGID
drwxrwxrwt  root root  /tmp               t = sticky
```

```sh
chmod 4755 /usr/local/bin/tool
chmod 2775 /srv/project
chmod 1777 /shared
find / -perm -4000 -type f 2>/dev/null    # barcha SUID binary'lar
```

**Senior nuqtalar**
- Har bir SUID-root binary = potensial privilege escalation. Iloji bo'lsa capabilities bilan almashtir (zamonaviy distrolarda `ping` SUID emas, `cap_net_raw`).
- Kernel shebang script'lardagi SUID ni e'tiborsiz qoldiradi (race va `IFS` / `PATH` hujumlari sababli).
- SUID binary'da ld.so "secure mode" ga o'tadi: `LD_PRELOAD`, `LD_LIBRARY_PATH` e'tiborga olinmaydi.
- Fayl yozilsa (`write`) kernel SUID/SGID bitni avtomatik o'chiradi.
- `/home`, `/tmp`, USB, NFS uchun `nosuid` mount: SUID bitlar ishlamaydi.

---

## 6. umask

Yangi fayl huquqi = bazaviy huquq minus umask bitlari.

```
                  fayl         papka
bazaviy:          666          777
umask:          - 022        - 022
                -----        -----
natija:           644          755
```

| umask | fayl | papka | Qachon                               |
|-------|------|-------|--------------------------------------|
| 022   | 644  | 755   | default                              |
| 002   | 664  | 775   | UPG + jamoaviy papka                 |
| 027   | 640  | 750   | server, servislar                    |
| 077   | 600  | 700   | secret yaratadigan jarayon           |

**Senior nuqtalar**
- Aslida ayirish emas, bit-mask: `mode & ~umask`. `666 - 033` = 633 emas, 644.
- umask jarayon xususiyati, meros o'tadi. systemd servisda `UMask=0027`; shell'dagi umask servisga ta'sir qilmaydi.
- Ilova `open(path, O_CREAT, 0600)` deb aniq mode bersa, umask faqat undan yana bit olib tashlaydi.
- Default ACL bo'lgan papkada umask emas, default ACL ishlaydi.

---

## 7. Jarayonning kimligi: real, effective, saved UID

| UID turi      | Ma'nosi                                           |
|---------------|---------------------------------------------------|
| real UID      | kim ishga tushirdi                                |
| effective UID | kernel huquqni **shu** bo'yicha tekshiradi        |
| saved UID     | tashlangan privilegiyani qaytarib olish uchun     |
| fs UID        | fayl tekshiruvi uchun (Linux, odatda = effective) |

```
ali "passwd" ni ishga tushiradi (SUID root)

    real UID      = 1001  (ali)
    effective UID = 0     (root)   -> /etc/shadow ga yoza oladi
    saved UID     = 0
```

```sh
ps -eo pid,ruid,euid,suid,cmd | head
grep -E 'Uid|Gid|Groups' /proc/self/status
```

**Senior nuqtalar**
- Root'da start bo'lib keyin oddiy user'ga o'tadigan daemon (nginx, sshd) privilegiyani **qaytarib bo'lmas** tarzda tashlaydi. Tartib muhim:

```
1. setgroups([])    supplementary guruhlarni tozalash
2. setgid(app_gid)
3. setuid(app_uid)  real, effective, saved: hammasi app_uid
```

- Teskari tartib xato: `setuid` dan keyin guruhni o'zgartirib bo'lmaydi, jarayon root guruhlarida qolib ketadi.
- `seteuid` faqat vaqtincha almashtiradi: saved UID 0 qoladi, hujumchi uni qaytarib olishi mumkin.

---

## 8. Capabilities

Root = hammasi yoki hech narsa. Capabilities root kuchini ~40 ta alohida huquqqa bo'ladi.

| Capability             | Nima beradi                                        |
|------------------------|----------------------------------------------------|
| CAP_NET_BIND_SERVICE   | 1024 dan past portga bind                          |
| CAP_NET_RAW            | raw socket (ping)                                  |
| CAP_CHOWN              | istalgan faylning egasini o'zgartirish             |
| CAP_DAC_OVERRIDE       | rwx tekshiruvini chetlab o'tish                    |
| CAP_SYS_PTRACE         | boshqa jarayonlarga ulanish                        |
| CAP_SYS_ADMIN          | juda keng (mount, namespace...): amalda yangi root |

```sh
sudo setcap cap_net_bind_service=+ep /usr/local/bin/myapp
getcap /usr/local/bin/myapp
grep Cap /proc/self/status
capsh --decode=00000000a80425fb
```

systemd:

```ini
[Service]
User=myapp
AmbientCapabilities=CAP_NET_BIND_SERVICE
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
NoNewPrivileges=yes
```

**Senior nuqtalar**
- To'plamlar: permitted, effective, inheritable, bounding, ambient. Bounding set = jarayon hech qachon oshib o'ta olmaydigan chegara.
- `NoNewPrivileges` (`no_new_privs`): SUID va file caps endi jarayonga huquq qo'sha olmaydi. Konteynerlarda standart.
- Faylga caps qo'yilgan binary'ni nusxalash caps'ni yo'qotadi (xattr ko'chmaydi, `cp --preserve=xattr` kerak).

---

## 9. sudo

```
ali  --- sudo cmd --->  /etc/sudoers tekshiriladi  --->  cmd root nomidan ishlaydi
                        (+ /etc/sudoers.d/*)              log: /var/log/auth.log
                                                          yoki journald
```

```sh
sudo visudo                              # sintaksisni tekshirib saqlaydi
sudo visudo -f /etc/sudoers.d/deploy
sudo -l -U ali                           # ali nimaga ruxsatli
```

```
# /etc/sudoers.d/deploy
%deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart myapp
Defaults:%deploy !env_reset              # XATO: buni qilmang
```

**Senior nuqtalar**
- Shell ochadigan buyruqqa sudo = to'liq root: `vim`, `less`, `find -exec`, `tar`, `awk`, `git`, `python`. Ro'yxat: GTFOBins.
- Wildcard xavfli: `systemctl restart *` yoki `/bin/cat /var/log/*` (path traversal: `/var/log/../../etc/shadow`).
- Fayl tahrirlash uchun `sudoedit`: muharrir user nomidan ishlaydi, faqat nusxa root'da saqlanadi.
- `env_reset` va `secure_path` o'chirilmasin: aks holda `PATH` / `LD_PRELOAD` orqali escalation.
- Production: shaxsiy hisob + sudo + audit, umumiy root parol yo'q. Yaxshirog'i: vaqtinchalik (just-in-time) access.

---

## 10. ACL

3 ta toifa yetmaganda: "sardorga ham faqat o'qish ber".

```sh
setfacl -m u:sardor:r report.txt
setfacl -d -m g:devs:rwX /srv/project    # default ACL: yangi fayllarga meros
getfacl report.txt
setfacl -b report.txt                    # barcha ACL ni olib tashlash
```

```
$ getfacl report.txt
user::rw-
user:sardor:rwx        #effective:r--     <- mask kesdi
group::r--
mask::r--                                 <- named user va group uchun yuqori chegara
other::---

$ ls -l report.txt
-rw-r-----+  ali  devs  report.txt        <- "+" = ACL bor
    ^^^
    bu yerda group emas, MASK ko'rinadi
```

**Senior nuqtalar**
- ACL bor faylda `chmod g-w` mask'ni o'zgartiradi va barcha named ACL yozuvlarini kesadi.
- `cp` ACL ni ko'chirmaydi (`cp -a` ko'chiradi). Ba'zi backup / rsync sozlamalari ham (`rsync -A` kerak).
- Fayl tizimi qo'llashi kerak (ext4, xfs: ha). NFSv4 o'z ACL modeliga ega (`nfs4_setfacl`).
- Ko'p ACL = audit qilish qiyin. Avval guruhlar bilan hal qil, ACL istisno uchun.

---

## 11. Fayl atributlari va mount opsiyalari

```sh
sudo chattr +i /etc/resolv.conf     # immutable: root ham o'zgartira olmaydi
sudo chattr +a /var/log/app.log     # append-only
lsattr /etc/resolv.conf
```

| Mount opsiya | Ta'siri                                    |
|--------------|--------------------------------------------|
| ro           | faqat o'qish                               |
| noexec       | binary ishga tushmaydi                     |
| nosuid       | SUID / SGID / file caps ishlamaydi         |
| nodev        | qurilma fayllari ishlamaydi                |

**Senior nuqtalar**
- "Root bo'lib ham fayl o'chmayapti": `lsattr`. Hujumchilar persistence uchun `+i` qo'yishi mumkin.
- `/tmp`, `/dev/shm`, `/home` uchun `nosuid,nodev` (va iloji bo'lsa `noexec`): CIS benchmark talabi.
- `noexec` ni chetlab o'tish mumkin (`bash script.sh`, `ld.so ./bin`), u to'liq himoya emas.

---

## 12. DAC va MAC: SELinux / AppArmor

```
so'rov --> DAC (rwx, owner, ACL, caps) --> MAC (SELinux / AppArmor) --> ruxsat
               |                               |
               v                               v
             EACCES                          EACCES  (root uchun ham)
```

| Model | Kim hal qiladi     | Root chetlab o'tadimi |
|-------|--------------------|-----------------------|
| DAC   | fayl egasi (chmod) | ha                    |
| MAC   | markaziy policy    | yo'q                  |

```sh
ls -Z /var/www/html                 # SELinux label
ausearch -m avc -ts recent          # rad etilgan so'rovlar
restorecon -Rv /var/www/html        # to'g'ri label qaytarish
aa-status                           # AppArmor profillari
```

**Senior nuqtalar**
- Klassik holat: `chmod 777` qilindi, baribir `Permission denied`. Sabab ko'pincha label (masalan fayl `mv` qilinganda eski label saqlanadi, `cp` da yangisi olinadi).
- Yechim `setenforce 0` emas: `restorecon`, `semanage fcontext`, kerak bo'lsa `audit2allow` bilan aniq policy.
- AppArmor yo'l (path) asosida, SELinux label (inode) asosida ishlaydi.

---

## 13. User namespaces va konteynerlar

```
konteyner ichida                 host'da
-----------------                -------------------------
UID 0     (root)   --- map --->  UID 100000 (huquqsiz)
UID 1000           --- map --->  UID 101000
```

```sh
cat /etc/subuid                  # ali:100000:65536
cat /proc/<pid>/uid_map          # 0 100000 65536
```

**Senior nuqtalar**
- userns'siz konteynerdagi root = host'dagi UID 0. Uni faqat caps, seccomp va MAC cheklaydi. Qochib chiqsa, host'da root.
- Rootless Docker / Podman: konteyner root'i host'da oddiy user.
- Volume'dagi fayllar host'da `100999` kabi UID bilan ko'rinadi. Yechim: Podman `--userns=keep-id`, `:U` volume flag yoki to'g'ri `chown`.
- Kubernetes `securityContext`:

```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 10001
  fsGroup: 10001                 # volume fayllariga shu guruh beriladi
  allowPrivilegeEscalation: false   # no_new_privs
  readOnlyRootFilesystem: true
  capabilities:
    drop: ["ALL"]
```

---

## 14. Identity qayerdan keladi: PAM, NSS, LDAP

```
login / ssh / sudo
        |
        v
   PAM  (/etc/pam.d/*)
   autentifikatsiya, parol siyosati, MFA, limits, session
        |
        v
   NSS  (/etc/nsswitch.conf  ->  passwd: files sss)
        |
        +--> files : /etc/passwd, /etc/group
        |
        +--> sss   : SSSD --> LDAP / FreeIPA / Active Directory
```

```sh
getent passwd ali        # NSS orqali: LDAP user'lar ham ko'rinadi
getent group devs
```

**Senior nuqtalar**
- `/etc/passwd` ni o'qiydigan script LDAP user'larni ko'rmaydi: har doim `getent`.
- UID mos kelmasligi: `ali` bir serverda 1001, boshqasida 1002. NFS'da fayllar "begona" bo'lib qoladi. Markaziy identity yoki NFSv4 idmap.
- NFS `root_squash`: klient root'i server'da `nobody` bo'ladi. `no_root_squash` = klient root'i server fayllarida root (xavfli).
- SSSD cache: LDAP o'chsa ham login ishlaydi, lekin o'chirilgan user ham cache muddati tugaguncha kira oladi.

---

## 15. Amaliy misol: jamoaviy papka

```sh
sudo groupadd devs
sudo usermod -aG devs ali
sudo usermod -aG devs vali
sudo install -d -o root -g devs -m 2770 /srv/project
sudo setfacl -d -m g:devs:rwX /srv/project
```

```
/srv/project       drwxrws---+  root devs
 |
 +-- a.go          ali yaratdi   -> guruhi devs   (SGID tufayli)
 |                               -> devs rw       (default ACL tufayli)
 +-- vali tahrirlay oladi        -> ha
 +-- begona user                 -> kira olmaydi (others = ---)
```

SGID yolg'iz yetmaydi: ali'ning umask'i 022 bo'lsa fayl 644 bo'ladi va vali yoza olmaydi. Default ACL (yoki umask 002) buni hal qiladi.

---

## 16. Xavfsizlik audit

```sh
find / -xdev -perm -4000 -type f 2>/dev/null     # SUID
find / -xdev -perm -2000 -type f 2>/dev/null     # SGID
find / -xdev -perm -0002 -type f 2>/dev/null     # world-writable fayllar
find / -xdev \( -nouser -o -nogroup \) 2>/dev/null
getcap -r / 2>/dev/null                          # file capabilities
awk -F: '$3==0' /etc/passwd                      # UID 0 lar
sudo -l -U ali
```

Klassik escalation yo'llari:
- sudo + shell ochadigan buyruq (GTFOBins).
- `docker` / `lxd` guruhi: `docker run -v /:/host -it alpine chroot /host`.
- root cron yoki servis ishlatadigan, lekin oddiy user yoza oladigan script / `PATH` papka.
- Keraksiz SUID binary yoki `cap_setuid` / `cap_dac_override` li binary.
- O'qiladigan secret: `.env`, `~/.bash_history`, backup fayllar.

---

## 17. Architect nuqtai nazari

| Vazifa                    | To'g'ri yechim                                          |
|---------------------------|---------------------------------------------------------|
| Har servis                | alohida system user, shell `nologin`                    |
| 1024 dan past port        | `CAP_NET_BIND_SERVICE`, root emas                       |
| Vaqtincha servis user     | systemd `DynamicUser=yes`                               |
| Jamoaviy papka            | SGID + default ACL                                      |
| Secret fayl               | 0400 / 0600, servis user'ga; systemd `LoadCredential=`  |
| Admin huquqi              | shaxsiy hisob + aniq sudo qoidalari + audit + MFA       |
| Ko'p server identity      | LDAP / FreeIPA / AD + SSSD, sabit UID/GID               |
| Konteyner                 | non-root, drop ALL caps, read-only rootfs, userns       |

Qatlamlar (defense in depth):

```
+-----------------------------------------------+
| MAC (SELinux / AppArmor)                      |
|  +-----------------------------------------+  |
|  | namespaces + seccomp                    |  |
|  |  +-----------------------------------+  |  |
|  |  | capabilities + no_new_privs       |  |  |
|  |  |  +-----------------------------+  |  |  |
|  |  |  | DAC: owner / group / rwx    |  |  |  |
|  |  |  +-----------------------------+  |  |  |
|  |  +-----------------------------------+  |  |
|  +-----------------------------------------+  |
+-----------------------------------------------+
```

Prinsip: **least privilege**. Har qatlam boshqasi buzilganda ham himoya qiladi.

---

## Senior interview savollari

1. **`chmod 777` qildim, baribir `Permission denied`. Sabablar?**
   Yo'ldagi papkada `x` yo'q; SELinux / AppArmor; `chattr +i`; `ro` / `noexec` mount; ACL mask; NFS `root_squash`; jarayon eski guruhlar ro'yxati bilan ishlayapti.
2. **Daemon nega root'da start bo'lib, keyin user'ga o'tadi?**
   Port bind va fayllarni ochish uchun. Keyin `setgroups -> setgid -> setuid` bilan privilegiya qaytarib bo'lmas qilib tashlanadi.
3. **Konteynerdagi root host uchun xavflimi?**
   userns'siz ha: UID 0 bir xil, faqat caps / seccomp / MAC cheklaydi. userns bilan host'da huquqsiz UID.
4. **`docker` guruhi nega xavfli?**
   Docker socket = root API. Host `/` ni mount qilib, `chroot` qilish mumkin.
5. **Fayl ochilgandan keyin `chmod 000` qilinsa?**
   Ochiq FD ishlashda davom etadi: huquq faqat `open()` da tekshiriladi.
6. **SUID ni nima bilan almashtirasiz?**
   File capabilities, sudo bilan aniq qoida, yoki privilegiyali kichik helper servis (IPC orqali).
7. **Guruhga qo'shdim, lekin servis baribir fayl ocholmayapti.**
   Servis jarayoni eski guruhlar bilan ishlayapti: restart kerak. systemd'da `SupplementaryGroups=` ni tekshir.
