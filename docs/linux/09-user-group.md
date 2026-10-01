# Dars 9 — User va group

> **Natija:** user va group nima ekanini, ular qayerda saqlanishini bilish, user yaratish va group'ga qo'shish. Senior darajada: kernel nega nomni emas, UID'ni ko'radi; servis account'lari va least privilege; group o'zgarishi nega darhol ishlamaydi; container'da UID muammolari; ko'p server'da user boshqaruvi.

## 1. Problem — "kim nima qila oladi?"

Bitta server'da bir vaqtda ishlaydi:
- bir necha odam (admin, dasturchi, auditor);
- o'nlab servis (nginx, postgres, app, cron job'lar).

Savollar:
- Nginx buzib kirilsa, hujumchi DB file'larini o'qiy oladimi?
- Dasturchi prod config'ni o'zgartira oladimi?
- Kim, qachon, nima qilganini qanday bilamiz?

**Yechim:** har harakat qandaydir **identity** (user) nomidan bajariladi, ruxsatlar shu identity'ga va uning **group**'lariga beriladi. Bu Linux security'ning birinchi qatlami.

## 2. Mental model — kernel uchun user = raqam

```
 Siz ko'rasiz:    ali           Kernel ko'radi:   UID 1001
 File egasi:      ali           Inode'da:         uid=1001
 Process egasi:   ali           Process'da:       uid=1001
```

Nom -> raqam tarjimasi faqat **user space**'da (`/etc/passwd` orqali) bo'ladi. Kernel ruxsatni tekshirganda faqat raqamlarni solishtiradi.

**Bundan kelib chiqadi:**
- `ali`'ni o'chirib, yangi user'ga UID 1001 berilsa — u `ali`'ning barcha file'lariga ega bo'ladi.
- Disk'ni boshqa server'ga ulasangiz, file'lar o'sha server'da UID 1001 kim bo'lsa, o'shaniki bo'lib qoladi.
- `ls -l` nom o'rniga raqam ko'rsatsa — bu UID'ga mos user mavjud emas (orphan file).

| Tur | UID | Misol | Vazifa |
|---|---|---|---|
| root | 0 | `root` | Kernel tekshiruvlarini chetlab o'tadi |
| System / servis | 1–999 | `www-data`, `postgres`, `sshd`, `systemd-*` | Bitta servisni ishga tushirish |
| Oddiy | 1000+ | `student`, `ali` | Odamlar |
| nobody | 65534 | `nobody` | Hech qanday huquqsiz identity |

> **Senior nuqta:** "root" — bu nom emas, **UID 0**. UID 0 bo'lgan istalgan user root'dir. Security audit'da: `awk -F: '$3==0' /etc/passwd` — faqat bitta qator bo'lishi kerak.

## 3. Group — ruxsatni masshtablash

Ruxsatni har user'ga alohida berish masshtablanmaydi: 20 dasturchi -> 20 ta o'zgarish. Group'ga bersangiz — bitta.

```
 group: deploy --+-- ali
                 +-- vali
                 +-- ci-runner

 /srv/app  egasi: root, group: deploy, ruxsat: 775
 -> deploy group'idagi hamma yoza oladi
```

- **Primary group** — user yaratgan yangi file'lar shu group'ga tegishli bo'ladi (`/etc/passwd`'dagi GID).
- **Supplementary groups** — qo'shimcha huquqlar (`sudo`, `docker`, `adm`).

Ubuntu'da har yangi user o'z nomi bilan shaxsiy group oladi (**User Private Group**): `ali:ali`. Nega? Shunda default umask `002` bo'lsa ham, file'lar boshqalarga ochilmaydi — group'da faqat o'zi bor.

### Xavfli group'lar — "root'ga teng"

| Group | Nima beradi | Nega xavfli |
|---|---|---|
| `sudo` / `wheel` | `sudo` bilan root | Aniq |
| `docker` | Docker socket'ga kirish | `docker run -v /:/host --privileged` = root. **Docker group = parolsiz root** |
| `lxd` | Container yaratish | Xuddi docker kabi root'ga yo'l |
| `disk` | `/dev/sda`'ga to'g'ridan-to'g'ri | Istalgan file'ni o'qish/yozish |
| `adm` | `/var/log`'larni o'qish | Log'da secret va shaxsiy ma'lumot bo'lishi mumkin |

> **Security:** user'ni `docker` group'iga qo'shish — unga root berish bilan bir xil. Production'da: rootless Docker / Podman yoki faqat CI uchun cheklangan kirish.

## 4. Kimman?

```bash
whoami            # -> student (effective user nomi)
id                # -> uid=1000(student) gid=1000(student) groups=1000(student),27(sudo)
id ali            # boshqa user haqida
groups ali
who               # hozir kim login qilgan
last -n 10        # oxirgi login'lar
getent passwd ali # NSS orqali (LDAP user'lar ham ko'rinadi)
```

> **`cat /etc/passwd` vs `getent passwd`:** korporativ server'larda user'lar LDAP / FreeIPA / SSSD'da bo'lishi mumkin — `/etc/passwd`'da ular yo'q. `getent` NSS orqali barcha manbalardan so'raydi. Script'larda `getent` ishlating.

