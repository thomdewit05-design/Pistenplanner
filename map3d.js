"use strict";
// 3D-kaart met echte bergen: MapLibre GL met hoogtegegevens van de AWS Terrain Tiles (Mapzen, vrij te gebruiken).
// Wordt pas geladen als je hem gebruikt. Twee standen:
//   "view": rondkijken; met twee vingers draaien en kantelen, tikken op pistes, liften en hutten werkt zoals op de platte kaart
//   "nav":  navigeren; de camera hangt achter je en kijkt in je richting, zoals een autonavigatie
// De gewone (Leaflet-)kaart blijft eronder bestaan; daar gebeurt de planning, deze kaart laat hetzelfde in 3D zien.
const M3 = (() => {
  const LIB = "vendor/maplibre/maplibre-gl.js?v=5.24.0", CSS = "vendor/maplibre/maplibre-gl.css?v=5.24.0";
  // hoogtetegels via een eigen protocol, zodat we foute pixels eruit kunnen halen (zie despike)
  const DEM = "skidem://elevation-tiles-prod/terrarium/{z}/{x}/{y}.png", DEM_HOST = "https://s3.amazonaws.com/";
  const DEM_ATTR = 'Hoogte: <a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noopener">Mapzen Terrain Tiles</a>';
  const EMPTY = {type:"FeatureCollection", features:[]}, EXAG = 1.3;
  const HANDLERS = ["dragPan", "dragRotate", "scrollZoom", "touchZoomRotate", "doubleClickZoom", "keyboard", "touchPitch", "boxZoom"];
  let gl = null, mode = null, loading = null, failed = false, styled = false, dirty = new Set(), flushT = null;
  let me = null, pop = null, proto = false;
  const SCALE = 2;   // plaatjes voor pistenummers en hutten op dubbele resolutie
  const HUT_COL = {h:"#7A2E0E", r:"#8A4B12", f:"#8A4B12", c:"#6B3FA0", b:"#6B3FA0", p:"#1F5FCC", v:"#0F7A6B", d:"#4A5A6E", s:"#C2410C", o:"#15803D"};

  const supported = (() => {
    try{ const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); }catch(e){ return false; }
  })();
  const loaded = () => !!window.maplibregl && !failed;
  function load(){
    if(window.maplibregl) return Promise.resolve();
    return loading ||= new Promise((ok, bad) => {
      const l = document.createElement("link"); l.rel = "stylesheet"; l.href = CSS; document.head.appendChild(l);
      const s = document.createElement("script"); s.src = LIB; s.async = true;
      s.onload = () => ok(); s.onerror = () => { loading = null; s.remove(); bad(new Error("3D-kaart laden mislukt")); };
      document.head.appendChild(s);
    });
  }

  // dezelfde ondergrond als de platte kaart (satelliet, terrein of kaart), ook als die in config.js is aangepast
  function baseTiles(){
    const b = baseLayers[S.base], o = b.options, url = b._url.replace("{r}", "");
    const subs = typeof o.subdomains === "string" ? o.subdomains.split("") : (o.subdomains || []);
    return {tiles:url.includes("{s}") ? subs.map(s => url.replace("{s}", s)) : [url], maxzoom:o.maxNativeZoom ?? o.maxZoom ?? 18, attribution:o.attribution || ""};
  }
  function style(){
    const bt = baseTiles(), line = {"line-cap":"round", "line-join":"round"};
    const w = (a, b) => ["interpolate", ["linear"], ["zoom"], 11, a, 16, b];
    return {
      version:8,
      sources:{
        base:{type:"raster", tiles:bt.tiles, tileSize:256, maxzoom:bt.maxzoom, attribution:bt.attribution},
        dem:{type:"raster-dem", tiles:[DEM], tileSize:256, maxzoom:15, encoding:"terrarium", attribution:DEM_ATTR},
        // aparte bron voor de schaduw (zelfde bron als het terrein geeft fouten in het tekenen); wordt bij satelliet niet geladen
        shade:{type:"raster-dem", tiles:[DEM], tileSize:256, maxzoom:15, encoding:"terrarium"},
        pistes:{type:"geojson", data:EMPTY}, route:{type:"geojson", data:EMPTY}, nums:{type:"geojson", data:EMPTY}, huts:{type:"geojson", data:EMPTY}
      },
      layers:[
        {id:"bg", type:"background", paint:{"background-color":"#E6EDF3"}},
        {id:"base", type:"raster", source:"base", paint:{"raster-fade-duration":150}},
        // reliëfschaduw alleen op terrein- en gewone kaart; een satellietfoto heeft zelf al schaduw
        {id:"shade", type:"hillshade", source:"shade", layout:{visibility:S.base === "sat" ? "none" : "visible"}, paint:{"hillshade-exaggeration":.4, "hillshade-shadow-color":"#33435A", "hillshade-highlight-color":"#FFFFFF"}},
        {id:"run-case", type:"line", source:"pistes", filter:["==", ["get", "k"], "r"], layout:line, paint:{"line-color":"#fff", "line-width":w(3, 7), "line-opacity":.6}},
        {id:"run", type:"line", source:"pistes", filter:["all", ["==", ["get", "k"], "r"], ["!=", ["get", "f"], 1]], layout:line, paint:{"line-color":["get", "col"], "line-width":w(1.8, 4)}},
        {id:"run-route", type:"line", source:"pistes", filter:["all", ["==", ["get", "k"], "r"], ["==", ["get", "f"], 1]], layout:line, paint:{"line-color":["get", "col"], "line-width":w(1.8, 4), "line-dasharray":[2, 1.4]}},
        {id:"lift-case", type:"line", source:"pistes", filter:["in", ["get", "k"], ["literal", ["lift", "drag"]]], layout:line, paint:{"line-color":"#fff", "line-width":w(2.5, 5), "line-opacity":.85}},
        {id:"lift", type:"line", source:"pistes", filter:["==", ["get", "k"], "lift"], layout:line, paint:{"line-color":"#14202B", "line-width":w(1.2, 2.2)}},
        {id:"drag", type:"line", source:"pistes", filter:["==", ["get", "k"], "drag"], layout:line, paint:{"line-color":"#14202B", "line-width":w(1, 1.8), "line-dasharray":[2.5, 2]}},
        {id:"closed", type:"line", source:"pistes", filter:["==", ["get", "k"], "closed"], layout:line, paint:{"line-color":"#9AA7B2", "line-width":w(1.5, 3), "line-dasharray":[1, 3]}},
        {id:"station", type:"circle", source:"pistes", filter:["==", ["get", "k"], "st"], paint:{"circle-radius":w(1.5, 3.5), "circle-color":"#14202B", "circle-stroke-color":"#fff", "circle-stroke-width":1.5, "circle-pitch-alignment":"map"}},
        {id:"route-case", type:"line", source:"route", filter:["==", ["get", "k"], "p"], layout:line, paint:{"line-color":"#0F1B2A", "line-width":w(7, 14), "line-opacity":.45}},
        {id:"route", type:"line", source:"route", filter:["==", ["get", "k"], "p"], layout:line, paint:{"line-color":"#FFC400", "line-width":w(4, 8.5)}},
        {id:"route-core", type:"line", source:"route", filter:["==", ["get", "k"], "p"], layout:line, paint:{"line-color":"#0F1B2A", "line-width":w(1.2, 2.5), "line-dasharray":[.2, 3]}},
        {id:"target", type:"line", source:"route", filter:["==", ["get", "k"], "t"], layout:line, paint:{"line-color":"#fff", "line-width":w(1.5, 3), "line-dasharray":[3, 2.5]}},
        // pistenummers en hutten als plaatjes in de kaart zelf (veel lichter dan losse HTML-knopjes die elk beeld opnieuw geplaatst worden)
        {id:"nums", type:"symbol", source:"nums", minzoom:12.5, layout:{"icon-image":["get", "img"], "icon-padding":1}},
        {id:"huts", type:"symbol", source:"huts", minzoom:12, filter:["!=", ["get", "kind"], "o"], layout:{"icon-image":["get", "img"], "icon-allow-overlap":true, "icon-size":["interpolate", ["linear"], ["zoom"], 12, .75, 15, 1]}},
        {id:"bus", type:"symbol", source:"huts", minzoom:13.5, filter:["==", ["get", "kind"], "o"], layout:{"icon-image":["get", "img"], "icon-allow-overlap":true, "icon-size":.85}}
      ],
      sky:{"sky-color":"#4F86C6", "horizon-color":"#D7E6F3", "fog-color":"#E8EFF5", "sky-horizon-blend":.55, "horizon-fog-blend":.55, "fog-ground-blend":.2,
           "atmosphere-blend":["interpolate", ["linear"], ["zoom"], 0, 1, 10, 1, 12, 0]},
      terrain:{source:"dem", exaggeration:EXAG}
    };
  }

  // ---------- gegevens van de platte kaart overnemen ----------
  const ll = p => [p[1], p[0]];
  function pistesData(){
    const A = S.area; if(!A || !S.pistes) return EMPTY;
    const f = [], st = new Set();
    for(const e of A.edges){
      if(e.t === "w") continue;
      const k = S.closed.has(e.i) ? "closed" : e.t === "r" ? "r" : DRAG.has(e.kind) ? "drag" : "lift";
      if(e.t === "l"){ st.add(e.a); st.add(e.b); }
      f.push({type:"Feature", properties:{i:e.i, k, col:e.t === "r" ? DIFF[e.diff].col : "#14202B", f:e.diff === "f" ? 1 : 0}, geometry:{type:"LineString", coordinates:e.pts.map(ll)}});
    }
    st.forEach(n => f.push({type:"Feature", properties:{k:"st", n}, geometry:{type:"Point", coordinates:[A.nodes[n].lon, A.nodes[n].lat]}}));
    return {type:"FeatureCollection", features:f};
  }
  function routeData(){
    const A = S.area, f = [];
    if(A && S.path?.length) f.push({type:"Feature", properties:{k:"p"}, geometry:{type:"MultiLineString", coordinates:S.path.map(s => s.e.pts.map(ll))}});
    if(A && S.target) f.push({type:"Feature", properties:{k:"t"}, geometry:{type:"MultiLineString", coordinates:S.target.edges.map(i => A.edges[i].pts.map(ll))}});
    return {type:"FeatureCollection", features:f};
  }
  // ---------- hoogtetegels opschonen ----------
  // De AWS-tegels hebben op lage zoom losse foute pixels (honderden meters te hoog of te laag); die gaven rare pieken die
  // verdwenen als je inzoomde. Een pixel dat ver afwijkt van zijn buren krijgt de mediaan van die buren; onder zee = 0 m.
  const cv = document.createElement("canvas"), cx = cv.getContext("2d", {willReadFrequently:true});
  async function bitmap(src){
    try{ return await createImageBitmap(src, {premultiplyAlpha:"none", colorSpaceConversion:"none"}); }catch(e){ return createImageBitmap(src); }
  }
  async function demLoad(params, abort){
    const url = params.url.replace("skidem://", DEM_HOST), z = +url.split("/").slice(-3)[0];
    const res = await fetch(url, {signal:abort.signal});
    if(!res.ok) throw new Error(`hoogtetegel ${res.status}`);
    const bmp = await bitmap(await res.blob()), W = bmp.width, H = bmp.height;
    if(cv.width !== W || cv.height !== H){ cv.width = W; cv.height = H; }
    cx.clearRect(0, 0, W, H); cx.drawImage(bmp, 0, 0); bmp.close?.();
    const img = cx.getImageData(0, 0, W, H);
    return {data:despike(img, z) ? await bitmap(img) : await bitmap(cv)};
  }
  function despike(img, z){
    const d = img.data, W = img.width, H = img.height, h = new Float32Array(W * H);
    for(let i = 0; i < W * H; i++) h[i] = d[4*i] * 256 + d[4*i+1] + d[4*i+2] / 256 - 32768;
    const T = z <= 9 ? 350 : z <= 11 ? 220 : 150, nb = new Float32Array(8);
    let fixed = 0;
    for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){
      const i = y * W + x, v = h[i];
      let n = 0, sum = 0;
      for(let dy = -1; dy <= 1; dy++) for(let dx = -1; dx <= 1; dx++){
        if(!dx && !dy) continue;
        const yy = Math.min(H - 1, Math.max(0, y + dy)), xx = Math.min(W - 1, Math.max(0, x + dx)), q = h[yy * W + xx];
        nb[n++] = q; sum += q;
      }
      if(v >= 0 && Math.abs(v - sum / 8) <= T) continue;
      const m = nb.sort()[4];                                  // mediaan van de buren (de 8 zijn net gesorteerd)
      const out = Math.max(0, Math.abs(v - m) > T ? m : v);
      if(out === v) continue;
      const e = out + 32768, r = Math.floor(e / 256), g = Math.floor(e) % 256, b = Math.floor((e - Math.floor(e)) * 256);
      d[4*i] = r; d[4*i+1] = g; d[4*i+2] = b; fixed++;
    }
    return fixed > 0;
  }

  // ---------- pistenummers en hutten als plaatjes ----------
  const FONT = getComputedStyle(document.documentElement).getPropertyValue("--f-display").trim() || "system-ui, sans-serif";
  function numImage(ref, diff){
    const id = `num-${diff}-${ref}`;
    if(gl.hasImage(id)) return id;
    const c = document.createElement("canvas"), x = c.getContext("2d"), f = `800 ${12 * SCALE}px ${FONT}`;
    x.font = f;
    const w = Math.max(22, Math.ceil(x.measureText(ref).width / SCALE) + 10), hgt = 18;
    c.width = (w + 4) * SCALE; c.height = (hgt + 4) * SCALE;
    x.scale(SCALE, SCALE); x.font = f.replace(`${12 * SCALE}px`, "12px");
    x.shadowColor = "rgba(0,0,0,.35)"; x.shadowBlur = 3; x.shadowOffsetY = 1;
    x.fillStyle = DIFF[diff]?.col || "#555"; x.beginPath(); x.roundRect ? x.roundRect(2, 2, w, hgt, 5) : x.rect(2, 2, w, hgt); x.fill();
    x.shadowColor = "transparent"; x.lineWidth = 1.5; x.strokeStyle = "#fff"; x.stroke();
    x.fillStyle = "#fff"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(ref, 2 + w / 2, 2 + hgt / 2 + .5);
    gl.addImage(id, x.getImageData(0, 0, c.width, c.height), {pixelRatio:SCALE});
    return id;
  }
  const hutWait = {};
  // het hut-icoon zoals op de platte kaart: wit rondje met gekleurde rand en het symbool uit index.html
  function hutImage(kind){
    const id = `hut-${kind}`;
    if(gl.hasImage(id) || hutWait[id]) return id;
    const k = HUT_KIND[kind] || HUT_KIND.r, col = HUT_COL[kind] || HUT_COL.r, bus = kind === "o", ink = bus ? "#fff" : col;
    const sym = document.getElementById("i-" + k[1]), vb = sym?.getAttribute("viewBox") || "0 0 24 24";
    const inner = (sym?.innerHTML || "").replace(/class="fill"/g, `fill="${ink}" stroke="none"`);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${30 * SCALE}" height="${30 * SCALE}" viewBox="0 0 30 30">
      <circle cx="15" cy="15.6" r="13" fill="rgba(0,0,0,.28)"/><circle cx="15" cy="15" r="12" fill="${bus ? col : "#fff"}" stroke="${bus ? "#fff" : col}" stroke-width="2"/>
      <svg x="8" y="8" width="14" height="14" viewBox="${vb}" fill="none" stroke="${ink}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg></svg>`;
    const im = new Image();
    hutWait[id] = true;
    // klaar: toevoegen en de hutten opnieuw neerzetten (al opgebouwde tegels pakken een later plaatje anders niet op)
    im.onload = () => { delete hutWait[id]; if(gl && !gl.hasImage(id)){ gl.addImage(id, im, {pixelRatio:SCALE}); sync("huts"); } };
    im.onerror = () => { delete hutWait[id]; };
    im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    return id;
  }
  function numsData(){
    if(!S.area || !S.nums || !S.pistes) return EMPTY;
    return {type:"FeatureCollection", features:numLabels.map(({e, at}) => ({type:"Feature", properties:{img:numImage(e.ref, e.diff)}, geometry:{type:"Point", coordinates:ll(at)}}))};
  }
  function hutsData(){
    const A = S.area; if(!A?.huts) return EMPTY;
    const f = [];
    A.huts.forEach((h, j) => {
      if(isSvc(h) ? !S.svcOn : !S.hutsOn) return;
      f.push({type:"Feature", properties:{j, kind:h.kind, img:hutImage(h.kind)}, geometry:{type:"Point", coordinates:[h.lon, h.lat]}});
    });
    return {type:"FeatureCollection", features:f};
  }
  function flush(){
    flushT = null;
    if(!gl || !styled) return;
    if(dirty.has("base")){ const bt = baseTiles(); gl.getSource("base")?.setTiles(bt.tiles); gl.setLayoutProperty("shade", "visibility", S.base === "sat" ? "none" : "visible"); }
    if(dirty.has("pistes")){ gl.getSource("pistes").setData(pistesData()); gl.getSource("nums").setData(numsData()); }
    if(dirty.has("route")) gl.getSource("route").setData(routeData());
    if(dirty.has("huts")) gl.getSource("huts").setData(hutsData());
    dirty.clear();
  }
  // wat er op de platte kaart veranderd is: "pistes", "route", "huts" of "base"
  function sync(...what){
    if(!gl) return;
    what.forEach(w => dirty.add(w));
    if(!flushT) flushT = setTimeout(flush, 0);
  }

  // ---------- openen, wisselen, sluiten ----------
  function create(center, zoom){
    const el = document.createElement("div"); el.id = "map3d"; el.className = "map3d";
    $("map").after(el);
    if(!proto){ maplibregl.addProtocol("skidem", demLoad); proto = true; }
    // hooguit 2x de schermresolutie: een iPhone heeft 3x, dat is 2,25 keer zoveel pixels om te tekenen voor bijna geen verschil
    gl = new maplibregl.Map({container:el, style:style(), center, zoom, pitch:58, bearing:0, maxPitch:80, minZoom:5,
      pixelRatio:Math.min(devicePixelRatio || 1, 2), attributionControl:{compact:true}, fadeDuration:150, renderWorldCopies:false});
    styled = false;
    gl.on("load", () => {
      styled = true; dirty = new Set(["pistes", "route", "huts"]); flush(); ovCheck();
      el.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");   // bronvermelding ingeklapt (i-knopje)
    });
    gl.on("moveend", ovCheck);
    gl.on("error", ev => { if(String(ev?.error?.message || "").includes("WebGL")) failGl(); });
    gl.on("click", onClick);
  }
  function failGl(){
    failed = true; close();
    toast("3D lukt niet op dit toestel. Je ziet de platte kaart.", 3500);
    window.apply3d?.(); window.povApply?.(true);
  }
  // camera van de platte kaart overnemen
  function fromLeaflet(){
    const c = map.getCenter();
    return {center:[c.lng, c.lat], zoom:Math.max(5, map.getZoom() - 1)};
  }
  function open(m){
    if(!loaded()) return false;
    if(!gl){
      const v = m === "nav" && S.pos ? {center:[S.pos.lon, S.pos.lat], zoom:15.5} : fromLeaflet();
      try{ create(v.center, v.zoom); }catch(e){ failGl(); return false; }
    }
    if(mode === m) return true;
    const was = mode; mode = m; cam = null;
    document.body.classList.add("m3-on");
    const on = m === "view";
    HANDLERS.forEach(h => gl[h]?.[on ? "enable" : "disable"]());
    gl.setCenterClampedToGround?.(on);     // navigeren: wij bepalen de hoogte van het midden (zie navCam)
    pop?.remove(); pop = null;
    if(on){
      me?.getElement().classList.remove("m3-hide");
      if(was === "nav"){ const v = fromLeaflet(); gl.easeTo({...v, pitch:58, padding:{top:0, bottom:0, left:0, right:0}, duration:800}); }
    } else me?.getElement().classList.add("m3-hide");
    ovCheck();
    gl.resize();
    return true;
  }
  function close(){
    if(!gl){ mode = null; return; }
    // terug naar de platte kaart op dezelfde plek
    if(mode === "view" && !failed){ const c = gl.getCenter(); map.setView([c.lat, c.lng], Math.round(gl.getZoom() + 1), {animate:false}); }
    me = null; pop = null; cam = null; $("ovBtn").hidden = true;
    try{ gl.remove(); }catch(e){}
    $("map3d")?.remove();
    gl = null; mode = null; styled = false;
    document.body.classList.remove("m3-on");
  }

  // ---------- overzicht ----------
  // hoe de camera staat als je het hele skigebied ziet (noorden boven)
  function ovCam(){
    const b = S.area?.bounds; if(!b || !gl) return null;
    const side = isSide(), pad = {top:90, left:side ? 440 : 24, right:80, bottom:(side ? 0 : sheetPeek()) + 24};
    try{ return gl.cameraForBounds([[b.getWest(), b.getSouth()], [b.getEast(), b.getNorth()]], {padding:pad, bearing:0}); }catch(e){ return null; }
  }
  // knop Overzicht alleen als je flink ingezoomd bent (of het gebied uit beeld is)
  function ovCheck(){
    const btn = $("ovBtn"); if(!gl || mode !== "view"){ btn.hidden = true; return; }
    const c = ovCam(), b = S.area?.bounds, ctr = gl.getCenter();
    btn.hidden = !c || !(gl.getZoom() > c.zoom + 1 || !b.pad(1).contains([ctr.lat, ctr.lng]));
  }
  function overview(){
    const c = ovCam(); if(!c) return;
    gl.easeTo({center:c.center, zoom:c.zoom - .3, bearing:0, pitch:50, duration:1400});
  }

  // ---------- volgen ----------
  // de platte kaart is verschoven (zoom naar route, heel skigebied, gebied gekozen): de 3D-kaart gaat mee
  function followLeaflet(){
    if(mode !== "view" || !gl) return;
    gl.easeTo({...fromLeaflet(), duration:900});
  }
  // navigatie: camera achter je, je eigen plek op ruim 60% van het scherm (daar staat de pijl).
  // Eigen vloeiende beweging met jumpTo: easeTo houdt tijdens de animatie de terreinhoogte vast, en bij een nieuwe
  // GPS-plek elke seconde loopt er altijd een animatie; dan kan de camera onder een berg belanden.
  let cam = null, camT = null, raf = 0;
  const camPad = () => ({top:Math.round(innerHeight * .26), bottom:0, left:0, right:0});
  // ele = hoogte van je plek volgens de kaartgegevens: zolang de hoogtetegels er nog niet zijn rekent MapLibre met 0 m,
  // dan zit de camera in de berg en laadt hij nooit iets. Daarom geven we de hoogte zelf mee.
  function navCam(lat, lon, bearing, zoom, ele){
    if(mode !== "nav" || !gl) return;
    const t = gl.queryTerrainElevation([lon, lat]);
    camT = {lon, lat, bearing, zoom, ele:t > 0 ? t : (ele || 0) * EXAG};
    const far = cam && Math.abs(cam.lat - lat) + Math.abs(cam.lon - lon) > .02;
    if(!cam || far) cam = {...camT};
    if(!raf) raf = requestAnimationFrame(camStep);
  }
  function camStep(){
    raf = 0;
    if(mode !== "nav" || !gl || !cam) return;
    const k = .1, db = ((camT.bearing - cam.bearing) % 360 + 540) % 360 - 180;
    cam.lon += (camT.lon - cam.lon) * k; cam.lat += (camT.lat - cam.lat) * k;
    cam.bearing += db * k * .7; cam.zoom += (camT.zoom - cam.zoom) * k * .5; cam.ele += (camT.ele - cam.ele) * k;
    gl.jumpTo({center:[cam.lon, cam.lat], bearing:cam.bearing, zoom:cam.zoom, pitch:62, padding:camPad(), elevation:cam.ele});
    const done = Math.abs(camT.lon - cam.lon) + Math.abs(camT.lat - cam.lat) < 2e-7 && Math.abs(db) < .2 && Math.abs(camT.zoom - cam.zoom) < .01;
    if(!done) raf = requestAnimationFrame(camStep);
  }
  function meAt(lat, lon){
    if(!gl) return;
    if(!me){ const el = document.createElement("div"); el.className = "me-dot" + (mode === "nav" ? " m3-hide" : ""); me = new maplibregl.Marker({element:el}).setLngLat([lon, lat]).addTo(gl); }
    else me.setLngLat([lon, lat]);
  }

  // ---------- tikken ----------
  function onClick(ev){
    if(mode !== "view") return;
    const p = ev.point, box = [[p.x - 14, p.y - 14], [p.x + 14, p.y + 14]];
    const hut = gl.queryRenderedFeatures([[p.x - 6, p.y - 6], [p.x + 6, p.y + 6]], {layers:["huts", "bus"]})[0];
    if(hut && S.area?.huts[hut.properties.j]) return hutPopup(S.area.huts[hut.properties.j]);
    const hit = gl.queryRenderedFeatures(box, {layers:["run", "run-route", "lift", "drag", "closed"].filter(id => gl.getLayer(id))})[0];
    const mpp = 40075016.686 * Math.cos(ev.lngLat.lat * Math.PI / 180) / (512 * 2 ** gl.getZoom());   // meters per pixel in het midden
    window.pick3d?.(ev.lngLat.lat, ev.lngLat.lng, hit ? hit.properties.i : null, mpp);
  }
  function popup(latlng, div){
    pop?.remove();
    pop = new maplibregl.Popup({maxWidth:"280px", className:"pop-wrap m3-pop", focusAfterOpen:false}).setLngLat([latlng[1] ?? latlng.lng, latlng[0] ?? latlng.lat]).setDOMContent(div).addTo(gl);
    return pop;
  }

  return {supported, loaded, load, open, close, sync, followLeaflet, navCam, meAt, popup, overview,
          get mode(){ return mode; }, get failed(){ return failed; }, get gl(){ return gl; }};
})();
