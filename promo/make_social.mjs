// Maakt de advertentievideo voor social media (promo/social.html) als MP4, 1080 x 1920, 30 beelden per seconde.
// Gebruik: python promo/phones.py && node promo/make_social.mjs [nl|en] [--stills]
// Nodig: Playwright (Chromium) en ffmpeg.
import { createServer } from "node:http";
import { readFile, mkdir, writeFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { extname, join, resolve } from "node:path";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const LANG = process.argv.find(a => a === "en" || a === "nl") || "nl";
const STILLS = process.argv.includes("--stills");
const FPS = 30, DUR = 22.5;
const TYPES = {".html":"text/html", ".css":"text/css", ".js":"application/javascript", ".png":"image/png", ".woff2":"font/woff2", ".json":"application/json"};

const srv = createServer(async (q, r) => {
  try{ const f = join(ROOT, decodeURIComponent(q.url.split("?")[0])); r.writeHead(200, {"Content-Type":TYPES[extname(f)] || "application/octet-stream"}); r.end(await readFile(f)); }
  catch(e){ r.writeHead(404); r.end(); }
}).listen(8798);

const b = await chromium.launch();
const p = await b.newPage({viewport:{width:540, height:960}});
await p.goto(`http://localhost:8798/promo/social.html?lang=${LANG}`);
await p.evaluate("window.ready");
const frame = async t => Buffer.from((await p.evaluate(t => (renderAt(t), document.getElementById("c").toDataURL("image/jpeg", .93)), t)).split(",")[1], "base64");

if(STILLS){
  const dir = join(ROOT, "promo", "stills"); await mkdir(dir, {recursive:true});
  for(const t of [1.6, 5, 8.5, 12, 15.5, 18.7, 22]) await writeFile(join(dir, `social-${LANG}-${t}.jpg`), await frame(t));
  console.log("voorbeeldbeelden in promo/stills/");
} else {
  const dir = join(ROOT, "promo", "frames"); await rm(dir, {recursive:true, force:true}); await mkdir(dir, {recursive:true});
  for(let i = 0; i < FPS * DUR; i++) await writeFile(join(dir, `${String(i).padStart(5, "0")}.jpg`), await frame(i / FPS));
  const out = join(ROOT, "promo", `skipilot-social-${LANG}.mp4`);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", join(dir, "%05d.jpg"),
    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out]);
  await rm(dir, {recursive:true, force:true});
  console.log("video:", out);
}
await b.close(); srv.close();
