// Controle van de weerlaag (draait zonder internet: de antwoorden van de weerdiensten zijn bewaard in tools/fixtures).
// Kijkt of het antwoord van MET Norway goed wordt omgezet, of het weerblok en Vandaag ermee tekenen zonder lege of kapotte waarden,
// en of de sneeuwhoogte alleen verschijnt als er een meting van een station is.
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";

const req = createRequire(import.meta.url);
const pw = await import("playwright").catch(() => req("playwright"));
const { chromium, devices } = pw.chromium ? pw : pw.default;
const ROOT = new URL("..", import.meta.url).pathname, PORT = 8793;
const TYPES = {".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".json":"application/json", ".svg":"image/svg+xml", ".png":"image/png", ".webmanifest":"application/manifest+json"};
const server = createServer(async (rq, res) => {
  const p = decodeURIComponent(new URL(rq.url, "http://x").pathname); const f = join(ROOT, p === "/" ? "index.html" : p);
  try{ const b = await readFile(f); res.writeHead(200, {"Content-Type":TYPES[extname(f)] || "application/octet-stream"}); res.end(b); }catch(e){ res.writeHead(404); res.end(); }
}).listen(PORT);
const met = await readFile(join(ROOT, "tools/fixtures/met-arlberg.json"), "utf8"), meta = JSON.parse(await readFile(join(ROOT, "tools/fixtures/tawes-meta.json"), "utf8"));
const problems = [];
const browser = await chromium.launch();

// withStation: is er een meting bij een station in de buurt?
for(const withStation of [true, false]){
  const tag = withStation ? "met station" : "zonder station";
  const ctx = await browser.newContext({...devices["iPhone 15"], serviceWorkers:"block"});
  let metCalls = 0;
  await ctx.route(/^https?:\/\/(?!localhost)/, r => {
    const u = r.request().url(), json = body => r.fulfill({status:200, contentType:"application/json", headers:{"access-control-allow-origin":"*"}, body:typeof body === "string" ? body : JSON.stringify(body)});
    if(u.includes("api.met.no/weatherapi/locationforecast")){ metCalls++; return json(met); }
    if(u.includes("tawes-v1-10min/metadata")) return json(withStation ? meta : {stations:[]});
    if(u.includes("tawes-v1-10min?")){ const ids = [...u.matchAll(/station_ids=(\w+)/g)].map(m => m[1]);
      return json({timestamps:["2026-11-18T20:00+00:00"], features:ids.map((id, i) => ({properties:{station:id, parameters:{SCHNEE:{unit:"cm", data:[i === 0 ? null : 37]}}}}))}); }
    return r.abort();
  });
  await ctx.addInitScript(() => { localStorage.setItem("pp-onboarded", "1"); localStorage.setItem("pp-new-2", "1"); localStorage.setItem("pp-lang", "nl"); });
  const p = await ctx.newPage(); p.on("pageerror", e => problems.push(`[${tag}] fout in de pagina: ${e.message}`));
  await p.goto(`http://localhost:${PORT}/index.html`); await p.waitForFunction(() => typeof S !== "undefined" && S.index.length > 0);
  await p.evaluate(async () => { closePicker(); const r = S.index.find(r => /Arlberg/.test(r[1])); localStorage.setItem("pp-dl-" + r[0], JSON.stringify({v:1, t:Date.now()})); await openArea(r[0]); loadWeather(); });
  await p.waitForFunction(() => S.wx && S.area.obsDone, null, {timeout:15000}).catch(() => problems.push(`[${tag}] het weer of de sneeuwmeting kwam niet binnen`));
  await p.evaluate(() => setTab("today")); await p.waitForTimeout(600);
  const r = await p.evaluate(() => { const w = S.wx, top = w.d[0], H = top.hourly, D = top.daily, bad = [];
    const same = o => new Set(Object.values(o).map(a => a.length)).size === 1;
    if(!same(H)) bad.push("uurreeksen zijn niet even lang"); if(!same(D)) bad.push("dagreeksen zijn niet even lang");
    if(D.time.length < 9) bad.push(`maar ${D.time.length} dagen`);
    if(H.time.some((t, i) => i && t <= H.time[i - 1])) bad.push("uren lopen niet op");
    if(D.weather_code.some(c => !WX[c])) bad.push("onbekende weercode");
    if([...H.temperature_2m, ...H.wind_speed_10m, ...H.snowfall, ...D.temperature_2m_max, ...D.snowfall_sum].some(v => !Number.isFinite(v))) bad.push("lege of kapotte getallen in de reeksen");
    if(H.snowfall.some((v, i) => v > 0 && H.temperature_2m[i] >= 1.5)) bad.push("sneeuw bij dooi");
    if(top.src !== "MET Norway") bad.push("bron ontbreekt");
    const txt = [document.getElementById("wxSum"), document.getElementById("wxBody"), document.getElementById("today")].map(e => e.textContent).join(" | ");
    for(const m of ["NaN", "undefined", "null", "Infinity"]) if(txt.includes(m)) bad.push(`"${m}" in beeld`);
    if(!document.getElementById("wxBody").textContent.includes("MET Norway")) bad.push("bronvermelding staat niet onder het weer");
    return {bad, depth:w.depth, obs:w.obs, fresh:w.fresh, cell:[...document.querySelectorAll("#wxBody .wx-cell")].find(c => /Sneeuw/.test(c.textContent))?.textContent || "",
      tile:[...document.querySelectorAll("#today .tile")].map(t => t.textContent).join(" | ")}; });
  r.bad.forEach(b => problems.push(`[${tag}] ${b}`));
  if(metCalls !== 2) problems.push(`[${tag}] ${metCalls} aanvragen bij MET Norway, verwacht 2 (top en dal)`);
  if(withStation){
    if(r.depth !== 37 || !r.obs?.name || !/gemeten/.test(r.cell)) problems.push(`[${tag}] de gemeten sneeuwhoogte staat er niet goed: ${JSON.stringify({depth:r.depth, obs:r.obs, cell:r.cell})}`);
  } else {
    if(r.depth != null || /\d+\s*cm/.test(r.cell)) problems.push(`[${tag}] er staat een sneeuwhoogte zonder meting: ${r.cell}`);
    if(/Sneeuw\d/.test(r.tile)) problems.push(`[${tag}] Vandaag toont een sneeuwhoogte zonder meting: ${r.tile}`);
  }
  if(r.fresh != null) problems.push(`[${tag}] verse sneeuw van de afgelopen 24 uur staat er zonder meting (${r.fresh})`);
  console.log(`${tag}: sneeuw "${r.cell.replace(/\s+/g, " ").trim()}"`);
  await ctx.close();
}
await browser.close(); server.close();
console.log(problems.length ? problems.join("\n") + `\n\n${problems.length} problemen.` : "Weerlaag in orde.");
process.exit(problems.length ? 1 : 0);
