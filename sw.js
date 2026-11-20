// Service worker: app en kaartdata offline beschikbaar, satelliettegels die je bekeken hebt ook.
const VERSION = "v131";
// De pistedata van gedownloade gebieden staat in een eigen opslag met een vaste naam: een update van de app wist ze niet.
// (Nieuwe kaartgegevens krijgen een ander adres, ?d5 in plaats van ?d4, en komen er dus vanzelf naast.)
const SHELL = `shell-${VERSION}`, DATA = "data-1", TILES = "tiles-v1";
const V = VERSION.slice(1);   // hetzelfde nummer als ?v= in index.html, zodat de startbestanden precies de bestanden zijn die de pagina vraagt
const SHELL_FILES = ["./", "index.html", `app.css?v=${V}`, `app.js?v=${V}`, `i18n.js?v=${V}`, "manifest.webmanifest", `config.js?v=${V}`, `ads.js?v=${V}`, `map3d.js?v=${V}`, `terrain.js?v=${V}`, "icons/winter.png", "privacy.html", "voorwaarden.html",
  "vendor/leaflet/leaflet.js", "vendor/leaflet/leaflet.css", "vendor/fonts.css", "vendor/qrcode.js", "icons/logo.svg", "icons/icon-192.png", "icons/icon-512.png", "data/index.json?d4"];
const TILE_HOSTS = ["server.arcgisonline.com", "tile.opentopomap.org", "tile.openstreetmap.org"];
const MAX_TILES = 4000;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES.map(u => new Request(u, {cache:"reload"})))).then(() => self.skipWaiting()));
});
// pistedata uit de opslag van een eerdere versie (data-v123) meenemen voordat die wordt weggegooid
async function keepOldData(keys){
  const to = await caches.open(DATA);
  for(const k of keys.filter(k => /^data-v\d+$/.test(k))){
    const from = await caches.open(k);
    for(const req of await from.keys()){ if(!(await to.match(req))){ const res = await from.match(req); if(res) await to.put(req, res); } }
  }
}
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(async keys => { await keepOldData(keys).catch(() => {}); return Promise.all(keys.filter(k => ![SHELL, DATA, TILES].includes(k)).map(k => caches.delete(k))); })
    .then(() => self.clients.claim()));
});

async function trimTiles(){
  const c = await caches.open(TILES), keys = await c.keys();
  for(let i = 0; i < keys.length - MAX_TILES; i++) await c.delete(keys[i]);
}
async function cacheFirst(req, name, trim){
  const c = await caches.open(name), hit = await c.match(req);
  if(hit) return hit;
  const res = await fetch(req);
  if(res.ok){ c.put(req, res.clone()); if(trim && Math.random() < .05) trimTiles(); }
  return res;
}
async function networkFirst(req){
  const c = await caches.open(SHELL);
  try{ const res = await fetch(req, {cache:"no-cache"}); if(res.ok) c.put(req, res.clone()); return res; }
  catch(e){ return (await c.match(req)) || (await c.match("index.html")); }
}

self.addEventListener("fetch", e => {
  const req = e.request; if(req.method !== "GET") return;
  const url = new URL(req.url);
  if(TILE_HOSTS.some(h => url.hostname.endsWith(h)) || (url.hostname === "s3.amazonaws.com" && url.pathname.startsWith("/elevation-tiles-prod/")))
    return e.respondWith(cacheFirst(req, TILES, true));   // ook de hoogtegegevens van de 3D-kaart
  if(url.origin !== location.origin) return;
  if(url.pathname.includes("/data/s")) return e.respondWith(cacheFirst(req, DATA));
  if(url.pathname.includes("/vendor/") || url.pathname.includes("/icons/")) return e.respondWith(cacheFirst(req, SHELL));
  e.respondWith(networkFirst(req));
});
