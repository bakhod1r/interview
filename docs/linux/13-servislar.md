# Dars 13 — Xizmatlar (servislar, systemd)

> **Natija:** servisni boshqarish, holatini o'qish va o'z systemd unit file'ini yozish. Senior darajada: systemd nima problem'ni hal qiladi, unit'lar va dependency'lar, restart siyosati va crash loop, readiness, resource limit va sandboxing, production-grade unit file.

## 1. Problem — servisni "tirik" ushlab turish

12-darsda `nohup ./app &` anti-pattern ekanini ko'rdik. Production servisga kerak:

| Talab | `nohup` bilan |
|---|---|
| Boot'da avtomatik ishga tushish | Yo'q |
| Crash bo'lsa qayta ko'tarish | Yo'q |
| To'g'ri tartib (avval network, DB, keyin app) | Yo'q |
| Log'larni yig'ish | Tasodifiy file |
| Resurs limiti (RAM, CPU) | Yo'q |
| Xavfsizlik (alohida user, cheklangan file'lar) | Qo'lda |
| Graceful stop (SIGTERM, timeout, SIGKILL) | Qo'lda |

**systemd** — PID 1 sifatida bularning hammasini **deklarativ** tarzda beradi: siz "nima kerak"ni yozasiz, systemd "qanday"ni bajaradi.

## 2. Mental model — process vs service

| | Process | Service |
|---|---|---|
| Kim ishga tushiradi | Siz (terminaldan) | **systemd** |
| Terminal yopilsa | O'ladi | Ishlayveradi |
| Yiqilsa | O'lik qoladi | Siyosatga ko'ra qayta turadi (`Restart=`) |
| Boot'da | Yo'q | `enable` bo'lsa — ha |
| Log | Ekranga | **journal**'ga |
| Resurs | Cheklanmagan | cgroup bilan cheklangan |

```
 systemd (PID 1)
   |
   +-- har servis o'z cgroup'ida:  /system.slice/nginx.service
   |     -> barcha child process'lar shu yerda (fork qilsa ham "qochib" ketolmaydi)
   |     -> stop = cgroup'dagi HAMMA process'larga signal
   |     -> CPU/RAM limit shu cgroup'ga
   +-- stdout/stderr -> journald
```

> **Nega cgroup muhim:** eski init tizimlarida servis fork qilib "daemonize" bo'lsa, init uning child'larini yo'qotib qo'yardi. systemd cgroup orqali **hamma** process'larni kuzatadi: `systemctl stop` hech narsani qoldirmaydi.

## 3. systemctl

```bash
systemctl status nginx              # holat + oxirgi log'lar
sudo systemctl start nginx
sudo systemctl stop nginx
sudo systemctl restart nginx        # to'xtatib-yoqish (uzilish bor)
sudo systemctl reload nginx         # config'ni uzilishsiz qayta o'qish (servis qo'llasa)
sudo systemctl reload-or-restart nginx
sudo systemctl enable nginx         # boot'da yoqilsin
sudo systemctl enable --now nginx   # enable + start
sudo systemctl disable nginx
sudo systemctl mask nginx           # umuman ishga tushirib bo'lmaydigan qilish
systemctl is-active nginx           # script'lar uchun (exit code)
systemctl is-enabled nginx
systemctl list-units --type=service --state=running
systemctl --failed
systemctl cat nginx                 # unit file + drop-in'lar
systemctl show nginx -p MainPID,Restart,MemoryMax
```

> **Gotcha:** `start` != `enable`. `start` — hozir; `enable` — reboot'dan keyin. Ikkalasi kerak: `enable --now`. Ko'p incident: "reboot'dan keyin servis turmadi".

### `restart` vs `reload` — trade-off

| | restart | reload |
|---|---|---|
| Nima bo'ladi | Process o'ladi va qayta tug'iladi | Process tirik, config qayta o'qiladi (odatda `SIGHUP`) |
| Uzilish | Ha (connection'lar uziladi) | Yo'q (nginx: yangi worker'lar, eskilari tugatib chiqadi) |
| Config xato bo'lsa | Servis **turmaydi** | Eski config bilan ishlayveradi (ko'p servislarda) |
| Qachon | Binary yangilanganda, reload qo'llanmasa | Config o'zgarganda |

**Production qoidasi:** reload/restart'dan **oldin** config'ni tekshiring: `nginx -t`, `sshd -t`, `haproxy -c -f ...`. Xato config bilan restart — o'zingiz chaqirgan outage.

## 4. Status o'qish

```text
* nginx.service - A high performance web server
     Loaded: loaded (/usr/lib/systemd/system/nginx.service; enabled; preset: enabled)
     Active: active (running) since Wed 2026-10-01 10:00:00 UTC; 2h ago
   Main PID: 900 (nginx)
      Tasks: 3 (limit: 4558)
     Memory: 5.2M
        CPU: 120ms
     CGroup: /system.slice/nginx.service
             +-900 "nginx: master process"
             +-901 "nginx: worker process"
```

| Qator | Nimani aytadi |
|---|---|
| `Loaded` | Unit file qayerda, enable bo'lganmi |
| `Active` | Holat va qachondan beri (tez-tez restart bo'lsa — "since" yangi) |
| `Main PID`, `CGroup` | Qaysi process'lar |
| Pastdagi qatorlar | Oxirgi log'lar — ko'pincha xato shu yerda |

Holatlar: `active (running)`, `inactive (dead)`, `failed`, `activating (auto-restart)` — oxirgisi crash loop belgisi.

## 5. Unit file'lar — qayerda va qanday ustunlik

```
 /usr/lib/systemd/system/   <- paketdan (TAHRIRLAMANG — yangilanishda yo'qoladi)
 /etc/systemd/system/       <- sizniki (ustun turadi)
 /etc/systemd/system/x.service.d/override.conf  <- drop-in: faqat o'zgarishlar
```

```bash
sudo systemctl edit nginx          # drop-in yaratadi (8-darsdagi *.d/ g'oyasi)
sudo systemctl edit --full nginx   # to'liq nusxa (kamdan-kam kerak)
sudo systemctl daemon-reload       # unit o'zgargandan keyin SHART
```

## 6. O'z unit file'imiz: naive -> production

### Naive

```ini
[Unit]
Description=My app

[Service]
ExecStart=/opt/myapp/bin/myapp

[Install]
WantedBy=multi-user.target
```

Muammolar: root sifatida ishlaydi; crash bo'lsa turmaydi; DB'dan oldin ishga tushishi mumkin; limit yo'q.

### Production

```ini
[Unit]
Description=My Go API
Documentation=https://git.example.com/team/myapp
After=network-online.target postgresql.service
Wants=network-online.target
StartLimitIntervalSec=300
StartLimitBurst=5

[Service]
Type=exec
User=myapp
Group=myapp
WorkingDirectory=/opt/myapp
EnvironmentFile=/etc/myapp/myapp.env
ExecStartPre=/opt/myapp/bin/myapp -check-config
ExecStart=/opt/myapp/bin/myapp -config /etc/myapp/config.yml
ExecReload=/bin/kill -HUP $MAINPID

Restart=on-failure
RestartSec=5
TimeoutStopSec=30
KillSignal=SIGTERM

# Directories (8-dars) - to'g'ri egasi bilan avtomatik yaratiladi
StateDirectory=myapp
LogsDirectory=myapp
RuntimeDirectory=myapp

# Resource limits (cgroup)
MemoryMax=512M
CPUQuota=200%
LimitNOFILE=65536
TasksMax=512

# Sandboxing
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
PrivateDevices=yes
ProtectKernelTunables=yes
ProtectControlGroups=yes
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
AmbientCapabilities=CAP_NET_BIND_SERVICE
CapabilityBoundingSet=CAP_NET_BIND_SERVICE

[Install]
WantedBy=multi-user.target
```

### Muhim qarorlar — nega aynan shunday

| Direktiva | Nega |
|---|---|
| `After=` + `Wants=` | `After` — faqat **tartib**; `Wants`/`Requires` — **dependency**. Birini yozib, ikkinchisini unutish — klassik xato |
| `network-online.target` | `network.target` "network sozlanishi boshlandi" degani, IP bor degani emas |
| `Type=exec` | `simple` binary topilmasa ham "started" deydi; `exec` — exec muvaffaqiyatli bo'lgandagina. App tayyorligini bildira olsa — `Type=notify` (`sd_notify`) |
| `Restart=on-failure` | `always` — hatto toza `exit 0`'da ham qayta tushadi; ko'pincha `on-failure` to'g'riroq |
| `StartLimitBurst` | Crash loop'ni cheklash: 5 daqiqada 5 marta yiqilsa — to'xtaydi va `failed` bo'ladi (alert uchun signal) |
| `ExecStartPre` config check | Xato config bilan ishga tushmaslik |
| `TimeoutStopSec=30` | Graceful shutdown uchun vaqt (12-dars), keyin SIGKILL |
| `ProtectSystem=strict` | Butun filesystem read-only, faqat `StateDirectory` va h.k. yoziladi — buzilgan servis tizimni o'zgartira olmaydi |
| `NoNewPrivileges` | SUID orqali root'ga ko'tarilish yo'q |

```bash
systemd-analyze security myapp      # sandboxing bahosi (0 = yaxshi, 10 = himoyasiz)
systemd-analyze verify myapp.service
```

> **Trade-off:** sandboxing kuchli, lekin ortiqcha cheklov servisni "sirli" tarzda buzadi (`Read-only file system`, `Permission denied`). Bittalab qo'shing va har birini sinang.

### Restart va crash loop

```
 app crash -> 5s -> start -> crash -> 5s -> start ... (StartLimitBurst'gacha) -> failed
```

`Restart=` — **containment**, yechim emas. Agar servis har 5 soniyada qayta tug'ilayotgan bo'lsa, bu yashirin incident. Monitoring: `NRestarts` (`systemctl show -p NRestarts myapp`) yoki restart'lar soniga alert.

## 7. Timer'lar — cron'ning zamonaviy alternativasi

```ini
# /etc/systemd/system/backup.timer
[Timer]
OnCalendar=*-*-* 03:00:00
Persistent=true            # server o'chiq bo'lgan bo'lsa, yoqilganda bajariladi
RandomizedDelaySec=10m     # 100 ta server bir vaqtda backup qilmasin

[Install]
WantedBy=timers.target
```

| | cron | systemd timer |
|---|---|---|
| Log | Mail / qo'lda | journal (`journalctl -u backup`) |
| Bir vaqtda ikki marta ishlash | Mumkin (overlap) | Yo'q — servis allaqachon ishlayotgan bo'lsa |
| O'tkazib yuborilgan ish | Yo'qoladi | `Persistent=true` |
| Limit, sandbox | Yo'q | Servisdagi barcha imkoniyatlar |
| Soddalik | Bitta qator | Ikki file |

```bash
systemctl list-timers
```

## 8. Failure modes

| Symptom | Root cause | Tekshirish |
|---|---|---|
| Reboot'dan keyin servis yo'q | `enable` qilinmagan | `systemctl is-enabled` |
| Unit o'zgardi, ta'sir yo'q | `daemon-reload` unutilgan | `systemctl status` ogohlantiradi |
| `activating (auto-restart)` | Crash loop | `journalctl -u x -n 100` |
| `status=203/EXEC` | Binary topilmadi / execute bit yo'q / noto'g'ri arch | `ls -l`, `file` |
| `status=217/USER` | `User=` mavjud emas | `getent passwd` |
| `code=killed, signal=KILL` + OOM | `MemoryMax` yoki tizim OOM | `journalctl -k`, `systemctl show -p MemoryMax` |
| Servis DB'dan oldin turib, yiqiladi | Dependency yo'q | `After=`/`Wants=` va app'da retry |
| Stop 90 soniya osiladi | SIGTERM'ni ishlamaydi | App'da graceful shutdown, `TimeoutStopSec` |

> **Distributed insight:** `After=postgresql.service` faqat **shu server'dagi** DB uchun ishlaydi. DB boshqa server'da bo'lsa, systemd hech narsa kafolatlamaydi — app o'zi **retry with backoff** qilishi kerak. Dependency'lar har doim yo'q bo'lishi mumkin, deb dizayn qiling.

## Amaliy mashg'ulot

1. `sudo apt install nginx` -> `systemctl status nginx`. Brauzerda `http://<VM-IP>`.
2. `stop` -> sahifa ochilmaydi -> `start`. `systemctl cat nginx`'ni o'qing.
3. Config'ga xato kiriting, `nginx -t` bilan toping; `reload` va `restart` natijasini solishtiring (reload eski config bilan ishlayveradi).
4. `hello.service` yarating (`User=`, `Restart=on-failure`, `RestartSec=3`), ishga tushiring.
5. `kill -9 <MainPID>` -> qayta turishini kuzating; `kill <MainPID>` (TERM) bilan nima bo'lishini solishtiring — nega?
6. Crash loop: `ExecStart=/bin/false` qiling, `StartLimitBurst=3` bilan `failed` holatiga tushishini kuzating.
7. `MemoryMax=50M` qo'yib, ko'p RAM yeydigan script bilan OOM'ni ko'ring (`journalctl -u`).
8. `systemd-analyze security hello` — sandbox direktivalarini qo'shib, baho qanday o'zgarishini ko'ring.

## Uy vazifa

1. O'z script'ingiz (Python/Bash/Go) uchun production-grade unit yozing: alohida user, restart siyosati, limit, kamida 4 ta sandbox direktivasi. Reboot qiling va servis o'zi turganini isbotlang.
2. Kecha soat 03:00 da `/var/lib/myapp`'ni arxivlaydigan systemd timer yozing.
3. `After=` va `Requires=` farqini misol bilan tushuntiring.

## Test savollari

1. systemd `nohup`'ning qaysi muammolarini hal qiladi?
2. `restart` va `reload` farqi? Qaysi biri xato config'da xavfliroq?
3. `enable` nima qiladi? `mask`-chi?
4. Unit file'ni o'zgartirgandan keyin qaysi command shart?
5. Nega paket unit file'ini emas, drop-in'ni tahrirlash kerak?
6. `Restart=always` va `on-failure` farqi? Crash loop qanday cheklanadi?
7. `After=` nima kafolatlaydi va nima kafolatlamaydi?
8. `ProtectSystem=strict` nima beradi va qanday muammo chiqarishi mumkin?
9. cron o'rniga systemd timer'ning 3 ta afzalligi?

## Common mistakes

- `start` qilib, `enable` qilmaslik.
- `daemon-reload`'ni unutish.
- `/usr/lib/systemd/system/` ichidagi file'ni tahrirlash.
- Servisni root sifatida, limit'siz ishga tushirish.
- `Restart=always`'ni root cause o'rniga ishlatish va crash loop'ni sezmaslik.
- Config tekshirmasdan restart.
- `After=` yozib, `Wants=`/`Requires=`'ni unutish.

## Senior xulosa

- systemd — server'ning dispetcheri: boot tartibi, restart, log, cgroup limit va sandbox — hammasi deklarativ.
- Servis = o'z cgroup'idagi process'lar to'plami: stop hech narsani qoldirmaydi, limit hammaga qo'llanadi.
- Production unit: alohida user, `Restart=on-failure` + crash loop limiti, graceful stop, resource limit, sandboxing.
- `restart` vs `reload` va config check — o'z-o'zidan yaratilgan outage'larning oldini oladi.
- `After=` faqat lokal tartib; tarmoqdagi dependency'lar uchun app'da retry kerak.
