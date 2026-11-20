// Groepen: een uitnodiging vraagt eerst, het eerste bericht en het afscheid zijn versleuteld,
// en een oud plan van de groep verandert je route niet na een herstart.
//   node tools/group.mjs
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";

const req = createRequire(import.meta.url);
const pw = await import("playwright").catch(() => req("playwright"));
const { chromium, devices } = pw.chromium ? pw : pw.default;
const ROOT = new URL("..", import.meta.url).pathname, PORT = 8793;
const TYPES = {".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".json":"application/json", ".svg":"image/svg+xml", ".png":"image/png", ".woff2":"font/woff2"};
const server = createServer(async (rq, res) => {
  const p = decodeURIComponent(new URL(rq.url, "http://x").pathname); const f = join(ROOT, p === "/" ? "index.html" : p);
  try{ const b = await readFile(f); res.writeHead(200, {"Content-Type":TYPES[extname(f)] || "application/octet-stream"}); res.end(b); }catch(e){ res.writeHead(404); res.end(); }
}).listen(PORT);
const browser = await chromium.launch(), problems = [];
// alles wat naar de groepsdienst gaat wordt opgevangen: geen echt verkeer, wel zien wát er verstuurd zou zijn
const INIT = () => { localStorage.setItem("pp-onboarded", "1"); localStorage.setItem("pp-new-2", "1"); localStorage.setItem("pp-lang", "nl");
  window.__posts = []; window.__sse = [];
  const real = window.fetch; window.fetch = (u, o) => /ntfy/.test(String(u)) ? (window.__posts.push({u:String(u), body:o?.body}), Promise.resolve(new Response("{}", {status:200}))) : real(u, o);
  window.EventSource = class { constructor(u){ window.__sse.push(String(u)); this.readyState = 1; setTimeout(() => this.onopen?.(), 0); } close(){ this.readyState = 2; } }; };
const open = async (extra, hash = "") => { const ctx = await browser.newContext({...devices["iPhone 15"], serviceWorkers:"block"});
  await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort()); await ctx.addInitScript(INIT); if(extra) await ctx.addInitScript(extra);
  const p = await ctx.newPage(); p.on("pageerror", e => problems.push(`fout in de pagina: ${e.message}`));
  await p.goto(`http://localhost:${PORT}/index.html${hash}`); await p.waitForFunction(() => typeof S !== "undefined" && S.index.length > 0); return {ctx, p}; };
const wait = ms => new Promise(r => setTimeout(r, ms));

// 1. een groep beginnen: het eerste bericht is versleuteld en gaat naar hetzelfde kanaal als waarop geluisterd wordt
{ const {ctx, p} = await open();
  const r = await p.evaluate(async () => { closePicker(); document.getElementById("gName").value = "Test"; gStart("ABCD12"); await new Promise(r => setTimeout(r, 1500));
    const first = {...window.__posts[0]}, sse = window.__sse[0]; gLeave(); await new Promise(r => setTimeout(r, 800)); const bye = window.__posts[window.__posts.length - 1];
    return {n:window.__posts.length, first, sse, bye, code:G.code}; });
  const enc = b => { try{ return JSON.parse(b).e === 2; }catch(e){ return false; } }, topic = u => (/\/(skipilot-g-[0-9a-f]+|pistenplanner-[a-z0-9]+)/.exec(u) || [])[1];
  if(!r.first || !enc(r.first.body)) problems.push(`het eerste bericht is niet versleuteld: ${String(r.first?.body).slice(0, 80)}`);
  if(!/^skipilot-g-/.test(topic(r.first?.u || "") || "") || topic(r.first.u) !== topic(r.sse || "")) problems.push(`het eerste bericht en het luisteren gebruiken niet hetzelfde versleutelde kanaal: ${topic(r.first?.u || "")} en ${topic(r.sse || "")}`);
  if(r.n < 2 || !enc(r.bye.body) || topic(r.bye.u) !== topic(r.first.u)) problems.push(`het afscheid is niet versleuteld naar het kanaal van de groep gegaan: ${JSON.stringify({n:r.n, u:r.bye?.u, body:String(r.bye?.body).slice(0, 60)})}`);
  if(r.code) problems.push("na het verlaten staat de groepscode er nog");
  await ctx.close(); }

