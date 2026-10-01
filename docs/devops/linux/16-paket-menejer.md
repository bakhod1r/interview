# Dars 16 — Paket menejeri

> **Natija:** dasturni repo'dan o'rnatish, o'chirish, yangilash; `apt` va `dnf` ekvivalentlarini bilish. Paket menejeri qaysi muammoni hal qiladi, dependency resolution, GPG imzo va supply chain, versiya pinning, xavfsiz yangilash strategiyasi, container'da paketlar.

## 1. Muammo — dasturni qanday o'rnatish?

Nginx'ni qo'lda o'rnatish:
1. Source yoki binary'ni yuklab olish — qayerdan? haqiqiymi?
2. Unga kerak bo'lgan kutubxonalar (`libssl`, `libpcre`) — ularga ham kerak bo'lganlar...
3. Fayllarni to'g'ri joyga qo'yish (8-dars FHS), user yaratish, systemd unit.
4. 3 oydan keyin xavfsizlik patch — hammasini qaytadan, qaysi fayl qaysi dasturniki ekanini eslab.
5. O'chirish — qaysi fayllar? Hech kim bilmaydi.

**Paket menejeri hal qiladi:** ishonchli manba, avtomatik dependency, ma'lum joylashuv, bir buyruqda yangilash va toza o'chirish.

## 2. Paket va repository nima

**Paket** = fayllar arxivi + metadata (nom, versiya, arxitektura, **dependency**'lar, conflict'lar) + o'rnatish script'lari (postinst: user yaratish, servisni yoqish).

| Oila | Format | Past daraja (bitta fayl) | Yuqori daraja (repo + dependency) |
|---|---|---|---|
| Debian/Ubuntu | `.deb` | `dpkg` | **`apt`** |
| RHEL/Rocky/Fedora | `.rpm` | `rpm` | **`dnf`** (eski `yum`) |
| Alpine | `.apk` | — | `apk` |

```
 sudo apt install nginx
     |
     +-> /etc/apt/sources.list.d/*.sources   -> repo manzillari
     +-> lokal indeks (/var/lib/apt/lists)    -> "apt update" yangilaydi
     +-> dependency resolution                -> nginx -> libssl3, libpcre2 ...
     +-> yuklash -> GPG imzo / hash tekshirish
     +-> dpkg o'rnatadi -> postinst script'lar -> servis yoqiladi
     +-> /var/lib/dpkg/                       -> "qaysi file qaysi paketniki" bazasi
```

## 3. apt

```bash
sudo apt update              # indeksni yangilash (hech narsa o'rnatmaydi!)
sudo apt upgrade             # o'rnatilganlarni yangilash (o'chirmasdan)
sudo apt full-upgrade        # kerak bo'lsa dependency o'zgartiradi (3-dars)
sudo apt install nginx htop
sudo apt install -y curl     # tasdiqsiz (script'larda)
sudo apt install --no-install-recommends nginx   # faqat zarur dependency'lar
sudo apt remove nginx        # o'chirish (config qoladi)
sudo apt purge nginx         # config bilan
sudo apt autoremove          # endi kerak bo'lmagan dependency'lar
apt search redis
apt show nginx               # versiya, dependency, hajm
apt policy nginx             # qaysi versiya qaysi repo'dan, nima o'rnatilgan
apt list --upgradable
apt list --installed | grep nginx
dpkg -L nginx                # paket file'lari qayerda
dpkg -S /usr/sbin/nginx      # bu file qaysi paketdan
```

> **Tuzoq:** `update` != `upgrade`. `update` — menyuni yangilash, `upgrade` — ovqatni almashtirish. Yangi VM'da `apt install` "Unable to locate package" bersa — avval `update`.

