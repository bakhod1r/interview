# Interview Drill

Uzbek-language interview question bank (Junior → Principal) with an Anki-style study UI.

## Layout
- `data/sections/*.json` — one file per section (`id`, `name`, `domain`, `topics`, `questions[]`).
- `data/questions.json` — all sections merged; `data/index.json` — section list + counts. Keep `total`/`count` in sync when adding questions.
- `build/shell-v9.html` — **the UI source** (HTML/CSS/JS). Edit UI here, never in `interview.html`.
- `build/build.js` — reads `data/questions.json` + shell, writes `interview.html`.
- `build/verify.js` — loads `interview.html` in node, checks orphans / bad MCQ / missing explanations.
- `interview.html` — **generated**, single-file app. Manual edits get overwritten by the next build.

## Build
```sh
node build/build.js && node build/verify.js
```
Run after any change to data or shell.

## Shell rules
- build.js replaces everything from `const QD=[` up to `const secOf=q=>` with `const Q=…; const DOM=…; const SEC=…;`. Put any new top-level constants (e.g. `GRP`) **after** the `secOf` line, or they get deleted.
- Every question must map to a section: `SEC[k][2]===q.domain && SEC[k][1].includes(q.topic)` — otherwise build fails with "bo'limsiz savollar".
- Question ids must be unique across all sections.

## UI (shell-v9)
- Decks: direction (`GRP`: Backend / DevOps / System Design / Algorithms) › domain › section. A domain belongs to exactly one direction in `GRP`.
- Spaced repetition: FSRS-5 (default weights, `S.cfg.ret` target retention 0.9; old SM-2 `srs` entries converted lazily), 4 buttons (Qayta / Qiyin / Yaxshi / Oson), learning steps 1m/6m, daily new-card limit (`S.cfg.newDay`, default 20), day rolls over at 04:00.
- State lives in `localStorage` key `dbdrill.v1` (`res`, `srs`, `days`, `sess`, `cfg`, `nt`). Keep it backward-compatible; old `res` entries are migrated into `srs` on load.
- Older shells (`shell-v7.html`, `shell-v8.html`) are backups only.

## Working rules (from past sessions)
- User writes short Uzbek commands ("qo'sh", "bos", "davom et", "go") — act, don't re-ask. "bos" = do it now.
- Target: Senior-level coverage. When asked "to'liqmi?" — audit gaps per topic, then add questions to thin sections ("yupqalariga qo'sh").
- New topic/subtopic (e.g. inode, hardlink/softlink, LVM, kernel, shell, filesystem types) → add enough questions (mix mcq/code/open, J→P levels), place in the right section, sync `index.json` counts.
- "Edge cases & gotchas" live in `t*` sections, spread by domain (Go, SQL, Kafka, Redis, K8s, security…) — not one big bucket.
- Catalog structure: directions Backend / DevOps / System Design / Algorithms. DevOps content (infra, Linux, CI/CD, K8s) belongs under DevOps, not Backend. Fintech (`p*`) under Backend.
- Study UX = AnkiDroid style: flashcards, closed (hidden-answer) questions, FSRS. UI must stay premium: smooth animations, easy navigation.
- Deploy: GitHub Pages serves `interview.html`. Push only when the user explicitly allows it in that session.
- Always finish with `node build/build.js && node build/verify.js` green.

## Deep explanations
- Each question may have `deep` (string, Markdown): step-by-step Uzbek explanation why the answer is right and why others are wrong, with a fenced code block when code helps and an inline `<svg>` diagram when a picture helps (flows, memory layout, timelines). Keep `explanation` as the short version.
- UI shows `deep` behind a "Batafsil" toggle after answering.

## Content conventions
- Questions, options and explanations are in Uzbek; technical terms stay in English.
- Types: `mcq` / `code` (have `options` + `answer`), `sql` (`modelAnswer` + `keywords`), `open` (`modelAnswer` list).
