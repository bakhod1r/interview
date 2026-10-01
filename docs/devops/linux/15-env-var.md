# Dars 15 — Muhit o'zgaruvchilari (Env var)

> **Natija:** env o'zgaruvchilarni o'qish, yaratish, doimiy qilish va `PATH` sababli `command not found`'ni tuzatish. Env qanday meros bo'ladi, shell startup fayllari tartibi, systemd va container'da env, 12-factor config, secret'larni env'da saqlashning xavflari va alternativalari, config validatsiyasi.

## 1. Env o'zgaruvchilar process bilan birga yashaydi

```
 shell (DB_HOST=localhost, export qilingan)
   |
   | fork + exec (12-dars)
   v
 app process: env'ning NUSXASI
   - o'zgartirsa, faqat o'zida va o'z child'larida
   - ota process'ga HECH QACHON qaytmaydi
```

Bundan kelib chiqadigan faktlar:
- Child faqat **export qilingan** o'zgaruvchilarni oladi.
- Script ichida `export X=1` — script tugagach, sizning shell'ingizda `X` yo'q. Shell'ga ta'sir qilish uchun `source script.sh` (shell'ning o'zida bajariladi).
- Ishlayotgan process'ning env'ini tashqaridan o'zgartirib bo'lmaydi — faqat restart.
- Process env'i start paytidagi holat: `/proc/<PID>/environ`.

## 2. Env o'zgaruvchilarni ko'rish

```bash
env                      # export qilingan hammasi
printenv HOME
echo "$HOME"             # /home/student
set | less               # shell o'zgaruvchilari ham (export qilinmaganlar)
declare -p NAME          # o'zgaruvchi turi va export bormi
tr '\0' '\n' < /proc/<PID>/environ    # boshqa process env'i (root yoki egasi)
```

| O'zgaruvchi | Ma'no |
|---|---|
| `HOME` | Home papka |
| `USER` | Joriy user |
| `PATH` | Buyruq qidiriladigan papkalar |
| `SHELL` | Login shell |
| `LANG`, `LC_ALL` | Til va kodlash (sort tartibi, raqam formati!) |
| `TZ` | Vaqt zonasi |
| `PWD` | Joriy papka |

> **Tuzoq:** `LANG`/`LC_ALL` vositalar xatti-harakatini o'zgartiradi: `sort` tartibi, `grep` tezligi (7-dars), raqamlardagi vergul/nuqta. Script'lar turli server'da turlicha ishlasa — locale'ni tekshiring. Deterministik natija uchun script'da `LC_ALL=C`.

## 3. Env o'zgaruvchi yaratish

```bash
NAME=Ali              # faqat shu shell (oddiy o'zgaruvchi)
export NAME=Ali       # child process'larga ham o'tadi
bash -c 'echo $NAME'  # export bo'lsa — Ali
unset NAME
DEBUG=1 ./app.sh      # faqat shu bitta command uchun, shell'da qolmaydi
env -i bash --norc    # toza env bilan (debugging uchun)
```

> **Tuzoq:** `=` atrofida bo'sh joy yo'q: `NAME = Ali` — shell `NAME` nomli buyruqni ishga tushirmoqchi bo'ladi.

> **Qo'shtirnoq:** `echo $VAR` — probel va `*` bo'lsa so'zlarga bo'linadi va glob ochiladi. Har doim `"$VAR"`.

## 4. PATH — shell buyruqni qayerdan qidiradi

```bash
echo "$PATH"
# /usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/home/student/bin
```

Shell buyruqni papkalarda **chapdan o'ngga** qidiradi; birinchi topilgani ishlaydi (4-dars: alias -> function -> builtin -> PATH).

```text
$ myscript
myscript: command not found     -> papka PATH'da yo'q (yoki execute bit yo'q)
```

```bash
./myscript                          # to'liq yoki relative yo'l
export PATH="$HOME/bin:$PATH"       # boshiga qo'shish
command -v myscript
hash -r                             # bash command cache'ini tozalash
```

> **Tuzoq 1:** `export PATH=~/bin` (eski qiymatsiz) — barcha buyruqlar yo'qoladi (`ls: command not found`). Tuzatish shu session'da: `export PATH=/usr/bin:/bin`.

> **Tuzoq 2 — bash hash:** binary'ni boshqa papkaga ko'chirsangiz, bash eski yo'lni eslab qoladi: `No such file or directory`. Yechim: `hash -r` yoki yangi shell.

> **Xavfsizlik:** PATH'ga `.` yoki boshqalar yoza oladigan papkani qo'shmang, ayniqsa **boshiga** (4-dars). `/usr/local/bin` `/usr/bin`'dan oldin turadi — u yerga kim yoza olishini nazorat qiling.

**Tartib dilemmasi:**
- `PATH="$HOME/bin:$PATH"` — sizning versiyangiz tizimnikidan ustun (masalan, yangi `kubectl`).
- `PATH="$PATH:$HOME/bin"` — tizim buyruqlari ustun, xavfsizroq.

