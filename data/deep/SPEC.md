# Deep explanation spec

Output file: `data/deep/<sectionId>.json` — one JSON object `{ "<question id>": "<markdown string>", ... }`, covering EVERY question of that section in `data/questions.json` (`sections.find(s=>s.id===sectionId).questions` — source of truth). Key = question `id` as string.

Language: Uzbek (Latin), technical terms in English. Audience: backend engineer preparing for Senior interview; explain like a good mentor.

Structure of each markdown value (adapt; skip parts that don't fit):
```
### Qisqa javob
1-2 sentences: the correct answer and core idea.

### Nega shunday
Step-by-step mechanism: what happens under the hood, why.

### Nega boshqa variantlar xato        (mcq/code only; one bullet per wrong option, "**A)** ...")

### Misol                               (code when it helps: ```go / ```sql / ```bash / ```yaml ...)

### Diagramma                           (inline <svg> ONLY when a picture really helps: flows, timelines, memory layout, trees, architecture)

### Intervyuda
- what interviewer expects / follow-up questions / common pitfalls
```
For `open`/`sql` types: expand each point of modelAnswer, show a sample strong answer.

Length: ~150-400 words; harder levels (S/St/P) may go longer.

Markdown supported by the renderer ONLY: `###` headings, ``` fenced code, `- ` / `1. ` lists (single level), `**bold**`, `` `code` ``, blank-line paragraphs, and an `<svg>...</svg>` block starting on its own line. No tables, no nested lists, no links, no images, no HTML other than svg.

SVG rules: `viewBox` set, width ≤ 640, no fixed height; use `fill="currentColor"`/`stroke="currentColor"` for text and lines (works in dark + light), accent colors only `#6d5dfc`, `#22a06b`, `#e5484d`, `#f5a524` with fill-opacity for boxes; font-size 12-14, font-family sans-serif; no scripts, no external refs. Keep text inside boxes. Never put a blank line inside the svg block.

Accuracy first: verify every claim; if the existing `answer`/`explanation` looks wrong, still write the deep text correctly and list the id in your final report.

Write with a node script (JSON.stringify) so escaping is valid; then check: `node -e "const d=require('./data/deep/<id>.json');const s=require("./data/questions.json").sections.find(x=>x.id==="<id>");const miss=s.questions.filter(q=>!d[q.id]);console.log(Object.keys(d).length,miss.map(q=>q.id))"` shows zero missing. Work in chunks (e.g. 10 questions per write, merging into the existing file) so progress is never lost. Do not edit any other file.
