# Dars 2 — Linux tarixi va arxitekturasi

> **Natija:** kernel va user space chegarasini, system call qanday ishlashini, kernel module'larni va container'lar Linux kernel ustida qanday qurilganini tushunish. Darsdan keyin javob bera olasiz: "Nega container VM emas?", "Process qotib qoldi — ichida nima bo'layotganini qanday bilaman?", "Nega Alpine image'da binary ishlamayapti?"

## 1. Problem — OS nima uchun kerak?

Tasavvur qiling, OS yo'q. Har bir dastur:
- disk'ka yozish uchun disk controller'ning registrlarini o'zi boshqaradi;
- boshqa dasturning memory'sini bemalol o'qiydi va buzadi;
- CPU'ni egallab olsa, boshqalar hech qachon ishlamaydi.

**OS kernel'i hal qiladigan 3 ta problem:**

| Problem | Kernel yechimi |
|---|---|
| Hardware har xil, murakkab | **Abstraction**: hamma disk uchun bitta `read()` / `write()` |
| Dasturlar bir-birini buzadi | **Isolation**: har process o'z virtual memory'sida |
| Resurs cheklangan (CPU, RAM) | **Scheduling / sharing**: kernel kim qachon ishlashini hal qiladi |

Bu uchtasini yodda tuting — Linux'dagi deyarli hamma narsa (process, file, container, cgroups) shularning biriga xizmat qiladi.

## 2. Qisqa tarix — nega Linux aynan shunday

```
1969  Unix (Bell Labs) — "everything is a file", kichik tool'lar + pipe
1983  GNU (Stallman) — bepul Unix-like userland: gcc, bash, coreutils
1991  Linus Torvalds — Linux kernel (hobby project)
1992  GNU userland + Linux kernel = to'liq bepul OS (GPL litsenziya)
2006  Google'dan cgroups (resurs limit) -> 2008 kernel'ga kiradi
2013  namespaces to'liq (user ns) -> Docker paydo bo'ladi
2014  Kubernetes; bugun cloud'dagi server'larning katta qismi Linux
```

**Unix falsafasi** — bugun ham amalda:
1. Bitta tool bitta ishni yaxshi qiladi (`grep`, `sort`, `wc`).
2. Tool'lar **text stream** va **pipe** orqali birlashadi.
3. Hamma narsa file: disk, terminal, process ma'lumoti (`/proc`), hatto socket.

> **Nega bu muhim:** DevOps automation shu falsafaga tayanadi. Config — text file, log — text stream, tool'lar pipe bilan ulanadi. Shuning uchun Linux'ni avtomatlashtirish oson.

## 3. Linux — bu kernel, distribution — to'plam

**Distribution** = Linux kernel + userland (GNU coreutils, shell) + **libc** + package manager + init system.

| Family | Distro | Package | libc | Init | Qayerda |
|---|---|---|---|---|---|
| Debian | Debian, **Ubuntu** | `apt` / `.deb` | glibc | systemd | Cloud, startup |
| Red Hat | RHEL, Rocky, Alma | `dnf` / `.rpm` | glibc | systemd | Enterprise, bank |
| Alpine | Alpine | `apk` | **musl** | OpenRC | Docker image (~5MB) |
| Minimal | distroless, scratch | yo'q | glibc / yo'q | yo'q | Production container |

### Senior gotcha: glibc vs musl

**libc** — user space dasturi bilan kernel o'rtasidagi kutubxona (`printf`, `malloc`, DNS resolve, syscall wrapper'lar).

- glibc uchun compile qilingan binary musl'da ishlamaydi: `not found` xatosi chiqadi, garchi file mavjud bo'lsa ham (dynamic loader topilmaydi).
- Python wheel'lar Alpine'da ko'pincha source'dan compile bo'ladi: build sekin, image katta.
- musl'ning DNS resolver va `malloc` xatti-harakati glibc'dan farq qiladi — ba'zi app'lar sekinroq.

**Decision criteria:**
- Go binary (`CGO_ENABLED=0`) — static, libc kerak emas: `scratch` yoki distroless eng yaxshi.
- Python/Java/Node — Debian-slim yoki distroless (glibc): kamroq sirpriz.
- Alpine — kichik o'lcham muhim va musl bilan muammo yo'qligi tekshirilgan bo'lsa.

## 4. Arxitektura — mental model

```
 +------------------- User space (CPU ring 3) --------------------+
 |  bash   nginx   python   systemd     glibc (syscall wrapper)    |
 |  har process: o'z virtual memory'si, to'g'ridan-to'g'ri         |
 |  hardware'ga kira olmaydi                                       |
 +--------------------------------+--------------------------------+
                                  |
          system call: open, read, write, fork, execve, mmap
                                  |
 +--------------------------------v---- Kernel space (ring 0) -----+
 | scheduler | memory mgmt | VFS | network stack | device drivers  |
 | namespaces | cgroups | LSM (SELinux / AppArmor) | eBPF          |
 +--------------------------------+--------------------------------+
                                  |
                   Hardware: CPU, RAM, Disk, NIC
```

