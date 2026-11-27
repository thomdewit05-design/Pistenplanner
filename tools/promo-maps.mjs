// Pistekaarten van bekende skigebieden voor de quizvideo (store/video/promo-quiz.html): de echte winterkaart uit de app,
// beeldvullend (1080×1920), zonder zoekbalk, knoppen of namen op de kaart, zodat de naam van het gebied nergens te lezen is.
//   node tools/promo-maps.mjs            schrijft store/video/shots/maps/1.png … en maps.json (naam, land, wat de app erover toont)
// De gebieden staan hieronder in AREAS. Heeft internet nodig voor de winterkaart.
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

const req = createRequire(import.meta.url);
const pw = await import("playwright").catch(() => req("playwright"));
const { chromium } = pw.chromium ? pw : pw.default;
const ROOT = new URL("..", import.meta.url).pathname, PORT = 8790, OUT = join(ROOT, "store/video/shots/maps");
// [naam in de app, naam in de video]
const AREAS = [["Les Trois Vallées", "Les 3 Vallées"], ["Ski Arlberg", "Ski Arlberg"], ["Zermatt - Breuil-Cervinia, Breuil-Cervinia Ski Paradise", "Zermatt – Cervinia"],
  ["Whistler Blackcomb", "Whistler Blackcomb"], ["Les Portes du Soleil", "Portes du Soleil"]];
const TYPES = {".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".json":"application/json", ".svg":"image/svg+xml", ".png":"image/png", ".jpg":"image/jpeg", ".woff2":"font/woff2"};
const server = createServer(async (rq, res) => {
  const p = decodeURIComponent(new URL(rq.url, "http://x").pathname); const f = join(ROOT, p === "/" ? "index.html" : p);
  try{ const b = await readFile(f); res.writeHead(200, {"Content-Type":TYPES[extname(f)] || "application/octet-stream"}); res.end(b); }catch(e){ res.writeHead(404); res.end(); }
}).listen(PORT);
await mkdir(OUT, {recursive:true});
const browser = await chromium.launch();
const ctx = await browser.newContext({viewport:{width:432, height:768}, deviceScaleFactor:2.5, isMobile:true, hasTouch:true, serviceWorkers:"block", locale:"en"});
await ctx.addInitScript(() => { localStorage.setItem("pp-onboarded", "1"); localStorage.setItem("pp-new-2", "1"); localStorage.setItem("pp-lang", "en"); localStorage.setItem("pp-theme", "light"); });
const p = await ctx.newPage(); p.on("pageerror", e => console.log("fout in de pagina:", e.message));
await p.goto(`http://localhost:${PORT}/index.html`); await p.waitForFunction(() => typeof S !== "undefined" && S.index.length > 0);
const info = [];
for(let i = 0; i < AREAS.length; i++){
  const [name, show] = AREAS[i];
  const meta = await p.evaluate(async name => { closePicker(); const r = S.index.find(r => r[1] === name); if(!r) return null;
    localStorage.setItem("pp-dl-" + r[0], JSON.stringify({v:1, t:Date.now()})); await openArea(r[0]);
    // geen namen, nummers, toppen of hutten op de kaart: alleen de pistes en liften
    S.labels = false; S.nums = false; S.peaksOn = false; S.hutsOn = false; S.svcOn = false; applyBase(); drawPeaks(); drawHuts();
    return {cc:r[2], region:r[3], sub:document.querySelector(".topbar")?.innerText.replace(/\s+/g, " ").trim() || ""}; }, name);
  if(!meta){ console.log("niet gevonden:", name); continue; }
  await p.addStyleTag({content:"#sheet,.topbar,.fabs,#tabbar,#ovBtn,#toast,.leaflet-control-container,#layerChips,.ad-slot,.sos-btn,#sosBtn{display:none!important}"});
  await p.evaluate(() => { map.invalidateSize(); map.fitBounds(S.area.bounds, {paddingTopLeft:[30, 90], paddingBottomRight:[30, 170], animate:false}); return 0; });
  await p.waitForTimeout(9000);
  await p.screenshot({path:join(OUT, `${i + 1}.png`)});
  info.push({n:i + 1, name:show, ...meta}); console.log(i + 1, show, meta.sub);
}
await writeFile(join(OUT, "maps.json"), JSON.stringify(info, null, 1));
await browser.close(); server.close();
