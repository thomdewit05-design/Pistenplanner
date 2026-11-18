// Controle van wat er op de berg mis kan gaan met de locatie (draait zonder internet en zonder echte gps).
// - Even geen ontvangst (gondel, tunnel) stopt de opname en de navigatie niet.
// - Een geweigerde toestemming stopt wel, en zet het scherm terug uit de navigatie-indeling.
// - Aankomen stopt de navigatie.
// - Vlak bij een gebied dat nog niet gedownload is, opent het downloadscherm één keer en niet bij elke positie opnieuw.
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";

const req = createRequire(import.meta.url);
const pw = await import("playwright").catch(() => req("playwright"));
const { chromium, devices } = pw.chromium ? pw : pw.default;
const ROOT = new URL("..", import.meta.url).pathname, PORT = 8792;
const TYPES = {".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".json":"application/json", ".svg":"image/svg+xml", ".png":"image/png", ".webmanifest":"application/manifest+json"};
const server = createServer(async (rq, res) => {
  const p = decodeURIComponent(new URL(rq.url, "http://x").pathname); const f = join(ROOT, p === "/" ? "index.html" : p);
  try{ const b = await readFile(f); res.writeHead(200, {"Content-Type":TYPES[extname(f)] || "application/octet-stream"}); res.end(b); }catch(e){ res.writeHead(404); res.end(); }
}).listen(PORT);
const problems = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({...devices["iPhone 15"], serviceWorkers:"block"});
await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
await ctx.addInitScript(() => {
  localStorage.setItem("pp-onboarded", "1"); localStorage.setItem("pp-new-2", "1"); localStorage.setItem("pp-lang", "nl");
  // nagebootste locatiedienst: de test bepaalt zelf wanneer er een positie of een fout komt
  const G = window.__gps = {ok:null, bad:null, cleared:0};
  navigator.geolocation.watchPosition = (ok, bad) => { G.ok = ok; G.bad = bad; return 7; };
  navigator.geolocation.clearWatch = () => { G.cleared++; G.ok = G.bad = null; };
  window.__fix = (lat, lon) => G.ok?.({coords:{latitude:lat, longitude:lon, accuracy:8, altitude:1800, heading:null, speed:0}, timestamp:Date.now()});
});
const p = await ctx.newPage(); p.setDefaultTimeout(15000); p.on("pageerror", e => problems.push(`fout in de pagina: ${e.message}`));
await p.goto(`http://localhost:${PORT}/index.html`); await p.waitForFunction(() => typeof S !== "undefined" && S.index.length > 0);
await p.evaluate(async () => { closePicker(); const r = S.index.find(r => /Arlberg/.test(r[1])); localStorage.setItem("pp-dl-" + r[0], JSON.stringify({v:1, t:Date.now()})); await openArea(r[0]); });
await p.waitForTimeout(600);

// 1. navigeren, dan even geen ontvangst
const r1 = await p.evaluate(async () => { await dayRoute(); await new Promise(r => setTimeout(r, 400)); toggleFollow();
  const st = S.steps[0].line[0]; await __fix(st[0], st[1]); await new Promise(r => setTimeout(r, 300));
  __gps.bad({code:3, message:"timeout"}); await new Promise(r => setTimeout(r, 200));
  return {follow:S.follow, watch:S.watch != null, cls:document.body.classList.contains("following"), cleared:__gps.cleared}; });
if(!r1.follow || !r1.watch || !r1.cls || r1.cleared) problems.push(`een tijdelijke gps-storing stopt de navigatie: ${JSON.stringify(r1)}`);

// 2. toestemming geweigerd: alles stopt en het scherm komt terug uit de navigatie-indeling
const r2 = await p.evaluate(async () => { __gps.bad({code:1, message:"denied"}); await new Promise(r => setTimeout(r, 300));
  const tb = getComputedStyle(document.getElementById("tabbar")); return {follow:S.follow, watch:S.watch != null, cls:document.body.classList.contains("following"), tab:tb.opacity !== "0" && tb.pointerEvents !== "none"}; });
if(r2.follow || r2.watch || r2.cls || !r2.tab) problems.push(`na een geweigerde locatie blijft het scherm in de navigatie-indeling: ${JSON.stringify(r2)}`);

// 3. aankomen stopt de navigatie
const r3 = await p.evaluate(async () => { toggleFollow(); const st = S.steps[0].line[0]; await __fix(st[0], st[1]); await new Promise(r => setTimeout(r, 200));
  S.arrivedSig = null; arrived(); await new Promise(r => setTimeout(r, 1800)); return {follow:S.follow, cls:document.body.classList.contains("following")}; });
if(r3.follow || r3.cls) problems.push(`aankomen stopt de navigatie niet: ${JSON.stringify(r3)}`);

// 4. vlak bij een gebied dat niet gedownload is: het downloadscherm opent één keer
const r4 = await p.evaluate(async () => { startWatch(); const other = S.index.find(r => /SkiWelt/.test(r[1])); let made = 0;
  const obs = new MutationObserver(ms => { for(const m of ms) for(const n of m.addedNodes) if(n.classList?.contains("dl-gate")) made++; }); obs.observe(document.body, {childList:true});
  for(let i = 0; i < 4; i++){ __fix(other[5], other[4]); await new Promise(r => setTimeout(r, 600)); }   // niet wachten: het downloadscherm wacht op de gebruiker
  obs.disconnect(); return {made, gate:!!document.querySelector(".dl-gate"), toast:document.getElementById("toast").textContent}; });
if(r4.made !== 1 || !r4.gate) problems.push(`het downloadscherm opent niet precies één keer bij een onbekend gebied: ${JSON.stringify(r4)}`);
if(/Kaart geladen/.test(r4.toast)) problems.push(`de melding "Kaart geladen" verschijnt terwijl het gebied nog gedownload moet worden`);

await browser.close(); server.close();
console.log(problems.length ? problems.join("\n") + `\n\n${problems.length} problemen.` : "Locatie op de berg in orde.");
process.exit(problems.length ? 1 : 0);