- **Kernel space** — hardware'ga to'g'ridan-to'g'ri kiradi. Kernel'dagi bug butun tizimni yiqitadi (**kernel panic**).
- **User space** — har process izolyatsiya qilingan. Bitta app crash bo'lsa (segfault), boshqalar ishlayveradi.
- **CPU ring** — hardware darajasidagi himoya: ring 3'dagi kod privileged instruction'ni bajara olmaydi. Isolation software va'dasi emas, CPU kafolati.

## 5. System call — qanday ishlaydi

Siz `cat file.txt` yozasiz. Ichkarida:

```
 cat (user space)              kernel
 ----------------              ------
 openat("file.txt") ------->   path -> inode topadi, ruxsatni tekshiradi
                    <-------   fd = 3
 read(3, buf, 128K) ------->   page cache'dan yoki disk'dan o'qiydi
                    <-------   128K bayt
 write(1, buf, ...) ------->   terminal'ga (fd 1 = stdout)
 close(3)           ------->
```

Har syscall — **user mode -> kernel mode o'tishi**: CPU holatini saqlash, privilege o'zgarishi, qaytish. Bitta o'tish arzon (yuzlab nanosekund), lekin millionlab bo'lsa — sezilarli.

### Naive vs better

```
 Naive:   1 bayt -> read() x 1 000 000   = 1 000 000 syscall  -> sekin
 Better:  64KB buffer -> read() x 16     = 16 syscall         -> tez
```

Shuning uchun Go'da `bufio`, C'da `fread`, Python'da buffered I/O bor. **Lekin:** taxmin qilmang — o'lchang:

```bash
strace -c ls /etc          # qaysi syscall'lar, necha marta, qancha vaqt
strace -f -p <PID>         # ishlayotgan process nima qilyapti (qotganda)
strace -e trace=openat nginx -t   # nginx qaysi file'larni ochmoqchi
```

> **Production gotcha:** `strace` process'ni **juda sekinlashtiradi** (har syscall'da to'xtatadi). Yuklangan prod server'da qisqa muddat ishlating. Past overhead kerak bo'lsa — `perf trace` yoki eBPF tool'lari (`bpftrace`, `bcc`).

### Debugging misoli: "process qotib qoldi"

```bash
strace -p 4321
# read(5, ...   <- shu yerda turibdi
ls -l /proc/4321/fd/5
# 5 -> socket:[98765]   <- network'dan javob kutyapti
```

Symptom: "app qotdi". Root cause: tashqi servisga timeout'siz so'rov. Fix: timeout qo'yish. Bu **observe -> hypothesis -> root cause** zanjiri — taxmin bilan restart qilish emas.

## 6. Monolithic kernel va module'lar

| Model | Driver qayerda | Afzallik | Kamchilik | Misol |
|---|---|---|---|---|
| **Monolithic** | Kernel ichida | Tez (bir address space) | Driver bug = kernel panic | Linux |
| **Microkernel** | User space'da | Izolyatsiya, ishonchli | Sekinroq (ko'p IPC) | QNX, seL4, MINIX |

Linux — monolithic, lekin **loadable module**'lar bilan: driver'ni reboot'siz yuklash/olib tashlash mumkin.

```bash
uname -r              # kernel version
lsmod                 # yuklangan module'lar
modinfo overlay       # Docker overlayfs module'i haqida
dmesg -T | tail       # kernel log: OOM killer, disk xatolari, driver xabarlari
```

> **Senior nuqta:** kernel version muhim. eBPF, cgroups v2, io_uring kabi feature'lar ma'lum kernel versiyasidan boshlab bor. "Bizning prod'da ishlaydimi?" — avval `uname -r`.

## 7. Container — bu Linux kernel feature

Docker container — VM emas. U **oddiy Linux process**, faqat kernel uni izolyatsiya qiladi va cheklaydi:

| Kernel feature | Nima beradi | Hal qiladigan problem |
|---|---|---|
| **namespaces** (pid, net, mnt, uts, ipc, user, cgroup) | Process o'zini alohida tizimda deb o'ylaydi | Isolation |
| **cgroups** | CPU / RAM / IO limit | Sharing (bitta container hammani yemasin) |
| **overlayfs** | Layer'li filesystem | Image'lar tez va ixcham |
| **seccomp, capabilities, LSM** | Ruxsat berilgan syscall va huquqlar | Security |

```
 VM                                  Container
 +--------+ +--------+               +--------+ +--------+
 | app    | | app    |               | app    | | app    |
 | guest  | | guest  |               +--------+ +--------+
 | kernel | | kernel |               namespaces + cgroups
 +--------+ +--------+               +---------------------+
 | hypervisor        |               | BITTA host kernel   |
 +-------------------+               +---------------------+
```

### Trade-off'lar

