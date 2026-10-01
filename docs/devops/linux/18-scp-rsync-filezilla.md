# Dars 18 — SCP, Rsync, FileZilla

> **Natija:** fayllarni local <-> remote xavfsiz ko'chirish va vaziyatga qarab vosita tanlash. Rsync delta algoritmi, trailing slash va `--delete` xavflari, atomic deploy, uzilishga chidamlilik, integrity tekshiruvi, va "fayl ko'chirish" qachon to'g'ri deploy usuli emas.

## 1. Muammo — faylni server'ga qanday yetkazish?

Vazifalar:
- Bitta config'ni server'ga yuborish.
- 5 GB log'ni tahlil uchun yuklab olish.
- Sayt papkasini har deploy'da yangilash — faqat o'zgargan fayllar bilan.
- Backup'ni boshqa server'ga muntazam sinxronlash.

Talablar: **xavfsiz** (shifrlangan, autentifikatsiya), **samarali** (keraksiz baytlarni yubormaslik), **ishonchli** (uzilsa davom etish, buzilmaganini tekshirish).

Hammasi SSH ustida ishlaydi — 17-darsdagi kalit, agent va `~/.ssh/config` (aliaslar, `ProxyJump`) shu yerda ham ishlaydi.

| Vosita | Qachon | Kuchli tomoni |
|---|---|---|
| `scp` | 1–2 fayl, bir martalik | Oddiy |
| `rsync` | Papka, takroriy sinxron, katta hajm | Faqat farqni yuboradi, davom etadi, metadata saqlaydi |
| `sftp` / FileZilla (SFTP) | Interaktiv ko'rib chiqish, GUI | Qulay |

Yo'l formati: `user@host:/path` — `:` remote ekanini bildiradi. `host:` (path'siz) — remote home.

## 2. scp

```bash
# Local -> Remote
scp app.tar.gz student@192.168.1.50:/home/student/
scp -r site/ lab:/tmp/            # papka (-r), ~/.ssh/config aliasi bilan
scp -P 2222 file lab:~            # port — KATTA P (ssh'da kichik -p)

# Remote -> Local
scp lab:/var/log/nginx/error.log ./

# Remote -> Remote (laptop orqali)
scp -3 web1:/etc/app.conf web2:/tmp/
```

