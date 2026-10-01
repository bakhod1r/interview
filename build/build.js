// data/questions.json -> interview.html
// Shell (UI/CSS/render) build/shell-v9.html dan olinadi, faqat data bloki almashtiriladi.
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");

const data = JSON.parse(fs.readFileSync(path.join(root, "data/questions.json"), "utf8"));
const shell = fs.readFileSync(path.join(__dirname, "shell-v9.html"), "utf8");

// data/deep/<sectionId>.json: { "<id>": "markdown" } — batafsil tushuntirishlar
const deepDir = path.join(root, "data/deep");
const DEEP = {};
if (fs.existsSync(deepDir)) for (const f of fs.readdirSync(deepDir)) if (f.endsWith(".json"))
  Object.assign(DEEP, JSON.parse(fs.readFileSync(path.join(deepDir, f), "utf8")));

// data/cards/<sectionId>.json: { "<id>": { "f": "flashcard savoli (ixtiyoriy)", "a": "tushunarli javob (markdown)" } }
const cardDir = path.join(root, "data/cards");
const CARD = {};
if (fs.existsSync(cardDir)) for (const f of fs.readdirSync(cardDir)) if (f.endsWith(".json"))
  Object.assign(CARD, JSON.parse(fs.readFileSync(path.join(cardDir, f), "utf8")));

const questions = [];
const SEC = {};
for (const s of data.sections) {
  SEC[s.id] = [s.name, s.topics, s.domain];
  for (const q of s.questions) {
    const o = { l: q.level, t: q.type, tp: q.topic, d: q.domain, id: q.id, n: q.code, q: q.question };
    if (q.snippet) o.c = q.snippet;
    if (q.options) { o.o = q.options; o.a = q.answer; }
    if (q.modelAnswer) o.m = q.modelAnswer;
    if (q.keywords) o.k = q.keywords;
    o.e = q.explanation;
    if (q.source) o.src = q.source;
    if (DEEP[q.id]) o.x = DEEP[q.id];
    const c = CARD[q.id];
    if (c) { if (c.f) o.f = c.f; if (c.a) o.b = c.a; }
    questions.push(o);
  }
}

// atamalar lug'ati: javob matnida uchragan atamalarga izoh
const GLO = fs.existsSync(path.join(root, "data/glossary.json")) ? JSON.parse(fs.readFileSync(path.join(root, "data/glossary.json"), "utf8")) : [];
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const gre = GLO.map(g => g.k.map(k => {
  const t = k.trim();
  if (/^[A-Z0-9\-\/]+$/.test(t) && t.length <= 5) return new RegExp("(^|[^A-Za-z0-9])" + esc(t) + "(?![A-Za-z0-9])");
  return new RegExp("(^|[^A-Za-z0-9'])" + esc(t), "i");
}));
for (const o of questions) {
  const txt = [o.f || o.q, o.b || ""].join(" ");
  const g = [];
  gre.forEach((rs, i) => { if (g.length < 8 && rs.some(r => r.test(txt))) g.push(i); });
  if (g.length) o.g = g;
}

// bo'limi bo'lmagan savol qolmasin
const secOf = q => Object.keys(SEC).find(k => SEC[k][2] === q.d && SEC[k][1].includes(q.tp));
const orphan = questions.filter(q => !secOf(q));
if (orphan.length) { console.error("bo'limsiz savollar:", orphan.map(q => q.n)); process.exit(1); }

const ids = new Set(questions.map(q => q.id));
if (ids.size !== questions.length) { console.error("id takrorlangan"); process.exit(1); }

const badMcq = questions.filter(q => q.t === "mcq" && !(Array.isArray(q.o) && q.o.length > 1 && q.a < q.o.length));
if (badMcq.length) { console.error("mcq javob indeksi xato:", badMcq.map(q => q.n)); process.exit(1); }

// matndagi "</script>", "<script", "<!--" inline <script> ni buzmasin
const js = v => JSON.stringify(v).replace(/<(\/|script|!--)/gi, "\\u003c$1");
const block = [
  "const Q=" + js(questions) + ";",
  "const DOM=" + js(data.domains) + ";",
  "const SEC=" + js(SEC) + ";",
  "const GLO=" + js(GLO.map(g => [g.t, g.d])) + ";"
].join("\n");

// docs/*.md -> "Qo'llanmalar" guruhi; docs/**/<papka>/*.md (rekursiv) -> guruh nomi = shu papka README.md "# " sarlavhasi
// (README yo'q bo'lsa papka yo'li). README o'zi kirmaydi. DOCS element: [id, sarlavha, markdown, guruh]
const docsDir = path.join(root, "docs");
const DOCS = [];
const walkDocs = rel => {
  const dir = path.join(docsDir, rel), ents = fs.readdirSync(dir, { withFileTypes: true });
  const rd = path.join(dir, "README.md");
  const group = !rel ? "Qo'llanmalar" : ((fs.existsSync(rd) && (fs.readFileSync(rd, "utf8").match(/^# (.+)$/m) || [])[1]) || rel).trim();
  ents.filter(e => e.isFile() && e.name.endsWith(".md") && e.name !== "README.md").map(e => e.name).sort().forEach(f => {
    const r = rel ? rel + "/" + f : f, src = fs.readFileSync(path.join(docsDir, r), "utf8"), m = src.match(/^# (.+)$/m);
    DOCS.push([r.replace(/\.md$/, "").replace(/\//g, "-"), m ? m[1].trim() : f, src, group]);
  });
  ents.filter(e => e.isDirectory()).map(e => e.name).sort().forEach(d => walkDocs(rel ? rel + "/" + d : d));
};
if (fs.existsSync(docsDir)) walkDocs("");

const start = shell.indexOf("const QD=[");
const marker = "const secOf=q=>";
const end = shell.indexOf(marker);
if (start < 0 || end < 0 || end < start) { console.error("shell ichidan data bloki topilmadi"); process.exit(1); }

let out = shell.slice(0, start) + block + "\n" + shell.slice(end);
if (!out.includes("const DOCS=[];")) { console.error("shell ichida 'const DOCS=[];' topilmadi"); process.exit(1); }
out = out.replace("const DOCS=[];", () => "const DOCS=" + js(DOCS) + ";");
out = out.replace("<h1>Interview Drill <span>DB + Backend</span></h1>",
  `<h1>Interview Drill <span>${questions.length} savol</span></h1>`);

// yaroqsiz filtrni tozalash shell ichida (render oldidan)

fs.writeFileSync(path.join(root, "interview.html"), out);
console.log("interview.html yozildi:", questions.length, "savol,", Object.keys(SEC).length, "bo'lim,", DOCS.length, "qo'llanma,", (out.length / 1024).toFixed(0) + " KB");
