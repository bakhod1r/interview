# Middle DevOps: real case'lar va yondashuv

Manbalar: GitHub (NotHarshhaa/DevOps-Interview-Questions, sayhellorob/DevOps-Interview-Questions, devopscloud-java/Devops-Interview, mlgitdev/devops-interview-questions), pwskills, dev.to (prodevopsguytech, techikrish), Vishakha Sadhwani scenario to'plami. Savollar yig'ildi, javoblar tekshirilgan amaliyot asosida qayta yozildi.

Har case formati: **Holat → Birinchi 5 daqiqa → Tekshiruv → Sabablar → Fix → Oldini olish.** Intervyuer javobdan ko'ra *tartibni* baholaydi: avval ta'sirni kamaytir (mitigate), keyin root cause.

```
 Alert / shikoyat
       |
       v
 Ta'sir qancha? (kim, nechta %, qachondan) --> kerak bo'lsa rollback / scale
       |
       v
 Nima o'zgardi? (deploy, config, trafik, cert, infra)
       |
       v
 Signal: metrics -> logs -> traces -> events
       |
       v
 Gipoteza -> tekshir -> fix -> verify -> postmortem
```

## Universal javob shabloni

| Qadam | Nima deysan |
|---|---|
| Scope | "Bitta pod/node/region mi yoki hammasi?" |
| Change | "Oxirgi deploy/config/infra o'zgarishi qachon?" |
| Mitigate | rollback, scale out, trafikni boshqa joyga, feature flag o'chirish |
| Diagnose | metrics (RED/USE), log, `kubectl describe`, events |
| Fix | minimal, qaytariladigan o'zgarish |
| Prevent | alert, test, policy, runbook, blameless postmortem |

## Kubernetes

### 1. Pod CrashLoopBackOff

- **Tekshiruv:** `kubectl describe pod <p>` (Events, Last State, Exit Code), `kubectl logs <p> --previous`.
- **Exit code:** `1` = app xato (config/env/DB ulanish); `137` = OOMKilled yoki SIGKILL; `139` = segfault; `143` = SIGTERM.
- **Ko'p sabab:** yo'q Secret/ConfigMap kaliti, noto'g'ri `command`, DB tayyor emas, liveness probe juda erta (app sekin start).
- **Fix:** probe uchun `startupProbe`, `initialDelaySeconds`; dependency uchun retry/backoff app ichida (initContainer bilan "wait-for" faqat start uchun).
- **Senior nuqta:** liveness'da tashqi dependency (DB) tekshirma — DB tushsa butun fleet restart bo'ladi, cascading failure.

### 2. OOMKilled (exit 137)

- **Tekshiruv:** `kubectl describe pod` -> `Reason: OOMKilled`; `kubectl top pod`; Grafana'da `container_memory_working_set_bytes` vs limit.
- **Sabab:** limit kichik, memory leak, JVM/Go runtime limitni bilmaydi (`-XX:MaxRAMPercentage`, `GOMEMLIMIT`).
- **Fix:** profil qil, keyin limit to'g'rila; request = real o'rtacha, limit = peak + zaxira.
- **Gotcha:** node darajasidagi OOM (kubelet eviction) bilan container cgroup OOM farqli — node `MemoryPressure` ni ham ko'r.

### 3. Pod Pending

- `kubectl describe pod` -> Events: `Insufficient cpu/memory`, `didn't match node selector`, `untolerated taint`, `pod has unbound PersistentVolumeClaims`.
- **Fix:** request'ni kamaytir yoki node qo'sh (Cluster Autoscaler/Karpenter), affinity/taint to'g'rila, StorageClass/PVC tekshir.
- **Gotcha:** PV boshqa AZ'da — EBS AZ'ga bog'langan; `volumeBindingMode: WaitForFirstConsumer` ishlat.

### 4. ImagePullBackOff

- Tag yo'q, private registry uchun `imagePullSecrets` yo'q, ECR token muddati tugagan, Docker Hub rate limit.
- **Fix:** `kubectl describe` dagi aniq xabarni o'qi; registry mirror/pull-through cache; `latest` tag ishlatma — immutable tag/digest.

### 5. Service orqali app ochilmaydi

```
 Ingress -> Service -> Endpoints -> Pod:port
    |          |           |            |
  host/path  selector   bo'shmi?    readiness, containerPort
```

- `kubectl get endpoints <svc>` bo'sh = selector label mos emas yoki pod readiness'dan o'tmagan.
- `targetPort` != container port; app `127.0.0.1` ga bind qilgan (`0.0.0.0` kerak).
- Pod ichidan: `kubectl run tmp --rm -it --image=nicolaka/netshoot -- curl svc.ns.svc.cluster.local:port`.
- NetworkPolicy default deny bo'lishi mumkin.

### 6. Node NotReady

- `kubectl describe node` (Conditions: DiskPressure, MemoryPressure, PIDPressure), node'da `journalctl -u kubelet`, `systemctl status containerd`.
- Ko'p sabab: disk to'ldi (image/log), kubelet sertifikat muddati, CNI pod o'lgan, network uzilishi.
- **Mitigate:** `kubectl cordon` + `kubectl drain --ignore-daemonsets --delete-emptydir-data`, keyin tuzat yoki node'ni almashtir (cattle, not pets).