> **Script tuzog'i:** script'larda `apt` emas, `apt-get` ishlating — `apt` interaktiv foydalanish uchun, uning chiqish formati barqaror emas (o'zi ogohlantiradi). Va `DEBIAN_FRONTEND=noninteractive` — aks holda paket savol berib, pipeline osilib qoladi.

### Dependency'larni hal qilish nega qiyin

```
 app-A kerak: libfoo >= 2.0
 app-B kerak: libfoo <  2.0
 -> ikkalasi bitta tizimda bo'la olmaydi ("dependency hell")
```

Distro buni bitta, bir-biriga mos versiyalar to'plamini (release) saqlab hal qiladi. Shuning uchun Ubuntu 24.04'da nginx'ning versiyasi "eski" ko'rinadi — u **barqarorlik** uchun muzlatilgan, xavfsizlik patch'lar esa **backport** qilinadi (versiya raqami o'zgarmasa ham, CVE yopilgan bo'lishi mumkin).

> **Xavfsizlik audit tuzoq:** scanner "nginx 1.24 — CVE bor" desa, darhol vahima qilmang: distro patch'ni backport qilgan bo'lishi mumkin. Tekshirish: `apt changelog nginx` yoki distro'ning CVE tracker'i.

## 4. apt va dnf buyruqlari solishtirmasi

| Amal | Ubuntu | Rocky/RHEL |
|---|---|---|
| Indeks | `apt update` | `dnf makecache` (odatda avtomatik) |
| Yangilash | `apt upgrade` | `dnf upgrade` |
| O'rnatish | `apt install X` | `dnf install X` |
| O'chirish | `apt remove X` | `dnf remove X` |
| Qidirish | `apt search X` | `dnf search X` |
| Ma'lumot | `apt show X` | `dnf info X` |
| Fayl egasi | `dpkg -S f` | `rpm -qf f` |
| Paket fayllari | `dpkg -L X` | `rpm -ql X` |
| Tarix / rollback | `/var/log/apt/history.log` | `dnf history`, `dnf history undo N` |

## 5. O'rnatilayotgan dasturga qanday ishonamiz (supply chain xavfsizlik)

Paket o'rnatganda siz **root huquqi bilan begona kod** ishga tushiryapsiz (postinst script'lar root sifatida ishlaydi). Ishonch zanjiri:

```
 Distro maintainer kalit bilan imzolaydi
   -> repo metadata (Release / repomd) imzolangan
   -> metadata ichida har paketning hash'i
   -> apt yuklab, imzo va hash'ni tekshiradi
 Natija: tarmoqda kimdir paketni almashtirsa (MITM) — rad etiladi
```

Shuning uchun HTTP repo ham nisbatan xavfsiz — imzo HTTPS'dan mustaqil himoya beradi (lekin HTTPS maxfiylik qo'shadi).

### Boshqa kompaniya repo'sini to'g'ri qo'shish

```bash
# Naive (xavfli): kalitga BARCHA repo'lar uchun ishonish
curl -fsSL https://example.com/key.gpg | sudo apt-key add -      # apt-key eskirgan

# Production: kalit faqat shu repo uchun (signed-by)
sudo install -d -m 0755 /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu noble stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list
```

`signed-by` muhim: aks holda Docker kaliti bilan imzolangan **istalgan** paket Ubuntu'ning asosiy paketlarini ham "almashtira" olardi.

### `curl ... | bash` — nega xavfli

| Xavf | Izoh |
|---|---|
| Nima ishga tushayotganini ko'rmaysiz | Script'ni o'qimadingiz |
| Server user-agent'ga qarab boshqa narsa berishi mumkin | Brauzerda toza, `curl`'da zararli |
| Yuklash o'rtada uzilsa — yarim script bajariladi | `rm -rf /tmp/foo` -> `rm -rf /` (uzilish joyiga qarab) |
| Imzo yo'q, versiya yo'q, rollback yo'q | Takrorlanmaydi |

Yaxshiroq: yuklab olish -> o'qish -> checksum/imzo tekshirish -> ishga tushirish. Yoki rasmiy paket/repo.

## 6. Versiya va yangilash strategiyasi

### Versiyani qotirib qo'yish (pinning)

```bash
sudo apt-mark hold postgresql-16     # avtomatik yangilanmasin
apt-mark showhold
sudo apt install nginx=1.24.0-2ubuntu7   # aniq versiya
```

