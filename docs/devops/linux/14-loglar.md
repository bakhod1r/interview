# Dars 14 — Loglar

> **Natija:** servis yiqilganda log'dan sababni topish: `/var/log` va `journalctl` bilan ishlash. Log turlari va daraja intizomi, journald va rsyslog arxitekturasi, structured logging, correlation ID, nima log qilinmasligi kerak (secret, PII), retention va markazlashtirish.

## 1. Log qatori qanday qismlardan iborat

```text
2026-10-01T14:03:22.418Z nginx[900]: [error] connect() failed (111: Connection refused) while connecting to upstream, upstream: "http://127.0.0.1:8080/api"
|                        |     |     |       +-- xabar + kontekst (qaysi upstream)
|                        |     |     +--------- daraja
|                        |     +--------------- PID
|                        +--------------------- manba
+---------------------------------------------- vaqt (ISO 8601, UTC, ms bilan)
```

### Log darajalari va ularni to'g'ri ishlatish

| Daraja | Qachon | Kim reaksiya qiladi |
|---|---|---|
| `DEBUG` | Dasturchi uchun tafsilot | Prod'da odatda o'chiq |
| `INFO` | Muhim normal hodisa (start, config yuklandi) | Hech kim |
| `WARN` | G'alati, lekin ishlayapti (retry muvaffaqiyatli, deprecated) | Trend kuzatiladi |
| `ERROR` | So'rov/operatsiya muvaffaqiyatsiz | Tekshiriladi |
| `FATAL/CRITICAL` | Servis ishlay olmaydi | Darhol |

> **Anti-usul:** hamma narsa `ERROR` — haqiqiy xato shovqinda yo'qoladi. Yoki: kutilgan holat (user noto'g'ri parol kiritdi) `ERROR` sifatida — bu `INFO`/`WARN`, chunki tizim to'g'ri ishladi.

### Vaqt — ko'p chalkashliklar shu yerdan chiqadi

- **UTC** ishlating. Har server o'z timezone'ida yozsa, incident'da log'larni solishtirish azob.
- Server soatlari NTP bilan sinxron bo'lishi shart (`timedatectl`). Soat 2 soniya farq qilsa, ikki servis log'ida "sabab"dan oldin "oqibat" ko'rinadi.
- Millisekund aniqligi — tez tizimlarda soniya yetmaydi.

## 2. Log'lar qayerga yoziladi: ikki tizim

```
 App / servis
   | stdout/stderr (systemd servis)     | syslog() / /dev/log
   v                                     v
 +------------------ systemd-journald ------------------+
 |  binary journal: /var/log/journal/ (persistent)      |
 |  yoki /run/log/journal/ (RAM, reboot'da yo'qoladi)   |
 |  metadata: _SYSTEMD_UNIT, _PID, _UID, PRIORITY ...   |
 +--------------------------+---------------------------+
                            | forward (ixtiyoriy)
                            v
                      rsyslog -> /var/log/syslog, auth.log (matn)
                            |
                            v
                  markaziy log tizimi (Loki, ELK, ...)
```

- **journald** — structured: har yozuvda metadata (qaysi unit, PID, UID). Filtrlash kuchli.
- **rsyslog** — klassik matn fayllar va tarmoq orqali yuborish.
- Ba'zi app'lar (nginx, postgres) o'z fayllariga to'g'ridan-to'g'ri yozadi (`/var/log/nginx/`).

> **Tuzoq:** ba'zi minimal sozlamalarda journal faqat RAM'da (`/run/log/journal`) — reboot'dan keyin oldingi boot log'lari yo'q. Doimiy qilish: `sudo mkdir -p /var/log/journal` yoki `/etc/systemd/journald.conf`'da `Storage=persistent`. Kernel panic'dan keyin "nima bo'ldi?" savoliga javob shu sozlamaga bog'liq.

## 3. `/var/log`

| Fayl | Nima |
|---|---|
| `syslog` (Ubuntu) / `messages` (RHEL) | Umumiy tizim |
| `auth.log` / `secure` | Login, sudo, SSH |
| `kern.log` | Kernel (yoki `journalctl -k`) |
| `dpkg.log` / `dnf.log` | Paket o'rnatish — "kecha nima o'zgardi?" |
| `nginx/access.log` | Har HTTP so'rov |
| `nginx/error.log` | Nginx xatolari |
| `*.1`, `*.gz` | logrotate arxivlari (6-dars) |

