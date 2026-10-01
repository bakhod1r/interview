# Dars 1 — Kirish: DevOps nima

> **Natija:** DevOps'ni vosita emas, **delivery system** sifatida tushunish. Darsdan keyin quyidagi savollarga javob bera olasiz: "DevOps qaysi muammoni hal qiladi?", "Jamoada DevOps yaxshi ishlayaptimi — buni qanday o'lchaysiz?", "Qachon DevOps practice'lari foyda emas, zarar keltiradi?"

## 1. Muammo — DevOps paydo bo'lishidan oldin qanday qiyinchiliklar bor edi?

2000-yillarda odatiy kompaniya:

```
  Dev team                         Ops team
  +------------------+             +------------------+
  | maqsad: feature  |   "devor"   | maqsad: stability|
  | tez chiqarish    | ----------> | hech narsa       |
  |                  |  release    | o'zgarmasin      |
  +------------------+  (3 oyda 1) +------------------+
         ^                                  |
         |       incident, ayblov           |
         +----------------------------------+
```

- Dev "yangi imkoniyatni tez chiqar" deb baholanadi, Ops "server yiqilmasin" deb. **Incentive'lar qarama-qarshi.**
- Release kamdan-kam bo'lgani uchun **katta** bo'ladi: 3 oylik o'zgarish bir kunda chiqadi. Nimadir buzilsa, qaysi o'zgarish aybdor ekanini topish qiyin.
- Deploy qo'lda, Word hujjatdagi 40 qadamli instruction bo'yicha. Har deploy — tavakkal, odatda kechasi va dam olish kunida.
- "Mening noutbukimda ishlaydi" — dev va prod environment'lari farq qiladi.

**Real muammo:** kod yozilganidan to foydalanuvchiga qiymat yetib borguncha bo'lgan yo'l **sekin, xavfli va qo'lda**. Feedback (bu o'zgarish yaxshimi?) oylab keladi.

## 2. Sabab — DevOps nega paydo bo'ldi?

DevOps (2009: Flickr'ning "10+ deploys per day" talk'i, keyin Patrick Debois tashkil qilgan birinchi DevOpsDays) — bu muammoga javob: **dev va ops bitta maqsadga ega bo'lsin — tez VA ishonchli delivery.**

Asosiy g'oya:

> **Tezlik va barqarorlik bir-biriga zid emas.** Kichik va tez-tez deploy qilish xavfni **kamaytiradi**, chunki har o'zgarish kichik, tez tekshiriladi va tez qaytariladi.

Bu intuitiv emas: "kam deploy = kam xavf" tuyuladi. Lekin DORA tadqiqoti (10+ yil, minglab jamoa) ko'rsatadi: eng tez jamoalar eng barqaror jamoalar ham.

## 3. Asosiy g'oya — natijani tezroq ko'rish (feedback loop'ni qisqartirish)

```
  PLAN -> CODE -> BUILD -> TEST -> RELEASE -> DEPLOY -> OPERATE -> MONITOR
    ^                                                                  |
    |                                                                  |
    +-------------------------- feedback loop <------------------------+
```

Bitta savolni yodda tuting: **"Kod commit qilinganidan keyin, u production'da to'g'ri ishlayaptimi-yo'qmi — buni qancha vaqtda bilaman?"**

Barcha DevOps practice'lari shu loop'ni qisqartirish uchun:

| Practice | Loop'ning qaysi qismini qisqartiradi |
|---|---|
| CI (har commit'da build + test) | CODE -> TEST: daqiqalar, kunlar emas |
| CD (avtomatik deploy) | TEST -> DEPLOY: tugma bosish, qo'lda 40 qadam emas |
| IaC | "Server qanday sozlangan?" — git'da yozilgan, taxmin emas |
| Observability | DEPLOY -> "ishlayaptimi?" — dashboard'da soniyalarda |
| Imkoniyat flag | RELEASE ni DEPLOY dan ajratadi: kod prod'da, lekin yoqilmagan |

> **Muhim farq:** **Deploy** — kodni server'ga qo'yish (texnik hodisa). **Release** — foydalanuvchiga ko'rsatish (biznes qarori). Imkoniyat flag ularni ajratadi va xavfni kamaytiradi.

## 4. DevOps haqida noto'g'ri tushunchalar

| Noto'g'ri tushuncha | Haqiqat |
|---|---|
| "DevOps = Docker + Kubernetes" | Tool'lar — faqat vosita. DevOps — **culture + practice + avtomatlashtirish**. K8s'siz ham kuchli jamoa bo'lish mumkin |
| "DevOps engineer — server admin" | Admin server'ni **qo'lda** boshqaradi. DevOps — **process'ni avtomatlashtiradi** va platformani quradi |
| "DevOps alohida jamoa" | Alohida "DevOps jamoasi" ko'pincha yangi devor bo'lib qoladi. Ideal: "You build it, you run it" yoki platform jamoasi (pastda) |
| "Ko'proq vosita = yaxshiroq DevOps" | Har vosita — operational cost. Eng sodda yechim yutadi |

## 5. Jamoalar qanday tuziladi — servis uchun kim javob beradi?

Real kompaniyada savol: **production'dagi servis yiqilsa, kim uyg'onadi?** (ownership)

```
  A) Klassik (anti-pattern)         B) "You build it, you run it"
  Dev --(release)--> Ops            Product team = dev + on-call
  Ops yiqilganda uyg'onadi          Kodni yozgan team uyg'onadi

  C) Platform engineering (zamonaviy, katta kompaniyalar)
  +-------------------------------------------------+
  | Product team 1 | Product team 2 | Product team 3|  <- o'z servisiga egalik
  +-------------------------------------------------+
  |  Platform team: CI/CD, K8s, monitoring, IaC     |  <- "self-service" beradi
  +-------------------------------------------------+
```

| Model | Qachon mos | Xavf |
|---|---|---|
| A) Dev / Ops ajratilgan | Qat'iy regulyatsiya (ba'zi bank'lar) | Sekin, ayblov madaniyati |
| B) You build it, you run it | Kichik/o'rta kompaniya, 1–10 jamoa | Har jamoa infra'ni qayta ixtiro qiladi |
| C) Platform jamoasi | 10+ jamoa, ko'p servis | Platform jamoasi yangi "Ops devori" bo'lib qolishi mumkin |

> **Chuqurroq qarash:** Platform'ni **mahsulot** deb qarang — uning foydalanuvchilari dev'lar. Agar dev'lar platform'ni chetlab o'tayotgan bo'lsa, platform yomon, dev'lar emas.

## 6. DevOps'ni o'lchash — DORA metrics

Senior intervyuda eng ko'p so'raladigan narsa. "Yaxshi ishlayapmiz" — fikr. Metric — fakt.

| Metric | Savol | Turi | Eng kuchli jamoalar (taxminiy) |
|---|---|---|---|
| **Deployment frequency** | Qanchalik tez-tez prod'ga deploy qilamiz? | Tezlik | Kuniga bir necha marta (on-demand) |
| **Lead time for changes** | Commit'dan production'gacha qancha vaqt? | Tezlik | < 1 kun |
| **Change failure rate** | Deploy'larning necha foizi incident/rollback'ga olib keladi? | Barqarorlik | ~0–15% |
| **Failed deployment recovery time** (eski nomi MTTR) | Buzilgan deploy'dan qancha vaqtda tiklanamiz? | Barqarorlik | < 1 soat |

DORA'ning yangi hisobotlarida 5-metric ham bor: **rework rate** (rejasiz, tuzatish uchun qilingan deploy'lar ulushi). Aniq chegaralar har yili yangilanadi — raqamni emas, **yo'nalishni** kuzating.

### Nega bu 4 ta birga o'lchanadi?

```
  Faqat tezlik o'lchansa:   tez deploy, lekin har 2-chisi buziladi
  Faqat barqarorlik:        hech narsa buzilmaydi, chunki hech narsa deploy qilinmaydi
  Ikkalasi birga:           "tez VA ishonchli" — real maqsad
```

