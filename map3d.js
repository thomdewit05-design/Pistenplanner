"use strict";
// 3D-kaart met echte bergen: MapLibre GL met hoogtegegevens van de AWS Terrain Tiles (Mapzen, vrij te gebruiken).
// Wordt pas geladen als je hem gebruikt. Twee standen:
//   "view": rondkijken; met twee vingers draaien en kantelen, tikken op pistes, liften en hutten werkt zoals op de platte kaart
//   "nav":  navigeren; de camera hangt achter je en kijkt in je richting, zoals een autonavigatie
// De gewone (Leaflet-)kaart blijft eronder bestaan; daar gebeurt de planning, deze kaart laat hetzelfde in 3D zien.
const M3 = (() => {
  const LIB = "vendor/maplibre/maplibre-gl.js?v=5.24.0", CSS = "vendor/maplibre/maplibre-gl.css?v=5.24.0";
  const DEM = "skidem://{z}/{x}/{y}", WINTER = "skiwinter://{z}/{x}/{y}", SLOPE = "skislope://{z}/{x}/{y}";
  const LABELS = "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
  const ROADS = "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}";
  const DEM_ATTR = 'Hoogte: <a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noopener">Mapzen Terrain Tiles</a>';
  const EMPTY = {type:"FeatureCollection", features:[]}, EXAG = 1.3;
  const HANDLERS = ["dragPan", "dragRotate", "scrollZoom", "touchZoomRotate", "doubleClickZoom", "keyboard", "touchPitch", "boxZoom"];
  let gl = null, mode = null, loading = null, failed = false, styled = false, dirty = new Set(), flushT = null, hdOn = false;
  let me = null, pop = null, proto = false;
  const SCALE = 2;   // plaatjes voor pistenummers en hutten op dubbele resolutie
  const HUT_COL = {h:"#7A2E0E", r:"#8A4B12", f:"#8A4B12", c:"#6B3FA0", b:"#6B3FA0", p:"#1F5FCC", v:"#0F7A6B", d:"#4A5A6E", s:"#C2410C", o:"#15803D"};

  // bij het opstarten alleen kijken of het toestel WebGL kent; een echte proefcontext maken kostte opstarttijd (lukt het later toch niet, dan vangt failGl dat op)
  const supported = !!(window.WebGL2RenderingContext || window.WebGLRenderingContext);
  // Scherpte van de 3D-kaart: op een telefoon met een 3x-scherm is 1,75x ruim scherp genoeg en scheelt het een kwart van de pixels
  // die elk beeld berekend moeten worden; met batterij sparen nog iets lager.
  const glRatio = () => Math.min(devicePixelRatio || 1, light() ? 1.25 : 1.75);
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
  // Scherp op een retinascherm: MapLibre toont een tegel van 256 px op 256 schermpunten, dus op een iPhone (2-3x) wazig.
  // Met tileSize 128 haalt hij tegels van één zoomniveau dieper; de winterkaart tekenen we zelf op 512 px.
  const RETINA = (devicePixelRatio || 1) > 1.5, TS = RETINA ? 128 : 256;
  // Eerst gewone tegels van 256 (vier keer minder, dus snel beeld) en daarna de scherpe erover (laag "basehd").
  const hd = () => RETINA && S.base !== "winter";
  const baseSource = (size = 256) => { const bt = baseTiles();
    return {type:"raster", tiles:bt.tiles, tileSize:size, maxzoom:bt.maxzoom, attribution:bt.attribution}; };
  function baseTiles(){
    if(S.base === "winter") return {tiles:[WINTER], maxzoom:14,   // net als de hoogte: alleen gedownloade tegels (op een retinascherm dubbel zo scherp getekend)
       attribution:baseLayers.winter.options.attribution};
    const b = baseLayers[S.base], o = b.options, url = b._url.replace("{r}", "");
    const subs = typeof o.subdomains === "string" ? o.subdomains.split("") : (o.subdomains || []);
    return {tiles:url.includes("{s}") ? subs.map(s => url.replace("{s}", s)) : [url], maxzoom:o.maxNativeZoom ?? o.maxZoom ?? 18, attribution:o.attribution || ""};
  }
  // ---------- kabelbanen in 3D ----------
  // Stoeltjesliften, gondels en kabelbanen als kabel in de lucht: van station naar station, met een beetje doorhang,
  // nooit lager dan 10 m boven de grond (daar staan masten), en masten om de ±180 m. Getekend met een eigen WebGL-laag
  // (lijnen met een vaste breedte in pixels); MapLibre zet de dieptetest aan, dus bergen ervoor bedekken de kabel.
  const aerial = e => e.t === "l" && !DRAG.has(e.kind) && e.kind !== "funicular";
  let cableGeo = null, cableBuilt = 0, cableMatrix = null, cableOrigin = [0, 0];
  const CIRC = 40075016.686;
  const mx = lon => (lon + 180) / 360, my = lat => { const s = Math.sin(lat * Math.PI / 180); return .5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI); };
  const mz = (alt, lat) => alt / (CIRC * Math.cos(lat * Math.PI / 180));
  // de kabels en masten als lijnstukken [x, y, z] (ten opzichte van het midden van het gebied) per lift
  // Zoals een echte kabelbaan: masten van gelijke hoogte, neergezet waar de kabel anders te dicht bij de grond komt
  // (op bulten en kammen), met lange vrije overspanningen boven dalen. Tussen twee masten hangt de kabel in een boog.
  // Per soort: masthoogte, vrije ruimte onder de kabel en de langste overspanning (in meters, vóór de overdrijving).
  const LIFT_SHAPE = {chair_lift:{h:11, clr:6, span:260}, gondola:{h:17, clr:9, span:480}, mixed_lift:{h:17, clr:9, span:480},
    cable_car:{h:32, clr:18, span:1800}};
  function buildCables(){
    const A = S.area; if(!A || !S.pistes) return [];
    const c = A.bounds.getCenter(); cableOrigin = [mx(c.lng), my(c.lat)];
    const ground = (lat, lon, fb) => { const t = gl.queryTerrainElevation([lon, lat]); return t != null && t > 0 ? t : fb * EXAG; };
    const P = (p, z) => [mx(p[1]) - cableOrigin[0], my(p[0]) - cableOrigin[1], mz(z, p[0])];
    const out = [];
    for(const e of A.edges){
      if(!aerial(e)) continue;
      const pts = e.pts, eA = A.nodes[e.a].ele ?? 0, eB = A.nodes[e.b].ele ?? eA;
      let total = 0; const seg = [0];
      for(let k = 1; k < pts.length; k++){ total += meters(...pts[k-1], ...pts[k]); seg.push(total); }
      if(total < 20) continue;
      const shape = LIFT_SHAPE[e.kind] || LIFT_SHAPE.chair_lift;
      const H = shape.h * EXAG, clr = shape.clr * EXAG;
      // punt op afstand d langs de lift, en het terrein daar (om de ±10 m)
      const at = d => { let k = 1; while(k < seg.length - 1 && seg[k] < d) k++; const f = seg[k] > seg[k-1] ? (d - seg[k-1]) / (seg[k] - seg[k-1]) : 0;
        return [pts[k-1][0] + (pts[k][0] - pts[k-1][0]) * f, pts[k-1][1] + (pts[k][1] - pts[k-1][1]) * f]; };
      const n = Math.max(4, Math.min(400, Math.ceil(total / 10)));
      const smp = [];
      for(let i = 0; i <= n; i++){ const d = i / n * total, p = at(d); smp.push({d, p, g:ground(p[0], p[1], eA + (eB - eA) * i / n)}); }
      const maxStep = Math.max(1, Math.round(shape.span / (total / n)));
      // hoeveel doorhang kan de overspanning i..j hebben zonder te dicht bij de grond te komen (< 0: kan niet)
      const sagFor = (i, j) => {
        const zi = smp[i].g + H, zj = smp[j].g + H; let room = Infinity;
        for(let k = i + 1; k < j; k++){
          const t = (smp[k].d - smp[i].d) / (smp[j].d - smp[i].d), free = zi + (zj - zi) * t - (smp[k].g + clr);
          if(free < 0) return -1;
          room = Math.min(room, free / (4 * t * (1 - t)));
        }
        return Math.min(room, (smp[j].d - smp[i].d) * .03 * EXAG);
      };
      // masten: steeds de verste plek waar de kabel nog vrij hangt
      const towers = [0];
      for(let i = 0; i < n;){
        let best = i + 1;
        for(let j = i + 1; j <= Math.min(n, i + maxStep); j++) if(sagFor(i, j) >= 0) best = j;
        towers.push(best); i = best;
      }
      // de kabel: per overspanning een boog (parabool), om de ±10 m een punt
      const line = [];
      for(let s = 1; s < towers.length; s++){
        const i = towers[s-1], j = towers[s], sag = Math.max(0, sagFor(i, j)), zi = smp[i].g + H, zj = smp[j].g + H;
        for(let k = i; k <= j; k++){
          if(s > 1 && k === i) continue;
          const t = (smp[k].d - smp[i].d) / (smp[j].d - smp[i].d);
          line.push(P(smp[k].p, zi + (zj - zi) * t - 4 * sag * t * (1 - t)));
        }
      }
      // masten met een dwarsbalk (loodrecht op de kabel); bij de stations een paal
      const pylons = [], bar = 3.5;
      towers.forEach((k, idx) => {
        const q = smp[k], top = P(q.p, q.g + H), foot = P(q.p, q.g);
        pylons.push([foot, top]);
        if(idx === 0 || idx === towers.length - 1) return;
        const a = smp[Math.max(0, k - 1)].p, b = smp[Math.min(n, k + 1)].p, ky = Math.cos(q.p[0] * Math.PI / 180);
        const dx = (b[1] - a[1]) * ky, dy = b[0] - a[0], L = Math.hypot(dx, dy) || 1;
        const off = [dx / L * bar / 111320, -dy / L * bar / 111320 / ky];      // loodrecht op de kabel, in graden: [lat, lon]
        pylons.push([P([q.p[0] + off[0], q.p[1] + off[1]], q.g + H), P([q.p[0] - off[0], q.p[1] - off[1]], q.g + H)]);
      });
      // lengte langs de kabel (in kaarteenheden)
      const cum = [0]; for(let k = 1; k < line.length; k++) cum.push(cum[k-1] + Math.hypot(line[k][0] - line[k-1][0], line[k][1] - line[k-1][1], line[k][2] - line[k-1][2]));
      out.push({i:e.i, closed:S.closed.has(e.i), line, pylons, cum, total, kind:e.kind});
    }
    return out;
  }
  // lijnstukken naar driehoeken: elk stuk een rechthoek van w pixels breed (de breedte rekent de vertex shader uit)
  const FLOATS = 13, REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function cableVerts(geo){
    const v = [];
    const quad = (a, b, w, col) => {
      for(const [p, o, flip, side] of [[a, b, 1, -1], [a, b, 1, 1], [b, a, -1, -1], [b, a, -1, -1], [a, b, 1, 1], [b, a, -1, 1]])
        v.push(p[0], p[1], p[2], o[0], o[1], o[2], flip, side, w, ...col);
    };
    const soft = [1, 1, 1, .6], dark = [.08, .13, .17, 1], grey = [.6, .65, .7, 1], pole = [.2, .24, .3, 1];
    const navy = [1, 1, 1, .95], gold = [.557, .169, .902, 1];   // liften op je route: paars (#8E2BE6) met een witte rand, net als de route
    // liften op je route: net als de route op de grond geel met een donkere rand, maar dan langs de kabel
    const onRoute = new Set((S.path || []).filter(x => aerial(x.e)).map(x => x.e.i));
    let half = 0;
    for(const pass of [0, 1]){ if(pass) half = v.length / FLOATS; for(const c of geo){
      const r = onRoute.has(c.i);
      // masten: dunne donkere palen zonder witte rand (die maakte er vreemde pilaren van)
      if(pass) for(const [a, b] of c.pylons) quad(a, b, 1.7, pole);
      // kabel: slank, met een zachte witte rand zodat hij op sneeuw en satelliet zichtbaar blijft
      for(let k = 1; k < c.line.length; k++)
        quad(c.line[k-1], c.line[k], r ? (pass ? 7.5 : 12) : (pass ? 1.8 : 3.6), r ? (pass ? gold : navy) : pass ? (c.closed ? grey : dark) : soft);
    } }
    const out = new Float32Array(v); out.half = half; return out;
  }
  // matrix van MapLibre × verschuiving naar het midden van het gebied, in dubbele precisie (anders trillen de kabels)
  function withOrigin(m){
    const [x, y] = cableOrigin, r = Array.from(m);
    for(let i = 0; i < 4; i++) r[12 + i] = m[i] * x + m[4 + i] * y + m[12 + i];
    return r;
  }
  const cables = {
    id:"cables", type:"custom", renderingMode:"3d",
    onAdd(map, g){
      const sh = (type, src) => { const o = g.createShader(type); g.shaderSource(o, src); g.compileShader(o); return o; };
      const vs = sh(g.VERTEX_SHADER, `
        attribute vec3 a_pos; attribute vec3 a_other; attribute float a_flip; attribute float a_side; attribute float a_w; attribute vec4 a_col;
        uniform mat4 u_matrix; uniform vec2 u_view; uniform float u_ratio; uniform float u_bias; varying vec4 v_col;
        void main(){
          vec4 p = u_matrix * vec4(a_pos, 1.0), q = u_matrix * vec4(a_other, 1.0);
          vec2 d = (q.xy / q.w - p.xy / p.w) * u_view * a_flip; float l = length(d);
          vec2 nrm = l > 0.0 ? vec2(-d.y, d.x) / l : vec2(0.0, 1.0);
          p.xy += nrm * a_side * a_w * u_ratio / u_view * p.w;
          p.z -= u_bias * p.w;   // iets naar de camera: niet half in het (grovere) terrein verdwijnen, wel achter bergen
          gl_Position = p; v_col = a_col;
        }`);
      const fs = sh(g.FRAGMENT_SHADER, `precision mediump float; varying vec4 v_col; void main(){ gl_FragColor = vec4(v_col.rgb * v_col.a, v_col.a); }`);
      const pr = g.createProgram(); g.attachShader(pr, vs); g.attachShader(pr, fs); g.linkProgram(pr);
      this.pr = pr; this.buf = g.createBuffer(); this.n = 0;
      this.loc = Object.fromEntries(["a_pos", "a_other", "a_flip", "a_side", "a_w", "a_col"].map(k => [k, g.getAttribLocation(pr, k)]));
      this.u = Object.fromEntries(["u_matrix", "u_view", "u_ratio", "u_bias"].map(k => [k, g.getUniformLocation(pr, k)]));
      // een eigen vertex array: anders zetten we onze instellingen in die van MapLibre en tekent het terrein verkeerd
      const ext = g.createVertexArray ? null : g.getExtension("OES_vertex_array_object");
      this.vao = g.createVertexArray ? {make:() => g.createVertexArray(), bind:v => g.bindVertexArray(v)}
        : ext ? {make:() => ext.createVertexArrayOES(), bind:v => ext.bindVertexArrayOES(v)} : null;
      this.va = this.vao?.make();
      if(this.vao){
        this.vao.bind(this.va); g.bindBuffer(g.ARRAY_BUFFER, this.buf);
        const st = FLOATS * 4, L = this.loc;
        [["a_pos", 3, 0], ["a_other", 3, 3], ["a_flip", 1, 6], ["a_side", 1, 7], ["a_w", 1, 8], ["a_col", 4, 9]].forEach(([k, size, off]) => {
          if(L[k] < 0) return; g.enableVertexAttribArray(L[k]); g.vertexAttribPointer(L[k], size, g.FLOAT, false, st, off * 4);
        });
        this.vao.bind(null);
      }
    },
    render(g, args){
      if(!styled) return;
      if(!this.vao) return;
      if(!cableGeo){
        cableGeo = buildCables(); cableBuilt = Date.now();
        const v = cableVerts(cableGeo); this.n = v.length / FLOATS; this.half = v.half;
        g.bindBuffer(g.ARRAY_BUFFER, this.buf); g.bufferData(g.ARRAY_BUFFER, v, g.STATIC_DRAW);
      }
      if(!this.n) return;
      const m = withOrigin(args.defaultProjectionData.mainMatrix); cableMatrix = m;
      g.useProgram(this.pr);
      g.uniformMatrix4fv(this.u.u_matrix, false, new Float32Array(m));
      g.uniform2f(this.u.u_view, g.drawingBufferWidth, g.drawingBufferHeight);
      g.uniform1f(this.u.u_ratio, gl.getPixelRatio());
      this.vao.bind(this.va);
      g.enable(g.BLEND); g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);
      // eerst de witte rand, dan de kabel zelf een fractie dichter bij de camera (anders verdwijnt hij in de rand)
      g.uniform1f(this.u.u_bias, .0004); g.drawArrays(g.TRIANGLES, 0, this.half);
      g.uniform1f(this.u.u_bias, .0005); g.drawArrays(g.TRIANGLES, this.half, this.n - this.half);
      this.vao.bind(null);
    }
  };
  // tikken op een kabel: de kabel staat in de lucht, dus zelf projecteren (map.project kent geen hoogte)
  // een punt van de kabel ([x, y, z] zoals in buildCables) naar schermpixels
  function cableScr([x, y, z]){
    const m = cableMatrix, W = gl.getCanvas().clientWidth, H = gl.getCanvas().clientHeight;
    const cx = m[0]*x + m[4]*y + m[8]*z + m[12], cy = m[1]*x + m[5]*y + m[9]*z + m[13], w = m[3]*x + m[7]*y + m[11]*z + m[15];
    return w <= 0 ? null : [(cx / w * .5 + .5) * W, (1 - (cy / w * .5 + .5)) * H];
  }
  // hoeveel pixels het bolletje van de vlucht omhoog moet om op de kabel van lift ei te zitten (in plaats van op de grond eronder)
  function cableLift(ei, p){
    const c = cableGeo && cableMatrix ? cableGeo.find(c => c.i === ei) : null; if(!c || c.line.length < 2) return null;
    const x = mx(p[0]) - cableOrigin[0], y = my(p[1]) - cableOrigin[1];
    let best = null, bd = Infinity;
    for(let k = 1; k < c.line.length; k++){
      const a = c.line[k-1], b = c.line[k], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx*dx + dy*dy, t = L2 ? Math.max(0, Math.min(1, ((x - a[0])*dx + (y - a[1])*dy) / L2)) : 0;
      const qx = a[0] + t*dx, qy = a[1] + t*dy, d = (x - qx) ** 2 + (y - qy) ** 2;
      if(d < bd){ bd = d; best = [qx, qy, a[2] + (b[2] - a[2]) * t]; }
    }
    const q = best && cableScr(best), g = gl.project(p);
    if(!q || !g) return null;
    const off = [q[0] - g.x, q[1] - g.y];
    return Math.hypot(off[0], off[1]) < 260 ? off : null;   // iets heel anders dan een kabelhoogte: niet verplaatsen
  }
  function pickCable(px, py){
    if(!cableGeo || !cableMatrix) return null;
    const scr = cableScr;
    let best = null;
    for(const c of cableGeo){
      let prev = null;
      for(const p of c.line){
        const q = scr(p);
        if(q && prev){ const dx = q[0] - prev[0], dy = q[1] - prev[1], L2 = dx*dx + dy*dy, t = L2 ? Math.max(0, Math.min(1, ((px - prev[0])*dx + (py - prev[1])*dy) / L2)) : 0;
          const d = Math.hypot(px - prev[0] - t*dx, py - prev[1] - t*dy); if(d < 16 && (!best || d < best.d)) best = {d, i:c.i}; }
        prev = q;
      }
    }
    return best;
  }

  // welke extra lagen bij welke ondergrond: wegen en plaatsnamen op satelliet en winter, reliëfschaduw op terrein en kaart
  function vis(id){
    const on = id === "shade" ? S.base === "topo" || S.base === "osm" : id === "roads" ? S.base === "winter" : (S.base === "sat" || S.base === "winter") && S.labels;
    return on ? "visible" : "none";
  }
  function style(){
    const line = {"line-cap":"round", "line-join":"round"};
    const runLine = {...line, "line-sort-key":["get", "o"]};   // moeilijker ligt bovenop waar pistes elkaar kruisen
    const w = (a, b) => ["interpolate", ["linear"], ["zoom"], 11, a, 16, b];
    return {
      version:8,
      sources:{
        base:baseSource(), basehd:baseSource(TS),
        labels:{type:"raster", tiles:[LABELS], tileSize:TS, maxzoom:18}, roads:{type:"raster", tiles:[ROADS], tileSize:TS, maxzoom:18},
        // hoogte, schaduw en steilheid tot zoom 14: dat is precies wat bij het downloaden van een gebied is opgeslagen, dus 3D werkt
        // zonder bereik en hoeft onderweg niets op te halen (dichterbij wordt hetzelfde reliëf gewoon uitgerekt)
        dem:{type:"raster-dem", tiles:[DEM], tileSize:256, maxzoom:14, encoding:"terrarium", attribution:/Mapzen/.test(baseSource().attribution || "") ? "" : DEM_ATTR},   // niet twee keer dezelfde bron noemen
        // aparte bron voor de schaduw (zelfde bron als het terrein geeft fouten in het tekenen); wordt bij satelliet niet geladen
        shade:{type:"raster-dem", tiles:[DEM], tileSize:256, maxzoom:14, encoding:"terrarium"},
        slope:{type:"raster", tiles:[SLOPE], tileSize:256, minzoom:11, maxzoom:14},
        pistes:{type:"geojson", data:EMPTY}, sun:{type:"geojson", data:EMPTY}, route:{type:"geojson", data:EMPTY}, sel:{type:"geojson", data:EMPTY}, nums:{type:"geojson", data:EMPTY}, huts:{type:"geojson", data:EMPTY}, peaks:{type:"geojson", data:EMPTY}
      },
      layers:[
        {id:"bg", type:"background", paint:{"background-color":"#E6EDF3"}},
        {id:"base", type:"raster", source:"base", paint:{"raster-fade-duration":150}},
        {id:"basehd", type:"raster", source:"basehd", layout:{visibility:"none"}, paint:{"raster-fade-duration":250}},
        {id:"slope", type:"raster", source:"slope", minzoom:11, layout:{visibility:S.slopeOn ? "visible" : "none"}, paint:{"raster-opacity":.8, "raster-fade-duration":200}},
        // reliëfschaduw alleen op terrein- en gewone kaart; een satellietfoto heeft zelf al schaduw
        {id:"roads", type:"raster", source:"roads", layout:{visibility:vis("roads")}, paint:{"raster-opacity":.8}},
        {id:"labels", type:"raster", source:"labels", layout:{visibility:vis("labels")}},
        {id:"shade", type:"hillshade", source:"shade", layout:{visibility:vis("shade")}, paint:{"hillshade-exaggeration":.4, "hillshade-shadow-color":"#33435A", "hillshade-highlight-color":"#FFFFFF"}},
        // aangetikte piste of lift: blauwe gloed eronder
        {id:"sel-glow", type:"line", source:"sel", filter:["==", ["geometry-type"], "LineString"], layout:line, paint:{"line-color":"#1E88FF", "line-width":w(9, 16), "line-opacity":.45, "line-blur":2}},
        // zon en schaduw per piste (zelfde kleuren als de platte kaart), onder de pistes als gloed
        {id:"sun-shade", type:"line", source:"sun", filter:["==", ["get", "lit"], 0], layout:line, paint:{"line-color":"#3B3F6B", "line-width":w(7, 16), "line-opacity":.55, "line-blur":1}},
        {id:"sun-lit", type:"line", source:"sun", filter:["==", ["get", "lit"], 1], layout:line, paint:{"line-color":"#FFB800", "line-width":w(8, 18), "line-opacity":.72, "line-blur":1}},
        {id:"run-shadow", type:"line", source:"pistes", filter:["==", ["get", "k"], "rm"], layout:line, paint:{"line-color":"#0B1A2A", "line-width":w(6, 13), "line-opacity":.14, "line-blur":2}},
        {id:"run-case", type:"line", source:"pistes", filter:["==", ["get", "k"], "rm"], layout:runLine, paint:{"line-color":"#fff", "line-width":w(4.2, 9)}},
        {id:"run", type:"line", source:"pistes", filter:["all", ["==", ["get", "k"], "rm"], ["!=", ["get", "f"], 1]], layout:runLine, paint:{"line-color":["get", "col"], "line-width":w(2.8, 5.8)}},
        {id:"run-route", type:"line", source:"pistes", filter:["all", ["==", ["get", "k"], "rm"], ["==", ["get", "f"], 1]], layout:runLine, paint:{"line-color":["get", "col"], "line-width":w(2.8, 5.8), "line-dasharray":[2, 1.4]}},
        // de losse stukken, onzichtbaar en wat breder: hierop tik je (elk stuk kent zijn eigen nummer)
        {id:"run-hit", type:"line", source:"pistes", filter:["==", ["get", "k"], "r"], layout:line, paint:{"line-color":"#000", "line-width":w(9, 16), "line-opacity":.01}},
        // sleepliften, lopende banden en kabeltreinen liggen op de grond; kabelbanen hangen in de lucht (laag "cables"),
        // op de grond staat dan alleen een vage schaduw van hun spoor
        {id:"lift-case", type:"line", source:"pistes", filter:["==", ["get", "k"], "drag"], layout:line, paint:{"line-color":"#fff", "line-width":w(2.5, 5), "line-opacity":.85}},
        {id:"lift", type:"line", source:"pistes", filter:["==", ["get", "k"], "aerial"], layout:line, paint:{"line-color":"#14202B", "line-width":w(1.1, 2.2), "line-opacity":.3}},
        {id:"drag", type:"line", source:"pistes", filter:["==", ["get", "k"], "drag"], layout:line, paint:{"line-color":"#14202B", "line-width":w(1, 1.8), "line-dasharray":[2.5, 2]}},
        {id:"closed", type:"line", source:"pistes", filter:["==", ["get", "k"], "closed"], layout:line, paint:{"line-color":"#9AA7B2", "line-width":w(1.5, 3), "line-dasharray":[1, 3]}},
        {id:"station", type:"circle", source:"pistes", filter:["==", ["get", "k"], "st"], paint:{"circle-radius":w(1.5, 3.5), "circle-color":"#14202B", "circle-stroke-color":"#fff", "circle-stroke-width":1.5, "circle-pitch-alignment":"map"}},
        // bergtoppen met naam en hoogte (de hoogste eerst; wat overlapt valt weg)
        {id:"peaks", type:"symbol", source:"peaks", minzoom:10.5, layout:{"icon-image":["get", "img"], "icon-anchor":"top", "icon-offset":[0, -7], "symbol-sort-key":["get", "o"], "icon-padding":6}},
        {id:"route-shadow", type:"line", source:"route", filter:["==", ["get", "k"], "p"], layout:line, paint:{"line-color":"#2A0B45", "line-width":w(9, 18), "line-opacity":.18, "line-blur":3}},
        {id:"route-case", type:"line", source:"route", filter:["==", ["get", "k"], "p"], layout:line, paint:{"line-color":"#fff", "line-width":w(6, 12)}},
        {id:"route", type:"line", source:"route", filter:["==", ["get", "k"], "p"], layout:line, paint:{"line-color":"#8E2BE6", "line-width":w(3.6, 7.5)}},
        {id:"route-glow", type:"line", source:"route", filter:["==", ["get", "k"], "p"], layout:line, paint:{"line-color":"#D9B3FF", "line-width":w(1.1, 2.4), "line-opacity":.75}},
        {id:"route-passed-case", type:"line", source:"route", filter:["==", ["get", "k"], "x"], layout:line, paint:{"line-color":"#fff", "line-width":w(6, 12)}},
        {id:"route-passed", type:"line", source:"route", filter:["==", ["get", "k"], "x"], layout:line, paint:{"line-color":"#9AA9B7", "line-width":w(3.6, 7.5)}},
        {id:"target", type:"line", source:"route", filter:["==", ["get", "k"], "t"], layout:line, paint:{"line-color":"#8E2BE6", "line-width":w(1.5, 3), "line-opacity":.6, "line-dasharray":[3, 2.5]}},
        // pijltjes in de rijrichting op de route
        {id:"route-arrows", type:"symbol", source:"route", filter:["==", ["get", "k"], "p"], minzoom:12, layout:{"symbol-placement":"line", "symbol-spacing":["interpolate", ["linear"], ["zoom"], 12, 60, 16, 110], "icon-image":"route-arrow", "icon-size":["interpolate", ["linear"], ["zoom"], 12, .6, 16, 1], "icon-rotation-alignment":"map", "icon-pitch-alignment":"map", "icon-allow-overlap":true, "icon-ignore-placement":true}},
        {id:"sel-pt", type:"circle", source:"sel", filter:["==", ["geometry-type"], "Point"], paint:{"circle-radius":7, "circle-color":"#1E88FF", "circle-stroke-color":"#fff", "circle-stroke-width":3, "circle-pitch-alignment":"viewport"}},
        // pistenummers en hutten als plaatjes in de kaart zelf (veel lichter dan losse HTML-knopjes die elk beeld opnieuw geplaatst worden)
        {id:"nums", type:"symbol", source:"nums", minzoom:13.2, layout:{"icon-image":["get", "img"], "icon-padding":1}},
        {id:"huts", type:"symbol", source:"huts", minzoom:12, filter:["!=", ["get", "kind"], "o"], layout:{"icon-image":["get", "img"], "icon-allow-overlap":true, "icon-size":["interpolate", ["linear"], ["zoom"], 12, .75, 15, 1]}},
        {id:"bus", type:"symbol", source:"huts", minzoom:13.5, filter:["==", ["get", "kind"], "o"], layout:{"icon-image":["get", "img"], "icon-allow-overlap":true, "icon-size":.85}}
      ],
      sky:skyNow(),
      terrain:{source:"dem", exaggeration:EXAG}
    };
  }

  // lucht en nevel naar het moment van de dag en het weer (slecht zicht = meer nevel)
  function skyNow(){
    const h = sunOn3() ? sunTime().m / 60 : new Date().getHours() + new Date().getMinutes() / 60, vis = S.wx?.c?.visibility, code = S.wx?.c?.weather_code ?? 0;
    const T = h >= 5 && h < 8 ? ["#7FA2D6", "#F5C9A8", "#F2DCCB"] : h >= 8 && h < 16 ? ["#4F86C6", "#D7E6F3", "#E8EFF5"]
      : h >= 16 && h < 18.5 ? ["#6A8CC4", "#F6D29A", "#F0E2CC"] : h >= 18.5 && h < 21.5 ? ["#2E3F72", "#9C79B5", "#5D5878"] : ["#0B1630", "#23365E", "#2A3550"];
    const grey = code >= 45 && code <= 48 || (vis != null && vis < 2000) || code >= 71;
    return {"sky-color":grey ? "#9AA9B8" : T[0], "horizon-color":grey ? "#C9D3DC" : T[1], "fog-color":grey ? "#D5DCE3" : T[2],
      "sky-horizon-blend":.5, "horizon-fog-blend":grey ? .8 : .35, "fog-ground-blend":grey ? .45 : .9,
      "atmosphere-blend":["interpolate", ["linear"], ["zoom"], 0, 1, 10, 1, 12, 0]};
  }
  // ---------- zon en schaduw in 3D ----------
  const sunOn3 = () => !!(S.area && S.sunOn && !S.night);
  function sunData(){
    if(!sunOn3()) return EMPTY;
    const sun = sunShade(); if(sun.alt <= 2) return EMPTY;
    const f = [];
    for(const e of S.area.edges) if(e.t === "r" && !S.closed.has(e.i)) f.push({type:"Feature", properties:{lit:sun.v[e.i] >= SUN_MIN ? 1 : 0}, geometry:{type:"LineString", coordinates:e.pts.map(p => [p[1], p[0]])}});
    return {type:"FeatureCollection", features:f};
  }
  // de bergen belicht vanuit de echte zon: de reliëfschaduw draait mee met de zonnestand (een lage zon geeft harde schaduwkanten)
  function sunShadeLayer(){
    if(!gl.getLayer("shade")) return;
    const sun = sunOn3() ? sunShade() : null;
    if(sun && sun.alt > 2){
      const k = Math.max(0, Math.min(1, (40 - sun.alt) / 35));   // 0 = zon hoog, 1 = zon laag
      gl.setLayoutProperty("shade", "visibility", "visible");
      gl.setPaintProperty("shade", "hillshade-illumination-anchor", "map");
      gl.setPaintProperty("shade", "hillshade-illumination-direction", Math.round(sun.az));
      gl.setPaintProperty("shade", "hillshade-exaggeration", .45 + .4 * k);
      gl.setPaintProperty("shade", "hillshade-shadow-color", "#1E2448");
      gl.setPaintProperty("shade", "hillshade-highlight-color", "#FFF4D6");
    } else {
      gl.setLayoutProperty("shade", "visibility", sun ? "visible" : vis("shade"));
      gl.setPaintProperty("shade", "hillshade-illumination-anchor", "viewport");
      gl.setPaintProperty("shade", "hillshade-illumination-direction", 335);
      gl.setPaintProperty("shade", "hillshade-exaggeration", sun ? .7 : .4);
      gl.setPaintProperty("shade", "hillshade-shadow-color", sun ? "#1E2448" : "#33435A");
      gl.setPaintProperty("shade", "hillshade-highlight-color", "#FFFFFF");
    }
  }
  // vallende sneeuw over de 3D-kaart als het nu sneeuwt
  let snowRaf = 0;
  function snowFx(){
    cancelAnimationFrame(snowRaf); document.querySelector(".m3-snow")?.remove();
    const code = S.wx?.c?.weather_code ?? 0;
    if(!gl || !(code >= 71 && code <= 77 || code === 85 || code === 86) || matchMedia("(prefers-reduced-motion: reduce)").matches || light()) return;
    const c = document.createElement("canvas"); c.className = "m3-snow"; gl.getContainer().appendChild(c);
    const x = c.getContext("2d"), dpr = Math.min(2, devicePixelRatio || 1);
    const fit = () => { c.width = c.clientWidth * dpr; c.height = c.clientHeight * dpr; };
    fit(); const F = Array.from({length:code >= 75 || code === 86 ? 140 : 70}, () => ({x:Math.random(), y:Math.random(), r:.6 + Math.random() * 2.2, v:.0008 + Math.random() * .0016, w:Math.random() * 6}));
    const step = t => { if(!c.isConnected) return; if(c.width !== c.clientWidth * dpr) fit(); x.clearRect(0, 0, c.width, c.height); x.fillStyle = "rgba(255,255,255,.85)";
      for(const f of F){ f.y += f.v; if(f.y > 1) { f.y = -.02; f.x = Math.random(); } const px = (f.x + Math.sin(t / 1400 + f.w) * .01) * c.width, py = f.y * c.height;
        x.beginPath(); x.arc(px, py, f.r * dpr, 0, 7); x.fill(); }
      snowRaf = requestAnimationFrame(step); };
    snowRaf = requestAnimationFrame(step);
  }

  // ---------- gegevens van de platte kaart overnemen ----------
  const ll = p => [p[1], p[0]];
  function pistesData(){
    const A = S.area; if(!A || !S.pistes) return EMPTY;
    const f = [], st = new Set();
    for(const e of A.edges){
      if(e.t === "w") continue;
      const k = aerial(e) ? "aerial" : S.closed.has(e.i) ? "closed" : e.t === "r" ? "r" : "drag";
      if(e.t === "l"){ st.add(e.a); st.add(e.b); }
      f.push({type:"Feature", properties:{i:e.i, k, col:e.t === "r" ? DIFF[e.diff].col : "#14202B", f:e.diff === "f" ? 1 : 0}, geometry:{type:"LineString", coordinates:e.pts.map(ll)}});
    }
    st.forEach(n => f.push({type:"Feature", properties:{k:"st", n}, geometry:{type:"Point", coordinates:[A.nodes[n].lon, A.nodes[n].lat]}}));
    for(const m of mergedRuns(A)) f.push(m);
    return {type:"FeatureCollection", features:f};
  }
  // Hele pistes als één doorlopende lijn (k:"rm"), om te tekenen. De kaartdata knipt een piste bij elke kruising in stukken; los getekend
  // geeft dat bij elke naad een bolletje (ronde uiteinden en randen over elkaar) en een haperend streepjespatroon bij skiroutes.
  // De losse stukken (k:"r") blijven bestaan voor het aantikken. Moeilijker ligt bovenop (o), en de bochten zijn één keer afgerond.
  const RUN_ORDER = {u:0, g:1, b:2, r:3, B:3, s:4, x:5, f:6};
  function smoothLine(c){
    if(c.length < 3) return c;
    const out = [c[0]];
    for(let i = 0; i < c.length - 1; i++){
      const a = c[i], b = c[i + 1];
      if(i > 0) out.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25]);
      if(i < c.length - 2) out.push([a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75]);
    }
    out.push(c[c.length - 1]);
    return out;
  }
  function mergedRuns(A){
    const out = [], used = new Set();
    const ok = e => e.t === "r" && !S.closed.has(e.i) && !used.has(e.i);
    const same = (a, b) => a.diff === b.diff && a.name === b.name && a.ref === b.ref;
    for(const e0 of A.edges){
      if(!ok(e0)) continue;
      const chain = [e0]; used.add(e0.i);
      // vooruit en achteruit doorrijgen zolang er precies één vervolg van dezelfde piste is (bij een splitsing stopt de lijn)
      for(let end = e0.b;;){ const c = (A.outRuns?.[end] || []).map(i => A.edges[i]).filter(x => ok(x) && same(x, e0)); if(c.length !== 1) break; chain.push(c[0]); used.add(c[0].i); end = c[0].b; }
      for(let start = e0.a;;){ const c = (A.inRuns?.[start] || []).map(i => A.edges[i]).filter(x => ok(x) && same(x, e0)); if(c.length !== 1) break; chain.unshift(c[0]); used.add(c[0].i); start = c[0].a; }
      const coords = [];
      for(const e of chain) for(let k = coords.length ? 1 : 0; k < e.pts.length; k++) coords.push(ll(e.pts[k]));
      out.push({type:"Feature", properties:{k:"rm", col:DIFF[e0.diff].col, f:e0.diff === "f" ? 1 : 0, o:RUN_ORDER[e0.diff] ?? 2, n:chain.length}, geometry:{type:"LineString", coordinates:smoothLine(coords)}});
    }
    return out;
  }
  function routeData(){
    const A = S.area, f = [];
    // stukken met een kabelbaan niet over de grond: die tekent de kabellaag in de lucht, in de kleur van de route
    if(A && S.path?.length) f.push({type:"Feature", properties:{k:"p"}, geometry:{type:"MultiLineString", coordinates:S.path.filter(s => !aerial(s.e)).map(s => (s.rev ? [...s.e.pts].reverse() : s.e.pts).map(ll))}});
    if(A && S.follow && S.navPassed?.length > 1) f.push({type:"Feature", properties:{k:"x"}, geometry:{type:"LineString", coordinates:S.navPassed.map(ll)}});
    if(A && S.target) f.push({type:"Feature", properties:{k:"t"}, geometry:{type:"MultiLineString", coordinates:S.target.edges.map(i => A.edges[i].pts.map(ll))}});
    return {type:"FeatureCollection", features:f};
  }
  // ---------- eigen tegels ----------
  // skidem://   hoogtetegels, opgeschoond (zonder pieken) door terrain.js
  // skiwinter:// de winterkaart, ook getekend door terrain.js; beide in een worker, zodat de kaart niet hapert
  // Een tegel die eenmaal gevraagd is, wordt altijd afgemaakt. Beweegt de camera (vlucht door de route, navigatie), dan breekt
  // MapLibre elk beeld tegels af en vraagt ze meteen opnieuw; brak het rekenwerk dan ook af, dan kwam er nooit één klaar en bleef
  // het scherm wit. Wie dezelfde tegel opnieuw vraagt terwijl hij nog onderweg is, krijgt die ene uitkomst.
  // (Alleen een uitkomst waar niemand meer op wacht wordt doorgegeven: twee bronnen die dezelfde tegel willen, krijgen elk hun eigen plaatje.)
  const tileFree = new Map();   // sleutel → aanvragen waarvan de vrager is afgehaakt
  const tileFrom = kind => async (params, abort) => {
    const m = /(\d+)\/(\d+)\/(\d+)(?:\.png)?$/.exec(params.url), r = kind === "winter" && RETINA ? 2 : 1, key = kind + "/" + m[1] + "/" + m[2] + "/" + m[3];
    const free = tileFree.get(key);
    let p = free && free.pop();
    if(!p){ p = PPterrain.get(kind === "winter" && window.ppDarkMap?.() ? "winterd" : kind, +m[1], +m[2], +m[3], r); }
    const drop = () => { const l = tileFree.get(key); if(l){ const i = l.indexOf(p); if(i >= 0) l.splice(i, 1); if(!l.length) tileFree.delete(key); } };
    // haakt de vrager af terwijl de tegel nog onderweg is: bewaren voor wie hem hierna vraagt (hooguit 20 s)
    abort?.signal?.addEventListener("abort", () => { const l = tileFree.get(key) || []; l.push(p); tileFree.set(key, l); setTimeout(drop, 20000); }, {once:true});
    return {data:await p};
  };

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
  // pijltje voor op de route: donkere punthaak met witte rand, wijst naar rechts (de lijnrichting)
  function arrowImage(){
    if(gl.hasImage("route-arrow")) return;
    const c = document.createElement("canvas"), s = 18 * SCALE, x = c.getContext("2d"); c.width = c.height = s;
    x.scale(SCALE, SCALE); x.lineCap = "round"; x.lineJoin = "round";
    const hook = () => { x.beginPath(); x.moveTo(6, 4); x.lineTo(12, 9); x.lineTo(6, 14); };
    x.strokeStyle = "rgba(10,60,110,.55)"; x.lineWidth = 4.4; hook(); x.stroke();
    x.strokeStyle = "#fff"; x.lineWidth = 2.4; hook(); x.stroke();
    gl.addImage("route-arrow", x.getImageData(0, 0, s, s), {pixelRatio:SCALE});
  }
  // bergtop: driehoekje met naam en hoogte eronder, met een witte rand zodat het op elke ondergrond leesbaar is
  function peakImage(name, ele){
    const id = `peak-${name}-${ele}`;
    if(gl.hasImage(id)) return id;
    const c = document.createElement("canvas"), x = c.getContext("2d"), fb = `700 11.5px ${UIFONT}`, fs = `600 10.5px ${UIFONT}`, hTxt = `${ele.toLocaleString(LOCALE)} m`;
    x.font = fb; const w1 = name ? x.measureText(name).width : 0; x.font = fs; const w2 = x.measureText(hTxt).width;
    const W = Math.ceil(Math.max(w1, w2, 12)) + 8, H = name ? 40 : 27;
    c.width = W * SCALE; c.height = H * SCALE; x.scale(SCALE, SCALE);
    x.fillStyle = "#3A2E25"; x.strokeStyle = "#fff"; x.lineWidth = 2; x.lineJoin = "round";
    x.beginPath(); x.moveTo(W / 2, 1.5); x.lineTo(W / 2 + 6, 10.5); x.lineTo(W / 2 - 6, 10.5); x.closePath(); x.stroke(); x.fill();
    x.textAlign = "center"; x.textBaseline = "top"; x.lineWidth = 3; x.strokeStyle = "rgba(255,255,255,.95)";
    let y = 13;
    if(name){ x.font = fb; x.strokeText(name, W / 2, y); x.fillStyle = "#1F2A36"; x.fillText(name, W / 2, y); y += 13.5; }
    x.font = fs; x.strokeText(hTxt, W / 2, y); x.fillStyle = "#3E4C5B"; x.fillText(hTxt, W / 2, y);
    gl.addImage(id, x.getImageData(0, 0, c.width, c.height), {pixelRatio:SCALE});
    return id;
  }
  const UIFONT = getComputedStyle(document.documentElement).getPropertyValue("--f-ui").trim() || "system-ui, sans-serif";
  function peaksData(){
    const A = S.area; if(!A?.peaks || !S.peaksOn) return EMPTY;
    return {type:"FeatureCollection", features:A.peaks.slice(0, 160).map(([lat, lon, ele, name], i) =>
      ({type:"Feature", properties:{img:peakImage(name, ele), o:i}, geometry:{type:"Point", coordinates:[lon, lat]}}))};
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
    if(dirty.has("base")){
      const paint = {"raster-fade-duration":150};
      for(const id of ["basehd", "base"]){ if(gl.getLayer(id)) gl.removeLayer(id); if(gl.getSource(id)) gl.removeSource(id); }
      gl.addSource("base", baseSource()); gl.addLayer({id:"base", type:"raster", source:"base", paint}, "roads");
      gl.addSource("basehd", baseSource(TS)); gl.addLayer({id:"basehd", type:"raster", source:"basehd", layout:{visibility:hd() && hdOn ? "visible" : "none"}, paint:{"raster-fade-duration":250}}, "roads");
      for(const id of ["shade", "roads", "labels"]) gl.setLayoutProperty(id, "visibility", vis(id));
      if(sunOn3()) dirty.add("sun");
    }
    if(dirty.has("pistes")){ gl.getSource("pistes").setData(pistesData()); gl.getSource("nums").setData(numsData()); cableGeo = null; gl.triggerRepaint(); }
    if(dirty.has("route")){ gl.getSource("route").setData(routeData()); cableGeo = null; gl.triggerRepaint(); }
    if(dirty.has("huts")) gl.getSource("huts").setData(hutsData());
    if(dirty.has("slope") && gl.getLayer("slope")) gl.setLayoutProperty("slope", "visibility", S.slopeOn ? "visible" : "none");
    if(dirty.has("sun")){ gl.getSource("sun")?.setData(sunData()); sunShadeLayer(); gl.setSky(skyNow()); }
    if(dirty.has("sky")){ gl.setSky(skyNow()); snowFx(); if(gl.setPixelRatio && gl.getPixelRatio() !== glRatio()) gl.setPixelRatio(glRatio()); }
    if(dirty.has("peaks")) gl.getSource("peaks").setData(peaksData());
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
    if(!proto){ maplibregl.addProtocol("skidem", tileFrom("dem")); maplibregl.addProtocol("skiwinter", tileFrom("winter")); maplibregl.addProtocol("skislope", tileFrom("slope")); proto = true; }
    // hooguit 2x de schermresolutie: een iPhone heeft 3x, dat is 2,25 keer zoveel pixels om te tekenen voor bijna geen verschil
    gl = new maplibregl.Map({container:el, style:style(), center, zoom, pitch:58, bearing:0, maxPitch:80, minZoom:5,
      pixelRatio:glRatio(), attributionControl:{compact:true}, fadeDuration:150, renderWorldCopies:false,
      canvasContextAttributes:{antialias:(devicePixelRatio || 1) < 2}});   // gladde randen; op een retinascherm is dat niet nodig en scheelt het veel rekenwerk
    styled = false;
    // al tekenen zodra de stijl er is: "load" wacht tot álle tegels binnen zijn, dan zag je lang geen pistes
    gl.once("style.load", () => {
      gl.addLayer(cables, "nums");   // eigen WebGL-laag: kan niet in de stijl zelf, wel erna toegevoegd
      styled = true; arrowImage(); dirty = new Set(["pistes", "route", "huts", "peaks", "sky", "sun"]); flush(); ovCheck();
    });
    // bronvermelding ingeklapt achter het i-knopje, tot je er zelf op tikt: de kaart klapt hem anders bij elke stijlwissel weer open, over de kaart heen
    let attrUser = false;
    const attrShut = () => { if(attrUser) return; const c = el.querySelector(".maplibregl-ctrl-attrib"); if(!c) return; c.classList.remove("maplibregl-compact-show"); c.removeAttribute("open"); };
    el.addEventListener("click", e => { if(e.target.closest(".maplibregl-ctrl-attrib-button")) attrUser = !attrUser; }, true);
    gl.on("styledata", attrShut); gl.on("resize", attrShut); gl.on("idle", attrShut);
    gl.on("moveend", ovCheck);
    // zodra het eerste beeld staat: de scherpe tegels erover laten komen
    hdOn = false;
    gl.once("idle", () => { hdOn = true; if(hd() && gl.getLayer("basehd")) gl.setLayoutProperty("basehd", "visibility", "visible"); });
    gl.on("render", guardElevation);
    gl.on("idle", () => { if(cableGeo && Date.now() - cableBuilt > 1500){ cableGeo = null; gl.triggerRepaint(); } });
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
    // de platte kaart ligt eronder maar is onzichtbaar: zijn ondergrond hoeft dan geen tegels te laden
    for(const l of [...Object.values(baseLayers), labelLayer, roadsLayer]) l.remove();
    const on = m === "view";
    HANDLERS.forEach(h => gl[h]?.[on ? "enable" : "disable"]());
    gl.setCenterClampedToGround?.(on);     // navigeren: wij bepalen de hoogte van het midden (zie navCam)
    pop?.remove(); pop = null;
    if(on){
      me?.getElement().classList.remove("m3-hide");
      if(was === "nav"){ const v = fromLeaflet(); gl.easeTo({...v, pitch:58, padding:{top:0, bottom:0, left:0, right:0}, duration:800}); }
      // de platte kaart toont het hele gebied: in 3D ook het hele gebied, schuin van boven (niet piepklein in de verte)
      else if(!was && S.area && map.getBounds().contains(S.area.bounds)){ const c = ovCam(); if(c){ const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
          // de camera kantelt van recht boven naar schuin: zo zie je dat het dezelfde kaart is die omhoog komt
          gl.jumpTo({center:ovCenter(), zoom:c.zoom + .25, bearing:0, pitch:still ? 50 : 0, padding:ovPad()}); if(!still) gl.easeTo({pitch:50, duration:1100}); } }
    } else me?.getElement().classList.add("m3-hide");
    ovCheck();
    gl.resize();
    return true;
  }
  function close(){
    stopReplay();
    if(!gl){ mode = null; return; }
    // terug naar de platte kaart op dezelfde plek
    if(mode === "view" && !failed){ const c = gl.getCenter(); map.setView([c.lat, c.lng], Math.round(gl.getZoom() + 1), {animate:false}); }
    me = null; pop = null; cam = null; cableGeo = null; cableMatrix = null; $("ovBtn").hidden = true;
    try{ gl.remove(); }catch(e){}
    $("map3d")?.remove();
    gl = null; mode = null; styled = false;
    document.body.classList.remove("m3-on");
    applyBase();
  }

  // ---------- camera niet in de berg ----------
  // Zolang de hoogtetegel onder het midden er niet is, rekent MapLibre met 0 m: na een sprong naar een nieuwe plek staat
  // de camera dan in de berg en laadt er nooit een tegel. Dan zelf een hoogte geven (uit de pistegegevens) tot het terrein er is.
  let guardKey = "", guardEle = 0;
  function fallbackEle(lat, lon){
    const k = `${lat.toFixed(3)},${lon.toFixed(3)}`;
    if(k !== guardKey){
      guardKey = k;
      const A = S.area, r = A?.row;
      const nn = A ? nearestNode(lat, lon) : null;
      guardEle = nn && nn.d < 8000 ? A.nodes[nn.n].ele ?? 0 : r ? ((r[9] ?? 0) + (r[10] ?? 0)) / 2 : 0;
    }
    return guardEle;
  }
  function guardElevation(){
    if(mode !== "view" || !gl || (rp && !rp.ended)) return;   // tijdens de vlucht regelt de vlucht de hoogte zelf
    const c = gl.getCenter(), t = gl.queryTerrainElevation(c);
    if(t != null && t > 0){ if(!gl.getCenterClampedToGround()) gl.setCenterClampedToGround(true); return; }
    const fb = fallbackEle(c.lat, c.lng) * EXAG;
    if(fb > 0 && gl.transform.elevation < fb - 50){ gl.setCenterClampedToGround(false); gl.transform.setElevation(fb); gl.triggerRepaint(); }
  }

  // ---------- overzicht ----------
  // hoe de camera staat als je het hele skigebied ziet (noorden boven)
  const ovPad = () => { if(typeof isLand === "function" && isLand()){ const q = landPad(); return {top:q.paddingTopLeft[1], left:q.paddingTopLeft[0], right:q.paddingBottomRight[0], bottom:q.paddingBottomRight[1]}; }
    const side = isSide(); return {top:side ? 90 : padTop(), left:side ? 440 : 24, right:80, bottom:side ? 24 : padBottom()}; };
  // met padding legt MapLibre het midden zelf in het vrije deel; dus het echte midden van het gebied meegeven
  const ovCenter = () => { const c = S.area.bounds.getCenter(); return [c.lng, c.lat]; };
  function ovCam(){
    const b = S.area?.bounds; if(!b || !gl) return null;
    // MapLibre telt de marge die de camera al heeft er zelf bij op; alleen het verschil meegeven (anders "past" het gebied nooit)
    const want = ovPad(), cur = gl.getPadding?.() || {}, pad = {};
    for(const k of ["top", "bottom", "left", "right"]) pad[k] = Math.max(0, want[k] - (cur[k] || 0));
    try{ return gl.cameraForBounds([[b.getWest(), b.getSouth()], [b.getEast(), b.getNorth()]], {padding:pad, bearing:0}) || null; }catch(e){ return null; }
  }
  // knop Overzicht alleen als je flink ingezoomd bent (of het gebied uit beeld is)
  function ovCheck(){
    const btn = $("ovBtn"); if(!gl || mode !== "view"){ btn.hidden = true; return; }
    const c = ovCam(), b = S.area?.bounds, ctr = gl.getCenter();
    btn.hidden = !c || !(gl.getZoom() > c.zoom + 1 || !b.pad(1).contains([ctr.lat, ctr.lng]));
  }
  function overview(){
    const c = ovCam(); if(!c) return;
    gl.easeTo({center:ovCenter(), zoom:c.zoom + .25, bearing:0, pitch:50, padding:ovPad(), duration:1400});
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
  // je eigen positie: altijd volledig zichtbaar. Standaard maakt MapLibre een marker doorzichtig (20%)
  // zodra het reliëf hem volgens de berekening bedekt, en op een steile helling gebeurt dat al snel.
  function meAt(lat, lon){
    if(!gl) return;
    if(!me){ const el = document.createElement("div"); el.className = "me-dot" + (mode === "nav" ? " m3-hide" : ""); el.innerHTML = '<i class="me-beam"></i>';
      // met de kaart mee draaien en plat op het reliëf, zodat de lichtbundel de echte kijkrichting aanwijst
      me = new maplibregl.Marker({element:el, opacity:"1", opacityWhenCovered:"1", rotationAlignment:"map", pitchAlignment:"map"}).setLngLat([lon, lat]).addTo(gl); }
    else me.setLngLat([lon, lat]);
  }

  // ---------- je skidag terugkijken ----------
  // De camera vliegt langs het spoor van die dag; het paarse spoor groeit mee achter een stip aan.
  let rp = null;
  // De grootste kijkhoek (graden vanaf recht omlaag; 64 = schuin, 12 = bijna recht van boven) waarbij niets de kijklijn kruist.
  // rays: per punt op de piste een lijst [afstand langs de grond naar de camera toe, hoogte van de grond boven dat punt].
  // De kijklijn stijgt vanaf het punt met 1/tan(hoek) per meter; de camera staat op Lm·sin(hoek) afstand. Tot 60 m speling.
  function sightPitch(rays, Lm){
    for(let pitch = 64; pitch > 12; pitch -= 4){
      const t = Math.tan(pitch * Math.PI / 180), D = Lm * Math.sin(pitch * Math.PI / 180);
      if(rays.every(hs => hs.every(([m, h]) => m > D || h + Math.min(60, m * .25) <= m / t))) return pitch;
    }
    return 12;
  }
  const FLY_Z = 14.8;   // de tegels gaan niet verder dan zoom 14 (gedownload), dus dichterbij vliegen vraagt niets extra's op
  function replay(coords, done, opt = {}){
    if(!gl || coords.length < 2) return false;
    stopReplay();
    const R = 6371000, rad = Math.PI / 180;
    const dist = (a, b) => { const x = (b[0] - a[0]) * rad * Math.cos((a[1] + b[1]) / 2 * rad), y = (b[1] - a[1]) * rad; return Math.hypot(x, y) * R; };
    const brg = (a, b) => { const y = Math.sin((b[0] - a[0]) * rad) * Math.cos(b[1] * rad), x = Math.cos(a[1] * rad) * Math.sin(b[1] * rad) - Math.sin(a[1] * rad) * Math.cos(b[1] * rad) * Math.cos((b[0] - a[0]) * rad); return (Math.atan2(y, x) / rad + 360) % 360; };
    const cum = [0]; for(let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + dist(coords[i - 1], coords[i]));
    const total = cum[cum.length - 1] || 1;
    const at = d => { let lo = 0, hi = cum.length - 1; while(hi - lo > 1){ const m = (lo + hi) >> 1; if(cum[m] <= d) lo = m; else hi = m; }
      const f = cum[hi] > cum[lo] ? (d - cum[lo]) / (cum[hi] - cum[lo]) : 0, a = coords[lo], b = coords[hi]; return {p:[a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], i:lo}; };
    const T = Math.min(70000, Math.max(22000, total / 1000 * 3500)) / (opt.speed || 1);   // ±3,5 s per kilometer, tussen 22 en 70 s
    const start = () => {
      if(!gl) return;
      gl.addSource("replay", {type:"geojson", data:{type:"Feature", geometry:{type:"LineString", coordinates:[coords[0], coords[0]]}}});
      const line = {"line-cap":"round", "line-join":"round"};
      gl.addLayer({id:"replay-case", type:"line", source:"replay", layout:line, paint:{"line-color":"#fff", "line-width":8, "line-opacity":.75}});
      gl.addLayer({id:"replay", type:"line", source:"replay", layout:line, paint:{"line-color":opt.color || "#7C3AED", "line-width":4.5}});
      const el = document.createElement("div"); el.className = "rp-dot";
      const mk = new maplibregl.Marker({element:el, opacity:"1", opacityWhenCovered:"1"}).setLngLat(coords[0]).addTo(gl);
      rp = {mk, raf:0, t0:performance.now(), bearing:brg(coords[0], at(Math.min(total, 150)).p), pitch:64, off:[0, 0], done};
      const step = now => {
        if(!rp) return;
        const k = Math.min(1, (now - rp.t0) / T), d = total * (k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);   // rustig optrekken en afremmen
        const {p, i} = at(d), ahead = at(Math.min(total, d + 320)).p;   // ver vooruit kijken: het beeld draait rustig mee in plaats van elke bocht te volgen
        gl.getSource("replay")?.setData({type:"Feature", geometry:{type:"LineString", coordinates:[...coords.slice(0, i + 1), p]}});
        rp.mk.setLngLat(p);
        // op een lift hoort het bolletje op de kabel, niet op de grond eronder
        const span = opt.lifts?.find(l => i >= l.a && i < l.b), up = (span && cableLift(span.i, p)) || [0, 0];
        rp.off[0] += (up[0] - rp.off[0]) * .25; rp.off[1] += (up[1] - rp.off[1]) * .25;
        rp.mk.setOffset([Math.round(rp.off[0]), Math.round(rp.off[1])]);
        if(dist(p, ahead) > 8){ const db = ((brg(p, ahead) - rp.bearing) % 360 + 540) % 360 - 180; rp.bearing += db * .025; }
        // De hoogte van het punt onder de camera zelf meegeven (net als bij navigeren): zolang de hoogtetegels er nog niet zijn rekent
        // MapLibre met 0 m en hangt de camera in de berg; dan zie je alleen een wit vlak.
        const tq = gl.queryTerrainElevation(p), ele = tq != null && tq > 0 ? tq : fallbackEle(p[1], p[0]) * EXAG;
        // De piste moet altijd te zien zijn: de camera hangt schuin achter het punt, en daartussen kan een kam of bergtop staan.
        // We meten de grond onder de kijklijn, elke 150 m tussen punt en camera, en kijken steiler omlaag tot de lijn vrij is;
        // steiler kijken tilt de camera op en haalt hem dichterbij. Dat doen we ook voor twee punten verderop op de piste,
        // zodat het beeld al kantelt vóór de top ervoor schuift in plaats van erna.
        const mpp = 40075016.686 * Math.cos(p[1] * rad) / (512 * 2 ** FLY_Z), Lm = 1.5 * gl.getCanvas().clientHeight * mpp;   // afstand camera–punt in meters
        const back = (rp.bearing + 180) * rad, sinB = Math.sin(back), cosB = Math.cos(back);
        const ground = q => { const g0 = gl.queryTerrainElevation(q); return g0 != null && g0 > 0 ? g0 : fallbackEle(q[1], q[0]) * EXAG; };
        const rays = [[p, ele], ...[300, 600].map(a => { const q = at(Math.min(total, d + a)).p; return [q, ground(q)]; })].map(([q, e0]) => {
          const hs = []; for(let m = 150; m <= Lm; m += 150) hs.push([m, ground([q[0] + m * sinB / (R * rad * Math.cos(q[1] * rad)), q[1] + m * cosB / (R * rad)]) - e0]);
          return hs; });
        let want = sightPitch(rays, Lm);
        rp.pitch += (want - rp.pitch) * (want < rp.pitch ? .25 : .03);   // snel omhoog als er iets in de weg staat, rustig terug
        gl.jumpTo({center:p, bearing:rp.bearing, zoom:FLY_Z, pitch:rp.pitch, elevation:ele});
        if(k < 1){ rp.raf = requestAnimationFrame(step); return; }
        // klaar: het hele spoor in beeld
        const lons = coords.map(c => c[0]), lats = coords.map(c => c[1]);
        gl.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], {padding:{top:70, bottom:110, left:40, right:40}, pitch:55, duration:1800});
        const cb = rp.done; rp.mk.remove(); rp = {ended:true}; gl.setCenterClampedToGround?.(true); cb?.();
      };
      gl.setPadding({top:0, bottom:0, left:0, right:0});   // tijdens de vlucht is het paneel weg: het hele scherm is kaart
      gl.setCenterClampedToGround?.(false);   // tijdens de vlucht bepalen wij de hoogte van het midden
      const t0q = gl.queryTerrainElevation(coords[0]), ele0 = t0q != null && t0q > 0 ? t0q : fallbackEle(coords[0][1], coords[0][0]) * EXAG;
      gl.easeTo({center:coords[0], zoom:FLY_Z, pitch:64, bearing:rp.bearing, elevation:ele0, duration:1500});
      // pas wegvliegen als het landschap bij het startpunt er staat (hooguit 5 s wachten): anders vloog je boven een leeg, wit vlak
      let started = false;
      const go = () => { if(started || !rp || rp.ended) return; started = true; rp.t0 = performance.now(); rp.raf = requestAnimationFrame(step); };
      setTimeout(() => { if(!gl || !rp) return;
        gl.jumpTo({center:coords[0], zoom:FLY_Z, pitch:64, bearing:rp.bearing, elevation:ele0});   // de hoogte vastzetten terwijl we op het landschap wachten
        if(gl.areTilesLoaded()) go(); else { gl.once("idle", go); setTimeout(go, 5000); } }, 1550);
    };
    if(styled) start(); else gl.once("style.load", start);
    return true;
  }
  function stopReplay(){
    if(!rp) return;
    if(gl && mode === "view") gl.setCenterClampedToGround?.(true);
    cancelAnimationFrame(rp.raf); rp.mk?.remove(); rp = null;
    if(!gl) return;
    for(const id of ["replay", "replay-case"]) if(gl.getLayer(id)) gl.removeLayer(id);
    if(gl.getSource("replay")) gl.removeSource("replay");
  }

  // ---------- tikken ----------
  function onClick(ev){
    if(mode !== "view") return;
    const p = ev.point, box = [[p.x - 20, p.y - 20], [p.x + 20, p.y + 20]];   // ruim genoeg voor een vinger
    const hut = gl.queryRenderedFeatures([[p.x - 6, p.y - 6], [p.x + 6, p.y + 6]], {layers:["huts", "bus"]})[0];
    if(hut && S.area?.huts[hut.properties.j]) return hutPopup(S.area.huts[hut.properties.j]);
    const cab = pickCable(p.x, p.y);
    // kabel geraakt: meteen de liftpopup, halverwege de lift (niet bij een station)
    if(cab){ const e = S.area?.edges[cab.i]; if(e){ const a = e.pts[0], b = e.pts[e.pts.length - 1], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      return edgePopup(cab.i, mid, nearestNode(mid[0], mid[1]).n); } }
    const hit = gl.queryRenderedFeatures(box, {layers:["run-hit", "lift", "drag", "closed"].filter(id => gl.getLayer(id))})[0];
    const mpp = 40075016.686 * Math.cos(ev.lngLat.lat * Math.PI / 180) / (512 * 2 ** gl.getZoom());   // meters per pixel in het midden
    window.pick3d?.(ev.lngLat.lat, ev.lngLat.lng, hit ? hit.properties.i : null, mpp);
  }
  // aangetikte piste of lift (lijnen [[lat, lon], …]) en de plek van de tik; null = niets
  function select(lines, at){
    if(!gl || !styled) return;
    const f = [];
    if(lines) for(const l of lines) f.push({type:"Feature", properties:{}, geometry:{type:"LineString", coordinates:l.map(ll)}});
    if(lines !== null && at) f.push({type:"Feature", properties:{}, geometry:{type:"Point", coordinates:[at[1], at[0]]}});
    gl.getSource("sel")?.setData({type:"FeatureCollection", features:f});
  }
  function popup(latlng, div){
    pop?.remove();
    pop = new maplibregl.Popup({maxWidth:"280px", className:"pop-wrap m3-pop", focusAfterOpen:false}).setLngLat([latlng[1] ?? latlng.lng, latlng[0] ?? latlng.lat]).setDOMContent(div).addTo(gl);
    // net als in 2D: schuif de kaart zodat het menu helemaal in beeld staat
    const p = pop;
    requestAnimationFrame(() => {
      if(pop !== p || !p.isOpen()) return;
      const r = p.getElement().getBoundingClientRect(), c = gl.getContainer().getBoundingClientRect();
      const dx = r.left < c.left + 10 ? r.left - c.left - 10 : r.right > c.right - 10 ? r.right - c.right + 10 : 0;
      const dy = r.top < c.top + 90 ? r.top - c.top - 90 : 0;
      if(dx || dy) gl.panBy([dx, dy], {duration:250});
    });
    return pop;
  }

  return {supported, loaded, load, open, close, sync, followLeaflet, navCam, meAt, popup, overview, pickCable, select, replay, stopReplay, sightPitch,
          get mode(){ return mode; }, get failed(){ return failed; }, get gl(){ return gl; }};
})();