## 5. O'zgaruvchini doimiy qilish — qaysi fayl qachon o'qiladi

| Fayl | Kimga | Qachon o'qiladi |
|---|---|---|
| `/etc/environment` | Hamma | Login'da (PAM), shell sintaksisi emas: faqat `KEY=value` |
| `/etc/profile`, `/etc/profile.d/*.sh` | Hamma | Login shell |
| `~/.profile` (yoki `~/.bash_profile`) | Bitta user | Login shell (SSH, konsol) |
| `~/.bashrc` | Bitta user | Har yangi **interaktiv** non-login bash |
| systemd `Environment=` / `EnvironmentFile=` | Servis | Servis start'da |
| Dockerfile `ENV`, `docker run -e` | Container | Container start'da |

```
 SSH login     -> /etc/profile -> ~/.profile (u odatda ~/.bashrc'ni chaqiradi)
 Yangi terminal oynasi (GUI) -> ~/.bashrc
 cron / systemd -> HECH QAYSI! (minimal env)
```

```bash
echo 'export PATH="$HOME/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc      # hozirgi shell'da qo'llash
```

> **Klassik incident:** script terminal'da ishlaydi, cron'da `command not found`. **Asl sabab:** cron va systemd `.bashrc`/`.profile`'ni o'qimaydi, ularning PATH'i minimal. Yechim: script'da to'liq path yoki script boshida `PATH=` aniq belgilash; servis uchun `Environment=`.

> **Tuzoq:** `~/.bashrc` boshida odatda "interaktiv bo'lmasa — chiq" qatori bor. Shuning uchun u yerga yozilgan narsa script'larda ko'rinmaydi.

## 6. Servis va container uchun env berish

### systemd

```ini
[Service]
Environment=LOG_LEVEL=info APP_PORT=8080
EnvironmentFile=/etc/myapp/myapp.env      # KEY=value qatorlar
EnvironmentFile=-/etc/myapp/override.env  # "-" : file bo'lmasa ham xato emas
```

```bash
systemctl show myapp -p Environment
sudo systemctl restart myapp     # env o'zgarishi faqat restart'da kuchga kiradi
```

### Docker / Kubernetes

```bash
docker run -e LOG_LEVEL=debug --env-file ./prod.env myapp
```

```yaml
env:
  - name: LOG_LEVEL
    value: info
  - name: DB_PASSWORD
    valueFrom:
      secretKeyRef: {name: db, key: password}
```

## 7. Dastur ichida sozlamalarni o'qish — xato va to'g'ri usul

```go
// Naive: yo'q bo'lsa jim bo'sh string, xato kech va noaniq chiqadi
dbHost := os.Getenv("DB_HOST")
```

```go
// Production: start'da hammasini o'qi, tekshir, xato bo'lsa darhol va aniq to'xta (fail fast)
type Config struct {
    DBHost   string
    Port     int
    LogLevel string
}

func loadConfig() (Config, error) {
    var c Config
    var errs []error

    c.DBHost = os.Getenv("DB_HOST")
    if c.DBHost == "" {
        errs = append(errs, errors.New("DB_HOST is required"))
    }

    port, err := strconv.Atoi(cmp.Or(os.Getenv("APP_PORT"), "8080"))
    if err != nil || port < 1 || port > 65535 {
        errs = append(errs, fmt.Errorf("APP_PORT invalid: %q", os.Getenv("APP_PORT")))
    }
    c.Port = port

    c.LogLevel = cmp.Or(os.Getenv("LOG_LEVEL"), "info")
    return c, errors.Join(errs...)
}
```

**Nega fail fast:** noto'g'ri config bilan servis "ishlayotgandek" turib, birinchi so'rovda yiqilsa — deploy yashil, incident esa keyinroq. Start'da to'xtasa — deploy darhol muvaffaqiyatsiz va rollback avtomatik (13-dars `ExecStartPre` g'oyasi bilan bir xil).

**Qoidalar:** barcha config **bitta joyda** o'qiladi (kod bo'ylab sochilgan `Getenv` emas); default'lar aniq; start'da config log'ga yoziladi — **secret'larsiz**.

## 8. Parol va kalitlar (secret) — env'da saqlash xavflari

Env secret uchun keng tarqalgan, lekin xavfsiz emas:

| Xavf | Qanday |
|---|---|
| Child'larga meros | App chaqirgan har subprocess (shell, 3rd-party vosita) secret'ni oladi |
| `/proc/<PID>/environ` | Root yoki o'sha user o'qiy oladi |
| Crash dump, debug endpoint | Ko'p framework'lar xato sahifasida env'ni chiqaradi |
| Log | `env` yoki config dump log'ga tushadi |
| `docker inspect` | Container env'i ochiq ko'rinadi |
| Buyruq qatori | `API_KEY=... ./app` — shell history'da qoladi |