> **Tarix va nuance:** eski `scp` protokoli remote shell orqali ishlardi va remote tomonda fayl nomlarini shell talqin qilardi (xavfsizlik muammolari). OpenSSH 9.0'dan boshlab `scp` ichkarida **SFTP protokolini** ishlatadi. Buyruq bir xil, lekin ba'zi eski xatti-harakatlar (masalan, remote path'da glob/quote) biroz farq qilishi mumkin. Eski server bilan muammo bo'lsa: `scp -O` (legacy rejim).

**Cheklovlar:** uzilsa — boshidan; har safar butun faylni yuboradi; o'chirilgan fayllarni sinxronlamaydi. Shuning uchun takroriy ish uchun — `rsync`.

## 3. rsync qanday ishlaydi

### Faqat o'zgargan qismni yuborish (delta algoritmi)

```
 Client: yangi file (1 GB)            Server: eski file (1 GB, ozgina farq)
                                          |
                                          | 1. Server eski file'ni bloklarga bo'lib,
                                          |    har blok uchun checksum yuboradi
   <----------- checksum'lar -------------+
   2. Client o'z file'ida shu checksum'larni qidiradi (rolling checksum)
   3. Faqat MOS KELMAGAN qismlar + "blok N'ni qayta ishlat" ko'rsatmalari
   ------------ ~5 MB ------------------->
                                          4. Server yangi file'ni yig'adi
```

Qaysi fayllarni tekshirish kerakligini rsync default bo'yicha **hajm va mtime** bo'yicha hal qiladi ("quick check"). Hajm va vaqt bir xil bo'lsa — fayl o'tkazib yuboriladi.

```
 1-marta:  scp 1GB  [###########]  rsync 1GB  [###########]
 2-marta:  scp 1GB  [###########]  rsync 5MB  [#]            (faqat o'zgargan)
```

### Asosiy opsiyalar

```bash
rsync -avz --progress site/ lab:/var/www/site/
#      |||
#      ||+ z: siqish (sekin tarmoqda foydali; LAN'da yoki siqilgan file'larda CPU isrofi)
#      |+- v: batafsil
#      +-- a: archive = -rlptgoD (rekursiv, symlink, ruxsat, vaqt, group, owner, device)

rsync -avz --delete site/ lab:/var/www/site/     # manbada yo'q file'larni o'chiradi
rsync -avzn --delete site/ lab:/var/www/site/    # -n: dry-run, avval sinang!
rsync -avz -e "ssh -p 2222" src/ host:/dst/
rsync -avz lab:/var/log/nginx/ ./logs/           # remote -> local
rsync -aP big.iso lab:/data/                     # -P = --partial --progress: uzilsa davom etadi
rsync -a --exclude '.git' --exclude 'node_modules' ./ lab:/opt/app/
rsync -aHAX src/ dst/                            # hard link, ACL, xattr ham (to'liq nusxa/backup)
rsync -a --checksum src/ dst/                    # mtime'ga ishonmay, mazmun bo'yicha (sekin)
rsync -a --bwlimit=10m src/ lab:/backup/         # prod tarmog'ini bo'g'masin
```

### Yo'l oxiridagi `/` — eng ko'p uchraydigan tuzoq

```
 rsync -a site  /dst/   ->  /dst/site/index.html     "papkaning O'ZINI"
 rsync -a site/ /dst/   ->  /dst/index.html          "papkaning ICHIDAGILARINI"
```

Faqat **manba**dagi `/` muhim. Qoida: doim manba va manzil oxiriga `/` qo'ying va nima bo'lishini `-n` bilan ko'ring.

### `--delete` — eng xavfli opsiya

> **Ogohlantirish:** `--delete` manzilni manbaga **aynan** o'xshatadi. Manba noto'g'ri yoki **bo'sh** bo'lsa (masalan, build muvaffaqiyatsiz bo'lib `dist/` bo'sh qoldi), manzildagi **hamma narsa o'chiriladi**.

```bash
# Naive
rsync -a --delete "$SRC/" lab:/var/www/site/

# Production
set -euo pipefail
[[ -n "${SRC:-}" && -f "$SRC/index.html" ]] || { echo "manba noto'g'ri: $SRC" >&2; exit 1; }
rsync -a --delete --dry-run --itemize-changes "$SRC/" lab:/var/www/site/ | tail -20   # ko'rib chiqish
rsync -a --delete --max-delete=50 "$SRC/" lab:/var/www/site/                          # tormoz
```

`--max-delete` — kutilmagan ommaviy o'chirishdan oxirgi himoya. Va 5-darsdagi qoida: `${SRC:?}` / `set -u`.

## 4. Fayl buzilmasdan yetib keldimi — tekshirish

SSH transport'ni himoyalaydi, lekin manba disk xatosi, yarim yozilgan fayl yoki noto'g'ri versiya — boshqa masala.

```bash
sha256sum app.tar.gz > app.tar.gz.sha256          # yuborishdan oldin
scp app.tar.gz app.tar.gz.sha256 lab:/tmp/
ssh lab 'cd /tmp && sha256sum -c app.tar.gz.sha256'   # -> app.tar.gz: OK
```

Artefakt'lar (release, backup) uchun checksum — standart amaliyot. Supply chain uchun — imzo (16-dars g'oyasi).

## 5. Saytni yarim yangilangan holatda qoldirmaslik (atomic deploy)

**Muammo:** `rsync` ishlayotgan papkaga to'g'ridan-to'g'ri yozsa, bir necha soniya davomida foydalanuvchilar **aralash** holatni ko'radi: yangi HTML, eski JS. Uzilsa — sayt buzilgan holda qoladi.

```
 Naive:   rsync site/ lab:/var/www/site/        -> jonli papka o'zgarish paytida "yarim"
 Better:  rsync -> /var/www/releases/2026-10-01T1430/
          ln -sfn + mv -T -> /var/www/current    -> atomic switch (5-dars)
          nginx root /var/www/current;
 Rollback: current'ni oldingi release'ga qaytarish — bir soniya
```

```bash
REL=/var/www/releases/$(date +%Y%m%dT%H%M%S)
rsync -a --link-dest=/var/www/current/ site/ "lab:$REL/"     # o'zgarmagan file'lar hard link — joy tejaydi
ssh lab "ln -sfn $REL /var/www/current.tmp && mv -T /var/www/current.tmp /var/www/current"
ssh lab "sudo systemctl reload nginx"
```

`--link-dest` — o'zgarmagan fayllarni oldingi release'dan **hard link** qiladi (5-dars): har release to'liq ko'rinadi, lekin diskda faqat farq joy egallaydi. Xuddi shu texnika bilan **inkremental backup**'lar quriladi.

