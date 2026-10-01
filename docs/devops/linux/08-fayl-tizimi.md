# Dars 8 — Fayl tizimi va yo'llar (FHS)

> **Natija:** asosiy papkalar vazifasini bilish, config, log va data qayerda turishini darhol topish. Nega papkalar aynan shunday bo'lingan, `/proc` va `/sys` virtual filesystem'lari, mount'lar, disk to'lishi incident'lari va app'ni server'ga to'g'ri joylashtirish.

## 1. Muammo — notanish server'da kerakli faylni qanday tez topish kerak?

Yangi server'ga kirdingiz. Nginx ishlamayapti. Config qayerda? Log qayerda? Data qayerda? Agar har bir dastur o'zi xohlagan joyga yozsa — har server'da qidiruv bilan vaqt ketadi.

**Yechim — FHS (Filesystem Hierarchy Standard):** qaysi turdagi fayl qayerda turishi haqidagi kelishuv. Bilsangiz, notanish server'da ham 10 soniyada topasiz.

## 2. Papkalar fayl turiga qarab bo'lingan

FHS'ni yodlash shart emas. Ikkita savol bilan tushunsa bo'ladi:

```
                  O'zgarmas (static)            O'zgaruvchan (variable)
               +-----------------------------+-----------------------------+
 Umumiy        | /usr  (dasturlar, kutubxona)| /var/lib (DB, app data)     |
 (shareable)   | /opt  (3rd-party)           | /var/www                    |
               +-----------------------------+-----------------------------+
 Shu host'ga   | /etc  (config)              | /var/log, /var/cache        |
 xos           | /boot (kernel)              | /run (PID, socket), /tmp    |
               +-----------------------------+-----------------------------+
```

**Nega bu bo'linish foydali:**
- `/usr` faqat o'qish uchun mount qilinishi mumkin (xavfsizlik, immutable OS'lar).
- `/var` alohida disk'ka chiqariladi — log to'lsa, OS ishlayveradi.
- `/etc`'ni backup qilsangiz — server'ning "shaxsiyati" saqlanadi.
- `/tmp`, `/var/cache` — backup kerak emas, yo'qolsa qayta yaratiladi.

## 3. Papkalar daraxti

```
/
+-- bin, sbin, lib  -> zamonaviy distro'larda /usr/bin, /usr/sbin, /usr/lib ga symlink (usrmerge)
+-- boot            -> kernel (vmlinuz), initramfs, bootloader
+-- dev             -> qurilmalar: sda, nvme0n1, null, zero, random, tty
+-- etc             -> CONFIG
+-- home            -> oddiy user'lar papkalari
+-- root            -> root user'ning home'i
+-- opt             -> 3rd-party, o'z-o'zini ta'minlaydigan dasturlar
+-- srv             -> server beradigan data (ba'zi distro'larda)
+-- proc, sys       -> kernel'ning virtual file'lari (diskda yo'q)
+-- run             -> runtime: PID file'lar, socket'lar (RAM'da, reboot'da tozalanadi)
+-- tmp             -> vaqtinchalik
+-- usr             -> o'rnatilgan dasturlar, kutubxonalar
|   +-- local       -> qo'lda o'rnatilgan (package manager'dan tashqari)
+-- var             -> o'zgaruvchan: log, cache, DB, spool
    +-- log
    +-- lib
    +-- cache
```

## 4. Eng muhim papkalar

