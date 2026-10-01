# Dars 4 — Terminal, man, --help

> **Natija:** terminal, shell va command qanday ishlashini tushunish; stdin/stdout/stderr va exit code bilan ishlash; notanish command'ni mustaqil o'rganish. Senior darajada: shell command'ni qanday bajaradi (fork + exec), redirect tartibi, pipeline'da xatolar va xavfsiz script yozish asoslari.

## 1. Problem — nega GUI emas, terminal?

| GUI | Terminal (CLI) |
|---|---|
| Klik — avtomatlashtirib bo'lmaydi | Command — script'ga yoziladi, takrorlanadi |
| Server'da GUI yo'q (resurs, xavfsizlik) | SSH orqali dunyoning istalgan joyidan |
| Nima qilinganini yozib bo'lmaydi | History, log, git'dagi script — audit |
| Bitta server | `for` loop bilan 100 ta server |

**Asosiy g'oya:** terminal — bu **automation interfeysi**. Qo'lda yozgan har command'ingiz ertaga script, keyin CI/CD pipeline qadami bo'ladi.

## 2. Terminal, shell, TTY — kim nima qiladi

```
 Siz klaviaturada yozasiz
        |
        v
 +--------------------+      +--------------+      +---------------+
 | Terminal emulator  | <--> | PTY (kernel) | <--> | Shell (bash)  |
 | iTerm, GNOME Term  |      | /dev/pts/0   |      | command'ni    |
 | (oyna, shrift)     |      | (device)     |      | tahlil qiladi |
 +--------------------+      +--------------+      +-------+-------+
                                                           |
                                                     fork + exec
                                                           v
                                                    ls, grep, nginx
```

| Atama | Nima |
|---|---|
| **Terminal emulator** | Oyna: matnni chizadi, klaviaturani qabul qiladi |
| **TTY / PTY** | Kernel'dagi terminal device (`/dev/pts/0`). SSH ham PTY yaratadi |
| **Shell** | Command interpreter: `bash`, `zsh`, `sh` (Ubuntu'da `dash`) |
| **Prompt** | `student@server:~$` (`$` — oddiy user, `#` — root) |

```bash
tty                 # /dev/pts/0
echo $SHELL         # login shell (/etc/passwd'dagi)
echo $0             # hozir ishlayotgan shell
```

> **Gotcha:** Ubuntu'da `/bin/sh` -> `dash`, `bash` emas. `#!/bin/sh` bilan yozilgan script'da bash'ga xos sintaksis (`[[ ]]`, array'lar, `function`) ishlamaydi yoki boshqacha ishlaydi. Bash feature ishlatsangiz — `#!/usr/bin/env bash` yozing.

## 3. Shell command'ni qanday bajaradi — internals

`ls -l /etc` yozib Enter bosdingiz:

```
 1. O'qish        "ls -l /etc"
 2. Tahlil        so'zlarga bo'lish, quote, $VAR, glob (*) ochish
 3. Qidirish      alias? function? builtin? $PATH ichida binary?
 4. fork()        shell o'zining nusxasini yaratadi (child process)
 5. exec()        child o'zini /usr/bin/ls bilan almashtiradi
 6. wait()        shell child tugashini kutadi, exit code'ni oladi ($?)
```

Bu nima uchun muhim:
- **`cd` nega builtin?** Agar `cd` alohida process bo'lsa, u faqat child'ning directory'sini o'zgartirardi, shell'niki emas. Shuning uchun `cd`, `export`, `source` shell'ning ichida bo'lishi shart.
- **Glob va `$VAR`'ni shell ochadi**, command emas. `ls` hech qachon `*` belgisini ko'rmaydi.
- **Har command — yangi process.** Loop ichida 10 000 marta `grep` chaqirish = 10 000 fork/exec — sekin. Bitta `grep` + pipe — tez.

## 4. Command anatomiyasi

```
ls   -l   --human-readable   /etc
|    |    |                  +-- argument
|    |    +--------------------- long option
|    +-------------------------- short option
+------------------------------- command
```