## 6. scp, rsync yoki sftp — qaysi birini tanlash

| Savol | Tanlov |
|---|---|
| Bitta kichik fayl, bir marta | `scp` |
| Papka, takroriy, faqat farq | `rsync -a` |
| Katta fayl, tarmoq beqaror | `rsync -aP` |
| Manzil manbaga aynan teng bo'lishi kerak | `rsync -a --delete` (dry-run bilan) |
| Ruxsat, owner, ACL saqlanishi kerak | `rsync -aHAX` (owner uchun manzilda root) |
| Interaktiv ko'rish / GUI | `sftp` / FileZilla |
| Juda ko'p server'ga | Ansible (`synchronize`/`copy`) yoki artefakt + pull |

### Sudo kerak bo'lgan manzil

`/var/www`'ga oddiy user yoza olmaydi. Variantlar:

| Variant | Afzallik va kamchilik |
|---|---|
| Avval `/tmp`'ga, keyin `ssh lab sudo cp` | Ikki qadam, oddiy |
| `rsync --rsync-path="sudo rsync"` | Bir qadam, lekin user'ga `rsync` uchun sudo kerak — **bu amalda root** (11-dars: rsync orqali istalgan faylni yozish mumkin) |
| **Papka egasini deploy user'ga berish** (`chown deploy:www-data`, 2775) | To'g'ri: sudo kerak emas, eng kam huquq tamoyili |

## 7. FileZilla (SFTP)

1. Fayl -> Site Manager -> New site.
2. Protocol: **SFTP** — SSH Fayl Transfer Protocol, Port 22.
3. Logon type: **Key fayl** (`id_ed25519`) yoki agent; parol emas.
4. Chap — local, o'ng — remote. Drag & drop.

> **FTP emas, SFTP.** Klassik FTP parol va data'ni ochiq matnda yuboradi (telnet kabi, 17-dars). FTPS (FTP + TLS) — boshqa protokol, firewall bilan murakkab. SSH bor bo'lsa — SFTP.

> **Xavfsizlik tuzog'i:** FileZilla ba'zi versiyalarda saqlangan parollarni lokal faylda shifrlanmagan holda saqlagan — bu malware'ning sevimli nishoni. Master password yoqing yoki faqat kalit/agent ishlating.

**GUI'ning cheklovi:** takrorlanmaydi va audit qilinmaydi. Production deploy uchun GUI — anti-usul; o'rganish, ko'rib chiqish va bir martalik ish uchun normal.

## 8. Fayl ko'chirish qachon deploy uchun yetmay qoladi

`rsync` bilan deploy — kursdagi birinchi "CI/CD". Lekin u masshtabda cheklangan:

| Muammo | Yetuk yechim |
|---|---|
| Server'da nima versiya turgani noaniq | Versiyalangan artefakt (tag, checksum) |
| 20 server'ga ketma-ket rsync — ba'zilari muvaffaqiyatsiz | Rolling deploy vosita (Ansible, K8s) |
| Server'da qo'lda o'zgartirilgan fayllar | Immutable artefakt: image / paket |
| Rollback | Oldingi image/release'ga qaytish |

```
 Evolyutsiya:
 FileZilla -> scp -> rsync script -> rsync + atomic symlink -> CI pipeline + artefakt
          -> container image + registry + orchestrator (pull, rolling, rollback)
```

> **Chuqurroq qarash:** har bosqich o'z vaqtida to'g'ri. 1 server va kichik sayt uchun `rsync` + atomic symlink — mukammal va sodda yechim. Kubernetes'ga faqat real constraint'lar talab qilganda o'ting (1-dars: complexity'ni qo'shish oson, olib tashlash qiyin).

## 9. Nima buzilishi mumkin

| Belgi | Asl sabab | Yechim |
|---|---|---|
| Papka ichida papka (`/dst/site/site/`) | Trailing slash | Manba oxiriga `/` |
| Manzil bo'shab qoldi | `--delete` + bo'sh/noto'g'ri manba | Validatsiya, dry-run, `--max-delete` |
| Har safar hamma fayl qayta yuboriladi | mtime saqlanmayapti (`-a`siz), yoki FS vaqt aniqligi farqi | `-a`; FAT/SMB'da `--modify-window=1` |
| `Permission denied` manzilda | Deploy user yoza olmaydi | Papka egaligi (sudo emas) |
| Owner'lar saqlanmadi | Manzilda root emas | Normal: oddiy user owner'ni o'zgartira olmaydi (11-dars) |
| Katta transfer uzildi | Tarmoq | `rsync -aP` va qayta ishga tushirish |
| Prod tarmog'i sekinlashdi | Backup kanalni to'ldirdi | `--bwlimit`, tungi oyna |
| `rsync: command not found` (remote) | Remote'da rsync o'rnatilmagan | Ikkala tomonda ham kerak |