### 7. Deployment "Progressing" da qotib qoldi / rollout yiqildi

- `kubectl rollout status`, `kubectl rollout history`, yangi ReplicaSet pod'lari nega Ready emas.
- **Mitigate:** `kubectl rollout undo deploy/<d>`.
- **Oldini olish:** `progressDeadlineSeconds`, `maxUnavailable: 0`, readiness probe, PodDisruptionBudget, canary (Argo Rollouts).

### 8. Intermittent 502/504 deploy vaqtida

- Sabab: pod SIGTERM olganda hali LB/Endpoints'dan chiqmagan; app graceful shutdown qilmaydi.
- **Fix:** `preStop: sleep 10-15`, app SIGTERM'da yangi request qabul qilmay, borini tugatadi; `terminationGracePeriodSeconds` > shutdown vaqti.

### 9. HPA scale qilmayapti

- `kubectl describe hpa` -> `unknown` metrics = metrics-server yo'q yoki pod'da `resources.requests` yo'q (CPU % request'ga nisbatan hisoblanadi).
- Scale bo'ldi lekin pod Pending — cluster autoscaler ham kerak.

### 10. Klaster 85% CPU, launch 2 hafta keyin

- **Darhol:** real usage vs request (VPA recommendation, `kubectl top`), over-provisioned pod'larni right-size.
- **O'rta muddat:** HPA + Cluster Autoscaler/Karpenter, load test bilan capacity.
- **Contingency:** priority class (muhim servislar), feature flag bilan og'ir funksiyani o'chirish, rate limit.

## CI/CD

### 11. Pipeline birdan sekinlashdi (5 min -> 25 min)

