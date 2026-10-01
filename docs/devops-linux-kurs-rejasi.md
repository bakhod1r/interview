# DevOps Foundations: Linux — 18 darslik kurs rejasi

> **Kurs maqsadi:** 18 darsdan keyin talaba bo'sh Linux serverga SSH orqali kiradi, foydalanuvchi va ruxsatlarni sozlaydi, servisni o'rnatib ishga tushiradi, logdan xatoni topadi va fayllarni xavfsiz ko'chiradi. Ya'ni — Junior DevOps'ning birinchi ish haftasiga tayyor.

## 1. Kurs falsafasi

| Tamoyil | Amalda nima degani |
|---|---|
| **Muammodan nazariyaga** | Har dars real xato bilan boshlanadi (`Permission denied`, `command not found`, servis yiqilgan). Keyin tushuntiriladi. |
| **20 / 60 / 20** | 20% nazariya, 60% terminalda qo'l bilan ishlash, 20% xulosa + savol-javob. |
| **Bitta server — butun kurs** | Talaba 3-darsda o'rnatgan VM 18-dargacha yashaydi. Har dars unga yangi qatlam qo'shadi. |
| **Xato — o'qituvchi** | Har darsda ataylab "buzish" mashqi: talaba xatoni o'zi chiqaradi va o'zi tuzatadi. |
| **Spiral takrorlash** | Oldingi darsdagi buyruqlar keyingi darsda yangi kontekstda qayta ishlatiladi (`grep` → loglarda, `chmod` → SSH kalitlarida). |

## 2. Kurs xaritasi

```
 1-bo'lim  KIRISH & MUHIT        [1]──[2]──[3]──[4]      "Server qayerda va qanday gaplashaman?"
                                            │
 2-bo'lim  TERMINAL & FAYLLAR    [5]──[6]──[7]──[8]      "Fayllarni topaman, o'qiyman"
                                            │
 3-bo'lim  USER & RUXSATLAR      [9]──[10]──[11]         "Kim nimaga kira oladi?"
                                            │
 4-bo'lim  PROCESS, SERVIS, LOG  [12]──[13]──[14]──[15]  "Nima ishlayapti va nega yiqildi?"
                                            │
 5-bo'lim  PAKET & SSH           [16]──[17]──[18]        "Masofadan boshqaraman"
                                            │
                                     ★ YAKUNIY LOYIHA
```

**Dars formati (90 daqiqa):**

| Vaqt | Bosqich |
|---|---|
| 0–10 | Hook: real muammo / savol |
| 10–30 | Nazariya + diagramma |
| 30–75 | Live demo → talaba mashqi (pair) |
| 75–85 | "Buzib-tuzat" challenge |
| 85–90 | Xulosa, uy vazifa, test havolasi |

## 3. 1-bo'lim — Kirish & muhitni sozlash (1–4)

### Dars 1 — Kirish, tanishuv, DevOps nima
- **Natija:** talaba DevOps'ni bir gap bilan tushuntira oladi va dasturchi/server farqini biladi.
- **Reja:** kurs qoidalari → DevOps sikli (Plan → Code → Build → Test → Release → Deploy → Operate → Monitor) → real kompaniyada bir kunlik ish → dasturchi kodi serverga qanday yetib boradi.
- **Amaliy:** "Saytga kirganda nima bo'ladi?" — doskada brauzer → DNS → server → app → DB zanjirini birga chizish.
- **Uy vazifa:** 3 ta DevOps vakansiyasini o'qib, eng ko'p uchragan 10 ta texnologiyani yozish.
- **Test g'oyasi:** DevOps — kasbmi yoki madaniyatmi? Operate bosqichiga nima kiradi?

### Dars 2 — Linux tarixi va arxitekturasi
- **Natija:** kernel va user space chegarasini tushunadi.
- **Reja:** Unix → GNU → Linus (1991) → distributivlar oilasi (Debian/Ubuntu, RHEL/Rocky) → arxitektura.

