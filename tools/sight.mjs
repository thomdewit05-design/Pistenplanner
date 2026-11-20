// Controle van de camera bij "Vlieg erlangs in 3D" en het terugkijken van een skidag: de piste moet te zien blijven.
// Met nagebootst terrein (vlak, helling, bergtop, kam, wand) rekenen we na dat de gekozen kijkhoek de kijklijn vrij houdt,
// en dat de camera zonder obstakel gewoon schuin blijft kijken. De 3D-kaart zelf hoeft er niet voor te laden.
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";

const req = createRequire(import.meta.url);
const pw = await import("playwright").catch(() => req("playwright"));
const { chromium, devices } = pw.chromium ? pw : pw.default;
const ROOT = new URL("..", import.meta.url).pathname, PORT = 8798;
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
await p.goto(`http://localhost:${PORT}/index.html`); await p.waitForFunction(() => typeof M3 !== "undefined" && typeof M3.sightPitch === "function");
const r = await p.evaluate(() => {
  const Lm = 2400, ms = []; for(let m = 150; m <= Lm; m += 150) ms.push(m);
  const ray = h => ms.map(m => [m, h(m)]);
  // is het punt echt te zien? de kijklijn vanaf het punt naar de camera moet overal boven de grond blijven
  const seen = (hs, pitch) => { const t = Math.tan(pitch * Math.PI / 180), D = Lm * Math.sin(pitch * Math.PI / 180); return hs.every(([m, h]) => m > D || h < m / t); };
  const cases = {
    vlak: ray(() => 0),
    dal: ray(m => -m * .2),
    helling: ray(m => m * .3),
    steil: ray(m => m * 1.2),
    top: ray(m => m === 900 ? 700 : 0),            // een smalle bergtop tussen camera en piste
    kam: ray(m => m >= 600 && m <= 1200 ? 900 : 0),
    wand: ray(m => m >= 300 ? 2500 : 0),           // niet te ontwijken zonder recht van boven te kijken
  };
  const out = {};
  for(const [k, hs] of Object.entries(cases)){ const pitch = M3.sightPitch([hs], Lm); out[k] = {pitch, seen:seen(hs, pitch)}; }
  out.vooruit = M3.sightPitch([cases.vlak, cases.vlak, cases.top], Lm);   // de top staat pas voor een punt verderop op de piste
  return out;
});
if(r.vlak.pitch !== 64 || r.dal.pitch !== 64) problems.push(`zonder obstakel hoort de camera schuin te blijven kijken (64): vlak ${r.vlak.pitch}, dal ${r.dal.pitch}`);
for(const k of ["helling", "steil", "top", "kam"]){
  if(!r[k].seen) problems.push(`'${k}': bij kijkhoek ${r[k].pitch} zit de berg nog voor de piste`);
  if(r[k].pitch >= 64 && k !== "helling") problems.push(`'${k}': de camera kantelt niet (${r[k].pitch})`);
}
if(r.helling.pitch < 56) problems.push(`een gewone helling achter de piste maakt het beeld onnodig steil (${r.helling.pitch})`);
if(r.wand.pitch !== 12) problems.push(`bij een wand hoort de camera (bijna) recht van boven te kijken: ${r.wand.pitch}`);
if(r.vooruit >= 64) problems.push(`een top die pas verderop voor de piste schuift, laat de camera niet op tijd kantelen (${r.vooruit})`);

await browser.close(); server.close();
console.log(problems.length ? problems.join("\n") + `\n\n${problems.length} problemen.` : "Zicht op de piste bij 'Vlieg erlangs' in orde.");
process.exit(problems.length ? 1 : 0);