## 5. Saqlanadigan file'lar

```text
/etc/passwd
ali:x:1001:1001:Ali Valiyev:/home/ali:/bin/bash
 |  |  |    |       |          |          +-- login shell
 |  |  |    |       |          +------------- home directory
 |  |  |    |       +------------------------ izoh (GECOS)
 |  |  |    +-------------------------------- primary GID
 |  |  +------------------------------------- UID
 |  +---------------------------------------- "x" = parol /etc/shadow'da
 +------------------------------------------- username
```

| File | Mazmun | Ruxsat | Nega |
|---|---|---|---|
| `/etc/passwd` | User'lar | Hamma o'qiydi | `ls -l` UID -> nom tarjimasi uchun |
| `/etc/shadow` | Parol hash'lari, muddat | Faqat root (va `shadow` group) | Hash'lar offline brute-force qilinmasin |
| `/etc/group` | Group'lar va a'zolari | Hamma o'qiydi | |
| `/etc/gshadow` | Group parollari | Faqat root | |

**Tarix:** avval hash'lar `/etc/passwd`'da edi. U hamma uchun ochiq bo'lgani sababli, har kim hash'larni olib, offline buzishi mumkin edi. Yechim — hash'larni faqat root o'qiydigan `/etc/shadow`'ga ko'chirish.

```text
/etc/shadow
ali:$y$j9T$...:20000:0:99999:7:::
     |                         +-- muddat sozlamalari
     +-- $y$ = yescrypt, $6$ = SHA-512; "!" yoki "*" = parol bilan login yopiq
```

> **Qoida:** bu file'larni hech qachon editor bilan to'g'ridan-to'g'ri tahrirlamang. Bitta sintaksis xatosi — hech kim login qila olmaydi. `useradd`, `usermod`, `vipw` / `vigr` (lock va tekshiruv bilan) ishlating.

## 6. Boshqarish

```bash
sudo useradd -m -s /bin/bash ali       # -m home yaratadi (past-darajali, script uchun)
sudo adduser vali                      # interaktiv (Debian/Ubuntu wrapper)
sudo passwd ali
sudo groupadd deploy
sudo usermod -aG deploy ali            # -a MUHIM!
sudo gpasswd -d ali deploy             # group'dan chiqarish
sudo usermod -L ali                    # parolni bloklash
sudo usermod -s /usr/sbin/nologin ali  # shell'ni olib qo'yish
sudo chage -E 0 ali                    # account muddatini tugatish
sudo userdel -r ali                    # home bilan o'chirish
```

> **Gotcha 1:** `usermod -G deploy ali` (`-a`siz) user'ni boshqa **barcha** supplementary group'lardan chiqaradi — `sudo`'dan ham. Remote server'da o'zingizni shunday qilib qulflab qo'yish mumkin.

> **Gotcha 2 — nega group darhol ishlamaydi:** group ro'yxati **login paytida** process'ga yoziladi va child process'larga meros bo'ladi. `/etc/group` o'zgargani ishlayotgan session'ga ta'sir qilmaydi. Yechim: qayta login, yoki shu shell uchun `newgrp deploy`. Servis uchun — servisni restart.

> **Gotcha 3 — `userdel -r` vs bloklash:** xodim ketganda darhol o'chirish o'rniga avval **bloklang** (`usermod -L`, `chage -E 0`, SSH kalitni olib tashlash). O'chirilgan user'ning file'lari orphan bo'ladi va uning UID'i keyinchalik boshqa user'ga berilishi mumkin. Audit tugagach — o'chirish.

> **Muhim:** `usermod -L` faqat **parolni** bloklaydi. SSH kalit bilan kirish ishlayveradi! To'liq bloklash: `chage -E 0` yoki shell'ni `nologin` qilish va `~/.ssh/authorized_keys`'ni olib tashlash.

## 7. Servis account'lari — least privilege

```bash
ps -eo user,comm | sort -u | head -20
```

Nginx `www-data`, PostgreSQL `postgres` nomidan ishlaydi. **Sabab — blast radius:** servis buzib kirilsa, hujumchi root emas, faqat shu servisning huquqiga ega bo'ladi.

```
 nginx root sifatida:          nginx www-data sifatida:
 RCE -> butun server           RCE -> faqat www-data o'qiy oladigan narsalar
```

O'z servisingiz uchun account:

```bash
# Naive: app'ni root yoki shaxsiy user'ingiz nomidan ishga tushirish

# Better
sudo useradd --system --no-create-home --shell /usr/sbin/nologin myapp

# Production: systemd o'zi vaqtinchalik user yaratadi
# [Service]
# DynamicUser=yes
# StateDirectory=myapp
```

- `--system` — UID < 1000, login uchun emas.
- `nologin` — hatto parol topilsa ham interaktiv shell yo'q.
- Har servisga **alohida** user: bitta `app` user'i bilan 5 servisni ishlatsangiz, bittasi buzilsa — beshala ham.

## 8. Container va UID — production gotcha'lari