```
 ┌───────────── User space ─────────────┐
 │  bash   nginx   python   systemd     │
 └──────────────┬───────────────────────┘
        system call (open, read, fork)
 ┌──────────────▼───── Kernel ──────────┐
 │ process · memory · FS · network · drv│
 └──────────────┬───────────────────────┘
            Hardware (CPU, RAM, Disk, NIC)
```

- **Linux vs Windows:** litsenziya, CLI-first, resurs sarfi, avtomatlashtirish, serverlarning ~90%+ Linux.
- **Uy vazifa:** 5 ta distributivni jadvalda solishtirish (paket menejer, kompaniya, qayerda ishlatiladi).

### Dars 3 — Linux o'rnatish (VM / WSL)
- **Natija:** har bir talabada ishlaydigan Ubuntu Server 24.04 LTS.
- **Reja:** virtualizatsiya (hypervisor, host/guest) → image tanlash (Server vs Desktop, LTS nima) → o'rnatish (VirtualBox / UTM / WSL2) → snapshot olish.
- **Amaliy:** o'rnatish + **birinchi snapshot** ("toza holat") — butun kurs davomida qutqaruvchi.
- **Diqqat:** Apple Silicon → UTM + ARM image; Windows → WSL2 yoki VirtualBox.

### Dars 4 — Terminal, man, --help
- **Natija:** notanish buyruqni o'zi o'rgana oladi.
- **Buyruq anatomiyasi:** `buyruq  -opsiya  --uzun-opsiya  argument` → misol: `ls -l --human-readable /etc`.
- **Reja:** terminal/shell/console farqi → `man`, `--help`, `type`, `which` → xato xabarini o'qish.
- **Amaliy:** "Detektiv" — 5 ta notanish buyruq (`wc`, `sort`, `uniq`, `date`, `cal`) faqat `man` orqali o'rganiladi.
- **Oltin qoida:** xato xabari — dushman emas, yo'l ko'rsatkich.

## 4. 2-bo'lim — Terminal va fayllar (5–8)

### Dars 5 — Navigatsiya
- **Buyruqlar:** `pwd`, `ls -la`, `cd`, `cd -`, `cd ~`, `mkdir -p`, `touch`, `cp`, `mv`.
- **Kalit tushuncha:** absolute (`/etc/nginx`) vs relative (`../logs`) yo'l; `.` va `..`.
- **Buzib-tuzat:** `cd /etc/ngnix` → `No such file or directory` — Tab avtoto'ldirish bilan yechish.

### Dars 6 — Fayl o'qish
- **Buyruqlar:** `cat`, `less` (`/qidiruv`, `q`), `head -n`, `tail -n`, **`tail -f`**.
- **Qachon qaysi:** kichik fayl → `cat`; katta fayl → `less`; jonli log → `tail -f`.
- **Amaliy:** `/var/log/syslog`ni `tail -f` bilan kuzatib, ikkinchi terminalda `logger "salom"` yozish.

### Dars 7 — Qidirish
- **grep:** `-i`, `-r`, `-n`, `-v`, `-c`, `-E` → `grep -rin "error" /var/log`.
- **find:** `find / -name "*.conf" -type f -size +1M -mtime -7 2>/dev/null`.
- **Pipe kuchi:** `cat access.log | grep 500 | wc -l`.
- **Amaliy:** tayyor `access.log` fayli — eng ko'p 404 bergan URL'ni topish (`grep | awk | sort | uniq -c | sort -nr | head`).

### Dars 8 — Fayl tizimi va yo'llar (FHS)

| Papka | Nima turadi | Real misol |
|---|---|---|
| `/etc` | konfiguratsiya | `/etc/nginx/nginx.conf` |
| `/var/log` | loglar | `/var/log/auth.log` |
| `/home` | foydalanuvchilar | `/home/ali` |
| `/usr/bin` | dasturlar | `/usr/bin/python3` |
| `/tmp` | vaqtinchalik | rebootda o'chadi |
| `/proc` | kernel ma'lumoti | `/proc/cpuinfo` |

