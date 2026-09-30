// interview.html ni node'da yuklab, ma'lumot yaxlitligini tekshiradi
const fs=require("fs");
const el=()=>new Proxy(function(){},{get:(t,k)=>k==="style"?{}:(k==="classList"?{add(){},remove(){},toggle(){}}:el()),set:()=>true,apply:()=>el()});
global.document={querySelector:()=>el(),querySelectorAll:()=>[],createElement:()=>el(),addEventListener(){},body:el()};
global.window={addEventListener(){},scrollTo(){},matchMedia:()=>({matches:false,addEventListener(){}})};
global.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
const h=fs.readFileSync(__dirname+"/../interview.html","utf8");
eval(h.split("<script>")[1].split("</script>")[0]+";global.Q=Q;global.SEC=SEC;global.secOf=secOf;global.LV=LV;");
const orphan=Q.filter(q=>!secOf(q)).map(q=>q.n);
const bad=Q.filter(q=>q.t==="mcq"&&!(Array.isArray(q.o)&&q.o.length>1&&q.a<q.o.length)).map(q=>q.n);
const noExp=Q.filter(q=>!q.e).map(q=>q.n);
console.log("total",Q.length,"sections",Object.keys(SEC).length,"ids",new Set(Q.map(q=>q.id)).size);
console.log("orphan",orphan.length,"badMcq",bad.length,"noExplanation",noExp.length);
const gq=Q.filter(q=>q.d==="go");const c={};gq.forEach(q=>{const s=secOf(q);c[s]=(c[s]||0)+1});
console.log("GO",gq.length);Object.entries(c).forEach(([k,v])=>console.log("  ",k,SEC[k][0],v));
const lv={};gq.forEach(q=>lv[q.l]=(lv[q.l]||0)+1);console.log("GO levels",JSON.stringify(lv));
if(orphan.length||bad.length||noExp.length)process.exit(1);
