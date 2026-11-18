// Tests voor de routeberekening (draait in GitHub bij elke pull request, ook lokaal: node tools/routes.mjs)
// Een fout hier kan een beginner over een zwarte piste sturen, dus we controleren op echte gebieden:
// - een route gaat nooit boven je niveau, tenzij de app ruimer moest zoeken (en dat dan ook meldt)
// - gesloten liften en pistes worden nooit gebruikt
// - de gezinsmodus gebruikt zonder melding alleen groene en blauwe pistes
// - een lift gaat alleen naar beneden als dat mag, en de route sluit aan van begin tot eind
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";

const { chromium } = await import("playwright").catch(() => createRequire(import.meta.url)("playwright"));
const ROOT = new URL("..", import.meta.url).pathname, PORT = 8798;
const TYPES = {".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".json":"application/json", ".svg":"image/svg+xml", ".png":"image/png", ".webmanifest":"application/manifest+json"};
const server = createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname); const f = join(ROOT, p === "/" ? "index.html" : p);
  try{ const b = await readFile(f); res.writeHead(200, {"Content-Type":TYPES[extname(f)] || "application/octet-stream"}); res.end(b); }catch(e){ res.writeHead(404); res.end(); }
}).listen(PORT);

const browser = await chromium.launch();
const ctx = await browser.newContext({viewport:{width:375, height:812}});
await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
await ctx.addInitScript(() => { localStorage.setItem("pp-onboarded", "1"); localStorage.setItem("pp-lang", "nl"); });
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", e => errors.push(e.message));
await p.goto(`http://localhost:${PORT}/index.html`); await p.waitForTimeout(2000);

const AREAS = [/Arlberg/, /Zermatt/, /Paradiski|Les Arcs/, "noord-amerika"];
let fails = 0, total = 0;
for(const pick of AREAS){
  const res = await p.evaluate(async src => {
    const re = src.startsWith("/") ? new RegExp(src.slice(1, -1)) : null;
    const row = re ? S.index.find(r => re.test(r[1])) : S.index.filter(r => r[12] === src).sort((a, b) => b[6] - a[6])[0];
    if(!row) return {name:src, skip:true};
    localStorage.setItem("pp-dl-" + row[0], JSON.stringify({v:1, t:Date.now()}));
    await openArea(row[0]);
    const A = S.area, bad = [];
    // vaste willekeur, zodat een fout altijd terugkomt
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const stations = [...new Set(A.edges.filter(e => e.t === "l").flatMap(e => [e.a, e.b]))];
    const pairs = Array.from({length:120}, () => [stations[Math.floor(rnd() * stations.length)], stations[Math.floor(rnd() * stations.length)]]).filter(([a, b]) => a !== b);
    const reset = () => { S.via = null; S.target = null; S.wps = []; S.lunch = null; S.night = false; S.free = false; S.closed = new Set(); };
    const label = x => `${x.e.t}${x.e.i}${x.e.t === "r" ? "(" + x.e.diff + ")" : ""}`;
    const check = (name, a, b, extra) => {
      S.from = a; S.to = b; const path = computePath();
      if(!path) return 0;
      // aansluiting
      let cur = a;
      for(const s of path){ if(s.from !== cur){ bad.push(`${name}: route sluit niet aan bij ${label(s)}`); break; } cur = s.to; }
      if(cur !== b) bad.push(`${name}: route eindigt niet op de bestemming`);
      for(const s of path){
        if(s.e.t === "l" && s.rev && !s.e.down) bad.push(`${name}: lift ${s.e.i} naar beneden terwijl dat niet kan`);
        if(s.e.t !== "w" && S.closed.has(s.e.i)) bad.push(`${name}: gesloten ${label(s)} gebruikt`);
        if(s.e.t === "r" && overLevel(s.e) && S.relax < 2) bad.push(`${name}: ${label(s)} boven niveau ${S.level} zonder melding (relax ${S.relax})`);
      }
      extra?.(path);
      return 1;
    };
    let n = 0;
    // beginner, gemiddeld en gevorderd
    for(const lvl of [1, 2, 3]){ reset(); S.level = lvl; S.family = false; for(const [a, b] of pairs) n += check(`niveau ${lvl} ${a}->${b}`, a, b); }
    // gesloten liften en pistes (30 procent dicht)
    reset(); S.level = 2; const ids = A.edges.filter(e => e.t !== "w").map(e => e.i);
    for(const [a, b] of pairs.slice(0, 60)){ S.closed = new Set(ids.filter(() => rnd() < .3)); n += check(`dicht ${a}->${b}`, a, b); }
    // gezinsmodus: zonder melding alleen groen en blauw
    reset(); S.family = true; S.level = 1;
    for(const [a, b] of pairs) n += check(`gezin ${a}->${b}`, a, b, path => {
      if(!S.relax) for(const s of path) if(s.e.t === "r" && DIFF[s.e.diff].lvl > 1) bad.push(`gezin ${a}->${b}: ${s.e.diff}-piste ${s.e.i} zonder melding`);
    });
    S.family = false; S.level = 2; reset();
    return {name:row[1], routes:n, stations:stations.length, bad:bad.slice(0, 15), badCount:bad.length};
  }, pick instanceof RegExp ? String(pick) : pick);
  if(res.skip){ console.log(`overgeslagen: ${res.name}`); continue; }
  total += res.routes; fails += res.badCount;
  console.log(`${res.badCount ? "FOUT" : "ok  "} ${res.name}: ${res.routes} routes, ${res.stations} liftstations${res.badCount ? `, ${res.badCount} fouten` : ""}`);
  res.bad.forEach(b => console.log("     " + b));
  if(res.routes < 50){ fails++; console.log("     te weinig routes gevonden; klopt de data nog?"); }
}
if(errors.length){ fails += errors.length; errors.forEach(e => console.log("fout in de pagina: " + e)); }
await browser.close(); server.close();
console.log(fails ? `\n${fails} problemen in ${total} routes.` : `\nAlle ${total} routes in orde.`);
process.exit(fails ? 1 : 0);
