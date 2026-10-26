"use strict";
const $ = id => document.getElementById(id);
const COUNTRY = {AT:"Oostenrijk", CH:"Zwitserland", FR:"Frankrijk", IT:"Italië", DE:"Duitsland", SI:"Slovenië", LI:"Liechtenstein", MC:"Monaco"};
const DIFF = {g:{nl:"groen",adj:"groene",lvl:1,spd:200,pen:1,col:"#22984A"}, b:{nl:"blauw",adj:"blauwe",lvl:1,spd:283,pen:1,col:"#1E66CC"},
              r:{nl:"rood",adj:"rode",lvl:2,spd:350,pen:1.8,col:"#D22E2E"}, s:{nl:"zwart",adj:"zwarte",lvl:3,spd:317,pen:3.5,col:"#121417"},
              f:{nl:"skiroute",adj:"skiroute",lvl:4,spd:250,pen:4,col:"#E08A1E"}, u:{nl:"onbekend",adj:"ongemarkeerde",lvl:2,spd:300,pen:1.8,col:"#8C99A6"}};
const LIFT = {chair_lift:"stoeltjeslift", gondola:"gondel", cable_car:"kabelbaan", "t-bar":"sleeplift", "j-bar":"sleeplift",
              platter:"schotellift", drag_lift:"sleeplift", rope_tow:"touwlift", magic_carpet:"lopende band", mixed_lift:"combibaan",
              funicular:"kabeltrein", lift:"lift"};
const DRAG = new Set(["t-bar","j-bar","platter","drag_lift","rope_tow","magic_carpet"]);
const LIFT_WAIT = 2, WALK_SPD = 60;          // min wachten per lift, m/min lopen
const OFF_ROUTE = 120;                        // m van de route af = opnieuw plannen
const ANNOUNCE_AT = 120;                      // m voor een afslag: aankondigen

const S = {index:[], cc:"", q:"", area:null, from:null, to:null, via:null, target:null, level:2, free:false, down:true, mode:"fast",
           closed:new Set(), pick:"from", path:null, steps:[], sig:"", base:"sat", pistes:true, labels:true, nums:true, voice:true, liftOpen:"08:30", liftClose:"16:30", closeWarned:null, wps:[], draw:false,
           pos:null, watch:null, follow:false, fromMe:false, offCount:0, nearSort:false, navIdx:0, spoken:{step:-1, pre:-1}};
try{ const s = JSON.parse(localStorage.getItem("pistenplanner-app")||"null");
  if(s) Object.assign(S, {level:s.level??2, free:!!s.free, down:s.down??true, mode:s.mode||"fast", base:s.base||"sat",
                          pistes:s.pistes??true, labels:s.labels??true, nums:s.nums??true, voice:s.voice??true, liftOpen:s.liftOpen||"08:30", liftClose:s.liftClose||"16:30", last:s.last}); }catch(e){}
const save = () => { try{ localStorage.setItem("pistenplanner-app", JSON.stringify({level:S.level, free:S.free, down:S.down,
  mode:S.mode, base:S.base, pistes:S.pistes, labels:S.labels, nums:S.nums, voice:S.voice, liftOpen:S.liftOpen, liftClose:S.liftClose, last:S.area?.id})); }catch(e){} };
let tt; const toast = (m, ms=2200) => { const t=$("toast"); t.textContent=m; t.classList.add("on"); clearTimeout(tt); tt=setTimeout(()=>t.classList.remove("on"), ms); };
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const norm = s => s.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();
const meters = (a1, o1, a2, o2) => { const k = Math.cos((a1+a2)/2*Math.PI/180); return Math.hypot((o2-o1)*111320*k, (a2-a1)*110540); };
// afstand van punt p tot lijnstuk a-b (alles [lat, lon]); t = positie op het lijnstuk (0..1)
function segDist(p, a, b){
  const k = Math.cos(p[0]*Math.PI/180), ax = (a[1]-p[1])*111320*k, ay = (a[0]-p[0])*110540, bx = (b[1]-p[1])*111320*k, by = (b[0]-p[0])*110540;
  const dx = bx-ax, dy = by-ay, L2 = dx*dx+dy*dy, t = L2 ? Math.max(0, Math.min(1, -(ax*dx+ay*dy)/L2)) : 0;
  return {d:Math.hypot(ax+t*dx, ay+t*dy), t, len:Math.sqrt(L2)};
}
const bearing = (p, q) => Math.atan2((q[1]-p[1])*Math.cos(p[0]*Math.PI/180), q[0]-p[0]) * 180/Math.PI;
const I = n => `<svg class="ic"><use href="#i-${n}"/></svg>`;
const TURN_ICON = {"rechtdoor":"straight", "houd rechts aan":"sright", "ga rechtsaf":"right", "houd links aan":"sleft", "ga linksaf":"left"};
const hideSplash = () => { const sp = $("splash"); if(!sp || sp.classList.contains("out")) return; sp.classList.add("out"); setTimeout(() => sp.remove(), 600); };

// ================= kaart =================
const map = L.map("map", {zoomControl:false, preferCanvas:true, worldCopyJump:false, minZoom:6}).setView([46.4, 10.5], 7);
L.control.zoom({position:"bottomright"}).addTo(map);
map.attributionControl.setPrefix(false);
map.createPane("labels"); map.getPane("labels").style.zIndex = 350; map.getPane("labels").style.pointerEvents = "none";
const ESRI = "Satelliet © Esri, Maxar, Earthstar Geographics, GIS User Community";
const baseLayers = {
  sat: L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {maxZoom:19, maxNativeZoom:18, crossOrigin:true, attribution:ESRI}),
  topo: L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
        {maxZoom:19, maxNativeZoom:17, subdomains:"abc", crossOrigin:true, attribution:"Kaart © OpenTopoMap (CC-BY-SA), © OpenStreetMap"}),
  osm: L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        {maxZoom:19, crossOrigin:true, attribution:"© OpenStreetMap-bijdragers"})
};
const labelLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        {maxZoom:19, maxNativeZoom:18, crossOrigin:true, pane:"labels", opacity:.95});
const canvas = L.canvas({padding:.4, tolerance:6});
const svgR = L.svg({padding:.4});
const pisteLayer = L.layerGroup().addTo(map);
const routeLayer = L.layerGroup().addTo(map);
const markLayer = L.layerGroup().addTo(map);
let meMarker = null, meCircle = null;

function applyBase(){
  Object.entries(baseLayers).forEach(([k, l]) => k===S.base ? l.addTo(map) : l.remove());
  baseLayers[S.base].bringToBack();
  (S.base==="sat" && S.labels) ? labelLayer.addTo(map) : labelLayer.remove();
  S.pistes ? pisteLayer.addTo(map) : pisteLayer.remove();
  document.querySelectorAll("input[name=base]").forEach(r => r.checked = r.value===S.base);
  $("showPistes").checked = S.pistes; $("showLabels").checked = S.labels; $("showNums").checked = S.nums;
  if(typeof drawNumbers === "function") drawNumbers();
  save();
}

// ================= gebieden =================
const shards = {};
const loadShard = n => shards[n] ??= fetch(`data/s${String(n).padStart(3,"0")}.json`).then(r => { if(!r.ok) throw new Error(r.status); return r.json(); });

function renderCountries(){
  const counts = {}; S.index.forEach(r => counts[r[2]] = (counts[r[2]]||0)+1);
  const ccs = Object.keys(counts).sort((a,b)=>counts[b]-counts[a]);
  $("countries").innerHTML = [`<button type="button" class="chip" data-cc="" aria-pressed="${!S.cc}">Alle landen</button>`,
    ...ccs.map(c => `<button type="button" class="chip" data-cc="${c}" aria-pressed="${S.cc===c}">${COUNTRY[c]||c} <span class="n">${counts[c]}</span></button>`)].join("");
  $("countries").querySelectorAll("button").forEach(b => b.onclick = () => { S.cc = b.dataset.cc; renderCountries(); renderAreas(); });
}
function renderAreas(){
  const q = norm(S.q.trim());
  let rows = S.index.filter(r => (!S.cc || r[2]===S.cc) && (!q || norm(r[1]+" "+r[3]).includes(q)));
  const dist = r => S.pos ? meters(S.pos.lat, S.pos.lon, r[5], r[4]) : 0;
  rows.sort(S.nearSort && S.pos ? (a,b) => dist(a)-dist(b) : (a,b) => b[6]-a[6]);
  const shown = rows.slice(0, 80);
  $("areas").innerHTML = shown.map(r => `<li><button type="button" data-id="${r[0]}" aria-current="${S.area?.id===r[0]}">
      <span class="cc">${r[2]}</span>
      <span><span class="nm">${esc(r[1])}</span><span class="rg">${S.nearSort && S.pos ? `${(dist(r)/1000).toFixed(0)} km van je · ` : ""}${r[3] ? esc(r[3]) + " · " : ""}${r[7]} liften${r[10] ? ` · ${r[9]}–${r[10]} m` : ""}</span></span>
      <span class="km">${r[6]}<small>km piste</small></span></button></li>`).join("")
    || `<li class="empty" style="padding:16px 6px">Geen skigebied gevonden voor "${esc(S.q)}".</li>`;
  $("count").textContent = rows.length > shown.length ? `${shown.length} van ${rows.length} getoond. Typ om te zoeken.` : `${rows.length} skigebieden`;
  $("areas").querySelectorAll("button").forEach(b => b.onclick = () => { closePicker(); openArea(b.dataset.id); });
}
function openPicker(){ $("picker").hidden = false; renderAreas(); setTimeout(() => $("q").focus(), 50); }
function closePicker(){ $("picker").hidden = true; }

async function openArea(id, opts={}){
  const row = S.index.find(r => r[0]===id); if(!row) return;
  $("areaName").textContent = row[1]; $("areaStats").textContent = "Kaart laden…";
  let raw;
  try{ raw = (await loadShard(row[8]))[id]; }
  catch(e){ hideSplash(); $("areaStats").textContent = "Laden mislukt. Controleer je verbinding."; toast("Kaartdata kon niet laden."); return; }
  const nodes = raw.n.map(n => ({lat:n[1]/1e5, lon:n[0]/1e5, ele:n[2]}));
  const geo = g => { const pts = []; let lo=0, la=0; for(let i=0;i<g.length;i+=2){ lo+=g[i]; la+=g[i+1]; pts.push([la/1e5, lo/1e5]); } return pts; };
  const edges = [];
  for(const e of raw.e){
    let nm = raw.t[e[3]]||"", ref = e[4] === nm ? "" : e[4];
    if(!ref && /^\d{1,3}[a-z]?$/i.test(nm)){ ref = nm; nm = ""; }   // naam die eigenlijk een pistenummer is
    if(e[0]==="r") edges.push({t:"r", a:e[1], b:e[2], name:nm, ref, diff:e[5], len:e[6], drop:e[7], pts:geo(e[8])});
    else edges.push({t:"l", a:e[1], b:e[2], name:nm, ref, kind:e[5], len:e[6], dur:e[7], pts:geo(e[8]), down:!!e[9]});
  }
  for(const w of raw.w) edges.push({t:"w", a:w[0], b:w[1], len:w[2], pts:[[nodes[w[0]].lat,nodes[w[0]].lon],[nodes[w[1]].lat,nodes[w[1]].lon]]});
  edges.forEach((e,i) => e.i = i);
  // groepen: een hele lift of een hele piste (alle stukken met dezelfde naam, nummer en kleur) gaat samen open of dicht
  const groups = new Map();
  edges.forEach(e => {
    if(e.t==="w") return;
    const k = e.t==="l" ? (e.name || e.ref ? `l|${e.name}|${e.ref}|${e.kind}` : `e|${e.i}`) : (e.name || e.ref ? `r|${e.name}|${e.ref}|${e.diff}` : `e|${e.i}`);
    e.key = k;
    let g = groups.get(k); if(!g){ g = {key:k, t:e.t, e, edges:[], len:0, top:null}; groups.set(k, g); }
    g.edges.push(e.i); g.len += e.len;
    const hi = Math.max(nodes[e.a].ele ?? -1, nodes[e.b].ele ?? -1); if(hi > (g.top ?? -1)) g.top = hi;
  });
  const outRuns = nodes.map(() => []), inRuns = nodes.map(() => []);
  edges.forEach(e => { if(e.t==="r"){ outRuns[e.a].push(e.i); inRuns[e.b].push(e.i); } });

  const place = new Array(nodes.length).fill(null), names = new Map();
  const liftName = e => e.name || (e.ref ? `${LIFT[e.kind]||"lift"} ${e.ref}` : LIFT[e.kind]||"lift");
  const add = (n, s, p) => { if(!place[n] || p < place[n].p) place[n] = {s, p}; if(!names.has(s)) names.set(s, n); };
  edges.filter(e=>e.t==="l").forEach(e => { add(e.a, `Dalstation ${liftName(e)}`, 0); add(e.b, `Bergstation ${liftName(e)}`, 0); });
  edges.filter(e=>e.t==="r" && (e.name||e.ref)).forEach(e => { const nm = pisteLabel(e); if(!names.has(`Begin ${nm}`)) add(e.a, `Begin ${nm}`, 1); add(e.b, `Einde ${nm}`, 2); });

  // kaartuitsnede zonder losse uitschieters (een verdwaalde lift buiten het gebied)
  const q = (arr, f) => { const s = [...arr].sort((a,b) => a-b); return s[Math.min(s.length-1, Math.max(0, Math.round(f*(s.length-1))))]; };
  const lats = nodes.map(n => n.lat), lons = nodes.map(n => n.lon);
  const bounds = L.latLngBounds([q(lats,.02), q(lons,.02)], [q(lats,.98), q(lons,.98)]);
  S.area = {id, row, nodes, edges, place, names, outRuns, inRuns, bounds};
  // "Skiën: piste X" als bestemming
  const skiNames = new Map(), seen = new Set();
  edges.forEach(e => { if(e.t!=="r" || !(e.name||e.ref)) return; const k = e.name+"|"+e.ref+"|"+e.diff; if(seen.has(k)) return; seen.add(k);
    skiNames.set(`Skiën: ${pisteLabel(e)} (${DIFF[e.diff].nl})`, e.i); });
  S.area.skiNames = skiNames;
  Object.assign(S.area, {groups, groupKeys:[...groups.keys()].sort()});
  S.risk = null; S.wps = [];
  if(S.draw){ S.draw = false; document.body.classList.remove("drawing"); $("drawBtn").classList.remove("drawing"); $("drawBar").hidden = true; }
  loadStatus(); applyPendingShare();
  S.target = null; S.via = null;
  $("places").innerHTML = [...skiNames.keys(), ...names.keys()].sort((a,b)=>a.localeCompare(b,"nl")).map(s => `<option value="${esc(s)}"></option>`).join("");
  S.area.statsTxt = `${COUNTRY[row[2]]||row[2]} · ${row[6]} km piste · ${row[7]} liften`;
  $("areaStats").textContent = S.area.statsTxt;
  drawPistes(); buildNumbers();
  if(!opts.keepView) fitArea(!!$("splash") && !$("splash").classList.contains("out"));
  if(S.fromMe && S.pos) { S.from = nearestNode(S.pos.lat, S.pos.lon).n; S.to = null; S.pick = "to"; }
  else { defaultRoute(); S.pick = "from"; }
  try{ history.replaceState(null, "", "#" + id); }catch(e){}
  save(); update();
  if(!opts.keepView && S.path?.length){   // op de route inzoomen; die is interessanter dan het hele gebied
    map.fitBounds(L.latLngBounds(S.path.flatMap(s => s.e.pts)), {...sheetPad(), maxZoom:16, animate:false});
  }
  drawNumbers();
  setTimeout(hideSplash, 250);
  loadWeather();
}

