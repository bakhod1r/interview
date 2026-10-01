# Dars 3 — Linux o'rnatish (VM / WSL)

> **Natija:** ishlaydigan Ubuntu Server 24.04 LTS (kursning qolgan qismi shu server'da o'tadi), snapshot va network mode'lar tushunchasi. Hypervisor turlari, cloud image, cloud-init va "server qo'lda emas, kod bilan yaratiladi" tamoyili.

## 1. Virtualizatsiya — bitta kompyuterda bir nechta OS

**Hypervisor** — bitta fizik kompyuterda bir nechta OS'ni ishlatadigan dastur. Har OS o'zini alohida kompyuterda deb o'ylaydi.

```
 Type 2 (hosted)                         Type 1 (bare-metal)
 +-- VM --+ +-- VM --+                  +-- VM --+ +-- VM --+
 | guest  | | guest  |                  | guest  | | guest  |
 +--------+ +--------+                  +--------+ +--------+
  VirtualBox / UTM                       KVM / ESXi / Hyper-V
  Host OS (macOS/Windows)                Hardware
  Hardware
```

| | Type 1 | Type 2 |
|---|---|---|
| Qayerda ishlaydi | To'g'ridan-to'g'ri hardware ustida | Oddiy OS ichida dastur sifatida |
| Overhead | Kam | Ko'proq (host OS ham resurs yeydi) |
| Qayerda ishlatiladi | Production: AWS (Nitro, KVM asosida), GCP, VMware ESXi | Noutbukda o'rganish |

> **Nozik jihat:** KVM — Linux kernel module. U Linux'ning o'zini Type 1 hypervisor'ga aylantiradi. Shuning uchun chegara har doim aniq emas — muhimi, guest bilan hardware o'rtasida qancha qatlam borligi.

**Hardware virtualization** (Intel VT-x / AMD-V, Apple Silicon'da Hypervisor.framework): CPU guest kodini to'g'ridan-to'g'ri, deyarli native tezlikda bajaradi. BIOS/UEFI'da o'chiq bo'lsa, VM juda sekin ishlaydi yoki umuman ishga tushmaydi.

## 2. Qaysi Linux versiyasini (image) tanlash kerak

| Tanlov | Tavsiya | Sabab |
|---|---|---|
| Server va Desktop | **Server** | GUI yo'q, production'ga o'xshash, kam resurs |
| Version | **24.04 LTS** | LTS — 5 yil standart xavfsizlik update (Ubuntu Pro bilan 10+ yil) |
| Architecture | `amd64` yoki `arm64` | Host CPU'ga mos bo'lishi shart |

**Nega LTS:** production'da bir server'ni yillab ishlatasiz. Non-LTS release 9 oy qo'llab-quvvatlanadi — keyin xavfsizlik patch yo'q. Server uchun LTS'dan boshqasini tanlashga deyarli sabab yo'q.

### Tuzoq: CPU architecture

Apple Silicon (M-seriya) — `arm64`. Ko'p production server'lar — `amd64` (lekin AWS Graviton kabi `arm64` server'lar ham ko'paymoqda — arzonroq).

```bash
uname -m                   # x86_64 (= amd64) yoki aarch64 (= arm64)
docker buildx build --platform linux/amd64,linux/arm64 -t app .   # multi-arch image
```

Mac'da build qilingan `arm64` image `amd64` server'da `exec format error` beradi. Bu klassik "noutbukda ishlaydi, prod'da yo'q" muammosi.

## 3. VM'ni qaysi dastur bilan yaratish kerak

| Host OS | Vosita | Izoh |
|---|---|---|
| Windows | **WSL2** yoki VirtualBox / Hyper-V | WSL2 tez, lekin to'liq server emas |
| macOS Apple Silicon | **UTM** yoki **Multipass** | VirtualBox Apple Silicon'da cheklangan |
| Linux | KVM + virt-manager | Native, eng tez |
| Hamma OS | **Multipass** | Bitta buyruq: `multipass launch 24.04 --name lab` |

### WSL2 cheklovlari — nega bu "to'liq server" emas

- WSL2 — Hyper-V ustidagi yengil VM, Microsoft'ning maxsus kernel'i bilan.
- `systemd` eski versiyalarda default o'chiq: `/etc/wsl.conf` ichida `[boot]` bo'limiga `systemd=true` yozib, `wsl --shutdown` qiling.
- Network NAT orqali: tashqaridan WSL'ga SSH qilish qo'shimcha sozlash talab qiladi.
- Windows fayllari (`/mnt/c`) orqali ishlash juda sekin — loyihani Linux filesystem'ida (`~`) saqlang.

**Qaror:** kurs uchun (SSH, systemd, network darslari) — to'liq VM yaxshiroq. WSL2 — Windows'da kundalik dev ishi uchun.

## 4. VM tarmoqqa qanday ulanadi (network mode'lar)

```
 NAT                          Bridged                      Host-only
 +------+                     +------+                     +------+
 |  VM  | 10.0.2.15           |  VM  | 192.168.1.50        |  VM  | 192.168.56.10
 +--+---+                     +--+---+                     +--+---+
    | (NAT)                      |                            |
 +--v---+                     +--v-----------+             +--v---+
 | host |---> internet        | LAN router   |---> internet| host | (internet yo'q)
 +------+                     +--------------+             +------+
```

| Mode | VM internet'ga chiqadimi | Host VM'ga kira oladimi | Qachon |
|---|---|---|---|
| **NAT** | ha | yo'q (port forward kerak) | Default, eng xavfsiz |
| **Bridged** | ha | ha (VM LAN'dan IP oladi) | SSH lab, VM tarmoqda "haqiqiy" kompyuter |
| **Host-only** | yo'q | ha | Izolyatsiya qilingan lab |
| **NAT + Host-only** (2 adapter) | ha | ha | Kurs uchun eng qulay kombinatsiya |

> **Tuzoq:** Bridged mode kafe/ofis Wi-Fi'da ishlamasligi mumkin (ba'zi tarmoqlar bir MAC'dan ko'p IP bermaydi). Shunda NAT + port forward (host:2222 -> VM:22) yoki NAT + Host-only ishlating.

Bu aynan production'dagi tushunchalarning kichik modeli: NAT = private subnet + NAT gateway, Bridged = public IP, Host-only = izolyatsiya qilingan VPC.

## 5. O'rnatish

1. ISO: ubuntu.com/download/server (yoki `multipass launch 24.04`).
2. VM resurslari: **2 vCPU, 2–4 GB RAM, 20+ GB disk**.
3. Storage: **LVM** bilan — keyin disk'ni reboot'siz kengaytirish oson.
4. Belgilang: `Install OpenSSH server`.
5. User: `student`, kuchli parol.

O'rnatgandan keyin:

```bash
whoami && hostname
ip -br a                       # IP'lar qisqa ko'rinishda
lsblk                          # disk va partition'lar (LVM ko'rinadi)
df -h /                        # root filesystem hajmi
sudo apt update && sudo apt full-upgrade -y
```

> **Ubuntu tuzog'i:** LVM bilan o'rnatganda installer default holatda disk'ning faqat bir qismini (masalan, yarmini) root'ga beradi. `df -h /` kichik ko'rinsa:
> ```bash
> sudo lvextend -r -l +100%FREE /dev/ubuntu-vg/ubuntu-lv
> ```
> `-r` filesystem'ni ham birga kengaytiradi.

### `apt upgrade` vs `apt full-upgrade`

- `upgrade` — paketlarni yangilaydi, lekin hech narsani o'chirmaydi va yangi dependency qo'shmaydi.
- `full-upgrade` — kerak bo'lsa dependency'larni o'zgartiradi (kernel yangilanishi uchun kerak bo'lishi mumkin).
- Kernel yangilangandan keyin **reboot** kerak: `ls /var/run/reboot-required`.