- **Config vs log:** config — siz yozasiz, dastur o'qiydi; log — dastur yozadi, siz o'qiysiz.
- **Amaliy:** "Xazina ovi" — 10 ta savol ("hostname qayerda saqlanadi?", "SSH loglari qayerda?").

## 5. 3-bo'lim — Foydalanuvchi va ruxsatlar (9–11)

### Dars 9 — User va group
- **Buyruqlar:** `whoami`, `id`, `groups`, `useradd -m -s /bin/bash`, `passwd`, `usermod -aG`, `groupadd`.
- **Fayllar:** `/etc/passwd`, `/etc/shadow`, `/etc/group` — har bir maydonni o'qish.
- **Serverda kim ishlaydi:** `root`, odam userlar, servis userlar (`www-data`, `postgres`) — nega servis root bo'lmasligi kerak.
- **Amaliy:** `dev` group + `ali`, `vali` userlarini yaratish.

### Dars 10 — Ruxsatlar

```
 -rwxr-x---  1 ali dev  script.sh
 │└┬┘└┬┘└┬┘
 │ │  │  └── other : ---  = 0
 │ │  └───── group : r-x  = 5
 │ └──────── owner : rwx  = 7     → chmod 750
 └────────── tur: - fayl, d papka, l link
```

- **Papka uchun rwx boshqacha:** `r` — ro'yxat, `w` — yaratish/o'chirish, `x` — ichiga kirish.
- **chmod:** symbolic (`u+x`, `g-w`, `o=`) va octal (`644`, `755`, `600`).
- **Buzib-tuzat:** `./deploy.sh` → `Permission denied` → `chmod +x`.

### Dars 11 — Egalik va sudo
- **Buyruqlar:** `chown user:group`, `chown -R`, `chgrp`, `sudo`, `sudo -i`, `visudo`.
- **Xavfsizlik:** least privilege tamoyili, nega `chmod 777` — xato, nega root bilan to'g'ridan-to'g'ri ishlamaymiz, `/var/log/auth.log`da sudo izlari.
- **Amaliy:** `/srv/project` papkasi — faqat `dev` group yoza oladi, boshqalar faqat o'qiydi.

## 6. 4-bo'lim — Jarayonlar, servis, log (12–15)

### Dars 12 — Jarayonlar
- **Buyruqlar:** `ps aux`, `ps -ef`, `top`/`htop`, `pgrep`, `kill`, `kill -9`, `&`, `jobs`, `fg`, `bg`.
- **Kalit tushunchalar:** PID, PPID, process daraxti (`pstree`), signallar: `SIGTERM (15)` — muloyim, `SIGKILL (9)` — majburiy.
- **Amaliy:** `yes > /dev/null &` bilan CPU'ni yuklash → `top`da topish → to'xtatish.

### Dars 13 — Servislar
- **Process vs service:** service — systemd boshqaradigan, avtomatik qayta turadigan, bootda ishga tushadigan process.
- **Buyruqlar:** `systemctl status|start|stop|restart|reload|enable|disable`, `systemctl list-units --type=service`.
- **Amaliy:** `nginx` o'rnatish → ishga tushirish → brauzerda ochish → o'z unit faylimizni yozish (`/etc/systemd/system/hello.service`).

### Dars 14 — Loglar
- **Joylar:** `/var/log/syslog`, `auth.log`, `nginx/access.log`, `nginx/error.log`.
- **journalctl:** `-u nginx`, `-f`, `--since "1 hour ago"`, `-p err`, `-b`.
- **Debug algoritmi:** `status` → `journalctl -u` → config tekshirish (`nginx -t`) → tuzatish → `restart`.
- **Buzib-tuzat:** nginx configda ataylab `;` o'chiriladi — talaba logdan topadi.

### Dars 15 — Muhit o'zgaruvchilari
- **Buyruqlar:** `env`, `printenv`, `echo $HOME`, `export VAR=...`, `unset`.
- **PATH:** shell buyruqni qayerdan qidiradi; `command not found` sababi.
- **Doimiylik:** `~/.bashrc`, `/etc/environment`; `source`.
- **Amaliy:** `~/bin` papkasiga o'z skriptini qo'yib, PATH'ga qo'shish. Secretlarni kodga yozmaslik — env orqali berish.

