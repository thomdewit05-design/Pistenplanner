// Schermcontrole op echte telefoonmaten (lokaal: node tools/screens.mjs [map-voor-screenshots])
// - het lagenmenu past boven de tabbalk en elke knop erin is aan te tikken
// - na het openen van een gebied staat het hele gebied in het vrije deel van de kaart (niet onder het paneel)
// - de tabbalk staat onderaan; de zonbalk verschijnt en botst nergens mee
// (3D heeft internet nodig voor MapLibre en wordt hier niet getest)
// - Vandaag, Plannen, Groep en Ik: de onderste inhoud komt boven de tabbalk uit, en loopt onderaan weg in een vervaging
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { extname, join } from "node:path";

const req = createRequire(import.meta.url);
const pw = await import("playwright").catch(() => req("playwright"));
const { chromium, devices } = pw.chromium ? pw : pw.default;
const ROOT = new URL("..", import.meta.url).pathname, PORT = 8796, SHOTS = process.argv[2] || "";
const TYPES = {".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".json":"application/json", ".svg":"image/svg+xml", ".png":"image/png", ".webmanifest":"application/manifest+json"};
const server = createServer(async (rq, res) => {
  const p = decodeURIComponent(new URL(rq.url, "http://x").pathname); const f = join(ROOT, p === "/" ? "index.html" : p);
  try{ const b = await readFile(f); res.writeHead(200, {"Content-Type":TYPES[extname(f)] || "application/octet-stream"}); res.end(b); }catch(e){ res.writeHead(404); res.end(); }
}).listen(PORT);
if(SHOTS) await mkdir(SHOTS, {recursive:true});

const browser = await chromium.launch();
const problems = [];
const PHONES = ["iPhone 15", "iPhone SE", "iPhone 15 Pro Max"];
for(const phone of PHONES){
  for(const scheme of ["light", "dark"]){
    const tag = `${phone} ${scheme}`;
    const ctx = await browser.newContext({...devices[phone], colorScheme:scheme, serviceWorkers:"block"});
    await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
    await ctx.addInitScript(() => { localStorage.setItem("pp-onboarded", "1"); localStorage.setItem("pp-new-2", "1"); localStorage.setItem("pp-lang", "nl"); });
    const p = await ctx.newPage();
    p.on("pageerror", e => problems.push(`[${tag}] fout in de pagina: ${e.message}`));
    await p.goto(`http://localhost:${PORT}/index.html`); await p.waitForTimeout(1800);
    const shot = async n => { if(SHOTS) await p.screenshot({path:join(SHOTS, `${phone.replace(/ /g, "")}-${scheme}-${n}.png`)}); };
    // eerste start: de gebiedenkiezer, geen downloadscherm voor een gebied dat je niet koos
    const first = await p.evaluate(() => ({picker:!document.getElementById("picker").hidden, gate:!!document.getElementById("dlGate")}));
    if(!first.picker || first.gate) problems.push(`[${tag}] eerste start: kiezer ${first.picker ? "open" : "dicht"}, downloadscherm ${first.gate ? "wel" : "niet"}`);
    await shot("eerste-start");
    await p.evaluate(async () => { closePicker(); const r = S.index.find(r => /Arlberg/.test(r[1])); localStorage.setItem("pp-dl-" + r[0], JSON.stringify({v:1, t:Date.now()})); await openArea(r[0]); });
    await p.waitForTimeout(1600);
    // het hele gebied in het vrije deel van de kaart
    const fit = await p.evaluate(() => {
      const b = S.area.bounds, sh = document.getElementById("sheet").getBoundingClientRect().top, ch = document.getElementById("layerChips");
      const top = Math.max(document.querySelector(".topbar")?.getBoundingClientRect().bottom || 0, ch && !ch.hidden ? ch.getBoundingClientRect().bottom : 0);
      const pts = [b.getNorthWest(), b.getSouthEast()].map(ll => map.latLngToContainerPoint(ll));
      return {nw:[Math.round(pts[0].x), Math.round(pts[0].y)], se:[Math.round(pts[1].x), Math.round(pts[1].y)], top:Math.round(top), sheet:Math.round(sh), w:innerWidth};
    });
    if(fit.nw[1] < fit.top - 4 || fit.se[1] > fit.sheet + 4 || fit.nw[0] < -4 || fit.se[0] > fit.w + 4)
      problems.push(`[${tag}] gebied niet helemaal in beeld: ${JSON.stringify(fit)}`);
    await shot("gebied");
    // tabbalk onderaan
    const tab = await p.evaluate(() => { const r = document.querySelector(".tabbar").getBoundingClientRect(); return {gap:Math.round(innerHeight - r.bottom), top:r.top}; });
    if(tab.gap > 16) problems.push(`[${tag}] tabbalk staat ${tab.gap}px boven de onderkant`);
    // lagenmenu
    await p.click("#layersBtn"); await p.waitForTimeout(500);
    const lm = await p.evaluate(tabTop => {
      const m = document.getElementById("layerMenu"), r = m.getBoundingClientRect(), bad = [];
      for(const el of m.querySelectorAll("button, label.switch, label.layer-card")){
        el.scrollIntoView({block:"nearest"}); const q = el.getBoundingClientRect(); if(!q.width) continue;
        const hit = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2);
        if(!hit || !m.contains(hit)) bad.push((el.textContent || el.id).trim().slice(0, 30) + " → " + (hit?.className || "niets"));
      }
      const chips = document.getElementById("layerChips"); const chipsVis = chips && chips.offsetParent !== null;
      return {bottom:r.bottom, over:r.bottom > tabTop + 1, bad, chipsVis};
    }, tab.top);
    if(lm.over) problems.push(`[${tag}] lagenmenu loopt achter de tabbalk door`);
    if(lm.chipsVis) problems.push(`[${tag}] lagenchips zichtbaar achter het lagenmenu`);
    lm.bad.forEach(b => problems.push(`[${tag}] menu-knop niet aan te tikken: ${b}`));
    await p.evaluate(() => document.getElementById("layerMenu").scrollTop = 0); await shot("lagenmenu");
    // zon aan (via de chip), zonbalk zichtbaar en vrij
    await p.evaluate(() => { document.getElementById("layerMenu").hidden = true; });
    await p.evaluate(() => { S.sunAt = 660; const c = document.getElementById("sunToggle"); c.checked = true; c.dispatchEvent(new Event("change")); });
    await p.waitForTimeout(600);
    const sun = await p.evaluate(() => {
      const b = document.getElementById("sunBar"), r = b.getBoundingClientRect(), sh = document.getElementById("sheet").getBoundingClientRect().top;
      const fab = document.querySelector(".fabs")?.getBoundingClientRect();
      return {shown:!b.hidden && r.height > 0, txt:document.getElementById("sunInfo").textContent, overSheet:r.bottom > sh + 1, overFab:fab ? (r.right > fab.left && r.bottom > fab.top && r.top < fab.bottom) : false, lines:sunLayer.getLayers().length};
    });
    if(!sun.shown) problems.push(`[${tag}] zonbalk niet zichtbaar`);
    if(sun.overSheet) problems.push(`[${tag}] zonbalk valt over het paneel`);
    if(sun.overFab) problems.push(`[${tag}] zonbalk botst met de knoppen rechts`);
    if(!sun.lines) problems.push(`[${tag}] geen zon- of schaduwlijnen getekend (${sun.txt})`);
    await shot("zon-2d");
    // tabschermen: de laatste inhoud komt boven de tabbalk uit
    for(const t of ["today", "plan", "group", "me"]){
      await p.evaluate(t => setTab(t), t); await p.waitForTimeout(500);
      const r = await p.evaluate(() => {
        const panel = [...document.querySelectorAll(".dash, .picker")].find(e => !e.hidden && e.offsetParent !== null); if(!panel) return null;
        panel.scrollTop = panel.scrollHeight; const kids = [...panel.querySelectorAll("section, .dc, button, a")].filter(e => e.offsetParent !== null);
        const last = kids.reduce((m, e) => Math.max(m, e.getBoundingClientRect().bottom), 0);
        const f = getComputedStyle(panel, "::after");
        return {last:Math.round(last), tab:Math.round(document.querySelector(".tabbar").getBoundingClientRect().top), fade:f.position === "sticky" && parseFloat(f.height) > 60};
      });
      // geen blok mag in elkaar gedrukt worden (dan valt er inhoud weg in plaats van dat het scherm scrolt)
      const sq = await p.evaluate(() => { const panel = [...document.querySelectorAll(".dash, .picker")].find(e => !e.hidden && e.offsetParent !== null); if(!panel) return [];
        return [...panel.children].filter(c => c.scrollHeight > c.clientHeight + 2 && getComputedStyle(c).overflowY !== "auto" && getComputedStyle(c).overflowY !== "scroll").map(c => `${c.className.split(" ")[0]} ${c.clientHeight}/${c.scrollHeight}`); });
      sq.forEach(x => problems.push(`[${tag}] ${t}: blok in elkaar gedrukt (${x})`));
      if(t === "me"){
        const st = await p.evaluate(() => { const b = document.getElementById("meSettings"); if(!b) return "ontbreekt"; b.scrollIntoView({block:"center"}); const q = b.getBoundingClientRect();
          const hit = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); return q.height < 40 ? `te laag (${Math.round(q.height)}px)` : hit && b.contains(hit) ? "" : "niet aan te tikken"; });
        if(st) problems.push(`[${tag}] ik: knop Instellingen ${st}`);
      }
      if(r && !r.fade) problems.push(`[${tag}] ${t}: geen vervaging onderaan, inhoud schemert achter de tabbalk door`);
      if(r && r.last > r.tab + 2) problems.push(`[${tag}] ${t}: onderste inhoud valt achter de tabbalk (${r.last} > ${r.tab})`);
      await shot("tab-" + t);
    }
    await p.evaluate(() => setTab("map")); await p.waitForTimeout(300);
    // een melding is klein en valt niet over een kop of de bovenbalk (kaart, en een scherm als Vandaag)
    for(const where of ["map", "today"]){
      await p.evaluate(w => { setTab(w); toast("Dit is een melding om de plek te testen.", 4000); }, where); await p.waitForTimeout(500);
      const tt = await p.evaluate(() => { const r = document.getElementById("toast").getBoundingClientRect();
        const heads = [...document.querySelectorAll(".topbar > *, .dash-head, .picker-head")].filter(e => e.offsetParent !== null).map(e => e.getBoundingClientRect());
        return {h:Math.round(r.height), over:heads.some(q => r.left < q.right && r.right > q.left && r.top < q.bottom && r.bottom > q.top)}; });
      if(tt.h > 90) problems.push(`[${tag}] melding (${where}) is ${tt.h}px hoog`);
      if(tt.over) problems.push(`[${tag}] melding (${where}) valt over een kop of de bovenbalk`);
    }
    await p.evaluate(() => { setTab("map"); document.getElementById("toast").classList.remove("on"); }); await p.waitForTimeout(200);
    // tekst is nergens kleiner dan 12 px (kaartlabels en de tabbalk uitgezonderd)
    for(const t of ["today", "plan", "me"]){
      await p.evaluate(t => setTab(t), t); await p.waitForTimeout(350);
      const small = await p.evaluate(() => { const out = new Set(); const panel = [...document.querySelectorAll(".dash")].find(e => !e.hidden && e.offsetParent !== null); if(!panel) return [];
        for(const el of panel.querySelectorAll("*")){ if(!el.offsetParent || el.closest("svg")) continue; const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
          if(own && parseFloat(getComputedStyle(el).fontSize) < 12) out.add(`${el.className || el.tagName} ${getComputedStyle(el).fontSize}`); }
        return [...out].slice(0, 5); });
      small.forEach(x => problems.push(`[${tag}] ${t}: tekst kleiner dan 12 px (${x})`));
    }
    await p.evaluate(() => setTab("map")); await p.waitForTimeout(300);
    // instellingen: een dichte sectie toont alleen zijn kop
    const ms = await p.evaluate(() => { openMenu(); return [...document.querySelectorAll("#menu .m-sec:not(.open):not([hidden])")].filter(s => [...s.children].some(c => c.tagName !== "H3" && c.offsetParent !== null)).map(s => s.querySelector("h3")?.textContent.trim()); });
    ms.forEach(x => problems.push(`[${tag}] instellingen: dichte sectie "${x}" toont inhoud`));
    await p.evaluate(() => closeMenu()); await p.waitForTimeout(200);
    // SOS: de belknop is volledig zichtbaar (niet in elkaar gedrukt), ook op een klein scherm
    await p.evaluate(() => document.getElementById("sosBtn").click()); await p.waitForTimeout(600);
    const sos = await p.evaluate(() => { const c = document.getElementById("sosMain"), b = c.querySelector("b").getBoundingClientRect(), r = c.getBoundingClientRect();
      return {h:Math.round(r.height), need:c.scrollHeight, cut:b.top < r.top - 1 || b.bottom > r.bottom + 1}; });
    if(sos.cut || sos.h < sos.need - 2) problems.push(`[${tag}] SOS: "Bel 112" is afgesneden (knop ${sos.h}px, nodig ${sos.need}px)`);
    await shot("sos");
    await ctx.close();
  }
}
await browser.close(); server.close();
console.log(problems.length ? problems.join("\n") + `\n\n${problems.length} problemen.` : "Alle schermen in orde.");
process.exit(problems.length ? 1 : 0);
