# Linux: User, Group, Permission — qisqa va sodda

> Bir gap bilan: **har bir fayl kimgadir tegishli (user + group), va 3 toifadagi odamga (owner / group / others) 3 xil huquq (r / w / x) beriladi.**

---

## 1. User (foydalanuvchi)

Linux uchun user — bu **ism emas, raqam** (UID). Ism faqat odamlar uchun qulaylik.

```
 ┌───────────────┬───────┬──────────────────────────────┐
 │ Turi          │ UID   │ Misol                        │
 ├───────────────┼───────┼──────────────────────────────┤
 │ root          │ 0     │ hamma narsaga ruxsat         │
 │ system user   │ 1–999 │ nginx, postgres, sshd        │
 │ oddiy user    │ 1000+ │ ali, vali                    │
 └───────────────┴───────┴──────────────────────────────┘
```

Ma'lumot qayerda saqlanadi:

```
/etc/passwd   →  ali:x:1001:1001:Ali:/home/ali:/bin/bash
                  │   │  │    │    │      │         │
                 nom  │ UID  GID  izoh  home      shell
                      └─ parol bu yerda emas → /etc/shadow (hash, faqat root o'qiydi)
```

```sh
id ali                 # uid=1001(ali) gid=1001(ali) groups=1001(ali),27(sudo)
sudo useradd -m -s /bin/bash ali   # -m: home papka yaratadi
sudo passwd ali
sudo userdel -r ali    # -r: home bilan birga o'chiradi
```

---

## 2. Group (guruh)

Group — **bir nechta userga birdaniga huquq berish** uchun. 10 kishiga alohida emas, bitta guruhga beriladi.

```
            ┌──────────── group: devs (GID 2000) ───────────┐
            │                                               │
            │    👤 ali        👤 vali        👤 sardor     │
            │                                               │
            └───────────────────────┬───────────────────────┘
                                    │  rw huquq
                                    ▼
                           📁 /srv/project
```

Har userda:
- **1 ta primary group** — yangi fayl yaratsa, fayl shu guruhga tegishli bo'ladi.
- **0..N supplementary group** — qo'shimcha a'zolik (`sudo`, `docker`, `devs`).

```
/etc/group  →  devs:x:2000:ali,vali,sardor
```

```sh
sudo groupadd devs
sudo usermod -aG devs ali   # -a MUHIM! -a siz boshqa guruhlardan chiqarib yuboradi
groups ali
newgrp devs                 # yoki qayta login — a'zolik faqat yangi sessiyada kuchga kiradi
```

---

## 3. Permission (huquqlar)

### `ls -l` ni o'qish

```
-rwxr-x---  1  ali  devs  4096  Oct 1  deploy.sh
│└┬┘└┬┘└┬┘      │    │
│ │  │  │       │    └── group egasi
│ │  │  │       └─────── user egasi (owner)
│ │  │  └── others (qolgan hamma)
│ │  └───── group
│ └──────── owner (user)
└────────── tur: - fayl, d papka, l symlink
```

### r / w / x — fayl va papkada ma'nosi FARQ qiladi

```
 ┌─────┬────────────────────┬──────────────────────────────────┐
 │     │ Fayl               │ Papka                            │
 ├─────┼────────────────────┼──────────────────────────────────┤
 │ r   │ ichini o'qish      │ ichidagi nomlarni ko'rish (ls)   │
 │ w   │ ichini o'zgartirish│ fayl yaratish / o'chirish / nomini│
 │     │                    │ o'zgartirish                     │
 │ x   │ ishga tushirish    │ ichiga kirish (cd), fayllarga    │
 │     │                    │ yetib borish                     │
 └─────┴────────────────────┴──────────────────────────────────┘
```

> ⚠️ Gotcha: faylni o'chirish huquqi **faylning** emas, **papkaning `w`** huquqiga bog'liq.

### Raqamli (octal) ko'rinish

```
   r = 4     w = 2     x = 1

   rwx = 4+2+1 = 7
   r-x = 4+0+1 = 5
   r-- = 4+0+0 = 4

   chmod 750 deploy.sh
          │││
          ││└─ others: 0  ---
          │└── group : 5  r-x
          └─── owner : 7  rwx
```

Ko'p ishlatiladiganlar:

```
 644  rw-r--r--   oddiy fayl
 755  rwxr-xr-x   script / papka
 600  rw-------   maxfiy (ssh key, .env)
 700  rwx------   shaxsiy papka (~/.ssh)
```

```sh
chmod 640 app.conf
chmod u+x,g-w,o= run.sh      # simvolik: u/g/o/a  +/-/=  r/w/x
chown ali:devs app.conf      # egasini va guruhini o'zgartirish
chown -R ali:devs /srv/project
```

