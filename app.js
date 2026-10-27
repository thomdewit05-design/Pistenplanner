"use strict";
const $ = id => document.getElementById(id);
const COUNTRY = {AT:"Oostenrijk", CH:"Zwitserland", FR:"Frankrijk", IT:"Italië", DE:"Duitsland", SI:"Slovenië", LI:"Liechtenstein", MC:"Monaco",
                 ES:"Spanje", AD:"Andorra", NO:"Noorwegen", SE:"Zweden", FI:"Finland", US:"Verenigde Staten", CA:"Canada"};
const REGIONS = [["alpen","Alpen"], ["pyreneeen","Pyreneeën"], ["scandinavie","Scandinavië"], ["noord-amerika","Noord-Amerika"]];
const regionName = r => (REGIONS.find(x => x[0] === r) || [, "Alpen"])[1];
const DIFF = {g:{nl:"groen",adj:"groene",lvl:1,spd:200,pen:1,col:"#22984A"}, b:{nl:"blauw",adj:"blauwe",lvl:1,spd:283,pen:1,col:"#1E66CC"},
              r:{nl:"rood",adj:"rode",lvl:2,spd:350,pen:1.8,col:"#D22E2E"}, s:{nl:"zwart",adj:"zwarte",lvl:3,spd:317,pen:3.5,col:"#121417"},
              f:{nl:"skiroute",adj:"skiroute",lvl:4,spd:250,pen:4,col:"#E08A1E"}, u:{nl:"onbekend",adj:"ongemarkeerde",lvl:2,spd:300,pen:1.8,col:"#8C99A6"},
              // Noord-Amerika: blauw vierkant is gemiddeld (zoals rood bij ons), dubbel zwart is expert
              B:{nl:"blauw (gemiddeld)",adj:"blauwe",lvl:2,spd:340,pen:1.8,col:"#1E66CC"}, x:{nl:"dubbel zwart",adj:"dubbelzwarte",lvl:3,spd:300,pen:4,col:"#121417"}};
const isDark = d => d === "s" || d === "x";
// eigenschappen van een piste: code -> [tekst, icoon]
const FLAG = {g:["Geprepareerd","check"], m:["Buckelpiste","warn"], b:["Niet geprepareerd","warn"], l:["Verlicht","moon"], s:["Kunstsneeuw","snow"], w:["Bospiste","tree"]};
const flagsOf = ids => { const f = new Set(); ids.forEach(i => (S.area.edges[i].f || "").split("").forEach(x => f.add(x))); return [...f].filter(x => FLAG[x]).sort((a, b) => "mbwlsg".indexOf(a) - "mbwlsg".indexOf(b)); };
const flagChips = fl => fl.length ? `<div class="flags">${fl.map(x => `<span class="flag f-${x}">${I(FLAG[x][1])}${FLAG[x][0]}</span>`).join("")}</div>` : "";
const LIFT = {chair_lift:"stoeltjeslift", gondola:"gondel", cable_car:"kabelbaan", "t-bar":"sleeplift", "j-bar":"sleeplift",
              platter:"schotellift", drag_lift:"sleeplift", rope_tow:"touwlift", magic_carpet:"lopende band", mixed_lift:"combibaan",
              funicular:"kabeltrein", lift:"lift"};
const DRAG = new Set(["t-bar","j-bar","platter","drag_lift","rope_tow","magic_carpet"]);
const LIFT_WAIT = 2, WALK_SPD = 60;          // min wachten per lift, m/min lopen
const OFF_ROUTE = 120;                        // m van de route af = opnieuw plannen
const ANNOUNCE_AT = 120;                      // m voor een afslag: aankondigen

const S = {index:[], cc:"", q:"", area:null, from:null, to:null, via:null, target:null, level:2, free:false, down:true, mode:"fast",
           closed:new Set(), pick:"from", path:null, steps:[], sig:"", base:"sat", pistes:true, labels:true, nums:true, hutsOn:true, region:"", voice:true, pace:1, navAwake:true, speedo:true, noDrag:false, noMogul:false, sunny:false, sunOn:false, lunch:null, night:false, liftOpen:"08:30", liftClose:"16:30", closeWarned:null, wps:[], draw:false,
           pos:null, watch:null, follow:false, fromMe:false, offCount:0, nearSort:false, navIdx:0, spoken:{step:-1, pre:-1}};
try{ const s = JSON.parse(localStorage.getItem("pistenplanner-app")||"null");
  if(s) Object.assign(S, {level:s.level??2, free:!!s.free, down:s.down??true, mode:s.mode||"fast", base:s.base||"sat",
                          pistes:s.pistes??true, labels:s.labels??true, nums:s.nums??true, hutsOn:s.hutsOn??true, voice:s.voice??true, pace:+s.pace || 1, navAwake:s.navAwake ?? true, speedo:s.speedo ?? true, noDrag:!!s.noDrag, noMogul:!!s.noMogul, sunny:!!s.sunny, sunOn:!!s.sunOn, liftOpen:s.liftOpen||"08:30", liftClose:s.liftClose||"16:30", last:s.last}); }catch(e){}
const save = () => { try{ localStorage.setItem("pistenplanner-app", JSON.stringify({level:S.level, free:S.free, down:S.down,
  mode:S.mode, base:S.base, pistes:S.pistes, labels:S.labels, nums:S.nums, hutsOn:S.hutsOn, voice:S.voice, pace:S.pace, navAwake:S.navAwake, speedo:S.speedo, noDrag:S.noDrag, noMogul:S.noMogul, sunny:S.sunny, sunOn:S.sunOn, liftOpen:S.liftOpen, liftClose:S.liftClose, last:S.area?.id})); }catch(e){} };
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
// in config.js kun je eigen tegels met een sleutel instellen (nodig voor commercieel gebruik); anders de gratis tegels
const MAPCFG = window.PP_CONFIG?.maps || {};
const tiles = (k, url, opts) => MAPCFG[k]?.url
  ? L.tileLayer(MAPCFG[k].url, {...opts, ...(MAPCFG[k].options || {}), attribution:k === "labels" ? undefined : MAPCFG.attribution || opts.attribution})
  : L.tileLayer(url, opts);
