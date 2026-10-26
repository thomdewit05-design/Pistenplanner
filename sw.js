// Service worker: app en kaartdata offline beschikbaar, satelliettegels die je bekeken hebt ook.
const VERSION = "v24";
const SHELL = `shell-${VERSION}`, DATA = `data-${VERSION}`, TILES = "tiles-v1";
const SHELL_FILES = ["./", "index.html", "app.css?v=24", "app.js?v=24", "i18n.js?v=24", "manifest.webmanifest",
  "vendor/leaflet/leaflet.js", "vendor/leaflet/leaflet.css", "vendor/fonts.css", "vendor/qrcode.js", "icons/logo.svg", "icons/icon-192.png", "icons/icon-512.png", "data/index.json?d3"];
const TILE_HOSTS = ["server.arcgisonline.com", "tile.opentopomap.org", "tile.openstreetmap.org"];
const MAX_TILES = 4000;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES.map(u => new Request(u, {cache:"reload"})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => ![SHELL, DATA, TILES].includes(k)).map(k => caches.delete(k))))
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
  if(TILE_HOSTS.some(h => url.hostname.endsWith(h))) return e.respondWith(cacheFirst(req, TILES, true));
  if(url.origin !== location.origin) return;
  if(url.pathname.includes("/data/s")) return e.respondWith(cacheFirst(req, DATA));
  if(url.pathname.includes("/vendor/") || url.pathname.includes("/icons/")) return e.respondWith(cacheFirst(req, SHELL));
  e.respondWith(networkFirst(req));
});