**Yaxshiroq variantlar (o'sish tartibida):**

```
 1. Kodda / git'da            -> HECH QACHON (git tarixidan o'chirish deyarli imkonsiz)
 2. Env var                    -> minimal qabul qilinadigan
 3. File, 600 ruxsat bilan     -> EnvironmentFile yoki K8s secret volume sifatida mount
 4. systemd credentials        -> LoadCredential= (faqat shu servis o'qiydi, env'da emas)
 5. Secret manager             -> Vault, AWS Secrets Manager: audit, rotation, qisqa muddatli
```

```bash
# .env file
chmod 600 /etc/myapp/myapp.env
chown root:myapp /etc/myapp/myapp.env    # yoki 640, servis group'i o'qiydi
echo ".env" >> .gitignore
```

> **Agar secret git'ga tushsa:** commit'ni o'chirish yetarli emas — u allaqachon klon'larda va tarixda. **Birinchi qadam — secret'ni bekor qilish (rotate)**, keyin tarixni tozalash. Profilaktika: pre-commit hook va CI'da secret scanner (gitleaks).

## 9. Nima buzilishi mumkin

| Belgi | Asl sabab | Yechim |
|---|---|---|
| Terminal'da ishlaydi, cron/systemd'da yo'q | Minimal env, `.bashrc` o'qilmaydi | To'liq path, `Environment=` |
| Yangi env servisda ko'rinmaydi | Restart qilinmagan / `daemon-reload` | `daemon-reload` + `restart` |
| `ls: command not found` | PATH'ni ustidan yozdingiz | `export PATH=/usr/bin:/bin` |
| Binary ko'chirildi, eski path xatosi | bash `hash` | `hash -r` |
| Sort/format server'lar orasida farq qiladi | Locale | `LC_ALL=C` |
| Servis noto'g'ri qiymat bilan ishlayapti | Bir nechta manba (`EnvironmentFile`, drop-in, default) | `systemctl show -p Environment`, `/proc/PID/environ` |

## Amaliy mashg'ulot

1. `~/bin/salom` script'ini yozing: `echo "Salom, $USER!"`, `chmod +x`.
2. `salom` -> `command not found` -> PATH'ga qo'shing -> ishlaydi.
3. Yangi terminal oching — ishlamaydi -> `.bashrc`'ga yozing -> ishlaydi.
4. `export` va oddiy o'zgaruvchi farqini `bash -c` bilan isbotlang.
5. Script ichida `export X=1` qiling, `./script.sh` va `source script.sh` dan keyin `echo $X`'ni solishtiring.
6. Cron simulyatsiyasi: `env -i /bin/bash -c 'salom'` — nega ishlamaydi? Tuzating.
7. `sleep 1000 &` uchun `FOO=bar sleep 1000 &` ishga tushiring, `/proc/<PID>/environ`'dan `FOO`'ni toping — secret xavfini tushuntiring.

## Uy vazifa

1. `hello.service`'ga (13-dars) `EnvironmentFile=/etc/hello/hello.env` qo'shing (`GREETING=Assalomu`, ruxsat `640`, group servisniki). Qiymatni o'zgartiring va faqat restart'dan keyin ta'sir qilishini ko'rsating.
2. Go (yoki tanlagan tilingiz)da `loadConfig` yozing: majburiy field'lar, validatsiya, barcha xatolarni bir vaqtda chiqarish, secret'larsiz log.
3. Env, fayl va secret manager'ni secret saqlash uchun solishtiring: xavf, murakkablik, rotation.

## Test savollari

1. `export` nima beradi? Nega script ichidagi `export` shell'ingizga ta'sir qilmaydi?
2. `command not found` va PATH bog'liqligi? Tartib nega muhim?
3. `.bashrc` va `.profile` qachon o'qiladi? cron-chi?
4. Ishlayotgan servisning env'ini qanday o'zgartirasiz?
5. 12-factor nega config'ni env'da saqlashni tavsiya qiladi?
6. Env'da secret saqlashning 3 ta xavfi?
7. Fail fast config validatsiyasi qaysi muammoni hal qiladi?
8. Secret git'ga tushdi — birinchi qadam?

## Ko'p uchraydigan xatolar

- `export PATH=...` eski qiymatsiz.
- `.bashrc`'ga yozib, cron/systemd ham ko'radi deb o'ylash.
- `os.Getenv` kod bo'ylab sochilgan, validatsiyasiz.
- Secret'ni buyruq qatorida yoki git'da.
- Config dump'ni log'ga secret'lar bilan yozish.
- Env o'zgargandan keyin restart qilmaslik.

## Xulosa

- Env — process'ning bir qismi: export qilinganlar child'ga nusxa bo'lib o'tadi, ota'ga hech qachon qaytmaydi.
- PATH — shell xaritasi: `:$PATH`'ni unutmang, tartib va yozish huquqi — xavfsizlik.
- Shell startup fayllari interaktiv shell uchun; cron, systemd va container o'z env'iga ega.
- Config — bitta joyda o'qiladi, validatsiya qilinadi, xato bo'lsa start'da to'xtaydi.
- Env secret uchun "minimal yechim": imkon bo'lsa fayl/credentials yoki secret manager; git'ga tushgan secret — darhol rotate.
