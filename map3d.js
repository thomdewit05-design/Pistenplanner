"use strict";
// 3D-kaart met echte bergen: MapLibre GL met hoogtegegevens van de AWS Terrain Tiles (Mapzen, vrij te gebruiken).
// Wordt pas geladen als je hem gebruikt. Twee standen:
//   "view": rondkijken; met twee vingers draaien en kantelen, tikken op pistes, liften en hutten werkt zoals op de platte kaart
//   "nav":  navigeren; de camera hangt achter je en kijkt in je richting, zoals een autonavigatie
// De gewone (Leaflet-)kaart blijft eronder bestaan; daar gebeurt de planning, deze kaart laat hetzelfde in 3D zien.
const M3 = (() => {
  const LIB = "vendor/maplibre/maplibre-gl.js?v=5.24.0", CSS = "vendor/maplibre/maplibre-gl.css?v=5.24.0";
  const DEM = "skidem://{z}/{x}/{y}", WINTER = "skiwinter://{z}/{x}/{y}";
  const LABELS = "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
  const ROADS = "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}";
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
    if(S.base === "winter") return {tiles:[WINTER], maxzoom:18, attribution:baseLayers.winter.options.attribution};
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
  function buildCables(){
    const A = S.area; if(!A || !S.pistes) return [];
    const c = A.bounds.getCenter(); cableOrigin = [mx(c.lng), my(c.lat)];
    const ground = (lat, lon, fb) => { const t = gl.queryTerrainElevation([lon, lat]); return t != null && t > 0 ? t : fb * EXAG; };
    const out = [];
    for(const e of A.edges){
      if(!aerial(e)) continue;
      const pts = e.pts, eA = A.nodes[e.a].ele ?? 0, eB = A.nodes[e.b].ele ?? eA;
      let total = 0; const seg = [0];
      for(let k = 1; k < pts.length; k++){ total += meters(...pts[k-1], ...pts[k]); seg.push(total); }
      if(total < 20) continue;
      const n = Math.max(2, Math.min(80, Math.ceil(total / 25))), up = 18 * EXAG;
      // punt op afstand d langs de lift
      const at = d => { let k = 1; while(k < seg.length - 1 && seg[k] < d) k++; const f = seg[k] > seg[k-1] ? (d - seg[k-1]) / (seg[k] - seg[k-1]) : 0;
        return [pts[k-1][0] + (pts[k][0] - pts[k-1][0]) * f, pts[k-1][1] + (pts[k][1] - pts[k-1][1]) * f]; };
      const samples = [];
      for(let i = 0; i <= n; i++){ const t = i / n, p = at(t * total); samples.push({t, p, g:ground(p[0], p[1], eA + (eB - eA) * t)}); }
      const hA = samples[0].g + up, hB = samples[n].g + up, sag = Math.min(25, total * .025) * EXAG;
      // tussen twee meetpunten kan de grond hoger liggen: per punt de hoogste grond van de buren nemen
      samples.forEach((q, i) => { q.top = Math.max(q.g, samples[i-1]?.g ?? q.g, samples[i+1]?.g ?? q.g); });
      const line = samples.map(q => { const z = Math.max(hA + (hB - hA) * q.t - 4 * sag * q.t * (1 - q.t), q.top + 14 * EXAG);
        return {xyz:[mx(q.p[1]) - cableOrigin[0], my(q.p[0]) - cableOrigin[1], mz(z, q.p[0])], q}; });
      const pylons = [];
      for(let d = 180; d < total - 60; d += 180){
        const i = Math.round(d / total * n), L = line[i];
        pylons.push([[L.xyz[0], L.xyz[1], mz(L.q.g, L.q.p[0])], L.xyz]);
      }
      // stations: korte paal van de grond tot de kabel
      pylons.push([[line[0].xyz[0], line[0].xyz[1], mz(samples[0].g, samples[0].p[0])], line[0].xyz]);
      pylons.push([[line[n].xyz[0], line[n].xyz[1], mz(samples[n].g, samples[n].p[0])], line[n].xyz]);
      out.push({i:e.i, closed:S.closed.has(e.i), line:line.map(x => x.xyz), pylons});
    }
    return out;
  }
  // lijnstukken naar driehoeken: elk stuk een rechthoek van w pixels breed (de breedte rekent de vertex shader uit)
  const FLOATS = 13;
  function cableVerts(geo){
    const v = [];
    const quad = (a, b, w, col) => {
      for(const [p, o, flip, side] of [[a, b, 1, -1], [a, b, 1, 1], [b, a, -1, -1], [b, a, -1, -1], [a, b, 1, 1], [b, a, -1, 1]])
        v.push(p[0], p[1], p[2], o[0], o[1], o[2], flip, side, w, ...col);
    };
    const white = [1, 1, 1, .9], dark = [.08, .13, .17, 1], grey = [.6, .65, .7, 1], pole = [.25, .3, .36, 1];
    const navy = [.06, .11, .16, .55], gold = [1, .77, 0, 1];
    // liften op je route: net als de route op de grond geel met een donkere rand, maar dan langs de kabel
    const onRoute = new Set((S.path || []).filter(x => aerial(x.e)).map(x => x.e.i));
    let half = 0;
    for(const pass of [0, 1]){ if(pass) half = v.length / FLOATS; for(const c of geo){
      const r = onRoute.has(c.i);
      for(const [a, b] of c.pylons) quad(a, b, pass ? 1.6 : 3.4, pass ? pole : white);
      for(let k = 1; k < c.line.length; k++)
        quad(c.line[k-1], c.line[k], r ? (pass ? 7.5 : 12) : (pass ? 2.2 : 5), r ? (pass ? gold : navy) : pass ? (c.closed ? grey : dark) : white);
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
  function pickCable(px, py){
    if(!cableGeo || !cableMatrix) return null;
    const m = cableMatrix, W = gl.getCanvas().clientWidth, H = gl.getCanvas().clientHeight;
    const scr = ([x, y, z]) => { const cx = m[0]*x + m[4]*y + m[8]*z + m[12], cy = m[1]*x + m[5]*y + m[9]*z + m[13], w = m[3]*x + m[7]*y + m[11]*z + m[15];
      return w <= 0 ? null : [(cx / w * .5 + .5) * W, (1 - (cy / w * .5 + .5)) * H]; };
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
    const bt = baseTiles(), line = {"line-cap":"round", "line-join":"round"};
    const w = (a, b) => ["interpolate", ["linear"], ["zoom"], 11, a, 16, b];
    return {
      version:8,
      sources:{
        base:{type:"raster", tiles:bt.tiles, tileSize:256, maxzoom:18, attribution:bt.attribution},
        labels:{type:"raster", tiles:[LABELS], tileSize:256, maxzoom:18}, roads:{type:"raster", tiles:[ROADS], tileSize:256, maxzoom:18},
        dem:{type:"raster-dem", tiles:[DEM], tileSize:256, maxzoom:15, encoding:"terrarium", attribution:DEM_ATTR},
        // aparte bron voor de schaduw (zelfde bron als het terrein geeft fouten in het tekenen); wordt bij satelliet niet geladen
        shade:{type:"raster-dem", tiles:[DEM], tileSize:256, maxzoom:15, encoding:"terrarium"},
        pistes:{type:"geojson", data:EMPTY}, route:{type:"geojson", data:EMPTY}, nums:{type:"geojson", data:EMPTY}, huts:{type:"geojson", data:EMPTY}
      },
      layers:[
        {id:"bg", type:"background", paint:{"background-color":"#E6EDF3"}},
        {id:"base", type:"raster", source:"base", paint:{"raster-fade-duration":150}},
        // reliëfschaduw alleen op terrein- en gewone kaart; een satellietfoto heeft zelf al schaduw
        {id:"roads", type:"raster", source:"roads", layout:{visibility:vis("roads")}, paint:{"raster-opacity":.8}},
        {id:"labels", type:"raster", source:"labels", layout:{visibility:vis("labels")}},
        {id:"shade", type:"hillshade", source:"shade", layout:{visibility:vis("shade")}, paint:{"hillshade-exaggeration":.4, "hillshade-shadow-color":"#33435A", "hillshade-highlight-color":"#FFFFFF"}},
        {id:"run-case", type:"line", source:"pistes", filter:["==", ["get", "k"], "r"], layout:line, paint:{"line-color":"#fff", "line-width":w(3, 7), "line-opacity":.6}},
        {id:"run", type:"line", source:"pistes", filter:["all", ["==", ["get", "k"], "r"], ["!=", ["get", "f"], 1]], layout:line, paint:{"line-color":["get", "col"], "line-width":w(1.8, 4)}},
        {id:"run-route", type:"line", source:"pistes", filter:["all", ["==", ["get", "k"], "r"], ["==", ["get", "f"], 1]], layout:line, paint:{"line-color":["get", "col"], "line-width":w(1.8, 4), "line-dasharray":[2, 1.4]}},
        // sleepliften, lopende banden en kabeltreinen liggen op de grond; kabelbanen hangen in de lucht (laag "cables"),
        // op de grond staat dan alleen een vage schaduw van hun spoor
        {id:"lift-case", type:"line", source:"pistes", filter:["==", ["get", "k"], "drag"], layout:line, paint:{"line-color":"#fff", "line-width":w(2.5, 5), "line-opacity":.85}},
        {id:"lift", type:"line", source:"pistes", filter:["==", ["get", "k"], "aerial"], layout:line, paint:{"line-color":"#14202B", "line-width":w(1, 2), "line-opacity":.22}},
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
      sky:{"sky-color":"#4F86C6", "horizon-color":"#D7E6F3", "fog-color":"#E8EFF5", "sky-horizon-blend":.55, "horizon-fog-blend":.5, "fog-ground-blend":.75,
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
      const k = aerial(e) ? "aerial" : S.closed.has(e.i) ? "closed" : e.t === "r" ? "r" : "drag";
      if(e.t === "l"){ st.add(e.a); st.add(e.b); }
      f.push({type:"Feature", properties:{i:e.i, k, col:e.t === "r" ? DIFF[e.diff].col : "#14202B", f:e.diff === "f" ? 1 : 0}, geometry:{type:"LineString", coordinates:e.pts.map(ll)}});
    }
    st.forEach(n => f.push({type:"Feature", properties:{k:"st", n}, geometry:{type:"Point", coordinates:[A.nodes[n].lon, A.nodes[n].lat]}}));
    return {type:"FeatureCollection", features:f};
  }
  function routeData(){
    const A = S.area, f = [];
    // stukken met een kabelbaan niet over de grond: die tekent de kabellaag in de lucht, in de kleur van de route
    if(A && S.path?.length) f.push({type:"Feature", properties:{k:"p"}, geometry:{type:"MultiLineString", coordinates:S.path.filter(s => !aerial(s.e)).map(s => s.e.pts.map(ll))}});
    if(A && S.target) f.push({type:"Feature", properties:{k:"t"}, geometry:{type:"MultiLineString", coordinates:S.target.edges.map(i => A.edges[i].pts.map(ll))}});
    return {type:"FeatureCollection", features:f};
  }
  // ---------- eigen tegels ----------
  // skidem://   hoogtetegels, opgeschoond (zonder pieken) door terrain.js
  // skiwinter:// de winterkaart, ook getekend door terrain.js; beide in een worker, zodat de kaart niet hapert
  const tileFrom = kind => async (params, abort) => {
    const m = /(\d+)\/(\d+)\/(\d+)(?:\.png)?$/.exec(params.url);
    return {data:await PPterrain.get(kind, +m[1], +m[2], +m[3], 1, abort?.signal)};
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
    if(dirty.has("base")){ const bt = baseTiles(); gl.getSource("base")?.setTiles(bt.tiles); for(const id of ["shade", "roads", "labels"]) gl.setLayoutProperty(id, "visibility", vis(id)); }
    if(dirty.has("pistes")){ gl.getSource("pistes").setData(pistesData()); gl.getSource("nums").setData(numsData()); cableGeo = null; gl.triggerRepaint(); }
    if(dirty.has("route")){ gl.getSource("route").setData(routeData()); cableGeo = null; gl.triggerRepaint(); }
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
    if(!proto){ maplibregl.addProtocol("skidem", tileFrom("dem")); maplibregl.addProtocol("skiwinter", tileFrom("winter")); proto = true; }
    // hooguit 2x de schermresolutie: een iPhone heeft 3x, dat is 2,25 keer zoveel pixels om te tekenen voor bijna geen verschil
    gl = new maplibregl.Map({container:el, style:style(), center, zoom, pitch:58, bearing:0, maxPitch:80, minZoom:5,
      pixelRatio:Math.min(devicePixelRatio || 1, 2), attributionControl:{compact:true}, fadeDuration:150, renderWorldCopies:false});
    styled = false;
    gl.on("load", () => {
      gl.addLayer(cables, "nums");   // eigen WebGL-laag: kan niet in de stijl zelf, wel erna toegevoegd
      styled = true; dirty = new Set(["pistes", "route", "huts"]); flush(); ovCheck();
      el.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");   // bronvermelding ingeklapt (i-knopje)
    });
    gl.on("moveend", ovCheck);
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
    } else me?.getElement().classList.add("m3-hide");
    ovCheck();
    gl.resize();
    return true;
  }
  function close(){
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
    if(mode !== "view" || !gl) return;
    const c = gl.getCenter(), t = gl.queryTerrainElevation(c);
    if(t != null && t > 0){ if(!gl.getCenterClampedToGround()) gl.setCenterClampedToGround(true); return; }
    const fb = fallbackEle(c.lat, c.lng) * EXAG;
    if(fb > 0 && gl.transform.elevation < fb - 50){ gl.setCenterClampedToGround(false); gl.transform.setElevation(fb); gl.triggerRepaint(); }
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
    const cab = pickCable(p.x, p.y);
    // kabel geraakt: meteen de liftpopup, halverwege de lift (niet bij een station)
    if(cab){ const e = S.area?.edges[cab.i]; if(e){ const a = e.pts[0], b = e.pts[e.pts.length - 1], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      return edgePopup(cab.i, mid, nearestNode(mid[0], mid[1]).n); } }
    const hit = gl.queryRenderedFeatures(box, {layers:["run", "run-route", "lift", "drag", "closed"].filter(id => gl.getLayer(id))})[0];
    const mpp = 40075016.686 * Math.cos(ev.lngLat.lat * Math.PI / 180) / (512 * 2 ** gl.getZoom());   // meters per pixel in het midden
    window.pick3d?.(ev.lngLat.lat, ev.lngLat.lng, hit ? hit.properties.i : null, mpp);
  }
  function popup(latlng, div){
    pop?.remove();
    pop = new maplibregl.Popup({maxWidth:"280px", className:"pop-wrap m3-pop", focusAfterOpen:false}).setLngLat([latlng[1] ?? latlng.lng, latlng[0] ?? latlng.lat]).setDOMContent(div).addTo(gl);
    return pop;
  }

  return {supported, loaded, load, open, close, sync, followLeaflet, navCam, meAt, popup, overview, pickCable,
          get mode(){ return mode; }, get failed(){ return failed; }, get gl(){ return gl; }};
})();