Container ichidagi `root` (UID 0) — host'dagi UID 0 bilan **bir xil** (user namespace yoqilmagan bo'lsa). Container'dan qochish (escape) bo'lsa — host'da root.

```dockerfile
# Production Dockerfile
RUN useradd --uid 10001 --no-create-home app
USER 10001
```

**Volume permission muammosi:**

```
 Host: /data egasi UID 1000 (student)
 Container: app UID 10001 sifatida ishlaydi
 -> "Permission denied" /data'ga yozishda
```

Yechimlar: host papkasining egasini mos UID'ga o'zgartirish; Kubernetes'da `securityContext.fsGroup`; yoki user namespace (rootless) bilan UID mapping.

> Kubernetes'da: `runAsNonRoot: true`, `runAsUser: 10001`, `allowPrivilegeEscalation: false` — security baseline.

## 9. Masshtab: 100 ta server'da user boshqaruvi

| Yondashuv | Qanday | Muammo / qachon |
|---|---|---|
| Har server'da qo'lda `useradd` | SSH + command | UID'lar server'lar orasida farqlanadi, xodim ketganda 100 server'dan o'chirish unutiladi |
| IaC (Ansible, cloud-init) | User'lar kod bilan, bir xil UID | Kichik/o'rta park uchun yaxshi |
| Markaziy directory (LDAP, FreeIPA, AD + SSSD) | Bitta joyda boshqaruv | Katta korporativ muhit; directory ishlamasa login ham yo'q |
| SSH sertifikatlar / SSO (Teleport, Vault SSH) | Qisqa muddatli kirish | Zamonaviy: doimiy kalit yo'q, audit avtomatik |

> **Staff insight:** eng yaxshi user boshqaruvi — server'larga **odamlar umuman kirmasligi**. Immutable infra + CI/CD + markaziy log'lar bo'lsa, SSH faqat favqulodda holat uchun ("break-glass"), qisqa muddatli va audit bilan.

## Amaliy mashg'ulot

1. `deploy` group yarating.
2. `ali` va `vali` user'larini yarating, `deploy`'ga qo'shing.
3. `ali` session'ida `id` qiling, keyin boshqa terminalda uni yangi group'ga qo'shing — `ali` session'ida `id` o'zgarmaganini ko'ring. `newgrp` yoki qayta login bilan tuzating.
4. `usermod -G deploy vali` (`-a`siz) qilib, `vali` qaysi group'larni yo'qotganini ko'ring.
5. `myapp` servis account'ini yarating va `su - myapp` ishlamasligini ko'ring (nima uchun?).
6. Audit: `awk -F: '$3==0' /etc/passwd`, `getent group sudo docker`.
7. `ali`'ni o'chiring (home'siz), keyin `ls -l /home` — qanday ko'rinadi?

## Uy vazifa

1. `/etc/passwd`'dagi barcha system user'larni (UID < 1000) `awk -F: '$3<1000 {print $1, $7}' /etc/passwd` bilan chiqaring va 5 tasining vazifasini yozing. Ularning shell'i nega `nologin`?
2. Xodim ketganda bajariladigan offboarding checklist yozing (kamida 6 qadam).
3. Nega `docker` group'i root'ga teng? Misol command bilan tushuntiring (ishga tushirmasdan).

## Test savollari

1. Kernel user'ni nom bilan taniydimi yoki raqam bilan? Bundan qanday muammolar kelib chiqadi?
2. root'ning UID'i? Ikkinchi UID 0 user bo'lsa nima bo'ladi?
3. Parol hash'i nega `/etc/passwd`'da emas?
4. `usermod -aG`'da `-a` nima uchun?
5. Group'ga qo'shildim, lekin ruxsat ishlamayapti — nega?
6. `usermod -L` user'ni to'liq bloklaydimi?
7. Nega nginx root nomidan ishlamaydi? Blast radius nima?
8. Nega `docker` group'iga qo'shish xavfli?
9. Container'da `USER 10001` nima beradi?

## Common mistakes

- `usermod -G` ni `-a`siz ishlatish.
- Hamma servisni bitta user yoki root nomidan ishga tushirish.
- Dasturchilarni "qulaylik uchun" `docker` group'iga qo'shish.
- Ketgan xodimning faqat parolini bloklash, SSH kalitini unutish.
- `/etc/passwd` va `/etc/shadow`'ni editor bilan tahrirlash.
- Har server'da user'larni qo'lda yaratish — UID'lar farqlanadi.

## Senior xulosa

- User — identity, group — ruxsatni masshtablash vositasi, UID — kernel uchun haqiqiy ism.
- Har servis — alohida, login'siz system user (yoki `DynamicUser`). Bu blast radius'ni cheklaydi.
- Ba'zi group'lar (`sudo`, `docker`, `disk`) amalda root'ga teng — ularni ehtiyot bilan bering.
- Group o'zgarishi faqat yangi login/process'da kuchga kiradi.
- Masshtabda user'lar IaC yoki markaziy directory bilan boshqariladi; ideal holatda odamlar server'ga umuman kirmaydi.