// pistenummers op de kaart (alleen ingezoomd en binnen beeld, anders wordt het te druk)
let numLabels = [];
const numLayer = L.layerGroup().addTo(map);
function buildNumbers(){
  const A = S.area, best = new Map();
  for(const e of A.edges){
    if(e.t!=="r" || !e.ref || e.ref.length > 4) continue;
    const k = e.ref+"|"+e.diff, cur = best.get(k);
    if(!cur || e.len > cur.len) best.set(k, e);
  }
  numLabels = [...best.values()].map(e => ({e, at:e.pts[Math.floor(e.pts.length/2)]}));
}
function drawNumbers(){
  numLayer.clearLayers();
  if(!S.area || !S.nums || !S.pistes || map.getZoom() < 14) return;
  const b = map.getBounds().pad(.1); let n = 0;
  for(const {e, at} of numLabels){
    if(!b.contains(at) || ++n > 160) continue;
    L.marker(at, {interactive:false, keyboard:false, icon:L.divIcon({className:"", iconSize:null,
      html:`<span class="pnum ${e.diff}" style="background:${DIFF[e.diff].col}">${esc(e.ref)}</span>`})}).addTo(numLayer);
  }
}
map.on("zoomend moveend", drawNumbers);
const pisteLabel = e => e.name ? (e.ref ? `piste ${e.ref} ${e.name}` : e.name) : e.ref ? `piste ${e.ref}` : (e.diff==="f" ? "de skiroute" : `de ${DIFF[e.diff].adj} piste`);
const liftLabel = e => `de ${LIFT[e.kind]||"lift"} ${e.name || e.ref || ""}`.trim();

// een hele piste (alle stukken met dezelfde naam, nummer en kleur die op elkaar aansluiten)
function chainFrom(ei){
  const A = S.area, e0 = A.edges[ei];
  if(e0.t==="l") return {kind:"l", edges:[ei], start:e0.a, end:e0.b, e:e0, label:liftLabel(e0), len:e0.len};
  const named = !!(e0.name || e0.ref);
  const same = e => e.t==="r" && e.diff===e0.diff && e.name===e0.name && e.ref===e0.ref;
  const set = new Set([ei]); let start = e0.a, end = e0.b;
  for(;;){ const c = A.outRuns[end].filter(i => !set.has(i) && same(A.edges[i])); if(!c.length || (!named && A.outRuns[end].length > 1)) break; set.add(c[0]); end = A.edges[c[0]].b; }
  for(;;){ const c = A.inRuns[start].filter(i => !set.has(i) && same(A.edges[i])); if(!c.length || (!named && A.inRuns[start].length > 1)) break; set.add(c[0]); start = A.edges[c[0]].a; }
  const edges = [...set];
  return {kind:"r", edges, start, end, e:e0, label:pisteLabel(e0), len:edges.reduce((s,i) => s + A.edges[i].len, 0)};
}

function drawPistes(){
  pisteLayer.clearLayers();
  const A = S.area, groups = {};
  for(const e of A.edges){
    if(e.t==="w") continue;
    const k = S.closed.has(e.i) ? "closed" : e.t==="r" ? "r_"+e.diff : (DRAG.has(e.kind) ? "drag" : "lift");
    (groups[k] ||= []).push(e.pts);
  }
  const runs = Object.keys(groups).filter(k => k.startsWith("r_")).flatMap(k => groups[k]);
  const opt = (o) => ({renderer:canvas, interactive:false, lineCap:"round", lineJoin:"round", ...o});
  if(runs.length) L.polyline(runs, opt({color:"#ffffff", weight:6, opacity:.55})).addTo(pisteLayer);
  for(const k of ["r_u","r_f","r_g","r_b","r_r","r_s"]){
    if(!groups[k]) continue; const d = k.slice(2);
    L.polyline(groups[k], opt({color:DIFF[d].col, weight:d==="u"?2.5:3.2, opacity:.95, dashArray:d==="f"?"7 5":null})).addTo(pisteLayer);
  }
  const lifts = [...(groups.lift||[]), ...(groups.drag||[])];
  if(lifts.length) L.polyline(lifts, opt({color:"#ffffff", weight:4.5, opacity:.8})).addTo(pisteLayer);
  if(groups.lift) L.polyline(groups.lift, opt({color:"#14202B", weight:2})).addTo(pisteLayer);
  if(groups.drag) L.polyline(groups.drag, opt({color:"#14202B", weight:1.6, dashArray:"5 4"})).addTo(pisteLayer);
  if(groups.closed) L.polyline(groups.closed, opt({color:"#9AA7B2", weight:3, dashArray:"2 6"})).addTo(pisteLayer);
  // liften die bij deze wind mogelijk dicht zijn
  const risky = [...(S.risk?.lifts || [])].filter(i => !S.closed.has(i)).map(i => A.edges[i].pts);
  if(risky.length) L.polyline(risky, opt({color:"#E28A12", weight:3, dashArray:"8 6"})).addTo(pisteLayer);
  persistStatus();
  const st = new Set(); A.edges.forEach(e => { if(e.t==="l"){ st.add(e.a); st.add(e.b); } });
  st.forEach(n => L.circleMarker([A.nodes[n].lat, A.nodes[n].lon], {renderer:canvas, interactive:false, radius:3, color:"#fff", weight:1.5, fillColor:"#14202B", fillOpacity:1}).addTo(pisteLayer));
}
const sheetPad = () => window.innerWidth >= 900 ? {paddingTopLeft:[430, 80], paddingBottomRight:[70, 30]}
                                                 : {paddingTopLeft:[20, 80], paddingBottomRight:[70, sheetPeek() + 20]};
function fitArea(instant){ if(S.area) map.fitBounds(S.area.bounds, {...sheetPad(), maxZoom:16, animate:!instant}); }
function fitRoute(){
  if(!S.path || !S.path.length) return fitArea();
  map.fitBounds(L.latLngBounds(S.path.flatMap(s => s.e.pts)), {...sheetPad(), maxZoom:17});
}

