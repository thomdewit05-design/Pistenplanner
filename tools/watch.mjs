// Controle van de koppeling met de Apple Watch, aan de webkant (de plug-in en de Watch zelf zijn nagebootst).
// - Bij het starten gaan de stappen mee met een geldige richting, en de instellingen van de trilsignalen.
// - De schakelaars en de oefenknoppen komen aan.
// - Opdrachten van de Watch (stoppen, naar het dal, opname) roepen de juiste functie aan.
// Niet getest: de trillingen zelf en de verbinding tussen een echte iPhone en een echte Watch.
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";

const req = createRequire(import.meta.url);
const pw = await import("playwright").catch(() => req("playwright"));
const { chromium, devices } = pw.chromium ? pw : pw.default;
const ROOT = new URL("..", import.meta.url).pathname, PORT = 8796;
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
  // nagebootste iPhone-plug-in: onthoudt wat de app verstuurt en geeft opdrachten van de Watch door
  Object.defineProperty(window, "PP_STORE", {get:() => "ios", set(){}});   // config.js zet hem anders op "web"
  const N = window.__nav = {calls:[], queue:[], reach:true};
  window.Capacitor = {nativePromise:(plugin, m, o) => {
    if(plugin !== "Nav") return Promise.reject(new Error("geen plug-in"));
    N.calls.push({m, o});
    if(m === "pending") return Promise.resolve({action:N.queue.shift() || null});
    if(m === "watch") return Promise.resolve({sent:N.reach});
    return Promise.resolve({});
  }};
  window.__cmd = a => { N.queue.push(a); dispatchEvent(new Event("ppaction")); };
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
const wait = ms => p.waitForTimeout(ms);
const last = m => p.evaluate(m => __nav.calls.filter(c => c.m === m).pop() || null, m);

// 1. navigatie starten: de stappen en de instellingen van de trilsignalen gaan mee
await p.evaluate(async () => { await dayRoute(); await new Promise(r => setTimeout(r, 400)); toggleFollow();
  const st = S.steps[0].line[0]; __fix(st[0], st[1]); await new Promise(r => setTimeout(r, 400)); });
const s1 = await last("start"), n1 = await p.evaluate(() => S.steps.length);
if(!s1) problems.push("bij het starten van de navigatie gaat er niets naar de plug-in");
else {
  const o = s1.o;
  if(o.steps.length !== n1) problems.push(`er gaan ${o.steps.length} stappen mee, de route heeft er ${n1}`);
  if(o.pre !== true || o.strong !== false || o.tap !== true) problems.push(`de standaardinstellingen van de trilsignalen kloppen niet: tap ${o.tap}, pre ${o.pre}, strong ${o.strong}`);
  const ok = new Set(["arrow.up", "arrow.turn.up.right", "arrow.turn.up.left", "arrow.up.right", "arrow.up.left", "cablecar", "figure.walk", "flag.checkered", "figure.skiing.downhill"]);
  const bad = o.steps.filter(s => !ok.has(s.icon) || !s.next || !s.line?.length);
  if(bad.length) problems.push(`${bad.length} stappen zonder geldige richting, tekst of lijn (de Watch kiest de trilling uit de richting)`);
  if(o.steps[o.steps.length - 1].icon !== "flag.checkered") problems.push("de laatste stap is niet 'aangekomen'");
}

// 2. een instelling wijzigen stuurt de route opnieuw, met de nieuwe waarde, en blijft bewaard
for(const [id, key] of [["watchStrong", "strong"], ["watchPre", "pre"]]){
  const before = (await last("start")).o[key];
  await p.evaluate(id => { const e = document.getElementById(id); e.checked = !e.checked; e.onchange({target:e}); }, id); await wait(150);
  const after = (await last("start")).o[key];
  if(after === before) problems.push(`de schakelaar ${id} komt niet aan op de Watch`);
}
const stored = await p.evaluate(() => localStorage.getItem("pp-watch"));
if(stored !== JSON.stringify({pre:false, strong:true})) problems.push(`de instellingen van de trilsignalen worden niet bewaard: ${stored}`);

// 3. oefenknoppen: elk signaal gaat naar de Watch, en zonder Watch staat dat er
for(const k of ["left", "right", "lift", "off"]){
  await p.evaluate(k => document.querySelector(`.watch-try [data-wt="${k}"]`).onclick(), k); await wait(80);
  const c = await last("watch"); if(c?.o.test !== k) problems.push(`de oefenknop '${k}' stuurt ${JSON.stringify(c?.o)}`);
}
await p.evaluate(() => { __nav.reach = false; return document.querySelector('.watch-try [data-wt="left"]').onclick(); }); await wait(80);
const t3 = await p.evaluate(() => document.getElementById("toast").textContent);
if(!/niet bereikbaar/.test(t3)) problems.push(`zonder Watch meldt de oefenknop: "${t3}"`);

// 4. opdrachten van de Watch
await p.evaluate(() => __cmd("stop")); await wait(400);
const c4 = await p.evaluate(() => ({follow:S.follow, stop:__nav.calls.some(c => c.m === "stop")}));
if(c4.follow || !c4.stop) problems.push(`'Stop navigatie' vanaf de Watch stopt niet: ${JSON.stringify(c4)}`);

await p.evaluate(() => __cmd("rec")); await wait(400);
if(!await p.evaluate(() => !!D.rec)) problems.push("'Start opname' vanaf de Watch start de opname niet");
await p.evaluate(() => __cmd("rec")); await wait(300);   // twee keer drukken mag niets stukmaken
if(!await p.evaluate(() => !!D.rec)) problems.push("twee keer 'Start opname' stopt de opname");
await p.evaluate(() => __cmd("recstop")); await wait(600);
if(await p.evaluate(() => !!D.rec)) problems.push("'Stop opname' vanaf de Watch stopt de opname niet");

const calls0 = await p.evaluate(() => __nav.calls.filter(c => c.m === "start").length);
await p.evaluate(() => { const st = S.steps[0].line[0]; __cmd("valley"); setTimeout(() => __fix(st[0], st[1]), 300); }); await wait(2500);
const c5 = await p.evaluate(() => ({follow:S.follow, steps:S.steps.length, starts:__nav.calls.filter(c => c.m === "start").length, toast:document.getElementById("toast").textContent}));
if(!c5.follow || !c5.steps || c5.starts <= calls0) problems.push(`'Naar het dal' vanaf de Watch start geen navigatie: ${JSON.stringify(c5)}`);

// 5. een onbekende opdracht doet niets
const errs = problems.length; await p.evaluate(() => __cmd("bestaat-niet")); await wait(300);
if(problems.length !== errs) problems.push("een onbekende opdracht geeft een fout");

await browser.close(); server.close();
console.log(problems.length ? problems.join("\n") + `\n\n${problems.length} problemen.` : "Apple Watch (webkant) in orde.");
process.exit(problems.length ? 1 : 0);
