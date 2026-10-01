# Dars 17 — OpenSSH server

> **Natija:** server'ga SSH bilan kalit orqali kirish va `sshd`'ni xavfsiz sozlash. SSH protokoli qanday ishlaydi (host key, key exchange, autentifikatsiya), `known_hosts` va MITM, agent forwarding xavfi, jump host, tunnel'lar, o'zingizni qulflab qo'ymaslik va masshtabda SSH (sertifikatlar, bastion, "SSH'siz" boshqaruv).

## 1. Muammo — server uzoqda turibdi, unga qanday ulanamiz?

Server odatda boshqa binoda — data-markazda yoki cloud'da turadi. Uning yonida monitor ham, klaviatura ham yo'q. Demak, uni faqat **tarmoq orqali**, o'z kompyuteringizdan boshqarasiz.

Ilgari buning uchun **telnet** ishlatilgan. Uning katta kamchiligi bor edi: siz yozgan hamma narsa, **parol ham**, tarmoqdan ochiq matn holida o'tardi. Bir Wi-Fi tarmog'idagi istalgan odam uni o'qiy olardi.

**SSH (Secure Shell)** shu muammoni hal qiladi. U to'rtta narsani kafolatlaydi:
- **Maxfiylik (confidentiality)** — trafik shifrlangan, begona o'qiy olmaydi.
- **Server'ning haqiqiyligi (server authentication)** — siz aynan o'zingiz kutgan server'ga ulanyapsiz, o'rtada turgan soxta server'ga (MITM hujumi) emas.
- **Sizning kimligingiz (user authentication)** — server sizni parol yoki kalit orqali taniydi.
- **Butunlik (integrity)** — yo'lda hech kim trafikni sezdirmasdan o'zgartira olmaydi.

Port: **22/TCP**.

```
 Client (laptop)                          Server
 ssh  ======= shifrlangan TCP:22 =======>  sshd (daemon, systemd servis)
```

## 2. SSH ulanishi qadamma-qadam

```
 Client                                         Server
   |---- TCP connect :22 ------------------------->|
   |<--- versiya (SSH-2.0-OpenSSH_9.x) ------------|
   |---- algoritmlar kelishuvi ------------------->|
   |<--- Key exchange (ECDH / post-quantum hybrid) |  -> umumiy session kaliti
   |<--- Server HOST KEY + imzo -------------------|
   |     client: known_hosts'da bu kalit bormi?    |
   |---- User auth: public key imzosi / parol ---->|
   |<--- OK ---------------------------------------|
   |==== shifrlangan kanal: shell, scp, tunnel ====|
```

Ikki xil kalit — chalkashtirmang:

| Kalit | Kimniki | Nimani isbotlaydi | Qayerda |
|---|---|---|---|
| **Host key** | Server | "Men o'sha server'man" | Server: `/etc/ssh/ssh_host_*_key`; client: `~/.ssh/known_hosts` |
| **User key** | Siz | "Men o'sha user'man" | Client: `~/.ssh/id_ed25519`; server: `~/.ssh/authorized_keys` |

**Session kaliti** har ulanishda yangi (key exchange) — host/user kalitlari faqat **autentifikatsiya** uchun. Shuning uchun bir kun kalit o'g'irlansa ham, eski yozib olingan trafikni ochib bo'lmaydi (**forward secrecy**).

### `known_hosts` — haqiqiy server'ga ulanganingizni qanday bilasiz

Birinchi ulanishda:

```text
The authenticity of host '192.168.1.50' can't be established.
ED25519 key fingerprint is SHA256:abc...
Are you sure you want to continue connecting (yes/no)?
```

Bu **TOFU** (Trust On First Use): birinchi marta ishonasiz, keyin kalit eslab qolinadi. Keyinchalik kalit o'zgarsa:

```text
WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!
```

| Sabab | Harakat |
|---|---|
| Server qayta o'rnatildi / yangi VM o'sha IP'da | Sababni **tasdiqlang**, keyin `ssh-keygen -R host` |
| MITM hujumi | Ulanmang! |