// ================= routeplanning =================
// bias: randen die de route zeker moet nemen (de gekozen piste); die krijgen voorrang en mogen ook boven je niveau
function graph(bias){
  const A = S.area, out = A.nodes.map(() => []);
  for(const e of A.edges){
    if(S.closed.has(e.i)) continue;
    const k = bias?.has(e.i) ? .05 : 1;
    if(e.t==="r"){
      const lv = DIFF[e.diff].lvl;
      if(k===1 && (lv===4 ? !S.free : lv > S.level)) continue;
      const m = e.len / DIFF[e.diff].spd;
      out[e.a].push({to:e.b, e, rev:false, min:m, cost:k * (S.mode==="easy" ? m*DIFF[e.diff].pen : m)});
    } else if(e.t==="l"){
      const m = e.dur/60 + LIFT_WAIT;
      out[e.a].push({to:e.b, e, rev:false, min:m, cost:k*m});
      // met de lift naar beneden kan, maar skiën heeft de voorkeur
      if(e.down && S.down) out[e.b].push({to:e.a, e, rev:true, min:m, cost:m*1.5 + 10});
    } else {
      const m = e.len / WALK_SPD + .5;
      out[e.a].push({to:e.b, e, rev:false, min:m, cost:m*1.5}); out[e.b].push({to:e.a, e, rev:true, min:m, cost:m*1.5});
    }
  }
  return out;
}
function dijkstra(a, b, out = graph()){
  const n = out.length, dist = new Float64Array(n).fill(Infinity), prev = new Array(n), heap = [[0,a]]; dist[a] = 0;
  const push = it => { heap.push(it); let i = heap.length-1; while(i>0){ const p=(i-1)>>1; if(heap[p][0]<=heap[i][0]) break; [heap[p],heap[i]]=[heap[i],heap[p]]; i=p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if(heap.length){ heap[0]=last; let i=0; for(;;){ const l=2*i+1, r=l+1; let m=i; if(l<heap.length&&heap[l][0]<heap[m][0]) m=l; if(r<heap.length&&heap[r][0]<heap[m][0]) m=r; if(m===i) break; [heap[m],heap[i]]=[heap[i],heap[m]]; i=m; } } return top; };
  while(heap.length){
    const [d,u] = pop();
    if(d > dist[u]) continue;
    if(u===b) break;
    for(const s of out[u]){ const nd = d + s.cost; if(nd < dist[s.to]){ dist[s.to] = nd; prev[s.to] = {...s, from:u}; push([nd, s.to]); } }
  }
  return {dist, prev};
}
function shortest(a, b, bias){
  if(a==null || b==null) return null;
  if(a===b) return [];
  const {dist, prev} = dijkstra(a, b, graph(bias));
  if(dist[b]===Infinity) return null;
  const path = []; let v = b; while(v!==a){ const s = prev[v]; path.unshift(s); v = s.from; }
  return path;
}
// getekende route: punten (n) en hele pistes (p) achter elkaar
function wpLegs(){
  const legs = []; let cur = S.fromMe && S.pos && S.from != null ? S.from : null;
  for(const w of S.wps){
    if(w.k === "p"){
      const ch = w.ch || (w.ch = chainFrom(w.ei));
      if(cur != null && cur !== ch.start) legs.push([cur, ch.start]);
      legs.push([ch.start, ch.end, new Set(ch.edges)]); cur = ch.end;
    } else { if(cur != null && cur !== w.n) legs.push([cur, w.n]); cur = w.n; }
  }
  return legs;
}
const wpStart = w => w.k === "p" ? (w.ch || (w.ch = chainFrom(w.ei))).start : w.n;
const wpEnd = w => w.k === "p" ? (w.ch || (w.ch = chainFrom(w.ei))).end : w.n;
function computePath(){
  if(S.wps.length){
    const path = [];
    for(const [a, b, bias] of wpLegs()){ const p = shortest(a, b, bias); if(!p) return null; path.push(...p); }
    return path;
  }
  if(S.from==null) return null;
  const legs = S.target ? [[S.from, S.target.start], [S.target.start, S.target.end, new Set(S.target.edges)]]
             : S.to==null ? null
             : S.via!=null ? [[S.from, S.via], [S.via, S.to]] : [[S.from, S.to]];
  if(!legs) return null;
  const path = [];
  for(const [a, b, bias] of legs){ const p = shortest(a, b, bias); if(!p) return null; path.push(...p); }
  return path;
}
// standaard: een rondje van het dalstation naar de hoogste top en via de pistes weer terug
function defaultRoute(){
  const {nodes, edges} = S.area, out = graph(), lifts = edges.filter(e => e.t==="l");
  const bottoms = [...new Set(lifts.map(e => e.a))].sort((x,y) => (nodes[x].ele ?? 1e9) - (nodes[y].ele ?? 1e9)).slice(0, 30);
  let best = null;
  for(const a of bottoms){
    const {dist} = dijkstra(a, null, out); let c = 0; for(const d of dist) if(d < Infinity) c++;
    if(!best || c > best.c) best = {a, c, dist};
  }
  S.target = null; S.via = null; S.wps = [];
  if(!best){ S.from = S.to = null; return; }
  S.from = best.a;
  // hoogste bergstation vanwaar je weer terug kunt naar het begin
  const tops = [...new Set(lifts.map(e => e.b))].filter(n => best.dist[n] < Infinity && n !== best.a)
    .sort((x, y) => (nodes[y].ele ?? -1) - (nodes[x].ele ?? -1));
  if(!tops.length){ S.to = null; return; }
  // terug zonder met de lift naar beneden te gaan, zodat het rondje echt over pistes gaat
  const down = S.down; S.down = false; const skiOnly = graph(); S.down = down;
  for(const top of tops.slice(0, 25)){
    if(dijkstra(top, best.a, skiOnly).dist[best.a] < Infinity){ S.via = top; S.to = best.a; return; }
  }
  // lukt geen rondje: dan via een top zo ver mogelijk naar beneden skiën
  let pick = null;
  for(const top of tops.slice(0, 8)){
    const {dist} = dijkstra(top, null, skiOnly);
    let low = null; dist.forEach((d, n) => { if(d < Infinity && n !== top && (low==null || (nodes[n].ele ?? 1e9) < (nodes[low].ele ?? 1e9))) low = n; });
    if(low==null) continue;
    const drop = (nodes[top].ele ?? 0) - (nodes[low].ele ?? 0);
    if(!pick || drop > pick.drop) pick = {top, low, drop};
  }
  if(pick && pick.drop > 100){ S.via = pick.top; S.to = pick.low; }
  else S.to = tops[0];
}
function nearestNode(lat, lon){
  let n = -1, d = Infinity;
  S.area.nodes.forEach((p, i) => { const x = meters(lat, lon, p.lat, p.lon); if(x < d){ d = x; n = i; } });
  return {n, d};
}

// ================= routebeschrijving =================
const fmt = m => { m = Math.max(1, Math.round(m)); return m >= 60 ? `${Math.floor(m/60)}u ${String(m%60).padStart(2,"0")}` : `${m} min`; };
const km = m => m >= 1000 ? (m/1000).toFixed(1).replace(".",",")+" km" : Math.round(m/10)*10+" m";
const nodeLabel = n => S.area.place[n]?.s || `kruising op ${S.area.nodes[n].ele ?? "?"} m`;
const lc = s => s.charAt(0).toLowerCase() + s.slice(1);
const uc = s => s.charAt(0).toUpperCase() + s.slice(1);

// richting aan het eind van de ene stap t.o.v. het begin van de volgende
function turnBetween(a, b){
  const back = (line, m) => { let acc = 0; for(let i = line.length-1; i > 0; i--){ acc += meters(...line[i], ...line[i-1]); if(acc >= m) return line[i-1]; } return line[0]; };
  const fwd = (line, m) => { let acc = 0; for(let i = 0; i < line.length-1; i++){ acc += meters(...line[i], ...line[i+1]); if(acc >= m) return line[i+1]; } return line[line.length-1]; };
  const end = a.line[a.line.length-1], start = b.line[0];
  let x = bearing(start, fwd(b.line, 35)) - bearing(back(a.line, 35), end);
  x = ((x + 540) % 360) - 180;
  if(Math.abs(x) < 25) return "rechtdoor";
  const side = x > 0 ? "rechts" : "links";
  return Math.abs(x) < 75 ? `houd ${side} aan` : `ga ${side}af`;
}
function buildSteps(path){
  const out = [];
  for(const s of path){
    const e = s.e, last = out[out.length-1];
    const same = last && last.t===e.t && (e.t==="w" || (e.t==="r" && last.e.name===e.name && last.e.ref===e.ref && last.e.diff===e.diff));
    const pts = s.rev ? [...e.pts].reverse() : e.pts;
    if(same){ last.items.push(s); last.min += s.min; last.len += e.len; last.end = s.to; last.line.push(...pts.slice(1)); }
    else out.push({t:e.t, e, items:[s], min:s.min, len:e.len, start:s.from, end:s.to, rev:s.rev, line:[...pts]});
  }
  out.forEach((st, i) => {
    const e = st.e, prev = out[i-1];
    if(st.t==="l"){
      st.cls = "lift"; st.node = `<span class="node">${I("lift")}</span>`; st.icon = "lift";
      st.title = `${st.rev ? "Ga met" : "Neem"} ${liftLabel(e)}${st.rev ? " naar beneden" : ""}`;
      const ele = S.area.nodes[st.end].ele;
      st.sub = `${uc(LIFT[e.kind]||"lift")} · ${km(e.len)} · ${st.rev ? "naar het dalstation" : "naar het bergstation"}${ele!=null ? ` op ${ele} m` : ""}`;
      st.say = `stap in bij ${liftLabel(e)}`;
    } else if(st.t==="r"){
      st.cls = "run"; st.color = DIFF[e.diff].col;
      st.node = `<span class="node${e.diff==="s" ? " dark" : ""}">${esc(e.ref) || I("ski")}</span>`;
      st.turn = prev && prev.t!=="l" ? turnBetween(prev, st) : null;
      st.icon = st.turn ? TURN_ICON[st.turn] : "straight";
      const what = pisteLabel(e);
      st.title = st.turn && st.turn !== "rechtdoor" ? `${uc(st.turn)} naar ${what}` : `Volg ${what}`;
      const drop = st.items.reduce((s, x) => s + Math.max(0, x.e.drop||0), 0);
      st.sub = `${uc(DIFF[e.diff].nl)} · ${km(st.len)}${drop > 20 ? ` · ${Math.round(drop)} hm` : ""} · tot ${lc(nodeLabel(st.end))}`;
      st.say = st.turn ? `${st.turn} naar ${what}` : `volg ${what}`;
    } else {
      st.cls = "walk"; st.node = `<span class="node">${I("walk")}</span>`; st.icon = "walk";
      st.title = `Loop of skate ${km(st.len)}`;
      st.sub = `Naar ${lc(nodeLabel(st.end))}`;
      st.say = `loop of skate ${km(st.len).replace("km","kilometer").replace(" m"," meter")}`;
    }
  });
  return out;
}

function update(){
  document.querySelectorAll("#level button").forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.v===S.level)));
  document.querySelectorAll("#mode button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v===S.mode)));
  $("free").checked = S.free; $("down").checked = S.down; $("voice").checked = S.voice;
  $("fromMe").classList.toggle("on", S.fromMe);
  $("pickHint").innerHTML = `Tik op een <strong>piste</strong> om hem te skiën, of op een punt om ${S.pick==="from" ? "het <strong>vertrekpunt (A)</strong>" : "de <strong>bestemming (B)</strong>"} te kiezen.`;
  save();
  const A = S.area; if(!A) return;
  if(S.wps.length){
    S.target = null; S.via = null;
    if(!(S.fromMe && S.pos)) S.from = wpStart(S.wps[0]);
    S.to = wpEnd(S.wps[S.wps.length-1]);
  } else if(S.target) S.to = S.target.end;
  if(document.activeElement !== $("from")) $("from").value = S.from!=null ? (S.fromMe ? "Mijn locatie (" + lc(nodeLabel(S.from)) + ")" : nodeLabel(S.from)) : "";
  if(document.activeElement !== $("to")) $("to").value = S.wps.length ? `Getekende route · ${S.wps.length} ${S.wps.length===1 ? "punt" : "punten"}` : S.target ? `Skiën: ${S.target.label}`
    : S.to!=null && S.to===S.from && S.via!=null ? "Terug naar het vertrekpunt" : S.to!=null ? nodeLabel(S.to) : "";
  renderExtra();

  const path = computePath();
  S.path = path; S.steps = path ? buildSteps(path) : [];
  const sig = (path||[]).map(s => s.e.i).join(",");
  if(sig !== S.sig){ S.sig = sig; S.navIdx = 0; S.spoken = {step:-1, pre:-1}; }
  routeLayer.clearLayers(); markLayer.clearLayers();
  if(path && path.length){
    const lines = path.map(s => s.e.pts);
    L.polyline(lines, {renderer:svgR, interactive:false, color:"#0F1B2A", weight:13, opacity:.45, lineCap:"round", lineJoin:"round"}).addTo(routeLayer);
    L.polyline(lines, {renderer:svgR, interactive:false, color:"#FFC400", weight:8, opacity:1, lineCap:"round", lineJoin:"round"}).addTo(routeLayer);
    L.polyline(lines, {renderer:svgR, interactive:false, color:"#0F1B2A", weight:2.5, dashArray:"1 9", lineCap:"round", className:"route-core"}).addTo(routeLayer);
    if(S.target) L.polyline(S.target.edges.map(i => A.edges[i].pts), {renderer:svgR, interactive:false, color:"#ffffff", weight:3, opacity:.95, dashArray:"10 8"}).addTo(routeLayer);
  }
  S.wps.forEach((w, i) => {
    const n = wpStart(w), p = A.nodes[n];
    L.marker([p.lat, p.lon], {icon:L.divIcon({className:"", html:`<div class="wpn${w.k==="p" ? " p" : ""}${i===0 ? " first" : ""}">${i+1}</div>`, iconSize:[26,26], iconAnchor:[13,13]}),
      keyboard:false, interactive:false, zIndexOffset:600 + i}).addTo(markLayer);
  });
  const pins = S.wps.length ? [[S.wps.length > 1 ? S.to : null, "b", I("flag")]]
    : [[S.from,"a","<span></span>"],[S.via,"v",I("loop")],[S.target ? S.target.start : null,"v",I("ski")],[S.to,"b",I("flag")]];
  for(const [n, cls, html] of pins){
    if(n==null || (cls==="a" && S.fromMe && S.pos) || (cls==="b" && S.to===S.from && S.via!=null)) continue;
    const p = A.nodes[n], sz = cls==="v" ? 26 : 30;
    L.marker([p.lat, p.lon], {icon:L.divIcon({className:"", html:`<div class="pin ${cls}">${html}</div>`, iconSize:[sz,sz], iconAnchor:[sz/2, sz*1.2]}),
      keyboard:false, interactive:false, zIndexOffset:cls==="v" ? 0 : 500}).addTo(markLayer);
  }
  renderResult();
  renderClosed();
  updateNav();
  if(S.draw) renderDrawBar();
  if($("myRoutes").open) renderRoutes();
}
function renderExtra(){
  const x = $("extra"), parts = [];
  if(S.target) parts.push(`<button type="button" class="chip route" data-k="target" title="Weghalen">${I("ski")}Skiën: ${esc(S.target.label)} · ${km(S.target.len)}<span class="x">${I("close")}</span></button>`);
  if(S.via!=null && !S.target) parts.push(`<button type="button" class="chip route" data-k="via" title="Weghalen">${I("loop")}${S.to===S.from ? "Rondje via" : "Via"} ${esc(lc(nodeLabel(S.via)))}<span class="x">${I("close")}</span></button>`);
  if(S.wps.length) parts.push(`<button type="button" class="chip route" data-k="wps" title="Getekende route wissen">${I("pencil")}Getekende route · ${S.wps.length} ${S.wps.length===1 ? "punt" : "punten"}<span class="x">${I("close")}</span></button>`);
  if(S.planBy) parts.unshift(`<button type="button" class="chip route group-chip" data-k="planby" title="Niet meer tonen">${I("group")}Route van ${esc(S.planBy)}<span class="x">${I("close")}</span></button>`);
  x.innerHTML = parts.join(""); x.hidden = !parts.length;
  x.querySelectorAll("button").forEach(b => b.onclick = () => {
    if(b.dataset.k==="wps"){ S.wps = []; S.to = null; if(S.draw) renderDrawBar(); }
    else if(b.dataset.k==="planby"){ S.planBy = null; } else if(b.dataset.k==="target"){ S.target = null; } else { if(S.to===S.from) S.to = S.via; S.via = null; }
    update();
  });
}

function renderResult(){
  const res = $("result"), peek = $("peek");
  if(S.from==null || S.to==null){ res.innerHTML = `<p class="empty">Kies een vertrekpunt en een bestemming, of tik op een piste.</p>`; peek.innerHTML = ""; return setPeek(); }
  if(S.wps.length && S.path && !S.path.length){ res.innerHTML = `<p class="empty">Tik het volgende punt aan om de route verder te tekenen.</p>`; peek.innerHTML = ""; return setPeek(); }
  if(S.from===S.to && S.via==null && !S.target && !S.wps.length){ res.innerHTML = `<p class="empty">Je bent al op je bestemming. Kies een andere bestemming.</p>`; peek.innerHTML = ""; return setPeek(); }
  if(!S.path){
    const tips = [];
    if(S.level < 3) tips.push("kies een hoger niveau");
    if(!S.free) tips.push("neem skiroutes mee");
    if(S.closed.size) tips.push("open een gesloten piste");
    const who = S.planBy ? `De route van ${esc(S.planBy)} is met jouw instellingen niet te halen. ` : "";
    res.innerHTML = `<p class="empty"><strong>Geen route gevonden.</strong> ${who}${tips.length ? "Probeer: " + tips.join(", ") + ". " : ""}Sommige delen van een skigebied zijn alleen met de skibus bereikbaar; die staan niet in de kaart.</p>`;
    peek.innerHTML = S.planBy ? `<p class="empty"><strong>Je kunt de route van ${esc(S.planBy)} niet volgen</strong> met jouw niveau of instellingen. Kies een hoger niveau, of vraag om een makkelijkere bestemming.</p>`
                              : `<p class="empty"><strong>Geen route gevonden</strong> met deze instellingen.</p>`; return setPeek();
  }
  const path = S.path, steps = S.steps;
  const tot = path.reduce((s,x)=>s+x.min,0), pisteM = path.filter(s=>s.e.t==="r").reduce((s,x)=>s+x.e.len,0);
  const down = path.filter(s=>s.e.t==="r").reduce((s,x)=>s+Math.max(0,x.e.drop||0),0);
  const nP = steps.filter(s=>s.t==="r").length, nL = steps.filter(s=>s.t==="l").length;
  const tm = routeTiming(), arrive = hhmm(tm.end);
  peek.innerHTML = `<div class="eta"><b>${fmt(tot)}</b><span>${(pisteM/1000).toFixed(1).replace(".",",")} km piste · klaar om ${arrive}</span></div>
    <div class="stats"><span class="stat">${I("ski")}${nP} pistes</span><span class="stat">${I("lift")}${nL} liften</span><span class="stat">${Math.round(down).toLocaleString("nl-NL")} hm dalen</span></div>
    <div class="cta">${S.follow ? `<button type="button" class="btn stop" id="goBtn">${I("stop")}Navigatie stoppen</button>`
                               : `<button type="button" class="btn primary" id="goBtn">${I("play")}Start navigatie</button>`}
      <button type="button" class="btn ghost" id="valleyBtn" title="Snelste weg naar het dal">${I("down")}Naar het dal</button>${G.code ? `<button type="button" class="btn ghost" id="gSendBtn" title="Stuur deze route naar je groep" aria-label="Stuur deze route naar je groep">${I("send")}</button>` : ""}</div>`;
  $("goBtn").onclick = toggleFollow;
  $("valleyBtn").onclick = toValley;
  $("gSendBtn")?.addEventListener("click", sendPlan);
  let warn = S.target && S.target.kind==="r" && (DIFF[S.target.e.diff].lvl > S.level || (DIFF[S.target.e.diff].lvl===4 && !S.free))
    ? `<p class="notice bad">${I("warn")}<span><strong>Let op:</strong> ${esc(S.target.label)} is ${DIFF[S.target.e.diff].nl}, moeilijker dan je ingestelde niveau.</span></p>` : "";
  // liftsluiting
  if(tm.late.length){
    const s = steps[tm.late[0]];
    warn += `<div class="notice bad">${I("clock")}<span><strong>Je haalt ${esc(liftLabel(s.e))} niet meer.</strong> Je bent er om ${hhmm(s.eta)}, de laatste lift gaat om ${S.liftClose}. Kies een kortere route of ga <button type="button" class="linkbtn" id="valley2">naar het dal</button>.</span></div>`;
  } else if(tm.lastLift != null && tm.close - tm.lastLift < 30){
    warn += `<p class="notice info">${I("clock")}<span>Krap: je neemt de laatste lift om ${hhmm(tm.lastLift)}. De liften sluiten om ${S.liftClose}.</span></p>`;
  }
  const riskyLifts = steps.filter(s => s.t==="l" && S.risk?.lifts.has(s.e.i)).length;
  if(riskyLifts) warn += `<p class="notice info">${I("wind")}<span>${riskyLifts === 1 ? "Eén lift" : riskyLifts + " liften"} op je route ${riskyLifts === 1 ? "is" : "zijn"} bij deze wind mogelijk dicht (${S.risk.reason}). Controleer de <button type="button" class="linkbtn" id="openStatus2" style="color:var(--accent)">liftstatus</button>.</span></p>`;
  if(tm.planned) warn += `<p class="notice info">${I("clock")}<span>De liften zijn nu dicht. Tijden zijn gerekend vanaf de opening om ${S.liftOpen}.</span></p>`;
  const lastWp = S.wps[S.wps.length-1];
  const endLabel = lastWp ? (lastWp.k === "p" ? `Einde ${lastWp.ch.label}` : nodeLabel(S.to)) : S.target ? `Einde ${S.target.label}` : S.to===S.from && S.via!=null ? "Terug bij je vertrekpunt" : nodeLabel(S.to);
  res.innerHTML = warn + `<div class="route-head"><p class="label">Routebeschrijving</p><span>${steps.length} stappen</span></div><ol class="steps">`
    + steps.map((s, i) => `<li data-i="${i}" class="${s.cls}" style="${s.color ? `--c:${s.color}` : ""}">${s.node}
      <div class="st-body"><div class="st-title">${s.t==="r" && s.turn && s.turn!=="rechtdoor" ? I(s.icon) : ""}<span>${esc(s.title)}</span></div><div class="st-sub">${esc(s.sub)}</div>${s.late ? `<span class="late-tag">${I("clock")}Om ${hhmm(s.eta)}, na sluitingstijd</span>` : ""}${s.t==="l" && S.risk?.lifts.has(s.e.i) ? `<span class="risk-chip">${I("wind")}Mogelijk dicht door wind</span>` : ""}</div>
      <div class="st-right"><span class="st-time">${fmt(s.min)}</span>${s.t!=="w" ? `<button type="button" class="close-btn" data-i="${i}" title="Afsluiten en omrijden" aria-label="${s.t==="l" ? "Lift" : "Piste"} afsluiten">${I("ban")}</button>` : ""}</div></li>`).join("")
    + `<li class="end"><span class="node">${I("flag")}</span><div class="st-body"><div class="st-title"><span>${esc(endLabel)}</span></div><div class="st-sub">Aankomst rond ${arrive}</div></div><span></span></li></ol>`;
  $("valley2")?.addEventListener("click", toValley);
  $("openStatus2")?.addEventListener("click", openStatus);
  res.querySelectorAll("li[data-i]").forEach(li => li.onclick = ev => {
    if(ev.target.closest(".close-btn")) return;
    const s = steps[+li.dataset.i]; map.fitBounds(L.latLngBounds(s.line), {...sheetPad(), maxZoom:17});
    if(window.innerWidth < 900) setSheet(false);
  });
  res.querySelectorAll(".close-btn").forEach(b => b.onclick = () => {
    const s = steps[+b.dataset.i]; setClosed(s.items.map(x => x.e.i), true);
    if(S.target && s.items.some(x => S.target.edges.includes(x.e.i))) S.target = null;
    toast(`${s.t==="l" ? "Lift" : "Piste"} gesloten. Nieuwe route berekend.`);
    drawPistes(); update();
  });
  setPeek();
}
function renderClosed(){
  const A = S.area, c = $("closed");
  if(!A || !S.closed.size){ c.innerHTML = `<span class="empty" style="font-size:13px">Alles is open.</span>`; return; }
  const groups = new Map();
  for(const i of S.closed){ const e = A.edges[i]; const k = e.t==="l" ? `Lift ${e.name||e.ref||LIFT[e.kind]}` : uc(pisteLabel(e)); (groups.get(k) || groups.set(k, []).get(k)).push(i); }
  const vals = [...groups.values()];
  c.innerHTML = [...groups.keys()].map((k,j) => `<button type="button" class="chip closed" data-j="${j}" title="Weer openen">${I("ban")}${esc(k)}</button>`).join("");
  c.querySelectorAll("button").forEach(b => b.onclick = () => { setClosed(vals[+b.dataset.j], false); drawPistes(); update(); });
}