## 6. Snapshot nega backup o'rnini bosmaydi

```
 base disk  <--  snapshot 1  <--  snapshot 2  <--  hozirgi holat
 (o'qish)        (faqat o'zgarishlar, copy-on-write)
```

- **Snapshot** — VM holatining **copy-on-write** nuqtasi. Bir zumda olinadi, chunki faqat keyingi o'zgarishlar alohida yoziladi.
- Snapshot **o'sha disk'da** turadi. Disk buzilsa — snapshot ham yo'q.
- Uzun snapshot zanjiri disk I/O'ni sekinlashtiradi: o'qish har qatlamdan qidiradi.
- **Backup** — boshqa joyda (boshqa disk, boshqa region) saqlanadigan mustaqil nusxa.

| | Snapshot | Backup |
|---|---|---|
| Tezlik | Bir zumda | Sekin (nusxa ko'chiriladi) |
| Qayerda | O'sha storage | Alohida joy |
| Nimadan himoya qiladi | Xato o'zgarish (rollback) | Disk/server/region yo'qolishi |
| Qachon | O'zgarishdan oldin | Muntazam, jadval bo'yicha |

> **Chuqurroq qarash:** backup'ning qiymati — **restore** qila olishingizda. Hech qachon restore qilib ko'rilmagan backup — gipoteza. Production'da restore'ni muntazam sinab ko'rish (restore drill) majburiy.

### Database tuzog'i

Ishlayotgan DB'li VM snapshot'i **crash-consistent** bo'ladi: elektr o'chgandek holat. PostgreSQL WAL tufayli odatda tiklanadi, lekin to'g'ri backup — `pg_dump` / `pg_basebackup` yoki managed service'ning o'z backup'i.

## 7. Haqiqiy loyihalarda server qanday yaratiladi: cloud image + cloud-init

Real hayotda server'ga ISO'dan qo'lda o'rnatilmaydi. Nega?

| Qo'lda o'rnatish | Muammo |
|---|---|
| 20 daqiqa klik | 100 ta server = 33 soat |
| Har safar biroz boshqacha | **Config drift**: "nega bu server'da ishlaydi, unda yo'q?" |
| Hujjatlashtirilmagan | Server o'lsa — qanday sozlangan edi, hech kim bilmaydi |

**Yechim:** cloud provider tayyor **cloud image**'dan VM ko'taradi, birinchi boot'da **cloud-init** uni sozlaydi:

```yaml
#cloud-config
users:
  - name: deploy
    groups: sudo
    shell: /bin/bash
    ssh_authorized_keys:
      - ssh-ed25519 AAAA... deploy@laptop
package_update: true
packages: [nginx, htop]
runcmd:
  - systemctl enable --now nginx
```

### Server yaratish usullari: qo'ldan to'liq avtomatlashtirishgacha

```
 1. Qo'lda (ISO, klik)                 -> lab uchun normal
 2. Bash script                        -> takrorlanadi, lekin idempotent emas
 3. cloud-init                         -> birinchi boot'da avtomatik
 4. Terraform + cloud-init             -> infra ham kod (IaC), git'da, review bilan
 5. Packer bilan tayyor image (golden) -> boot tez, har server bir xil (immutable)
 6. Container + Kubernetes             -> server'lar "cattle", app image'da
```

Har qadam — **afzallik va kamchilik**: ko'proq avtomatlashtirish = ko'proq vosita, o'rganish va maintenance. 1 ta server uchun Terraform ortiqcha bo'lishi mumkin. 50 ta uchun — majburiy.

> **Xavfsizlik tuzog'i:** cloud-init `user-data` ichiga parol yoki secret yozmang — ko'p cloud'larda u metadata service orqali VM ichidan o'qiladi va log'larda qoladi. Secret'lar uchun — secret manager (Vault, AWS Secrets Manager).

## 8. Nima buzilishi mumkin

| Belgi | Sabab | Yechim |
|---|---|---|
| VM juda sekin | VT-x/AMD-V o'chiq | BIOS/UEFI'da yoqing |
| `exec format error` | arm64/amd64 mos emas | `uname -m`, multi-arch build |
| Host'dan VM'ga SSH ishlamaydi | NAT mode | Port forward yoki Bridged/Host-only |
| Disk tez to'ldi | LVM'ning yarmi ishlatilmagan / snapshot zanjiri | `lvextend -r`, eski snapshot'larni o'chirish |
| `apt update` xato | DNS yoki vaqt noto'g'ri | `resolvectl status`, `timedatectl` |

## Amaliy mashg'ulot

1. VM o'rnating, `apt full-upgrade` qiling, kerak bo'lsa reboot.
2. `df -h /` tekshiring; kerak bo'lsa LVM'ni kengaytiring.
3. Snapshot `clean-install` oling.
4. `/etc`'da biror narsani ataylab buzing (masalan, `/etc/hostname`ni o'chiring) — snapshot'ga qayting.
5. Host'dan VM'ga `ssh student@<IP>` bilan kiring.
6. Bonus: `multipass launch 24.04 --name ci --cloud-init cloud.yaml` bilan yuqoridagi config'ni sinab ko'ring va `curl localhost` bilan nginx'ni tekshiring.

