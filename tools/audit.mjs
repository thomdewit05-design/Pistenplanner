// Kwaliteitscontrole van de app (draait in GitHub bij elke pull request, ook lokaal: node tools/audit.mjs)
// - geen JavaScript-fouten in de pagina
// - tekst valt nergens buiten een knop of chip, in vijf talen (Duits, Frans en Russisch hebben de langste teksten)
// - iconknoppen zonder tekst hebben een aria-label (VoiceOver en TalkBack lezen dat voor)
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";

const { chromium } = await import("playwright").catch(() => createRequire(import.meta.url)("playwright"));
const ROOT = new URL("..", import.meta.url).pathname, PORT = 8799;
const TYPES = {".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".json":"application/json", ".svg":"image/svg+xml", ".png":"image/png", ".webmanifest":"application/manifest+json"};
const server = createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname); const f = join(ROOT, p === "/" ? "index.html" : p);
  try{ const b = await readFile(f); res.writeHead(200, {"Content-Type":TYPES[extname(f)] || "application/octet-stream"}); res.end(b); }catch(e){ res.writeHead(404); res.end(); }
}).listen(PORT);

const LANGS = (process.argv[2] || "nl,de,fr,ru,ja").split(",");
const browser = await chromium.launch();
const problems = [];
for(const lang of LANGS){
  const ctx = await browser.newContext({viewport:{width:375, height:812}});
  await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());   // geen internet nodig
  await ctx.addInitScript(l => { localStorage.setItem("pp-onboarded", "1"); localStorage.setItem("pp-lang", l); }, lang);
  const p = await ctx.newPage();
  p.on("pageerror", e => problems.push(`[${lang}] fout in de pagina: ${e.message}`));
  await p.goto(`http://localhost:${PORT}/index.html`); await p.waitForTimeout(2000);
  // de tabel met opgaven van gebieden: elk gebied bestaat, heeft een getal, een bron en een seizoen, en de opgave is niet lager dan de meting
  if(lang === "nl"){ const bad = await p.evaluate(() => Object.entries(OFFICIAL_KM).filter(([k, v]) => { const r = S.index.filter(r => r[0].startsWith(k));
      return r.length !== 1 || !(v[0] > 0) || !v[1] || !/^\d{4}\/\d{2}$/.test(v[2]) || v[0] < r[0][6] * .95; }).map(([k]) => k));
    bad.forEach(k => problems.push(`opgave van het gebied klopt niet voor ${k}`)); }
  // deelgebieden: elk deel en elk groot gebied bestaat, en een deel openen geeft de hele pistekaart van het grote gebied
  if(lang === "nl"){ const bad = await p.evaluate(async () => { const out = [];
      for(const [k, v] of Object.entries(PARENT_AREA)){ if(S.index.filter(r => r[0].startsWith(k)).length !== 1 || S.index.filter(r => r[0].startsWith(v)).length !== 1 || PARENT_AREA[v]) out.push(k); }
      const part = S.index.find(r => r[1] === "Courchevel"), whole = S.index.find(r => r[1] === "Les Trois Vallées");
      localStorage.setItem("pp-dl-" + whole[0], JSON.stringify({v:1, t:Date.now()})); await openArea(part[0]);
      if(S.area?.id !== whole[0] || S.area.edges.filter(e => e.t === "r").length < 600) out.push("Courchevel opent niet de hele pistekaart");
      return out; });
    bad.forEach(k => problems.push(`deelgebied klopt niet: ${k}`)); }
  await p.evaluate(async () => { const r = S.index.find(r => /Arlberg/.test(r[1])) || S.index[0]; localStorage.setItem("pp-dl-" + r[0], JSON.stringify({v:1, t:Date.now()})); await openArea(r[0]); }).catch(e => problems.push(`[${lang}] gebied openen: ${e.message}`));
  await p.waitForTimeout(2000);
  const screens = [["kaart", () => {}], ["vandaag", () => setTab("today")], ["groep", () => setTab("group")], ["ik", () => setTab("me")],
    ["menu", () => { setTab("map"); openMenu(); }], ["menu-onder", () => { const m = document.getElementById("menu"); m.scrollTop = m.scrollHeight; }],
    ["kiezen", () => { document.getElementById("menu").hidden = true; openPicker(); }], ["route", () => { closePicker(); dayRoute(); }]];
  for(const [name, fn] of screens){
    try{ await p.evaluate(fn); }catch(e){ problems.push(`[${lang}] ${name}: ${e.message}`); continue; }
    await p.waitForTimeout(800);
    const out = await p.evaluate(() => {
      const res = [], vis = e => { const r = e.getBoundingClientRect(); if(r.width < 2 || r.height < 2) return false; for(let x = e; x; x = x.parentElement) if(x.hidden) return false;
        const cs = getComputedStyle(e); return cs.visibility !== "hidden" && cs.display !== "none" && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; };
      for(const e of document.querySelectorAll("button,.btn,.chip,a.btn")){
        if(!vis(e)) continue;
        const t = (e.innerText || "").trim();
        if(!t && !e.getAttribute("aria-label") && !e.getAttribute("title") && !e.closest("[aria-hidden=true]")) res.push(`iconknop zonder label: ${e.id || e.className}`);
        if(t && e.matches(".btn,.chip") && e.scrollWidth > e.clientWidth + 2) res.push(`tekst past niet: "${t.slice(0, 40)}"`);
      }
      return res;
    });
    for(const o of out) problems.push(`[${lang}] ${name}: ${o}`);
  }
  await ctx.close();
}
await browser.close(); server.close();
const uniq = [...new Set(problems)];
if(uniq.length){ console.log(`${uniq.length} probleem/problemen:\n` + uniq.map(x => " - " + x).join("\n")); process.exit(1); }
console.log(`Alles in orde (${LANGS.join(", ")}).`);