// ================= kaart aantikken =================
map.on("click", ev => {
  if(!S.area) return;
  const A = S.area, p0 = map.latLngToContainerPoint(ev.latlng);
  let bn = -1, bd = Infinity;
  A.nodes.forEach((n, i) => { const d = p0.distanceTo(map.latLngToContainerPoint([n.lat, n.lon])); if(d < bd){ bd = d; bn = i; } });
  // dichtstbijzijnde piste of lift (in schermpixels)
  let be = -1, bed = Infinity;
  for(const e of A.edges){
    if(e.t==="w") continue;
    let prev = null;
    for(const q of e.pts){
      const c = map.latLngToContainerPoint(q);
      if(prev){ const dx = c.x-prev.x, dy = c.y-prev.y, L2 = dx*dx+dy*dy, t = L2 ? Math.max(0, Math.min(1, ((p0.x-prev.x)*dx + (p0.y-prev.y)*dy)/L2)) : 0;
        const d = Math.hypot(p0.x-prev.x-t*dx, p0.y-prev.y-t*dy); if(d < bed){ bed = d; be = e.i; } }
      prev = c;
    }
  }
  if(S.draw){
    if(be >= 0 && bed < 16 && bd > 14 && A.edges[be].t === "r") return addWp({k:"p", ei:be});
    if(bd <= 36) return addWp({k:"n", n:bn});
    if(be >= 0 && bed < 16) return addWp({k:"n", n:bn});
    toast("Tik op een piste, een lift of een liftstation."); return;
  }
  if(be >= 0 && bed < 16 && bd > 14) return edgePopup(be, ev.latlng, bn);
  if(bd > 36){ toast("Tik op een piste, een lift of een liftstation."); return; }
  if(S.pick==="from"){ S.from = bn; S.fromMe = false; S.pick = "to"; } else { S.to = bn; S.target = null; S.via = null; S.pick = "from"; S.planBy = null; S.wps = []; }
  update();
});
function edgePopup(ei, latlng, nearNode){
  const ch = chainFrom(ei), e = ch.e, A = S.area;
  const drop = ch.kind==="r" ? (A.nodes[ch.start].ele ?? 0) - (A.nodes[ch.end].ele ?? 0) : (A.nodes[ch.end].ele ?? 0) - (A.nodes[ch.start].ele ?? 0);
  const div = document.createElement("div"); div.className = "pop";
  const node = ch.kind==="l" ? `<span class="node" style="background:var(--surface);color:var(--p-lift);border:2px solid var(--p-lift)">${I("lift")}</span>`
                             : `<span class="node${e.diff==="s" ? " dark" : ""}" style="--c:${DIFF[e.diff].col}">${esc(e.ref) || I("ski")}</span>`;
  const mins = ch.kind==="l" ? e.dur/60 : ch.len / DIFF[e.diff].spd;
  const top = ch.kind==="l" ? A.nodes[ch.end].ele : A.nodes[ch.start].ele;
  div.innerHTML = `<div class="pop-head">${node}<div><b>${esc(uc(ch.label))}</b><small>${ch.kind==="l" ? uc(LIFT[e.kind]||"lift") : e.diff==="f" ? "Skiroute" : `${uc(DIFF[e.diff].adj)} piste`}</small></div></div>
    <div class="pop-facts"><div><b>${km(ch.len)}</b><span>Lengte</span></div><div><b>${Math.abs(Math.round(drop))} m</b><span>${ch.kind==="l" ? "Stijgen" : "Dalen"}</span></div><div><b>${fmt(mins)}</b><span>${top!=null ? `Top ${top} m` : "Duur"}</span></div></div>
    <div class="pop-btns">
      <button type="button" class="primary" data-a="ski">${I(ch.kind==="l" ? "lift" : "ski")}${ch.kind==="l" ? "Neem deze lift" : "Ski deze piste"}</button>
      <button type="button" data-a="to">Hierheen</button>
      <button type="button" data-a="from">Vertrek hier</button>
      <button type="button" class="danger" data-a="close" style="grid-column:1/-1">${ch.kind==="l" ? "Lift" : "Piste"} afsluiten</button>
    </div>`;
  const pop = L.popup({closeButton:true, autoPan:true, maxWidth:280, className:"pop-wrap"}).setLatLng(latlng).setContent(div).openOn(map);
  div.querySelectorAll("button").forEach(b => b.onclick = () => {
    const a = b.dataset.a;
    if(a==="ski"){ S.target = ch; S.via = null; S.pick = "from"; S.planBy = null; S.wps = []; if(S.from==null) S.from = ch.start; }
    else if(a==="to"){ S.to = nearNode; S.target = null; S.via = null; S.pick = "from"; S.wps = []; }
    else if(a==="from"){ S.from = nearNode; S.fromMe = false; S.pick = "to"; }
    else { setClosed(ch.edges, true); if(S.target?.edges.some(i => ch.edges.includes(i))) S.target = null; drawPistes(); toast(`${uc(ch.label)} gesloten.`); }
    map.closePopup(pop); update();
    if(a==="ski") fitRoute();
  });
}

// ================= GPS en navigatie =================
let wakeLock = null;
async function keepAwake(on){
  try{ if(on && "wakeLock" in navigator && !wakeLock){ wakeLock = await navigator.wakeLock.request("screen"); wakeLock.addEventListener("release", () => wakeLock = null); }
       if(!on && wakeLock){ await wakeLock.release(); wakeLock = null; } }catch(e){}
}
document.addEventListener("visibilitychange", () => { if(document.visibilityState==="visible" && S.follow) keepAwake(true); });
function speak(text){
  if(!S.voice || !S.follow || !("speechSynthesis" in window)) return;
  try{ const u = new SpeechSynthesisUtterance(text); u.lang = "nl-NL"; u.rate = 1.02;
       const v = speechSynthesis.getVoices().find(v => v.lang && v.lang.toLowerCase().startsWith("nl")); if(v) u.voice = v;
       speechSynthesis.cancel(); speechSynthesis.speak(u); }catch(e){}
}
function startWatch(){
  if(S.watch != null) return true;
  if(!("geolocation" in navigator)){ toast("Dit apparaat geeft geen locatie door."); return false; }
  S.watch = navigator.geolocation.watchPosition(onPos, err => {
    toast(err.code===1 ? "Locatie geweigerd. Sta locatie toe in je browserinstellingen." : "Locatie niet gevonden. Probeer het buiten opnieuw.", 3500);
    stopWatch();
  }, {enableHighAccuracy:true, maximumAge:3000, timeout:25000});
  $("locBtn").classList.add("on");
  return true;
}
function stopWatch(){
  if(S.watch != null) navigator.geolocation.clearWatch(S.watch);
  S.watch = null; S.pos = null; S.follow = false; keepAwake(false);
  $("locBtn").classList.remove("on","follow");
  meMarker?.remove(); meCircle?.remove(); meMarker = meCircle = null;
  update();
}
let firstFix = true;
async function onPos(p){
  const first = !S.pos;
  S.pos = {lat:p.coords.latitude, lon:p.coords.longitude, acc:p.coords.accuracy, alt:p.coords.altitude};
  const ll = [S.pos.lat, S.pos.lon];
  if(!meMarker){
    meCircle = L.circle(ll, {radius:S.pos.acc, color:"#1A8CFF", weight:1, fillOpacity:.12, interactive:false}).addTo(map);
    meMarker = L.marker(ll, {icon:L.divIcon({className:"", html:'<div class="me-dot"></div>', iconSize:[18,18], iconAnchor:[9,9]}), interactive:false, zIndexOffset:1000}).addTo(map);
  } else { meMarker.setLatLng(ll); meCircle.setLatLng(ll).setRadius(S.pos.acc); }

  // ben je in een ander skigebied? laad dat dan
  const inArea = S.area && S.area.bounds.pad(0.15).contains(ll);
  if(!inArea && S.index.length){
    const near = S.index.map(r => ({r, d:meters(S.pos.lat, S.pos.lon, r[5], r[4])})).sort((a,b)=>a.d-b.d)[0];
    if(near && near.d < 15000 && near.r[0] !== S.area?.id){
      toast(`Je bent bij ${near.r[1]}. Kaart geladen.`); await openArea(near.r[0], {keepView:true});
    }
  }
  if(S.area && S.fromMe){
    const nn = nearestNode(S.pos.lat, S.pos.lon);
    if(first || S.from == null){ S.from = nn.n; update(); }
    else if(S.follow && S.path && distToRoute() > OFF_ROUTE){
      if(++S.offCount >= 2){ S.from = nn.n; S.offCount = 0; toast("Je bent van de route af. Nieuwe route berekend."); speak("Je bent van de route af. Nieuwe route berekend."); update(); }
    } else S.offCount = 0;
  }
  if(firstFix && !S.follow){ firstFix = false; map.setView(ll, Math.max(map.getZoom(), 15)); }
  if(S.follow) map.panTo(ll, {animate:true});
  updateNav();
  groupOnPos();
  if(!$("group").hidden) renderGroup();
}
function distToRoute(){
  if(!S.pos || !S.steps.length) return Infinity;
  const p = [S.pos.lat, S.pos.lon]; let d = Infinity;
  for(const s of S.steps) for(let k = 0; k < s.line.length-1; k++) d = Math.min(d, segDist(p, s.line[k], s.line[k+1]).d);
  return d;
}
// waar op de route ben je: stap, afstand tot het eind van die stap
function navState(){
  if(!S.pos || !S.steps.length) return null;
  const p = [S.pos.lat, S.pos.lon]; let best = null;
  for(let i = S.navIdx; i < Math.min(S.steps.length, S.navIdx + 3); i++){
    const L = S.steps[i].line;
    for(let k = 0; k < L.length-1; k++){
      const r = segDist(p, L[k], L[k+1]);
      if(!best || r.d < best.d - 3) best = {i, k, t:r.t, d:r.d, seg:r.len};
    }
  }
  if(!best || best.d > 300) return null;
  const L = S.steps[best.i].line; let rem = (1 - best.t) * best.seg;
  for(let k = best.k + 1; k < L.length-1; k++) rem += meters(...L[k], ...L[k+1]);
  // vlak bij het eind van een stap: alvast door naar de volgende
  if(rem < 15 && best.i < S.steps.length-1){ best.i++; rem = S.steps[best.i].len; }
  S.navIdx = best.i;
  return {i:best.i, rem, off:best.d};
}
function updateNav(){
  const ban = $("navBanner");
  document.querySelectorAll("ol.steps li.current").forEach(li => li.classList.remove("current"));
  const ns = S.follow ? navState() : null;
  if(!ns){ ban.hidden = true; return; }
  const s = S.steps[ns.i], nx = S.steps[ns.i+1];
  const frac = s.len ? Math.min(1, ns.rem / s.len) : 0;
  const left = s.min * frac + S.steps.slice(ns.i+1).reduce((t, x) => t + x.min, 0);
  ban.hidden = false;
  $("navDist").textContent = km(ns.rem);
  $("navNow").textContent = nx ? uc(nx.say) : "Je bent er bijna";
  $("navArrow").innerHTML = `<use href="#i-${nx ? nx.icon : "flag"}"/>`;
  const arrive = new Date(Date.now() + left*60000).toLocaleTimeString("nl-NL", {hour:"2-digit", minute:"2-digit"});
  $("navNext").innerHTML = `${I(s.t==="l" ? "lift" : s.t==="w" ? "walk" : "ski")}<span>${esc(s.title)} · nog ${fmt(left)} · aankomst ${arrive}</span>`;
  // liften gaan bijna dicht
  const nowM = new Date().getHours()*60 + new Date().getMinutes(), close = toMin(S.liftClose), toGo = close - nowM;
  const liftAhead = S.steps.slice(ns.i).some(x => x.t==="l");
  const nw = $("navWarn");
  if(liftAhead && toGo > 0 && toGo <= 30){
    nw.hidden = false; nw.innerHTML = `${I("clock")}<span>Liften sluiten om ${S.liftClose}, over ${toGo} min</span>`;
    const key = new Date().toDateString();
    if(S.closeWarned !== key){ S.closeWarned = key; toast(`De liften sluiten over ${toGo} minuten.`, 4000); speak(`Let op: de liften sluiten over ${toGo} minuten.`); }
  } else nw.hidden = true;
  document.querySelector(`ol.steps li[data-i="${ns.i}"]`)?.classList.add("current");
  // gesproken aanwijzingen
  if(S.spoken.step !== ns.i){ S.spoken.step = ns.i; speak(`${uc(s.say)}${s.t!=="w" ? ", " + km(s.len).replace("km","kilometer").replace(" m"," meter") : ""}.`); }
  else if(nx && ns.rem < ANNOUNCE_AT && S.spoken.pre !== ns.i){ S.spoken.pre = ns.i; speak(`Over ${Math.round(ns.rem/10)*10} meter: ${nx.say}.`); }
  else if(!nx && ns.rem < 30 && S.spoken.pre !== ns.i){ S.spoken.pre = ns.i; speak("Je bent op je bestemming."); }
}
function toggleFollow(){
  if(S.follow){ S.follow = false; keepAwake(false); $("locBtn").classList.remove("follow"); speechSynthesis?.cancel?.(); update(); return; }
  if(!startWatch()) return;
  S.follow = true; S.spoken = {step:-1, pre:-1}; keepAwake(true); $("locBtn").classList.add("follow");
  if(window.innerWidth < 900) setSheet(false);
  if(S.pos) map.setView([S.pos.lat, S.pos.lon], Math.max(map.getZoom(), 16));
  else toast("Locatie zoeken…");
  update();
}
$("locBtn").onclick = () => {
  if(S.watch == null){ startWatch(); toast("Locatie zoeken…"); return; }
  if(S.pos) map.setView([S.pos.lat, S.pos.lon], Math.max(map.getZoom(), 15));
};
$("fromMe").onclick = () => {
  if(S.fromMe){ S.fromMe = false; update(); return; }
  S.fromMe = true; S.pick = "to";
  if(S.via!=null && S.to===S.from){ S.to = S.via; S.via = null; }
  if(startWatch() && S.pos && S.area){ S.from = nearestNode(S.pos.lat, S.pos.lon).n; }
  else toast("Locatie zoeken…");
  update();
};