```bash
sudo tail -F /var/log/auth.log
sudo grep -c "Failed password" /var/log/auth.log
zgrep error /var/log/syslog.2.gz
```

## 4. journalctl

```bash
journalctl -u nginx                 # bitta servis
journalctl -u nginx -f              # jonli
journalctl -u nginx -n 50 --no-pager
journalctl -u nginx -u myapp        # ikki servis, vaqt bo'yicha aralash
journalctl --since "1 hour ago"
journalctl --since "2026-10-01 10:00" --until "2026-10-01 11:00"
journalctl -p err                   # err va undan jiddiy
journalctl -p warning -u myapp --since today
journalctl -b                       # joriy boot
journalctl -b -1                    # oldingi boot (crash'dan keyin!)
journalctl --list-boots
journalctl -k                       # kernel (dmesg)
journalctl -o json-pretty -n 1      # barcha metadata
journalctl _UID=1001                # aniq user'ning process'lari
journalctl --disk-usage
sudo journalctl --vacuum-time=14d   # 14 kundan eskisini o'chirish
```

Retention'ni doimiy sozlash: `/etc/systemd/journald.conf` -> `SystemMaxUse=2G`, `MaxRetentionSec=1month`.

## 5. Tartiblangan (structured) log — nega JSON

```text
# Unstructured
2026-10-01 14:03:22 ERROR payment failed for user 42 amount 100.50 after 3 retries

# Structured (JSON)
{"ts":"2026-10-01T14:03:22.418Z","level":"error","svc":"payments","msg":"payment failed",
 "user_id":42,"amount":"100.50","currency":"UZS","retries":3,"request_id":"7f3a9c","err":"gateway timeout"}
```

| | Matn | JSON |
|---|---|---|
| Odam o'qishi | Oson | Biroz qiyin (`jq` yordam beradi) |
| Mashina parse qilishi | Regex, mo'rt | Ishonchli |
| Filtrlash ("user 42'ning barcha xatolari") | `grep` bilan taxminiy | Aniq field bo'yicha |
| Format o'zgarsa | Parser buziladi | Yangi field qo'shiladi |

Go'da standart kutubxona:

```go
logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
logger.Error("payment failed",
    "user_id", userID,
    "request_id", reqID,
    "retries", 3,
    "err", err,
)
```

### Correlation ID — bitta so'rovni barcha servislarda kuzatish

```
 client -> gateway [req=7f3a9c] -> orders [req=7f3a9c] -> payments [req=7f3a9c] -> DB
```

Har so'rovga bitta ID beriladi va **barcha** servislar log'iga yoziladi (HTTP header orqali uzatiladi, masalan `X-Request-ID` yoki W3C `traceparent`). Incident'da bitta ID bo'yicha butun yo'lni ko'rasiz. Busiz 5 ta servis log'ini vaqt bo'yicha taxminiy solishtirasiz.

## 6. Log'ga nimalar yozilmasligi kerak (xavfsizlik)

| Log'ga tushmasligi kerak | Nega |
|---|---|
| Parol, token, API key, session cookie | Log'ga kirish huquqi bor har kim (va log tizimi buzilsa — hujumchi) ularni oladi |
| To'liq karta raqami, CVV | PCI DSS talabi |
| Shaxsiy ma'lumot (pasport, telefon) — kerak bo'lmasa | Shaxsiy ma'lumotlar qonunchiligi; maskalash: `+99890*****67` |
| To'liq HTTP request body | Yuqoridagilarning hammasi bo'lishi mumkin |

```
 Klassik leak: logger.Debug("request", "headers", r.Header)   -> Authorization header log'da
```

