// roadmaps-raw/*.json ichidagi `checklist` tipidagi node'larni roadmaps-clean ga qo'shadi.
// Best-practice roadmaplar faqat checklist node'lardan iborat, shuning uchun eski
// extractor (topic/subtopic qidiradi) ular uchun bo'sh natija bergan edi.
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const rawDir = path.join(root, "roadmaps-raw");
const cleanDir = path.join(root, "roadmaps-clean");

let patched = 0;
for (const file of fs.readdirSync(rawDir).filter(f => f.endsWith(".json"))) {
  const raw = JSON.parse(fs.readFileSync(path.join(rawDir, file), "utf8"));
  const nodes = Array.isArray(raw.nodes) ? raw.nodes : [];
  const groups = nodes
    .filter(n => n.type === "checklist" && n.data && Array.isArray(n.data.checklists))
    .map(n => ({
      id: n.id,
      title: n.data.label,
      subtopics: n.data.checklists.map(c => ({ id: c.id, title: c.label, linkedBy: "checklist" }))
    }))
    .filter(g => g.title && g.subtopics.length);
  if (!groups.length) continue;

  const cleanPath = path.join(cleanDir, file);
  if (!fs.existsSync(cleanPath)) continue;
  const clean = JSON.parse(fs.readFileSync(cleanPath, "utf8"));

  const have = new Set((clean.topics || []).map(t => t.id));
  const add = groups.filter(g => !have.has(g.id));
  if (!add.length) continue;

  clean.topics = (clean.topics || []).concat(add);
  clean.topicCount = clean.topics.length;
  clean.subtopicCount = clean.topics.reduce((n, t) => n + (t.subtopics ? t.subtopics.length : 0), 0);
  fs.writeFileSync(cleanPath, JSON.stringify(clean, null, 2));
  console.log(
    "%s: +%d guruh, topics=%d subtopics=%d",
    clean.slug, add.length, clean.topicCount, clean.subtopicCount
  );
  patched++;
}
console.log("tuzatilgan fayllar:", patched);