- `ls -lah` = `ls -l -a -h` (short option'lar birlashadi).
- `--` — "option'lar tugadi": `rm -- -file.txt` (`-` bilan boshlangan file).
- Konvensiya, qonun emas: ba'zi tool'lar (`find`, `java`, `dd`) boshqacha sintaksis ishlatadi. Shuning uchun `--help` / `man`.

## 5. Command turlari va qidiruv tartibi

```bash
type cd        # cd is a shell builtin
type ll        # ll is aliased to 'ls -alF'
type nginx     # nginx is /usr/sbin/nginx
type -a echo   # barcha variantlar: builtin va /usr/bin/echo
command -v git # script'larda: mavjudligini tekshirish
```

Shell qidiruv tartibi: **alias -> function -> builtin -> `$PATH` ichidagi binary** (chapdan o'ngga, birinchi topilgani).

> **`which` vs `type`:** `which` — tashqi dastur, faqat `$PATH`'ni ko'radi; alias va builtin'larni bilmaydi. `type` va `command -v` — shell'ning o'zi, haqiqatda nima ishga tushishini aytadi. Script'larda `command -v` ishlating (POSIX standart).

> **Security gotcha:** `$PATH`'ga `.` (joriy papka) yoki boshqalar yoza oladigan papka qo'shmang. Kimdir `/tmp`'ga `ls` nomli zararli file qo'ysa, u sizning nomingizdan ishga tushadi.

## 6. Yordam olish — mustaqil o'rganish ko'nikmasi

Senior bilan junior farqi — hamma command'ni yod bilish emas, **notanish command'ni 2 daqiqada tushunib olish**.

```bash
ls --help           # tez eslatma (ko'p GNU tool'larda)
man ls              # to'liq qo'llanma
man 5 passwd        # 5-section: /etc/passwd file formati
man -k "copy file"  # keyword bo'yicha qidiruv (apropos)
help cd             # bash builtin'lar uchun (man cd yo'q bo'lishi mumkin)
tldr tar            # amaliy misollar (alohida o'rnatiladi)
```

| man section | Mazmun | Misol |
|---|---|---|
| 1 | User command'lar | `man 1 ls` |
| 2 | System call'lar | `man 2 open` |
| 3 | C library funksiyalar | `man 3 printf` |
| 5 | Config file format'lari | `man 5 crontab` |
| 7 | Umumiy tushunchalar | `man 7 signal` |
| 8 | Admin command'lar | `man 8 useradd` |

`man` ichida: `/word` — qidiruv, `n` — keyingisi, `G` — oxiri, `q` — chiqish.

### Notanish command algoritmi

```
 1. type <cmd>              -> bu nima: builtin, alias, binary?
 2. <cmd> --help | less     -> qisqa ro'yxat
 3. man <cmd> -> SYNOPSIS, EXAMPLES, EXIT STATUS bo'limlari
 4. Xavfsiz joyda sinash    -> /tmp'da, test file bilan, --dry-run bo'lsa u bilan
 5. Rasmiy hujjat           -> man page versiyangizga mos; internet'dagi misol boshqa versiya uchun bo'lishi mumkin
```

> **Production qoidasi:** internet'dan ko'chirilgan command'ni tushunmasdan prod'da ishga tushirmang — ayniqsa `sudo`, `rm`, `dd`, `curl ... | bash`.

## 7. stdin, stdout, stderr — senior uchun majburiy

Har process 3 ta ochiq **file descriptor** bilan boshlanadi:

```
            +---------+ --fd 1 stdout--> natija (keyingi command'ga yoki file'ga)
 fd 0 ----> | command |
 stdin      +---------+ --fd 2 stderr--> xato va diagnostika (terminalga)
```

**Nega ikkita chiqish?** Natijani pipe orqali keyingi tool'ga yuborganda, xato xabarlari data'ni buzmasligi uchun. `stdout` — data, `stderr` — inson uchun xabar.

```bash
cmd > out.txt          # stdout -> file (ustiga yozadi)
cmd >> out.txt         # qo'shib yozadi
cmd 2> err.txt         # stderr -> file
cmd > all.txt 2>&1     # ikkalasi ham bitta file'ga
cmd &> all.txt         # bash qisqartmasi (POSIX sh'da yo'q)
cmd 2>/dev/null        # xatolarni tashlab yuborish
cmd < input.txt        # stdin <- file
cmd1 | cmd2            # cmd1 stdout -> cmd2 stdin
```

### Redirect tartibi — eng ko'p uchraydigan xato

Redirect'lar **chapdan o'ngga** bajariladi. `2>&1` — "fd 2'ni **hozir** fd 1 qayerga qarasa, o'sha yerga yo'naltir" degani (nusxa, havola emas).

```
 cmd > file 2>&1                      cmd 2>&1 > file
 1) fd1 -> file                       1) fd2 -> fd1 hozir qayerda = terminal
 2) fd2 -> fd1 qayerda = file         2) fd1 -> file
 natija: ikkalasi file'da             natija: stderr terminalda qoldi
```

### `>` bilan file'ni yo'qotish

```bash
sort data.txt > data.txt     # data.txt BO'SH bo'lib qoladi!
```

Shell avval `>` uchun file'ni bo'shatadi (truncate), keyin `sort` ishga tushadi va bo'sh file'ni o'qiydi. To'g'ri yo'l: `sort -o data.txt data.txt` yoki vaqtinchalik file + `mv`.

> Himoya: `set -o noclobber` — mavjud file'ga `>` bilan yozishni taqiqlaydi (`>|` bilan majburlash mumkin).

## 8. Exit code — automation'ning tili

Har command tugaganda 0–255 oralig'ida raqam qaytaradi: `0` — success, `0` dan boshqa — xato.

```bash
ls /etc; echo $?        # 0
ls /yoq; echo $?        # 2
mkdir dir && cd dir     # faqat success bo'lsa davom etadi
cmd || echo "failed"    # faqat fail bo'lsa
```

| Code | Ma'no |
|---|---|
| 0 | Success |
| 1 | Umumiy xato |
| 2 | Noto'g'ri ishlatish (ko'p tool'larda) |
| 126 | Topildi, lekin bajarib bo'lmaydi (permission, executable emas) |
| 127 | Command not found |
| 128+N | N signal bilan o'ldirildi |
| 130 | Ctrl+C (128 + SIGINT 2) |
| 137 | SIGKILL (128 + 9) — ko'pincha **OOM killer** yoki `kill -9` |
| 143 | SIGTERM (128 + 15) — graceful to'xtatish so'ralgan |

> CI/CD pipeline va Kubernetes aynan exit code'ga qaraydi. Pod `137` bilan o'lsa — memory limit'ni tekshiring (`kubectl describe pod` -> `OOMKilled`). `143` — odatda normal shutdown.

### Pipeline'dagi yashirin xato

```bash
curl -s https://bad.url | grep "ok"
echo $?     # grep'ning exit code'i! curl xatosi ko'rinmaydi
```

Pipeline'ning exit code'i — **oxirgi** command'niki. Bash'da:

```bash
set -o pipefail              # birinchi xato bergan command'ning code'i
echo "${PIPESTATUS[@]}"      # har bir bo'lakning exit code'i
```

### Xavfsiz script boshlanishi (bash)

```bash
#!/usr/bin/env bash
set -euo pipefail
# -e          xato bo'lsa to'xtat
# -u          e'lon qilinmagan o'zgaruvchi = xato (rm -rf "$DIR/" himoyasi)
# -o pipefail pipe ichidagi xatoni yashirma
```

> **Trade-off:** `set -e` sehrli emas — `if`, `&&`, `||` ichida va ba'zi holatlarda ishlamaydi. U xavfsizlik to'ri, lekin muhim joylarda xatoni aniq tekshirish (`if ! cmd; then ...`) baribir kerak. Script murakkablashsa (100+ qator, JSON, retry logika) — Python yoki Go'ga o'ting.

## 9. Shortcut'lar va history

| Key | Vazifa |
|---|---|
| `Tab` | Autocomplete (ikki marta — variantlar) |
| `Ctrl+R` | History'dan qidiruv |
| `Ctrl+A / Ctrl+E` | Qator boshi / oxiri |
| `Ctrl+W` | Oldingi so'zni o'chirish |
| `Ctrl+U` | Qatorni kursorgacha o'chirish |
| `Ctrl+L` | Ekranni tozalash |
| `Ctrl+C` | SIGINT — jarayonni to'xtatish |
| `Ctrl+D` | EOF (shell'dan chiqish) |
| `!!` | Oxirgi command (`sudo !!`) |

> **Security gotcha:** command qatorida yozilgan parol (`mysql -pSecret123`) `~/.bash_history`'ga va `ps aux` ro'yxatiga tushadi (boshqa user'lar ko'radi). Secret'ni env var, file yoki interaktiv so'rov orqali bering. Bash'da probel bilan boshlangan command history'ga yozilmaydi (`HISTCONTROL=ignorespace` bo'lsa).

## 10. Error'larni o'qish

```text
lss: command not found                        -> 127: typo yoki PATH'da yo'q
ls: cannot access '/yoq': No such file...     -> path xato
cat: /etc/shadow: Permission denied           -> ruxsat yo'q (10-dars)
bash: ./run.sh: Permission denied             -> execute bit yo'q: chmod +x
bash: ./run.sh: /bin/bash^M: bad interpreter  -> Windows CRLF line ending (dos2unix)
-bash: ./app: cannot execute binary file: Exec format error -> arm64/amd64 mos emas
```

**Qoida:** xato xabarini oxirigacha o'qing. 90% holatda javob shu yerda yozilgan. Format odatda: `dastur: obyekt: sabab`.

## Amaliy mashg'ulot

1. `wc`, `sort`, `uniq`, `date`, `cut` command'larini faqat `man` bilan o'rganing (internet'siz).
2. `ls /etc /yoq > out.txt 2> err.txt` — ikkala file'ni tekshiring.
3. `ls /etc /yoq 2>&1 > out.txt` va `ls /etc /yoq > out.txt 2>&1` farqini ko'ring va tushuntiring.
4. `false; echo $?`, `true; echo $?`, `sleep 100` -> `Ctrl+C` -> `echo $?` (130).
5. `false | true; echo $?`, keyin `set -o pipefail` bilan qaytaring.
6. Buzib-tuzat: `printf '#!/bin/bash\r\necho hi\r\n' > crlf.sh; chmod +x crlf.sh; ./crlf.sh` — xatoni o'qing va tuzating.

## Uy vazifa

1. `date +%F` formatini `man date`'dan topib, `backup-2026-10-01.tar.gz` ko'rinishidagi nom bilan `/etc`'ni arxivlaydigan bitta qatorli command yozing.
2. `set -euo pipefail` bilan script yozing: mavjud bo'lmagan o'zgaruvchi ishlatilganda va pipe ichida xato bo'lganda to'xtashini ko'rsating.
3. `type`, `which`, `command -v` farqini 3 ta misol bilan tushuntiring.

## Test savollari

1. Terminal emulator, PTY va shell farqi nima?
2. Nega `cd` alohida dastur bo'la olmaydi?
3. `2>&1` nima qiladi va tartib nega muhim?
4. `sort file > file` nega file'ni bo'shatadi?
5. Exit code 127, 137, 143 nimani bildiradi?
6. `curl ... | grep ...` da curl xatosi nega ko'rinmaydi? Qanday tuzatiladi?
7. Nega command qatorida parol yozish xavfli?
8. `#!/bin/sh` script'da `[[ ]]` nega ishlamasligi mumkin?

## Common mistakes

- Xato xabarini o'qimasdan internet'dan qidirish.
- `stdout` va `stderr`'ni aralashtirib, keyingi tool'ga axlat yuborish.
- Pipeline'da `pipefail`'siz ishlash va xatoni yo'qotish.
- Internet'dagi command'ni tushunmasdan `sudo` bilan ishga tushirish.
- Bash'ning murakkab script'ini 500 qatorga o'stirish — Python/Go vaqti allaqachon kelgan.

## Senior xulosa

- Terminal — automation interfeysi: bugungi qo'lda yozilgan command — ertangi pipeline qadami.
- Shell command'ni **fork + exec** bilan bajaradi; glob va o'zgaruvchilarni shell ochadi. Shuning uchun `cd` builtin.
- Har command'da uchta stream (stdin/stdout/stderr) va bitta exit code bor. Automation, CI/CD va Kubernetes aynan shularga tayanadi.
- Redirect tartibi va `pipefail` — xatolarni yashirmaslik uchun.
- Notanish command'ni o'rganish algoritmi (`type`, `--help`, `man`, xavfsiz sinash) — yod bilishdan muhimroq.