// 2. een uitnodigingslink: eerst de vraag, niets verstuurd; delen staat uit; "niet meedoen" doet niets
{ const {ctx, p} = await open(() => localStorage.setItem("pp-group", JSON.stringify({code:null, name:"Test", id:"x1", follow:true, sharePos:true})), "#/g/WXYZ99");
  await p.waitForSelector(".join-ask", {timeout:8000}).catch(() => problems.push("de vraag om mee te doen verscheen niet bij een uitnodigingslink"));
  await wait(600);
  const a = await p.evaluate(() => ({posts:window.__posts.length, sse:window.__sse.length, code:G.code, share:document.getElementById("jaShare")?.checked, title:document.querySelector(".join-ask .dl-title")?.textContent}));
  if(a.posts || a.sse || a.code) problems.push(`er is al iets verstuurd of meegedaan vóór de keuze: ${JSON.stringify(a)}`);
  if(a.share !== false) problems.push("'Mijn positie delen' staat al aan in de vraag");
  if(!/WXYZ99/.test(a.title || "")) problems.push(`de vraag noemt de groep niet: ${a.title}`);
  await p.locator("#jaNo").click().catch(() => {}); await wait(500);
  const b = await p.evaluate(() => ({posts:window.__posts.length, code:G.code}));
  if(b.posts || b.code) problems.push(`"Niet meedoen" deed toch iets: ${JSON.stringify(b)}`);
  await ctx.close(); }

// 3. dezelfde link, nu meedoen: je doet mee, je positie wordt niet gedeeld
{ const {ctx, p} = await open(() => localStorage.setItem("pp-group", JSON.stringify({code:null, name:"Test", id:"x1", follow:true, sharePos:true})), "#/g/WXYZ99");
  await p.waitForSelector(".join-ask", {timeout:8000}).catch(() => {}); await p.locator("#jaYes").click().catch(() => {}); await wait(1500);
  const c = await p.evaluate(() => ({code:G.code, share:G.sharePos, posts:window.__posts.length}));
  if(c.code !== "WXYZ99" || c.share !== false || !c.posts) problems.push(`meedoen via de link klopt niet: ${JSON.stringify(c)}`);
  await ctx.close(); }

// 4. herstart met een bestaande groep: een plan van een uur geleden verandert je route niet, een nieuw plan wel
{ const {ctx, p} = await open(() => localStorage.setItem("pp-group", JSON.stringify({code:"ABCD12", name:"Test", id:"x1", follow:true, sharePos:false})));
  const r = await p.evaluate(async () => { closePicker(); const row = S.index.find(r => /Arlberg/.test(r[1])); localStorage.setItem("pp-dl-" + row[0], JSON.stringify({v:1, t:Date.now()})); await openArea(row[0]);
    const A = S.area, ls = A.edges.filter(e => e.t === "l"), mine = {from:ls[0].a, to:ls[3].b}; S.from = mine.from; S.to = mine.to; S.wps = []; S.target = null; update();
    const plan = ts => ({v:1, id:"ander", name:"Anna", ts, t:"plan", area:A.id, from:ls[5].a, to:ls[9].b, via:null, dk:"n", de:null, closed:[]});
    gHandle(plan(Date.now() - 3600e3)); await new Promise(r => setTimeout(r, 900)); const afterOld = {to:S.to, by:S.planBy || null, shown:G.plan?.name || null};
    gHandle(plan(Date.now() + 1000)); await new Promise(r => setTimeout(r, 1200)); return {mine, afterOld, afterNew:{to:S.to, by:S.planBy || null}, want:ls[9].b, adoptAfter:!!G.adoptAfter}; });
  if(!r.adoptAfter) problems.push("na een herstart is niet vastgelegd vanaf wanneer plannen gelden");
  if(r.afterOld.to !== r.mine.to || r.afterOld.by) problems.push(`een oud plan heeft de route veranderd: ${JSON.stringify(r.afterOld)}`);
  if(r.afterOld.shown !== "Anna") problems.push("het oude plan is niet meer te zien in de groep");
  if(r.afterNew.to !== r.want || r.afterNew.by !== "Anna") problems.push(`een nieuw plan is niet overgenomen: ${JSON.stringify(r.afterNew)}`);
  await ctx.close(); }

await browser.close(); server.close();
console.log(problems.length ? problems.join("\n") + `\n\n${problems.length} problemen.` : "Groepen in orde.");
process.exit(problems.length ? 1 : 0);