- Qaysi stage? Step timing'ni solishtir.
- Cache invalid (lock fayl o'zgardi, cache key xato), Docker layer cache yo'q (`COPY . .` dependency'dan oldin), runner'lar band/kichik.
- **Fix:** layer tartibi (avval `package*.json`/`go.mod`, keyin kod), BuildKit `--cache-from`, test parallelization.

### 12. Flaky test pipeline'ni sindiradi

- Retry — vaqtinchalik yechim. Karantin, flake'ni o'lchash, sabab: vaqt, tartib, shared state, tashqi servis.

### 13. Jenkins/GitHub Actions deploy "credentials not found"

- Secret nomi/scope (env, repo, org), fork PR'larda secret berilmaydi, credential rotatsiya qilingan.
- **Best:** uzoq umrli key o'rniga OIDC (GitHub Actions -> AWS `AssumeRoleWithWebIdentity`).

### 14. Prod'ga noto'g'ri versiya chiqdi

- Rollback (oldingi immutable image digest). Keyin: nega? `latest` tag, manual deploy, environment drift.
- **Oldini olish:** build once, promote same artifact (dev -> stage -> prod), GitOps (ArgoCD) — Git = haqiqat manbai.

### 15. Secret Git'ga push qilindi

- **Birinchi:** secret'ni darhol **revoke/rotate** qil (history tozalash yetmaydi — allaqachon clone/indeks qilingan bo'lishi mumkin).
- Keyin `git filter-repo`/BFG, audit log: secret ishlatildimi.
- **Oldini olish:** pre-commit gitleaks/trufflehog, GitHub push protection, Vault/Secrets Manager.

## Linux / server

### 16. Disk 100%

- `df -h`, `df -i` (inode tugashi ham bo'ladi), `du -xh --max-depth=1 / | sort -h`.
- `df` to'la, `du` bo'sh ko'rsatadi = o'chirilgan lekin ochiq fayl: `lsof +L1` -> process'ni restart yoki `> /proc/<pid>/fd/<n>`.
- **Oldini olish:** logrotate, journald `SystemMaxUse`, docker `log-opts max-size`, alert 80%.

### 17. Server sekin, load average yuqori

- `uptime`, `top`/`htop`, `vmstat 1` (r, b, wa, si/so), `iostat -xz 1`, `free -m`.
- Load yuqori + CPU bo'sh = I/O wait yoki D-state process'lar.
- Brendan Gregg 60-soniyalik checklist: `uptime; dmesg | tail; vmstat 1; mpstat -P ALL 1; pidstat 1; iostat -xz 1; free -m; sar -n DEV 1; sar -n TCP,ETCP 1; top`.

### 18. SSH ulanmayapti

- `ssh -vvv`, port ochiqmi (`nc -zv host 22`), security group/firewall, `sshd` ishlayaptimi, `~/.ssh` permission (700/600), disk to'la, `fail2ban` ban.
- Cloud'da: serial console / SSM Session Manager.

### 19. "Too many open files"

- `ulimit -n`, `/proc/<pid>/limits`, systemd unit'da `LimitNOFILE`. Ko'pincha sabab — connection leak, limitni oshirish faqat simptom.

## Docker

### 20. Container start bo'lmaydi: port conflict

- `bind: address already in use` -> `ss -ltnp | grep :8080`, boshqa port yoki eski container'ni to'xtat.

### 21. Image 2 GB

- Multi-stage build, `distroless`/`alpine`, `.dockerignore`, bitta `RUN` da install + cache tozalash. Kichik image = tez pull, kam CVE.

### 22. Container ichida root

- `USER` direktivasi, read-only rootfs, `--cap-drop ALL`; K8s'da `securityContext.runAsNonRoot: true`.

## Cloud / Terraform

### 23. Terraform state lock qotib qoldi

- Boshqa apply ishlayaptimi — avval tekshir. Yo'q bo'lsa `terraform force-unlock <ID>`.
- **Gotcha:** ikki kishi bir vaqtda apply = state buzilishi; remote backend (S3 + DynamoDB/S3 native lock) majburiy.

### 24. Drift: kimdir console'da qo'lda o'zgartirdi

- `terraform plan` farqni ko'rsatadi. Qaror: kodga import (`import` block) yoki kod bo'yicha qaytarish.
- **Oldini olish:** prod'da console write huquqi yo'q, rejali drift detection pipeline.

### 25. `terraform apply` resursni destroy/recreate qilmoqchi

- Plan'da `forces replacement` — nima uchun (immutable atribut, nom o'zgardi). `moved` block, `lifecycle { prevent_destroy = true }`, `create_before_destroy`.

### 26. AWS bill to'satdan 3x

- Cost Explorer (service/tag bo'yicha), NAT Gateway trafigi, unutilgan EBS/snapshot/EIP, log ingestion, cross-AZ trafik.
- Budget alert, tagging policy.

### 27. EC2'dan S3'ga AccessDenied

- Instance role bormi, policy action/resource ARN, bucket policy, KMS key policy, SCP, VPC endpoint policy. `aws sts get-caller-identity` — kim sifatida ishlayapsan.

## Tarmoq / TLS

### 28. Sertifikat muddati tugadi, sayt ochilmaydi

- **Mitigate:** yangilash (cert-manager/certbot), reload.
- Tekshir: `openssl s_client -connect host:443 -servername host | openssl x509 -noout -dates`, chain to'liqmi.
- **Oldini olish:** auto-renew + expiry alert (30/14/7 kun).

### 29. DNS: "ba'zi userlar ochadi, ba'zilar yo'q"

- TTL va propagation, eski record cache'da, split-horizon. `dig +trace`, turli resolver'lar bilan (`dig @8.8.8.8`).
- K8s ichida: CoreDNS, `ndots:5` sabab ortiqcha so'rovlar.

### 30. Latency spike microservice migratsiyadan keyin

- Trace (Jaeger/Tempo) — qaysi hop? DNS lookup, connection pool yo'q (har request yangi TLS), CPU throttling (`container_cpu_cfs_throttled_periods_total`), noisy neighbor, GC.
- **Gotcha:** CPU limit throttling — o'rtacha CPU past bo'lsa ham p99 o'sadi.

## Observability / on-call

### 31. Alert juda ko'p, hamma e'tibor bermay qo'ydi

- Simptom bo'yicha alert (SLO burn rate), sabab bo'yicha emas; har alert actionable + runbook; dublikat guruhlash (Alertmanager grouping/inhibition).

### 32. Prod DB lock, sayt tushdi

- **Mitigate:** blokirovka qilgan query'ni top (`pg_stat_activity`, `pg_locks`), kerak bo'lsa `pg_terminate_backend`. Migratsiya bo'lsa — to'xtat.
- **Oldini olish:** `lock_timeout`, katta jadvalga `CREATE INDEX CONCURRENTLY`, expand-contract migratsiya.

### 33. Monitoring yo'q joyga kelding — nima qilasan?

- Avval golden signals (latency, traffic, errors, saturation), log markazlashtirish, uptime check, keyin SLO. Hamma narsani bir kunda emas.

## Behavioral (middle uchun ham so'raladi)

| Savol | Yaxshi javob tarkibi |
|---|---|
| Eng og'ir incident'ingiz | STAR: holat, rolingiz, aniq qadamlar, raqam bilan natija, nima o'rgandingiz |
| Xato qilib prod'ni sindirgansiz | Tan olish, tez mitigate, blameless postmortem, tizimli fix (guardrail) |
| Dev jamoa bilan kelishmovchilik | Data bilan gapirish, SLO/error budget umumiy til |
| Toil kamaytirish misoli | Nima avtomatlashtirildi, qancha vaqt tejaldi |

## Senior nuqtalar

- Har javobni **mitigate first** bilan boshla — intervyuer "rollback" so'zini kutadi.
- "Nima o'zgardi?" — incident'larning ko'pchiligi o'zgarishdan keyin.
- Simptom != root cause: limitni oshirish, restart, retry — vaqtinchalik.
- Har fix'dan keyin: qanday aniqlaymiz (alert), qanday oldini olamiz (test/policy), qanday tez tiklaymiz (runbook).
- Bilmasang — "qanday tekshirardim" de, taxmin qilma.
