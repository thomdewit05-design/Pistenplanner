// Schermcontrole op echte telefoonmaten (lokaal: node tools/screens.mjs [map-voor-screenshots])
// - het lagenmenu past boven de tabbalk en elke knop erin is aan te tikken
// - na het openen van een gebied staat het hele gebied in het vrije deel van de kaart (niet onder het paneel)
// - de tabbalk staat onderaan; de zonbalk verschijnt en botst nergens mee
// (3D heeft internet nodig voor MapLibre en wordt hier niet getest)
// - liggend: kaart over het hele scherm, niets overlapt, de regel schuift uit tot een lade, Vandaag en SOS passen op één scherm
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
const innerHeightOf = phone => devices[phone].viewport.height;
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
    // lichte weergave: de energiebesparingsmodus van iOS zet hem stil aan (geen melding, schakelaar blijft uit, geen wazig glas) en weer uit
    const lite = await p.evaluate(async () => { document.getElementById("toast").classList.remove("on"); setPower(.8, true, true); await new Promise(r => setTimeout(r, 150));
      const bf = e => { const c = getComputedStyle(e); return (c.backdropFilter && c.backdropFilter !== "none") || (c.webkitBackdropFilter && c.webkitBackdropFilter !== "none"); };
      const r = {on:document.documentElement.classList.contains("lite"), saver:document.documentElement.classList.contains("saver"), toast:document.getElementById("toast").classList.contains("on"),
        sw:document.getElementById("saverToggle").checked, blur:[...document.querySelectorAll("*")].filter(bf).map(e => e.id || e.className).slice(0, 4)};
      setPower(.8, true, false); r.off = !document.documentElement.classList.contains("lite"); return r; });
    if(!lite.on || lite.saver || lite.toast || lite.sw || lite.blur.length || !lite.off) problems.push(`[${tag}] lichte weergave klopt niet: ${JSON.stringify(lite)}`);
    // SOS: de belknop is volledig zichtbaar (niet in elkaar gedrukt), ook op een klein scherm
    await p.evaluate(() => document.getElementById("sosBtn").click()); await p.waitForTimeout(600);
    const sos = await p.evaluate(() => { const c = document.getElementById("sosMain"), b = c.querySelector("b").getBoundingClientRect(), r = c.getBoundingClientRect();
      return {h:Math.round(r.height), need:c.scrollHeight, cut:b.top < r.top - 1 || b.bottom > r.bottom + 1}; });
    if(sos.cut || sos.h < sos.need - 2) problems.push(`[${tag}] SOS: "Bel 112" is afgesneden (knop ${sos.h}px, nodig ${sos.need}px)`);
    await shot("sos");
    await ctx.close();
  }
}
// ---------- liggend: kaart over het hele scherm, tabs links, kaartknoppen rechts, onderaan één regel die uitschuift tot een lade ----------
for(const phone of ["iPhone 15 landscape", "iPhone SE landscape"]){
  const tag = phone;
  const ctx = await browser.newContext({...devices[phone], serviceWorkers:"block"});
  await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
  await ctx.addInitScript(() => { localStorage.setItem("pp-onboarded", "1"); localStorage.setItem("pp-new-2", "1"); localStorage.setItem("pp-lang", "nl"); });
  const p = await ctx.newPage();
  p.on("pageerror", e => problems.push(`[${tag}] fout in de pagina: ${e.message}`));
  await p.goto(`http://localhost:${PORT}/index.html`); await p.waitForTimeout(1800);
  const shot = async n => { if(SHOTS) await p.screenshot({path:join(SHOTS, `${phone.replace(/ /g, "")}-${n}.png`)}); };
  // kiezer: de lijst met gebieden is zichtbaar
  const pk = await p.evaluate(() => { const l = document.querySelector("#picker .areas"), r = l.getBoundingClientRect(), f = l.querySelector("li")?.getBoundingClientRect(); return {h:Math.round(r.height), first:!!f && f.height > 30 && f.top < innerHeight}; });
  if(pk.h < 150 || !pk.first) problems.push(`[${tag}] kiezer: de lijst met gebieden is niet zichtbaar (${pk.h}px)`);
  await shot("kiezer");
  await p.evaluate(async () => { closePicker(); const r = S.index.find(r => /Arlberg/.test(r[1])); localStorage.setItem("pp-dl-" + r[0], JSON.stringify({v:1, t:Date.now()})); await openArea(r[0]); });
  await p.waitForTimeout(1600);
  // kaartscherm: niets overlapt, alles binnen beeld, de kaart houdt de ruimte, het gebied staat in het vrije deel
  const lay = await p.evaluate(() => {
    const els = [["tabs", document.querySelector(".tabbar")], ["regel", document.getElementById("sheet")], ...[...document.querySelectorAll(".topbar > *, .fabs > *")].map(e => [e.id || e.className, e])]
      .filter(([, e]) => e && !e.hidden && getComputedStyle(e).display !== "none" && getComputedStyle(e).visibility !== "hidden" && e.getBoundingClientRect().width > 0).map(([n, e]) => { const r = e.getBoundingClientRect(); return {n, l:r.left, t:r.top, r:r.right, b:r.bottom}; });
    const over = [], out = [];
    for(let i = 0; i < els.length; i++){ const a = els[i]; if(a.l < -1 || a.t < -1 || a.r > innerWidth + 1 || a.b > innerHeight + 1) out.push(a.n);
      for(let j = i + 1; j < els.length; j++){ const c = els[j]; if(a.l < c.r - 1 && a.r > c.l + 1 && a.t < c.b - 1 && a.b > c.t + 1) over.push(a.n + " / " + c.n); } }
    const used = els.reduce((s, e) => s + (e.r - e.l) * (e.b - e.t), 0), small = els.filter(e => e.n !== "tabs" && e.n !== "regel" && (e.r - e.l < 40 || e.b - e.t < 40)).map(e => e.n);
    const b = S.area.bounds, nw = map.latLngToContainerPoint(b.getNorthWest()), se = map.latLngToContainerPoint(b.getSouthEast());
    const tabs = els.find(e => e.n === "tabs"), strip = els.find(e => e.n === "regel");
    return {over, out, small, free:1 - used / (innerWidth * innerHeight), fit:nw.x >= tabs.r - 4 && se.x <= innerWidth - 50 && nw.y >= 0 && se.y <= strip.t + 4, stripH:Math.round(strip.b - strip.t)};
  });
  lay.over.forEach(x => problems.push(`[${tag}] kaartscherm: overlap ${x}`));
  lay.out.forEach(x => problems.push(`[${tag}] kaartscherm: ${x} valt buiten beeld`));
  lay.small.forEach(x => problems.push(`[${tag}] kaartscherm: knop ${x} is kleiner dan 40 px`));
  if(lay.free < .68) problems.push(`[${tag}] de kaart houdt maar ${Math.round(lay.free * 100)}% van het scherm vrij`);
  console.log(`${tag}: kaart vrij ${Math.round(lay.free * 100)}%, regel ${lay.stripH}px hoog`);
  if(lay.stripH > 70) problems.push(`[${tag}] de regel onderaan is ${lay.stripH}px hoog`);
  if(!lay.fit) problems.push(`[${tag}] het gebied staat niet in het vrije kaartdeel`);
  await shot("kaart");
  // de regel schuift uit tot een lade en weer terug
  await p.evaluate(() => dayRoute()); await p.waitForTimeout(1500);
  await p.click("#peek .eta"); await p.waitForTimeout(600);
  const dr = await p.evaluate(() => { const s = document.getElementById("sheet"), r = s.getBoundingClientRect(); return {open:s.classList.contains("open"), h:Math.round(r.height), w:Math.round(r.width), steps:!!document.querySelector("ol.steps li")}; });
  if(!dr.open || dr.h < innerHeightOf(phone) - 30 || !dr.steps) problems.push(`[${tag}] de lade opent niet goed (${JSON.stringify(dr)})`);
  await shot("lade");
  await p.click("#handle"); await p.waitForTimeout(500);
  if(await p.evaluate(() => document.getElementById("sheet").classList.contains("open"))) problems.push(`[${tag}] de lade sluit niet`);
  // Vandaag: het bovenste blok past zonder scrollen
  // ook als de waarschuwing "liften sluiten over … min" erbij staat (die hangt af van het tijdstip)
  // vlak voor middernacht (in het skigebied) valt "over 45 minuten" op de volgende dag: dan is de waarschuwing niet na te bootsen
  const wraps = await p.evaluate(() => zoned(Date.now() + 45 * 60000).getDate() !== zoned().getDate());
  await p.evaluate(() => { const d = zoned(Date.now() + 45 * 60000);   // de klok van het skigebied, niet die van de telefoon
    S.liftClose = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); setTab("today"); }); await p.waitForTimeout(600);
  const td = await p.evaluate(() => { const a = document.querySelector("#today .acts")?.getBoundingClientRect(); return a ? Math.round(a.bottom) : 0; });
  if(!wraps && !(await p.evaluate(() => !!document.querySelector("#today .closing-card")))) problems.push(`[${tag}] test: de waarschuwing 'liften sluiten' verscheen niet`);
  console.log(`${tag}: bovenste blok van Vandaag eindigt op ${td}px van ${innerHeightOf(phone)}px`);
  if(!td || td > innerHeightOf(phone) + 2) problems.push(`[${tag}] Vandaag: het bovenste blok past niet zonder scrollen (${td}px)`);
  await shot("vandaag");
  // de zonbalk staat niet achter de regel onderaan
  const sunOv = await p.evaluate(async () => { setTab("map"); window.isPro = () => true; S.sunOn = true; drawSun(); await new Promise(r => setTimeout(r, 400));
    const a = document.getElementById("sunBar").getBoundingClientRect(), b = document.getElementById("sheet").getBoundingClientRect();
    const hit = a.height > 0 && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top; S.sunOn = false; drawSun(); return {hit, h:Math.round(a.height)}; });
  if(sunOv.hit || !sunOv.h) problems.push(`[${tag}] de zonbalk overlapt de regel onderaan of ontbreekt (${JSON.stringify(sunOv)})`);
  // de reisplanner vanuit Plannen vult de breedte naast de tabkolom (geen smalle lade over de tab)
  const trip = await p.evaluate(async () => { setTab("plan"); await new Promise(r => setTimeout(r, 300)); openTrip(); await new Promise(r => setTimeout(r, 700));
    const d = document.getElementById("detail"), r = d.getBoundingClientRect(), f = d.querySelector(".trip-form").getBoundingClientRect(), i = document.getElementById("tpInfo").getBoundingClientRect();
    const out = {w:Math.round(r.width), need:innerWidth - 90, side:i.left >= f.right - 1, ox:getComputedStyle(d).overflowX}; d.hidden = true; return out; });
  if(trip.w < trip.need || !trip.side || trip.ox !== "hidden") problems.push(`[${tag}] reisplanner liggend klopt niet: ${JSON.stringify(trip)}`);
  // SOS: beide belknoppen en je locatie tegelijk in beeld
  await p.evaluate(() => { setTab("map"); document.getElementById("sosBtn").click(); }); await p.waitForTimeout(600);
  const so = await p.evaluate(() => [...document.querySelectorAll("#sos .call:not([hidden]), #sos .sos-loc")].map(e => e.getBoundingClientRect()).every(r => r.height > 30 && r.top >= 0 && r.bottom <= innerHeight + 1));
  if(!so) problems.push(`[${tag}] SOS: de belknoppen en de locatie staan niet tegelijk in beeld`);
  await shot("sos");
  await ctx.close();
}
// afwerking: de zichtbare gebreken uit de eindcontrole blijven weg
for(const phone of ["iPhone SE", "iPhone 15"]){
  const tag = `${phone} afwerking`;
  // "Overslaan" overlapt niets, ook niet midden in de schuifanimatie
  let ctx = await browser.newContext({...devices[phone], serviceWorkers:"block"});
  await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
  await ctx.addInitScript(() => localStorage.setItem("pp-lang", "nl"));
  let p = await ctx.newPage(); await p.goto(`http://localhost:${PORT}/index.html`); await p.waitForSelector(".onb-skip");
  for(let i = 0; i < 3; i++){ await p.waitForTimeout(250);
    const hit = await p.evaluate(() => { const s = document.querySelector(".onb-skip").getBoundingClientRect();
      return [...document.querySelectorAll(".onb-card h2,.onb-card p,.onb-card .onb-q,.onb-card .onb-art")].filter(e => { const r = e.getBoundingClientRect(); return r.width && !(r.right <= s.left || r.left >= s.right || r.bottom <= s.top || r.top >= s.bottom); }).map(e => e.textContent.trim().slice(0, 24)); });
    if(hit.length) problems.push(`[${tag}] rondleiding stap ${i + 1}: "Overslaan" staat over ${JSON.stringify(hit)}`);
    await p.locator(".onb-next").click().catch(() => {}); }
  await ctx.close();
  // met één skidag: smalle staaf, een gekleurde dag in de kalender; de vergelijking blijft binnen het scherm; de dagroute waarschuwt niet onnodig
  ctx = await browser.newContext({...devices[phone], serviceWorkers:"block"});
  await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
  await ctx.addInitScript(() => { localStorage.setItem("pp-onboarded", "1"); localStorage.setItem("pp-new-2", "1"); localStorage.setItem("pp-lang", "nl");
    const d = new Date(), k = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    localStorage.setItem("pp-day:" + k, JSON.stringify({areaName:"Ski Arlberg", pts:[], sum:{n:900, km:31.4, hm:6200, runs:17, vmax:71, secs:5.2 * 3600, lifts:15, jumps:0, airMax:0, from:d.getTime(), pistes:{}}})); });
  p = await ctx.newPage(); p.on("pageerror", e => problems.push(`[${tag}] fout in de pagina: ${e.message}`));
  await p.goto(`http://localhost:${PORT}/index.html`); await p.waitForFunction(() => typeof S !== "undefined" && S.index.length > 0);
  const r = await p.evaluate(async () => { closePicker(); const row = S.index.find(r => /Arlberg/.test(r[1])); localStorage.setItem("pp-dl-" + row[0], JSON.stringify({v:1, t:Date.now()})); await openArea(row[0]);
    const wait = ms => new Promise(r => setTimeout(r, ms));
    setTab("me"); await wait(500);
    const bar = document.querySelector(".me-season .bars i")?.getBoundingClientRect().width || 0, days = document.querySelectorAll(".cal-g i.l1,.cal-g i.l2,.cal-g i.l3,.cal-g i.l4").length;
    const cell = document.querySelector(".cal-g i.l0"), cellBg = cell ? getComputedStyle(cell).backgroundColor : "";
    openCompare(); await wait(700); const w = document.querySelector(".cmp-wrap");
    const cmp = {scroll:w.scrollWidth - w.clientWidth, right:Math.round(w.getBoundingClientRect().right - innerWidth), over:[...w.querySelectorAll("td,th")].filter(t => t.scrollWidth > t.clientWidth + 1).map(t => t.textContent.slice(0, 16))};
    document.getElementById("detail").hidden = true; setTab("map"); dayRoute(); await wait(700);
    return {bar:Math.round(bar), days, cellBg, cmp, chips:[...document.querySelectorAll("#peek .stat")].map(x => x.textContent)}; });
  if(!r.bar || r.bar > 30) problems.push(`[${tag}] seizoensgrafiek: staaf van ${r.bar}px breed bij één skidag`);
  if(r.days !== 1) problems.push(`[${tag}] seizoenskalender: ${r.days} gekleurde dagen bij één skidag`);
  if(!r.cellBg || /rgba\(0, 0, 0, 0\)|transparent/.test(r.cellBg)) problems.push(`[${tag}] seizoenskalender: lege dagen zijn onzichtbaar (${r.cellBg})`);
  if(r.cmp.scroll > 1 || r.cmp.right > 0 || r.cmp.over.length) problems.push(`[${tag}] vergelijken valt buiten beeld: ${JSON.stringify(r.cmp)}`);
  if(r.chips.some(c => /Buiten je instellingen|Boven je niveau/.test(c))) problems.push(`[${tag}] de dagroute waarschuwt: ${JSON.stringify(r.chips)}`);
  await ctx.close();
}
// iPad, staand en liggend: de kolom links (paneel en tabbalk) en de kaart ernaast; schermen binnen beeld
for(const [name, w, h] of [["iPad 11 staand", 834, 1194], ["iPad 11 liggend", 1194, 834], ["iPad 13 staand", 1032, 1376], ["iPad 13 liggend", 1376, 1032]]){
  const ctx = await browser.newContext({viewport:{width:w, height:h}, deviceScaleFactor:1, isMobile:true, hasTouch:true, serviceWorkers:"block"});
  await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
  await ctx.addInitScript(() => { localStorage.setItem("pp-onboarded", "1"); localStorage.setItem("pp-new-2", "1"); localStorage.setItem("pp-lang", "nl"); });
  const p = await ctx.newPage(); p.on("pageerror", e => problems.push(`[${name}] fout in de pagina: ${e.message}`));
  await p.goto(`http://localhost:${PORT}/index.html`); await p.waitForFunction(() => typeof S !== "undefined" && S.index.length > 0);
  const r = await p.evaluate(async () => { const wait = ms => new Promise(r => setTimeout(r, ms));
    closePicker(); const row = S.index.find(r => /Arlberg/.test(r[1])); localStorage.setItem("pp-dl-" + row[0], JSON.stringify({v:1, t:Date.now()})); await openArea(row[0]); document.documentElement.classList.add("ios");
    dayRoute(); await wait(1200);
    const box = e => e.getBoundingClientRect(), hit = (a, b) => a.width && b.width && a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
    const tab = box(document.querySelector(".tabbar")), sheet = box(document.getElementById("sheet")), fabs = [...document.querySelectorAll(".fabs .fab")].map(box), side = isSide();
    // de route ligt in het vrije deel van de kaart: rechts van de kolom (breed) of boven het paneel (staand)
    const pts = S.path.flatMap(s => s.e.pts).map(q => map.latLngToContainerPoint(q)), minX = Math.min(...pts.map(q => q.x)), maxX = Math.max(...pts.map(q => q.x)), minY = Math.min(...pts.map(q => q.y)), maxY = Math.max(...pts.map(q => q.y));
    const out = {side, tabInView:tab.left >= 0 && tab.right <= innerWidth && tab.bottom <= innerHeight, tabOverSheet:hit(tab, sheet), tabOverFab:fabs.some(f => hit(tab, f)),
      tabInCol:Math.abs(tab.left - sheet.left) < 3 && Math.abs(tab.right - sheet.right) < 3, route:{minX:Math.round(minX), maxX:Math.round(maxX), minY:Math.round(minY), maxY:Math.round(maxY)}, sheet:{right:Math.round(sheet.right), top:Math.round(sheet.top)},
      brand:getComputedStyle(document.querySelector(".brandline")).display, w:innerWidth, h:innerHeight, screens:{}};
    for(const t of ["today", "plan", "group", "me"]){ setTab(t); await wait(1100);   // wachten tot het scherm is ingeschoven
      const el = [...document.querySelectorAll(".picker:not([hidden])")].pop(); if(!el){ out.screens[t] = "geen scherm"; continue; }
      const b = box(el), kids = [...el.children].map(box).filter(k => k.width);
      out.screens[t] = {inView:b.left >= 0 && b.right <= innerWidth + 1, scrollX:el.scrollWidth - el.clientWidth, widest:Math.round(Math.max(...kids.map(k => k.width))), overTab:hit(b, box(document.querySelector(".tabbar"))) && isSide()}; }
    return out; });
  if(!r.tabInView) problems.push(`[${name}] de tabbalk valt buiten beeld`);
  if(r.tabOverFab) problems.push(`[${name}] de tabbalk ligt over een kaartknop`);
  if(r.side){
    if(!r.tabInCol || r.tabOverSheet) problems.push(`[${name}] de tabbalk staat niet netjes onder het paneel in de kolom links`);
    if(r.route.minX < r.sheet.right + 4 || r.route.maxX > r.w - 60) problems.push(`[${name}] de route ligt niet in het vrije deel van de kaart: ${JSON.stringify(r.route)} naast een kolom tot ${r.sheet.right}`);
    if(r.brand !== "none") problems.push(`[${name}] het kopje boven het paneel is nog zichtbaar in de app`);
  } else if(r.route.maxY > r.sheet.top + 4 || r.route.minX < 0 || r.route.maxX > r.w) problems.push(`[${name}] de route ligt achter het paneel of buiten beeld: ${JSON.stringify(r.route)}, paneel vanaf ${r.sheet.top}`);
  for(const [t, v] of Object.entries(r.screens)){
    if(typeof v === "string"){ problems.push(`[${name}] scherm ${t}: ${v}`); continue; }
    if(!v.inView || v.scrollX > 1) problems.push(`[${name}] scherm ${t} valt buiten beeld of schuift opzij: ${JSON.stringify(v)}`);
    if(!r.side && v.widest > 640) problems.push(`[${name}] scherm ${t} rekt uit tot ${v.widest}px breed`);
    if(v.overTab) problems.push(`[${name}] scherm ${t} ligt over de tabbalk`);
  }
  if(SHOTS) await p.screenshot({path:join(SHOTS, `${name.replace(/ /g, "-")}.png`)});
  await ctx.close();
}
await browser.close(); server.close();
console.log(problems.length ? problems.join("\n") + `\n\n${problems.length} problemen.` : "Alle schermen in orde.");
process.exit(problems.length ? 1 : 0);
