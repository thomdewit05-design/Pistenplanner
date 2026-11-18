// Aantikken van pistes (draait in GitHub bij elke pull request, ook lokaal: node tools/taps.mjs)
// Een tik op of vlak naast een piste moet het informatievenster openen. Eerder won elk onzichtbaar knippunt binnen 14 px,
// waardoor het venster uitgezoomd bijna nooit kwam en stilletjes je vertrekpunt of bestemming veranderde.
// - het venster opent in het overgrote deel van de tikken (zoom 12 t/m 15, tot 18 px naast de lijn)
// - een punt wordt alleen direct gekozen als dat een liftstation is
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";

const { chromium, devices } = await import("playwright").then(m => m.chromium ? m : m.default).catch(() => createRequire(import.meta.url)("playwright"));
const ROOT = new URL("..", import.meta.url).pathname, PORT = 8795;
const TYPES = {".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".json":"application/json", ".svg":"image/svg+xml", ".png":"image/png", ".webmanifest":"application/manifest+json"};
const server = createServer(async (rq, res) => {
  const p = decodeURIComponent(new URL(rq.url, "http://x").pathname); const f = join(ROOT, p === "/" ? "index.html" : p);
  try{ const b = await readFile(f); res.writeHead(200, {"Content-Type":TYPES[extname(f)] || "application/octet-stream"}); res.end(b); }catch(e){ res.writeHead(404); res.end(); }
}).listen(PORT);

const browser = await chromium.launch();
const ctx = await browser.newContext({...devices["iPhone 15"], serviceWorkers:"block"});
await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
await ctx.addInitScript(() => { localStorage.setItem("pp-onboarded", "1"); localStorage.setItem("pp-new-2", "1"); localStorage.setItem("pp-lang", "nl"); });
const p = await ctx.newPage();
const errors = []; p.on("pageerror", e => errors.push(e.message));
await p.goto(`http://localhost:${PORT}/index.html`); await p.waitForFunction(() => typeof S !== "undefined" && S.index.length > 0);
await p.evaluate(async () => { closePicker(); const r = S.index.find(r => /Arlberg/.test(r[1])); localStorage.setItem("pp-dl-" + r[0], JSON.stringify({v:1, t:Date.now()})); await openArea(r[0]); });
await p.waitForTimeout(1500);

// [zoom, pixels naast de lijn, minimaal aandeel vensters]
const CASES = [[12, 0, .8], [12, 10, .75], [13, 10, .8], [14, 18, .88], [15, 18, .9]];
let fails = 0;
for(const [z, off, min] of CASES){
  const r = await p.evaluate(([z, off]) => {
    const A = S.area; let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const runs = A.edges.filter(e => e.t === "r"), orig = window.edgePopup;
    let hit = 0, pop = 0, station = 0, other = 0, none = 0; window.edgePopup = () => { hit++; };
    for(let k = 0; k < 200; k++){
      const e = runs[Math.floor(rnd() * runs.length)], i = Math.floor(rnd() * (e.pts.length - 1)), f = rnd(), a = e.pts[i], b = e.pts[i + 1], q = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
      map.setView(q, z, {animate:false});
      const pt = map.latLngToContainerPoint(q), ang = rnd() * 6.283, tap = map.containerPointToLatLng([pt.x + Math.cos(ang) * off, pt.y + Math.sin(ang) * off]);
      const from = S.from, to = S.to, pick = S.pick; hit = 0; map.fire("click", {latlng:tap});
      if(hit) pop++; else if(S.from !== from || S.to !== to){ const n = S.from !== from ? S.from : S.to; (isStation(n) ? station++ : other++); } else none++;
      S.from = from; S.to = to; S.pick = pick;
    }
    window.edgePopup = orig;
    return {pop, station, other, none};
  }, [z, off]);
  const share = r.pop / 200, bad = share < min || r.other > 0;
  if(bad) fails++;
  console.log(`${bad ? "FOUT" : "ok  "} zoom ${z}, ${off} px naast de lijn: venster ${Math.round(share * 100)}% (minimaal ${Math.round(min * 100)}%), liftstation gekozen ${r.station}, ander punt gekozen ${r.other}, niets ${r.none}`);
}
if(errors.length){ fails += errors.length; errors.forEach(e => console.log("fout in de pagina: " + e)); }
await browser.close(); server.close();
console.log(fails ? `\n${fails} problemen.` : "\nAantikken van pistes in orde.");
process.exit(fails ? 1 : 0);