## Uy vazifa

1. NAT, Bridged va Host-only farqini diagramma bilan tushuntiring. Har biri production'dagi qaysi tushunchaga o'xshaydi?
2. Snapshot va backup farqini 3 gapda yozing. "Backup bor" degan da'voni qanday tekshirasiz?
3. cloud-init config yozing: `app` user, SSH kalit, `git` va `curl` paketlari, timezone `Asia/Tashkent`.

## Test savollari

1. Type 1 va Type 2 hypervisor farqi? AWS qaysi turni ishlatadi?
2. Nega server uchun LTS tanlanadi?
3. Mac'da build qilingan image server'da `exec format error` berdi — nega?
4. Nega snapshot backup emas?
5. Host'dan VM'ga SSH qilish uchun qaysi network mode qulay?
6. cloud-init nima qiladi va qo'lda o'rnatishning qaysi muammosini hal qiladi?
7. Nega cloud-init user-data'ga secret yozmaslik kerak?

## Ko'p uchraydigan xatolar

- Desktop image o'rnatish: GUI resurs yeydi va production'ga o'xshamaydi.
- Snapshot'ni backup deb hisoblash.
- Restore sinab ko'rilmagan backup'ga ishonish.
- Kernel yangilangandan keyin reboot qilmaslik: eski kernel ishlayveradi, patch qo'llanmaydi.
- Prod server'ni qo'lda sozlash va hech qayerda yozmaslik.

## Xulosa

- Lab'da — VM + snapshot: buzish va qaytarish arzon.
- Production'da — cloud image + cloud-init + IaC: server qo'lda emas, kod bilan yaratiladi, shuning uchun takrorlanadi va review qilinadi.
- Snapshot — tez rollback, backup — mustaqil nusxa. Backup'ning qiymati restore'da.
- CPU architecture va network mode — keyinchalik production'da uchraydigan muammolarning kichik modeli.