// ================= paneel =================
const sheet = $("sheet");
const sheetPeek = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sheet-peek")) || 170;
function setPeek(){
  const h = $("peek").offsetHeight + 26 + 14;
  document.documentElement.style.setProperty("--sheet-peek", Math.max(110, Math.min(h, 260)) + "px");
}
function setSheet(open){ sheet.classList.toggle("open", open); }
(() => {   // veeggebaar op de greep
  const h = $("handle"); let y0 = null, moved = false, base = 0;
  h.addEventListener("pointerdown", e => { y0 = e.clientY; moved = false; base = sheet.getBoundingClientRect().top; h.setPointerCapture(e.pointerId); sheet.classList.add("dragging"); });
  h.addEventListener("pointermove", e => { if(y0==null) return; const dy = e.clientY - y0; if(Math.abs(dy) > 5) moved = true;
    if(moved){ const full = window.innerHeight - sheet.offsetHeight; const top = Math.max(full, base + dy); sheet.style.transform = `translateY(${top - full}px)`; } });
  const end = e => { if(y0==null) return; sheet.classList.remove("dragging"); sheet.style.transform = "";
    const dy = e.clientY - y0; y0 = null;
    if(!moved) setSheet(!sheet.classList.contains("open")); else setSheet(dy < 0); };
  h.addEventListener("pointerup", end); h.addEventListener("pointercancel", end);
})();

// ================= invoer =================
function placeInput(inp, key){
  inp.addEventListener("change", () => {
    const A = S.area; if(!A) return;
    const raw = inp.value.trim(), v = norm(raw); if(!v) return;
    if(key==="to"){
      for(const [s, ei] of A.skiNames) if(norm(s)===v){ S.target = chainFrom(ei); S.via = null; inp.blur(); update(); fitRoute(); return; }
    }
    let hit = null;
    for(const [s, n] of A.names){ const k = norm(s); if(k===v){ hit = n; break; } if(hit==null && k.includes(v)) hit = n; }
    if(hit==null && key==="to") for(const [s, ei] of A.skiNames) if(norm(s).includes(v)){ S.target = chainFrom(ei); S.via = null; inp.blur(); update(); fitRoute(); return; }
    if(hit==null){ toast(`Geen punt gevonden voor "${raw}".`); return; }
    S[key] = hit; if(key==="to"){ S.planBy = null; S.wps = []; }
    if(key==="from") S.fromMe = false; else { S.target = null; S.via = null; }
    inp.blur(); update();
  });
  inp.addEventListener("focus", () => { inp.select(); if(window.innerWidth < 900) setSheet(true); });
}
placeInput($("from"), "from"); placeInput($("to"), "to");
$("swap").onclick = () => {
  if(S.target){ S.from = S.target.end; S.to = S.target.start; S.target = null; }
  else if(S.via!=null && S.to===S.from){ /* rondje: omdraaien verandert niets */ }
  else [S.from, S.to] = [S.to, S.from];
  S.fromMe = false; update();
};
$("areaBtn").onclick = openPicker;
$("pickerClose").onclick = closePicker;
document.addEventListener("keydown", e => { if(e.key==="Escape"){ closePicker(); $("layerMenu").hidden = true; } });
$("q").addEventListener("input", e => { S.q = e.target.value; renderAreas(); });
$("nearBtn").onclick = () => {
  S.nearSort = true;
  if(S.pos) return renderAreas();
  if(startWatch()){ toast("Locatie zoeken…"); const t = setInterval(() => { if(S.pos){ clearInterval(t); renderAreas(); } }, 500); setTimeout(() => clearInterval(t), 30000); }
};
$("layersBtn").onclick = e => { e.stopPropagation(); $("layerMenu").hidden = !$("layerMenu").hidden; };
document.addEventListener("click", e => { if(!e.target.closest("#layerMenu,#layersBtn")) $("layerMenu").hidden = true; });
document.querySelectorAll("input[name=base]").forEach(r => r.onchange = () => { S.base = r.value; applyBase(); });
$("showPistes").onchange = e => { S.pistes = e.target.checked; applyBase(); };
$("showLabels").onchange = e => { S.labels = e.target.checked; applyBase(); };
$("showNums").onchange = e => { S.nums = e.target.checked; applyBase(); };
document.querySelectorAll("#level button").forEach(b => b.onclick = () => { S.level = +b.dataset.v; update(); });
document.querySelectorAll("#mode button").forEach(b => b.onclick = () => { S.mode = b.dataset.v; update(); });
$("free").onchange = e => { S.free = e.target.checked; update(); };
$("down").onchange = e => { S.down = e.target.checked; update(); };
$("voice").onchange = e => { S.voice = e.target.checked; if(!S.voice) speechSynthesis?.cancel?.(); save(); };
$("fitAreaBtn").onclick = () => fitArea();
$("fitRouteBtn").onclick = fitRoute;

// ================= liftsluiting =================
const toMin = s => { const [h, m] = String(s || "0:0").split(":").map(Number); return (h||0)*60 + (m||0); };
const hhmm = m => { m = Math.round(m); return `${String(Math.floor(m/60) % 24).padStart(2,"0")}:${String(m % 60).padStart(2,"0")}`; };
// wanneer ben je bij elke stap; buiten de openingstijden rekenen we vanaf de opening
function routeTiming(){
  const now = new Date(), nowM = now.getHours()*60 + now.getMinutes();
  const open = toMin(S.liftOpen), close = toMin(S.liftClose);
  const planned = nowM < open || nowM >= close;
  let t = planned ? open : nowM, lastLift = null; const late = [];
  S.steps.forEach((s, i) => {
    s.eta = t; s.late = s.t==="l" && t > close;
    if(s.late) late.push(i);
    if(s.t==="l" && !s.late) lastLift = t;
    t += s.min;
  });
  return {end:t, planned, late, lastLift, close};
}
// snelste weg naar het laagste bereikbare punt (het dorp of het dal)
function toValley(){
  const A = S.area; if(!A) return;
  let from = S.from;
  if(S.pos && (S.fromMe || S.follow)) from = nearestNode(S.pos.lat, S.pos.lon).n;
  if(from==null){ toast("Kies eerst waar je nu bent (A)."); return; }
  const {dist} = dijkstra(from, null, graph());
  let best = null;
  dist.forEach((d, n) => {
    if(d===Infinity || n===from) return;
    const e = A.nodes[n].ele ?? 9999;
    if(!best || e < best.e - 30 || (Math.abs(e - best.e) <= 30 && d < best.d)) best = {n, e, d};
  });
  if(!best){ toast("Vanaf hier is geen weg naar beneden gevonden."); return; }
  S.from = from; S.to = best.n; S.via = null; S.target = null; S.pick = "from"; S.planBy = null; S.wps = [];
  update(); fitRoute();
  toast(`Naar het dal: ${lc(nodeLabel(best.n))}${best.e < 9999 ? `, ${best.e} m` : ""}`);
}

// ================= weer en sneeuw =================
const WX = {0:["Helder","sun"],1:["Overwegend helder","sun"],2:["Half bewolkt","pcloud"],3:["Bewolkt","cloud"],45:["Mist","fog"],48:["Mist met rijp","fog"],
  51:["Lichte motregen","rain"],53:["Motregen","rain"],55:["Motregen","rain"],56:["IJzel","rain"],57:["IJzel","rain"],61:["Lichte regen","rain"],63:["Regen","rain"],
  65:["Zware regen","rain"],66:["IJzel","rain"],67:["IJzel","rain"],71:["Lichte sneeuw","snow"],73:["Sneeuw","snow"],75:["Zware sneeuw","snow"],77:["Korrelsneeuw","snow"],
  80:["Regenbuien","rain"],81:["Regenbuien","rain"],82:["Zware buien","rain"],85:["Sneeuwbuien","snow"],86:["Zware sneeuwbuien","snow"],95:["Onweer","storm"],96:["Onweer met hagel","storm"],99:["Onweer met hagel","storm"]};
const wxInfo = c => WX[c] || ["Onbekend","cloud"];
const AVALANCHE = {AT:["https://lawinen.at","Lawinenwarndienste Österreich"], CH:["https://www.slf.ch/de/lawinenbulletin-und-schneesituation/","SLF lawinebulletin"],
  FR:["https://meteofrance.com/meteo-montagne","Météo-France bergweer"], IT:["https://bollettini.aineva.it/","AINEVA lawinebulletin"],
  DE:["https://www.lawinenwarndienst.bayern.de/","Lawinenwarndienst Bayern"], SI:["https://meteo.arso.gov.si/met/sl/avalanche/","ARSO lawinebulletin"],
  LI:["https://www.slf.ch/de/lawinenbulletin-und-schneesituation/","SLF lawinebulletin"]};
