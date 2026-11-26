// Echte schermen van de app voor de promovideo (store/video/promo.html): zonder kop en zonder frame.
//   node tools/promo-shots.mjs [taal, standaard en]
// Zelfde werkwijze als tools/store-shots.mjs. Heeft internet nodig voor de winterkaart en 3D.
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { extname, join } from "node:path";

const req = createRequire(import.meta.url);
const pw = await import("playwright").catch(() => req("playwright"));
const { chromium } = pw.chromium ? pw : pw.default;
const ROOT = new URL("..", import.meta.url).pathname, PORT = 8794, lang = process.argv[2] || "en";
const OUT = join(ROOT, "store/video/shots", lang);
const TYPES = {".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".json":"application/json", ".svg":"image/svg+xml", ".png":"image/png", ".jpg":"image/jpeg", ".woff2":"font/woff2"};
const server = createServer(async (rq, res) => {
  const p = decodeURIComponent(new URL(rq.url, "http://x").pathname); const f = join(ROOT, p === "/" ? "index.html" : p);
  try{ const b = await readFile(f); res.writeHead(200, {"Content-Type":TYPES[extname(f)] || "application/octet-stream"}); res.end(b); }catch(e){ res.writeHead(404); res.end(); }
}).listen(PORT);
await mkdir(OUT, {recursive:true});
const AREA = "Les Trois Vallées";
const browser = await chromium.launch();
const ctx = await browser.newContext({viewport:{width:430, height:932}, deviceScaleFactor:2, isMobile:true, hasTouch:true, serviceWorkers:"block", locale:lang, permissions:["geolocation"], geolocation:{latitude:45.33, longitude:6.58, accuracy:8}});
await ctx.addInitScript(l => {
  localStorage.setItem("pp-onboarded", "1"); localStorage.setItem("pp-new-2", "1"); localStorage.setItem("pp-lang", l); localStorage.setItem("pp-theme", "light");
  // een voorbeelddag voor het scherm met de cijfers van je skidag
  const d = new Date(), key = "pp-day:" + d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
  localStorage.setItem(key, JSON.stringify({areaName:"Les Trois Vallées", pts:[], sum:{n:900, km:31.4, hm:6200, runs:17, vmax:71, secs:5.2 * 3600, lifts:15, jumps:3, airMax:600, from:Date.now() - 6 * 3600e3, pistes:{}}}));
}, lang);
const p = await ctx.newPage(); p.on("pageerror", e => console.log("fout in de pagina:", e.message));
await p.goto(`http://localhost:${PORT}/index.html`); await p.waitForFunction(() => typeof S !== "undefined" && S.index.length > 0);
await p.evaluate(async name => { closePicker(); const r = S.index.find(r => r[1] === name); localStorage.setItem("pp-dl-" + r[0], JSON.stringify({v:1, t:Date.now()})); await openArea(r[0]); document.documentElement.classList.add("ios"); return 0; }, AREA);
await p.waitForTimeout(12000);
const clean = () => p.evaluate(() => { document.getElementById("toast")?.classList.remove("on"); document.querySelectorAll(".ad-slot,.adsbygoogle,#adState").forEach(e => e.hidden = true); });
const shot = async name => { await clean(); await p.screenshot({path:join(OUT, name + ".png")}); console.log(name); };
const only = process.argv[3] ? process.argv[3].split(",") : null, want = n => !only || only.includes(n);

if(want("map")) await shot("map");
// Vandaag (weer, sneeuw, liften) en Ik (skidag in cijfers)
if(want("today")){ await p.evaluate(() => { setTab("today"); return 0; }); await p.waitForTimeout(2500); await shot("today"); }
if(want("me")){ await p.evaluate(() => { setTab("me"); return 0; }); await p.waitForTimeout(2500); await shot("me"); }
// Vandaag aan het eind van de dag: de liften sluiten over 25 minuten (op de klok van het skigebied; lukt niet vlak voor middernacht)
if(want("closing")){
  const ok = await p.evaluate(() => { const d = zoned(Date.now() + 25 * 60000); if(d.getDate() !== zoned().getDate()) return false;
    const keep = S.liftClose; S.liftClose = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); setTab("today"); window.__keepClose = keep; return true; });
  await p.waitForTimeout(2500);
  if(ok && await p.evaluate(() => !!document.querySelector("#today .closing-card"))) await shot("today-closing"); else console.log("closing: de waarschuwing is nu niet na te bootsen");
  await p.evaluate(() => { if(window.__keepClose) S.liftClose = window.__keepClose; return 0; });
}
await p.evaluate(() => { setTab("map"); return 0; }); await p.waitForTimeout(800);
// de groep op de kaart: nagebootste groepsleden rond het midden van het gebied
if(want("group")){
  await p.evaluate(() => { const c = map.getCenter(), now = Date.now();
    G.code = "ALPS"; G.name = "You"; G.id = "me"; G.members = new Map([["a", {id:"a", name:"Emma", lat:c.lat + .035, lon:c.lng - .05, seen:now, posTs:now}],
      ["b", {id:"b", name:"Noah", lat:c.lat - .03, lon:c.lng + .045, seen:now, posTs:now}], ["c", {id:"c", name:"Mia", lat:c.lat + .06, lon:c.lng + .03, seen:now, posTs:now}]]);
    drawMembers(); renderGroup(); return 0; });
  await p.waitForTimeout(1500); await shot("group-map");
  await p.evaluate(() => { setTab("group"); return 0; }); await p.waitForTimeout(2000); await shot("group");
  await p.evaluate(() => { setTab("map"); G.code = null; G.members = new Map(); drawMembers(); return 0; }); await p.waitForTimeout(600);
}
// dagroute op de winterkaart, en het paneel met de stappen
await p.evaluate(() => { dayRoute(); return 0; }); await p.waitForTimeout(9000);
if(want("route")) await shot("route");
if(want("steps")){ await p.click("#peek .eta").catch(() => {}); await p.waitForTimeout(1500); await shot("steps"); await p.click("#handle").catch(() => {}); await p.waitForTimeout(800); }
// 3D
if(want("3d")){ await p.evaluate(() => { document.getElementById("threeBtn").click(); return 0; }); await p.waitForTimeout(25000); await shot("3d"); }
// navigatie, met de telefoon op het begin van de route
if(want("nav")){
  const at = await p.evaluate(() => { const s = S.path[0], n = S.area.nodes[s.rev ? s.e.b : s.e.a]; return {latitude:n.lat, longitude:n.lon}; }).catch(() => null);
  if(at) await ctx.setGeolocation({...at, accuracy:6});
  await p.evaluate(() => { toggleFollow(); return 0; }); await p.waitForTimeout(30000); await shot("nav");
}
await browser.close(); server.close();