---

## 4. Kernel qanday tekshiradi (eng muhim diagramma)

Kernel **birinchi mos kelgan** toifani oladi va **to'xtaydi**:

```
          jarayon faylga kirmoqchi
                    │
                    ▼
            ┌───────────────┐   ha
            │  UID == 0 ?   │──────────►  ✅ ruxsat (root)
            └───────┬───────┘
                    │ yo'q
                    ▼
            ┌───────────────┐   ha
            │ UID == owner? │──────────►  owner bitlarini tekshir → tamom
            └───────┬───────┘
                    │ yo'q
                    ▼
            ┌───────────────┐   ha
            │ guruhlarimdan │──────────►  group bitlarini tekshir → tamom
            │ biri == group?│
            └───────┬───────┘
                    │ yo'q
                    ▼
            others bitlarini tekshir
```

> ⚠️ Gotcha: `----rwx---` faylida **owner hech narsa qila olmaydi**, garchi guruhda bo'lsa ham — chunki owner bosqichida to'xtaydi.

---

## 5. Maxsus bitlar

```
 ┌──────────┬───────┬───────────────────────────────────────────────┐
 │ Bit      │ Octal │ Nima qiladi                                   │
 ├──────────┼───────┼───────────────────────────────────────────────┤
 │ SUID     │ 4000  │ fayl EGASI nomidan ishlaydi                   │
 │          │       │ misol: /usr/bin/passwd  -rwsr-xr-x (root)     │
 │ SGID     │ 2000  │ papkada: yangi fayllar papka guruhini oladi   │
 │          │       │ (jamoaviy papka uchun ideal)                  │
 │ Sticky   │ 1000  │ papkada: faqat O'Z faylingni o'chira olasan   │
 │          │       │ misol: /tmp  drwxrwxrwt                       │
 └──────────┴───────┴───────────────────────────────────────────────┘
```

```sh
chmod 2775 /srv/project   # SGID: hamma fayl 'devs' guruhida qoladi
chmod 1777 /shared        # sticky: /tmp kabi
```

---

## 6. umask — yangi fayl qanday huquq bilan tug'iladi

```
  fayl uchun bazaviy:   666  rw-rw-rw-
  papka uchun bazaviy:  777  rwxrwxrwx
  umask:              − 022  (olib tashlanadigan bitlar)
  ─────────────────────────────
  fayl  natija:         644
  papka natija:         755
```

```sh
umask        # 0022
umask 027    # yangi fayl 640, papka 750
```

---

## 7. sudo — vaqtincha root bo'lish

```
  ali ──sudo cmd──► /etc/sudoers tekshiriladi ──► cmd root nomidan ishlaydi
                     (sudo / wheel guruhi)          log: /var/log/auth.log
```

```sh
sudo visudo                         # sudoers ni faqat shu bilan tahrirla (sintaksis tekshiradi)
# ali ALL=(ALL) NOPASSWD: /bin/systemctl restart nginx   ← faqat bitta buyruqqa ruxsat
```

---

## 8. ACL — 3 toifa yetmaganda

Owner/group/others yetmasa (masalan "faqat sardorga ham o'qishga ruxsat ber"):

```sh
setfacl -m u:sardor:r report.txt
getfacl report.txt
ls -l report.txt     # -rw-r-----+   ← "+" ACL borligini bildiradi
```

---

## Amaliy misol: jamoaviy papka (hammasi birga)

```sh
sudo groupadd devs
sudo usermod -aG devs ali
sudo usermod -aG devs vali
sudo mkdir -p /srv/project
sudo chown root:devs /srv/project
sudo chmod 2770 /srv/project     # SGID + rwx owner/group, others — hech narsa
```

```
 📁 /srv/project   drwxrws---  root devs
    ├── ali yaratdi  → guruhi: devs ✅ (SGID tufayli)
    └── vali tahrirlay oladi ✅   begona user kira olmaydi ❌
```

---

## Interview uchun 6 ta gotcha

1. `usermod -G` (`-a` siz) — userni boshqa barcha guruhlardan chiqaradi.
2. Guruhga qo'shilgandan keyin **qayta login** kerak.
3. Fayl o'chirish — papkaning `w` + `x` huquqi, faylniki emas.
4. Papkada `r` bor, `x` yo'q → nomlar ko'rinadi, lekin ichiga kira olmaysan.
5. Owner tekshiruvi birinchi — owner o'z faylidan group'dan kam huquq olishi mumkin.
6. SUID shell script'larda kernel tomonidan e'tiborga olinmaydi (xavfsizlik).

---

# Senior level

## 9. Jarayonning "kimligi": real / effective / saved UID

Fayl emas, **jarayon** huquqqa ega. Har jarayonda 3 xil UID (GID ham xuddi shunday) bor:

