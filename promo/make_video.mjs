// Neemt de teaser op als MP4 (of maakt losse voorbeeldbeelden met --stills).
// Gebruik: node promo/make_video.mjs [--stills]   (met de lokale server op poort 8766)
import { writeFileSync, mkdirSync } from "node:fs";
import { launch } from "./cdp.mjs";

const stills = process.argv.includes("--stills");
const LANG = (process.argv.find(a => a.startsWith("--lang=")) || "--lang=nl").slice(7), VO = process.argv.includes("--vo");
const NAME = `skipilot-teaser${LANG === "nl" ? "" : "-" + LANG}${VO ? "-voiceover" : ""}`;
const c = await launch(9334);
await c.send("Emulation.setDeviceMetricsOverride", {width:540, height:960, deviceScaleFactor:1, mobile:false});
await c.navigate(`http://localhost:8766/promo/video.html?lang=${LANG}${VO ? "&vo=1" : ""}&t=${Date.now()}`);
await c.evaluate("window.ready");

if(stills){
  mkdirSync(new URL("./stills/", import.meta.url), {recursive:true});
  for(const t of [1.6, 5.2, 8.5, 12.5, 16.5, 20.5, 24.8, 29]){
    const b64 = await c.evaluate(`(renderAt(${t}), document.getElementById("c").toDataURL("image/jpeg", .85).split(",")[1])`);
    writeFileSync(new URL(`./stills/${LANG}-t${String(t).replace(".", "_")}.jpg`, import.meta.url), Buffer.from(b64, "base64"));
  }
  console.log("voorbeeldbeelden gemaakt");
} else {
  // de video blijft in de pagina staan en wordt in stukken van 8 MB opgehaald (één groot bericht wordt te groot)
  const r = await c.evaluate("record().then(x => { window.__vid = x.b64; return {type:x.type, size:x.size, stats:x.stats, len:x.b64.length}; })", 120000);
  console.log("lengte base64:", r.len); const parts = [];
  for(let i = 0; i < r.len; i += 8e6) parts.push(await c.evaluate(`window.__vid.slice(${i}, ${i + 8e6})`));
  const ext = r.type.includes("mp4") ? "mp4" : "webm";
  writeFileSync(new URL(`./${NAME}-raw.${ext}`, import.meta.url), Buffer.from(parts.join(""), "base64"));
  console.log(`video gemaakt: ${r.type}, ${(r.size / 1e6).toFixed(1)} MB`, JSON.stringify(r.stats));
}
c.close();