### Xato yondashuv: o'lchovning o'zini maqsadga aylantirish (Goodhart qonuni)

> "Metric maqsadga aylansa, u yaxshi metric bo'lishdan to'xtaydi."

- Deployment frequency'ni KPI qilsangiz — jamoa README o'zgarishini ham alohida deploy qiladi.
- Change failure rate'ni jazolasangiz — jamoa incident'larni yashiradi.

DORA metric'lari — **jamoa o'zini yaxshilashi uchun**, jamoalarni solishtirish yoki jazolash uchun emas.

### Qanday o'lchanadi (amalda)

| Metric | Data manbasi |
|---|---|
| Deployment frequency | CI/CD tizimidagi prod deploy event'lari |
| Lead time | git commit vaqti -> deploy event vaqti |
| Change failure rate | deploy'lar va ularga bog'langan incident/rollback'lar |
| Recovery time | incident ochilgan -> yopilgan vaqt (incident vositadan) |

Avval o'lchang, keyin yaxshilang. O'lchamasdan "yaxshiladik" degan da'vo — taxmin.

## 7. Asosiy tamoyillar — har biri qaysi muammoni hal qiladi

| Tamoyil | Muammo | Afzallik va kamchilik / cheklov |
|---|---|---|
| **Avtomatlashtirish** | Qo'lda ish sekin va xato qiladi | Avtomatlashtirish ham kod: test, maintenance kerak. Yiliga 1 marta qilinadigan ishni avtomatlashtirish ko'pincha arzimaydi |
| **IaC** | "Server qanday sozlangan?" — hech kim bilmaydi (snowflake server) | State management (Terraform state), o'rganish narxi |
| **Immutable infrastructure** | Qo'lda "tuzatilgan" server'lar vaqt o'tib farqlanadi (config drift) | Stateful narsalar (DB) uchun qiyin; image build pipeline kerak |
| **Observability** | "Nega sekin?" — taxmin qilamiz | Log/metric/trace saqlash qimmat; cardinality portlashi |
| **Blameless postmortem** | Ayblov bo'lsa, odamlar xatoni yashiradi | "Blameless" != "javobgarsiz": action item'lar egasi bo'lishi shart |
| **Shift left** | Bug/zaiflik prod'da topilsa 100x qimmat | Pipeline sekinlashadi; flaky test'lar ishonchni yo'qotadi |

### "Uy hayvoni" va "podadagi mol" (pets va cattle)

```
  Pets (anti-pattern)                 Cattle
  "db-master-01", ismi bor            "web-7f3a", raqami bor
  kasal bo'lsa — davolaymiz (SSH)     kasal bo'lsa — almashtiramiz
  qo'lda sozlangan, noyob             image'dan bir xil yaratilgan
```

> **Nozik jihat:** hamma narsa cattle bo'la olmaydi. Database — data saqlaydi, uni "o'chirib yangisini yaratish" mumkin emas. Shuning uchun stateful qism (DB, queue) va stateless qism (app server'lar) alohida o'ylanadi. Stateless'ni cattle qiling, stateful'ni ehtiyot bilan boshqaring (yoki managed service'ga bering).

## 8. Dasturchi kompyuteri va production server farqi

| | Developer noutbuk | Production server |
|---|---|---|
| Interface | GUI, IDE | Faqat terminal (SSH), ko'pincha umuman kirilmaydi |
| Uptime | Kerak bo'lganda | 24/7, **SLO** bilan |
| Users | 1 kishi | Minglab client, bir vaqtda (concurrency) |
| Xato narxi | O'zi ko'radi | Biznes pul va ishonch yo'qotadi |
| O'zgarish | Istalgancha | Faqat pipeline orqali, review va audit bilan |
| Nosozlik | Kamdan-kam, qayta yoqasiz | Doimiy: disk to'ladi, network uziladi, process o'ladi |

> **Fikrlashdagi o'zgarish:** production'da nosozlik — **istisno emas, normal holat**. Savol "buziladimi?" emas, "buzilganda nima bo'ladi va qancha tez bilamiz?".

### SLI / SLO / SLA va error budget