const baseLayers = {
  sat: tiles("sat", "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {maxZoom:19, maxNativeZoom:18, crossOrigin:true, attribution:ESRI}),
  topo: tiles("topo", "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
        {maxZoom:19, maxNativeZoom:17, subdomains:"abc", crossOrigin:true, attribution:"Kaart © OpenTopoMap (CC-BY-SA), © OpenStreetMap"}),
  osm: tiles("osm", "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        {maxZoom:19, crossOrigin:true, attribution:"© OpenStreetMap-bijdragers"})
};
const labelLayer = tiles("labels", "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        {maxZoom:19, maxNativeZoom:18, crossOrigin:true, pane:"labels", opacity:.95});
const canvas = L.canvas({padding:.4, tolerance:6});
const svgR = L.svg({padding:.4});
const pisteLayer = L.layerGroup().addTo(map);
map.createPane("dim").style.cssText = "z-index:405;pointer-events:none";
const dimR = L.canvas({padding:.4, pane:"dim"});
const dimLayer = L.layerGroup().addTo(map);     // pistes die je vanaf A niet kunt bereiken
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
// versie van de kaartdata: verhogen na het opnieuw bouwen van data/, zodat telefoons de nieuwe bestanden ophalen
const DATA_V = "d4";
const loadShard = n => shards[n] ??= fetch(`data/s${String(n).padStart(3,"0")}.json?${DATA_V}`).then(r => { if(!r.ok) throw new Error(r.status); return r.json(); });

function renderCountries(){
  const rc = {}; S.index.forEach(r => { const g = r[12] || "alpen"; rc[g] = (rc[g]||0)+1; });
  $("regions").innerHTML = [`<button type="button" class="chip" data-r="" aria-pressed="${!S.region}">Overal</button>`,
    ...REGIONS.filter(([k]) => rc[k]).map(([k, n]) => `<button type="button" class="chip" data-r="${k}" aria-pressed="${S.region===k}">${n} <span class="n">${rc[k]}</span></button>`)].join("");
  $("regions").querySelectorAll("button").forEach(b => b.onclick = () => { S.region = b.dataset.r; S.cc = ""; renderCountries(); renderAreas(); });
  const counts = {}; S.index.filter(r => !S.region || (r[12] || "alpen") === S.region).forEach(r => counts[r[2]] = (counts[r[2]]||0)+1);
  const ccs = Object.keys(counts).sort((a,b)=>counts[b]-counts[a]);
  $("countries").innerHTML = [`<button type="button" class="chip" data-cc="" aria-pressed="${!S.cc}">Alle landen</button>`,
    ...ccs.map(c => `<button type="button" class="chip" data-cc="${c}" aria-pressed="${S.cc===c}">${COUNTRY[c]||c} <span class="n">${counts[c]}</span></button>`)].join("");
  $("countries").querySelectorAll("button").forEach(b => b.onclick = () => { S.cc = b.dataset.cc; renderCountries(); renderAreas(); });
}
// favoriete gebieden: bovenaan de lijst, met een ster
let FAVS = []; try{ FAVS = JSON.parse(localStorage.getItem("pp-favs") || "[]"); }catch(e){}
const isFav = id => FAVS.includes(id);
function toggleFav(id){
  FAVS = isFav(id) ? FAVS.filter(x => x !== id) : [id, ...FAVS];
  try{ localStorage.setItem("pp-favs", JSON.stringify(FAVS)); }catch(e){}
  const r = S.index.find(x => x[0] === id);
  toast(isFav(id) ? `${r?.[1] || "Gebied"} staat bij je favorieten.` : `${r?.[1] || "Gebied"} is geen favoriet meer.`);
}
function areaRow(r, dist){
  return `<li><button type="button" class="area-main" data-id="${r[0]}" aria-current="${S.area?.id===r[0]}">
      <span class="cc">${r[2]}</span>
      <span><span class="nm">${esc(r[1])}</span><span class="rg">${dist != null ? `${(dist/1000).toFixed(0)} km van je · ` : ""}${r[3] ? esc(r[3]) + " · " : ""}${r[7]} liften${r[10] ? ` · ${r[9]}–${r[10]} m` : ""}</span></span>
      <span class="km">${r[6]}<small>km piste</small></span></button>
    <button type="button" class="fav${isFav(r[0]) ? " on" : ""}" data-fav="${r[0]}" aria-pressed="${isFav(r[0])}" aria-label="${isFav(r[0]) ? "Uit favorieten halen" : "Als favoriet bewaren"}: ${esc(r[1])}"><svg class="ic"><use href="#i-star"/></svg></button></li>`;
}
function renderAreas(){
  const q = norm(S.q.trim());
  let rows = S.index.filter(r => (!S.cc || r[2]===S.cc) && (!S.region || (r[12] || "alpen") === S.region) && (!q || norm(r[1]+" "+r[3]).includes(q)));
  const dist = r => S.pos ? meters(S.pos.lat, S.pos.lon, r[5], r[4]) : null;
  rows.sort(S.nearSort && S.pos ? (a,b) => dist(a)-dist(b) : (a,b) => b[6]-a[6]);
  const favRows = !q && !S.nearSort ? FAVS.map(id => S.index.find(r => r[0] === id)).filter(Boolean) : [];
  if(favRows.length) rows = rows.filter(r => !isFav(r[0]));
  const shown = rows.slice(0, 80);
  $("areas").innerHTML = (favRows.length ? `<li class="area-sep">Favorieten</li>` + favRows.map(r => areaRow(r, S.nearSort ? dist(r) : null)).join("") + `<li class="area-sep">Alle skigebieden</li>` : "")
    + (shown.map(r => areaRow(r, S.nearSort ? dist(r) : null)).join("") || `<li class="empty" style="padding:16px 6px">Geen skigebied gevonden${S.q ? ` voor "${esc(S.q)}"` : ""}.</li>`);
  const total = rows.length + favRows.length;
  $("count").textContent = rows.length > shown.length ? `${shown.length + favRows.length} van ${total} getoond. Typ om te zoeken.` : `${total} skigebieden`;
  $("areas").querySelectorAll(".area-main").forEach(b => b.onclick = () => { closePicker(); openArea(b.dataset.id); });
  $("areas").querySelectorAll(".fav").forEach(b => b.onclick = () => { toggleFav(b.dataset.fav); renderAreas(); });
  markOfflineAreas();
}
// advertenties alleen in schermen als de kiezer, het dagboek en het menu; nooit tijdens het navigeren
const fillAds = id => { if(!S.follow) window.ppAds?.fill($(id)); };
function openPicker(){ $("picker").hidden = false; renderAreas(); setTimeout(() => $("q").focus(), 50); fillAds("picker"); }
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
    // land per piste/lift (leeg = hetzelfde land als het skigebied)
    if(e[0]==="r") edges.push({t:"r", a:e[1], b:e[2], name:nm, ref, diff:e[5], len:e[6], drop:e[7], pts:geo(e[8]), cc:e[9] || row[2], f:e[10] || ""});
    else edges.push({t:"l", a:e[1], b:e[2], name:nm, ref, kind:e[5], len:e[6], dur:e[7], pts:geo(e[8]), down:!!e[9], cc:e[10] || row[2]});
  }
  const huts = (raw.h || []).map(h => ({lat:h[1]/1e5, lon:h[0]/1e5, kind:h[2], name:raw.t[h[3]] || "", node:h[4]})).filter(h => nodes[h.node]);
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
  const litNodes = new Set(); edges.forEach(e => { if(e.t==="r" && e.f.includes("l")){ litNodes.add(e.a); litNodes.add(e.b); } });
  const nightLifts = new Set(edges.filter(e => e.t==="l" && (litNodes.has(e.a) || litNodes.has(e.b))).map(e => e.i));
  Object.assign(S.area, {groups, groupKeys:[...groups.keys()].sort(), huts, litNodes, nightLifts, litKm:edges.filter(e => e.t==="r" && e.f.includes("l")).reduce((t, e) => t + e.len, 0)/1000});
  huts.forEach(hh => { if(hh.name){ const lab = `${HUT_KIND[hh.kind]?.[0] || "Restaurant"}: ${hh.name}`; if(!names.has(lab)) names.set(lab, hh.node); } });
  S.risk = null; S.wps = [];
  if(S.night && !litNodes.size) setTimeout(() => toast("In dit gebied zijn geen verlichte pistes bekend.", 3500), 800);
  if(S.draw){ S.draw = false; document.body.classList.remove("drawing"); $("drawBtn").classList.remove("drawing"); $("drawBar").hidden = true; }
  loadStatus(); applyPendingShare();
  S.target = null; S.via = null;
  $("places").innerHTML = [...skiNames.keys(), ...names.keys()].sort((a,b)=>a.localeCompare(b,"nl")).map(s => `<option value="${esc(tr(s))}"></option>`).join("");
  S.area.statsTxt = `${COUNTRY[row[2]]||row[2]} · ${row[6]} km piste · ${row[7]} liften`;
  $("brandRegion").textContent = regionName(row[12]);
  $("areaStats").textContent = S.area.statsTxt;
  drawPistes(); buildNumbers(); drawHuts(); loadHuts();
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
  loadWeather(); widgetArea();
}
// ---- widgets op het beginscherm (iOS-app) ----
// de app geeft het skigebied en de skidag door; het weer haalt de widget zelf op, zodat hij ook bijblijft als de app dicht is
function widgetSet(key, val){
  const cap = window.Capacitor;
  if(window.PP_STORE !== "ios" || !cap?.nativePromise) return;
  cap.nativePromise("Widget", "set", {key, value:JSON.stringify(val)}).catch(() => {});
}
function widgetArea(){
  const r = S.area?.row; if(!r) return;
  widgetSet("area", {id:r[0], name:r[1], lat:r[5], lon:r[4], hi:r[10] ?? 2400, lo:r[9] ?? 1200, open:S.liftOpen, close:S.liftClose, lang:LANG});
}
let widgetDayT = 0;
function widgetDay(day, sum, force){
  if(!day || !sum || sum.n < 2 || sum.km < .05 || (!force && Date.now() - widgetDayT < 60e3)) return;
  widgetDayT = Date.now();
  widgetSet("day", {date:day.date, area:day.areaName || "", km:+sum.km.toFixed(1), hm:Math.round(sum.hm), runs:sum.runs, lifts:sum.lifts, vmax:Math.round(sum.vmax), lang:LANG});
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
    const dark = S.night && (e.t==="r" ? !e.f.includes("l") : !A.nightLifts.has(e.i));
    const k = S.closed.has(e.i) ? "closed" : dark ? "dim" : e.t==="r" ? "r_"+e.diff : (DRAG.has(e.kind) ? "drag" : "lift");
    (groups[k] ||= []).push(e.pts);
  }
  const runs = Object.keys(groups).filter(k => k.startsWith("r_")).flatMap(k => groups[k]);
  const opt = (o) => ({renderer:canvas, interactive:false, lineCap:"round", lineJoin:"round", ...o});
  if(groups.dim) L.polyline(groups.dim, opt({color:"#8C99A6", weight:2, opacity:.45, dashArray:"3 5"})).addTo(pisteLayer);
  if(S.night && runs.length) L.polyline(runs, opt({color:"#FFE680", weight:13, opacity:.45})).addTo(pisteLayer);   // lichtgloed
  if(runs.length) L.polyline(runs, opt({color:"#ffffff", weight:6, opacity:.55})).addTo(pisteLayer);
  for(const k of ["r_u","r_f","r_g","r_b","r_B","r_r","r_s","r_x"]){
    if(!groups[k]) continue; const d = k.slice(2);
    L.polyline(groups[k], opt({color:DIFF[d].col, weight:d==="u"?2.5:d==="x"?4.2:3.2, opacity:.95, dashArray:d==="f"?"7 5":null})).addTo(pisteLayer);
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
  drawSun();
}
// paneel opzij: op een groot scherm, of op een liggende telefoon
const SIDE_MQ = matchMedia("(min-width:900px), (orientation:landscape) and (max-height:500px)");
const LAND_MQ = matchMedia("(orientation:landscape) and (max-height:500px)");
const isSide = () => SIDE_MQ.matches;
const sheetPad = () => LAND_MQ.matches ? {paddingTopLeft:[$("sheet").offsetWidth + 24, 64], paddingBottomRight:[16, 64]}
  : isSide() ? {paddingTopLeft:[430, 80], paddingBottomRight:[70, 30]}
                                                 : {paddingTopLeft:[20, 80], paddingBottomRight:[70, sheetPeek() + 20]};
function fitArea(instant){ if(S.area) map.fitBounds(S.area.bounds, {...sheetPad(), maxZoom:16, animate:!instant}); }
function fitRoute(){
  if(!S.path || !S.path.length) return fitArea();
  map.fitBounds(L.latLngBounds(S.path.flatMap(s => s.e.pts)), {...sheetPad(), maxZoom:17});
}
// opvouwbare iPhone open of dicht, telefoon gedraaid: na een flinke verandering in breedte de kaart opnieuw passend maken
// (alleen de breedte, zodat het toetsenbord niets laat verspringen; tijdens navigeren volgt de kaart je positie al)
let fitW = innerWidth, fitT = null;
addEventListener("resize", () => {
  clearTimeout(fitT);
  fitT = setTimeout(() => {
    const changed = Math.abs(innerWidth - fitW) > 80; fitW = innerWidth;
    if(!changed || !S.area || S.follow) return;
    map.invalidateSize(); fitRoute();
  }, 250);
});

// ================= routeplanning =================
// bias: randen die de route zeker moet nemen (de gekozen piste); die krijgen voorrang en mogen ook boven je niveau
// RELAX: lukt het niet binnen je instellingen, dan stap voor stap ruimer zoeken
//   1 = ook met de lift omlaag en langere stukjes lopen, 2 = ook pistes één niveau hoger, 3 = alles (ook skiroutes)
let RELAX = 0;
const overLevel = e => { const lv = DIFF[e.diff].lvl; return lv===4 ? !S.free : lv > S.level; };
function graph(bias){
  const A = S.area, out = A.nodes.map(() => []), R = RELAX, sun = S.sunny && !S.night ? sunShade() : null;
  for(const e of A.edges){
    if(S.closed.has(e.i)) continue;
    const k = bias?.has(e.i) ? .05 : 1;
    if(e.t==="r"){
      const lv = DIFF[e.diff].lvl, over = k===1 && overLevel(e);
      if(over && !(R >= 3 || (R >= 2 && lv !== 4 && lv <= S.level + 1))) continue;
      if(S.night && k===1 && !e.f.includes("l")) continue;          // avondskiën: alleen verlichte pistes
      const m = e.len / (DIFF[e.diff].spd * S.pace);
      const avoid = (S.noMogul && e.f.includes("m") ? 3 : 1) * (over ? (lv===4 ? 6 : 3) : 1)   // buckelpiste vermijden, boven je niveau alleen als het moet
                  * (sun && sun.alt > 2 && sun.v[e.i] < SUN_MIN ? 2.5 : 1);                    // zon opzoeken: schaduwpistes liever niet
      out[e.a].push({to:e.b, e, rev:false, min:m, cost:k * avoid * (S.mode==="easy" ? m*DIFF[e.diff].pen : m)});
    } else if(e.t==="l"){
      if(S.night && k===1 && !A.nightLifts.has(e.i)) continue;   // 's avonds alleen liften bij verlichte pistes
      const m = e.dur/60 + LIFT_WAIT;
      const avoid = S.noDrag && DRAG.has(e.kind) ? 4 : 1;          // sleeplift vermijden: alleen als het niet anders kan
      out[e.a].push({to:e.b, e, rev:false, min:m, cost:k*m*avoid + (avoid > 1 ? 5 : 0)});
      // met de lift naar beneden kan, maar skiën heeft de voorkeur
      if(e.down && (S.down || R >= 1)) out[e.b].push({to:e.a, e, rev:true, min:m, cost:m*1.5 + 10});
    } else {
      if(e.extra && R < 1) continue;
      const m = e.len / WALK_SPD + .5 + (e.climb || 0) / 10, c = m * (e.extra ? 3 : 1.5);
      out[e.a].push({to:e.b, e, rev:false, min:m, cost:c}); out[e.b].push({to:e.a, e, rev:true, min:m, cost:c});
    }
  }
  return out;
}
// extra loopstukjes tot 250 m tussen punten die in de kaart net niet op elkaar aansluiten
function addLongWalks(){
  const A = S.area; if(A.longWalks) return; A.longWalks = true;
  const N = A.nodes, MAX = 250, cell = .0025, near = new Set(), grid = new Map();
  for(const e of A.edges){ near.add(e.a + "," + e.b); near.add(e.b + "," + e.a); }
  N.forEach((p, i) => { const k = Math.floor(p.lat/cell) + "," + Math.floor(p.lon/cell); (grid.get(k) || grid.set(k, []).get(k)).push(i); });
  const add = [];
  N.forEach((p, i) => {
    const gy = Math.floor(p.lat/cell), gx = Math.floor(p.lon/cell), c = [];
    for(let dy = -1; dy <= 1; dy++) for(let dx = -2; dx <= 2; dx++) for(const j of grid.get((gy+dy) + "," + (gx+dx)) || []){
      if(j <= i || near.has(i + "," + j)) continue;
      const d = meters(p.lat, p.lon, N[j].lat, N[j].lon), up = Math.abs((N[j].ele ?? 0) - (p.ele ?? 0));
      if(d <= MAX && up <= 60) c.push([j, d + up*8, d, up]);     // klimmen telt zwaar mee
    }
    c.sort((x, y) => x[1] - y[1]).slice(0, 3).forEach(([j, , d, up]) => add.push([i, j, d, up]));
  });
  for(const [a, b, len, up] of add) A.edges.push({t:"w", extra:true, a, b, len:Math.round(len), climb:up, i:A.edges.length, pts:[[N[a].lat, N[a].lon], [N[b].lat, N[b].lon]]});
}
// alles wat je vanaf punt a kunt bereiken (afstand per knooppunt)
const reachFrom = a => dijkstra(a, null, graph()).dist;
// lukt het helemaal niet: het bereikbare punt dat het dichtst bij b ligt (zo ruim mogelijk gezocht)
function nearestReachable(a, b){
  if(a==null || b==null) return null;
  addLongWalks(); RELAX = 3;
  let dist; try{ dist = reachFrom(a); } finally{ RELAX = 0; }
  const N = S.area.nodes; let best = null;
  dist.forEach((d, n) => { if(d < Infinity && n !== a){ const m = meters(N[n].lat, N[n].lon, N[b].lat, N[b].lon); if(!best || m < best.d) best = {n, d:m}; } });
  return best;
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
  S.relax = 0;
  for(let r = 0; r <= 3; r++){
    if(r === 1) addLongWalks();
    RELAX = r;
    try{ const p = pathNow(); if(p){ S.relax = r; return p; } } finally{ RELAX = 0; }
  }
  return null;
}
function pathNow(){
  let legs;
  if(S.wps.length) legs = wpLegs();
  else {
    if(S.from==null) return null;
    legs = S.target ? [[S.from, S.target.start], [S.target.start, S.target.end, new Set(S.target.edges)]]
         : S.to==null ? null
         : S.via!=null ? [[S.from, S.via], [S.via, S.to]] : [[S.from, S.to]];
    if(!legs) return null;
  }
  S.lunchAt = null;
  if(S.lunch && legs.length && S.area.nodes[S.lunch.n]) return withLunch(legs);
  const path = [];
  for(const [a, b, bias] of legs){ const p = shortest(a, b, bias); if(!p) return null; path.push(...p); }
  return path;
}
// lunchstop: de hut op de plek in de route waar hij het minste omweg kost; je eindbestemming blijft hetzelfde
function withLunch(legs){
  const h = S.lunch.n, parts = legs.map(([a, b, bias]) => shortest(a, b, bias));
  if(parts.some(p => !p)) return null;
  const cost = p => p.reduce((t, x) => t + x.cost, 0), all = parts.reduce((t, p) => t + cost(p), 0);
  let best = null;
  legs.forEach(([a, b, bias], i) => {
    if(bias) return;
    const p1 = shortest(a, h), p2 = p1 && shortest(h, b); if(!p2) return;
    const c = all - cost(parts[i]) + cost(p1) + cost(p2);
    if(!best || c < best.c) best = {c, path:[...parts.slice(0, i).flat(), ...p1, ...p2, ...parts.slice(i+1).flat()], at:parts.slice(0, i).flat().length + p1.length};
  });
  if(!best) return null;
  S.lunchAt = best.at;
  return best.path;
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
  S.target = null; S.via = null; S.wps = []; S.lunch = null;
  if(!best){ S.from = S.to = null; return; }
  S.from = best.a;
  // hoogste bergstation vanwaar je weer terug kunt naar het begin
  const tops = [...new Set(lifts.map(e => e.b))].filter(n => best.dist[n] < Infinity && n !== best.a)
    .sort((x, y) => (nodes[y].ele ?? -1) - (nodes[x].ele ?? -1));
  if(!tops.length){ S.to = null; return; }
  // terug zonder met de lift naar beneden te gaan, zodat het rondje echt over pistes gaat
  const down = S.down; S.down = false; const skiOnly = graph(); S.down = down;
  const loops = [];
  for(const top of tops.slice(0, 25)){
    if(dijkstra(top, best.a, skiOnly).dist[best.a] < Infinity){ loops.push(top); if(!S.sunny || S.night || loops.length >= 8) break; }
  }
  if(loops.length){
    // zon opzoeken: van de hoge toppen (tot 400 m lager dan de hoogste) het rondje met de meeste zon
    let pick = loops[0];
    if(loops.length > 1){
      const sun = sunShade(), hiE = nodes[loops[0]].ele ?? 0; let most = -1;
      for(const top of loops){
        if((nodes[top].ele ?? 0) < hiE - 400) continue;
        S.via = top; S.to = best.a; const p = pathNow(); if(!p) continue;
        const runs = p.filter(x => x.e.t === "r"), all = runs.reduce((t, x) => t + x.e.len, 0);
        const lit = runs.filter(x => sun.v[x.e.i] >= SUN_MIN).reduce((t, x) => t + x.e.len, 0) / (all || 1);
        if(lit > most){ most = lit; pick = top; }
      }
    }
    S.via = pick; S.to = best.a; return;
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
const km = m => m >= 1000 ? (m/1000).toFixed(1).replace(".", DEC)+" km" : Math.round(m/10)*10+" m";
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
      st.cls = "run d-" + e.diff; st.color = DIFF[e.diff].col;
      st.node = `<span class="node${isDark(e.diff) ? " dark" : ""}">${esc(e.ref) || I("ski")}</span>`;
      st.turn = prev && prev.t!=="l" ? turnBetween(prev, st) : null;
      st.icon = st.turn ? TURN_ICON[st.turn] : "straight";
      const what = pisteLabel(e);
      st.title = st.turn && st.turn !== "rechtdoor" ? `${uc(st.turn)} naar ${what}` : `Volg ${what}`;
      const drop = st.items.reduce((s, x) => s + Math.max(0, x.e.drop||0), 0);
      const fl = flagsOf(st.items.map(x => x.e.i)).filter(x => "mbw".includes(x)).map(x => FLAG[x][0].toLowerCase());
      st.sub = `${uc(DIFF[e.diff].nl)} · ${km(st.len)}${drop > 20 ? ` · ${Math.round(drop)} hm` : ""}${fl.length ? " · " + fl.join(" · ") : ""} · tot ${lc(nodeLabel(st.end))}`;
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
  if(document.activeElement !== $("from")) $("from").value = tr(S.from!=null ? (S.fromMe ? "Mijn locatie (" + lc(nodeLabel(S.from)) + ")" : nodeLabel(S.from)) : "");
  if(document.activeElement !== $("to")) $("to").value = tr(S.wps.length ? `Getekende route · ${S.wps.length} ${S.wps.length===1 ? "punt" : "punten"}` : S.target ? `Skiën: ${S.target.label}`
    : S.to!=null && S.to===S.from && S.via!=null ? "Terug naar het vertrekpunt" : S.to!=null ? nodeLabel(S.to) : "");
  renderExtra();

  const path = computePath();
  S.path = path; S.steps = path ? buildSteps(path) : [];
  S.lunchStep = null;
  if(path && S.lunch && S.lunchAt != null){ let c = 0, i = 0; while(i < S.steps.length && c < S.lunchAt){ c += S.steps[i].items.length; i++; } S.lunchStep = i; }
  const sig = (path||[]).map(s => s.e.i).join(",");
  if(sig !== S.sig){ S.sig = sig; S.navIdx = 0; S.spoken = {step:-1, pre:-1}; }
  routeLayer.clearLayers(); markLayer.clearLayers();
  drawDim(); drawHome();
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
  if(S.lunch && S.lunchStep != null){ const p = A.nodes[S.lunch.n];
    L.marker([p.lat, p.lon], {icon:L.divIcon({className:"", html:`<div class="pin v lunch-pin">${I("food")}</div>`, iconSize:[26,26], iconAnchor:[13,31]}), keyboard:false, interactive:false, zIndexOffset:400}).addTo(markLayer); }
  renderResult();
  renderClosed();
  updateNav();
  if(S.draw) renderDrawBar();
  if($("myRoutes").open) renderRoutes();
}
// na het kiezen van A: grijs wat je met jouw niveau en instellingen niet kunt bereiken
function drawDim(){
  dimLayer.clearLayers(); S.dimmed = false;
  if(S.from==null || S.to!=null || S.target || S.wps.length || S.draw) return;
  const out = graph(), dist = dijkstra(S.from, null, out).dist, ok = new Set();
  out.forEach((list, u) => { if(dist[u] < Infinity) for(const s of list) ok.add(s.e.i); });
  const lines = S.area.edges.filter(e => e.t !== "w" && !ok.has(e.i) && !S.closed.has(e.i)).map(e => e.pts);
  if(!lines.length) return;
  L.polyline(lines, {renderer:dimR, interactive:false, color:"#4A5560", weight:7, opacity:.75, lineCap:"round"}).addTo(dimLayer);
  S.dimmed = true;
  $("pickHint").innerHTML += ` <span class="dim-hint">Grijs valt buiten je niveau. Kies je het toch, dan zoekt de app de makkelijkste weg.</span>`;
}
function renderExtra(){
  const x = $("extra"), parts = [];
  if(S.target) parts.push(`<button type="button" class="chip route" data-k="target" title="Weghalen">${I("ski")}Skiën: ${esc(S.target.label)} · ${km(S.target.len)}<span class="x">${I("close")}</span></button>`);
  if(S.via!=null && !S.target) parts.push(`<button type="button" class="chip route" data-k="via" title="Weghalen">${I("loop")}${S.to===S.from ? "Rondje via" : "Via"} ${esc(lc(nodeLabel(S.via)))}<span class="x">${I("close")}</span></button>`);
  if(S.lunch) parts.push(`<button type="button" class="chip route lunch-chip" data-k="lunch" title="Lunchstop weghalen">${I("food")}Lunch: ${esc(S.lunch.name)}${S.lunch.eta != null && S.lunchStep != null ? ` · ${hhmm(S.lunch.eta)}` : ""}<span class="x">${I("close")}</span></button>`);
  if(S.wps.length) parts.push(`<button type="button" class="chip route" data-k="wps" title="Getekende route wissen">${I("pencil")}Getekende route · ${S.wps.length} ${S.wps.length===1 ? "punt" : "punten"}<span class="x">${I("close")}</span></button>`);
  if(S.night) parts.unshift(`<button type="button" class="chip route night-chip" data-k="night" title="Avondskiën uitzetten">${I("moon")}Avondskiën · ${NIGHT_OPEN}–${NIGHT_CLOSE}<span class="x">${I("close")}</span></button>`);
  if(S.planBy) parts.unshift(`<button type="button" class="chip route group-chip" data-k="planby" title="Niet meer tonen">${I("group")}Route van ${esc(S.planBy)}<span class="x">${I("close")}</span></button>`);
  x.innerHTML = parts.join(""); x.hidden = !parts.length;
  x.querySelectorAll("button").forEach(b => b.onclick = () => {
    if(b.dataset.k==="night"){ setNight(false); return; }
    if(b.dataset.k==="lunch"){ S.lunch = null; }
    else if(b.dataset.k==="wps"){ S.wps = []; S.to = null; if(S.draw) renderDrawBar(); }
    else if(b.dataset.k==="planby"){ S.planBy = null; } else if(b.dataset.k==="target"){ S.target = null; } else { if(S.to===S.from) S.to = S.via; S.via = null; }
    update();
  });
}

function renderResult(){
  const res = $("result"), peek = $("peek");
  if(S.from==null || S.to==null){
    res.innerHTML = `<p class="empty">Kies een vertrekpunt en een bestemming, of tik op een piste.</p>`;
    peek.innerHTML = `<div class="peek-empty"><p><b>${S.from==null ? "Geen route" : "Kies je bestemming"}</b>${S.from==null ? "Tik op de kaart op je vertrekpunt, tik een piste aan, of laat de app een rondje voorstellen." : "Tik op de kaart op je bestemming, of tik een piste aan." + (S.dimmed ? " Grijs valt buiten je niveau." : "")}</p>
      <div class="cta"><button type="button" class="btn ghost" id="suggestBtn">${I("loop")}Stel een route voor</button><button type="button" class="btn ghost" id="drawBtn2">${I("pencil")}Route tekenen</button>${homeBtnHtml(true)}</div></div>`;
    $("suggestBtn").onclick = () => { defaultRoute(); update(); fitRoute(); };
    $("homeBtn")?.addEventListener("click", goHome); $("homeSet")?.addEventListener("click", homeMenu);
    $("drawBtn2").onclick = startDraw;
    return setPeek();
  }
  if(S.wps.length && S.path && !S.path.length){ res.innerHTML = `<p class="empty">Tik het volgende punt aan om de route verder te tekenen.</p>`; peek.innerHTML = ""; return setPeek(); }
  if(S.from===S.to && S.via==null && !S.target && !S.wps.length){ res.innerHTML = `<p class="empty">Je bent al op je bestemming. Kies een andere bestemming.</p>`; peek.innerHTML = ""; return setPeek(); }
  if(!S.path){
    const tips = [];
    if(S.level < 3) tips.push("kies een hoger niveau");
    if(!S.free) tips.push("neem skiroutes mee");
    if(S.closed.size) tips.push("open een gesloten piste");
    const who = S.planBy ? `De route van ${esc(S.planBy)} is met jouw instellingen niet te halen. ` : "";
    // het punt het dichtst bij je bestemming dat je wél kunt halen
    const near = !S.wps.length && !S.target && S.via==null ? nearestReachable(S.from, S.to) : null, alt = near && near.d <= 2000 ? near : null;
    const altBtn = alt ? `<button type="button" class="btn primary" id="altBtn">${I("flag")}Naar het dichtstbijzijnde punt · ${km(alt.d)} van je bestemming</button>` : "";
    res.innerHTML = `<p class="empty"><strong>Geen route gevonden.</strong> ${who ? `<span>${who}</span> ` : ""}${S.closed.size ? "<span>Probeer een gesloten piste of lift te openen.</span> " : ""}<span>Dit deel van het skigebied is vanaf je vertrekpunt niet over pistes en liften te bereiken, bijvoorbeeld omdat je er met de skibus heen moet; die staat niet in de kaart.</span></p>`;
    peek.innerHTML = S.planBy ? `<p class="empty"><strong>Je kunt de route van ${esc(S.planBy)} niet volgen</strong> met jouw niveau of instellingen. Kies een hoger niveau, of vraag om een makkelijkere bestemming.</p>`
                              : `<div class="peek-empty"><p><b>Hier kom je niet over de piste</b>${alt ? "Wel kun je dichtbij komen." : "Kies een ander punt, of laat de app een rondje voorstellen."}</p>
                                 <div class="cta">${altBtn || `<button type="button" class="btn ghost" id="suggestBtn">${I("loop")}Stel een route voor</button>`}<button type="button" class="btn ghost" id="clearBtn">${I("close")}Route wissen</button></div></div>`;
    $("altBtn")?.addEventListener("click", () => { S.to = alt.n; update(); fitRoute(); });
    $("suggestBtn")?.addEventListener("click", () => { defaultRoute(); update(); fitRoute(); });
    $("clearBtn").onclick = clearRoute;
    return setPeek();
  }
  const path = S.path, steps = S.steps;
  const tot = path.reduce((s,x)=>s+x.min,0) + (S.lunchStep != null ? S.lunch.dur : 0), pisteM = path.filter(s=>s.e.t==="r").reduce((s,x)=>s+x.e.len,0);
  const down = path.filter(s=>s.e.t==="r").reduce((s,x)=>s+Math.max(0,x.e.drop||0),0);
  const nP = steps.filter(s=>s.t==="r").length, nL = steps.filter(s=>s.t==="l").length;
  const tm = routeTiming(), arrive = hhmm(tm.end);
  peek.innerHTML = `<div class="eta"><b>${fmt(tot)}</b><span>${(pisteM/1000).toFixed(1).replace(".", DEC)} km piste · klaar om ${arrive}</span></div>
    <div class="stats"><span class="stat">${I("ski")}${nP} pistes</span><span class="stat">${I("lift")}${nL} liften</span><span class="stat">${Math.round(down).toLocaleString(LOCALE)} hm dalen</span>${S.relax ? `<span class="stat off">${I("warn")}${path.some(x => x.e.t==="r" && overLevel(x.e)) ? "Boven je niveau" : "Buiten je instellingen"}</span>` : ""}</div>
    <div class="cta">${S.follow ? `<button type="button" class="btn stop" id="goBtn">${I("stop")}Navigatie stoppen</button>`
                               : `<button type="button" class="btn primary" id="goBtn">${I("play")}Start navigatie</button>${G.code ? `<button type="button" class="btn ghost" id="goAllBtn">${I("group")}Start voor iedereen</button>` : ""}`}
      <button type="button" class="btn ghost" id="valleyBtn" title="Snelste weg naar het dal">${I("down")}Naar het dal</button>
      ${homeBtnHtml()}<button type="button" class="btn ghost" id="clearBtn" title="Route stoppen en van de kaart halen">${I("close")}Route wissen</button>${G.code ? `<button type="button" class="btn ghost" id="gSendBtn" title="Stuur deze route naar je groep" aria-label="Stuur deze route naar je groep">${I("send")}</button>` : ""}</div>`;
  $("goBtn").onclick = toggleFollow;
  $("valleyBtn").onclick = toValley;
  $("clearBtn").onclick = clearRoute;
  $("homeBtn")?.addEventListener("click", goHome);
  $("gSendBtn")?.addEventListener("click", sendPlan);
  $("goAllBtn")?.addEventListener("click", startAll);
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
  // ruimer gezocht: vertel wat er buiten je instellingen valt
  if(S.relax){
    const over = steps.filter(s => s.t==="r" && s.items.some(x => overLevel(x.e) && !S.target?.edges.includes(x.e.i)));
    const downs = path.filter(s => s.rev && s.e.t==="l").length, walk = path.filter(s => s.e.extra).reduce((t, s) => t + s.e.len, 0);
    const bits = [];
    if(over.length) bits.push(over.length === 1 ? `één ${over[0].e.diff==="f" ? "skiroute" : DIFF[over[0].e.diff].adj + " piste"} boven je niveau` : `${over.length} pistes boven je niveau`);
    if(downs && !S.down) bits.push(downs === 1 ? "één keer met de lift naar beneden" : `${downs} keer met de lift naar beneden`);
    if(walk) bits.push(`${Math.round(walk/10)*10} m lopen`);
    if(bits.length) warn = `<p class="notice ${over.length ? "bad" : "info"}">${I("warn")}<span><strong>Binnen je instellingen kon het niet.</strong> Deze route gaat via ${bits.join(" en ")}.</span></p>` + warn;
  }
  const lastWp = S.wps[S.wps.length-1];
  const home = getHome(), atHome = home && S.to === homeNode();
  const homeWalk = atHome ? meters(home.lat, home.lon, S.area.nodes[S.to].lat, S.area.nodes[S.to].lon) : 0;
  const lunchLi = () => `<li class="lunch"><span class="node">${I("food")}</span><div class="st-body"><div class="st-title"><span>Lunch bij ${esc(S.lunch.name)}</span></div><div class="st-sub">Rond ${hhmm(S.lunch.eta)} · ${S.lunch.dur} min pauze</div></div><div class="st-right"><span class="st-time">${fmt(S.lunch.dur)}</span></div></li>`;
  const endLabel = atHome ? (home.kind === "auto" ? "Bij je auto" : "Bij je hotel") : lastWp ? (lastWp.k === "p" ? `Einde ${lastWp.ch.label}` : nodeLabel(S.to)) : S.target ? `Einde ${S.target.label}` : S.to===S.from && S.via!=null ? "Terug bij je vertrekpunt" : nodeLabel(S.to);
  res.innerHTML = warn + profileHtml() + (S.lunch ? "" : `<div class="lunch-box" id="lunchBox"><button type="button" class="btn ghost" id="lunchAdd">${I("food")}Lunchstop toevoegen</button></div>`)
    + `<div class="route-head"><p class="label">Routebeschrijving</p><span>${steps.length} stappen</span></div><ol class="steps">`
    + steps.map((s, i) => (i === S.lunchStep ? lunchLi() : "") + `<li data-i="${i}" class="${s.cls}" style="${s.color ? `--c:${s.color}` : ""}">${s.node}
      <div class="st-body"><div class="st-title">${s.t==="r" && s.turn && s.turn!=="rechtdoor" ? I(s.icon) : ""}<span>${esc(s.title)}</span></div><div class="st-sub">${esc(s.sub)}</div>${s.late ? `<span class="late-tag">${I("clock")}Om ${hhmm(s.eta)}, na sluitingstijd</span>` : ""}${s.t==="l" && S.risk?.lifts.has(s.e.i) ? `<span class="risk-chip">${I("wind")}Mogelijk dicht door wind</span>` : ""}${S.relax && s.t==="r" && s.items.some(x => overLevel(x.e)) ? `<span class="risk-chip">${I("warn")}Boven je niveau</span>` : ""}</div>
      <div class="st-right"><span class="st-time">${fmt(s.min)}</span>${s.t!=="w" ? `<button type="button" class="close-btn" data-i="${i}" title="Afsluiten en omrijden" aria-label="${s.t==="l" ? "Lift" : "Piste"} afsluiten">${I("ban")}</button>` : ""}</div></li>`).join("")
    + (S.lunchStep === steps.length ? lunchLi() : "")
    + `<li class="end"><span class="node">${atHome ? I(home.kind === "auto" ? "car" : "bed") : I("flag")}</span><div class="st-body"><div class="st-title"><span>${esc(endLabel)}</span></div><div class="st-sub">Aankomst rond ${arrive}</div>${homeWalk > 40 ? `<div class="st-sub">Daarna nog ${km(homeWalk)} lopen</div>` : ""}</div><span></span></li></ol>`;
  $("lunchAdd")?.addEventListener("click", lunchForm);
  if(S.lunch) renderExtra();   // de lunchtijd is nu bekend
  $("valley2")?.addEventListener("click", toValley);
  bindProfile();
  $("openStatus2")?.addEventListener("click", openStatus);
  res.querySelectorAll("li[data-i]").forEach(li => li.onclick = ev => {
    if(ev.target.closest(".close-btn")) return;
    const s = steps[+li.dataset.i]; map.fitBounds(L.latLngBounds(s.line), {...sheetPad(), maxZoom:17});
    if(!isSide()) setSheet(false);
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
  if(S.pickHome){ setHome(ev.latlng.lat, ev.latlng.lng, S.pickHome); return; }
  const A = S.area, p0 = map.latLngToContainerPoint(ev.latlng);
  let bn = -1, bd = Infinity; const cands = [];
  A.nodes.forEach((n, i) => { const d = p0.distanceTo(map.latLngToContainerPoint([n.lat, n.lon])); if(d < bd){ bd = d; bn = i; } if(d <= 36) cands.push([i, d]); });
  // liggen er meer punten onder je vinger: neem het dichtstbijzijnde dat je vanaf het vorige punt kunt bereiken
  const prevPt = S.draw ? (S.wps.length ? wpEnd(S.wps[S.wps.length-1]) : S.fromMe && S.pos ? S.from : null) : S.pick==="to" ? S.from : null;
  if(prevPt != null && cands.length > 1){
    const reach = reachFrom(prevPt), ok = cands.filter(([i]) => reach[i] < Infinity && i !== prevPt).sort((x, y) => x[1] - y[1])[0];
    if(ok) bn = ok[0];
  }
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
                             : `<span class="node${isDark(e.diff) ? " dark" : ""}" style="--c:${DIFF[e.diff].col}">${esc(e.ref) || I("ski")}</span>`;
  const mins = ch.kind==="l" ? e.dur/60 : ch.len / DIFF[e.diff].spd;
  const top = ch.kind==="l" ? A.nodes[ch.end].ele : A.nodes[ch.start].ele;
  div.innerHTML = `<div class="pop-head">${node}<div><b>${esc(uc(ch.label))}</b><small>${ch.kind==="l" ? uc(LIFT[e.kind]||"lift") : e.diff==="f" ? "Skiroute" : `${uc(DIFF[e.diff].adj)} piste`}</small></div></div>
    ${ch.kind==="r" ? flagChips(flagsOf(ch.edges)) + sunNote(ch.edges) : ""}
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
// in de iOS-app via de KeepAwake-plug-in: daar werkt navigator.wakeLock niet op elke iOS-versie
async function keepAwake(){
  const on = (S.follow && S.navAwake) || (typeof D !== "undefined" && D.rec && D.awake);
  const cap = window.Capacitor;
  if(cap?.nativePromise && cap.isNativePlatform?.()){ try{ await cap.nativePromise("KeepAwake", on ? "keepAwake" : "allowSleep", {}); }catch(e){} return; }
  try{ if(on && "wakeLock" in navigator && !wakeLock){ wakeLock = await navigator.wakeLock.request("screen"); wakeLock.addEventListener("release", () => wakeLock = null); }
       if(!on && wakeLock){ await wakeLock.release(); wakeLock = null; } }catch(e){}
}
document.addEventListener("visibilitychange", () => { if(document.visibilityState==="visible") keepAwake(); });
function speak(text){
  if(!S.voice || !S.follow || !("speechSynthesis" in window)) return;
  try{ const u = new SpeechSynthesisUtterance(tr(text)); u.lang = SPEECH_LANG(); u.rate = 1.02;
       const v = speechSynthesis.getVoices().find(v => v.lang && v.lang.toLowerCase().startsWith(LANG)); if(v) u.voice = v;
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
  setTimeout(renderSpeedo, 0);
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
  speedOnPos(p);
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
  if(S.area && (S.fromMe || S.follow)){
    const nn = nearestNode(S.pos.lat, S.pos.lon);
    if(S.fromMe && (first || S.from == null)){ S.from = nn.n; update(); }
    // van de route af (en wel in het skigebied): opnieuw plannen vanaf waar je nu bent
    else if(S.follow && S.path && nn.d < 400 && distToRoute() > OFF_ROUTE){
      if(++S.offCount >= 2){ dropPassed(); S.fromMe = true; S.from = nn.n; S.offCount = 0; toast("Je bent van de route af. Nieuwe route berekend."); speak("Je bent van de route af. Nieuwe route berekend."); update(); }
    } else S.offCount = 0;
  }
  if(firstFix && !S.follow){ firstFix = false; map.setView(ll, Math.max(map.getZoom(), 15)); }
  if(S.follow) showAt(ll);
  updateNav();
  groupOnPos();
  diaryAdd(S.pos.lat, S.pos.lon, S.pos.acc, S.pos.alt);
  if(!$("group").hidden) renderGroup();
}
// bij opnieuw plannen: wat je al gehad hebt (de top van je rondje, de gekozen piste, getekende punten) niet nog eens
function dropPassed(){
  const seen = new Set(S.steps.slice(0, S.navIdx).flatMap(s => s.items.map(x => x.to)));
  if(S.via != null && seen.has(S.via)) S.via = null;
  if(S.target && seen.has(S.target.start)){ S.to = S.target.end; S.target = null; }
  while(S.wps.length > 1 && seen.has(wpEnd(S.wps[0]))) S.wps.shift();
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
  const arrive = new Date(Date.now() + left*60000).toLocaleTimeString(LOCALE, {hour:"2-digit", minute:"2-digit"});
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
  setTimeout(renderSpeedo, 0);
  if(S.follow){ S.follow = false; keepAwake(false); $("locBtn").classList.remove("follow"); speechSynthesis?.cancel?.(); update(); return; }
  if(!startWatch()) return;
  S.follow = true; S.spoken = {step:-1, pre:-1}; keepAwake(true); $("locBtn").classList.add("follow");
  if(!isSide()) setSheet(false);
  if(S.pos) showAt([S.pos.lat, S.pos.lon], Math.max(map.getZoom(), 16));
  else toast("Locatie zoeken…");
  update();
}
$("locBtn").onclick = () => {
  if(S.watch == null){ startWatch(); toast("Locatie zoeken…"); return; }
  if(S.pos) showAt([S.pos.lat, S.pos.lon], Math.max(map.getZoom(), 15));
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
      for(const [s, ei] of A.skiNames) if(norm(s)===v || norm(tr(s))===v){ S.target = chainFrom(ei); S.via = null; inp.blur(); update(); fitRoute(); return; }
    }
    let hit = null;
    for(const [s, n] of A.names){ const k = norm(s), kt = norm(tr(s)); if(k===v || kt===v){ hit = n; break; } if(hit==null && (k.includes(v) || kt.includes(v))) hit = n; }
    if(hit==null && key==="to") for(const [s, ei] of A.skiNames) if(norm(s).includes(v) || norm(tr(s)).includes(v)){ S.target = chainFrom(ei); S.via = null; inp.blur(); update(); fitRoute(); return; }
    if(hit==null){ toast(`Geen punt gevonden voor "${raw}".`); return; }
    S[key] = hit; if(key==="to"){ S.planBy = null; S.wps = []; }
    if(key==="from") S.fromMe = false; else { S.target = null; S.via = null; }
    inp.blur(); update();
  });
  inp.addEventListener("focus", () => { inp.select(); if(!isSide()) setSheet(true); });
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
$("layersBtn").onclick = e => { e.stopPropagation(); $("layerMenu").hidden = !$("layerMenu").hidden; if(!$("layerMenu").hidden) renderHutInfo(); };
document.addEventListener("click", e => { if(!e.target.closest("#layerMenu,#layersBtn")) $("layerMenu").hidden = true; });
document.querySelectorAll("input[name=base]").forEach(r => r.onchange = () => { S.base = r.value; applyBase(); });
$("showPistes").onchange = e => { S.pistes = e.target.checked; applyBase(); };
$("showLabels").onchange = e => { S.labels = e.target.checked; applyBase(); };
$("showNums").onchange = e => { S.nums = e.target.checked; applyBase(); };
$("showHuts").onchange = e => {
  S.hutsOn = e.target.checked; save(); drawHuts(); renderHutInfo();
  const A = S.area; if(!S.hutsOn || !A) return;
  // laten weten waarom je (nog) niets ziet
  if(A.hutState === "error" || A.hutState === "offline"){ A.hutTry = 0; loadHuts(true); }
  else if(A.hutState === "ok" && A.huts.length && map.getZoom() < 13) toast("Zoom verder in om de hutten en restaurants te zien.");
};
$("showHuts").checked = S.hutsOn;
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
const NIGHT_OPEN = "18:30", NIGHT_CLOSE = "22:00";   // gangbare tijden voor avondskiën
// wanneer ben je bij elke stap; buiten de openingstijden rekenen we vanaf de opening
function startTime(){
  const now = new Date(), nowM = now.getHours()*60 + now.getMinutes();
  const open = toMin(S.night ? NIGHT_OPEN : S.liftOpen), close = toMin(S.night ? NIGHT_CLOSE : S.liftClose);
  const planned = nowM < open || nowM >= close;
  return {t:planned ? open : nowM, planned, open, close};
}
function routeTiming(){
  const {t:t0, planned, close} = startTime();
  let t = t0, lastLift = null; const late = [];
  const lunch = i => { if(S.lunch && i === S.lunchStep){ S.lunch.eta = t; t += S.lunch.dur; } };
  S.steps.forEach((s, i) => {
    lunch(i);
    s.eta = t; s.late = s.t==="l" && t > close;
    if(s.late) late.push(i);
    if(s.t==="l" && !s.late) lastLift = t;
    t += s.min;
  });
  lunch(S.steps.length);
  return {end:t, planned, late, lastLift, close};
}
// snelste weg naar het laagste bereikbare punt (het dorp of het dal)
function toValley(){
  const A = S.area; if(!A) return;
  let from = S.from;
  if(S.pos && (S.fromMe || S.follow)) from = nearestNode(S.pos.lat, S.pos.lon).n;
  if(from==null){ toast("Kies eerst waar je nu bent (A)."); return; }
  // net als bij gewone routes: lukt het niet binnen je niveau, dan ruimer zoeken
  // hoe laag kom je überhaupt; binnen je niveau moet je in de buurt van zo'n dal komen, anders ruimer zoeken
  const ele = n => A.nodes[n].ele ?? 9999, low = d => { let m = 9999; d.forEach((x, n) => { if(x < Infinity && n !== from) m = Math.min(m, ele(n)); }); return m; };
  addLongWalks(); RELAX = 3; let dist; try{ dist = reachFrom(from); } finally{ RELAX = 0; }
  const lowAll = low(dist);
  for(let r = 0; r < 3; r++){
    RELAX = r; let d; try{ d = reachFrom(from); } finally{ RELAX = 0; }
    if(low(d) <= lowAll + 300){ dist = d; break; }
  }
  // laag en dichtbij: elke 100 m hoger telt als 6 minuten extra, zo kies je het eigen dorp en niet het dal aan de andere kant
  const bottom = low(dist);
  let best = null;
  dist.forEach((d, n) => {
    if(d===Infinity || n===from || ele(n) > bottom + 300) return;
    const score = d + (ele(n) - bottom) * .06;
    if(!best || score < best.score) best = {n, e:ele(n), d, score};
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
const AVALANCHE = {NO:["https://varsom.no/en/avalanche-bulletins/","Varsom lawinebericht"], SE:["https://lavinprognoser.se","Lavinprognoser"],
  US:["https://avalanche.org","avalanche.org"], CA:["https://avalanche.ca","Avalanche Canada"], AT:["https://lawinen.at","Lawinenwarndienste Österreich"], CH:["https://www.slf.ch/de/lawinenbulletin-und-schneesituation/","SLF lawinebulletin"],
  FR:["https://meteofrance.com/meteo-montagne","Météo-France bergweer"], IT:["https://bollettini.aineva.it/","AINEVA lawinebulletin"],
  DE:["https://www.lawinenwarndienst.bayern.de/","Lawinenwarndienst Bayern"], SI:["https://meteo.arso.gov.si/met/sl/avalanche/","ARSO lawinebulletin"],
  LI:["https://www.slf.ch/de/lawinenbulletin-und-schneesituation/","SLF lawinebulletin"]};
const wxCache = {};
const wxStore = id => { try{ return JSON.parse(localStorage.getItem("pp-wx:" + id) || "null"); }catch(e){ return null; } };
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
    try{ localStorage.setItem("pp-wx:" + id, JSON.stringify({t:Date.now(), d})); }catch(e){}
    if(S.area?.id === id) renderWeather(d);
  }catch(e){
    const old = wxStore(id);
    if(S.area?.id !== id) return;
    if(old && Date.now() - old.t < 36*3600e3){ wxCache[id] = {t:0, d:old.d}; renderWeather(old.d, old.t); }
    else $("wxSum").innerHTML = `${I("cloud")}<span class="wx-loading">Weer niet beschikbaar. Geen verbinding?</span>`;
  }
}
function renderWeather(d, savedAt){
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
    const name = k===0 ? "Vandaag" : k===1 ? "Morgen" : new Date(t + "T12:00").toLocaleDateString(LOCALE, {weekday:"short"});
    const sn = D.snowfall_sum[i] || 0;
    return `<div class="wx-day" title="${dt}"><b>${name}</b><svg class="ic"><use href="#i-${di}"/></svg>
      <span class="t">${deg(D.temperature_2m_max[i])} <i>${deg(D.temperature_2m_min[i])}</i></span><span class="sn">${sn >= 0.5 ? `${Math.round(sn)} cm` : ""}</span></div>`;
  }).join("");
  const av = AVALANCHE[r[2]];
  const vis = c.visibility >= 10000 ? "> 10 km" : c.visibility >= 1000 ? `${(c.visibility/1000).toFixed(1).replace(".", DEC)} km` : `${Math.round(c.visibility/10)*10} m`;
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
    <div class="wx-foot"><span>${savedAt ? `<b class="offline-tag">Offline</b> bewaard om ${new Date(savedAt).toLocaleTimeString(LOCALE, {hour:"2-digit", minute:"2-digit"})} · ` : ""}Open-Meteo · ${c.time.slice(11, 16)} uur · temperatuur top/dal: ${r[10] ?? "?"}/${r[9] ?? "?"} m</span>
      ${av ? `<a href="${av[0]}" target="_blank" rel="noopener" title="${av[1]}">${I("warn")}Lawinebericht</a>` : `<a href="https://www.avalanches.org/" target="_blank" rel="noopener">${I("warn")}Lawinebericht</a>`}</div>`;
  $("areaStats").textContent = `${A.statsTxt} · ${deg(c.temperature_2m)} top`;
  computeRisk(c, fresh);
}

// ================= SOS =================
const EMERGENCY = {US:"911", CA:"911"};   // anders 112
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
  return {txt: best.d < 40 ? `Op ${name}` : `${Math.round(best.d/10)*10} m van ${name}`, d:best.d, cc:e.cc};
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
  // land van de piste of lift waar je bent; anders het land van het skigebied
  const near = S.pos ? nearestPlace() : null;
  const cc = near && near.d < 1000 ? near.cc : S.area?.row[2], loc = RESCUE[cc], em = EMERGENCY[cc] || "112";
  $("sosMain").href = `tel:${em}`; $("sosMainNum").textContent = `Bel ${em}`;
  $("sosMainTxt").textContent = em === "112" ? "Europees alarmnummer, werkt in heel Europa" : `Alarmnummer ${COUNTRY[cc] || ""}`.trim();
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
      <div style="grid-column:1/-1"><span>Waar</span><b>${pl ? esc(pl.txt) : "Niet bij een piste of lift"}${S.area ? ` · ${esc(S.area.row[1])}` : ""}${cc && COUNTRY[cc] ? ` · ${COUNTRY[cc]}` : ""}</b></div>
    </div>`;
}
function openSos(){ $("sos").hidden = false; if(S.watch==null) startWatch(); renderSos(); clearInterval(sosTimer); sosTimer = setInterval(renderSos, 3000); }
function closeSos(){ $("sos").hidden = true; clearInterval(sosTimer); }
$("sosBtn").onclick = openSos;
$("sosClose").onclick = closeSos;
$("sosCopy").onclick = async () => {
  if(!S.pos) return;
  try{ await navigator.clipboard.writeText(tr(sosText())); toast("Locatie gekopieerd. Plak hem in een bericht."); }
  catch(e){ toast("Kopiëren lukte niet. Lees de coördinaten voor."); }
};
$("sosShare").onclick = async () => {
  if(!S.pos) return;
  if(navigator.share){ try{ await navigator.share({title:tr("Mijn locatie (noodgeval)"), text:tr(sosText())}); }catch(e){} }
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
    : `<span>Alles staat op <b>open</b>.</span> Zet dicht wat vandaag dicht is; de routes houden er rekening mee.`;
}
function renderStatus(){
  const A = S.area; if(!A) return;
  const d = new Date();
  $("statusDate").textContent = `${A.row[1]} · ${d.toLocaleDateString(LOCALE, {weekday:"long", day:"numeric", month:"long"})}`;
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
    const node = g.t==="l" ? `<span class="node liftnode">${I("lift")}</span>` : `<span class="node${g.isDark(e.diff) ? " dark" : ""}" style="--c:${DIFF[g.e.diff].col}">${esc(g.e.ref) || I("ski")}</span>`;
    const fl = g.t==="r" ? flagsOf(g.edges).filter(x => x !== "g").map(x => FLAG[x][0].toLowerCase()) : [];
    const meta = g.t==="l" ? `${uc(LIFT[g.e.kind]||"lift")} · ${km(g.len)}${g.top!=null && g.top >= 0 ? ` · tot ${g.top} m` : ""}` : `${uc(DIFF[g.e.diff].nl)} · ${km(g.len)}${fl.length ? " · " + fl.join(" · ") : ""}`;
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
  const text = `Liftstatus ${S.area.row[1]} vandaag: ${n ? `${n} ${n===1 ? "lift of piste" : "liften en pistes"} dicht` : "alles open"}. Open in Skipilot:`;
  if(navigator.share){ try{ await navigator.share({title:tr("Liftstatus vandaag"), text:tr(text), url}); }catch(e){} }
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
    let m, d; try{ m = JSON.parse(ev.data); if(m.event !== "message") return; d = JSON.parse(m.message); d.srv = m.time * 1000; }catch(e){ return; }
    if(!d || d.v !== 1 || !d.id) return;
    gHandle(d);
  };
}
function gHandle(d){
  if(d.t === "bye"){ G.members.delete(d.id); drawMembers(); renderGroup(); return; }
  if(d.id !== G.id){
    const m = G.members.get(d.id) || {id:d.id};
    m.name = String(d.name || "?").slice(0, 20); m.seen = Math.max(m.seen || 0, d.ts || 0);
    if(d.t === "pos" && (!m.posTs || d.ts > m.posTs)){ m.lat = +d.lat; m.lon = +d.lon; m.posTs = d.ts; if(d.dk != null){ m.dk = +d.dk; m.dh = +d.dh; } }
    G.members.set(d.id, m);
  }
  if(d.t === "plan" && d.ts > G.planTs){
    G.planTs = d.ts; G.plan = d;
    // bij het opnieuw verbinden komen oude berichten snel achter elkaar binnen: alleen de laatste toepassen
    clearTimeout(G.planTimer); G.planTimer = setTimeout(async () => {
      const p = G.plan; await adoptPlan(p);
      if(p.go && p.id !== G.id && G.follow && Date.now() - (p.srv || p.ts) < 120000) goBanner(p);
    }, 500);
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
  if(d.go) return;   // de startbalk vertelt het al
  toast(`${d.name} heeft de route gekozen. Jouw route staat klaar.`, 3500);
  speak(`${d.name} heeft een nieuwe route gekozen.`);
}
function planMsg(){
  const A = S.area;
  const closed = closedKeys().map(k => A.groupKeys.indexOf(k)).filter(i => i >= 0);
  const plan = {t:"plan", area:A.id, from:S.from, to:S.to, via:S.via, dk:S.target ? "t" : "n", de:S.target ? S.target.e.i : null, closed,
                wps: S.wps.length ? wpsOut() : undefined,
                label: S.wps.length ? `Getekende route (${S.wps.length} punten)` : S.target ? `Skiën: ${S.target.label}` : nodeLabel(S.to)};
  return plan;
}
async function sendPlan(){
  if(!G.code || !S.area || (S.to == null && !S.target)){ toast("Kies eerst een bestemming of piste."); return; }
  const plan = planMsg(), ok = await gSend(plan);
  if(ok){ G.planTs = Date.now(); G.plan = {...plan, name:G.name, id:G.id, ts:G.planTs}; S.planBy = null; renderGroup(); update(); toast("Route gestuurd naar de groep."); }
  else toast("Versturen lukte niet. Controleer je verbinding.");
}
// één persoon start de route voor de hele groep: iedereen krijgt de route en de navigatie gaat tegelijk aan
async function startAll(){
  if(!requirePro("group")) return;
  if(!G.code || !S.area || (S.to == null && !S.target)){ toast("Kies eerst een bestemming of piste."); return; }
  const plan = {...planMsg(), go:true}, ok = await gSend(plan);
  if(!ok){ toast("Versturen lukte niet. Controleer je verbinding."); return; }
  G.planTs = Date.now(); G.plan = {...plan, name:G.name, id:G.id, ts:G.planTs}; S.planBy = null;
  $("group").hidden = true; renderGroup();
  if(!S.follow) toggleFollow(); else update();
  toast("Route gestart voor de hele groep.");
}
// bij de anderen: balk met aftelling; zonder eerdere tik staat de telefoon spraak en scherm-aan niet toe, dan één tik
let goTimer = null;
function goBanner(p){
  clearInterval(goTimer); $("goBanner")?.remove();
  if(S.follow){ toast(`${p.name} heeft de route voor iedereen gestart.`, 3500); speak(`${p.name} heeft de route gestart.`); return; }
  const auto = navigator.userActivation ? navigator.userActivation.hasBeenActive : true;
  const div = document.createElement("div"); div.id = "goBanner"; div.className = "go-banner"; div.setAttribute("role", "alertdialog");
  div.innerHTML = `<span class="go-ic">${I("group")}</span><div class="go-txt"><b>${esc(p.name)} start de route</b><span id="goCount">${auto ? "Navigatie start over 5 s" : "Tik om mee te doen."}</span></div>
    <div class="go-btns"><button type="button" class="btn primary" id="goNow">${I("play")}${auto ? "Nu starten" : "Meedoen"}</button><button type="button" class="btn ghost" id="goSkip">Niet meedoen</button></div>`;
  document.body.appendChild(div); navigator.vibrate?.([200, 100, 200]);
  const close =() => { clearInterval(goTimer); div.remove(); };
  const go = () => { close(); if(!S.follow){ if(!S.wps.length) S.fromMe = true; toggleFollow(); } };
  $("goNow").onclick = go; $("goSkip").onclick = close;
  if(auto){
    speak(`${p.name} start de route. Navigatie start over vijf seconden.`);
    let n = 5; goTimer = setInterval(() => { n--; if(n <= 0) go(); else $("goCount").textContent = tr(`Navigatie start over ${n} s`); }, 1000);
  }
}
function groupOnPos(){
  if(!G.code || !G.sharePos || !S.pos) return;
  const now = Date.now(), last = G.lastPos;
  const moved = last ? meters(last.lat, last.lon, S.pos.lat, S.pos.lon) : Infinity, dt = last ? (now - last.t)/1000 : Infinity;
  const minSec = sentToday() > POS_DAILY_SOFT ? 600 : POS_MIN_SEC;
  if(dt >= POS_MAX_SEC || (moved >= POS_MIN_MOVE && dt >= minSec)){
    G.lastPos = {lat:S.pos.lat, lon:S.pos.lon, t:now};
    const sm = D.rec ? D.day?.sum : null;
    gSend({t:"pos", lat:+S.pos.lat.toFixed(5), lon:+S.pos.lon.toFixed(5), ...(sm && sm.n > 1 ? {dk:+sm.km.toFixed(1), dh:Math.round(sm.hm)} : {})});
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
    const day = m.dk != null ? ` · vandaag ${kmTxt(m.dk)} km, ${hmTxt(m.dh)} hm` : "";
    return `<li><div class="mem" style="--c:${gColor(m.id)}">${esc(m.name.charAt(0).toUpperCase())}</div><span><b>${esc(m.name)}</b><small>${esc(where)}${dist}${day}</small></span><span class="ago">${ago(m.posTs || m.seen)}</span></li>`;
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
$("gCreate").onclick = () => { if(requirePro("group")) gStart(newCode()); };   // meedoen met een groep is gratis, een groep maken is Pro
$("gJoin").onclick = () => { const c = $("gCode").value.trim().replace(/[^A-Za-z0-9]/g, ""); if(c.length < 4){ toast("Vul de groepscode in."); return; } gStart(c); };
$("gLeave").onclick = gLeave;
$("gSendPlan").onclick = sendPlan;
$("gStartAll").onclick = startAll;
$("gFollow").onchange = e => { G.follow = e.target.checked; gSave(); if(G.follow && G.plan && G.plan.id !== G.id) adoptPlan(G.plan); };
$("gSharePos").onchange = e => { G.sharePos = e.target.checked; gSave(); if(G.sharePos){ G.lastPos = null; if(S.watch == null) startWatch(); else groupOnPos(); } };
$("gCopy").onclick = async () => { try{ await navigator.clipboard.writeText(gUrl()); toast("Link gekopieerd."); }catch(e){ toast("Kopiëren lukte niet."); } };
$("gShare").onclick = async () => {
  if(navigator.share){ try{ await navigator.share({title:tr("Skiën in een groep"), text:tr(`Doe mee met mijn groep in Skipilot (code ${G.code}):`), url:gUrl()}); }catch(e){} }
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
      toast("Dit punt is vanaf het vorige niet over pistes en liften te bereiken. Kies een ander punt.", 3500);
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
  $("dbSub").textContent = `${(kmp/1000).toFixed(1).replace(".", DEC)} km piste · tik verder of kies Klaar`;
}
function startDraw(){
  if(!S.area) return;
  S.draw = true; S.wps = []; S.target = null; S.via = null; S.planBy = null;
  if(!(S.fromMe && S.pos)) S.from = null;
  S.to = null;
  document.body.classList.add("drawing"); $("drawBtn").classList.add("drawing");
  $("drawBar").hidden = false; map.closePopup();
  if(!isSide()) setSheet(false);
  update(); renderDrawBar();
}
function stopDraw(){
  S.draw = false;
  document.body.classList.remove("drawing"); $("drawBtn").classList.remove("drawing");
  $("drawBar").hidden = true;
  if(S.wps.length === 1 && !(S.fromMe && S.pos)) S.wps = [];   // één los punt is nog geen route
  update();
  if(S.path?.length){ fitRoute(); if(!isSide()) setSheet(true); }
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
  $("mrList").innerHTML = list.map((r, i) => `<li><button type="button" class="mr-open" data-i="${i}"><b>${esc(r.name)}</b><small>${r.n} punten · ${fmt(r.min)} · ${r.km.toFixed(1).replace(".", DEC)} km piste</small></button>
    <button type="button" class="icon-btn" data-del="${i}" title="Verwijderen" aria-label="${esc(r.name)} verwijderen"><svg class="ic"><use href="#i-trash"/></svg></button></li>`).join("")
    || `<li class="empty" style="display:block;font-size:13px">Nog geen routes bewaard. Teken of plan een route en bewaar hem hier.</li>`;
  $("mrList").querySelectorAll(".mr-open").forEach(b => b.onclick = () => {
    const r = loadRoutes()[+b.dataset.i]; if(!r) return;
    if(S.draw) stopDraw();
    S.wps = wpsIn(r.wps); S.target = null; S.via = null; S.planBy = null; S.fromMe = false;
    update(); fitRoute(); toast(`Route "${r.name}" geladen.`);
    if(!isSide()) setSheet(false);
  });
  $("mrList").querySelectorAll("[data-del]").forEach(b => b.onclick = () => {
    const list = loadRoutes(), [r] = list.splice(+b.dataset.del, 1);
    saveRoutes(list); renderRoutes(); toast(`"${r.name}" verwijderd.`);
  });
}
$("mrSave").onclick = () => {
  const wps = currentWps();
  if(!S.path?.length || wps.length < 2){ toast("Teken of plan eerst een route."); return; }
  const name = $("mrName").value.trim() || `Route ${new Date().toLocaleDateString(LOCALE, {day:"numeric", month:"short"})}`;
  const list = loadRoutes();
  list.unshift({name, wps, n:wps.length, ts:Date.now(), min:S.path.reduce((t, x) => t + x.min, 0),
                km:S.path.filter(x => x.e.t==="r").reduce((t, x) => t + x.e.len, 0)/1000});
  saveRoutes(list.slice(0, 30)); $("mrName").value = ""; renderRoutes(); toast(`Route "${name}" bewaard.`);
};
$("myRoutes").addEventListener("toggle", renderRoutes);

// ================= skidagboek =================
// Het spoor van de dag: [seconden sinds start, lat*1e5, lon*1e5, hoogte, rand-index, soort (0 los, 1 lift, 2 piste)]
const D = {rec:false, day:null, view:null, show:true, awake:false, lastSave:0, lastDraw:0};
try{ const d = JSON.parse(localStorage.getItem("pp-diary") || "null");
  if(d) Object.assign(D, {rec:!!d.rec && d.date === todayKey(), show:d.show ?? true, awake:!!d.awake}); }catch(e){}
const dSaveSettings = () => { try{ localStorage.setItem("pp-diary", JSON.stringify({rec:D.rec, date:todayKey(), show:D.show, awake:D.awake})); }catch(e){} };
const dayKey = k => "pp-day:" + k;
const niceDate = k => new Date(+k.slice(0,4), +k.slice(4,6)-1, +k.slice(6,8)).toLocaleDateString(LOCALE, {weekday:"long", day:"numeric", month:"long"});
const trackLayer = L.layerGroup().addTo(map);
function loadDay(k){ try{ return JSON.parse(localStorage.getItem(dayKey(k)) || "null"); }catch(e){ return null; } }
function saveDay(day){
  try{ localStorage.setItem(dayKey(day.date), JSON.stringify(day)); }
  catch(e){ toast("Het dagboek is vol. Verwijder een paar oude dagen."); }
}
function listDays(){
  const out = [];
  try{ for(let i = 0; i < localStorage.length; i++){ const k = localStorage.key(i); if(k?.startsWith("pp-day:")) out.push(k.slice(7)); } }catch(e){}
  return out.sort().reverse();
}
function today(){
  if(D.day && D.day.date === todayKey()) return D.day;
  D.day = loadDay(todayKey()) || {date:todayKey(), start:Date.now(), area:S.area?.id || null, areaName:S.area?.row[1] || "", pts:[], sum:null};
  return D.day;
}
// punt koppelen aan een piste of lift binnen 35 m; de hoogte komt dan uit de kaart
function matchPoint(lat, lon){
  const A = S.area; if(!A) return null;
  const p = [lat, lon]; let best = null;
  for(const e of A.edges){
    if(e.t === "w") continue;
    let acc = 0, hit = null;
    for(let k = 0; k < e.pts.length-1; k++){
      const r = segDist(p, e.pts[k], e.pts[k+1]);
      if(!best || r.d < best.d){ best = {d:r.d, e}; hit = acc + r.t*r.len; }
      acc += r.len;
    }
    if(hit != null){ best.along = hit; best.tot = acc; }
  }
  if(!best || best.d > 35) return null;
  const e = best.e, ea = A.nodes[e.a].ele, eb = A.nodes[e.b].ele;
  const ele = ea != null && eb != null ? ea + (eb - ea) * (best.tot ? best.along / best.tot : 0) : null;
  return {e, ele};
}
function diaryAdd(lat, lon, acc, alt, t = Date.now()){
  if(!D.rec) return;
  const day = today();
  if(acc != null && acc > 40) return;                       // te onnauwkeurig
  const last = day.pts[day.pts.length-1], ts = Math.round((t - day.start)/1000);
  if(last){ const dt = ts - last[0], d = meters(last[1]/1e5, last[2]/1e5, lat, lon); if(dt < 4 || (d < 6 && dt < 30)) return; }
  if(!day.area && S.area){ day.area = S.area.id; day.areaName = S.area.row[1]; }
  const m = day.area === S.area?.id ? matchPoint(lat, lon) : null;
  const ele = m?.ele ?? (alt != null ? alt : (last ? last[3] : null));
  day.pts.push([ts, Math.round(lat*1e5), Math.round(lon*1e5), ele == null ? null : Math.round(ele), m ? m.e.i : -1, m ? (m.e.t === "l" ? 1 : 2) : 0]);
  if(t - D.lastSave > 30000 || day.pts.length % 20 === 0){ D.lastSave = t; day.sum = daySummary(day); saveDay(day); }
  diaryLive();
}
function daySummary(day){
  const P = day.pts, A = day.area && day.area === S.area?.id ? S.area : null;
  const s = {km:0, hm:0, vmax:0, runs:0, lifts:0, secs:0, liftSecs:0, n:P.length, pisteList:[], liftList:[], from:null, to:null};
  if(P.length < 2){ if(day.sum){ s.pisteList = day.sum.pisteList || []; s.liftList = day.sum.liftList || []; } return s; }
  s.from = day.start + P[0][0]*1000; s.to = day.start + P[P.length-1][0]*1000;
  // hoogte gladstrijken (mediaan van drie), tegen sprongen in de GPS-hoogte
  const ele = P.map((p, i) => { const w = [P[i-1]?.[3], p[3], P[i+1]?.[3]].filter(x => x != null).sort((a, b) => a - b); return w.length ? w[Math.floor(w.length/2)] : null; });
  let inLift = false, gain = 0, liftEdge = -1, drop = 0, prevV = null;
  const lifts = [], pistes = []; let curKey = null, curN = 0;
  const flushPiste = () => { if(curKey && curN >= 2) pistes.push(curKey); curKey = null; curN = 0; };
  for(let i = 1; i < P.length; i++){
    const a = P[i-1], b = P[i], dt = b[0] - a[0]; if(dt <= 0) continue;
    const d = meters(a[1]/1e5, a[2]/1e5, b[1]/1e5, b[2]/1e5), v = d/dt*3.6;
    const de = ele[i-1] != null && ele[i] != null ? ele[i] - ele[i-1] : 0;
    s.secs += Math.min(dt, 300);
    if(a[5] === 1 && b[5] === 1){
      s.liftSecs += Math.min(dt, 300);
      // nieuwe rit: net ingestapt, of direct overgestapt op een andere lift
      if(inLift && b[4] !== liftEdge && a[4] !== b[4]){ if(gain >= 30){ s.lifts++; lifts.push(liftEdge); } inLift = false; }
      if(!inLift){ inLift = true; gain = 0; liftEdge = b[4]; if(drop >= 80) s.runs++; drop = 0; }
      gain += Math.max(0, de); prevV = null;
    } else {
      if(inLift){ inLift = false; if(gain >= 30){ s.lifts++; lifts.push(liftEdge); } }
      if(v < 130 && dt <= 120){
        if(de < 0 || v > 7) s.km += d/1000;
        if(de < 0){ s.hm -= de; drop -= de; }
        // topsnelheid: gemiddelde van twee stukken achter elkaar, zodat één GPS-sprong niet telt
        if(dt >= 2 && dt <= 30){ if(prevV != null) s.vmax = Math.max(s.vmax, (v + prevV)/2); prevV = v; }
      }
    }
    if(A && b[5] === 2){ const k = A.edges[b[4]]?.key; if(k === curKey) curN++; else { flushPiste(); curKey = k; curN = 1; } }
    else flushPiste();
  }
  flushPiste();
  if(inLift && gain >= 30){ s.lifts++; lifts.push(liftEdge); }
  if(drop >= 80) s.runs++;
  if(A){
    const pc = new Map(); for(const k of pistes) if(!k.startsWith("e|")) pc.set(k, (pc.get(k) || 0) + 1);
    s.pisteList = [...pc].map(([k, n]) => { const g = A.groups.get(k); return g ? {ref:g.e.ref, name:uc(pisteLabel(g.e)), diff:g.e.diff, n} : null; }).filter(Boolean);
    const lcnt = new Map(); for(const ei of lifts){ const e = A.edges[ei]; if(!e) continue; const nm = uc(e.name || e.ref || LIFT[e.kind] || "lift"); lcnt.set(nm, (lcnt.get(nm) || 0) + 1); }
    s.liftList = [...lcnt].map(([name, n]) => ({name, n}));
  } else if(day.sum){ s.pisteList = day.sum.pisteList || []; s.liftList = day.sum.liftList || []; }
  return s;
}
const hmTxt = x => Math.round(x).toLocaleString(LOCALE);
const kmTxt = x => x.toFixed(1).replace(".", DEC);
const durTxt = sec => { const m = Math.round(sec/60); return m >= 60 ? `${Math.floor(m/60)}u ${String(m%60).padStart(2,"0")}` : `${m} min`; };
function diaryLive(){
  const day = D.day && D.day.date === todayKey() ? D.day : loadDay(todayKey());
  const sum = day ? (day.sum = daySummary(day)) : null;
  widgetDay(day, sum, !D.rec);
  $("diaryRecPill").hidden = !D.rec; document.body.classList.toggle("recording", D.rec);
  $("diaryMini").textContent = sum && sum.n > 1 ? `Vandaag: ${kmTxt(sum.km)} km · ${hmTxt(sum.hm)} hm · ${Math.round(sum.vmax)} km/u` : D.rec ? "Opname loopt. Ga skiën!" : "Houd je skidag bij: kilometers, hoogtemeters en topsnelheid";
  if(Date.now() - D.lastDraw > 3000){ D.lastDraw = Date.now(); drawTrack(); }
  if(!$("diary").hidden) renderDiary();
}
function drawTrack(){
  trackLayer.clearLayers();
  if(!D.show) return;
  const k = D.view || todayKey(), day = k === todayKey() ? (D.day?.date === k ? D.day : loadDay(k)) : loadDay(k);
  if(!day || day.pts.length < 2) return;
  const pts = day.pts.map(p => [p[1]/1e5, p[2]/1e5]);
  L.polyline(pts, {renderer:svgR, interactive:false, color:"#ffffff", weight:7, opacity:.6, lineJoin:"round"}).addTo(trackLayer);
  L.polyline(pts, {renderer:svgR, interactive:false, color:"#7C3AED", weight:4, opacity:.95, lineJoin:"round"}).addTo(trackLayer);
}
function renderDiary(){
  const tk = todayKey(), k = D.view || tk, isToday = k === tk;
  const day = isToday ? (D.day?.date === tk ? D.day : loadDay(tk)) : loadDay(k);
  const sum = day ? (day.area === S.area?.id || !day.sum ? daySummary(day) : day.sum) : null;
  $("diaryDate").textContent = `${isToday ? "Vandaag · " : ""}${niceDate(k)}${day?.areaName ? " · " + day.areaName : ""}`;
  $("diaryTitle").textContent = isToday ? "Skidagboek" : "Eerdere dag";
  // bediening
  if(!isToday) $("diaryCtrl").innerHTML = `<button type="button" class="btn ghost" id="dBack">${I("book")}Terug naar vandaag</button>`;
  else if(D.rec) $("diaryCtrl").innerHTML = `<div class="rec-line"><span class="rec-pill">${I("rec")}Opname</span><span>${sum?.from ? `sinds ${new Date(sum.from).toLocaleTimeString(LOCALE, {hour:"2-digit", minute:"2-digit"})} · ` : ""}${day?.pts.length || 0} punten${S.pos ? "" : " · <b>wacht op GPS…</b>"}</span></div>
      <button type="button" class="btn stop" id="dStop">${I("stop")}Opname stoppen</button>`;
  else $("diaryCtrl").innerHTML = `<button type="button" class="btn primary" id="dStart">${I("rec")}${day?.pts.length ? "Verder opnemen" : "Begin met opnemen"}</button>`;
  $("dStart")?.addEventListener("click", startRec);
  $("dStop")?.addEventListener("click", stopRec);
  $("dBack")?.addEventListener("click", () => { D.view = null; drawTrack(); renderDiary(); });
  // cijfers
  if(sum && sum.n > 1){
    $("diaryStats").innerHTML = `<div class="d-stat big"><b>${kmTxt(sum.km)}<small>km</small></b><span>${I("ski")}geskied</span></div>
      <div class="d-stat"><span>${I("down")}Omlaag</span><b>${hmTxt(sum.hm)}<small>hm</small></b></div>
      <div class="d-stat"><span>${I("speed")}Top</span><b>${Math.round(sum.vmax)}<small>km/u</small></b></div>
      <div class="d-stat"><span>${I("ski")}Afdalingen</span><b>${sum.runs}</b></div>
      <div class="d-stat"><span>${I("lift")}Liften</span><b>${sum.lifts}</b></div>
      <div class="d-stat"><span>${I("clock")}Op de berg</span><b>${durTxt(sum.secs)}</b></div>
      <div class="d-stat"><span>${I("lift")}In de lift</span><b>${durTxt(sum.liftSecs)}</b></div>`;
  } else $("diaryStats").innerHTML = isToday ? `<p class="empty" style="grid-column:1/-1">${D.rec ? "Zodra je beweegt, verschijnen hier je kilometers, hoogtemeters en topsnelheid." : "Tik op <strong>Begin met opnemen</strong> als je gaat skiën. De app houdt dan je dag bij."}</p>` : "";
  // pistes en liften
  const pl = sum?.pisteList || [], ll = sum?.liftList || [];
  $("diaryLists").innerHTML = (pl.length ? `<div class="d-list"><p class="label">Pistes (${pl.length})</p><div class="d-chips">${pl.map(x =>
      `<span class="d-chip"><span class="node${isDark(x.diff) ? " dark" : ""}" style="--c:${DIFF[x.diff]?.col || "#888"}">${esc(x.ref) || I("ski")}</span>${esc(x.name)}${x.n > 1 ? ` <i>${x.n}×</i>` : ""}</span>`).join("")}</div></div>` : "")
    + (ll.length ? `<div class="d-list"><p class="label">Liften (${ll.length})</p><div class="d-chips">${ll.map(x =>
      `<span class="d-chip"><span class="node" style="background:var(--surface);color:var(--p-lift);border:1.5px solid var(--p-lift)">${I("lift")}</span>${esc(x.name)}${x.n > 1 ? ` <i>${x.n}×</i>` : ""}</span>`).join("")}</div></div>` : "")
    + (sum && sum.n > 1 ? `<div class="d-actions"><button type="button" class="btn ghost" id="dShare">${I("share")}Deel mijn dag</button><button type="button" class="btn ghost" id="dGpx">${I("route")}Exporteer GPX</button></div>` : "");
  $("dShare")?.addEventListener("click", () => shareDay(day, sum));
  $("dGpx")?.addEventListener("click", () => exportGpx(day));
  renderSeason(k);
  $("dShow").checked = D.show; $("dAwake").checked = D.awake;
  // geschiedenis
  const days = listDays();
  $("diaryHistory").innerHTML = days.length ? `<div class="d-hist"><p class="label">Mijn skidagen</p><ul>${days.map(d => {
      const x = loadDay(d), sm = x?.sum;
      return `<li class="${d === k ? "cur" : ""}"><button type="button" class="mr-open" data-d="${d}"><b>${niceDate(d)}</b><small>${esc(x?.areaName || "")}${sm && sm.n > 1 ? ` · ${kmTxt(sm.km)} km · ${hmTxt(sm.hm)} hm` : ""}</small></button>
        <button type="button" class="icon-btn" data-del="${d}" title="Verwijderen" aria-label="Dag verwijderen"><svg class="ic"><use href="#i-trash"/></svg></button></li>`; }).join("")}</ul></div>` : "";
  $("diaryHistory").querySelectorAll(".mr-open").forEach(b => b.onclick = () => {
    D.view = b.dataset.d === tk ? null : b.dataset.d; drawTrack(); renderDiary();
    const x = loadDay(b.dataset.d); if(x?.pts.length > 1) map.fitBounds(L.latLngBounds(x.pts.map(p => [p[1]/1e5, p[2]/1e5])), {...sheetPad(), maxZoom:16});
  });
  $("diaryHistory").querySelectorAll("[data-del]").forEach(b => b.onclick = () => {
    const d = b.dataset.del;
    if(d === tk && D.rec){ toast("Stop eerst de opname van vandaag."); return; }
    if(b.dataset.sure !== "1"){ b.dataset.sure = "1"; b.style.color = "var(--danger)"; toast("Tik nog een keer om deze dag te verwijderen."); return; }
    try{ localStorage.removeItem(dayKey(d)); }catch(e){}
    if(D.day?.date === d) D.day = null;
    if(D.view === d) D.view = null;
    drawTrack(); renderDiary(); diaryLive(); toast("Dag verwijderd.");
  });
}
// GPX 1.1: punten met tijd en hoogte, te openen in Strava, Garmin Connect, Komoot en dergelijke
function dayGpx(day){
  const name = `${day.areaName || "Skidag"} ${day.date.slice(0,4)}-${day.date.slice(4,6)}-${day.date.slice(6,8)}`;
  const pts = day.pts.map(p => `<trkpt lat="${(p[1]/1e5).toFixed(5)}" lon="${(p[2]/1e5).toFixed(5)}">${p[3] != null ? `<ele>${p[3]}</ele>` : ""}<time>${new Date(day.start + p[0]*1000).toISOString()}</time></trkpt>`).join("\n      ");
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Skipilot" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${esc(name)}</name><time>${new Date(day.start).toISOString()}</time></metadata>
  <trk>
    <name>${esc(name)}</name>
    <type>alpine_ski</type>
    <trkseg>
      ${pts}
    </trkseg>
  </trk>
</gpx>
`;
}
async function exportGpx(day){
  if(!requirePro("gpx")) return;
  if(!day || day.pts.length < 2){ toast("Deze dag heeft nog te weinig punten."); return; }
  const fname = `skipilot-${day.date.slice(0,4)}-${day.date.slice(4,6)}-${day.date.slice(6,8)}${day.areaName ? "-" + norm(day.areaName).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) : ""}.gpx`;
  const blob = new Blob([dayGpx(day)], {type:"application/gpx+xml"});
  // op de telefoon via het deelmenu (direct naar Strava e.d.), anders als download
  try{
    const file = new File([blob], fname, {type:"application/gpx+xml"});
    if(navigator.canShare?.({files:[file]})){ await navigator.share({files:[file], title:fname}); return; }
  }catch(e){ if(e?.name === "AbortError") return; }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = fname;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast("GPX-bestand opgeslagen.");
}

async function shareDay(day, sum){
  const lines = [`Mijn skidag in ${day.areaName || "de bergen"} (${niceDate(day.date)}):`,
    `${kmTxt(sum.km)} km geskied · ${hmTxt(sum.hm)} hoogtemeters omlaag · topsnelheid ${Math.round(sum.vmax)} km/u`,
    `${sum.runs} afdalingen · ${sum.lifts} liften`];
  if(sum.pisteList.length) lines.push("Pistes: " + sum.pisteList.slice(0, 12).map(x => x.ref || x.name).join(", "));
  const text = lines.map(tr).join("\n") + "\n\n" + tr("Bijgehouden met Skipilot");
  if(navigator.share){ try{ await navigator.share({title:"Mijn skidag", text}); return; }catch(e){ return; } }
  try{ await navigator.clipboard.writeText(text); toast("Samenvatting gekopieerd."); }catch(e){ toast("Delen lukte niet."); }
}
function startRec(){
  if(!startWatch()) return;
  D.rec = true; D.view = null; today(); dSaveSettings(); keepAwake();
  toast("Het dagboek neemt op. Veel skiplezier!");
  diaryLive(); renderDiary();
}
function stopRec(){
  D.rec = false; const day = today(); day.sum = daySummary(day); saveDay(day); dSaveSettings(); keepAwake();
  toast("Opname gestopt. Je dag is bewaard.");
  diaryLive(); renderDiary();
}
// winterseizoen: juli t/m juni, genoemd naar de twee jaren ("2026–27")
const seasonOf = k => { const y = +k.slice(0,4), m = +k.slice(4,6); const a = m >= 7 ? y : y - 1; return `${a}–${String(a + 1).slice(2)}`; };
let seasonPick = null;
function allDays(){
  return listDays().map(d => { const x = loadDay(d); if(!x) return null; const sm = x.sum && x.sum.n > 1 ? x.sum : daySummary(x); return {d, area:x.areaName || "", s:sm}; })
    .filter(x => x && x.s && x.s.n > 1);
}
function renderSeason(curKey){
  const days = allDays(), box = $("diarySeason");
  if(!days.length){ box.innerHTML = ""; return; }
  if(!isPro()){ box.innerHTML = proTeaser("season"); return; }
  const seasons = [...new Set(days.map(x => seasonOf(x.d)))].sort().reverse();
  const sel = seasonPick && seasons.includes(seasonPick) ? seasonPick : seasons[0];
  const sd = days.filter(x => seasonOf(x.d) === sel);
  const tot = sd.reduce((a, x) => ({km:a.km + x.s.km, hm:a.hm + x.s.hm, runs:a.runs + x.s.runs, secs:a.secs + x.s.secs}), {km:0, hm:0, runs:0, secs:0});
  const areaCount = new Map(); sd.forEach(x => x.area && areaCount.set(x.area, (areaCount.get(x.area) || 0) + 1));
  const fav = [...areaCount].sort((a, b) => b[1] - a[1])[0];
  const best = (list, f) => list.reduce((m, x) => !m || f(x) > f(m) ? x : m, null);
  const rec = (title, x, val, icon) => x ? `<button type="button" class="d-rec" data-d="${x.d}">${I(icon)}<span><small>${title}</small><b>${val}</b><i>${niceDate(x.d)}${x.area ? " · " + esc(x.area) : ""}</i></span></button>` : "";
  const r1 = best(days, x => x.s.vmax), r2 = best(days, x => x.s.km), r3 = best(days, x => x.s.hm), r4 = best(days, x => x.s.runs);
  box.innerHTML = `<div class="d-season">
      <div class="d-season-head"><p class="label">Seizoen</p>${seasons.length > 1 ? `<div class="chips">${seasons.map(x => `<button type="button" class="chip" data-season="${x}" aria-pressed="${x === sel}">${x}</button>`).join("")}</div>` : `<span class="d-season-name">${sel}</span>`}</div>
      <div class="d-stats">
        <div class="d-stat"><span>${I("calendar")}Dagen</span><b>${sd.length}</b></div>
        <div class="d-stat"><span>${I("ski")}Geskied</span><b>${hmTxt(tot.km)}<small>km</small></b></div>
        <div class="d-stat"><span>${I("down")}Omlaag</span><b>${tot.hm >= 10000 ? kmTxt(tot.hm/1000) + "<small>km</small>" : hmTxt(tot.hm) + "<small>hm</small>"}</b></div>
        <div class="d-stat"><span>${I("ski")}Afdalingen</span><b>${tot.runs}</b></div>
        <div class="d-stat"><span>${I("clock")}Op de berg</span><b>${durTxt(tot.secs)}</b></div>
        <div class="d-stat"><span>${I("star")}Per dag</span><b>${kmTxt(tot.km / sd.length)}<small>km</small></b></div>
      </div>
      ${fav ? `<p class="d-fav">${I("star")}Favoriet gebied: <b>${esc(fav[0])}</b> (${fav[1]} ${fav[1] === 1 ? "dag" : "dagen"})</p>` : ""}
    </div>
    <div class="d-records"><p class="label">Persoonlijke records</p>
      ${rec("Topsnelheid", r1, `${Math.round(r1.s.vmax)} km/u`, "speed")}
      ${rec("Langste dag", r2, `${kmTxt(r2.s.km)} km`, "ski")}
      ${rec("Meeste hoogtemeters", r3, `${hmTxt(r3.s.hm)} hm`, "down")}
      ${rec("Meeste afdalingen", r4, `${r4.s.runs}`, "lift")}
    </div>`;
  box.querySelectorAll("[data-season]").forEach(b => b.onclick = () => { seasonPick = b.dataset.season; renderSeason(curKey); });
  box.querySelectorAll(".d-rec").forEach(b => b.onclick = () => {
    const d = b.dataset.d; D.view = d === todayKey() ? null : d; drawTrack(); renderDiary(); $("diary").scrollTop = 0;
    const x = loadDay(d); if(x?.pts.length > 1) map.fitBounds(L.latLngBounds(x.pts.map(p => [p[1]/1e5, p[2]/1e5])), {...sheetPad(), maxZoom:16});
  });
}

function openDiary(){ $("diary").hidden = false; renderDiary(); drawTrack(); fillAds("diary"); }
$("diaryOpen").onclick = openDiary;
$("diaryClose").onclick = () => { $("diary").hidden = true; };
$("dShow").onchange = e => { D.show = e.target.checked; dSaveSettings(); drawTrack(); };
$("dAwake").onchange = e => { D.awake = e.target.checked; dSaveSettings(); keepAwake(); };
document.addEventListener("keydown", e => { if(e.key === "Escape" && !$("diary").hidden) $("diary").hidden = true; });
// oude dagen opruimen: hooguit 60 dagen bewaren
(() => { const days = listDays(); days.slice(60).forEach(d => { try{ localStorage.removeItem(dayKey(d)); }catch(e){} }); })();

// ================= hoogteprofiel =================
// hoogte per knooppunt langs de route; tussen knooppunten lineair (de kaart kent alleen hoogtes op kruisingen en stations)
function profileData(){
  const A = S.area, P = S.path; if(!A || !P || !P.length) return null;
  const pts = []; let d = 0;
  const e0 = A.nodes[P[0].from].ele; if(e0 != null) pts.push({d:0, ele:e0, i:0});
  P.forEach((s, k) => {
    d += s.e.len;
    const ele = A.nodes[s.to].ele;
    if(ele != null) pts.push({d, ele, k});
  });
  if(pts.length < 2) return null;
  // stap-index per stuk, voor kleur en tooltip
  const stepOf = new Map(); let n = 0;
  S.steps.forEach((st, i) => st.items.forEach(() => stepOf.set(n++, i)));
  return {pts, total:d, stepOf};
}
let PROF = null;
function profileHtml(){
  const pd = profileData(); PROF = pd;
  if(!pd) return "";
  const W = Math.max(260, ($("result").clientWidth || 360)), H = 120, padL = 40, padR = 8, padT = 10, padB = 20;
  const eles = pd.pts.map(p => p.ele), lo = Math.min(...eles), hi = Math.max(...eles);
  const span = Math.max(50, hi - lo), y0 = lo - span*0.08, y1 = hi + span*0.08;
  const X = d => padL + (W - padL - padR) * d / pd.total, Y = e => padT + (H - padT - padB) * (1 - (e - y0)/(y1 - y0));
  Object.assign(pd, {W, H, padL, padR, padT, padB, X, Y, lo, hi});
  let up = 0, down = 0;
  for(let i = 1; i < pd.pts.length; i++){ const de = pd.pts[i].ele - pd.pts[i-1].ele; if(de > 0) up += de; else down -= de; }
  const area = `M${X(0)},${Y(y0)} ` + pd.pts.map(p => `L${X(p.d).toFixed(1)},${Y(p.ele).toFixed(1)}`).join(" ") + ` L${X(pd.total)},${Y(y0)} Z`;
  // lijnstukken in de kleur van de stap
  let segs = "", prev = pd.pts[0];
  for(let i = 1; i < pd.pts.length; i++){
    const p = pd.pts[i], st = S.steps[pd.stepOf.get(p.k)] || {};
    const lift = st.t === "l", col = lift ? "var(--p-lift)" : st.t === "w" ? "var(--faint)" : (st.color || "var(--accent)");
    segs += `<line x1="${X(prev.d).toFixed(1)}" y1="${Y(prev.ele).toFixed(1)}" x2="${X(p.d).toFixed(1)}" y2="${Y(p.ele).toFixed(1)}" stroke="${col}" stroke-width="2" stroke-linecap="round"${lift || st.t === "w" ? ' stroke-dasharray="3 4"' : ""}/>`;
    prev = p;
  }
  const yl = v => `<text x="${padL - 6}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end">${hmTxt(v)}</text><line x1="${padL}" x2="${W - padR}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" class="grid"/>`;
  return `<div class="profile" id="profile">
    <div class="prof-head"><p class="label">Hoogteprofiel</p><span>↑ ${hmTxt(up)} m · ↓ ${hmTxt(down)} m · hoogste ${hmTxt(hi)} m</span></div>
    <div class="prof-box">
      <svg id="profSvg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Hoogteprofiel van ${hmTxt(lo)} tot ${hmTxt(hi)} meter over ${km(pd.total)}">
        ${yl(hi)}${yl(lo)}
        <path d="${area}" class="prof-area"/>
        ${segs}
        <text x="${padL}" y="${H - 5}" text-anchor="start">0 km</text>
        <text x="${W - padR}" y="${H - 5}" text-anchor="end">${km(pd.total)}</text>
        <line id="profCross" x1="0" x2="0" y1="${padT}" y2="${H - padB}" class="cross" visibility="hidden"/>
        <circle id="profDot" r="4.5" class="dot" visibility="hidden"/>
        <rect x="${padL}" y="0" width="${W - padL - padR}" height="${H}" fill="transparent" id="profHit"/>
      </svg>
      <div class="prof-tip" id="profTip" hidden></div>
    </div>
  </div>`;
}
let profMarker = null;
function bindProfile(){
  const hit = $("profHit"); if(!hit || !PROF) return;
  const pd = PROF, svg = $("profSvg");
  const at = d => { // hoogte en stap op afstand d
    let i = pd.pts.findIndex(p => p.d >= d); if(i <= 0) i = 1;
    const a = pd.pts[i-1], b = pd.pts[i], f = b.d > a.d ? (d - a.d)/(b.d - a.d) : 0;
    return {ele:a.ele + (b.ele - a.ele)*f, k:b.k, f, a, b};
  };
  const move = ev => {
    const r = svg.getBoundingClientRect(), x = (ev.clientX - r.left) * pd.W / r.width;
    const d = Math.max(0, Math.min(pd.total, (x - pd.padL) / (pd.W - pd.padL - pd.padR) * pd.total));
    const q = at(d), st = S.steps[pd.stepOf.get(q.k)];
    $("profCross").setAttribute("x1", pd.X(d)); $("profCross").setAttribute("x2", pd.X(d)); $("profCross").setAttribute("visibility", "visible");
    $("profDot").setAttribute("cx", pd.X(d)); $("profDot").setAttribute("cy", pd.Y(q.ele)); $("profDot").setAttribute("visibility", "visible");
    const tip = $("profTip"); tip.hidden = false;
    tip.innerHTML = `<b>${hmTxt(q.ele)} m</b> · ${km(d)}<span>${esc(st?.title || "")}</span>`;
    const left = Math.min(Math.max(pd.X(d) * r.width / pd.W - 70, 0), r.width - 150); tip.style.left = left + "px";
    // dezelfde plek op de kaart
    const item = S.path[q.k]; if(item){
      const line = item.rev ? [...item.e.pts].reverse() : item.e.pts;
      let tot = 0; const seg = []; for(let j = 0; j < line.length-1; j++){ const l = meters(...line[j], ...line[j+1]); seg.push(l); tot += l; }
      let want = q.f * tot, j = 0; while(j < seg.length-1 && want > seg[j]){ want -= seg[j]; j++; }
      const g = seg[j] ? want/seg[j] : 0, A_ = line[j], B_ = line[j+1] || line[j];
      const ll = [A_[0] + (B_[0]-A_[0])*g, A_[1] + (B_[1]-A_[1])*g];
      if(!profMarker) profMarker = L.circleMarker(ll, {renderer:svgR, radius:7, color:"#fff", weight:3, fillColor:"#0F1B2A", fillOpacity:1, interactive:false}).addTo(map);
      else profMarker.setLatLng(ll);
    }
  };
  const leave = () => { $("profCross")?.setAttribute("visibility", "hidden"); $("profDot")?.setAttribute("visibility", "hidden"); if($("profTip")) $("profTip").hidden = true; profMarker?.remove(); profMarker = null; };
  hit.addEventListener("pointermove", move); hit.addEventListener("pointerdown", move);
  hit.addEventListener("pointerleave", leave);
}

// ================= hutten en restaurants =================
const HUT_KIND = {h:["Berghut","hut"], r:["Restaurant","food"], c:["Café","cup"], b:["Bar","glass"], f:["Snackbar","food"]};
const hutLayer = L.layerGroup();
function drawHuts(){
  hutLayer.clearLayers();
  const A = S.area; if(!A || !S.hutsOn || map.getZoom() < 13){ hutLayer.remove(); return; }
  hutLayer.addTo(map);
  const b = map.getBounds().pad(.15);
  for(const h of A.huts){
    if(!b.contains([h.lat, h.lon])) continue;
    const k = HUT_KIND[h.kind] || HUT_KIND.r;
    const m = L.marker([h.lat, h.lon], {keyboard:false, zIndexOffset:300, title:h.name || k[0],
      icon:L.divIcon({className:"", iconSize:[26,26], iconAnchor:[13,13], html:`<div class="hut hut-${h.kind}">${I(k[1])}</div>`})});
    m.on("click", ev => { L.DomEvent.stopPropagation(ev); hutPopup(h); });
    m.addTo(hutLayer);
  }
}
function hutPopup(h){
  const k = HUT_KIND[h.kind] || HUT_KIND.r, A = S.area, ele = A.nodes[h.node]?.ele;
  const div = document.createElement("div"); div.className = "pop";
  div.innerHTML = `<div class="pop-head"><span class="hut big hut-${h.kind}">${I(k[1])}</span><div><b>${esc(h.name || k[0])}</b><small>${k[0]}${ele != null ? ` · ca. ${ele} m` : ""}</small></div></div>
    <div class="pop-btns">
      <button type="button" class="primary" data-a="to">${I("flag")}Hierheen</button>
      <button type="button" data-a="via" style="grid-column:1/-1">Als tussenstop in mijn route</button>
    </div>`;
  const pop = L.popup({maxWidth:280, className:"pop-wrap"}).setLatLng([h.lat, h.lon]).setContent(div).openOn(map);
  div.querySelectorAll("button").forEach(b => b.onclick = () => {
    if(b.dataset.a === "to"){ S.to = h.node; S.target = null; S.via = null; S.wps = []; S.planBy = null; }
    else{
      // huidige route als punten, de hut als stop vóór de eindbestemming
      const w = wpsIn(currentWps());
      if(w.length < 2){ toast("Kies eerst een route, dan kun je er een stop aan toevoegen."); return; }
      w.splice(w.length - 1, 0, {k:"n", n:h.node}); S.wps = w; S.planBy = null;
      if(!computePath()){ S.wps = []; toast("Deze plek is niet in je route te passen met jouw niveau."); update(); return; }
    }
    map.closePopup(pop); update(); fitRoute();
    toast(b.dataset.a === "to" ? `Route naar ${h.name || k[0].toLowerCase()}.` : `${h.name || k[0]} toegevoegd als tussenstop.`);
  });
}
map.on("zoomend moveend", () => { if(S.area) drawHuts(); });
map.on("zoomend", () => { if(S.area && !$("layerMenu").hidden) renderHutInfo(); });

// Hutten en restaurants komen van de eigen site (data/h000.json ..., elke maand bijgewerkt door GitHub).
// Lukt dat niet, dan live van OpenStreetMap (Overpass); die servers zijn vaak druk, dus een paar keer opnieuw proberen.
// Het resultaat blijft 30 dagen op de telefoon, zodat het daarna ook zonder bereik werkt.
const HUT_TTL = 30*864e5, HUT_RETRY = [5e3, 20e3, 60e3, 180e3];
const hutKey = A => `pp-huts:${DATA_V}:${A.id}`;
async function loadHuts(force){
  const A = S.area; if(!A) return;
  let cached = null; try{ cached = JSON.parse(localStorage.getItem(hutKey(A)) || "null"); }catch(e){}
  if(cached){ setHuts(A, cached.h); if(!force && Date.now() - cached.t < HUT_TTL) return; }
  if(!navigator.onLine){ if(!cached) hutState(A, "offline"); return; }
  if(!cached) hutState(A, "loading");
  let list = null;
  try{
    // de iOS-app draagt zijn eigen bestanden mee; de verse hutten staan op de website
    const base = window.PP_STORE === "ios" ? (window.PP_CONFIG?.site || "") : "";
    const r = await fetch(`${base}data/h${String(A.row[8]).padStart(3, "0")}.json?${DATA_V}`);
    if(r.ok){ const j = await r.json(); if(j[A.id]) list = j[A.id].map(([lon, lat, kind, name]) => ({lon, lat, kind, name})); }
  }catch(e){}
  if(!list) list = await overpassHuts(A);
  if(S.area !== A) return;
  if(!list){
    if(cached) return;
    hutState(A, "error");
    const wait = HUT_RETRY[A.hutTry = (A.hutTry || 0)]; A.hutTry++;
    if(wait) setTimeout(() => { if(S.area === A && A.hutState === "error") loadHuts(); }, wait);
    return;
  }
  const out = processHuts(A, list);
  try{ localStorage.setItem(hutKey(A), JSON.stringify({t:Date.now(), h:out})); }catch(e){}
  setHuts(A, out);
}
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter"];
async function overpassHuts(A){
  const lats = A.nodes.map(n => n.lat), lons = A.nodes.map(n => n.lon);
  const bb = `${(Math.min(...lats) - .004).toFixed(4)},${(Math.min(...lons) - .006).toFixed(4)},${(Math.max(...lats) + .004).toFixed(4)},${(Math.max(...lons) + .006).toFixed(4)}`;
  const q = `[out:json][timeout:60];(nwr["amenity"~"^(restaurant|cafe|bar|pub|fast_food|biergarten)$"](${bb});nwr["tourism"="alpine_hut"](${bb}););out center tags;`;
  for(const url of OVERPASS){
    try{
      const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 65000);
      const r = await fetch(url, {method:"POST", body:"data=" + encodeURIComponent(q), headers:{"Content-Type":"application/x-www-form-urlencoded"}, signal:ctl.signal});
      clearTimeout(timer);
      if(!r.ok) continue;
      const j = await r.json();
      if(/error|timed out/i.test(j.remark || "")) continue;    // server liep vast: dit is geen echt (leeg) antwoord
      return (j.elements || []).map(el => {
        const t = el.tags || {}, c = el.center || el;
        return {lon:c.lon, lat:c.lat, name:t.name || "", kind:t.tourism === "alpine_hut" ? "h" : ({restaurant:"r", cafe:"c", bar:"b", pub:"b", biergarten:"b", fast_food:"f"})[t.amenity] || "r"};
      }).filter(x => x.lat != null);
    }catch(e){}
  }
  return null;
}
function processHuts(A, list){
  const out = [];
  for(const c of list){
    // alleen plekken bij een piste of lift (hooguit 120 m), gekoppeld aan het dichtstbijzijnde knooppunt
    const p = [c.lat, c.lon]; let near = Infinity;
    for(const e of A.edges){ if(e.t === "w") continue; for(let k = 0; k < e.pts.length-1 && near > 30; k++) near = Math.min(near, segDist(p, e.pts[k], e.pts[k+1]).d); if(near <= 30) break; }
    if(near > 120) continue;
    const nn = nearestNode(c.lat, c.lon); if(nn.d > 400) continue;
    out.push([+c.lon.toFixed(5), +c.lat.toFixed(5), c.kind, (c.name || "").slice(0, 60), nn.n]);
  }
  return out;
}
// hoe staat het met de hutten in dit gebied: tonen in het lagenmenu
function hutState(A, st){ A.hutState = st; if(S.area === A) renderHutInfo(); }
function renderHutInfo(){
  const el = $("hutInfo"), A = S.area; if(!el) return;
  if(!A || !S.hutsOn){ el.hidden = true; return; }
  const n = (A.huts || []).length, st = A.hutState;
  el.hidden = false;
  el.innerHTML = st === "loading" ? `<span>Hutten en restaurants laden…</span>`
    : st === "error" ? `<span>Ophalen lukte niet; de dienst is even druk.</span> <button type="button" class="linkbtn" id="hutRetry">Opnieuw proberen</button>`
    : st === "offline" ? `<span>Geen internet. De hutten verschijnen zodra je weer online bent.</span>`
    : n ? `<span>${n === 1 ? "1 hut of restaurant" : `${n} hutten en restaurants`} in dit gebied${map.getZoom() < 13 ? ". Zoom in om ze te zien." : "."}</span>`
    : `<span>Geen hutten of restaurants bekend bij de pistes in dit gebied.</span>`;
  $("hutRetry")?.addEventListener("click", () => { A.hutTry = 0; loadHuts(true); });
}
window.addEventListener("online", () => { const A = S.area; if(A && (A.hutState === "error" || A.hutState === "offline")) loadHuts(); });
function setHuts(A, list){
  A.hutState = "ok";
  A.huts = list.filter(x => A.nodes[x[4]]).map(x => ({lon:x[0], lat:x[1], kind:x[2], name:x[3], node:x[4]}));
  if(S.area === A) renderHutInfo();
  // namen ook in de zoeklijst voor de bestemming
  const extra = [];
  for(const hh of A.huts){ if(!hh.name) continue; const lab = `${HUT_KIND[hh.kind]?.[0] || "Restaurant"}: ${hh.name}`; if(!A.names.has(lab)){ A.names.set(lab, hh.node); extra.push(lab); } }
  if(extra.length) $("places").insertAdjacentHTML("beforeend", extra.map(x => `<option value="${esc(tr(x))}"></option>`).join(""));
  if(S.area === A) drawHuts();
}

// ================= offline =================
// staat de kaartdata van een gebied in de offline-opslag van de app?
async function isOffline(row){
  try{ return !!(await caches.match(`data/s${String(row[8]).padStart(3,"0")}.json?${DATA_V}`, {ignoreVary:true})); }catch(e){ return false; }
}
async function renderOffline(){
  const A = S.area, box = $("offlineBox"); if(!A || !box) return;
  const ok = "caches" in window && await isOffline(A.row), wx = wxStore(A.id);
  box.innerHTML = `<p class="label">Offline</p>
    <p class="off-line ${ok ? "ok" : ""}">${I(ok ? "check" : "cloud")}<span>${ok ? `<b>${esc(A.row[1])} staat op je telefoon.</b> Pistes, liften, routes, navigatie, status en dagboek werken zonder bereik.` : `<b>Nog niet offline.</b> Open dit gebied één keer met internet; daarna werkt het ook zonder bereik.`}</span></p>
    <p class="off-line">${I("snow")}<span>${wx ? `Laatste weerbericht bewaard om ${new Date(wx.t).toLocaleTimeString(LOCALE, {hour:"2-digit", minute:"2-digit"})}.` : "Nog geen weerbericht bewaard."}</span></p>
    <p class="off-line">${I("layers")}<span>Van de achtergrondkaart worden alleen de stukken bewaard die je hebt bekeken. Zoom thuis op wifi even rond over het gebied.</span></p>`;
}
$("layersBtn").addEventListener("click", () => setTimeout(renderOffline, 0));
// vinkje in de gebiedenlijst voor gebieden die al op de telefoon staan
async function markOfflineAreas(){
  if(!("caches" in window)) return;
  for(const b of document.querySelectorAll("#areas .area-main")){
    const r = S.index.find(x => x[0] === b.dataset.id);
    if(r && await isOffline(r) && !b.querySelector(".off-mark")) b.querySelector(".nm")?.insertAdjacentHTML("beforeend", ` <span class="off-mark" title="Staat offline op je telefoon">${I("check")}</span>`);
  }
}

// ================= openingstijden =================
$("liftOpen").value = S.liftOpen; $("liftClose").value = S.liftClose;
$("liftOpen").onchange = e => { if(e.target.value){ S.liftOpen = e.target.value; save(); update(); widgetArea(); } };
$("liftClose").onchange = e => { if(e.target.value){ S.liftClose = e.target.value; save(); update(); widgetArea(); } };

// een punt in het midden van het zichtbare deel van de kaart zetten (niet achter het paneel)
function showAt(ll, zoom){
  const z = zoom ?? map.getZoom(), sh = $("sheet");
  let dx = 0, dy = 0;
  if(LAND_MQ.matches || isSide()) dx = (sh.offsetWidth + 16) / 2;
  else if(!sh.classList.contains("open")) dy = -(sheetPeek()) / 2;
  const c = map.project(L.latLng(ll), z).subtract([dx, dy]);
  map.setView(map.unproject(c, z), z, {animate:true});
}

// ================= draaien =================
LAND_MQ.addEventListener("change", () => {
  setTimeout(() => { map.invalidateSize(); if(S.follow && S.pos) map.panTo([S.pos.lat, S.pos.lon]); else if(S.path?.length) fitRoute(); setPeek(); }, 250);
});

// ================= avondskiën =================
function setNight(on){
  S.night = on;
  $("nightToggle").checked = on; $("nightToggle2").checked = on;
  document.body.classList.toggle("night", on);
  if(!S.area){ return; }
  if(on && !S.area.litNodes.size) toast("In dit gebied zijn geen verlichte pistes bekend.", 3500);
  else if(on) toast(`Avondskiën: ${kmTxt(S.area.litKm)} km verlichte piste.`);
  S.wps = []; S.target = null; S.planBy = null; defaultRoute();
  drawPistes(); update(); if(S.path?.length) fitRoute();
}

// ================= live snelheidsmeter =================
// snelheid uit de GPS als die er is, anders uit de laatste twee posities (licht gladgestreken)
const SPD = {last:null, kmh:0, top:0, topDay:null};
function speedOnPos(p){
  const t = p.timestamp || Date.now(), c = p.coords;
  let v = c.speed != null && c.speed >= 0 ? c.speed * 3.6 : null;
  if(v == null && SPD.last){
    const dt = (t - SPD.last.t) / 1000;
    if(dt >= 1 && dt <= 20) v = meters(SPD.last.lat, SPD.last.lon, c.latitude, c.longitude) / dt * 3.6;
  }
  SPD.last = {t, lat:c.latitude, lon:c.longitude};
  if(v == null || !(c.accuracy < 40) || v > 140) v = SPD.kmh * .6;    // onbetrouwbaar: rustig laten zakken
  SPD.kmh = SPD.kmh ? SPD.kmh * .35 + v * .65 : v;
  if(SPD.topDay !== todayKey()){ SPD.topDay = todayKey(); SPD.top = 0; }
  if(SPD.kmh > SPD.top && c.accuracy < 25) SPD.top = SPD.kmh;
  renderSpeedo();
}
function renderSpeedo(){
  const box = $("speedo");
  const show = S.speedo && S.watch != null && S.pos && (S.follow || D.rec);
  box.hidden = !show; if(!show) return;
  const daySum = D.rec ? D.day?.sum : null;
  const top = Math.max(SPD.top, daySum?.vmax || 0), alt = sosAlt();
  $("spdNow").textContent = Math.round(SPD.kmh < 2 ? 0 : SPD.kmh);
  $("spdTop").textContent = Math.round(top);
  $("spdAlt").textContent = alt != null ? hmTxt(alt) : "–";
}

// ================= route wissen =================
// ================= zon en schaduw =================
// stand van de zon (hoogte en richting in graden) voor een tijdstip en plek
function sunPos(ms, lat, lon){
  const rad = Math.PI/180, d = ms/864e5 - 10957.5;
  const g = rad*(357.529 + .98560028*d), q = 280.459 + .98564736*d;
  const L_ = rad*(q + 1.915*Math.sin(g) + .02*Math.sin(2*g)), eps = rad*(23.439 - .00000036*d);
  const ra = Math.atan2(Math.cos(eps)*Math.sin(L_), Math.cos(L_)), dec = Math.asin(Math.sin(eps)*Math.sin(L_));
  const H = rad*(((18.697374558 + 24.06570982441908*d) % 24)*15 + lon) - ra, phi = rad*lat;
  const alt = Math.asin(Math.sin(phi)*Math.sin(dec) + Math.cos(phi)*Math.cos(dec)*Math.cos(H));
  const az = Math.atan2(-Math.sin(H)*Math.cos(dec), Math.cos(phi)*Math.sin(dec) - Math.sin(phi)*Math.cos(dec)*Math.cos(H));
  return {alt:alt/rad, az:(az/rad + 360) % 360};
}
// tijdzone van het skigebied (de zon hangt af van de klok daar, niet van die op je telefoon thuis)
function areaTz(){
  const row = S.index.find(r => r[0] === S.area?.id), cc = row?.[2], lon = row?.[4] ?? 10;
  if(cc === "US" || cc === "CA") return lon < -114 ? "America/Vancouver" : lon < -101 ? "America/Denver" : lon < -87 ? "America/Chicago" : "America/New_York";
  return cc === "FI" ? "Europe/Helsinki" : "Europe/Paris";
}
// we rekenen met nu, of met de opening als de liften dicht zijn; m = minuten op de klok in het skigebied
function sunTime(){
  const now = Date.now(); let m;
  try{ const p = new Intl.DateTimeFormat("en-GB", {timeZone:areaTz(), hour:"2-digit", minute:"2-digit", hourCycle:"h23"}).formatToParts(new Date(now));
       m = +p.find(x => x.type === "hour").value * 60 + +p.find(x => x.type === "minute").value; }
  catch(e){ const d = new Date(now); m = d.getHours()*60 + d.getMinutes(); }
  const open = toMin(S.liftOpen), close = toMin(S.liftClose);
  if(m >= open && m < close) return {ms:now, m};
  return {ms:now + ((m < open ? open - m : open + 1440 - m) * 6e4), m:open};
}
const SUN_MIN = .12;   // minder licht dan dit = schaduw (zon schuurt langs of staat achter de helling)
// per piste: hoe recht schijnt de zon erop (helling en richting van de piste; bergen die schaduw werpen tellen niet mee)
function sunShade(){
  const A = S.area, d = sunTime(), key = Math.floor(d.ms / 6e5);
  if(A.sun?.key === key) return A.sun;
  const c = A.bounds.getCenter(), {alt, az} = sunPos(d.ms, c.lat, c.lng), rad = Math.PI/180;
  const v = new Float32Array(A.edges.length).fill(-1), N = A.nodes;
  // bergen rondom: hoe lager de piste, hoe hoger de horizon (dalbodem ca. 12 graden, toppen vrij)
  let lo = Infinity, hi = -Infinity; for(const n of N) if(n.ele != null){ lo = Math.min(lo, n.ele); hi = Math.max(hi, n.ele); }
  if(alt > 2) for(const e of A.edges){
    if(e.t !== "r") continue;
    const ele = ((N[e.a].ele ?? lo) + (N[e.b].ele ?? lo)) / 2, hz = hi > lo ? 12 * (1 - (ele - lo) / (hi - lo)) : 0, a = alt - hz;
    if(a <= 0){ v[e.i] = -.2; continue; }
    const sl = Math.min(35, Math.max(6, Math.atan(Math.max(0, e.drop || 0) / Math.max(e.len, 1)) / rad)) * rad;
    let acc = 0, len = 0;
    for(let k = 0; k < e.pts.length - 1; k++){
      const l = meters(...e.pts[k], ...e.pts[k+1]); if(!l) continue;
      const asp = bearing(e.pts[k], e.pts[k+1]);   // pistes lopen bergaf: de rijrichting is de kant waar de helling naar toe kijkt
      acc += l * (Math.sin(a*rad)*Math.cos(sl) + Math.cos(a*rad)*Math.sin(sl)*Math.cos((az - asp)*rad)); len += l;
    }
    v[e.i] = len ? acc/len : -1;
  }
  return A.sun = {key, alt, az, v, time:d};
}
map.createPane("sun").style.cssText = "z-index:390;pointer-events:none";
const sunR = L.canvas({padding:.4, pane:"sun"}), sunLayer = L.layerGroup().addTo(map);
function drawSun(){
  sunLayer.clearLayers();
  const info = $("sunInfo"), A = S.area;
  if(!A || !S.sunOn || S.night){ info.hidden = true; return; }
  const sun = sunShade(); info.hidden = false;
  if(sun.alt <= 2){ info.textContent = `Om ${hhmm(sun.time.m)} staat de zon te laag. Alles ligt in de schaduw.`; return; }
  const lit = [], shade = [];
  for(const e of A.edges) if(e.t === "r" && !S.closed.has(e.i)) (sun.v[e.i] >= SUN_MIN ? lit : shade).push(e.pts);
  if(shade.length) L.polyline(shade, {renderer:sunR, interactive:false, color:"#5B8BC9", weight:12, opacity:.4, lineCap:"round"}).addTo(sunLayer);
  if(lit.length) L.polyline(lit, {renderer:sunR, interactive:false, color:"#FFC531", weight:14, opacity:.6, lineCap:"round"}).addTo(sunLayer);
  info.textContent = `Om ${hhmm(sun.time.m)}: ${Math.round(100*lit.length/Math.max(1, lit.length + shade.length))}% van de pistes in de zon (schatting).`;
}
function sunNote(edges){
  if(S.night) return "";
  const sun = sunShade(); if(sun.alt <= 2) return "";
  const A = S.area; let acc = 0, len = 0;
  for(const i of edges){ if(sun.v[i] === -1) continue; acc += sun.v[i] * A.edges[i].len; len += A.edges[i].len; }
  if(!len) return "";
  const lit = acc/len >= SUN_MIN, t = hhmm(sun.time.m);
  return `<p class="pop-sun ${lit ? "lit" : "shade"}">${I(lit ? "sun" : "cloud")}${lit ? `Om ${t} in de zon` : `Om ${t} in de schaduw`}</p>`;
}
setInterval(() => { if(S.area && (S.sunOn || S.sunny)){ drawSun(); if(S.sunny) update(); } }, 10*60000);

// ================= lunchstop =================
function lunchForm(){
  if(!requirePro("lunch")) return;
  const box = $("lunchBox"); if(!box) return;
  box.innerHTML = `<div class="lunch-form"><p class="label">Lunchstop</p>
    <div class="lf-row"><label>Lunchen rond<input type="time" id="lfAt" value="${S.lunchPref?.at || "12:30"}" step="300"></label>
    <label>Pauze<select id="lfDur">${[30, 45, 60, 90].map(m => `<option value="${m}"${m === (S.lunchPref?.dur || 60) ? " selected" : ""}>${m} min</option>`).join("")}</select></label></div>
    <div class="lf-btns"><button type="button" class="btn primary" id="lfGo">${I("food")}Zoek een plek</button><button type="button" class="btn ghost" id="lfCancel">Annuleren</button></div>
    <p class="m-hint">De app kiest een hut of restaurant op of vlak bij je route, waar je rond die tijd bent.</p></div>`;
  $("lfGo").onclick = () => planLunch($("lfAt").value || "12:30", +$("lfDur").value || 60);
  $("lfCancel").onclick = () => update();
}
function planLunch(at, dur){
  const A = S.area, huts = (A.huts || []).filter(h => A.nodes[h.node]);
  S.lunchPref = {at, dur};
  if(!S.path || !S.path.length){ toast("Kies eerst een route, dan zoekt de app een plek voor de lunch."); return; }
  if(!huts.length){ toast("In dit gebied zijn nog geen hutten of restaurants bekend. Open het gebied met internet en probeer het opnieuw.", 4000); return; }
  const want = toMin(at), t0 = startTime().t, base = S.path.reduce((t, x) => t + x.min, 0);
  // per knooppunt één plek; alleen plekken die je kunt bereiken, de 40 die het dichtst bij je route liggen
  const byNode = new Map(); for(const h of huts){ const o = byNode.get(h.node); if(!o || (!o.name && h.name)) byNode.set(h.node, h); }
  const reach = reachFrom(S.from), route = S.path.map(x => A.nodes[x.to]);
  const cands = [...byNode.values()].filter(h => reach[h.node] < Infinity)
    .map(h => ({h, d:Math.min(...route.map(p => meters(p.lat, p.lon, h.lat, h.lon)))})).sort((a, b) => a.d - b.d).slice(0, 40);
  const keep = S.lunch; let best = null;
  for(const {h} of cands){
    S.lunch = {n:h.node, at, dur};
    const p = computePath(); if(!p || S.lunchAt == null) continue;
    const eta = t0 + p.slice(0, S.lunchAt).reduce((t, x) => t + x.min, 0), extra = p.reduce((t, x) => t + x.min, 0) - base;
    const score = Math.abs(eta - want) + .6 * Math.max(0, extra) + (h.kind === "b" || h.kind === "f" ? 15 : 0) + (h.name ? 0 : 20);
    if(!best || score < best.score) best = {h, score, eta};
  }
  if(!best){ S.lunch = keep; update(); toast("Geen hut of restaurant gevonden die in je route past."); return; }
  const k = HUT_KIND[best.h.kind] || HUT_KIND.r;
  S.lunch = {n:best.h.node, at, dur, name:best.h.name || k[0], kind:best.h.kind};
  update(); fitRoute();
  const eta = S.lunch.eta ?? best.eta;
  toast(Math.abs(eta - want) > 30 ? `Lunch bij ${S.lunch.name} rond ${hhmm(eta)}. Dichter bij ${at} lukt niet met deze route.` : `Lunch bij ${S.lunch.name} rond ${hhmm(eta)}.`, 4000);
}

// ================= hotel of auto =================
// per skigebied één plek waar je 's avonds terug wilt zijn
const homeAll = () => { try{ return JSON.parse(localStorage.getItem("pp-home") || "{}"); }catch(e){ return {}; } };
const getHome = () => S.area ? homeAll()[S.area.id] || null : null;
const homeNode = () => { const h = getHome(); return h ? nearestNode(h.lat, h.lon).n : null; };
function homeBtnHtml(empty){
  const h = getHome();
  if(h) return `<button type="button" class="btn ghost" id="homeBtn" title="Route naar je ${h.kind === "auto" ? "auto" : "hotel"}">${I(h.kind === "auto" ? "car" : "bed")}${h.kind === "auto" ? "Naar je auto" : "Naar je hotel"}</button>`;
  return empty ? `<button type="button" class="linkbtn home-set" id="homeSet">${I("bed")}Hotel of auto bewaren</button>` : "";
}
function setHome(lat, lon, kind){
  S.pickHome = null; document.body.classList.remove("picking-home");
  const all = homeAll(); all[S.area.id] = {lat:+lat.toFixed(5), lon:+lon.toFixed(5), kind, t:Date.now()};
  try{ localStorage.setItem("pp-home", JSON.stringify(all)); }catch(e){}
  const nn = nearestNode(lat, lon);
  toast(`${kind === "auto" ? "Je auto" : "Je hotel"} is bewaard${nn.d > 60 ? `, ${km(nn.d)} van de dichtstbijzijnde piste of lift` : ""}.`, 3500);
  update();
}
function clearHome(){
  const all = homeAll(); delete all[S.area.id];
  try{ localStorage.setItem("pp-home", JSON.stringify(all)); }catch(e){}
  toast("Plek gewist."); update();
}
const homeLayer = L.layerGroup().addTo(map);
function drawHome(){
  homeLayer.clearLayers();
  const h = getHome(); if(!h) return;
  L.marker([h.lat, h.lon], {icon:L.divIcon({className:"", html:`<div class="home-pin">${I(h.kind === "auto" ? "car" : "bed")}</div>`, iconSize:[30,30], iconAnchor:[15,15]}), keyboard:false, zIndexOffset:450, title:h.kind === "auto" ? "Je auto" : "Je hotel"})
    .on("click", ev => { L.DomEvent.stopPropagation(ev); homeMenu(); }).addTo(homeLayer);
}
function homeMenu(){
  $("homePop")?.remove();
  if(!requirePro("home")) return;
  if(!S.area) return;
  const h = getHome(), div = document.createElement("div"); div.id = "homePop"; div.className = "home-pop"; div.setAttribute("role", "dialog");
  let kind = h?.kind || "hotel";
  div.innerHTML = `<div class="hp-head"><b>Waar wil je vanavond terug zijn?</b><button type="button" class="close-btn" id="hpClose" aria-label="Sluiten">${I("close")}</button></div>
    <div class="seg" id="hpKind"><button type="button" data-v="hotel">${I("bed")}Hotel</button><button type="button" data-v="auto">${I("car")}Auto</button></div>
    <div class="hp-btns"><button type="button" class="btn primary" id="hpHere">${I("locate")}Mijn huidige locatie</button><button type="button" class="btn ghost" id="hpMap">${I("flag")}Tik op de kaart</button>
    ${h ? `<button type="button" class="btn ghost" id="hpGo">${I("route")}Route erheen</button><button type="button" class="btn ghost" id="hpDel">${I("trash")}Wissen</button>` : ""}</div>
    <p class="m-hint">${h ? "Al bewaard. Kies opnieuw om de plek te veranderen." : "Bewaar 's ochtends waar je logeert of geparkeerd staat. Aan het eind van de dag brengt één knop je terug."}</p>`;
  document.body.appendChild(div);
  const seg = () => div.querySelectorAll("#hpKind button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === kind)));
  seg(); div.querySelectorAll("#hpKind button").forEach(b => b.onclick = () => { kind = b.dataset.v; seg(); });
  const close = () => div.remove();
  $("hpClose").onclick = close;
  $("hpHere").onclick = () => {
    if(S.pos){ close(); setHome(S.pos.lat, S.pos.lon, kind); return; }
    if(!startWatch()) return;
    toast("Locatie zoeken…");
    const t = setInterval(() => { if(S.pos){ clearInterval(t); close(); setHome(S.pos.lat, S.pos.lon, kind); } }, 500); setTimeout(() => clearInterval(t), 30000);
  };
  $("hpMap").onclick = () => { close(); S.pickHome = kind; document.body.classList.add("picking-home"); if(!isSide()) setSheet(false); toast(`Tik op de kaart waar je ${kind === "auto" ? "auto staat" : "hotel is"}.`, 4000); };
  $("hpGo")?.addEventListener("click", () => { close(); goHome(); });
  $("hpDel")?.addEventListener("click", () => { close(); clearHome(); });
}
function goHome(){
  if(!requirePro("home")) return;
  const h = getHome(); if(!h){ homeMenu(); return; }
  let from = S.from;
  if(S.pos && (S.fromMe || S.follow || from == null)){ from = nearestNode(S.pos.lat, S.pos.lon).n; S.fromMe = true; }
  if(from == null){ toast("Kies eerst waar je nu bent (A), of zet je locatie aan."); return; }
  const to = homeNode();
  if(to === from){ toast(h.kind === "auto" ? "Je bent al bij je auto." : "Je bent al bij je hotel."); return; }
  S.from = from; S.to = to; S.via = null; S.target = null; S.wps = []; S.lunch = null; S.planBy = null; S.pick = "from";
  update(); fitRoute();
}

// ================= Skipilot Pro =================
// Op de website loopt betalen via Lemon Squeezy (zij zijn de verkoper en regelen btw en terugbetaling).
// Na de aankoop krijg je een licentiecode; die wordt hier één keer geactiveerd en daarna eens per week gecontroleerd.
// In de iOS-app is Pro een eenmalige aankoop in de App Store (StorePlugin.swift); Apple houdt bij wie hem gekocht heeft.
// Zolang Pro in config.js niet aan staat, kan iedereen alles gebruiken.
const PRO_CFG = window.PP_CONFIG?.pro || {};
const IOS_PRO = window.PP_STORE === "ios" ? PRO_CFG.ios || {} : null;
// in de Play Store-app mag niet buiten Google Play om betaald worden: daar is alles vrij tot er Play Billing is
const proLive = () => IOS_PRO ? !!(IOS_PRO.enforce && IOS_PRO.productId)
  : window.PP_STORE === "web" && (!!(PRO_CFG.enforce && PRO_CFG.checkout) || /[?&]pro=preview/.test(location.search));
const PRO_FEATURES = [
  ["group", "group", "Een groep maken en de route voor iedereen starten"],
  ["lunch", "food", "Lunchstop bij een hut op het juiste moment"],
  ["sun", "sun", "Zon en schaduw, en routes door de zon"],
  ["home", "bed", "Terug naar je hotel of auto"],
  ["season", "calendar", "Seizoensoverzicht en persoonlijke records"],
  ["gpx", "share", "Je skidagen als GPX-bestand"]
];
let PRO = (() => { try{ return JSON.parse(localStorage.getItem("pp-pro") || "null"); }catch(e){ return null; } })();
const proSave = () => { try{ PRO ? localStorage.setItem("pp-pro", JSON.stringify(PRO)) : localStorage.removeItem("pp-pro"); }catch(e){} };
const proActive = () => PRO?.store === "ios" || !!(PRO?.key && !["expired", "disabled"].includes(PRO.status) && !(PRO.expires && Date.parse(PRO.expires) < Date.now()));
const isPro = () => !proLive() || proActive();
function requirePro(f){ if(isPro()) return true; openPro(f); return false; }
const proTeaser = f => `<div class="pro-teaser">${I("star")}<span><b>${esc(PRO_FEATURES.find(x => x[0] === f)?.[2] || "Deze functie")}</b> hoort bij Skipilot Pro.</span><button type="button" class="btn ghost" onclick="openPro('${f}')">Bekijk Pro</button></div>`;
const LS_API = "https://api.lemonsqueezy.com/v1/licenses/";
async function lsCall(action, params){
  const r = await fetch(LS_API + action, {method:"POST", headers:{Accept:"application/json", "Content-Type":"application/x-www-form-urlencoded"}, body:new URLSearchParams(params)});
  return r.json();
}
// alleen codes van onze eigen winkel en ons eigen product tellen
const proMatches = m => (!PRO_CFG.storeId || m?.store_id === PRO_CFG.storeId) && (!PRO_CFG.productId || m?.product_id === PRO_CFG.productId);
async function proActivate(key){
  key = (key || "").trim();
  if(!key){ toast("Vul je licentiecode in."); return; }
  try{
    const d = await lsCall("activate", {license_key:key, instance_name:"Skipilot op " + (/iPhone|iPad/.test(navigator.userAgent) ? "iPhone" : /Android/.test(navigator.userAgent) ? "Android" : "computer")});
    if(!d.activated){ toast(/limit/i.test(d.error || "") ? "Deze code is al op het maximale aantal apparaten gebruikt. Zet Pro eerst uit op een ander apparaat." : "Deze code werkt niet. Controleer of je hem goed hebt overgenomen.", 4500); return; }
    if(!proMatches(d.meta)){ toast("Deze code hoort niet bij Skipilot."); return; }
    PRO = {key, instance:d.instance?.id || null, status:d.license_key?.status || "active", expires:d.license_key?.expires_at || null, checked:Date.now(), email:d.meta?.customer_email || ""};
    proSave(); renderPro(); openPro(); update();
    toast("Pro staat aan. Veel skiplezier!", 3500);
  }catch(e){ toast("Geen verbinding met de licentieserver. Probeer het later opnieuw."); }
}
// ---- App Store (iOS-app) ----
const appStore = (method, extra) => window.Capacitor.nativePromise("Store", method, {id:IOS_PRO.productId, ...extra});
let iosPrice = null;
// bij elke start: de App Store weet het ook zonder internet, en een terugbetaalde aankoop valt zo weer weg
async function iosCheck(){
  try{ const {owned} = await appStore("owned"); iosOwned(owned); }catch(e){}
}
function iosOwned(owned){
  if(owned === (PRO?.store === "ios")) return;
  PRO = owned ? {store:"ios"} : null; proSave(); renderPro(); update();
  if($("proDlg")) openPro();
}
async function iosBuy(){
  const b = $("proBuy"); if(b) b.disabled = true;
  try{
    const {state} = await appStore("buy");
    if(state === "bought"){ iosOwned(true); toast("Pro staat aan. Veel skiplezier!", 3500); }
    else if(state === "pending") toast("De aankoop wacht op goedkeuring. Pro gaat vanzelf aan zodra hij rond is.", 4500);
  }catch(e){ toast("De App Store is nu niet bereikbaar. Probeer het later opnieuw.", 4000); }
  if(b) b.disabled = false;
}
async function iosRestore(){
  try{
    const {owned} = await appStore("restore");
    if(owned){ iosOwned(true); toast("Pro is teruggezet. Veel skiplezier!", 3500); }
    else toast("Geen eerdere aankoop van Pro gevonden op deze Apple ID.", 4000);
  }catch(e){ toast("De App Store is nu niet bereikbaar. Probeer het later opnieuw.", 4000); }
}
async function iosLoadPrice(){
  if(iosPrice) return;
  try{ iosPrice = (await appStore("product")).price; const el = $("proPrice"); if(el) el.textContent = iosPrice; }catch(e){}
}

// eens per week kijken of de code nog geldig is; zonder internet blijft Pro gewoon werken
async function proCheck(){
  if(IOS_PRO){ if(proLive()) iosCheck(); return; }
  if(!proLive() || !PRO?.key || !navigator.onLine || Date.now() - (PRO.checked || 0) < 7*864e5) return;
  try{
    const d = await lsCall("validate", {license_key:PRO.key, ...(PRO.instance ? {instance_id:PRO.instance} : {})});
    if(d.license_key){ if(!proMatches(d.meta)) PRO = null; else Object.assign(PRO, {status:d.license_key.status, expires:d.license_key.expires_at, checked:Date.now()}); }
    else if(/not found/i.test(d.error || "")) PRO = null;
    proSave(); renderPro();
  }catch(e){}
}
async function proDeactivate(){
  if(PRO?.instance){ try{ await lsCall("deactivate", {license_key:PRO.key, instance_id:PRO.instance}); }catch(e){} }
  PRO = null; proSave(); renderPro(); openPro(); update();
  toast("Pro staat uit op dit apparaat. Je kunt je code nu op een ander apparaat gebruiken.", 4000);
}
function openPro(f){
  $("proDlg")?.remove();
  const feat = PRO_FEATURES.find(x => x[0] === f), on = proActive();
  const div = document.createElement("div"); div.id = "proDlg"; div.className = "pro-dlg"; div.setAttribute("role", "dialog"); div.setAttribute("aria-modal", "true");
  div.innerHTML = `<div class="pro-card">
    <div class="pro-head"><img src="icons/logo.svg" alt="" width="44" height="44"><div><p class="label">Skipilot</p><h2>Pro</h2></div><button type="button" class="icon-btn" id="proClose" aria-label="Sluiten">${I("close")}</button></div>
    ${feat && !on ? `<p class="pro-why">${I(feat[1])}<span><b>${esc(feat[2])}</b> hoort bij Pro.</span></p>` : ""}
    ${on ? `<p class="pro-on">${I("check")}<span><b>Pro staat aan op dit apparaat.</b>${PRO.store === "ios" ? " Gekocht via de App Store." : PRO.email ? ` Gekocht met ${esc(PRO.email)}.` : ""}</span></p>` : ""}
    <ul class="pro-list">${PRO_FEATURES.map(([, ic, t]) => `<li>${I(ic)}<span>${esc(t)}</span></li>`).join("")}</ul>
    <p class="m-hint">Alles voor je veiligheid blijft gratis: route plannen, navigatie, weer, de laatste-liftwaarschuwing en SOS. Meedoen met een groep is ook gratis.</p>
    ${on ? (IOS_PRO ? "" : `<button type="button" class="btn ghost" id="proOff">Pro op dit apparaat uitzetten</button>`) : IOS_PRO ? `
      <div class="pro-buy"><div class="pro-price"><b id="proPrice">${esc(iosPrice || PRO_CFG.price || "")}</b><span>${esc(PRO_CFG.period || "")}</span></div>
      <button type="button" class="btn primary" id="proBuy">${I("star")}Koop Pro</button></div>
      <button type="button" class="btn ghost" id="proRestore">Aankopen herstellen</button>
      <p class="m-hint">Eenmalige aankoop via de App Store. Werkt op al je iPhones met dezelfde Apple ID.</p>` : `
      <div class="pro-buy"><div class="pro-price"><b>${esc(PRO_CFG.price || "")}</b><span>${esc(PRO_CFG.period || "")}</span></div>
      ${PRO_CFG.checkout ? `<a class="btn primary" id="proBuy" href="${esc(PRO_CFG.checkout)}" target="_blank" rel="noopener">${I("star")}Koop Pro</a>` : `<button type="button" class="btn primary" disabled>Binnenkort te koop</button>`}</div>
      <p class="label">Heb je al een licentiecode?</p>
      <div class="pro-key"><input type="text" id="proKey" placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX" autocomplete="off" autocapitalize="characters" spellcheck="false"><button type="button" class="btn ghost" id="proAct">Activeren</button></div>
      <p class="m-hint">Na het betalen krijg je de code per e-mail. Je kunt hem op meerdere eigen apparaten gebruiken.</p>`}
    <p class="pro-links"><a href="privacy.html" target="_blank" rel="noopener">Privacyverklaring</a> · <a href="voorwaarden.html" target="_blank" rel="noopener">Voorwaarden</a></p>
  </div>`;
  document.body.appendChild(div);
  const close = () => div.remove();
  $("proClose").onclick = close;
  div.addEventListener("click", e => { if(e.target === div) close(); });
  $("proAct")?.addEventListener("click", () => proActivate($("proKey").value));
  $("proKey")?.addEventListener("keydown", e => { if(e.key === "Enter") proActivate(e.target.value); });
  $("proOff")?.addEventListener("click", proDeactivate);
  $("proRestore")?.addEventListener("click", iosRestore);
  if(IOS_PRO){ $("proBuy")?.addEventListener("click", iosBuy); iosLoadPrice(); }
}
function renderPro(){
  const sec = $("proSec"); if(!sec) return;
  sec.hidden = !proLive();
  $("proState").textContent = proActive() ? "Pro staat aan op dit apparaat." : "Groepen, lunchstop, zon en schaduw, je hotel of auto, en je seizoensrecords.";
  $("proMore").textContent = tr(proActive() ? "Beheer Pro" : "Bekijk Pro");
  // zonder Pro staan de Pro-instellingen uit, ook als ze eerder aan stonden
  if(!isPro() && (S.sunOn || S.sunny)){ S.sunOn = S.sunny = false; save(); if(S.area){ drawSun(); } }
}
$("proMore").onclick = () => openPro();
renderPro(); setTimeout(proCheck, IOS_PRO ? 0 : 5000);

// navigatie stoppen en alles van de route van het scherm halen; daarna direct een nieuwe kiezen
function clearRoute(){
  if(S.follow) toggleFollow();
  if(S.draw) stopDraw();
  map.closePopup();
  S.from = null; S.to = null; S.via = null; S.target = null; S.wps = []; S.planBy = null; S.fromMe = false; S.pick = "from"; S.lunch = null;
  profMarker?.remove(); profMarker = null;
  update(); setPeek();
  if(!isSide()) setSheet(false);
  toast("Route gewist. Tik op de kaart voor een nieuwe.");
}

// ================= menu en instellingen =================
const APP_VERSION = "2.0";
function applyTheme(){
  let t = "auto"; try{ t = localStorage.getItem("pp-theme") || "auto"; }catch(e){}
  if(t === "auto") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  document.querySelectorAll("#themeSeg button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === t)));
}
applyTheme();
document.querySelectorAll("#themeSeg button").forEach(b => b.onclick = () => { try{ localStorage.setItem("pp-theme", b.dataset.v); }catch(e){} applyTheme(); });
function syncMenu(){
  document.querySelectorAll("#pace button").forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.v === S.pace)));
  $("navAwake").checked = S.navAwake; $("speedoToggle").checked = S.speedo; $("noDrag").checked = S.noDrag; $("noMogul").checked = S.noMogul; $("sunny").checked = S.sunny; $("nightToggle").checked = S.night;
  $("setName").value = G.name || "";
  $("menuVer").textContent = `Versie ${APP_VERSION} · ${S.index.length.toLocaleString(LOCALE)} skigebieden · kaartdata ${DATA_V}`;
  renderStorage(); renderInstall();
}
async function renderStorage(){
  let routes = 0, days = 0;
  try{ for(let i = 0; i < localStorage.length; i++){ const k = localStorage.key(i) || "";
    if(k.startsWith("pp-routes:")) routes += (JSON.parse(localStorage.getItem(k) || "[]")).length;
    if(k.startsWith("pp-day:")) days++; } }catch(e){}
  let used = "";
  try{ const est = await navigator.storage?.estimate?.(); if(est?.usage) used = `${(est.usage/1048576).toFixed(0)} MB in gebruik · `; }catch(e){}
  $("storageInfo").textContent = `${used}${routes} bewaarde ${routes === 1 ? "route" : "routes"} · ${days} ${days === 1 ? "skidag" : "skidagen"} in het dagboek`;
}
// wissen gaat in twee tikken: eerst vragen, dan doen
document.querySelectorAll("[data-clear]").forEach(b => b.onclick = async () => {
  if(!b.classList.contains("sure")){
    document.querySelectorAll("[data-clear].sure").forEach(x => { x.classList.remove("sure"); x.textContent = x.dataset.label; });
    b.dataset.label = b.textContent; b.classList.add("sure"); b.textContent = "Tik nogmaals om te wissen"; return;
  }
  const what = b.dataset.clear;
  const drop = pre => { try{ for(let i = localStorage.length - 1; i >= 0; i--){ const k = localStorage.key(i); if(k?.startsWith(pre)) localStorage.removeItem(k); } }catch(e){} };
  if(what === "routes"){ drop("pp-routes:"); toast("Je bewaarde routes zijn gewist."); }
  if(what === "diary"){ if(D.rec) stopRec(); drop("pp-day:"); D.day = null; D.view = null; drawTrack(); diaryLive(); toast("Je skidagboek is gewist."); }
  if(what === "offline"){ try{ for(const k of await caches.keys()) if(k.startsWith("tiles") || k.startsWith("data")) await caches.delete(k); }catch(e){} drop("pp-huts:"); drop("pp-wx:"); toast("Offline kaart gewist. Hij wordt opnieuw opgehaald zodra je hem bekijkt."); }
  if(what === "all"){
    try{ localStorage.clear(); }catch(e){}
    try{ for(const k of await caches.keys()) await caches.delete(k); }catch(e){}
    try{ for(const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); }catch(e){}
    location.replace(location.pathname); return;
  }
  b.classList.remove("sure"); b.textContent = b.dataset.label; renderStorage();
});
// installeren als app
let installEvt = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e; if(!$("menu").hidden) renderInstall(); });
window.addEventListener("appinstalled", () => { installEvt = null; toast("Skipilot staat nu tussen je apps."); renderInstall(); });
function renderInstall(){
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone || window.PP_STORE !== "web";
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const card = (txt, btn) => `<div class="install-card"><img src="icons/logo.svg" alt="" width="44" height="44"><div>${txt}</div>${btn || ""}</div>`;
  $("installBox").innerHTML = standalone ? card(`<b>Geïnstalleerd</b>Je gebruikt Skipilot als app.`)
    : installEvt ? card(`<b>Installeer als app</b>Met een eigen icoon, schermvullend en offline.`, `<button type="button" class="btn primary" id="installBtn">Installeren</button>`)
    : ios ? card(`<b>Op je beginscherm zetten</b>Tik in Safari op het deel-icoon en kies <b style="display:inline">Zet op beginscherm</b>.`)
    : card(`<b>Op je beginscherm zetten</b>Open het browsermenu (⋮) en kies <b style="display:inline">App installeren</b> of <b style="display:inline">Toevoegen aan startscherm</b>.`);
  $("installBtn")?.addEventListener("click", async () => { if(!installEvt) return; installEvt.prompt(); try{ await installEvt.userChoice; }catch(e){} installEvt = null; renderInstall(); });
}
function openMenu(){ $("menu").hidden = false; syncMenu(); fillAds("menu"); }
function closeMenu(){ $("menu").hidden = true; document.querySelectorAll("[data-clear].sure").forEach(x => { x.classList.remove("sure"); x.textContent = x.dataset.label; }); }
$("menuBtn").onclick = openMenu;
$("menuClose").onclick = closeMenu;
document.addEventListener("keydown", e => { if(e.key === "Escape" && !$("menu").hidden) closeMenu(); });
$("menuLayers").onclick = e => { e.stopPropagation(); closeMenu(); $("layerMenu").hidden = false; renderOffline(); };
document.querySelectorAll("#pace button").forEach(b => b.onclick = () => { S.pace = +b.dataset.v; syncMenu(); update(); });
$("navAwake").onchange = e => { S.navAwake = e.target.checked; save(); keepAwake(); };
$("speedoToggle").onchange = e => { S.speedo = e.target.checked; save(); renderSpeedo(); };
$("noDrag").onchange = e => { S.noDrag = e.target.checked; save(); update(); };
$("noMogul").onchange = e => { S.noMogul = e.target.checked; save(); update(); };
$("sunny").onchange = e => { if(e.target.checked && !requirePro("sun")){ e.target.checked = false; return; } S.sunny = e.target.checked; save(); update(); };
$("sunToggle").onchange = e => { if(e.target.checked && !requirePro("sun")){ e.target.checked = false; return; } S.sunOn = e.target.checked; save(); drawSun(); };
$("sunToggle").checked = S.sunOn;
$("nightToggle").onchange = e => setNight(e.target.checked);
$("nightToggle2").onchange = e => setNight(e.target.checked);
$("setName").onchange = e => { const v = e.target.value.trim().slice(0, 20); if(!v) return; G.name = v; gSave(); $("gName").value = v; toast(`Je naam is nu ${v}.`); };

// ================= taal =================
i18nStart();
document.querySelectorAll("#langSeg button").forEach(b => {
  b.setAttribute("aria-pressed", String(b.dataset.v === LANG));
  b.onclick = () => { if(b.dataset.v !== LANG) setLang(b.dataset.v); };
});

// ================= start =================
if("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register("sw.js").catch(() => {});
applyBase(); update(); setPeek();
(async () => {
  try{ const r = await fetch(`data/index.json?${DATA_V}`); if(!r.ok) throw new Error(r.status); S.index = await r.json(); }
  catch(e){ hideSplash(); $("areaStats").textContent = "Lijst kon niet laden. Herlaad de app."; return; }
  renderCountries();
  parseShareHash();
  const nAreas = S.index.length.toLocaleString(LOCALE);
  $("pickerCount").textContent = `${nAreas} skigebieden`;
  const st = $("splashTag"); if(st) st.textContent = `${nAreas} skigebieden`;
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
  diaryLive(); drawTrack();
  if(D.rec){ startWatch(); keepAwake(); toast("Het skidagboek neemt weer op."); }
})();