## 7. 5-bo'lim — Paketlar va SSH (16–18)

### Dars 16 — Paket menejeri
- **Tushunchalar:** paket, repository, dependency, `.deb` vs `.rpm`.
- **apt:** `update` vs `upgrade` farqi, `install`, `remove`, `purge`, `search`, `show`, `autoremove`.
- **yum/dnf:** bir xil amallarning RHEL ekvivalenti — solishtirma jadval.
- **Amaliy:** `htop`, `tree`, `curl` o'rnatish; `apt update` qilmasdan install xatosini ko'rish.

### Dars 17 — OpenSSH server

```
 Client (laptop)                         Server (VM)
 ~/.ssh/id_ed25519      ── ulanish ──▶   sshd :22
 ~/.ssh/id_ed25519.pub  ── nusxa ────▶   ~/.ssh/authorized_keys
```

- **Reja:** `openssh-server` o'rnatish → parol bilan login → `ssh-keygen -t ed25519` → `ssh-copy-id` → kalit bilan login.
- **Xavfsizlik (`/etc/ssh/sshd_config`):** `PermitRootLogin no`, `PasswordAuthentication no`, port, `fail2ban` haqida tushuncha.
- **Gotcha:** `~/.ssh` = `700`, `authorized_keys` = `600` — aks holda kalit ishlamaydi (10-dars bilan bog'lanish).

### Dars 18 — SCP, Rsync, FileZilla

| Vosita | Qachon |
|---|---|
| `scp` | bitta fayl, tez |
| `rsync -avz --progress` | katta papka, faqat o'zgarganini yuboradi, uzilsa davom etadi |
| FileZilla (SFTP) | GUI kerak bo'lganda |

- **Amaliy:** local → remote (`scp app.tar.gz user@ip:/srv/`), remote → local (logni yuklab olish), `rsync` bilan sayt papkasini sinxronlash.
- **Gotcha:** `rsync src/` vs `rsync src` — oxiridagi `/` natijani o'zgartiradi.

## 8. Yakuniy loyiha — "Mening birinchi serverim"

Talaba toza VM'da quyidagini bajaradi va himoya qiladi:

1. `deploy` user + `web` group yaratish, sudo huquqi berish.
2. SSH: faqat kalit bilan, root login o'chirilgan.
3. `nginx` o'rnatish, `enable` qilish.
4. Local'dagi statik saytni `rsync` bilan `/var/www/site`ga yuklash, to'g'ri owner/ruxsatlar.
5. Ataylab buzilgan configni `journalctl` orqali topib tuzatish.
6. `~/bin/health.sh` — nginx holati, disk joyi, oxirgi 5 ta xatoni chiqaradigan skript, PATH'da.

**Baholash:** ishlashi 40% · xavfsizlik 25% · debug jarayonini tushuntirish 25% · tozalik 10%.

## 9. Baholash tizimi

| Komponent | Ulush |
|---|---|
| Har dars testi (18 ta) | 20% |
| Uy vazifalar | 30% |
| Faollik + "buzib-tuzat" | 10% |
| Yakuniy loyiha | 40% |

## 10. O'qituvchi uchun checklist (har dars oldidan)

- [ ] Snapshot'dan toza VM tayyor, demo komandalar sinab ko'rilgan
- [ ] "Buzib-tuzat" senariysi tayyor
- [ ] Dars ma'lumotlari, amaliy, uy vazifa, video, test, LMS havolalari jadvalda to'ldirilgan
- [ ] Oldingi darsdan 2 ta takrorlash savoli
- [ ] Cheat sheet (1 sahifa) talabalarga tarqatilgan

## 11. Keyingi bosqich (kursdan keyin)

Bash scripting → Git → Networking (IP, DNS, firewall) → Docker → CI/CD → Kubernetes → Monitoring. Bu kurs — shu zinapoyaning birinchi pog'onasi.