```
 ┌──────────────┬───────────────────────────────────────────┐
 │ real UID     │ kim ishga tushirdi (ali)                   │
 │ effective UID│ kernel huquqni SHU bo'yicha tekshiradi      │
 │ saved UID    │ privilegiyani tashlab, keyin qaytarib olish │
 └──────────────┴───────────────────────────────────────────┘

  ali: passwd   (SUID root)
      real=1001   effective=0   saved=0
                      │
                      └─► /etc/shadow ga yoza oladi
```

```sh
ps -eo pid,ruid,euid,suid,cmd | head
cat /proc/$$/status | grep -E 'Uid|Gid|Groups'
```

Senior nuqta: daemon to'g'ri yo'l bilan privilegiyani tashlaydi — **avval `setgroups` → `setgid` → `setuid`** (teskari tartib xato: `setuid` dan keyin guruhni o'zgartirib bo'lmaydi va jarayon root guruhlarida qolib ketadi).

---

## 10. Capabilities — root'ni bo'laklarga bo'lish

Root = "hammasi yoki hech narsa". Capabilities uni ~40 ta mayda huquqqa bo'ladi:

```
                root (UID 0)
   ┌──────────────┬─────────────┬──────────────┬──────────┐
   │CAP_NET_BIND_ │CAP_CHOWN    │CAP_SYS_ADMIN │CAP_DAC_  │ ...
   │SERVICE (<1024│             │ (≈ yangi root│OVERRIDE  │
   │portlar)      │             │  — xavfli!)  │(rwx chetlab o'tish)
   └──────────────┴─────────────┴──────────────┴──────────┘
```

```sh
sudo setcap cap_net_bind_service=+ep /usr/local/bin/myapp   # root'siz 80-port
getcap /usr/local/bin/myapp
capsh --print
```

systemd'da:

```ini
[Service]
User=myapp
AmbientCapabilities=CAP_NET_BIND_SERVICE
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
NoNewPrivileges=yes
```

> `NoNewPrivileges` — SUID / file caps endi jarayonga huquq qo'sha olmaydi (privilege escalation yo'li yopiladi).

---

## 11. DAC vs MAC: SELinux / AppArmor

```
  so'rov ─► DAC (rwx, owner, ACL) ─► MAC (SELinux/AppArmor) ─► ✅
                 │ rad                     │ rad
                 ▼                         ▼
                ❌                        ❌   (root ham!)
```

- **DAC** — egasi o'zi hal qiladi (chmod). Root hammasini chetlab o'tadi.
- **MAC** — markaziy policy; root ham bo'ysunadi.
- Klassik bug: `chmod 777` qildim, baribir `Permission denied` → SELinux label (`ls -Z`, `ausearch -m avc`, `restorecon -Rv`). Yechim — `setenforce 0` emas, to'g'ri label/policy.

---

## 12. User namespaces — konteynerdagi "root"

```
   konteyner ichida            host'da
   ─────────────────           ───────────────
   UID 0 (root)      ───map──► UID 100000 (oddiy, huquqsiz)
   UID 1000          ───map──► UID 101000
```

```sh
cat /etc/subuid        # ali:100000:65536
cat /proc/<pid>/uid_map
```