| Papka | Nima | Real misol | Backup? |
|---|---|---|---|
| `/etc` | Konfiguratsiya | `/etc/nginx/nginx.conf`, `/etc/ssh/sshd_config`, `/etc/hosts` | Ha (yoki IaC'da) |
| `/var/log` | Log'lar | `/var/log/syslog`, `/var/log/auth.log`, `/var/log/nginx/` | Markazlashtiriladi |
| `/var/lib` | Dastur holati | `/var/lib/postgresql`, `/var/lib/docker` | **Ha — eng muhimi** |
| `/home` | User fayllari | `/home/student/.bashrc` | Ha |
| `/usr/bin` | Dasturlar (package manager'dan) | `/usr/bin/python3` | Yo'q (paketdan qayta o'rnatiladi) |
| `/usr/local/bin` | Qo'lda o'rnatilganlar | `/usr/local/bin/terraform` | Yo'q |
| `/opt` | Mustaqil dasturlar | `/opt/app/` | Ilovaga bog'liq |
| `/tmp` | Vaqtinchalik | Hamma yozadi | Yo'q |
| `/run` | Runtime | `/run/nginx.pid`, `/run/docker.sock` | Yo'q |
| `/proc` | Process va kernel holati | `/proc/cpuinfo`, `/proc/<PID>/` | Yo'q (virtual) |
| `/sys` | Qurilmalar, kernel parametrlari | `/sys/class/net/`, `/sys/fs/cgroup/` | Yo'q (virtual) |
| `/dev` | Qurilmalar | `/dev/null`, `/dev/sda` | Yo'q |

> **Chuqurroq qarash:** DR (disaster recovery) savoliga javob — "qaysi papkalar yo'qolsa, biz ularni **qayta yarata olmaymiz**?" Odatda bu `/var/lib/<db>` va user data. `/usr` paketdan, `/etc` IaC'dan qayta yaratiladi. Backup strategiyasi shu savoldan boshlanadi.

## 5. Sozlama (config), log va ma'lumot (data) farqi

| | Config | Log | Data (state) |
|---|---|---|---|
| Kim yozadi | **Siz** (yoki IaC) | Dastur | Dastur |
| Kim o'qiydi | Dastur | **Siz** | Dastur |
| Qayerda | `/etc` | `/var/log` | `/var/lib` |
| O'zgarish | Kam, review bilan | Har soniyada | Doimiy |
| Yo'qolsa | IaC'dan tiklanadi | Tarix yo'qoladi | **Biznes yo'qotadi** |
| Strategiya | git + IaC | Rotation + markazlashtirish | Backup + replication + restore test |

> Qoida: "Sozlash kerak — `/etc`. Nima bo'ldi — `/var/log`. Qimmatli ma'lumot — `/var/lib`."

### `/etc` ichidagi kelishuvlar

```
/etc/nginx/nginx.conf              <- asosiy config (paketdan)
/etc/nginx/conf.d/*.conf           <- qo'shimcha qismlar
/etc/ssh/sshd_config.d/*.conf      <- drop-in: asosiy file'ni tahrirlamasdan override
/etc/systemd/system/x.service.d/   <- systemd drop-in
```

**Nega drop-in (`*.d/`) papkalar:** asosiy config'ni paket yangilanganda o'zgartiradi. Siz o'z sozlamangizni alohida faylga yozsangiz — paket yangilanishi uni buzmaydi va IaC vositalari uchun bitta faylni boshqarish oson.

## 6. `/proc` va `/sys` — kernel holatini ko'rsatadigan papkalar

Bu papkalar **diskda yo'q**. Ularni o'qiganingizda kernel javobni o'sha zahoti generatsiya qiladi.

```bash
cat /proc/cpuinfo | grep -c processor     # CPU soni (yoki: nproc)
cat /proc/meminfo | head -3               # RAM
cat /proc/loadavg                         # load average
ls /proc/$$/                              # joriy shell process haqida hamma narsa
cat /proc/$$/status | grep -i vm          # process memory
ls -l /proc/<PID>/cwd                     # process qaysi papkada ishlayapti
tr '\0' ' ' < /proc/<PID>/environ         # process env var'lari (secret ko'rinishi mumkin!)
cat /sys/class/net/eth0/address           # MAC address
cat /proc/sys/net/ipv4/ip_forward         # kernel parametri (sysctl)
```

- `/proc/sys/` — kernel parametrlari. Ular `sysctl` bilan o'zgartiriladi, doimiy qilish uchun `/etc/sysctl.d/*.conf`.
- `top`, `ps`, `free` kabi vositalar ma'lumotni aynan `/proc`'dan o'qiydi.

> **Container tuzog'i:** container ichida `/proc/meminfo` va `nproc` ko'pincha **host**'ning RAM va CPU'sini ko'rsatadi, cgroup limit'ini emas. Natija: JVM yoki Go runtime "64 GB bor" deb o'ylaydi, 512 MB limitda OOM bilan o'ladi. Haqiqiy limit: `/sys/fs/cgroup/memory.max`, `/sys/fs/cgroup/cpu.max` (cgroup v2). Zamonaviy runtime'lar (Java 10+, Go 1.25+ GOMAXPROCS uchun) buni o'zi hisobga oladi, eskilari — yo'q.

## 7. Disklar va ularni ulash (mount)

```bash
df -h                        # filesystem'lar va bo'sh joy
df -i                        # inode'lar
findmnt                      # mount daraxti
lsblk                        # disk'lar va partition'lar
du -sh /var/log              # papka hajmi
sudo du -xh / --max-depth=1 2>/dev/null | sort -rh | head   # nima joy egallagan
```

`/tmp` haqida faktlar:
- Ko'p distro'larda `/tmp` — `tmpfs` (RAM'da). Katta fayl yozsangiz — RAM yeydi.
- Reboot'da tozalanadi; systemd ham eski fayllarni vaqti-vaqti bilan o'chiradi (`systemd-tmpfiles`). Muhim narsani `/tmp`'da saqlamang.
- Hamma yozadi — **sticky bit** (10-11 darslar) boshqalar faylini o'chirishdan himoya qiladi.

### Amaliy holat: disk to'lib qoldi

```
 Symptom: "No space left on device", app yozolmayapti, DB to'xtadi
 1. df -h            -> qaysi filesystem to'la?
 2. df -i            -> inode'lar emasmi?
 3. du -xh ... | sort -> qaysi papka katta? (odatda /var/log, /var/lib/docker, /tmp)
 4. lsof +L1         -> o'chirilgan, lekin ochiq file'lar?
 5. Containment      -> log'ni truncate, eski artefaktlarni tozalash (docker system prune ehtiyot bilan)
 6. Root cause       -> nega o'sdi? rotation yo'qmi? debug log yoqilgan qoldimi?
 7. Prevention       -> disk alert (80%), log rotation, /var alohida disk
```

> **Tuzoq:** ext4 default bo'yicha disk'ning ~5%'ini root uchun zaxira qoldiradi. Shuning uchun oddiy user `No space` olganda, root hali yoza oladi — tizim tiklanishi uchun. `df` "100%" ko'rsatsa ham, root uchun joy bo'lishi mumkin.

## 8. O'z dasturingizni server'da qayerga joylashtirish kerak

Siz `myapp` Go servisini deploy qilyapsiz. FHS bo'yicha:

| Nima | Qayerda |
|---|---|
| Binary | `/opt/myapp/bin/myapp` yoki `/usr/local/bin/myapp` |
| Config | `/etc/myapp/config.yml` |
| Data / state | `/var/lib/myapp/` |
| Log | stdout -> journald (yoki `/var/log/myapp/`) |
| Runtime socket / PID | `/run/myapp/` |
| Cache | `/var/cache/myapp/` |

systemd buni avtomatlashtiradi: `StateDirectory=myapp`, `LogsDirectory=myapp`, `RuntimeDirectory=myapp` — papkalarni to'g'ri egasi va ruxsati bilan yaratadi (13-dars).

**Anti-usul'lar:** hammasini `/home/ubuntu/app/` ichiga qo'yish; config va data'ni binary yonida saqlash; `/tmp`'da muhim fayl.

## 9. `/dev` — maxsus qurilmalar

| Qurilma | Vazifa | Misol |
|---|---|---|
| `/dev/null` | Yozilgan hamma narsa yo'qoladi, o'qish = bo'sh | `cmd 2>/dev/null` |
| `/dev/zero` | Cheksiz nol baytlar | `dd if=/dev/zero of=f bs=1M count=100` |
| `/dev/urandom` | Kriptografik tasodifiy baytlar | `head -c 32 /dev/urandom \| base64` |
| `/dev/sda`, `/dev/nvme0n1` | Disk'lar | **`dd` bilan ehtiyot**: noto'g'ri disk = data yo'q |

## Amaliy mashg'ulot — "Xazina ovi"

Javobni buyruq bilan isbotlang:
1. Server nomi qaysi faylda?
2. SSH server config'i qayerda? Drop-in papkasi bormi?
3. Login urinishlari log'i qayerda?
4. Nechta CPU yadrosi bor? (`/proc` orqali)
5. `/var/log` qancha joy egallaydi?
6. Qaysi filesystem eng to'la? Inode'lar bo'yicha-chi?
7. `bash` dasturi qayerda? `/bin/bash` symlink'mi?
8. Root user'ning home'i qayerda?
9. Vaqt zonasi qayerda sozlangan? (`/etc/localtime` nimaga ishora qiladi?)
10. Joriy shell'ning working directory'si va env var'larini `/proc` orqali toping.
11. `/tmp` qaysi filesystem turida (`findmnt /tmp`)?

## Uy vazifa

1. FHS'ni 2x2 jadval (static/variable x umumiy/host'ga xos) ko'rinishida chizing, har katakka 2 ta real fayl.
2. Server uchun backup rejasi: qaysi papkalar backup qilinadi, qaysilari IaC'dan tiklanadi, qaysilari umuman kerak emas. Nega?
3. `myapp` uchun papkalar tuzilmasini yozing (binary, config, data, log, runtime).

## Test savollari

1. Nginx config'i va log'i qayerda?
2. `/tmp`'dagi fayllar reboot'dan keyin qoladimi? `/tmp` qayerda saqlanadi?
3. `/proc` diskda joy egallaydimi? `top` ma'lumotni qayerdan oladi?
4. Config, log va data farqi? Qaysi biri yo'qolsa eng qimmat?
5. Nega `/var` ko'pincha alohida disk'ka chiqariladi?
6. Drop-in (`*.d/`) config papkalari qaysi muammoni hal qiladi?
7. Container ichida `nproc` 64 ko'rsatyapti, limit esa 2 CPU. Nega va qanday xavf bor?
8. Disk to'ldi — tekshirish tartibi qanday?

## Ko'p uchraydigan xatolar

- App'ni `/home/user/` ichiga butunlay joylashtirish.
- Asosiy config'ni tahrirlash, drop-in o'rniga — paket yangilanishida o'zgarish yo'qoladi.
- `/tmp`'ni doimiy saqlash joyi deb ishlatish.
- Container ichida `/proc/meminfo`'ga ishonish.
- Backup'ni "hammasi"ga qilish, lekin qaysi data qayta tiklanmasligini aniqlamaslik.

## Xulosa

- FHS — tasodifiy ro'yxat emas: papkalar faylning xususiyati (static/variable, umumiy/host'ga xos) bo'yicha bo'lingan.
- `/etc` — sozlash (IaC'da), `/var/log` — tarix (markazlashtiriladi), `/var/lib` — qimmatli holat (backup + restore test).
- `/proc` va `/sys` — kernel oynasi: monitoring vositalari shu yerdan o'qiydi; container'da limit'lar cgroup'da.
- Disk to'lishi — eng ko'p uchraydigan incident: `df -h`, `df -i`, `du`, `lsof +L1`, keyin asl sabab va alert.
