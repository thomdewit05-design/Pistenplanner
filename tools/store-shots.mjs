// Schermafbeeldingen voor de App Store: drie per taal, 1290×2796 (het vak van 6,9 inch in App Store Connect).
//   node tools/store-shots.mjs [talen, bv. nl,en] [map-uit]
// Legt de echte app vast (dagroute, 3D, navigatie) en zet die met een kop in een telefoonframe (store/screenshots/compose.html).
// Heeft internet nodig voor de hoogtegegevens van de winterkaart en 3D.
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile, mkdir, rm } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

const req = createRequire(import.meta.url);
const pw = await import("playwright").catch(() => req("playwright"));
const { chromium } = pw.chromium ? pw : pw.default;
const ROOT = new URL("..", import.meta.url).pathname, PORT = 8795, SHOTS = join(ROOT, "store/screenshots");
const LANGS = (process.argv[2] || "nl,en,de,fr,it,es,pt,ru,zh,ja").split(","), OUT = resolve(process.argv[3] || join(SHOTS, "1290x2796"));
const TYPES = {".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".json":"application/json", ".svg":"image/svg+xml", ".png":"image/png", ".jpg":"image/jpeg", ".woff2":"font/woff2"};
const server = createServer(async (rq, res) => {
  const p = decodeURIComponent(new URL(rq.url, "http://x").pathname); const f = join(ROOT, p === "/" ? "index.html" : p);
  try{ const b = await readFile(f); res.writeHead(200, {"Content-Type":TYPES[extname(f)] || "application/octet-stream"}); res.end(b); }catch(e){ res.writeHead(404); res.end(); }
}).listen(PORT);
await mkdir(OUT, {recursive:true});
const AREA = "Les Trois Vallées";
const browser = await chromium.launch();
for(const lang of LANGS){
  const ctx = await browser.newContext({viewport:{width:430, height:932}, deviceScaleFactor:2, isMobile:true, hasTouch:true, serviceWorkers:"block", locale:lang, permissions:["geolocation"], geolocation:{latitude:47.13, longitude:10.2, accuracy:8}});
  await ctx.addInitScript(l => { localStorage.setItem("pp-onboarded", "1"); localStorage.setItem("pp-new-2", "1"); localStorage.setItem("pp-lang", l); localStorage.setItem("pp-theme", "light"); }, lang);
  const p = await ctx.newPage();
  await p.goto(`http://localhost:${PORT}/index.html`); await p.waitForFunction(() => typeof S !== "undefined" && S.index.length > 0);
  await p.evaluate(async name => { closePicker(); const r = S.index.find(r => r[1] === name); localStorage.setItem("pp-dl-" + r[0], JSON.stringify({v:1, t:Date.now()})); await openArea(r[0]); document.documentElement.classList.add("ios"); return 0; }, AREA);
  await p.waitForTimeout(12000);
  const clean = () => p.evaluate(() => { document.getElementById("toast")?.classList.remove("on"); document.querySelectorAll(".ad-slot,.adsbygoogle,#adState").forEach(e => e.hidden = true); });
  // a: dagroute op de winterkaart
  await p.evaluate(() => { dayRoute(); return 0; }); await p.waitForTimeout(9000); await clean();
  await p.screenshot({path:join(SHOTS, `${lang}-a.png`)});
  // b: de bergen in 3D
  await p.evaluate(() => { document.getElementById("threeBtn").click(); return 0; }); await p.waitForTimeout(25000); await clean();
  await p.screenshot({path:join(SHOTS, `${lang}-b.png`)});
  // c: navigatie, met de telefoon op het begin van de route
  const at = await p.evaluate(() => { const s = S.path[0], n = S.area.nodes[s.rev ? s.e.b : s.e.a]; return {latitude:n.lat, longitude:n.lon}; }).catch(() => null);
  if(at) await ctx.setGeolocation({...at, accuracy:6});
  await p.evaluate(() => { toggleFollow(); return 0; }); await p.waitForTimeout(30000); await clean();
  await p.screenshot({path:join(SHOTS, `${lang}-c.png`)});
  await ctx.close();
  // in het frame met de kop
  const c2 = await browser.newContext({viewport:{width:1290, height:2796}, deviceScaleFactor:1}); const q = await c2.newPage();
  for(let n = 0; n < 3; n++){
    await q.goto(`http://localhost:${PORT}/store/screenshots/compose.html?l=${lang}&n=${n}`); await q.waitForSelector("body[data-ready]"); await q.waitForTimeout(400);
    await q.screenshot({path:join(OUT, `${lang}-${n + 1}.jpg`), type:"jpeg", quality:90});
  }
  await c2.close();
  for(const k of "abc") await rm(join(SHOTS, `${lang}-${k}.png`), {force:true});
  console.log(`${lang}: klaar`);
}
await browser.close(); server.close();