## Amaliy mashg'ulot — real mashq

1. Local'da `site/index.html` yarating; `scp` bilan VM'ga yuboring.
2. `rsync -avn` bilan `site` va `site/` farqini dry-run'da ko'ring.
3. Deploy user uchun `/var/www/site` egaligini sozlang (sudo'siz yozish).
4. `rsync` bilan sinxronlang; brauzerda nginx sahifangizni ko'ring.
5. `index.html`'ni o'zgartirib, yana `rsync -av` — faqat 1 fayl ketganini ko'ring.
6. Xavfli eksperiment (VM'da): bo'sh `empty/` papkadan `--delete -n` bilan nima o'chishini ko'ring; `--max-delete=1` qanday to'xtatishini sinang.
7. Atomic deploy: `releases/` + `current` symlink bilan 2 ta release qiling va rollback'ni bajaring.
8. 500 MB fayl yarating (`head -c 500M /dev/urandom > big`), `rsync -aP` bilan yuboring, o'rtada `Ctrl+C`, qayta ishga tushiring — davom etishini ko'ring; `sha256sum` bilan tekshiring.
9. Server'dan `access.log`'ni yuklab, 7-darsdagi pipeline tahlilini qiling.
10. Xuddi shuni FileZilla'da SFTP + kalit bilan bajaring.

## Uy vazifa

`deploy.sh` yozing — birinchi CI/CD'ingiz:
- `set -euo pipefail`, manba validatsiyasi;
- yangi release papkasiga `rsync -a --link-dest`;
- atomic symlink switch, `nginx -t` va reload;
- `curl -fsS` bilan smoke test — muvaffaqiyatsiz bo'lsa, avtomatik rollback;
- oxirgi 5 ta release'dan eskilarini tozalash.

Har qadam uchun "bu qadam muvaffaqiyatsiz bo'lsa nima bo'ladi?" savoliga javob yozing.

## Test savollari

1. `scp -P` va `ssh -p` farqi?
2. rsync qanday qilib faqat farqni yuboradi? Qaysi fayl o'zgarganini qanday biladi?
3. `rsync src/ dst` va `rsync src dst` farqi?
4. `--delete`'dan oldin nima qilish kerak? Qanday qo'shimcha himoyalar bor?
5. `-z` qachon foydali, qachon zarar?
6. Nega jonli papkaga to'g'ridan-to'g'ri rsync qilish yomon? Atomic deploy qanday ishlaydi?
7. `--link-dest` nima beradi?
8. Nega `--rsync-path="sudo rsync"` amalda root berish?
9. Nega FTP emas, SFTP?
10. Qachon rsync deploy'dan artefakt/image deploy'ga o'tish kerak?

## Ko'p uchraydigan xatolar

- Trailing slash'ni tekshirmasdan sinxronlash.
- `--delete`'ni dry-run va validatsiyasiz ishlatish.
- Jonli papkani joyida yangilash.
- Deploy uchun sudo ishlatish, papka egaligini to'g'ri sozlash o'rniga.
- Katta transfer'ni `scp` bilan, uzilsa boshidan.
- Checksum'siz backup/artefakt.
- FTP yoki GUI orqali production deploy.

## Xulosa

- Bitta fayl — `scp`, papka va takroriy — `rsync`, interaktiv — SFTP/FileZilla. Hammasi SSH ustida.
- rsync: delta algoritmi + quick check (hajm, mtime). `-a` metadata'ni saqlaydi, `-P` uzilishga chidamli.
- Trailing slash va `--delete` — eng ko'p data yo'qotadigan xatolar: dry-run, validatsiya, `--max-delete`.
- Atomic deploy: yangi release papkasi + symlink switch + smoke test + rollback. `--link-dest` joy tejaydi.
- Fayl ko'chirish — boshlanish nuqtasi; masshtabda versiyalangan artefakt va orchestrator. Eng sodda yetarli yechimni tanlang.
