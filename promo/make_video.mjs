// Neemt de teaser op als MP4 (of maakt losse voorbeeldbeelden met --stills).
// Gebruik: node promo/make_video.mjs [--stills]   (met de lokale server op poort 8766)
import { writeFileSync, mkdirSync } from "node:fs";
import { launch } from "./cdp.mjs";

const stills = process.argv.includes("--stills");
const c = await launch(9334);
await c.send("Emulation.setDeviceMetricsOverride", {width:540, height:960, deviceScaleFactor:1, mobile:false});
await c.navigate("http://localhost:8766/promo/video.html?" + Date.now());
await c.evaluate("window.ready");

if(stills){
  mkdirSync(new URL("./stills/", import.meta.url), {recursive:true});
  for(const t of [1.6, 5.2, 8.5, 12.5, 16.5, 20.5, 24.8, 29]){
    const b64 = await c.evaluate(`(renderAt(${t}), document.getElementById("c").toDataURL("image/jpeg", .85).split(",")[1])`);
    writeFileSync(new URL(`./stills/t${String(t).replace(".", "_")}.jpg`, import.meta.url), Buffer.from(b64, "base64"));
  }
  console.log("voorbeeldbeelden gemaakt");
} else {
  const r = await c.evaluate("record()", 120000);
  const ext = r.type.includes("mp4") ? "mp4" : "webm";
  writeFileSync(new URL(`./skipiloot-teaser.${ext}`, import.meta.url), Buffer.from(r.b64, "base64"));
  console.log(`video gemaakt: ${r.type}, ${(r.size / 1e6).toFixed(1)} MB`, JSON.stringify(r.stats));
}
c.close();
