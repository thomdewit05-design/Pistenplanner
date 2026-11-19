// De servicewerker (website en Android): na een update van de app zijn de gegevens van een gedownload gebied er nog,
// ook zonder verbinding, en de startbestanden horen bij de nieuwe versie.
//   node tools/sw.mjs
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";

const req = createRequire(import.meta.url);
const pw = await import("playwright").catch(() => req("playwright"));
const { chromium } = pw.chromium ? pw : pw.default;
const ROOT = new URL("..", import.meta.url).pathname, PORT = 8792;
const TYPES = {".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".json":"application/json", ".svg":"image/svg+xml", ".png":"image/png", ".woff2":"font/woff2", ".webmanifest":"application/manifest+json"};
let ver = 900;   // de versie die de server uitdeelt; ophogen = een update van de app
const server = createServer(async (rq, res) => {
  const p = decodeURIComponent(new URL(rq.url, "http://x").pathname), f = join(ROOT, p === "/" ? "index.html" : p);
  try{ let b = await readFile(f);
    if(/(^|\/)sw\.js$/.test(f)) b = Buffer.from(b.toString().replace(/VERSION = "v\d+"/, `VERSION = "v${ver}"`));
    if(/index\.html$/.test(f)) b = Buffer.from(b.toString().replace(/\?v=\d+/g, `?v=${ver}`));
    res.writeHead(200, {"Content-Type":TYPES[extname(f)] || "application/octet-stream", "Cache-Control":"no-store"}); res.end(b); }
  catch(e){ res.writeHead(404); res.end(); }
}).listen(PORT);
const shard = (await readdir(join(ROOT, "data"))).filter(f => /^s.*\.json$/.test(f)).sort()[0], dataV = /DATA_V = "([^"]+)"/.exec(await readFile(join(ROOT, "app.js"), "utf8"))[1];
const browser = await chromium.launch(), problems = [];
const ctx = await browser.newContext({viewport:{width:393, height:852}});
await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
await ctx.addInitScript(() => { localStorage.setItem("pp-onboarded", "1"); localStorage.setItem("pp-new-2", "1"); localStorage.setItem("pp-lang", "nl"); });
const p = await ctx.newPage(), base = `http://localhost:${PORT}/`;
const ready = () => p.evaluate(async () => { await navigator.serviceWorker.ready; for(let i = 0; i < 100 && !navigator.serviceWorker.controller; i++) await new Promise(r => setTimeout(r, 100)); return !!navigator.serviceWorker.controller; });
const state = () => p.evaluate(async () => { const out = {}; for(const k of await caches.keys()) out[k] = (await (await caches.open(k)).keys()).map(r => r.url.replace(location.origin + "/", "")); return out; });

await p.goto(base + "index.html"); if(!(await ready())) problems.push("de servicewerker werd niet actief");
// een gebied "downloaden": de pistedata ophalen, en een restant van een oudere versie neerzetten
await p.evaluate(async ([shard, dataV]) => { await (await fetch(`data/${shard}?${dataV}`)).text(); const old = await caches.open("data-v100"); await old.put(new Request(location.origin + "/data/soud.json?d4"), new Response("{}", {headers:{"Content-Type":"application/json"}})); }, [shard, dataV]);
await p.waitForTimeout(500);
const a = await state();
if(!(a["data-1"] || []).some(u => u.includes(shard))) problems.push(`de pistedata staat niet in de vaste opslag: ${JSON.stringify(Object.keys(a))}`);
if(!(a["shell-v900"] || []).some(u => u === "app.js?v=900")) problems.push(`de startbestanden horen niet bij versie 900: ${JSON.stringify((a["shell-v900"] || []).filter(u => /app\.js/.test(u)))}`);

// update van de app
ver = 901; await p.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); });
let active = false; for(let i = 0; i < 100 && !active; i++){ await p.waitForTimeout(200); const k = await p.evaluate(() => caches.keys()); active = k.includes("shell-v901") && !k.includes("shell-v900"); }
if(!active) problems.push("de nieuwe versie werd niet actief");
const b = await state();
if(!(b["data-1"] || []).some(u => u.includes(shard))) problems.push(`na de update is de pistedata van het gedownloade gebied weg: ${JSON.stringify(Object.keys(b))}`);
if(!(b["data-1"] || []).some(u => u.includes("soud.json"))) problems.push("de pistedata uit de opslag van een oudere versie is niet meegenomen");
if(Object.keys(b).some(k => /^data-v\d+$/.test(k) || k === "shell-v900")) problems.push(`oude opslag is niet opgeruimd: ${JSON.stringify(Object.keys(b))}`);
if(!(b["shell-v901"] || []).some(u => u === "app.js?v=901")) problems.push("de startbestanden horen niet bij de nieuwe versie");
// zonder verbinding: de app start en het gebied is er
await ctx.setOffline(true); await p.goto(base + "index.html").catch(e => problems.push(`zonder verbinding start de app niet: ${e.message.split("\n")[0]}`));
const off = await p.evaluate(async ([shard, dataV]) => { try{ const r = await fetch(`data/${shard}?${dataV}`); return r.ok && (await r.text()).length > 100; }catch(e){ return false; } }, [shard, dataV]).catch(() => false);
if(!off) problems.push("zonder verbinding is de pistedata van het gedownloade gebied niet te lezen");
await browser.close(); server.close();
console.log(problems.length ? problems.join("\n") + `\n\n${problems.length} problemen.` : "Servicewerker in orde.");
process.exit(problems.length ? 1 : 0);
