// Bewegende beelden uit de echte app voor de promofilm (store/video/promo-film.html).
//   node tools/promo-clips.mjs [taal, standaard en] [fragmenten, bv. orbit,zoom] [aantal beelden]
// Niet een schermopname in echte tijd (die hapert), maar beeld voor beeld: de camera van de kaart krijgt telkens een
// volgende stand, de kaart tekent zich af, en dan pas wordt het beeld bewaard. Zo is elk beeld scherp en de beweging vloeiend.
// De beelden komen in store/video/clips/<taal>/<fragment>/0000.jpg … (niet in git; zie .gitignore). Heeft internet nodig.
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile, mkdir, rm } from "node:fs/promises";
import { extname, join } from "node:path";

const req = createRequire(import.meta.url);
const pw = await import("playwright").catch(() => req("playwright"));
const { chromium } = pw.chromium ? pw : pw.default;
const ROOT = new URL("..", import.meta.url).pathname, PORT = 8791, lang = process.argv[2] || "en";
const only = (process.argv[3] || "zoom,orbit").split(","), N = +process.argv[4] || 120;
const TYPES = {".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".json":"application/json", ".svg":"image/svg+xml", ".png":"image/png", ".jpg":"image/jpeg", ".woff2":"font/woff2"};
const server = createServer(async (rq, res) => {
  const p = decodeURIComponent(new URL(rq.url, "http://x").pathname); const f = join(ROOT, p === "/" ? "index.html" : p);
  try{ const b = await readFile(f); res.writeHead(200, {"Content-Type":TYPES[extname(f)] || "application/octet-stream"}); res.end(b); }catch(e){ res.writeHead(404); res.end(); }
}).listen(PORT);
const AREA = "Les Trois Vallées";
const browser = await chromium.launch();
const ctx = await browser.newContext({viewport:{width:430, height:932}, deviceScaleFactor:1.5, isMobile:true, hasTouch:true, serviceWorkers:"block", locale:lang, permissions:["geolocation"], geolocation:{latitude:45.33, longitude:6.58, accuracy:8}});
await ctx.addInitScript(l => { localStorage.setItem("pp-onboarded", "1"); localStorage.setItem("pp-new-2", "1"); localStorage.setItem("pp-lang", l); localStorage.setItem("pp-theme", "light"); }, lang);
const p = await ctx.newPage(); p.on("pageerror", e => console.log("fout in de pagina:", e.message));
await p.goto(`http://localhost:${PORT}/index.html`); await p.waitForFunction(() => typeof S !== "undefined" && S.index.length > 0);
await p.evaluate(async name => { closePicker(); const r = S.index.find(r => r[1] === name); localStorage.setItem("pp-dl-" + r[0], JSON.stringify({v:1, t:Date.now()})); await openArea(r[0]); document.documentElement.classList.add("ios"); return 0; }, AREA);
await p.waitForTimeout(12000);
const clean = () => p.evaluate(() => { document.getElementById("toast")?.classList.remove("on"); document.querySelectorAll(".ad-slot,.adsbygoogle,#adState").forEach(e => e.hidden = true); });
const dirOf = async name => { const d = join(ROOT, "store/video/clips", lang, name); await rm(d, {recursive:true, force:true}); await mkdir(d, {recursive:true}); return d; };
const ease = u => u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
await p.evaluate(() => { dayRoute(); return 0; }); await p.waitForTimeout(9000); await clean();

// zoom: de platte kaart zoomt rustig in op de route
if(only.includes("zoom")){
  const dir = await dirOf("zoom"), t0 = Date.now();
  const v = await p.evaluate(() => { map.options.zoomSnap = 0; map.options.zoomDelta = .01; const c = map.getCenter(); return {lat:c.lat, lng:c.lng, z:map.getZoom()}; });
  for(let i = 0; i < N; i++){ const u = ease(i / (N - 1));
    await p.evaluate(([v, u]) => new Promise(r => { map.setView([v.lat + .012 * u, v.lng - .004 * u], v.z + .9 * u, {animate:false}); requestAnimationFrame(() => requestAnimationFrame(r)); }), [v, u]);
    await p.waitForTimeout(i === 0 ? 800 : 120); await p.screenshot({path:join(dir, String(i).padStart(4, "0") + ".jpg"), type:"jpeg", quality:90}); }
  console.log(`zoom: ${N} beelden in ${Math.round((Date.now() - t0) / 1000)} s`);
  await p.evaluate(v => map.setView([v.lat, v.lng], v.z, {animate:false}), v); await p.waitForTimeout(1500);
}
// orbit: de 3D-kaart draait langzaam om de berg
if(only.includes("orbit")){
  const dir = await dirOf("orbit"), t0 = Date.now();
  await p.evaluate(() => { document.getElementById("threeBtn").click(); return 0; }); await p.waitForTimeout(25000); await clean();
  const v = await p.evaluate(() => { const g = M3.gl; return {b:g.getBearing(), z:g.getZoom(), p:g.getPitch()}; });
  for(let i = 0; i < N; i++){ const u = ease(i / (N - 1));
    await p.evaluate(([v, u]) => new Promise(r => { const g = M3.gl; let done = false; const fin = () => { if(!done){ done = true; r(); } };
      g.jumpTo({bearing:v.b - 28 + 56 * u, zoom:v.z + .12 + .28 * u, pitch:Math.min(70, v.p + 4 * u)}); g.once("idle", fin); setTimeout(fin, 1600); }), [v, u]);
    await p.screenshot({path:join(dir, String(i).padStart(4, "0") + ".jpg"), type:"jpeg", quality:90}); }
  console.log(`orbit: ${N} beelden in ${Math.round((Date.now() - t0) / 1000)} s`);
}
await browser.close(); server.close();
