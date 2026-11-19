// Volle opslag: tijdelijke gegevens (bewaard weer, hutten) gaan eerst weg, je skidag en instellingen nooit,
// en de app zegt niet "bewaard" als het bewaren mislukte.
//   node tools/storage.mjs
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";

const req = createRequire(import.meta.url);
const pw = await import("playwright").catch(() => req("playwright"));
const { chromium, devices } = pw.chromium ? pw : pw.default;
const ROOT = new URL("..", import.meta.url).pathname, PORT = 8794;
const TYPES = {".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".json":"application/json", ".svg":"image/svg+xml", ".png":"image/png", ".woff2":"font/woff2"};
const server = createServer(async (rq, res) => {
  const p = decodeURIComponent(new URL(rq.url, "http://x").pathname); const f = join(ROOT, p === "/" ? "index.html" : p);
  try{ const b = await readFile(f); res.writeHead(200, {"Content-Type":TYPES[extname(f)] || "application/octet-stream"}); res.end(b); }catch(e){ res.writeHead(404); res.end(); }
}).listen(PORT);
const browser = await chromium.launch(), problems = [];
const ctx = await browser.newContext({...devices["iPhone 15"], serviceWorkers:"block"});
await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
await ctx.addInitScript(() => { localStorage.setItem("pp-onboarded", "1"); localStorage.setItem("pp-new-2", "1"); localStorage.setItem("pp-lang", "nl"); });
const p = await ctx.newPage(); p.on("pageerror", e => problems.push(`fout in de pagina: ${e.message}`));
await p.goto(`http://localhost:${PORT}/index.html`); await p.waitForFunction(() => typeof S !== "undefined" && S.index.length > 0);
const r = await p.evaluate(async () => {
  const size = () => { let n = 0; for(let i = 0; i < localStorage.length; i++){ const k = localStorage.key(i); n += k.length + localStorage.getItem(k).length; } return n; };
  const has = pre => { for(let i = 0; i < localStorage.length; i++) if(localStorage.key(i).startsWith(pre)) return true; return false; };
  const real = Storage.prototype.setItem; let cap = Infinity;
  // een opslag met een grens: schrijven faalt zodra het totaal erboven komt, zoals een echte volle opslag
  Storage.prototype.setItem = function(k, v){ const old = this.getItem(k); if(size() - (old ? k.length + old.length : 0) + k.length + String(v).length > cap) throw new DOMException("vol", "QuotaExceededError"); return real.call(this, k, v); };
  const out = {};
  // 1. opruimen bij de start: oud weer en hutten van oude kaartgegevens weg, vers weer blijft
  localStorage.setItem("pp-wx:oud", JSON.stringify({t:Date.now() - 5 * 864e5, d:"x".repeat(2000)}));
  localStorage.setItem("pp-wx:vers", JSON.stringify({t:Date.now(), d:"x".repeat(2000)}));
  localStorage.setItem("pp-huts2:d0:oud", "x".repeat(2000));
  out.pruned = pruneStore(false); out.oldGone = !has("pp-wx:oud") && !has("pp-huts2:d0:"); out.freshKept = has("pp-wx:vers");
  // 2. vol: het bewaarde weer gaat weg en de skidag wordt bewaard
  for(let i = 0; i < 20; i++) localStorage.setItem("pp-wx:a" + i, JSON.stringify({t:Date.now(), d:"x".repeat(5000)}));
  localStorage.setItem("pp-favs", JSON.stringify(["abc"])); const settings = localStorage.getItem("pistenplanner-app");
  cap = size() + 200;
  const day = {date:todayKey(), start:Date.now(), area:null, areaName:"Test", pts:Array.from({length:400}, (_, i) => [47 + i / 1e4, 10, 2000, i]), sum:null};
  out.saved = saveDay(day); out.dayThere = !!loadDay(day.date); out.wxGone = !has("pp-wx:"); out.favsKept = localStorage.getItem("pp-favs") === JSON.stringify(["abc"]); out.settingsKept = localStorage.getItem("pistenplanner-app") === settings;
  // 3. echt vol (ook na opruimen): geen "bewaard", wel een eerlijke melding; de vorige versie van de dag blijft staan
  cap = size() - 10; day.pts = Array.from({length:4000}, (_, i) => [47 + i / 1e4, 10, 2000, i]);
  out.savedFull = saveDay(day); await new Promise(r => setTimeout(r, 100)); out.toast = document.getElementById("toast").textContent; out.oldDay = loadDay(day.date)?.pts.length;
  Storage.prototype.setItem = real; return out;
});
if(r.pruned < 2 || !r.oldGone || !r.freshKept) problems.push(`opruimen bij de start klopt niet: ${JSON.stringify(r)}`);
if(!r.saved || !r.dayThere || !r.wxGone) problems.push(`bij een volle opslag is de skidag niet bewaard na het opruimen van het weer: ${JSON.stringify(r)}`);
if(!r.favsKept || !r.settingsKept) problems.push(`bij het opruimen zijn favorieten of instellingen geraakt: ${JSON.stringify(r)}`);
if(r.savedFull !== false || !/opslag is vol/i.test(r.toast) || r.oldDay !== 400) problems.push(`bij een echt volle opslag hoort een eerlijke melding en blijft de vorige versie staan: ${JSON.stringify(r)}`);
await browser.close(); server.close();
console.log(problems.length ? problems.join("\n") + `\n\n${problems.length} problemen.` : "Opslag in orde.");
process.exit(problems.length ? 1 : 0);