| | VM | Container |
|---|---|---|
| Start vaqti | Soniyalar-daqiqalar | Millisekundlar |
| Overhead | Har VM'da to'liq kernel | Deyarli yo'q |
| Isolation | Kuchli (alohida kernel) | Kuchsizroq (umumiy kernel) |
| Boshqa OS | Ha (Linux'da Windows) | Yo'q — host kernel bilan bir xil |

> **Security implication:** container **host kernel'ni ulashadi**. Kernel vulnerability (container escape) barcha container'larga ta'sir qiladi. Shuning uchun multi-tenant muhitda (begona kod ishlatilsa) qo'shimcha qatlam: gVisor, Kata Containers, Firecracker microVM. AWS Lambda aynan Firecracker ishlatadi.

## 8. Nega server'da Linux?

1. **Stability** — oylar davomida reboot'siz ishlaydi (kernel live patching ham bor).
2. **Automation** — hamma narsa text file va CLI. GUI'ni avtomatlashtirish qiyin.
3. **Cost** — litsenziya yo'q, scale qilganda muhim.
4. **Ecosystem** — Docker, Kubernetes, cloud — hammasi Linux kernel feature'lariga tayanadi.
5. **Observability** — `/proc`, `strace`, `perf`, eBPF — ichkarini ko'rish vositalari.

**Qachon Linux emas:** .NET Framework (eski) yoki Active Directory'ga bog'liq legacy tizimlar — Windows Server; ba'zi real-time / embedded tizimlar — RTOS.

## 9. Failure modes — kernel darajasida nima buziladi

| Symptom | Ehtimoliy sabab | Qayerdan ko'rasiz |
|---|---|---|
| Process to'satdan o'ldi, exit 137 | **OOM killer** (RAM tugadi) | `dmesg -T \| grep -i oom`, `journalctl -k` |
| Server javob bermaydi, qayta yuklandi | Kernel panic | Konsol log, `journalctl -k -b -1` |
| `Too many open files` | fd limit (`ulimit -n`) | `ls /proc/<PID>/fd \| wc -l` |
| Disk xatolari, read-only FS | Hardware / filesystem error | `dmesg -T` |
| Container'da hammasi sekin | cgroup CPU throttling | `cat /sys/fs/cgroup/cpu.stat` |

## Amaliy mashg'ulot

```bash
uname -a
cat /etc/os-release
ldd /bin/ls                            # qaysi libc'ga bog'langan
strace -c ls /etc 2>&1 | tail -15      # syscall statistikasi
ls -l /proc/$$/ns                      # joriy shell'ning namespace'lari
sudo dmesg -T | tail
```

Muhokama:
1. `ls` nega shuncha syscall qiladi? Qaysilari eng ko'p?
2. `dd if=/dev/zero of=/dev/null bs=1 count=100000` va `bs=64K count=2` ni `time` bilan solishtiring. Farqni syscall nuqtai nazaridan tushuntiring.

## Uy vazifa

1. 5 ta distro'ni jadvalda solishtiring: family, package manager, libc, use case.
2. `docker run --rm alpine ps aux` natijasida nega faqat 1 ta process ko'rinishini tushuntiring (pid namespace).
3. Go'da kichik HTTP server uchun base image tanlang (`scratch`, distroless, Alpine, Debian-slim). Trade-off'larni yozing: o'lcham, debug qulayligi, security, libc.

## Test savollari

1. Kernel hal qiladigan 3 ta asosiy problem qaysi?
2. System call nima va nega ko'p kichik syscall sekin?
3. Container va VM'ning asosiy farqi? Security nuqtai nazaridan nima kelib chiqadi?
4. Alpine image'da glibc'ga bog'liq binary nega ishlamasligi mumkin?
5. OOM killer xabarini qayerdan ko'rasiz?
6. Nega prod'da `strace`'ni ehtiyot bilan ishlatish kerak?
7. Monolithic va microkernel trade-off'i nima?

## Common mistakes

- "Container — yengil VM" deb o'ylash: kernel umumiy ekanini unutish.
- Process qotganda darhol restart: root cause yo'qoladi, muammo qaytadi.
- Alpine'ni "kichik = yaxshi" deb ko'r-ko'rona tanlash.
- Kernel log'ga (`dmesg`) qaramasdan app'ni ayblash.

## Senior xulosa

- Kernel = abstraction + isolation + resource sharing. Linux'dagi hamma narsa shularning biriga xizmat qiladi.
- User space kernel'dan faqat **syscall** orqali so'raydi. Syscall arzon emas — buffer'lang, lekin avval o'lchang (`strace -c`).
- Container — namespaces + cgroups bilan izolyatsiya qilingan oddiy process. Host kernel umumiy: bu tezlik va xavf manbai.
- libc tanlovi (glibc / musl / static) — production'dagi real muammolar manbai.
- Process "qotdi" yoki "o'ldi" — avval kernel'dan so'rang: `dmesg`, `/proc`, `strace`.