- **SLI** (indicator) — o'lchanadigan narsa: masalan, muvaffaqiyatli (non-5xx, < 300ms) request'lar foizi.
- **SLO** (objective) — ichki maqsad: 99.9%.
- **SLA** (agreement) — client bilan shartnoma, buzilsa jarima. SLA har doim SLO'dan **yumshoqroq** (99.5%), aks holda zaxira yo'q.

Error budget hisobi (30 kunlik oy = 43 200 daqiqa):

| SLO | Ruxsat etilgan downtime / oy |
|---|---|
| 99% | ~7.2 soat |
| 99.9% | ~43 daqiqa |
| 99.99% | ~4.3 daqiqa |
| 99.999% | ~26 soniya |

**Error budget nima uchun kerak:** u Dev va Ops'ning eski qarama-qarshiligini hal qiladi.

```
  budget qolgan    -> tez deploy qilaveramiz, eksperiment qilamiz
  budget tugagan   -> feature to'xtaydi, reliability ishlariga o'tamiz
```

Qaror endi bahs emas, raqam bilan qabul qilinadi.

> **Common mistake:** "100% uptime" maqsad qilish. Bu imkonsiz (foydalanuvchining Wi-Fi'i ham 100% emas) va juda qimmat: har qo'shimcha "9" narxni bir necha barobar oshiradi. To'g'ri savol: "Biznesga qancha ishonchlilik **yetarli**?"

## 9. So'rov brauzerdan server'gacha qanday yo'l bosadi

```
  Browser
    |  1. DNS: example.com -> 203.0.113.10
    v
  Internet --TCP + TLS :443-->
    |
    v
  Load Balancer  (health check, TLS termination)
    |
    v
  nginx (reverse proxy)   <-- Linux server
    |
    v
  App (Go / Python / Java)
    |            |
    v            v
  Database     Cache (Redis)
```

Har bo'g'in — potensial nosozlik point:

| Bo'g'in | Nima buzilishi mumkin | Qanday bilamiz |
|---|---|---|
| DNS | Noto'g'ri record, TTL keshi, domain muddati tugagan | `dig`, synthetic check |
| TLS | Sertifikat muddati tugagan | Sertifikat expiry alert'i |
| Load balancer | Barcha backend'lar unhealthy | LB health metric, 502/503 soni |
| nginx | Worker'lar tugagan, config xato | access/error log, `nginx -t` |
| App | Crash, memory leak, deadlock | process restart soni, latency P99, error rate |
| DB | Connection pool to'lgan, sekin query, disk to'la | slow query log, connection soni, disk usage |
| Linux server | Disk to'la, OOM killer, CPU 100% | USE metric'lari (pastda) |

**Ikki monitoring metodi** (keyingi darslarda chuqur):
- **RED** (servis uchun): **R**ate, **E**rrors, **D**uration.
- **USE** (resurs uchun: CPU, disk, memory): **U**tilization, **S**aturation, **E**rrors.

> **Xulosa bu bo'limdan:** shu zanjirdagi deyarli hamma narsa Linux'da ishlaydi. Shuning uchun DevOps yo'li Linux'dan boshlanadi.

## 10. DevOps'ni joriy qilishda ko'p uchraydigan muvaffaqiyatsizliklar

| Nosozlik | Belgisi | Sabab |
|---|---|---|
| **Cargo cult** | K8s o'rnatildi, lekin deploy hamon oyda 1 marta | Vosita olindi, process o'zgarmadi |
| **"DevOps jamoasi" devori** | Dev'lar endi Ops o'rniga "DevOps jamoasi"ga ticket yozadi | Nom o'zgardi, ownership o'zgarmadi |
| **Complexity portlashi** | 3 kishilik startup'da 40 ta microservice va service mesh | Netflix'dan ko'chirildi, constraint'lar boshqa |
| **Avtomatlashtirish without understanding** | Pipeline qizil, hech kim nega ekanini bilmaydi | Script'lar ko'chirib olingan, tushunilmagan |
| **Alert fatigue** | Kuniga 200 alert, hammasi e'tiborsiz | Actionable bo'lmagan alert'lar |

## 11. Qachon kuchli DevOps kerak, qachon oddiy yo'l yetarli

**Qachon DevOps practice'larini kuchli qo'llash kerak:**
- Mahsulot tez-tez o'zgaradi, foydalanuvchi feedback'i muhim.
- Bir nechta jamoa bir tizim ustida ishlaydi.
- Downtime pul yo'qotadi.

**Qachon oddiyroq yo'l to'g'ri:**
- 1–2 kishilik loyiha, oyda 1 o'zgarish: oddiy server + bash script + backup yetarli. K8s — ortiqcha complexity.
- Qat'iy regulyatsiya: avtomatlashtirish mumkin, lekin approval gate'lar qonuniy talab.
- Prototip / MVP: avval product-market fit, keyin platforma.

> **Chuqurroq qarash:** "Bu muammoni hal qilishning eng sodda yo'li qaysi?" — har vosita tanlovidan oldingi savol. Complexity qo'shish oson, olib tashlash juda qiyin.

## Amaliy mashg'ulot

1. Doskada `example.com` -> sahifa zanjirini chizing. Har bo'g'inga yozing:
   - Bu yerda nima buzilishi mumkin?
   - Buni qaysi metric/log bilan bilamiz?
   - Buzilsa, foydalanuvchi nimani ko'radi (timeout, 502, sekinlik)?
2. Juft bo'lib: biri "Dev" (har kuni deploy qilmoqchi), biri "Ops" (barqarorlik istaydi). SLO 99.9% va oyda 30 daqiqa downtime allaqachon bo'lgan. Error budget asosida kelishuvga keling.

## Uy vazifa

1. 3 ta DevOps vakansiyasidan eng ko'p uchragan 10 ta texnologiyani yozing. Har birini lifecycle bosqichiga joylang (PLAN ... MONITOR).
2. O'zingiz bilgan loyiha uchun 4 ta DORA metric'ni taxminan baholang. Eng yomoni qaysi va nega?
3. "Bizga Kubernetes kerakmi?" — 5 kishilik startup uchun yarim sahifa javob yozing: constraint'lar, alternative'lar, afzallik va kamchiliklar.

## Test savollari

1. DevOps qaysi asosiy muammoni hal qiladi? (Vosita nomini aytmasdan javob bering.)
2. DORA'ning 4 ta asosiy metric'i nima, qaysilari tezlik, qaysilari barqarorlik?
3. SLO 99.9% bo'lsa, 30 kunlik oyda error budget qancha?
4. Nega kichik va tez-tez deploy katta va kam deploy'dan xavfsizroq?
5. Deploy va release farqi nima? Imkoniyat flag bunga qanday yordam beradi?
6. Nega SLA SLO'dan yumshoqroq bo'lishi kerak?
7. Blameless postmortem "hech kim javobgar emas" degani emas — nega?
8. Qaysi holatda database'ni cattle kabi boshqarib bo'lmaydi?

## Ko'p uchraydigan xatolar

- DevOps'ni lavozim yoki vosita to'plami deb tushunish.
- Metric'siz "yaxshilandik" deyish.
- 100% uptime'ni maqsad qilish.
- Katta kompaniya arxitekturasini kichik jamoaga ko'chirish.
- Alert'ni "ma'lumot uchun" yuborish — alert faqat harakat talab qilsa kerak.

## Xulosa

- DevOps — **tez VA ishonchli delivery** uchun culture + practice + avtomatlashtirish. Asosiy mexanizm — feedback loop'ni qisqartirish.
- Tezlik va barqarorlik zid emas: kichik, tez-tez, qaytariladigan o'zgarishlar ikkalasini yaxshilaydi.
- O'lchang: DORA metric'lari jamoani yaxshilash uchun, jazolash uchun emas.
- Ishonchlilik — biznes qarori: SLO + error budget bahsni raqamga aylantiradi.
- Production'da nosozlik — normal holat. Har bo'g'inda "nima buziladi va qanday bilamiz?" deb so'rang.
- Eng sodda yechimdan boshlang. Hamma narsaning poydevori — Linux.