const wxCache = {};
const deg = t => `${Math.round(t)}°`;
async function loadWeather(){
  const A = S.area; if(!A) return;
  const id = A.id, r = A.row, hi = r[10] ?? 2400, lo = r[9] ?? 1200;
  const c = wxCache[id];
  if(c && Date.now() - c.t < 30*60e3) return renderWeather(c.d);
  $("wxSum").innerHTML = `<span class="wx-loading">Weer en sneeuw laden…</span>`; $("wxBody").innerHTML = "";
  try{
    const url = "https://api.open-meteo.com/v1/forecast?" + new URLSearchParams({
      latitude:`${r[5]},${r[5]}`, longitude:`${r[4]},${r[4]}`, elevation:`${hi},${lo}`, timezone:"auto", forecast_days:"4", past_days:"1",
      current:"temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,visibility,snow_depth,freezing_level_height",
      hourly:"snowfall", daily:"weather_code,temperature_2m_max,temperature_2m_min,snowfall_sum,wind_speed_10m_max"});
    const res = await fetch(url); if(!res.ok) throw new Error(res.status);
    const d = await res.json(); if(!Array.isArray(d) || d.length < 2) throw new Error("data");
    wxCache[id] = {t:Date.now(), d};
    if(S.area?.id === id) renderWeather(d);
  }catch(e){
    if(S.area?.id === id) $("wxSum").innerHTML = `${I("cloud")}<span class="wx-loading">Weer niet beschikbaar. Geen verbinding?</span>`;
  }
}
function renderWeather(d){
  const A = S.area, r = A.row, top = d[0], dal = d[1], c = top.current, cd = dal.current;
  const [txt, ic] = wxInfo(c.weather_code);
  const H = top.hourly, hourIdx = H.time.indexOf(c.time.slice(0, 13) + ":00");
  const fresh = hourIdx >= 0 ? H.snowfall.slice(Math.max(0, hourIdx - 23), hourIdx + 1).reduce((s, x) => s + (x || 0), 0) : 0;
  const depth = Math.round((c.snow_depth || 0) * 100);
  $("wxSum").innerHTML = `<svg class="ic wx-ic"><use href="#i-${ic}"/></svg>
    <span class="wx-now"><b>${deg(c.temperature_2m)}<span>top · ${deg(cd.temperature_2m)} dal</span></b>
    <small>${txt} · wind ${Math.round(c.wind_speed_10m)} km/u${fresh >= 1 ? ` · ${Math.round(fresh)} cm vers` : ""}</small></span>
    <svg class="ic chev"><use href="#i-chev"/></svg>`;
  const notes = [];
  if(c.wind_gusts_10m >= 60) notes.push(`<p class="notice bad">${I("wind")}<span><strong>Harde wind op de top</strong> (stoten tot ${Math.round(c.wind_gusts_10m)} km/u). Hoge liften en gondels kunnen dicht zijn.</span></p>`);
  if(c.visibility < 1000) notes.push(`<p class="notice bad">${I("fog")}<span><strong>Slecht zicht op de top</strong> (${c.visibility < 200 ? "minder dan 200 m" : Math.round(c.visibility/100)*100 + " m"}). Blijf op gemarkeerde pistes.</span></p>`);
  const D = top.daily, today = c.time.slice(0, 10), start = Math.max(0, D.time.indexOf(today));
  const days = D.time.slice(start, start + 4).map((t, k) => {
    const i = start + k, [dt, di] = wxInfo(D.weather_code[i]);
    const name = k===0 ? "Vandaag" : k===1 ? "Morgen" : new Date(t + "T12:00").toLocaleDateString("nl-NL", {weekday:"short"});
    const sn = D.snowfall_sum[i] || 0;
    return `<div class="wx-day" title="${dt}"><b>${name}</b><svg class="ic"><use href="#i-${di}"/></svg>
      <span class="t">${deg(D.temperature_2m_max[i])} <i>${deg(D.temperature_2m_min[i])}</i></span><span class="sn">${sn >= 0.5 ? `${Math.round(sn)} cm` : ""}</span></div>`;
  }).join("");
  const av = AVALANCHE[r[2]];
  const vis = c.visibility >= 10000 ? "> 10 km" : c.visibility >= 1000 ? `${(c.visibility/1000).toFixed(1).replace(".",",")} km` : `${Math.round(c.visibility/10)*10} m`;
  $("wxBody").innerHTML = (notes.length ? `<div style="padding:0 14px">${notes.join("")}</div>` : "") + `
    <div class="wx-grid">
      <div class="wx-cell"><span>${I("wind")}Wind</span><b>${Math.round(c.wind_speed_10m)}<small> km/u</small></b><small>stoten ${Math.round(c.wind_gusts_10m)}</small></div>
      <div class="wx-cell"><span>${I("thermo")}Gevoel</span><b>${deg(c.apparent_temperature)}</b><small>op ${r[10] ?? "?"} m</small></div>
      <div class="wx-cell"><span>${I("eye")}Zicht</span><b>${vis}</b><small>op de top</small></div>
      <div class="wx-cell"><span>${I("snow")}Sneeuw</span><b>${depth}<small> cm</small></b><small>op de top (model)</small></div>
      <div class="wx-cell"><span>${I("snow")}Vers</span><b>${Math.round(fresh)}<small> cm</small></b><small>laatste 24 uur</small></div>
      <div class="wx-cell"><span>${I("thermo")}0°-grens</span><b>${Math.round(c.freezing_level_height/50)*50}<small> m</small></b><small>vriespunt</small></div>
    </div>
    <div class="wx-days">${days}</div>
    <div class="wx-foot"><span>Open-Meteo · ${c.time.slice(11, 16)} uur · temperatuur top/dal: ${r[10] ?? "?"}/${r[9] ?? "?"} m</span>
      ${av ? `<a href="${av[0]}" target="_blank" rel="noopener" title="${av[1]}">${I("warn")}Lawinebericht</a>` : `<a href="https://www.avalanches.org/" target="_blank" rel="noopener">${I("warn")}Lawinebericht</a>`}</div>`;
  $("areaStats").textContent = `${A.statsTxt} · ${deg(c.temperature_2m)} top`;
  computeRisk(c, fresh);
}

// ================= SOS =================
const RESCUE = {AT:["140","Alpine noodlijn (Bergrettung Österreich)"], CH:["1414","Rega, luchtreddingsdienst Zwitserland"],
                LI:["1414","Rega, ook voor Liechtenstein"], IT:["118","Medische noodhulp Italië"]};
let sosTimer = null;
const dms = (v, pos, neg) => { const a = Math.abs(v), d = Math.floor(a), mf = (a - d)*60, m = Math.floor(mf), s = ((mf - m)*60).toFixed(1);
  return `${d}°${String(m).padStart(2,"0")}′${s.padStart(4,"0")}″ ${v >= 0 ? pos : neg}`; };
function nearestPlace(){
  const A = S.area; if(!A || !S.pos) return null;
  const p = [S.pos.lat, S.pos.lon]; let best = null;
  for(const e of A.edges){
    if(e.t==="w") continue;
    for(let k = 0; k < e.pts.length-1; k++){ const r = segDist(p, e.pts[k], e.pts[k+1]); if(!best || r.d < best.d) best = {d:r.d, e}; }
  }
  if(!best || best.d > 2000) return null;
  const e = best.e, name = e.t==="l" ? liftLabel(e).replace(/^de /, "") : `${pisteLabel(e).replace(/^de /, "")} (${DIFF[e.diff].nl})`;
  return {txt: best.d < 40 ? `Op ${name}` : `${Math.round(best.d/10)*10} m van ${name}`, d:best.d};
}
function sosText(){
  const {lat, lon, acc} = S.pos, pl = nearestPlace(), alt = sosAlt();
  return `NOODGEVAL – mijn locatie: ${lat.toFixed(5)}, ${lon.toFixed(5)} (± ${Math.round(acc)} m)` + (alt ? `, hoogte ca. ${alt} m` : "")
    + (pl ? `, ${lc(pl.txt)}` : "") + (S.area ? `, skigebied ${S.area.row[1]}` : "") + `. Kaart: https://maps.google.com/?q=${lat.toFixed(5)},${lon.toFixed(5)}`;
}
function sosAlt(){
  if(S.pos?.alt != null) return Math.round(S.pos.alt);
  if(S.area && S.pos){ const n = nearestNode(S.pos.lat, S.pos.lon); if(n.d < 300) return S.area.nodes[n.n].ele; }
  return null;
}
function renderSos(){
  const cc = S.area?.row[2], loc = RESCUE[cc];
  $("sosLocal").hidden = !loc;
  if(loc){ $("sosLocal").href = `tel:${loc[0]}`; $("sosLocalNum").textContent = `Bel ${loc[0]}`; $("sosLocalTxt").textContent = loc[1]; }
  if(!S.pos){
    $("sosLoc").innerHTML = `<p class="empty">${S.watch==null ? "<strong>Locatie staat uit.</strong> Sta locatie toe voor deze app, of geef de naam van de piste of lift door." : "Locatie zoeken… Ga zo mogelijk naar een open plek."}</p>`;
    $("sosCopy").disabled = $("sosShare").disabled = true; return;
  }
  const {lat, lon, acc} = S.pos, pl = nearestPlace(), alt = sosAlt();
  $("sosCopy").disabled = $("sosShare").disabled = false;
  $("sosLoc").innerHTML = `<div class="sos-coord">${lat.toFixed(5)}, ${lon.toFixed(5)}</div>
    <div class="sos-dms">${dms(lat, "N", "Z")} · ${dms(lon, "O", "W")}</div>
    <div class="sos-facts">
      <div><span>Nauwkeurig</span><b>± ${Math.round(acc)} m</b></div>
      <div><span>Hoogte</span><b>${alt != null ? `ca. ${alt} m` : "onbekend"}</b></div>
      <div style="grid-column:1/-1"><span>Waar</span><b>${pl ? esc(pl.txt) : "Niet bij een piste of lift"}${S.area ? ` · ${esc(S.area.row[1])}` : ""}</b></div>
    </div>`;
}
function openSos(){ $("sos").hidden = false; if(S.watch==null) startWatch(); renderSos(); clearInterval(sosTimer); sosTimer = setInterval(renderSos, 3000); }
function closeSos(){ $("sos").hidden = true; clearInterval(sosTimer); }
$("sosBtn").onclick = openSos;
$("sosClose").onclick = closeSos;
$("sosCopy").onclick = async () => {
  if(!S.pos) return;
  try{ await navigator.clipboard.writeText(sosText()); toast("Locatie gekopieerd. Plak hem in een bericht."); }
  catch(e){ toast("Kopiëren lukte niet. Lees de coördinaten voor."); }
};
$("sosShare").onclick = async () => {
  if(!S.pos) return;
  if(navigator.share){ try{ await navigator.share({title:"Mijn locatie (noodgeval)", text:sosText()}); }catch(e){} }
  else $("sosCopy").click();
};
document.addEventListener("keydown", e => { if(e.key==="Escape" && !$("sos").hidden) closeSos(); });

// ================= open en dicht vandaag =================
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`; };
const statusStoreKey = id => `pp-status:${id}:${todayKey()}`;
const closedKeys = () => { const A = S.area; return A ? [...A.groups.values()].filter(g => g.edges.some(i => S.closed.has(i))).map(g => g.key) : []; };
// open of dicht zetten gaat altijd per hele lift of hele piste
function setClosed(edgeIdxs, closed){
  const A = S.area, keys = new Set(edgeIdxs.map(i => A.edges[i].key).filter(Boolean));
  for(const k of keys) for(const i of A.groups.get(k).edges) closed ? S.closed.add(i) : S.closed.delete(i);
  if(closed && S.target?.edges.some(i => S.closed.has(i))) S.target = null;
}
function applyKeys(keys){
  const A = S.area; S.closed = new Set();
  for(const k of keys){ const g = A.groups.get(k); if(g) g.edges.forEach(i => S.closed.add(i)); }
}
function loadStatus(){
  let keys = [];
  try{ keys = JSON.parse(localStorage.getItem(statusStoreKey(S.area.id)) || "[]"); }catch(e){}
  applyKeys(keys);
  // oude dagen opruimen
  try{ for(let i = localStorage.length - 1; i >= 0; i--){ const k = localStorage.key(i); if(k?.startsWith("pp-status:") && !k.endsWith(":" + todayKey())) localStorage.removeItem(k); } }catch(e){}
}
function persistStatus(){
  if(!S.area) return;
  const keys = closedKeys();
  try{ keys.length ? localStorage.setItem(statusStoreKey(S.area.id), JSON.stringify(keys)) : localStorage.removeItem(statusStoreKey(S.area.id)); }catch(e){}
  $("statusCount").hidden = !keys.length; $("statusCount").textContent = keys.length;
}

// delen: #<gebied>/s/<datum>/<nummers van dichte groepen>
let pendingShare = null;
function parseShareHash(){
  const [id, tag, date, list] = location.hash.slice(1).split("/");
  if(tag === "s" && id) pendingShare = {id, date, list:list || ""};
  if(tag === "g" && date) G.pending = date.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
function applyPendingShare(){
  if(!pendingShare || pendingShare.id !== S.area.id) return;
  const {date, list} = pendingShare; pendingShare = null;
  if(date !== todayKey()){
    const nice = `${date.slice(6,8)}-${date.slice(4,6)}`;
    setTimeout(() => toast(`Deze gedeelde status is van ${nice}, niet van vandaag. Niet toegepast.`, 4500), 600);
    return;
  }
  const keys = list.split(".").filter(Boolean).map(x => S.area.groupKeys[parseInt(x, 36)]).filter(Boolean);
  applyKeys(keys);
  setTimeout(() => toast(keys.length ? `Status van je groep geladen: ${keys.length} ${keys.length===1 ? "lift of piste" : "liften en pistes"} dicht.` : "Status van je groep geladen: alles open.", 4000), 600);
}
function shareUrl(){
  const A = S.area, list = closedKeys().map(k => A.groupKeys.indexOf(k)).filter(i => i >= 0).map(i => i.toString(36)).join(".");
  return `${location.origin}${location.pathname}#${A.id}/s/${todayKey()}/${list}`;
}
window.addEventListener("hashchange", () => {
  const before = pendingShare; parseShareHash();
  if(G.pending){
    const code = G.pending; G.pending = null;
    if(code !== G.code){ if(G.code) gLeave(); openGroup(); $("gCode").value = code; if(G.name){ $("gName").value = G.name; gStart(code); } }
    try{ history.replaceState(null, "", "#" + (S.area?.id || "")); }catch(e){}
    return;
  }
  if(!pendingShare || pendingShare === before) return;
  if(S.area && pendingShare.id === S.area.id){ applyPendingShare(); drawPistes(); update(); if(!$("status").hidden) renderStatus(); }
  else openArea(pendingShare.id);
  try{ history.replaceState(null, "", "#" + (S.area?.id || "")); }catch(e){}
});

// weerrisico: hoge liften bij harde wind
function computeRisk(c, fresh){
  const A = S.area, gust = Math.round(c.wind_gusts_10m || 0), top = A.row[10] ?? 0, before = S.risk?.lifts.size || 0;
  const AERIAL = new Set(["gondola","cable_car","chair_lift","mixed_lift"]);
  const lifts = new Set();
  if(gust >= 65){
    for(const g of A.groups.values()){
      if(g.t !== "l" || !AERIAL.has(g.e.kind)) continue;
      if(gust >= 90 || (g.top ?? 0) >= top - 500) g.edges.forEach(i => lifts.add(i));
    }
  }
  S.risk = {lifts, gust, fresh, reason:`windstoten tot ${gust} km/u op ${top} m`};
  if(lifts.size || before){ drawPistes(); update(); }
  if(!$("status").hidden) renderStatus();
}

