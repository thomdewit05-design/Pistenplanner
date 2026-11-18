// Snelheidsmeting (draait in GitHub bij elke pull request, ook lokaal: node tools/perf.mjs)
// Meet op een telefoonscherm met een 4x vertraagde processor hoe lang de zwaarste handelingen het scherm bezet houden.
// Komt een handeling boven zijn grens, dan faalt de controle: zo sluipt traagheid er niet ongemerkt in.
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";

const req = createRequire(import.meta.url);
const pw = await import("playwright").catch(() => req("playwright"));
const { chromium, devices } = pw.chromium ? pw : pw.default;
const ROOT = new URL("..", import.meta.url).pathname, PORT = 8794;
const TYPES = {".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".json":"application/json", ".svg":"image/svg+xml", ".png":"image/png", ".webmanifest":"application/manifest+json"};
const server = createServer(async (rq, res) => {
  const p = decodeURIComponent(new URL(rq.url, "http://x").pathname); const f = join(ROOT, p === "/" ? "index.html" : p);
  try{ const b = await readFile(f); res.writeHead(200, {"Content-Type":TYPES[extname(f)] || "application/octet-stream"}); res.end(b); }catch(e){ res.writeHead(404); res.end(); }
}).listen(PORT);

// [naam, code, grens in ms (ruim: de rekenkracht van de testmachine wisselt)]
const STEPS = [
  ["gebied openen", "openArea(S.index.find(r => /Arlberg/.test(r[1]))[0])", 900],
  ["dagroute", "dayRoute()", 600],
  ["route tonen (update)", "update()", 200],
  ["routebeschrijving openen", "setSheet(true)", 500],
  ["paneel sluiten", "setSheet(false)", 100],
  ["tab Vandaag", "setTab('today')", 300],
  ["tab Plannen", "setTab('plan')", 200],
  ["tab Groep", "setTab('group')", 200],
  ["tab Ik", "setTab('me')", 200],
  ["tab Kaart", "setTab('map')", 100],
  ["kiezer tekenen", "renderAreas()", 200],
];
const browser = await chromium.launch();
const ctx = await browser.newContext({...devices["iPhone 15"], serviceWorkers:"block"});
await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
await ctx.addInitScript(() => { localStorage.setItem("pp-onboarded", "1"); localStorage.setItem("pp-new-2", "1"); localStorage.setItem("pp-lang", "nl"); });
const p = await ctx.newPage(), cdp = await ctx.newCDPSession(p), errors = [];
p.on("pageerror", e => errors.push(e.message));
await cdp.send("Emulation.setCPUThrottlingRate", {rate:4});
const t0 = Date.now();
await p.goto(`http://localhost:${PORT}/index.html`); await p.waitForFunction(() => typeof S !== "undefined" && S.index.length > 0);
const startMs = Date.now() - t0;
await p.evaluate(() => { closePicker(); const r = S.index.find(r => /Arlberg/.test(r[1])); localStorage.setItem("pp-dl-" + r[0], JSON.stringify({v:1, t:Date.now()})); });
let fails = 0;
console.log(`${"opstarten".padEnd(28)} ${String(startMs).padStart(5)} ms`);
for(const [name, code, limit] of STEPS){
  // de tijd dat het scherm bezet is: het rekenwerk zelf plus het opnieuw opmaken van de pagina
  const ms = await p.evaluate(async code => { document.body.offsetHeight; const t = performance.now(); await (0, eval)(code); document.body.offsetHeight; return Math.round(performance.now() - t); }, code);
  await p.waitForTimeout(900);
  const bad = ms > limit; if(bad) fails++;
  console.log(`${name.padEnd(28)} ${String(ms).padStart(5)} ms  (grens ${limit})${bad ? "  TE TRAAG" : ""}`);
}
if(errors.length){ fails += errors.length; errors.forEach(e => console.log("fout in de pagina: " + e)); }
await browser.close(); server.close();
console.log(fails ? `\n${fails} handelingen te traag of met fouten.` : "\nAlle handelingen binnen de grens.");
process.exit(fails ? 1 : 0);