**Afzallik va kamchilik:** hold — kutilmagan major yangilanishdan himoya, lekin xavfsizlik patch'lar ham to'xtaydi. Hold qilingan paketlarni ro'yxatda saqlang va muntazam ko'rib chiqing.

### Xavfsizlik yangilanishlarini avtomatik o'rnatish

```bash
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
cat /etc/apt/apt.conf.d/50unattended-upgrades
ls /var/run/reboot-required      # kernel yangilangan — reboot kerak
```

| Strategiya | Afzallik | Xavf |
|---|---|---|
| Hech narsa avtomatik emas | Nazorat | Patch'lar oylab qo'yilmaydi (eng ko'p uchraydigan holat) |
| Faqat xavfsizlik avtomatik | Tez himoya | Kamdan-kam regression |
| Hammasi avtomatik | Doim yangi | Kutilmagan o'zgarish prod'da |
| **Immutable image** (patch -> yangi image -> rolling deploy) | Test qilingan, takrorlanadigan, rollback oson | Pipeline kerak |

> **Chuqurroq qarash:** ko'p server'li tizimda "server'da `apt upgrade`" — config drift manbai: har server biroz boshqa vaqtda, boshqa versiya bilan yangilanadi. Yetuk yondashuv — paketlar **image build** vaqtida o'rnatiladi (Packer, Dockerfile), server'lar yangi image bilan almashtiriladi (3-dars evolyutsiyasi). Lekin bunda ham xavfsizlik update'lar uchun muntazam **rebuild** jarayoni bo'lishi shart.

### Oldingi versiyaga qaytish (rollback)

- apt: eski versiyani aniq o'rnatish (`apt install pkg=old-version`), agar u repo/cache'da bo'lsa. Kafolat yo'q.
- dnf: `dnf history undo` — qulayroq.
- Ishonchli rollback: VM snapshot (3-dars) yoki oldingi image.

## 7. Docker image ichida paket o'rnatish

```dockerfile
# Naive: katta image, keraksiz cache, har build'da boshqa versiyalar
RUN apt-get update
RUN apt-get install -y curl

# Production
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*
```

| Qaror | Nega |
|---|---|
| `update` va `install` bitta `RUN`'da | Alohida bo'lsa, `update` layer'i cache'lanadi va keyingi build'larda eski indeks bilan o'rnatiladi |
| `--no-install-recommends` | Image kichik, hujum yuzasi kichik |
| `rm -rf /var/lib/apt/lists/*` | Indeks image'da qolmasin |
| Multi-stage build | Compiler va build vositalar yakuniy image'ga tushmasin |
| Distroless / scratch (Go) | Paket menejeri umuman yo'q — hujumchi `apt install` qila olmaydi (2-dars) |

## 8. Dastur o'rnatishning boshqa usullari

| Usul | Qachon | Afzallik va kamchilik |
|---|---|---|
| `.deb` fayl: `sudo apt install ./app.deb` | Vendor faqat fayl beradi | Dependency hal qilinadi, lekin yangilanish qo'lda |
| Rasmiy 3rd-party repo | Yangi versiya kerak (Docker, PostgreSQL) | Ishonch doirasi kengayadi |
| `snap` / Flatpak | Desktop, izolyatsiya | Server'da kamdan-kam, avtomatik yangilanadi |
| Statik binary (`/usr/local/bin`) | Go vositalar (terraform, kubectl) | Paket bazasida yo'q — inventarizatsiya va yangilash qo'lda; checksum tekshiring |
| Til paket menejerlari (pip, npm, go) | App dependency'lari | Tizim paketlari bilan aralashtirmang: `pip install` tizim Python'iga emas, venv'ga |

> **Tuzoq:** Ubuntu 24.04'da tizim Python'iga `pip install` qilish `externally-managed-environment` xatosi bilan rad etiladi (PEP 668) — bu ataylab: `pip` apt o'rnatgan paketlarni buzmasligi uchun. Yechim: `python3 -m venv`, yoki `pipx` vositalar uchun.

## 9. Nima buzilishi mumkin

| Belgi | Asl sabab | Yechim |
|---|---|---|
| `Unable to locate package` | `apt update` qilinmagan / repo yo'q | `update`, `apt policy` |
| `Could not get lock /var/lib/dpkg/lock-frontend` | Boshqa apt ishlayapti (ko'pincha unattended-upgrades) | Kuting; lock faylni **o'chirmang** |
| `dpkg was interrupted` | O'rnatish uzilgan | `sudo dpkg --configure -a` |
| `unmet dependencies` / held broken packages | Aralash repo'lar, hold | `apt -f install`, `apt policy`, repo'larni tekshirish |
| `NO_PUBKEY` / `signature invalid` | Repo kaliti yo'q yoki eskirgan | Kalitni rasmiy manbadan `signed-by` bilan |
| Disk to'ldi, `/var/cache/apt` katta | Cache | `apt clean` |
| Yangilashdan keyin servis buzildi | Config yoki major versiya o'zgarishi | `history.log`, rollback, hold + test muhiti |

## Amaliy mashg'ulot

1. Yangi VM'da `apt update`siz `apt install htop` -> xato bo'lishi mumkin -> `update` -> ishlaydi.
2. `htop`, `tree`, `curl`, `jq` o'rnating. `apt show jq` va `apt policy jq`'ni o'qing.
3. `dpkg -L htop` — fayllari qayerga tushdi (FHS bilan solishtiring)?
4. `nginx`'ni `remove` qiling -> `/etc/nginx` qoldimi? -> `purge` -> qoldimi?
5. `command -v ls` -> `dpkg -S` bilan qaysi paketdan ekanini toping.
6. `apt-mark hold htop`, `apt list --upgradable`, keyin `unhold`.
7. Docker rasmiy repo'sini `signed-by` bilan qo'shing (o'rnatish shart emas, `apt policy docker-ce` bilan tekshiring).
8. `cat /var/log/apt/history.log` — bugun nima o'rnatildi?

## Uy vazifa

1. Rocky VM'da (yoki Docker `rockylinux:9`) xuddi shu qadamlarni `dnf` bilan bajaring; `dnf history undo` bilan rollback qiling.
2. 20 ta server uchun yangilash strategiyasini yozing: xavfsizlik update'lar, kernel reboot'lari, test muhiti, rollback.
3. `apt-key add` va `signed-by` farqini xavfsizlik nuqtai nazaridan tushuntiring.

## Test savollari

1. `apt update` va `apt upgrade` farqi?
2. `remove` va `purge` farqi?
3. Dependency nima va "dependency hell" qanday hal qilinadi?
4. Nega distro'dagi versiya eski, lekin xavfsiz bo'lishi mumkin (backport)?
5. Paket imzosi qanday himoya beradi?
6. Nega `curl | bash` xavfli?
7. `signed-by` nima uchun kerak?
8. Dockerfile'da nega `apt-get update` va `install` bitta `RUN`'da?
9. `apt-mark hold`'ning afzallik va kamchiligi?
10. Lock xatosida nega lock faylni o'chirmaslik kerak?

## Ko'p uchraydigan xatolar

- `update`'siz `install`.
- Script'larda interaktiv `apt` va `noninteractive`'siz ishlatish.
- `curl | sudo bash` bilan o'rnatish.
- 3rd-party kalitni global ishonchli qilish.
- Tizim Python'iga `pip install`.
- Hold qilingan paketlarni unutish — patch'lar yillab qo'yilmaydi.
- dpkg lock faylini o'chirish.

## Xulosa

- Paket menejeri = ishonchli manba + dependency resolution + "qaysi fayl kimniki" bazasi + toza yangilash/o'chirish.
- Ishonch zanjiri — GPG imzo; 3rd-party repo faqat `signed-by` bilan; `curl | bash` — o'qilmagan root kod.
- Distro barqarorlik uchun versiyani muzlatadi va patch'larni backport qiladi.
- Yangilash — strategiya: xavfsizlik tez, major — test bilan; masshtabda — image rebuild va rolling deploy.
- Container'da: bitta `RUN`, `--no-install-recommends`, cache'ni tozalash, imkon bo'lsa distroless.
