// Controle van de koppeling met de Apple Watch, aan de webkant (de plug-in en de Watch zelf zijn nagebootst).
// - Bij het starten gaan de stappen mee met een geldige richting, en de instellingen van de trilsignalen.
// - De schakelaars en de oefenknoppen komen aan.
// - Opdrachten van de Watch (stoppen, naar het dal, opname) roepen de juiste functie aan.
// - Weer, groep en noodgegevens gaan zonder lege waarden mee, alleen als er iets verandert; "laatste lift" trilt één keer.
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
    if(m === "watch") return Promise.resolve(o.test ? {sent:N.reach} : {paired:true});
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
  if(o.pre !== true || o.strong !== false || o.tap !== true || o.bg !== true) problems.push(`de standaardinstellingen van de trilsignalen kloppen niet: tap ${o.tap}, pre ${o.pre}, strong ${o.strong}, bg ${o.bg}`);
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
if(stored !== JSON.stringify({pre:false, strong:true, bg:true})) problems.push(`de instellingen van de trilsignalen worden niet bewaard: ${stored}`);

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

// 6. weer, groep en noodgegevens voor de Watch
const st = await p.evaluate(async () => {
  const pos = S.steps[0].line[0]; __fix(pos[0], pos[1]); await new Promise(r => setTimeout(r, 200));
  S.wx = {area:S.area.id, c:{temperature_2m:-6.6, wind_speed_10m:23.7}, cd:{temperature_2m:1.2}, next24:11.6, depth:null, txt:"Lichte sneeuw"};
  G.code = "TEST"; G.members = new Map([
    ["a", {id:"a", name:"Ver", lat:pos[0] + .02, lon:pos[1], seen:Date.now() - 60000}],
    ["b", {id:"b", name:"Dichtbij", lat:pos[0], lon:pos[1] + .002, seen:Date.now()}],
    ["c", {id:"c", name:"Zonder plek", seen:Date.now()}]]);
  S.liftClose = "16:30";
  return {st:watchState(), nowMin:areaMin()};
});
{
  const {wx, group, sos, lang} = st.st, raw = JSON.stringify(st.st);
  if(/null/.test(raw)) problems.push(`er gaat een lege waarde (null) naar de Watch; die weigert het hele bericht: ${raw.slice(0, 200)}`);
  if(lang !== "nl") problems.push(`de taal gaat niet mee naar de Watch: ${lang}`);
  if(wx.top !== -7 || wx.dal !== 1 || wx.wind !== 24 || wx.snow !== 12 || "depth" in wx || !wx.area || wx.close !== "16:30") problems.push(`het weer voor de Watch klopt niet: ${JSON.stringify(wx)}`);
  const left = Math.round((wx.closeAt - Date.now() / 1000) / 60), want = 16 * 60 + 30 - st.nowMin;
  if(Math.abs(left - want) > 1) problems.push(`de sluitingstijd voor de Watch klopt niet: nog ${left} min, verwacht ${want}`);
  const m = group.members || [];
  if(m.length !== 3 || m[0].name !== "Dichtbij" || m[2].name !== "Zonder plek") problems.push(`de groep staat niet op afstand: ${JSON.stringify(m)}`);
  else {
    if(Math.abs(m[0].brg - 90) > 5 || Math.abs(m[0].dist - 150) > 30) problems.push(`'Dichtbij' ligt 150 m naar het oosten, de Watch krijgt ${m[0].dist} m en ${m[0].brg}°`);
    if(m[1].brg % 360 !== 0 || Math.abs(m[1].dist - 2220) > 60) problems.push(`'Ver' ligt 2,2 km naar het noorden, de Watch krijgt ${m[1].dist} m en ${m[1].brg}°`);
    if("dist" in m[2] || "brg" in m[2]) problems.push("een groepslid zonder locatie krijgt toch een afstand");
  }
  if(sos.num !== "112" || typeof sos.lat !== "number" || typeof sos.lon !== "number" || !sos.place || !(sos.alt > 500)) problems.push(`de noodgegevens voor de Watch kloppen niet: ${JSON.stringify(sos)}`);
}
// versturen: alleen als er iets veranderd is; zonder groep gaat er een lege groep mee
const sent = await p.evaluate(async () => { const n = () => __nav.calls.filter(c => c.m === "watch" && c.o.state).length;
  WLINK.sig = "";   // de klok van 20 s kan deze toestand al verstuurd hebben
  const a = n(); await watchPush(); const b = n(); await watchPush(); const c = n();
  G.code = null; await watchPush(); const last = __nav.calls.filter(c => c.m === "watch" && c.o.state).pop().o;
  return {first:b - a, again:c - b, group:last.state.group, tap:last.tap || null}; });
if(sent.first !== 1 || sent.again !== 0) problems.push(`de toestand gaat niet precies één keer naar de Watch: ${JSON.stringify(sent)}`);
if(sent.group.members || sent.tap) problems.push(`zonder groep gaat er toch een groep of een trilsignaal mee: ${JSON.stringify(sent)}`);
// laatste lift: één keer een trilsignaal, een half uur voor sluiten en alleen als je bezig bent
const ll = await p.evaluate(async () => { const m = areaMin() + 20, hh = String(Math.floor(m / 60) % 24).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
  S.liftClose = hh; const taps = () => __nav.calls.filter(c => c.m === "watch" && c.o.tap === "lastlift").length;
  const a = taps(); watchTick(); await new Promise(r => setTimeout(r, 100)); const b = taps(); watchTick(); await new Promise(r => setTimeout(r, 100)); const c = taps();
  return {follow:S.follow, first:b - a, again:c - b, ok:m < 24 * 60}; });
if(ll.ok && ll.follow && (ll.first !== 1 || ll.again !== 0)) problems.push(`het signaal 'laatste lift' komt niet precies één keer: ${JSON.stringify(ll)}`);

// 7. een onbekende opdracht doet niets
const errs = problems.length; await p.evaluate(() => __cmd("bestaat-niet")); await wait(300);
if(problems.length !== errs) problems.push("een onbekende opdracht geeft een fout");

await browser.close(); server.close();
console.log(problems.length ? problems.join("\n") + `\n\n${problems.length} problemen.` : "Apple Watch (webkant) in orde.");
process.exit(problems.length ? 1 : 0);
