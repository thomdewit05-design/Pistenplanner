// Vangnet voor vormgeving: legt de belangrijkste schermen vast en vergelijkt ze pixel voor pixel met een eerdere vastlegging.
//   node tools/visual.mjs <map-uit> [map-vorige] [map-van-de-app]
// Zonder vorige map: alleen vastleggen. Met vorige map: per scherm het percentage dat verschilt, en voor elk gewijzigd scherm een beeld "voor | na".
// Dit is een rapport, geen controle die faalt: het laat zien wat er zichtbaar verandert, bedoeld of onbedoeld.
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile, mkdir, readdir } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

const req = createRequire(import.meta.url);
const pw = await import("playwright").catch(() => req("playwright"));
const { chromium } = pw.chromium ? pw : pw.default;
const OUT = resolve(process.argv[2] || "visual-out"), BASE = process.argv[3] ? resolve(process.argv[3]) : null;
const ROOT = process.argv[4] ? resolve(process.argv[4]) : new URL("..", import.meta.url).pathname, PORT = 8796;
const TYPES = {".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".json":"application/json", ".svg":"image/svg+xml", ".png":"image/png", ".webmanifest":"application/manifest+json", ".woff2":"font/woff2"};
const server = createServer(async (rq, res) => {
  const p = decodeURIComponent(new URL(rq.url, "http://x").pathname); const f = join(ROOT, p === "/" ? "index.html" : p);
  try{ const b = await readFile(f); res.writeHead(200, {"Content-Type":TYPES[extname(f)] || "application/octet-stream"}); res.end(b); }catch(e){ res.writeHead(404); res.end(); }
}).listen(PORT);
await mkdir(OUT, {recursive:true});

// [naam, code die het scherm klaarzet]
const SCENES = [
  ["kaart", `setTab("map")`], ["kaart-route", `setTab("map"); dayRoute()`], ["kaart-lade", `setSheet(true)`], ["lagen", `setSheet(false); document.getElementById("layersBtn").click()`],
  ["vandaag", `document.getElementById("layersBtn").click(); setTab("today")`], ["plannen", `setTab("plan")`], ["reisplanner", `openTrip()`],
  ["groep", `document.getElementById("detail").hidden = true; setTab("group")`], ["ik", `setTab("me")`], ["prestaties", `document.getElementById("meBadges")?.click()`], ["instellingen", `document.getElementById("detail").hidden = true; openMenu()`], ["sos", `closeMenu(); setTab("map"); document.getElementById("sosBtn").click()`],
  ["rondleiding", `document.getElementById("sos").hidden = true; localStorage.removeItem("pp-onboarded"); onboarding()`]];
const SETS = [["staand", {width:393, height:852}, "light"], ["staand-donker", {width:393, height:852}, "dark"], ["liggend", {width:852, height:393}, "light"], ["klein", {width:375, height:667}, "light"]];

const browser = await chromium.launch();
for(const [set, viewport, theme] of SETS){
  const ctx = await browser.newContext({viewport, deviceScaleFactor:1, isMobile:true, hasTouch:true, serviceWorkers:"block", reducedMotion:"reduce"});
  await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
  await ctx.addInitScript(t => { window.PP_STORE = "ios"; localStorage.setItem("pp-onboarded", "1"); localStorage.setItem("pp-new-2", "1"); localStorage.setItem("pp-lang", "nl"); localStorage.setItem("pp-theme", t);
    // een vaste skidag, zodat Ik en de prestaties gevuld zijn
    localStorage.setItem("pp-day:2026-01-14", JSON.stringify({areaName:"Ski Arlberg", pts:[], sum:{n:900, km:31.4, hm:6200, runs:17, vmax:71, secs:5.2 * 3600, lifts:15, jumps:3, airMax:600, from:new Date(2026, 0, 14, 8, 40).getTime(), pisteList:[{ref:"12", name:"Kapall", diff:"s"}]}}));
    const N = Date; const fixed = new N(2026, 0, 15, 10, 30).getTime(); Date.now = () => fixed; }, theme);
  const p = await ctx.newPage();
  await p.goto(`http://localhost:${PORT}/index.html`); await p.waitForFunction(() => typeof S !== "undefined" && S.index.length > 0);
  await p.evaluate(async t => { closePicker(); const r = S.index.find(r => /Arlberg/.test(r[1])); localStorage.setItem("pp-dl-" + r[0], JSON.stringify({v:1, t:Date.now()})); await openArea(r[0]);
    document.documentElement.classList.add("ios"); try{ if(typeof setTheme === "function") setTheme(t); else document.documentElement.dataset.theme = t; }catch(e){} return 0; }, theme);
  await p.waitForTimeout(1200);
  for(const [name, code] of SCENES){
    try{ await p.evaluate(c => { (0, eval)(c); return 0; }, code); }catch(e){ console.log(`[${set}] ${name}: ${e.message.split("\n")[0]}`); }
    await p.waitForTimeout(700);
    await p.evaluate(() => document.getElementById("toast")?.classList.remove("on"));
    await p.screenshot({path:join(OUT, `${set}-${name}.png`)});
  }
  await ctx.close();
}

if(BASE){
  const ctx = await browser.newContext({viewport:{width:900, height:900}}); const p = await ctx.newPage(); await p.goto(`http://localhost:${PORT}/privacy.html`).catch(() => {});
  const files = (await readdir(OUT)).filter(f => f.endsWith(".png") && !f.startsWith("voor-na-")).sort(); let changed = 0;
  for(const f of files){
    let a, b; try{ a = (await readFile(join(BASE, f))).toString("base64"); }catch(e){ console.log(`nieuw     ${f}`); continue; }
    b = (await readFile(join(OUT, f))).toString("base64");
    const r = await p.evaluate(async ([a, b]) => { const load = s => new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = "data:image/png;base64," + s; });
      const [x, y] = await Promise.all([load(a), load(b)]); const w = Math.max(x.width, y.width), h = Math.max(x.height, y.height);
      const px = i => { const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); g.drawImage(i, 0, 0); return g.getImageData(0, 0, w, h).data; };
      const A = px(x), B = px(y); let n = 0; for(let i = 0; i < A.length; i += 4) if(Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]) > 24) n++;
      const pct = 100 * n / (w * h); let url = null;
      if(pct > .05){ const c = document.createElement("canvas"); c.width = w * 2 + 12; c.height = h; const g = c.getContext("2d"); g.fillStyle = "#E0483C"; g.fillRect(0, 0, c.width, h); g.drawImage(x, 0, 0); g.drawImage(y, w + 12, 0); url = c.toDataURL("image/png").split(",")[1]; }
      return {pct, url}; }, [a, b]);
    if(r.url){ changed++; const { writeFile } = await import("node:fs/promises"); await writeFile(join(OUT, `voor-na-${f}`), Buffer.from(r.url, "base64")); }
    console.log(`${r.pct > .05 ? "gewijzigd" : "gelijk   "} ${f}  ${r.pct.toFixed(2)}%`);
  }
  console.log(`\n${changed} van ${files.length} schermen zijn zichtbaar gewijzigd. Beelden "voor | na" staan in ${OUT}.`);
  await ctx.close();
}
await browser.close(); server.close();
