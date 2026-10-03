// data/questions.json + data/cards -> anki/interview-drill.txt (Anki "Import File" uchun TSV)
// Anki: File > Import > interview-drill.txt. Deck, tag, GUID fayl header'idan olinadi;
// qayta import qilinsa GUID bo'yicha mavjud kartalar yangilanadi (FSRS tarixi saqlanadi).
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");

const data = JSON.parse(fs.readFileSync(path.join(root, "data/questions.json"), "utf8"));
const CARD = {};
const cardDir = path.join(root, "data/cards");
for (const f of fs.readdirSync(cardDir)) if (f.endsWith(".json"))
  Object.assign(CARD, JSON.parse(fs.readFileSync(path.join(cardDir, f), "utf8")));

// shell-v9 dagi mini markdown bilan bir xil
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const inline = s => esc(s).replace(/&lt;(\/?)b&gt;/g, "<$1b>").replace(/`([^`]+)`/g, "<code>$1</code>");
const mdi = s => inline(s).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
function md(src) {
  const L = src.split("\n"); let h = "", i = 0;
  while (i < L.length) {
    const l = L[i];
    if (l.startsWith("```")) { const c = []; i++; while (i < L.length && !L[i].startsWith("```")) c.push(L[i++]); i++; h += `<pre>${esc(c.join("\n"))}</pre>`; continue; }
    if (/^\s*<svg/.test(l)) { const c = []; while (i < L.length) { c.push(L[i]); if (/<\/svg>/.test(L[i++])) break; } h += `<div>${c.join(" ")}</div>`; continue; }
    if (/^#{1,4} /.test(l)) { h += `<h4>${mdi(l.replace(/^#+ /, ""))}</h4>`; i++; continue; }
    if (/^\s*([-*]|\d+\.) /.test(l)) { const ol = /^\s*\d/.test(l); const c = []; while (i < L.length && /^\s*([-*]|\d+\.) /.test(L[i])) c.push(L[i++].replace(/^\s*([-*]|\d+\.) /, "")); h += `<${ol ? "ol" : "ul"}>${c.map(x => `<li>${mdi(x)}</li>`).join("")}</${ol ? "ol" : "ul"}>`; continue; }
    if (!l.trim()) { i++; continue; }
    const c = []; while (i < L.length && L[i].trim() && !/^(```|#{1,4} |\s*([-*]|\d+\.) |\s*<svg)/.test(L[i])) c.push(L[i++]); h += `<p>${mdi(c.join(" "))}</p>`;
  }
  return h;
}
// TSV maydon: tab/yangi qator bo'lmasin (<pre> ichida <br> ham ishlaydi)
const field = s => s.replace(/\t/g, "    ").replace(/\r?\n/g, "<br>");
const tag = s => String(s).replace(/[^\p{L}\p{N}_-]+/gu, "_");
const LVL = { J: "Junior", M: "Middle", S: "Senior", St: "Staff", P: "Principal" };

const rows = [];
let noCard = 0;
for (const s of data.sections) for (const q of s.questions) {
  const c = CARD[q.id] || {};
  if (!c.a) noCard++;
  const deck = ["Interview Drill", data.domains[s.domain] || s.domain, `${s.id.toUpperCase()} ${s.name}`].join("::");
  let front = `<p>${mdi(c.f || q.question)}</p>`;
  if (q.snippet) front += `<pre>${esc(q.snippet)}</pre>`;
  const back = md(c.a || q.explanation || "");
  const tags = [`lvl::${LVL[q.level] || q.level}`, `dom::${tag(s.domain)}`, `sec::${s.id}`, tag(q.topic)].join(" ");
  rows.push([deck, `idrill-${q.id}`, field(front), field(back), tags].join("\t"));
}

const out = path.join(root, "anki");
fs.mkdirSync(out, { recursive: true });
const head = ["#separator:tab", "#html:true", "#notetype:Basic", "#deck column:1", "#guid column:2", "#tags column:5"];
fs.writeFileSync(path.join(out, "interview-drill.txt"), head.concat(rows).join("\n") + "\n");
console.log(`anki/interview-drill.txt: ${rows.length} karta` + (noCard ? `, kartasiz (explanation ishlatildi): ${noCard}` : ""));