> **Anti-usul:** `StrictHostKeyChecking no` va `UserKnownHostsFile /dev/null` — "ogohlantirish xalaqit beryapti" deb. Bu SSH'ning server autentifikatsiyasini butunlay o'chiradi. Production'da yechim — fingerprint'ni oldindan tarqatish (IaC, cloud-init chiqishi) yoki **host sertifikatlari** (9-bo'lim).

## 3. O'rnatish

```bash
sudo apt install openssh-server
sudo systemctl enable --now ssh
systemctl status ssh
ss -tlnp | grep :22          # tinglayaptimi
ip -br a                     # server IP
```

> **Ubuntu 24.04 nuance:** SSH default bo'yicha **socket activation** (`ssh.socket`) bilan ishlaydi — port'ni `ssh.socket` tinglaydi. `sshd_config`'da `Port`'ni o'zgartirsangiz: `sudo systemctl daemon-reload && sudo systemctl restart ssh.socket`. Faqat `restart ssh` bilan yangi port ishlamay qolishi mumkin.

Client'dan:

```bash
ssh student@192.168.1.50
ssh -p 2222 student@host     # boshqa port
ssh lab 'uptime; df -h /'    # bitta command bajarib chiqish
exit
```

## 4. Parol o'rniga kalit bilan kirish

```
 Client                                      Server
 ~/.ssh/id_ed25519      (private, SIR, 600)
 ~/.ssh/id_ed25519.pub  ---- nusxa ---->     ~/.ssh/authorized_keys (600)
```

Private kalit **hech qachon** client'dan chiqmaydi. Server tasodifiy challenge yuboradi, client uni private kalit bilan imzolaydi, server public kalit bilan tekshiradi.

```bash
ssh-keygen -t ed25519 -C "student@laptop"     # passphrase bilan!
ssh-copy-id student@192.168.1.50
ssh student@192.168.1.50                      # endi parolsiz
```

### Nega parol emas, kalit

| | Parol | Kalit |
|---|---|---|
| Brute force | Internet'dagi har server kuniga minglab urinish oladi | Amalda imkonsiz |
| Phishing / qayta ishlatish | Boshqa saytdan o'g'irlangan parol | Kalit faqat sizda |
| Server buzilsa | Parol (yoki hash'i) o'g'irlanadi | Server faqat public kalitni biladi |
| Avtomatlashtirish | Parolni script'ga yozish kerak | Kalit + agent |

**Passphrase:** private kalitni diskda shifrlaydi — noutbuk o'g'irlansa, kalit darhol ishlamaydi. Har safar kiritmaslik uchun — `ssh-agent`. Eng kuchli variant — **hardware kalit** (YubiKey: `ssh-keygen -t ed25519-sk`), private kalit qurilmadan chiqmaydi.

### `~/.ssh/config` — ulanishlarni qisqartirish

```text
Host lab
    HostName 192.168.1.50
    User student
    IdentityFile ~/.ssh/id_ed25519
    IdentitiesOnly yes

Host prod-*
    User deploy
    ProxyJump bastion

Host bastion
    HostName bastion.example.com
    User student
```

Endi: `ssh lab`, `ssh prod-db1` (bastion orqali avtomatik).

> **`IdentitiesOnly yes` nega:** agent'da 6+ kalit bo'lsa, client hammasini sinaydi va server `Too many authentication failures` bilan uzadi (`MaxAuthTries`).

## 5. SSH server'ni himoyalash — `/etc/ssh/sshd_config`

Drop-in ishlating (8-dars): `/etc/ssh/sshd_config.d/10-hardening.conf`

```text
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
AllowGroups ssh-users
MaxAuthTries 3
LoginGraceTime 20
X11Forwarding no
AllowAgentForwarding no
ClientAliveInterval 300
ClientAliveCountMax 2
```

```bash
sudo sshd -t                      # sintaksis test — HAR DOIM avval
sudo sshd -T | grep -i passwordauth   # haqiqiy (yakuniy) qiymat
sudo systemctl reload ssh
```

> **Tuzoq:** sshd'da **birinchi** topilgan qiymat ishlaydi. `sshd_config` boshida `Include /etc/ssh/sshd_config.d/*.conf` bor — drop-in'lar asosiy fayldan **ustun**. Cloud image'larda `50-cloud-init.conf` `PasswordAuthentication yes` qilib qo'ygan bo'lishi mumkin. Shuning uchun `sshd -T` bilan yakuniy qiymatni tekshiring.

### Server'dan o'zingizni qulflab qo'ymaslik tartibi

> **Ogohlantirish:** SSH config xatosi — remote server'ga kirish yo'li yo'qoladi. Konsol yo'q bo'lsa, server'ni qayta yaratish kerak bo'lishi mumkin.

```
 1. Joriy SSH sessiyani YOPMANG (u reload'dan keyin ham ishlayveradi)
 2. sshd -t                         -> sintaksis
 3. systemctl reload ssh
 4. IKKINCHI terminalda yangi ulanish -> kalit bilan kirish ishlayaptimi? sudo ishlayaptimi?
 5. Faqat shundan keyin birinchi sessiyani yoping
 Zaxira: cloud konsol / serial console / KVM yo'li borligini oldindan bilib qo'ying
```

### Qo'shimcha himoya qatlamlari

| Qatlam | Nima beradi | Afzallik va kamchilik |
|---|---|---|
| Firewall (`ufw allow from 10.0.0.0/8 to any port 22`) | Faqat ma'lum tarmoqdan | Dinamik IP'da qiyin |
| VPN / private network | SSH internet'ga umuman ochilmaydi | Qo'shimcha infra |
| `fail2ban` | Ko'p urinishdan keyin IP blok | Parol o'chiq bo'lsa foydasi kam; asosan log shovqinini kamaytiradi |
| Port o'zgartirish (22 -> 2222) | Bot shovqini kamayadi | Xavfsizlik **emas** (port scanner bir zumda topadi) |
| MFA (kalit + TOTP) | Ikkinchi omil | Murakkablik, avtomatlashtirish qiyin |

## 6. Oraliq server (bastion) orqali ulanish

**Muammo:** noutbuk -> bastion -> prod server. Prod'ga kalit bilan kirish kerak, lekin private kalitni bastion'ga ko'chirish xavfli.

```
 Naive:     private kalitni bastion'ga nusxalash          -> bastion buzilsa, kalit ketdi
 Xavfli:    ssh -A bastion (agent forwarding)             -> bastion'dagi root sizning agent'ingizdan
                                                             foydalanib, siz ulangan paytda istalgan
                                                             server'ga kira oladi
 To'g'ri:   ssh -J bastion prod  (ProxyJump)              -> bastion faqat TCP'ni uzatadi; shifrlash
                                                             laptop <-> prod o'rtasida, end-to-end
```

## 7. SSH tunnel — yopiq port'ga xavfsiz yo'l

```bash
# Local forward: prod'dagi DB'ga (faqat localhost'da tinglaydi) noutbukdan ulanish
ssh -L 5432:localhost:5432 prod-db1
psql -h localhost -p 5432          # noutbukda

# Remote forward: noutbukdagi servisni server orqali ochish
ssh -R 8080:localhost:3000 lab

# SOCKS proxy
ssh -D 1080 bastion
```

> **Xavfsizlik:** tunnel'lar firewall'ni chetlab o'tish vositasi ham. Production server'larda kerak bo'lmasa: `AllowTcpForwarding no`. Kerakli user'lar uchun — `Match` bloki bilan alohida ruxsat.

## 8. Ko'p uchraydigan muammolar va ularni topish

| Muammo | Sabab | Tekshirish |
|---|---|---|
| Kalit bor, lekin parol so'rayapti | `~/.ssh` != `700`, `authorized_keys` != `600`, yoki home papka boshqalarga yoziladigan (`StrictModes`) | Server: `journalctl -u ssh` -> `bad ownership or modes` |
| `Permission denied (publickey)` | Noto'g'ri kalit / user / `AllowGroups` | Client: `ssh -v`; server: journal |
| `REMOTE HOST IDENTIFICATION HAS CHANGED` | Server qayta o'rnatilgan yoki MITM | Fingerprint'ni tasdiqlash |
| `Connection refused` | sshd ishlamayapti / boshqa port | `systemctl status ssh`, `ss -tlnp` |
| `Connection timed out` | Tarmoq / firewall / xavfsizlik group | `ping`, `nc -vz host 22`, cloud SG |
| `Too many authentication failures` | Agent'da ko'p kalit | `IdentitiesOnly yes` |
| Ulanish sekin (5–10 s) | Server client IP'ni DNS'da resolve qilyapti | `UseDNS no` (default ko'p versiyalarda) |
| Idle session uziladi | NAT/firewall timeout | `ServerAliveInterval 60` (client) |

```bash
ssh -vvv student@host                       # client tomoni: qaysi kalitlar sinaldi, qayerda to'xtadi
sudo journalctl -u ssh -f                   # server tomoni (ko'pincha aniq sabab shu yerda)
sudo /usr/sbin/sshd -d -p 2222              # debug rejimda alohida port'da ishga tushirish
```

**Debug qoidasi:** client xabari ataylab noaniq (`Permission denied`) — hujumchiga ma'lumot bermaslik uchun. Haqiqiy sabab **server log'ida**.

## 9. Ko'p server'li tizimda SSH

| Muammo | 100+ server'da |
|---|---|
| `authorized_keys`'ni har server'da boshqarish | Xodim ketsa — har server'dan kalitni o'chirish (unutiladi) |
| `known_hosts` TOFU | Har yangi server — "yes" va MITM imkoniyati |
| Kim qachon kirdi | Log'lar sochilgan |

**Yechimlar:**
- **SSH sertifikatlar** (OpenSSH CA): CA user kalitini qisqa muddatga (masalan, 8 soat) imzolaydi. Server faqat CA'ga ishonadi (`TrustedUserCAKeys`). Xodim ketsa — yangi sertifikat berilmaydi, `authorized_keys`'ga tegish shart emas. Host sertifikatlari bilan TOFU ham yo'qoladi.
- **Bastion / access proxy** (Teleport, Boundary): SSO, MFA, session recording.
- **SSH'siz boshqaruv** (AWS SSM Session Manager, va h.k.): 22-port umuman ochilmaydi, kirish IAM orqali, audit avtomatik.

> **Chuqurroq qarash:** maqsad — "SSH'ni yaxshi himoyalash" emas, **SSH'ga ehtiyojni kamaytirish**. Deploy — CI/CD, config — IaC, log'lar — markaziy tizim. Odam server'ga faqat incident'da, vaqtinchalik va yozib olinadigan kirish bilan kiradi.

## Amaliy mashg'ulot

1. Host'dan VM'ga parol bilan kiring. Birinchi ulanishdagi fingerprint'ni server'dagi `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` bilan solishtiring.
2. Passphrase bilan kalit yarating, `ssh-copy-id`, `ssh-agent` + `ssh-add`, parolsiz kiring.
3. `~/.ssh/config`'da `lab` aliasi.
4. Hardening drop-in yozing; **qulflanmaslik protokoli** bo'yicha qo'llang; `sshd -T` bilan tekshiring.
5. Buzib-tuzat: `chmod 777 ~/.ssh` (server'da) -> kalit ishlamaydi -> `journalctl -u ssh`'dan sababni toping -> tuzating.
6. VM'da `python3 -m http.server 8000 --bind 127.0.0.1` ishga tushiring va noutbukdan `ssh -L` bilan oching.
7. Ikki VM bo'lsa: `ssh -J` bilan birinchisi orqali ikkinchisiga kiring.

## Uy vazifa

1. `auth.log`'dan barcha muvaffaqiyatli va muvaffaqiyatsiz SSH kirishlarni ajratib sanang; eng faol 5 hujumchi IP (7-dars pipeline).
2. Agent forwarding va ProxyJump farqini diagramma bilan tushuntiring: bastion buzilsa har birida nima bo'ladi?
3. 50 ta server'li jamoa uchun SSH kirish siyosatini yozing: kalit turi, kim kiradi, offboarding, audit.

## Test savollari

1. SSH telnet'ning qaysi muammolarini hal qiladi?
2. Host key va user key farqi?
3. `known_hosts` nima uchun? TOFU nima?
4. `REMOTE HOST IDENTIFICATION HAS CHANGED` — to'g'ri harakat?
5. Qaysi kalit server'ga ko'chiriladi — private yoki public? Nega parol emas, kalit?
6. `PasswordAuthentication no`'dan oldin nima qilish kerak?
7. Nega drop-in'dagi qiymat asosiy config'dan ustun bo'lishi mumkin va qanday tekshirasiz?
8. `ssh -A` va `ssh -J` farqi?
9. Port'ni 2222 ga o'zgartirish xavfsizlik choramimi?
10. SSH sertifikatlar `authorized_keys`'ning qaysi muammosini hal qiladi?

## Ko'p uchraydigan xatolar

- Joriy sessiyani yopib, keyin yangi config'ni sinash.
- `StrictHostKeyChecking no`'ni doimiy ishlatish.
- Passphrase'siz private kalit va uni server'larga nusxalash.
- Agent forwarding'ni default yoqish.
- `sshd_config`'ni tahrirlab, cloud-init drop-in'i uni bekor qilganini sezmaslik.
- Faqat client xabariga qarab debug qilish.

## Xulosa

- SSH = shifrlash + server autentifikatsiyasi (host key) + user autentifikatsiyasi (user key) + integrity.
- Kalit bilan kiring (passphrase, agent, imkon bo'lsa hardware), root va parolni yoping, AllowGroups bilan cheklang.
- Config o'zgarishi: `sshd -t`, `sshd -T`, reload, **ikkinchi terminalda** sinash.
- Bastion orqali — `ProxyJump`, agent forwarding emas.
- Masshtabda — SSH sertifikatlar, access proxy yoki SSH'siz boshqaruv. Eng yaxshi SSH — kamdan-kam kerak bo'ladigan SSH.