**Himoya qatlamlari:** kodda allowlist (faqat kerakli field'lar), logger'da redaction, log tizimida kirish nazorati, retention'ni cheklash.

> **Log injection:** user kiritgan matnni to'g'ridan-to'g'ri log'ga yozsangiz, `\n` bilan soxta log qatorlari yaratilishi mumkin ("admin logged in successfully"). Structured logging (JSON escape) buni hal qiladi.

## 7. Log, metric va trace farqi

| Signal | Savol | Misol | Narx |
|---|---|---|---|
| **Logs** | Aniq nima bo'ldi? | "payment 7f3a9c gateway timeout" | Qimmat (har hodisa) |
| **Metrics** | Qancha / qanchalik tez? Trend? | `http_errors_total`, P99 latency | Arzon (agregat) |
| **Traces** | So'rov vaqti qayerda ketdi? | gateway 5ms -> payments 2.1s | O'rtacha (sampling) |

**Anti-usul:** "minutiga nechta 500?" savoliga log'dan javob qidirish. Bu metric'ning ishi: alert metric'dan keladi, keyin **tafsilot** uchun log'ga o'tasiz.

> **Masshtab tuzog'i:** DEBUG log'ni prod'da yoqib qo'yish — disk to'lishi va log tizimi narxining portlashi. Har servis uchun log hajmi va retention — budjet qarori.

## 8. Xatoni topish tartibi

```
 1. systemctl status X           -> failed? qachon? exit code / signal?
 2. journalctl -u X -n 100       -> oxirgi xabarlar; ENG BIRINCHI xatoni toping
 3. journalctl -u X -b -1        -> reboot'dan oldingi (crash bo'lsa)
 4. journalctl -k / dmesg        -> OOM killer? disk xatolari?
 5. Config test                  -> nginx -t, sshd -t, app -check-config
 6. "Nima o'zgardi?"             -> dpkg.log, deploy tarixi, git log
 7. Minimal fix -> restart -> status -> curl bilan tekshirish
 8. Regression himoyasi          -> config check pipeline'da, alert
```

> **Belgi va asl sabab:** nginx log'ida `connection refused` — belgi (upstream javob bermadi). Asl sabab upstream'da: `journalctl -u myapp` -> OOM bilan o'lgan. Zanjir bo'ylab orqaga yuring.

## Amaliy mashg'ulot — "Buzib-tuzat"

1. Hamkasbingiz `/etc/nginx/sites-enabled/default`'da bitta `;`'ni o'chiradi.
2. `sudo systemctl restart nginx` -> failed.
3. `status` -> `journalctl -u nginx -n 30` -> `sudo nginx -t` -> qator raqamini toping -> tuzating.
4. Upstream zanjiri: nginx'ni yo'q port'ga proxy qiling (`proxy_pass http://127.0.0.1:9999`), `curl` bilan 502 oling, `error.log`'dan sababni toping.
5. `auth.log`'dan bugun nechta muvaffaqiyatsiz SSH urinish bo'lganini va eng ko'p uringan 5 IP'ni toping (7-dars pipeline).
6. `journalctl -o json-pretty -u ssh -n 1` — qanday metadata bor?
7. `logger -p user.err "test xato"` yuborib, `journalctl -p err --since "1 min ago"` bilan toping.

## Uy vazifa

1. `/etc/logrotate.d/nginx`'ni o'qing va har qatorni izohlang (6-dars bilan bog'lang).
2. Journal'ni persistent qiling, reboot qiling va `journalctl -b -1` ishlashini isbotlang.
3. Kichik Go (yoki boshqa til) servisida `slog` bilan JSON log yozing: har so'rovga `request_id`, `Authorization` header log'ga tushmasin.

## Test savollari

1. SSH login urinishlari qaysi faylda?
2. Faqat oxirgi 1 soatdagi xatolarni qanday ko'ramiz?
3. `journalctl -b -1` nima va qachon kerak? Nega u ishlamasligi mumkin?
4. Nega log'larda UTC va NTP muhim?
5. Structured logging'ning 3 ta afzalligi?
6. Correlation ID qaysi muammoni hal qiladi?
7. Log'ga nimalar yozilmasligi kerak va nega?
8. "Minutiga nechta 500 xato?" — log'danmi yoki metric'danmi? Nega?

## Ko'p uchraydigan xatolar

- Hamma narsani `ERROR` darajasida yozish.
- Local timezone va sinxronlanmagan soatlar.
- Token va parollarni log'ga yozish (ayniqsa header/body dump).
- Journal RAM'da — crash'dan keyin hech narsa yo'q.
- Birinchi ko'ringan xatoni asl sabab deb hisoblash.
- Metric savollariga log'dan javob qidirish.
- Prod'da DEBUG'ni yoqib unutish.

## Xulosa

- Log — incident'dan keyingi yagona guvoh: vaqt (UTC), manba, daraja, aniq xabar va kontekst.
- journald — structured va metadata bilan; persistent bo'lishi kerak. Matn fayllar va markaziy tizim — uning ustida.
- Production'da: JSON log, correlation ID, daraja intizomi, secret/PII yo'q, retention budjeti.
- Logs = nima bo'ldi, metrics = qancha, traces = qayerda. Alert — metric'dan, tafsilot — log'dan.
- Debug tartibi: `status`, `journalctl -u`, kernel, config test, "nima o'zgardi?", zanjir bo'ylab asl sabab.