let stTab = "l";
const groupName = g => g.t==="l" ? uc(g.e.name || (g.e.ref ? `${LIFT[g.e.kind]||"lift"} ${g.e.ref}` : LIFT[g.e.kind]||"lift")) : uc(pisteLabel(g.e));
function statusSummary(){
  const A = S.area, keys = closedKeys(), nl = keys.filter(k => A.groups.get(k).t==="l").length, np = keys.length - nl;
  $("statusSummary").innerHTML = keys.length
    ? `Volgens jou dicht: <b>${nl} ${nl===1 ? "lift" : "liften"}</b> en <b>${np} ${np===1 ? "piste" : "pistes"}</b>. Routes gaan hier omheen.`
    : `Alles staat op <b>open</b>. Zet dicht wat vandaag dicht is; de routes houden er rekening mee.`;
}
function renderStatus(){
  const A = S.area; if(!A) return;
  const d = new Date();
  $("statusDate").textContent = `${A.row[1]} · ${d.toLocaleDateString("nl-NL", {weekday:"long", day:"numeric", month:"long"})}`;
  const site = A.row[11];
  $("officialLink").href = site || `https://www.google.com/search?q=${encodeURIComponent(A.row[1] + " liftstatus")}`;
  $("officialTxt").textContent = site ? "Officiële liftstatus" : "Zoek liftstatus";
  statusSummary();
  // weerwaarschuwing
  const R = S.risk, riskOpen = R ? [...R.lifts].filter(i => !S.closed.has(i)) : [];
  const nRisk = R ? new Set([...R.lifts].map(i => A.edges[i].key)).size : 0;
  $("riskBox").innerHTML = R && nRisk ? `<div class="risk"><p>${I("wind")}<span><strong>${nRisk} ${nRisk===1 ? "lift is" : "liften zijn"} mogelijk dicht door wind</strong> (${R.reason}). Hoge gondels en stoeltjesliften stoppen vaak vanaf 60–80 km/u.</span></p>
      ${riskOpen.length ? `<button type="button" class="btn ghost" id="riskApply">${I("ban")}Zet ze op dicht</button>` : ""}</div>`
    : R && R.fresh >= 30 ? `<div class="risk"><p>${I("snow")}<span><strong>${Math.round(R.fresh)} cm verse sneeuw</strong> in 24 uur. Hoge pistes en liften gaan dan vaak later open vanwege lawinewerk.</span></p></div>` : "";
  $("riskApply")?.addEventListener("click", () => { setClosed([...R.lifts], true); drawPistes(); update(); renderStatus(); toast("Liften met windrisico op dicht gezet."); });
  document.querySelectorAll("#statusTab button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v===stTab)));
  // lijst
  const q = norm($("statusQ").value.trim());
  let list = [...A.groups.values()].filter(g => g.t===stTab && (stTab==="l" || !g.key.startsWith("e|")));
  if(q) list = list.filter(g => norm(groupName(g) + " " + (g.e.ref||"")).includes(q));
  const num = g => { const m = /^(\d+)/.exec(g.e.ref || ""); return m ? +m[1] : 9999; };
  list.sort(stTab==="l" ? (a, b) => groupName(a).localeCompare(groupName(b), "nl") : (a, b) => num(a) - num(b) || groupName(a).localeCompare(groupName(b), "nl"));
  $("statusList").innerHTML = list.map(g => {
    const off = g.edges.some(i => S.closed.has(i)), risk = g.t==="l" && g.edges.some(i => R?.lifts.has(i));
    const node = g.t==="l" ? `<span class="node liftnode">${I("lift")}</span>` : `<span class="node${g.e.diff==="s" ? " dark" : ""}" style="--c:${DIFF[g.e.diff].col}">${esc(g.e.ref) || I("ski")}</span>`;
    const meta = g.t==="l" ? `${uc(LIFT[g.e.kind]||"lift")} · ${km(g.len)}${g.top!=null && g.top >= 0 ? ` · tot ${g.top} m` : ""}` : `${uc(DIFF[g.e.diff].nl)} · ${km(g.len)}`;
    return `<li class="${off ? "off" : ""}" data-k="${esc(g.key)}">${node}<span><span class="st-name">${esc(groupName(g))}</span><span class="st-meta">${meta}</span>${risk && !off ? `<span class="risk-tag">${I("wind")}Mogelijk dicht door wind</span>` : ""}</span>
      <label class="switch" title="${off ? "Dicht" : "Open"}"><input type="checkbox" ${off ? "" : "checked"} aria-label="${esc(groupName(g))} open"><i></i></label></li>`;
  }).join("") || `<li class="empty" style="display:block;padding:14px 6px">Niets gevonden${q ? ` voor "${esc($("statusQ").value)}"` : ""}.</li>`;
  $("statusList").querySelectorAll("li[data-k] input").forEach(inp => inp.onchange = () => {
    const li = inp.closest("li"), g = A.groups.get(li.dataset.k);
    setClosed(g.edges, !inp.checked); li.classList.toggle("off", !inp.checked);
    drawPistes(); update(); statusSummary();
  });
}
function openStatus(){ if(!S.area) return; $("status").hidden = false; $("sharePanel").hidden = true; renderStatus(); }
function closeStatus(){ $("status").hidden = true; }
$("statusBtn").onclick = openStatus;
$("statusClose").onclick = closeStatus;
$("statusQ").addEventListener("input", renderStatus);
document.querySelectorAll("#statusTab button").forEach(b => b.onclick = () => { stTab = b.dataset.v; renderStatus(); });
$("statusReset").onclick = () => { if(!S.closed.size) return; S.closed = new Set(); drawPistes(); update(); renderStatus(); toast("Alles staat weer op open."); };
document.addEventListener("keydown", e => { if(e.key==="Escape" && !$("status").hidden) closeStatus(); });
$("shareStatus").onclick = () => {
  const url = shareUrl(), p = $("sharePanel");
  p.hidden = !p.hidden; if(p.hidden) return;
  try{ const qr = qrcode(0, "M"); qr.addData(url); qr.make(); $("qrBox").innerHTML = qr.createSvgTag({cellSize:4, margin:0, scalable:true}); }
  catch(e){ $("qrBox").innerHTML = `<small class="empty">QR-code lukte niet. Stuur de link.</small>`; }
};
$("shareCopy").onclick = async () => {
  try{ await navigator.clipboard.writeText(shareUrl()); toast("Link gekopieerd. Plak hem in de groepsapp."); }
  catch(e){ toast("Kopiëren lukte niet."); }
};
$("shareSend").onclick = async () => {
  const url = shareUrl(), n = closedKeys().length;
  const text = `Liftstatus ${S.area.row[1]} vandaag: ${n ? `${n} ${n===1 ? "lift of piste" : "liften en pistes"} dicht` : "alles open"}. Open in de Pistenplanner:`;
  if(navigator.share){ try{ await navigator.share({title:"Liftstatus vandaag", text, url}); }catch(e){} }
  else $("shareCopy").click();
};

// ================= groep =================
// Telefoons in een groep praten via ntfy.sh: elk bericht is een klein JSON-pakket op een geheim kanaal.
const NTFY = "https://ntfy.sh/";
const POS_MIN_MOVE = 60, POS_MIN_SEC = 60, POS_MAX_SEC = 300, POS_DAILY_SOFT = 180;   // zuinig met de gratis daglimiet
const G = {code:null, name:"", id:null, follow:true, sharePos:true, es:null, members:new Map(), planTs:0, plan:null,
           lastPos:null, conn:"", pending:null, planTimer:null};
try{ const g = JSON.parse(localStorage.getItem("pp-group") || "null");
  if(g) Object.assign(G, {code:g.code||null, name:g.name||"", id:g.id||null, follow:g.follow ?? true, sharePos:g.sharePos ?? true}); }catch(e){}
if(!G.id) G.id = Math.random().toString(36).slice(2, 10);
const gSave = () => { try{ localStorage.setItem("pp-group", JSON.stringify({code:G.code, name:G.name, id:G.id, follow:G.follow, sharePos:G.sharePos})); }catch(e){} };
const gTopic = () => "pistenplanner-" + G.code.toLowerCase();
const COLORS = ["#7C3AED","#DB2777","#0891B2","#EA580C","#16A34A","#4F46E5","#CA8A04","#DC2626"];
const gColor = id => COLORS[[...String(id)].reduce((s, c) => s + c.charCodeAt(0), 0) % COLORS.length];
const newCode = () => { const a = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; let s = ""; const r = crypto.getRandomValues(new Uint8Array(8)); r.forEach(x => s += a[x % a.length]); return s; };
const memberLayer = L.layerGroup().addTo(map);

function sentToday(add){
  const k = "pp-sent:" + todayKey(); let n = 0;
  try{ n = +(localStorage.getItem(k) || 0) + (add || 0); if(add) localStorage.setItem(k, n); }catch(e){}
  return n;
}
async function gSend(obj){
  if(!G.code) return false;
  const msg = JSON.stringify({v:1, id:G.id, name:G.name, ts:Date.now(), ...obj});
  try{
    const r = await fetch(NTFY + gTopic(), {method:"POST", body:msg});
    if(r.status === 429){ G.conn = "De gratis dienst is even overbelast. Probeer het over een paar minuten opnieuw."; renderGroup(); return false; }
    if(r.ok) sentToday(1);
    return r.ok;
  }catch(e){ return false; }
}
function gConnect(){
  if(!G.code) return;
  G.es?.close();
  G.members = new Map();
  G.conn = "Verbinden…"; renderGroup();
  const es = new EventSource(`${NTFY}${gTopic()}/sse?since=3h`);
  G.es = es;
  es.onopen = () => { G.conn = ""; renderGroup(); };
  es.onerror = () => { G.conn = navigator.onLine ? "Verbinding met de groep herstellen…" : "Geen internet. Je ziet de groep weer zodra je verbinding hebt."; renderGroup(); };
  es.onmessage = ev => {
    let m, d; try{ m = JSON.parse(ev.data); if(m.event !== "message") return; d = JSON.parse(m.message); }catch(e){ return; }
    if(!d || d.v !== 1 || !d.id) return;
    gHandle(d);
  };
}
function gHandle(d){
  if(d.t === "bye"){ G.members.delete(d.id); drawMembers(); renderGroup(); return; }
  if(d.id !== G.id){
    const m = G.members.get(d.id) || {id:d.id};
    m.name = String(d.name || "?").slice(0, 20); m.seen = Math.max(m.seen || 0, d.ts || 0);
    if(d.t === "pos" && (!m.posTs || d.ts > m.posTs)){ m.lat = +d.lat; m.lon = +d.lon; m.posTs = d.ts; }
    G.members.set(d.id, m);
  }
  if(d.t === "plan" && d.ts > G.planTs){
    G.planTs = d.ts; G.plan = d;
    // bij het opnieuw verbinden komen oude berichten snel achter elkaar binnen: alleen de laatste toepassen
    clearTimeout(G.planTimer); G.planTimer = setTimeout(() => adoptPlan(G.plan), 500);
  }
  drawMembers(); renderGroup();
}
async function adoptPlan(d){
  if(!d || !G.follow || d.id === G.id) { renderGroup(); return; }
  if(!S.area || S.area.id !== d.area){ if(!S.index.some(r => r[0] === d.area)) return; await openArea(d.area, {keepView:false}); }
  const A = S.area;
  applyKeys((d.closed || []).map(i => A.groupKeys[i]).filter(Boolean));
  S.wps = wpsIn(d.wps); if(S.draw) stopDraw();
  S.via = Number.isInteger(d.via) && A.nodes[d.via] ? d.via : null;
  if(d.dk === "t" && A.edges[d.de]){ S.target = chainFrom(d.de); S.to = S.target.end; }
  else if(Number.isInteger(d.to) && A.nodes[d.to]){ S.target = null; S.to = d.to; }
  if(S.pos){ S.fromMe = true; S.from = nearestNode(S.pos.lat, S.pos.lon).n; }
  else if(S.from == null || (S.via != null && d.to === d.from)) S.from = d.from;
  if(S.via != null && d.to === d.from && !S.pos) S.to = S.from;
  S.planBy = d.name;
  drawPistes(); update(); fitRoute();
  toast(`${d.name} heeft de route gekozen. Jouw route staat klaar.`, 3500);
  speak(`${d.name} heeft een nieuwe route gekozen.`);
}
async function sendPlan(){
  if(!G.code || !S.area || (S.to == null && !S.target)){ toast("Kies eerst een bestemming of piste."); return; }
  const A = S.area;
  const closed = closedKeys().map(k => A.groupKeys.indexOf(k)).filter(i => i >= 0);
  const plan = {t:"plan", area:A.id, from:S.from, to:S.to, via:S.via, dk:S.target ? "t" : "n", de:S.target ? S.target.e.i : null, closed,
                wps: S.wps.length ? wpsOut() : undefined,
                label: S.wps.length ? `Getekende route (${S.wps.length} punten)` : S.target ? `Skiën: ${S.target.label}` : nodeLabel(S.to)};
  const ok = await gSend(plan);
  if(ok){ G.planTs = Date.now(); G.plan = {...plan, name:G.name, id:G.id, ts:G.planTs}; S.planBy = null; renderGroup(); update(); toast("Route gestuurd naar de groep."); }
  else toast("Versturen lukte niet. Controleer je verbinding.");
}
function groupOnPos(){
  if(!G.code || !G.sharePos || !S.pos) return;
  const now = Date.now(), last = G.lastPos;
  const moved = last ? meters(last.lat, last.lon, S.pos.lat, S.pos.lon) : Infinity, dt = last ? (now - last.t)/1000 : Infinity;
  const minSec = sentToday() > POS_DAILY_SOFT ? 600 : POS_MIN_SEC;
  if(dt >= POS_MAX_SEC || (moved >= POS_MIN_MOVE && dt >= minSec)){
    G.lastPos = {lat:S.pos.lat, lon:S.pos.lon, t:now};
    gSend({t:"pos", lat:+S.pos.lat.toFixed(5), lon:+S.pos.lon.toFixed(5)});
  }
}
const ago = ts => { const m = Math.round((Date.now() - ts)/60000); return m < 1 ? "nu" : m < 60 ? `${m} min geleden` : `${Math.floor(m/60)} u geleden`; };
function placeOf(lat, lon){
  const A = S.area; if(!A) return null;
  const p = [lat, lon]; let best = null;
  for(const e of A.edges){ if(e.t==="w") continue; for(let k = 0; k < e.pts.length-1; k++){ const r = segDist(p, e.pts[k], e.pts[k+1]); if(!best || r.d < best.d) best = {d:r.d, e}; } }
  if(!best || best.d > 400) return null;
  const e = best.e; return (best.d < 50 ? "op " : "bij ") + (e.t==="l" ? liftLabel(e).replace(/^de /, "") : pisteLabel(e).replace(/^de /, ""));
}
function drawMembers(){
  memberLayer.clearLayers();
  for(const m of G.members.values()){
    if(m.lat == null) continue;
    const stale = Date.now() - m.posTs > 10*60000;
    L.marker([m.lat, m.lon], {interactive:false, keyboard:false, zIndexOffset:900, icon:L.divIcon({className:"", iconSize:[30,30], iconAnchor:[15,15],
      html:`<div class="mem-wrap${stale ? " stale" : ""}"><div class="mem" style="--c:${gColor(m.id)}">${esc(m.name.charAt(0).toUpperCase())}</div><span class="mem-name">${esc(m.name)}</span></div>`})}).addTo(memberLayer);
  }
  const n = G.members.size;
  $("groupCount").hidden = !G.code; $("groupCount").textContent = n + 1;
}
function renderGroup(){
  const inG = !!G.code;
  $("groupOut").hidden = inG; $("groupIn").hidden = !inG;
  $("groupLabel").textContent = inG ? "Jouw groep" : "Samen skiën";
  $("groupTitle").textContent = inG ? `Groep ${G.code}` : "Groep";
  $("gName").value = $("gName").value || G.name;
  if(!inG) return;
  $("gCodeShow").textContent = G.code;
  $("gFollow").checked = G.follow; $("gSharePos").checked = G.sharePos;
  $("gConn").textContent = G.conn; $("gConn").hidden = !G.conn;
  const p = G.plan;
  $("gPlan").innerHTML = p ? `${p.id === G.id ? "<b>Jij</b> hebt" : `<b>${esc(p.name)}</b> heeft`} de route gekozen: <b>${esc(p.label || "bestemming")}</b> · ${ago(p.ts)}` : "";
  const me = `<li><div class="mem" style="--c:${gColor(G.id)}">${esc((G.name || "?").charAt(0).toUpperCase())}</div><span><b>${esc(G.name || "Jij")} (jij)</b><small>${S.pos ? esc(placeOf(S.pos.lat, S.pos.lon) || "positie gedeeld") : G.sharePos ? "positie nog onbekend" : "positie niet gedeeld"}</small></span><span class="ago"></span></li>`;
  const others = [...G.members.values()].sort((a, b) => a.name.localeCompare(b.name, "nl")).map(m => {
    const where = m.lat != null ? (placeOf(m.lat, m.lon) || "in de buurt") : "positie niet gedeeld";
    const dist = m.lat != null && S.pos ? ` · ${km(meters(S.pos.lat, S.pos.lon, m.lat, m.lon))} van je` : "";
    return `<li><div class="mem" style="--c:${gColor(m.id)}">${esc(m.name.charAt(0).toUpperCase())}</div><span><b>${esc(m.name)}</b><small>${esc(where)}${dist}</small></span><span class="ago">${ago(m.posTs || m.seen)}</span></li>`;
  }).join("");
  $("gMembers").innerHTML = me + (others || `<li class="empty" style="display:block">Nog niemand anders. Laat ze de code scannen.</li>`);
}
function gUrl(){ return `${location.origin}${location.pathname}#${S.area?.id || ""}/g/${G.code}`; }
function gDrawQr(){ try{ const qr = qrcode(0, "M"); qr.addData(gUrl()); qr.make(); $("gQr").innerHTML = qr.createSvgTag({cellSize:4, margin:0, scalable:true}); }catch(e){ $("gQr").innerHTML = ""; } }
function gStart(code){
  const name = $("gName").value.trim();
  if(!name){ toast("Vul eerst je naam in."); $("gName").focus(); return; }
  G.name = name; G.code = code.toUpperCase(); G.plan = null; G.planTs = 0; G.lastPos = null; gSave();
  gConnect(); gSend({t:"hello"}); renderGroup(); gDrawQr(); drawMembers();
  if(G.sharePos && S.watch == null) startWatch();
}
function gLeave(){
  gSend({t:"bye"}); G.es?.close(); G.es = null;
  G.code = null; G.members = new Map(); G.plan = null; S.planBy = null; gSave();
  drawMembers(); renderGroup(); update(); toast("Je hebt de groep verlaten.");
}
function openGroup(){ $("group").hidden = false; renderGroup(); if(G.code) gDrawQr(); }
$("groupBtn").onclick = openGroup;
$("groupClose").onclick = () => $("group").hidden = true;
$("gCreate").onclick = () => gStart(newCode());
$("gJoin").onclick = () => { const c = $("gCode").value.trim().replace(/[^A-Za-z0-9]/g, ""); if(c.length < 4){ toast("Vul de groepscode in."); return; } gStart(c); };
$("gLeave").onclick = gLeave;
$("gSendPlan").onclick = sendPlan;
$("gFollow").onchange = e => { G.follow = e.target.checked; gSave(); if(G.follow && G.plan && G.plan.id !== G.id) adoptPlan(G.plan); };
$("gSharePos").onchange = e => { G.sharePos = e.target.checked; gSave(); if(G.sharePos){ G.lastPos = null; if(S.watch == null) startWatch(); else groupOnPos(); } };
$("gCopy").onclick = async () => { try{ await navigator.clipboard.writeText(gUrl()); toast("Link gekopieerd."); }catch(e){ toast("Kopiëren lukte niet."); } };
$("gShare").onclick = async () => {
  if(navigator.share){ try{ await navigator.share({title:"Skiën in een groep", text:`Doe mee met mijn groep in de Pistenplanner (code ${G.code}):`, url:gUrl()}); }catch(e){} }
  else $("gCopy").click();
};
document.addEventListener("keydown", e => { if(e.key==="Escape" && !$("group").hidden) $("group").hidden = true; });
setInterval(() => { if(G.code){ drawMembers(); if(!$("group").hidden) renderGroup(); } }, 30000);
window.addEventListener("online", () => { if(G.code && G.es?.readyState === 2) gConnect(); });

// ================= route tekenen =================
const wpsOut = () => S.wps.map(w => w.k === "p" ? ["p", w.ei] : ["n", w.n]);
const wpsIn = arr => (arr || []).filter(x => Array.isArray(x) && Number.isInteger(x[1])).map(([k, v]) => k === "p" ? {k:"p", ei:v} : {k:"n", n:v})
  .filter(w => w.k === "p" ? S.area.edges[w.ei]?.t === "r" : !!S.area.nodes[w.n]);
function addWp(w){
  const last = S.wps[S.wps.length-1];
  if(last && last.k === w.k && (w.k === "n" ? last.n === w.n : last.ei === w.ei)){ toast("Dit punt staat er al."); return; }
  S.wps.push(w); S.planBy = null;
  if(S.wps.length > 1 || (S.fromMe && S.pos)){
    if(!computePath()){
      S.wps.pop();
      toast("Dit punt is vanaf het vorige niet te bereiken met jouw niveau. Kies een ander punt.", 3500);
      return;
    }
  }
  update(); renderDrawBar();
}
function renderDrawBar(){
  const n = S.wps.length;
  $("dbUndo").disabled = $("dbClear").disabled = !n;
  if(!n){ $("dbTitle").textContent = "Route tekenen"; $("dbSub").textContent = S.fromMe && S.pos ? "Start bij jou. Tik het eerste punt aan." : "Tik je startpunt aan: een liftstation, kruising of piste"; return; }
  if(!S.path || !S.path.length){ $("dbTitle").textContent = `${n} ${n===1 ? "punt" : "punten"}`; $("dbSub").textContent = "Tik het volgende punt aan"; return; }
  const tot = S.path.reduce((t, x) => t + x.min, 0), kmp = S.path.filter(x => x.e.t==="r").reduce((t, x) => t + x.e.len, 0);
  $("dbTitle").textContent = `${n} punten · ${fmt(tot)}`;
  $("dbSub").textContent = `${(kmp/1000).toFixed(1).replace(".", ",")} km piste · tik verder of kies Klaar`;
}
function startDraw(){
  if(!S.area) return;
  S.draw = true; S.wps = []; S.target = null; S.via = null; S.planBy = null;
  if(!(S.fromMe && S.pos)) S.from = null;
  S.to = null;
  document.body.classList.add("drawing"); $("drawBtn").classList.add("drawing");
  $("drawBar").hidden = false; map.closePopup();
  if(window.innerWidth < 900) setSheet(false);
  update(); renderDrawBar();
}
function stopDraw(){
  S.draw = false;
  document.body.classList.remove("drawing"); $("drawBtn").classList.remove("drawing");
  $("drawBar").hidden = true;
  if(S.wps.length === 1 && !(S.fromMe && S.pos)) S.wps = [];   // één los punt is nog geen route
  update();
  if(S.path?.length){ fitRoute(); if(window.innerWidth < 900) setSheet(true); }
}
$("drawBtn").onclick = () => S.draw ? stopDraw() : startDraw();
$("dbDone").onclick = stopDraw;
$("dbUndo").onclick = () => { S.wps.pop(); update(); renderDrawBar(); };
$("dbClear").onclick = () => { S.wps = []; update(); renderDrawBar(); };
document.addEventListener("keydown", e => {
  if(!S.draw) return;
  if(e.key === "Escape") stopDraw();
  if((e.ctrlKey || e.metaKey) && e.key === "z"){ e.preventDefault(); $("dbUndo").click(); }
});

// ================= mijn routes =================
const routesKey = () => `pp-routes:${S.area.id}`;
function loadRoutes(){ try{ return JSON.parse(localStorage.getItem(routesKey()) || "[]"); }catch(e){ return []; } }
function saveRoutes(list){ try{ localStorage.setItem(routesKey(), JSON.stringify(list)); }catch(e){ toast("Opslaan lukte niet. Is het geheugen vol?"); } }
// elke route kan als reeks punten bewaard worden
function currentWps(){
  if(S.wps.length) return wpsOut();
  if(S.from == null || (S.to == null && !S.target)) return [];
  const out = [["n", S.from]];
  if(S.via != null) out.push(["n", S.via]);
  if(S.target) out.push(["p", S.target.e.i]); else if(S.to !== S.from || S.via != null) out.push(["n", S.to]);
  return out;
}
function renderRoutes(){
  if(!S.area) return;
  const list = loadRoutes();
  $("mrCount").textContent = list.length ? list.length : "";
  $("mrSave").disabled = !S.path?.length;
  $("mrList").innerHTML = list.map((r, i) => `<li><button type="button" class="mr-open" data-i="${i}"><b>${esc(r.name)}</b><small>${r.n} punten · ${fmt(r.min)} · ${r.km.toFixed(1).replace(".", ",")} km piste</small></button>
    <button type="button" class="icon-btn" data-del="${i}" title="Verwijderen" aria-label="${esc(r.name)} verwijderen"><svg class="ic"><use href="#i-trash"/></svg></button></li>`).join("")
    || `<li class="empty" style="display:block;font-size:13px">Nog geen routes bewaard. Teken of plan een route en bewaar hem hier.</li>`;
  $("mrList").querySelectorAll(".mr-open").forEach(b => b.onclick = () => {
    const r = loadRoutes()[+b.dataset.i]; if(!r) return;
    if(S.draw) stopDraw();
    S.wps = wpsIn(r.wps); S.target = null; S.via = null; S.planBy = null; S.fromMe = false;
    update(); fitRoute(); toast(`Route "${r.name}" geladen.`);
    if(window.innerWidth < 900) setSheet(false);
  });
  $("mrList").querySelectorAll("[data-del]").forEach(b => b.onclick = () => {
    const list = loadRoutes(), [r] = list.splice(+b.dataset.del, 1);
    saveRoutes(list); renderRoutes(); toast(`"${r.name}" verwijderd.`);
  });
}
$("mrSave").onclick = () => {
  const wps = currentWps();
  if(!S.path?.length || wps.length < 2){ toast("Teken of plan eerst een route."); return; }
  const name = $("mrName").value.trim() || `Route ${new Date().toLocaleDateString("nl-NL", {day:"numeric", month:"short"})}`;
  const list = loadRoutes();
  list.unshift({name, wps, n:wps.length, ts:Date.now(), min:S.path.reduce((t, x) => t + x.min, 0),
                km:S.path.filter(x => x.e.t==="r").reduce((t, x) => t + x.e.len, 0)/1000});
  saveRoutes(list.slice(0, 30)); $("mrName").value = ""; renderRoutes(); toast(`Route "${name}" bewaard.`);
};
$("myRoutes").addEventListener("toggle", renderRoutes);

// ================= openingstijden =================
$("liftOpen").value = S.liftOpen; $("liftClose").value = S.liftClose;
$("liftOpen").onchange = e => { if(e.target.value){ S.liftOpen = e.target.value; save(); update(); } };
$("liftClose").onchange = e => { if(e.target.value){ S.liftClose = e.target.value; save(); update(); } };

// ================= start =================
if("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
applyBase(); update(); setPeek();
(async () => {
  try{ const r = await fetch("data/index.json"); if(!r.ok) throw new Error(r.status); S.index = await r.json(); }
  catch(e){ hideSplash(); $("areaStats").textContent = "Lijst kon niet laden. Herlaad de app."; return; }
  renderCountries();
  parseShareHash();
  const want = location.hash.slice(1).split("/")[0], byName = n => S.index.find(r => r[1].startsWith(n))?.[0];
  const start = [want, S.last, byName("Silvretta Arena")].find(id => id && S.index.some(r => r[0]===id));
  await openArea(start || S.index[0][0]);
  if(G.pending && G.pending !== G.code){
    const code = G.pending; G.pending = null;
    if(G.code) gLeave();
    openGroup(); $("gCode").value = code;
    if(G.name){ $("gName").value = G.name; gStart(code); toast(`Je doet mee met groep ${code}.`); }
    else toast("Vul je naam in en tik op Meedoen.", 3500);
  } else if(G.code){ gConnect(); drawMembers(); if(G.sharePos && S.watch == null) startWatch(); }
  try{ history.replaceState(null, "", "#" + S.area.id); }catch(e){}
})();
