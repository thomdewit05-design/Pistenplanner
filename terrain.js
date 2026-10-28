"use strict";
// Hoogtetegels (AWS Terrain Tiles, Mapzen) ophalen, opschonen en er een winterkaart van tekenen.
// Hetzelfde bestand draait als Web Worker, zodat het rekenwerk de kaart niet laat haperen, en anders (oudere iPhones
// zonder OffscreenCanvas) gewoon in de pagina. Van buiten: PPterrain.get("winter" | "dem", z, x, y) geeft een ImageBitmap.
(() => {
  const IS_WORKER = typeof importScripts === "function" && typeof document === "undefined";
  const DEM_MAX = 15, CACHE_MAX = 160;
  const demURL = (z, x, y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;

  function canvas2d(w, h){
    const c = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(w, h) : Object.assign(document.createElement("canvas"), {width:w, height:h});
    return c.getContext("2d", {willReadFrequently:true});
  }
  async function bitmap(src){
    try{ return await createImageBitmap(src, {premultiplyAlpha:"none", colorSpaceConversion:"none"}); }catch(e){ return createImageBitmap(src); }
  }

  // De tegels hebben op lage zoom losse foute pixels (honderden meters te hoog of te laag): die gaven pieken in 3D.
  // Een pixel dat ver afwijkt van zijn buren krijgt de mediaan van die buren; alles onder zee wordt 0 m.
  function despike(img, z){
    const d = img.data, W = img.width, H = img.height, h = new Float32Array(W * H);
    for(let i = 0; i < W * H; i++) h[i] = d[4*i] * 256 + d[4*i+1] + d[4*i+2] / 256 - 32768;
    const T = z <= 9 ? 350 : z <= 11 ? 220 : 150, nb = new Float32Array(8);
    for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){
      const i = y * W + x, v = h[i];
      let n = 0, sum = 0;
      for(let dy = -1; dy <= 1; dy++) for(let dx = -1; dx <= 1; dx++){
        if(!dx && !dy) continue;
        const q = h[Math.min(H - 1, Math.max(0, y + dy)) * W + Math.min(W - 1, Math.max(0, x + dx))];
        nb[n++] = q; sum += q;
      }
      if(v >= 0 && Math.abs(v - sum / 8) <= T) continue;
      const m = nb.sort()[4], out = Math.max(0, Math.abs(v - m) > T ? m : v);   // typed array: numeriek gesorteerd
      if(out === v) continue;
      const e = out + 32768;
      d[4*i] = Math.floor(e / 256); d[4*i+1] = Math.floor(e) % 256; d[4*i+2] = Math.floor((e - Math.floor(e)) * 256);
    }
    for(let i = 0; i < W * H; i++) h[i] = d[4*i] * 256 + d[4*i+1] + d[4*i+2] / 256 - 32768;
    return h;
  }

  // opgeschoonde hoogtetegel: {img: ImageData (terrarium-kleuren), h: hoogtes, w}; de laatste 160 blijven bewaard
  const cache = new Map();
  function dem(z, x, y){
    const n = 2 ** z;
    if(y < 0 || y >= n) return Promise.resolve(null);
    x = ((x % n) + n) % n;
    const k = `${z}/${x}/${y}`;
    let p = cache.get(k);
    if(p){ cache.delete(k); cache.set(k, p); return p; }
    p = (async () => {
      const res = await fetch(demURL(z, x, y));
      if(!res.ok) throw new Error(`hoogtetegel ${res.status}`);
      const bmp = await bitmap(await res.blob()), cx = canvas2d(bmp.width, bmp.height);
      cx.drawImage(bmp, 0, 0); bmp.close?.();
      const img = cx.getImageData(0, 0, cx.canvas.width, cx.canvas.height);
      return {img, h:despike(img, z), w:img.width};
    })();
    p.catch(() => cache.delete(k));
    cache.set(k, p);
    if(cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
    return p;
  }

  // ---------- winterkaart ----------
  // Elke pixel: sneeuw, belicht vanuit het noordwesten (lichte kant wit, schaduwkant blauwgrijs); steile wanden (> 38°)
  // grijze rots, want daar blijft geen sneeuw liggen; lage dalen iets groenig-grijs; water lichtblauw.
  const mix = (a, b, t) => a + (b - a) * t;
  const LIGHT = (() => { const az = 315 * Math.PI / 180, alt = 40 * Math.PI / 180; return [Math.cos(alt) * Math.sin(az), Math.cos(alt) * Math.cos(az), Math.sin(alt)]; })();
  async function winter(z, x, y, r = 1){
    const S = 256 * r, zd = Math.min(DEM_MAX, z + Math.log2(r)), sc = 2 ** (z - zd) * r;   // sc = uitvoerpixels per hoogtepixel
    // welke hoogtetegels zijn nodig (met één pixel rand, dus soms de buren)
    const gx0 = Math.floor(((x * 256) - 2) * r / sc), gx1 = Math.floor(((x * 256) + 258) * r / sc);
    const gy0 = Math.floor(((y * 256) - 2) * r / sc), gy1 = Math.floor(((y * 256) + 258) * r / sc);
    const tiles = new Map(), jobs = [];
    for(let ty = Math.floor(gy0 / 256); ty <= Math.floor(gy1 / 256); ty++)
      for(let tx = Math.floor(gx0 / 256); tx <= Math.floor(gx1 / 256); tx++)
        jobs.push(dem(zd, tx, ty).then(t => tiles.set(`${tx}/${ty}`, t), () => {}));
    await Promise.all(jobs);
    const any = [...tiles.values()].find(Boolean);
    if(!any) throw new Error("geen hoogtegegevens");
    const N = 2 ** zd * 256;
    const at = (gx, gy) => {       // hoogte op hoogtepixel (geheel getal), met tegels als één grote kaart
      gy = Math.min(N - 1, Math.max(0, gy)); const tx = Math.floor(gx / 256), ty = Math.floor(gy / 256);
      const t = tiles.get(`${tx}/${ty}`) || any;
      return t.h[(gy - ty * 256) * t.w + (((gx - tx * 256) % 256) + 256) % 256];
    };
    // hoogte per uitvoerpixel, met een rand van 1 (bilineair tussen hoogtepixels)
    const E = S + 2, hh = new Float32Array(E * E);
    for(let j = -1; j <= S; j++){
      const v = ((y * 256) * r + j + .5) / sc - .5, v0 = Math.floor(v), fv = v - v0;
      for(let i = -1; i <= S; i++){
        const u = ((x * 256) * r + i + .5) / sc - .5, u0 = Math.floor(u), fu = u - u0;
        const a = at(u0, v0), b = at(u0 + 1, v0), c = at(u0, v0 + 1), d = at(u0 + 1, v0 + 1);
        hh[(j + 1) * E + i + 1] = mix(mix(a, b, fu), mix(c, d, fu), fv);
      }
    }
    const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + .5) / 2 ** z))) ;
    const mpp = 40075016.686 * Math.cos(lat) / (256 * r * 2 ** z);
    const ex = z <= 10 ? 2.2 : z <= 12 ? 1.6 : 1.3;           // uitgezoomd wat meer reliëf, anders wordt het vlak
    // hoogtelijnen, zoals op een pistekaart: dichter als je verder inzoomt; elke vijfde iets donkerder
    const ze = z + Math.log2(r), step = ze >= 15 ? 50 : ze >= 13 ? 100 : ze >= 11 ? 200 : 0;
    const out = new ImageData(S, S), o = out.data;
    for(let j = 0; j < S; j++) for(let i = 0; i < S; i++){
      const k = (j + 1) * E + i + 1, h = hh[k];
      // Horn: helling oost-west en noord-zuid
      const a = hh[k - E - 1], b = hh[k - E], c = hh[k - E + 1], d = hh[k - 1], f = hh[k + 1], g = hh[k + E - 1], q = hh[k + E], s = hh[k + E + 1];
      const dzE = ((c + 2 * f + s) - (a + 2 * d + g)) / (8 * mpp), dzN = ((a + 2 * b + c) - (g + 2 * q + s)) / (8 * mpp);
      const nx = -dzE * ex, ny = -dzN * ex, nl = Math.hypot(nx, ny, 1);
      const lit = Math.max(0, (nx * LIGHT[0] + ny * LIGHT[1] + LIGHT[2]) / nl) / LIGHT[2];   // vlak = 1
      const slope = Math.atan(Math.hypot(dzE, dzN)) * 180 / Math.PI;
      let R, G, B;
      if(h <= .5){ R = 156; G = 192; B = 226; }            // water
      else {
        const t = Math.min(1, lit), up = Math.min(.25, Math.max(0, lit - 1));
        R = mix(112, 250, t) + up * 20; G = mix(138, 252, t) + up * 12; B = mix(178, 255, t);
        const valley = Math.max(0, Math.min(1, (900 - h) / 500)) * .28;      // lage dalen: iets groenig-grijs
        R = mix(R, R * .82 + 20, valley); G = mix(G, G * .9 + 18, valley); B = mix(B, B * .8 + 10, valley);
        const rock = Math.max(0, Math.min(1, (slope - 38) / 14));           // steile wanden: rots
        if(rock){ R = mix(R, mix(62, 150, t), rock); G = mix(G, mix(66, 146, t), rock); B = mix(B, mix(76, 142, t), rock); }
        if(step){
          const band = Math.floor(h / step), bR = Math.floor(hh[k + 1] / step), bD = Math.floor(hh[k + E] / step);
          if(band !== bR || band !== bD){
            const big = Math.max(band, bR, bD) % 5 === 0, m = (big ? .42 : .24) * (1 - rock * .6);
            R = mix(R, 92, m); G = mix(G, 114, m); B = mix(B, 148, m);
          }
        }
      }
      const p = (j * S + i) * 4; o[p] = R; o[p+1] = G; o[p+2] = B; o[p+3] = 255;
    }
    return out;
  }

  async function make(kind, z, x, y, r){
    if(kind === "dem"){ const t = await dem(z, x, y); if(!t) throw new Error("buiten de kaart"); return bitmap(t.img); }
    return bitmap(await winter(z, x, y, r || 1));
  }

  // ---------- als worker ----------
  if(IS_WORKER){
    const ok = typeof OffscreenCanvas !== "undefined" && typeof createImageBitmap === "function" && !!new OffscreenCanvas(1, 1).getContext("2d");
    self.postMessage({ready:ok});
    // wachtrij: de nieuwste vraag eerst (dat is wat je nu ziet), hooguit drie tegelijk; afgebroken vragen vervallen
    const queue = [];
    let running = 0;
    const pump = () => {
      while(running < 3 && queue.length){
        const {id, kind, z, x, y, r} = queue.pop(); running++;
        make(kind, z, x, y, r).then(bmp => self.postMessage({id, bmp}, [bmp]), e => self.postMessage({id, err:String(e.message || e)}))
          .finally(() => { running--; pump(); });
      }
    };
    self.onmessage = ev => {
      const m = ev.data;
      if(m.cancel){ const i = queue.findIndex(j => j.id === m.cancel); if(i >= 0) queue.splice(i, 1); return; }
      queue.push(m); pump();
    };
    return;
  }

  // ---------- in de pagina ----------
  const SRC = document.currentScript?.src;
  let worker = null, ready = null, seq = 0;
  const wait = new Map();
  function startWorker(){
    return ready ||= (async () => {
      try{
        const code = await (await fetch(SRC)).text();
        const w = new Worker(URL.createObjectURL(new Blob([code], {type:"text/javascript"})));
        const ok = await new Promise(res => {
          const t = setTimeout(() => res(false), 4000);
          w.onmessage = ev => { if("ready" in ev.data){ clearTimeout(t); res(ev.data.ready); } };
          w.onerror = () => { clearTimeout(t); res(false); };
        });
        if(!ok){ w.terminate(); return false; }
        w.onmessage = ev => { const p = wait.get(ev.data.id); if(!p) return; wait.delete(ev.data.id); ev.data.err ? p.bad(new Error(ev.data.err)) : p.ok(ev.data.bmp); };
        worker = w; return true;
      }catch(e){ return false; }
    })();
  }
  window.PPterrain = {
    // signal (optioneel): een AbortSignal; een tegel die niet meer nodig is, wordt dan niet meer getekend
    async get(kind, z, x, y, r, signal){
      if(await startWorker()) return new Promise((ok, bad) => {
        const id = ++seq;
        if(signal?.aborted) return bad(new DOMException("afgebroken", "AbortError"));
        wait.set(id, {ok, bad}); worker.postMessage({id, kind, z, x, y, r});
        signal?.addEventListener("abort", () => { if(!wait.has(id)) return; wait.delete(id); worker.postMessage({cancel:id}); bad(new DOMException("afgebroken", "AbortError")); }, {once:true});
      });
      return make(kind, z, x, y, r);      // geen worker mogelijk: hier rekenen
    }
  };
})();