- Rootless Docker/Podman shu ustiga qurilgan: konteynerdan qochsa ham host'da huquqsiz user.
- Gotcha: volume mount qilingan fayllar host'da `100999` kabi g'alati UID bilan ko'rinadi → `--userns=keep-id` (Podman) yoki `chown` mapping hisobga olinadi.
- K8s: `runAsNonRoot: true`, `runAsUser`, `fsGroup` (volume'ga guruh beradi), `allowPrivilegeEscalation: false`, `capabilities.drop: ["ALL"]`.

---

## 13. ACL chuqurroq: mask va default

```
 getfacl report.txt
   user::rw-
   user:sardor:rwx      #effective:r--   ◄── mask kesib tashladi!
   group::r--
   mask::r--            ◄── named user + group uchun "shift"
   other::---
```

- ACL bor faylda `ls -l` dagi group ustuni = **mask**, haqiqiy group emas.
- `chmod g-w` mask'ni o'zgartiradi → hamma named ACL kesiladi.
- Default ACL (papka) — yangi fayllarga meros: `setfacl -d -m g:devs:rwX /srv/project` (`X` — faqat papka/executable'ga x).

---

## 14. Fayl atributlari — root'dan ham himoya

```sh
sudo chattr +i /etc/resolv.conf   # immutable: root ham o'zgartira/o'chira olmaydi
sudo chattr +a /var/log/app.log   # append-only: faqat oxiriga yozish
lsattr /etc/resolv.conf
```

Incident'da: "root bo'lib ham fayl o'chmayapti" → `lsattr` tekshir (yoki hujumchi persistence uchun `+i` qo'ygan).

---

## 15. Identity qayerdan keladi: NSS / PAM / LDAP

```
  login/ssh
     │
     ▼
   PAM  (/etc/pam.d/*)  ── autentifikatsiya, parol siyosati, MFA, limits
     │
     ▼
   NSS  (/etc/nsswitch.conf: passwd: files sss)
     ├── files → /etc/passwd
     └── sss   → SSSD → LDAP / FreeIPA / AD
```

```sh
getent passwd ali     # /etc/passwd emas — NSS orqali (LDAP user'lar ham ko'rinadi)
getent group devs
```

Senior gotchalar:
- Bir nechta server / NFS'da **UID mos kelishi shart**: `ali`=1001 bir serverda, 1002 boshqasida → fayllar "begona" bo'lib qoladi. Markaziy identity (LDAP/IPA) yoki NFSv4 idmap.
- NFS `root_squash` — klient root'i server'da `nobody` bo'ladi.
- User o'chirildi → fayllar eski UID bilan qoladi; yangi user shu UID'ni olsa — **eski fayllarni meros oladi**. `find / -nouser` bilan tozala.

---

## 16. Xavfsizlik audit (senior checklist)

```sh
find / -perm -4000 -type f 2>/dev/null     # SUID binary'lar — har biri potensial escalation
find / -perm -0002 -type f 2>/dev/null     # world-writable fayllar
find / -nouser -o -nogroup 2>/dev/null     # egasiz fayllar
awk -F: '$3==0' /etc/passwd                # root'dan boshqa UID 0 bormi?
sudo -l -U ali                             # ali sudo bilan nima qila oladi
```

Klassik escalation yo'llari (GTFOBins):
- `sudo vim` / `sudo less` / `sudo find` → shell ochadi. `NOPASSWD` faqat aniq buyruq + argumentga.
- `docker` guruhi = root (`docker run -v /:/host`). Shuning uchun `docker` guruhiga qo'shish = sudo berish.
- Writable `PATH` papkasi + root cron → binary almashtirish.
- SUID binary + `LD_PRELOAD` — kernel/ld.so buni secure-mode'da bloklaydi; custom SUID'da tekshir.

---

## 17. Dizayn qarorlari (architect nuqtai nazari)

```
 ┌───────────────────────────┬──────────────────────────────────────────┐
 │ Vazifa                    │ To'g'ri yechim                           │
 ├───────────────────────────┼──────────────────────────────────────────┤
 │ Har servis                │ alohida system user, shell=/usr/sbin/nologin│
 │ <1024 port                │ CAP_NET_BIND_SERVICE, root emas          │
 │ Vaqtincha servis user     │ systemd DynamicUser=yes                  │
 │ Jamoaviy papka            │ SGID + default ACL + umask 002           │
 │ Secret fayl               │ 0600/0400, servis user'ga, yoki tmpfs/   │
 │                           │ systemd LoadCredential=                  │
 │ Admin huquqi              │ sudo + aniq buyruqlar, audit log, MFA    │
 │ Ko'p server identity      │ LDAP/FreeIPA/AD + SSSD, sabit UID/GID     │
 │ Konteyner                 │ non-root, drop ALL caps, read-only rootfs,│
 │                           │ userns                                   │
 └───────────────────────────┴──────────────────────────────────────────┘
```

Prinsip: **least privilege** + **defense in depth** (DAC → caps → MAC → namespace).

---

## Senior interview savollari (qisqa javob bilan)

1. **`chmod 777` qildim, baribir `Permission denied`. Sabablar?** — yo'ldagi papkada `x` yo'q; SELinux/AppArmor; `chattr +i`; read-only mount (`ro`, `noexec`); ACL mask; NFS root_squash.
2. **Nega daemon root'da ishga tushib, keyin user'ga o'tadi?** — port bind / fayl ochish uchun, so'ng `setgroups→setgid→setuid` bilan privilegiyani qaytarib bo'lmas qilib tashlaydi.
3. **Konteynerdagi root host'da xavflimi?** — userns'siz: UID 0 bir xil, faqat caps/seccomp/MAC himoya qiladi. userns bilan: host'da huquqsiz UID.
4. **`docker` guruhi nega xavfli?** — Docker socket = root API; host `/` ni mount qilish mumkin.
5. **Ochiq fayl descriptor va chmod** — huquq `open()` paytida tekshiriladi; keyin `chmod 000` ochiq FD'ni bekor qilmaydi.
6. **Guruh a'zoligi jarayonda qachon yangilanadi?** — faqat yangi login/jarayonda; ishlab turgan jarayon eski guruhlar ro'yxati bilan qoladi.
