// Controleert de opgenomen video: lengte, formaat, beeldjes per seconde en een paar beelden.
import { writeFileSync } from "node:fs";
import { launch } from "./cdp.mjs";
const c = await launch(9335);
await c.navigate("http://localhost:8766/promo/video.html");
const info = await c.evaluate(`(async () => {
  const v = document.createElement("video"); v.muted = true; v.src = "skipilot-teaser.mp4?" + Date.now(); document.body.appendChild(v);
  await new Promise(r => v.onloadedmetadata = r);
  // beeldjes tellen tijdens afspelen (eerste 6 seconden)
  let frames = 0, last = null, gaps = [];
  const cb = (now, m) => { frames++; if(last != null) gaps.push(m.mediaTime - last); last = m.mediaTime; if(m.mediaTime < 6) v.requestVideoFrameCallback(cb); };
  v.requestVideoFrameCallback(cb); await v.play(); await new Promise(r => setTimeout(r, 6300)); v.pause();
  const fps = frames / 6, maxGap = Math.max(...gaps);
  // beelden pakken
  const cv = document.createElement("canvas"); cv.width = 270; cv.height = 480; const g = cv.getContext("2d"), out = [];
  for(const t of [2, 8, 13, 17, 21, 24.5, 28.5]){ v.currentTime = t; await new Promise(r => v.onseeked = r); g.drawImage(v, 0, 0, 270, 480); out.push(cv.toDataURL("image/jpeg", .8).split(",")[1]); }
  return {duration:v.duration, w:v.videoWidth, h:v.videoHeight, fps, maxGap, out};
})()`, 60000);
const { createRequire } = await import("node:module");
info.out.forEach((b, i) => writeFileSync(new URL(`./stills/check${i}.jpg`, import.meta.url), Buffer.from(b, "base64")));
console.log(JSON.stringify({duration:info.duration, size:`${info.w}x${info.h}`, fps:info.fps.toFixed(1), maxGap:info.maxGap.toFixed(3)}));
c.close();
