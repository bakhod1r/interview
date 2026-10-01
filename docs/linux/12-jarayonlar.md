# Dars 12 — Jarayonlar (process)

> **Natija:** ishlayotgan process'larni ko'rish, resurs yeyayotganini topish, to'g'ri signal bilan to'xtatish. Senior darajada: process qanday tug'iladi (fork/exec), holatlar va load average'ning haqiqiy ma'nosi, RSS va VSZ, zombie va orphan, graceful shutdown, PID 1 muammosi container'da.

## 1. Problem — server'da "nimadir sekin"

Incident: sayt sekin, CPU 100%. Savollar:
- Qaysi process CPU'ni yeyapti?
- U nima qilyapti — hisoblayaptimi yoki disk/network'ni kutyaptimi?
- Uni qanday to'xtatish kerakki, data buzilmasin?

Bularga javob berish uchun process modelini tushunish kerak.

## 2. Mental model — dastur vs process

**Dastur** — diskdagi file (`/usr/bin/nginx`). **Process** — kernel'dagi ishlayotgan nusxa: o'z virtual memory'si, ochiq file'lari, identity'si (UID), holati.

```
 Process = {
   PID, PPID                 kim, kimning bolasi
   UID/GID                   kim nomidan (ruxsatlar uchun)
   virtual memory            code, heap, stack, mmap
   file descriptor'lar       0,1,2 + ochiq file/socket'lar
   working directory, env    meros olingan
   holat                     R, S, D, Z, T
 }
```

Hammasini ko'rish mumkin: `ls /proc/<PID>/` (8-dars).

## 3. Process qanday tug'iladi — fork + exec

```
 bash (PID 1452)
   |
   | fork()  -> o'zining nusxasi (PID 1600), copy-on-write memory
   v
 bash (PID 1600)
   |
   | exec("/usr/bin/top")  -> o'zini top bilan almashtiradi (PID o'sha)
   v
 top (PID 1600)            bash (1452) wait() bilan kutadi
```

- Child ota'dan meros oladi: env var'lar, ochiq fd'lar, working directory, UID.
- Shuning uchun `export` qilingan o'zgaruvchi child'ga o'tadi (15-dars), ochiq file child'da ham ochiq qoladi.

### Daraxt va PID 1

```
systemd (1)
+-- sshd (812)
|   +-- sshd (1450) -- bash (1452) -- top (1600)
+-- nginx (900)          <- master: root, port 80'ni ochadi
    +-- nginx (901)      <- worker: www-data, so'rovlarni bajaradi
    +-- nginx (902)
```

```bash
pstree -p
echo $$          # joriy shell PID
ps -o pid,ppid,user,cmd -p $$
```

**PID 1** (`systemd`) maxsus: u o'lsa — kernel panic. U **orphan**'larni (otasi o'lgan process'lar) asrab oladi va ularning tugashini kutib "tozalaydi".

## 4. Ko'rish

```bash
ps aux                          # hammasi (BSD uslub)
ps -ef                          # hammasi (UNIX uslub), PPID bilan
ps aux --sort=-%mem | head      # eng ko'p RAM
ps aux --sort=-%cpu | head      # eng ko'p CPU
ps -eo pid,ppid,user,stat,etime,rss,cmd --sort=-rss | head
pgrep -a nginx                  # nom bo'yicha PID
top / htop                      # jonli
```

`top` ichida: `P` — CPU, `M` — RAM, `1` — har CPU alohida, `k` — kill, `q` — chiqish.

### Holatlar (STAT)

| Holat | Ma'no | Nimani bildiradi |
|---|---|---|
| `R` | Running / runnable | CPU'da yoki navbatda |
| `S` | Interruptible sleep | Nimanidir kutyapti (network, timer) — normal |
| `D` | **Uninterruptible sleep** | Odatda disk/NFS I/O kutyapti; **signal'ga javob bermaydi**, `kill -9` ham |
| `Z` | Zombie | Tugagan, lekin ota exit code'ni olmagan |
| `T` | Stopped | `Ctrl+Z` yoki debugger |

