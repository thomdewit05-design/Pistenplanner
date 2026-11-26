// Maakt de promovideo van store/video/promo.html: elk beeld apart vastgelegd, daarna met ffmpeg tot een MP4.
//   node tools/promo-video.mjs [taal, standaard en]                 de hele video naar store/video/skipilot-promo-<taal>.mp4
//   PAGE=promo-tiktok node tools/promo-video.mjs en                 de TikTok-versie (promo-tiktok.html)
//   node tools/promo-video.mjs en --stills 1.5,4,6.5 <map>          losse beelden op die tijdstippen (om na te kijken)
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile, mkdir, rm } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const req = createRequire(import.meta.url);
const pw = await import("playwright").catch(() => req("playwright"));
const { chromium } = pw.chromium ? pw : pw.default;
const ROOT = new URL("..", import.meta.url).pathname, PORT = 8793, FPS = +process.env.FPS || 30;   // FPS=60 voor de hoofdfilm
const PAGE = process.env.PAGE || "promo";   // PAGE=promo-tiktok voor de TikTok-versie
const lang = process.argv[2] || "en", stills = process.argv[3] === "--stills" ? process.argv[4].split(",").map(Number) : null;
const TYPES = {".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".json":"application/json", ".svg":"image/svg+xml", ".png":"image/png", ".jpg":"image/jpeg", ".woff2":"font/woff2"};
const server = createServer(async (rq, res) => {
  const p = decodeURIComponent(new URL(rq.url, "http://x").pathname); const f = join(ROOT, p === "/" ? "index.html" : p);
  try{ const b = await readFile(f); res.writeHead(200, {"Content-Type":TYPES[extname(f)] || "application/octet-stream"}); res.end(b); }catch(e){ res.writeHead(404); res.end(); }
}).listen(PORT);
const browser = await chromium.launch();
const p = await (await browser.newContext({viewport:{width:1080, height:1920}, deviceScaleFactor:1})).newPage();
p.on("pageerror", e => { console.log("fout in de pagina:", e.message); process.exitCode = 1; });
await p.goto(`http://localhost:${PORT}/store/video/${PAGE}.html?l=${lang}`); await p.waitForFunction(() => document.body.dataset.ready === "1");
const missing = await p.evaluate(() => document.body.dataset.missing || "");
if(missing){ console.log("ontbrekende afbeeldingen:" + missing); await browser.close(); server.close(); process.exit(1); }
const DUR = await p.evaluate(() => DUR);
if(stills){
  const out = resolve(process.argv[5] || "."); await mkdir(out, {recursive:true});
  for(const t of stills){ await p.evaluate(t => seek(t), t); await p.screenshot({path:join(out, `still-${String(t).padStart(5, "0")}.jpg`), type:"jpeg", quality:80}); }
  console.log(`${stills.length} beelden in ${out}`);
} else {
  const dir = join(ROOT, "store/video/.frames"); await rm(dir, {recursive:true, force:true}); await mkdir(dir, {recursive:true});
  const n = DUR * FPS;
  for(let i = 0; i < n; i++){ await p.evaluate(t => seek(t), i / FPS); await p.screenshot({path:join(dir, `f${String(i).padStart(5, "0")}.jpg`), type:"jpeg", quality:95}); if(i % 150 === 0) console.log(`${i}/${n}`); }
  const mp4 = join(ROOT, `store/video/skipilot-${PAGE}-${lang}.mp4`);
  const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", join(dir, "f%05d.jpg"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "slow", "-movflags", "+faststart", mp4], {stdio:"inherit"});
  await rm(dir, {recursive:true, force:true});
  if(r.status !== 0){ console.log("ffmpeg mislukt"); process.exitCode = 1; } else console.log(mp4);
}
await browser.close(); server.close();
