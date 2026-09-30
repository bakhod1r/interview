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
    questions.push(o);
  }
}

// bo'limi bo'lmagan savol qolmasin
const secOf = q => Object.keys(SEC).find(k => SEC[k][2] === q.d && SEC[k][1].includes(q.tp));
const orphan = questions.filter(q => !secOf(q));
if (orphan.length) { console.error("bo'limsiz savollar:", orphan.map(q => q.n)); process.exit(1); }

const ids = new Set(questions.map(q => q.id));
if (ids.size !== questions.length) { console.error("id takrorlangan"); process.exit(1); }

const badMcq = questions.filter(q => q.t === "mcq" && !(Array.isArray(q.o) && q.o.length > 1 && q.a < q.o.length));
if (badMcq.length) { console.error("mcq javob indeksi xato:", badMcq.map(q => q.n)); process.exit(1); }

const block = [
  "const Q=" + JSON.stringify(questions) + ";",
  "const DOM=" + JSON.stringify(data.domains) + ";",
  "const SEC=" + JSON.stringify(SEC) + ";"
].join("\n");

const start = shell.indexOf("const QD=[");
const marker = "const secOf=q=>";
const end = shell.indexOf(marker);
if (start < 0 || end < 0 || end < start) { console.error("shell ichidan data bloki topilmadi"); process.exit(1); }

let out = shell.slice(0, start) + block + "\n" + shell.slice(end);
out = out.replace("<h1>Interview Drill <span>DB + Backend</span></h1>",
  `<h1>Interview Drill <span>${questions.length} savol</span></h1>`);

// yaroqsiz filtrni tozalash shell ichida (render oldidan)

fs.writeFileSync(path.join(root, "interview.html"), out);
console.log("interview.html yozildi:", questions.length, "savol,", Object.keys(SEC).length, "bo'lim,", (out.length / 1024).toFixed(0) + " KB");