> **Debugging signali:** ko'p process `D` holatida — muammo CPU'da emas, **storage**'da (sekin disk, osilib qolgan NFS). `kill -9` yordam bermaydi — I/O tugashi yoki storage tiklanishi kerak.

### Memory: VSZ va RSS

| Ustun | Ma'no | Tuzoq |
|---|---|---|
| `VSZ` | Virtual memory hajmi (rezerv qilingan) | Juda katta bo'lishi normal (Go, Java) — haqiqiy iste'mol emas |
| `RSS` | Hozir RAM'da turgan qism | Shared kutubxonalar har process'da sanaladi — yig'indisi > haqiqiy RAM |

Aniqroq: `PSS` (shared qism bo'lingan) — `smem` yoki `/proc/<PID>/smaps_rollup`. Container'da esa cgroup'ning `memory.current`.

### Load average — ko'p noto'g'ri tushuniladi

```bash
uptime      # load average: 3.20, 2.10, 1.05   (1, 5, 15 daqiqa)
nproc       # 4
```

- Load = **R + D** holatidagi process'larning o'rtacha soni (Linux'da D ham kiradi!).
- Taqqoslang: CPU soni bilan. 4 CPU'da load 4 — to'la band; 8 — navbat bor.
- Load yuqori, lekin CPU bo'sh -> ko'p process `D`'da -> **I/O muammosi**.
- 1 > 5 > 15 — yuklama o'syapti; 1 < 15 — pasaymoqda.

### CPU vaqti qayerga ketyapti (`top` sarlavhasi)

| Ko'rsatkich | Ma'no | Yuqori bo'lsa |
|---|---|---|
| `us` | User space kodi | App hisoblayapti — profiling |
| `sy` | Kernel | Ko'p syscall, context switch |
| `wa` | I/O kutish | Disk sekin |
| `st` | Steal | Cloud'da qo'shni VM CPU'ni olyapti |

## 5. Signallar — process bilan gaplashish

| Signal | Raqam | Ma'no | Tutib olsa bo'ladimi |
|---|---|---|---|
| `SIGTERM` | 15 | "Iltimos, toza to'xta" — `kill` default | Ha |
| `SIGINT` | 2 | `Ctrl+C` | Ha |
| `SIGHUP` | 1 | Terminal yopildi / ko'p daemon'larda "config'ni qayta o'qi" | Ha |
| `SIGKILL` | 9 | Kernel darhol o'ldiradi | **Yo'q** |
| `SIGSTOP` | 19 | Pauza | **Yo'q** |
| `SIGTSTP` | 20 | `Ctrl+Z` | Ha |
| `SIGCHLD` | 17 | Child tugadi (otaga) | Ha |

```bash
kill 1234            # SIGTERM
kill -HUP 900        # nginx: config'ni qayta o'qi
kill -9 1234         # SIGKILL — oxirgi chora
pkill -f "python worker.py"   # to'liq command line bo'yicha
```

### Graceful shutdown — nega SIGTERM birinchi

```
 SIGTERM qabul qilindi
   1. Yangi so'rovlarni qabul qilishni to'xtat (listener yopiladi)
   2. Ishlanayotgan so'rovlarni tugat (timeout bilan)
   3. Buffer'larni flush qil, DB transaction'larni yakunla
   4. Connection'larni yop, exit 0
```

`SIGKILL` bilan bularning hech biri bo'lmaydi: yarim yozilgan file, uzilgan so'rovlar, DB'da yakunlanmagan ish (DB o'zi WAL bilan tiklanadi, lekin app darajasidagi ish yo'qoladi).

**Qoida:** `SIGTERM` -> kutish (10–30 s) -> keyin `SIGKILL`. systemd va Kubernetes aynan shunday qiladi (`TimeoutStopSec`, `terminationGracePeriodSeconds`).

### Go'da graceful shutdown

```go
ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
defer stop()

srv := &http.Server{Addr: ":8080", Handler: mux}
go func() {
    if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
        log.Fatal(err)
    }
}()

<-ctx.Done()                                         // signal keldi
shutdownCtx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
defer cancel()
if err := srv.Shutdown(shutdownCtx); err != nil {    // yangi so'rov yo'q, eskilarni tugatadi
    log.Printf("shutdown: %v", err)
}
```

## 6. Zombie va orphan

```
 Zombie:  child tugadi -> exit code'ini saqlash uchun process jadvalida qoladi
          ota wait() chaqirmaguncha "Z" holatida turadi
 Orphan:  ota child'dan oldin o'ldi -> child'ni PID 1 asrab oladi
```

- Zombie allaqachon o'lik — `kill -9` unga ta'sir qilmaydi. U faqat PID raqamini band qiladi.
- Bir nechta zombie — muammo emas. **Minglab** zombie — otadagi bug (wait qilmayapti) va PID'lar tugashi mumkin.
- Yechim: **otani** tuzatish yoki o'ldirish — shunda zombie'larni PID 1 oladi va tozalaydi.

```bash
ps -eo pid,ppid,stat,cmd | awk '$3 ~ /Z/'    # zombie'lar va ularning otasi (PPID)
```

### Container'da PID 1 muammosi

Container ichida sizning app'ingiz **PID 1** bo'ladi. Natijalar:
1. Kernel PID 1'ga default signal handler'larni qo'llamaydi: app `SIGTERM`'ni o'zi tutmasa — **hech narsa bo'lmaydi**. `docker stop` 10 s kutadi, keyin `SIGKILL`. Graceful shutdown yo'q.
2. App zombie'larni tozalamaydi (u init emas) — child process ishlatsa, zombie'lar to'planadi.

Yechim: kichik init — `docker run --init` (tini), yoki app'da signal'larni to'g'ri ishlash. Va Dockerfile'da **exec form**: `CMD ["./app"]`, `CMD ./app` emas — aks holda PID 1 `sh` bo'ladi va signal'ni app'ga uzatmaydi.

## 7. Foreground / background va terminaldan ajratish

```bash
sleep 300 &          # fonda
jobs                 # shu shell'ning fon vazifalari
fg %1                # oldinga
Ctrl+Z  ->  bg       # pauza -> fonda davom
nohup ./long.sh > out.log 2>&1 &   # SIGHUP'ni e'tiborsiz qoldiradi
```

**Problem:** SSH uzilsa, terminal'dagi process'lar `SIGHUP` oladi va o'ladi.

| Yechim | Qachon |
|---|---|
| `nohup ... &` | Bir martalik, tez |
| `tmux` / `screen` | Interaktiv ish, qayta ulanish kerak (migration, uzun operatsiya) |
| **systemd servis / `systemd-run`** | Doimiy yoki muhim ish — restart, log, limit bilan (13-dars) |

> **Anti-pattern:** production servisni `nohup ./app &` bilan ishga tushirish. Server reboot bo'lsa — yo'q; crash bo'lsa — hech kim qayta ko'tarmaydi; log'lar tasodifiy file'da.

## 8. Resurslarni cheklash va ustuvorlik

```bash
nice -n 10 ./backup.sh          # past CPU ustuvorligi (-20 yuqori ... 19 past)
renice 15 -p 1234
ionice -c3 tar czf ...          # faqat disk bo'sh bo'lganda I/O
ulimit -n                       # ochiq file limiti (Too many open files)
cat /proc/1234/limits
```

Masshtabda: cgroups (systemd `CPUQuota=`, `MemoryMax=`; Kubernetes `requests/limits`).

## 9. Debugging algoritmi: "server sekin"

```
 1. uptime            -> load vs nproc; o'syaptimi?
 2. top               -> us / sy / wa / st qaysi biri yuqori?
 3. Kim?              -> ps --sort=-%cpu / -rss
 4. Nima qilyapti?    -> holat (R/S/D); strace -p (qisqa!); ls -l /proc/PID/fd
 5. Memory?           -> free -h, dmesg | grep -i oom
 6. I/O?              -> iostat -x 1, iotop
 7. Hypothesis -> tekshirish -> minimal fix -> monitoring bilan tasdiqlash
```

**Symptom vs root cause:** "CPU 100%" — symptom. Root cause: cheksiz loop, regex backtracking, GC bosimi, cache yo'qligi sababli qayta hisoblash. `kill` symptom'ni yo'qotadi, root cause qaytib keladi. Kill'dan oldin **dalil yig'ing**: `top` snapshot, `strace -c`, Go uchun `pprof`, Java uchun thread dump.

## Amaliy mashg'ulot

1. `yes > /dev/null &` ni 2 marta ishga tushiring. `top`'da toping, `1` bilan CPU'lar bo'yicha ko'ring.
2. Birini `kill`, ikkinchisini `pkill yes` bilan to'xtating.
3. `sleep 1000`'ni `Ctrl+Z` -> `bg` -> `fg` bilan boshqaring.
4. `pstree -p`'da o'z shell'ingizni toping; `ls -l /proc/$$/fd`.
5. Signal'ni tutish: `trap 'echo "TERM oldim, tozalayapman"; exit 0' TERM; while true; do sleep 1; done` — boshqa terminaldan `kill`, keyin `kill -9` bilan sinab, farqni ko'ring.
6. Zombie yaratish: `python3 -c "import os,time; os.fork() or os._exit(0); time.sleep(120)" &` — `ps`'da `Z`'ni toping, otasini o'ldiring va zombie yo'qolishini kuzating.
7. Load: `dd if=/dev/zero of=/tmp/f bs=1M count=3000 oflag=direct` ishlayotganda `top`'da `wa` va `D` holatini kuzating.

## Uy vazifa

1. Zombie nima, nega `kill -9` uni o'ldirmaydi va qanday tozalanadi — 5 gapda.
2. Go (yoki tanlagan tilingiz) servisi uchun graceful shutdown yozing va `kill` bilan sinang: ishlanayotgan so'rov tugashini isbotlang.
3. Dockerfile'da `CMD ./app` va `CMD ["./app"]` farqini signal nuqtai nazaridan tushuntiring.

## Test savollari

1. Dastur va process farqi? fork va exec nima qiladi?
2. PID 1 kim va nima uchun maxsus?
3. `kill` va `kill -9` farqi? Nega darhol `-9` yomon?
4. `D` holati nimani bildiradi va nega `kill -9` ishlamaydi?
5. Load average 8, 4 ta CPU, lekin CPU 10% band — nima bo'lyapti?
6. VSZ va RSS farqi? Nega RSS yig'indisi RAM'dan oshishi mumkin?
7. Container'da app `docker stop`'ga 10 soniya javob bermaydi — nega?
8. Nega production servisni `nohup` bilan ishga tushirmaslik kerak?

## Common mistakes

- Darhol `kill -9`.
- Load average'ni CPU foizi deb o'qish.
- VSZ'ga qarab "memory leak" deb vahima.
- Zombie'ni o'ldirishga urinish, otaga qaramaslik.
- Container'da shell form CMD va signal ishlamasligi.
- Kill'dan oldin dalil yig'masdan root cause'ni yo'qotish.

## Senior xulosa

- Process = kernel'dagi ishlayotgan dastur: PID, UID, memory, fd'lar, holat. U fork + exec bilan tug'iladi va ko'p narsani ota'dan meros oladi.
- Holatlar va `top` ko'rsatkichlari muammo **qayerda** ekanini aytadi: CPU (`us/sy`), disk (`wa`, `D`), qo'shni (`st`).
- To'xtatish — avval `SIGTERM` va graceful shutdown, keyin `SIGKILL`. App signal'ni to'g'ri ishlashi kerak, ayniqsa container'da PID 1 sifatida.
- Zombie — otaning bug'i. Orphan — PID 1 asraydi.
- Muhim ish — `nohup` emas, systemd. Kill'dan oldin — dalil.
