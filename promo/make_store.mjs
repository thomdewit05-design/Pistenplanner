// Maakt de Play Store-afbeeldingen in store/: schermafbeeldingen per taal, de banner en het icoon.
// Gebruik: node promo/make_store.mjs   (eerst node promo/shots.mjs nl en en; lokale server op poort 8766)
import { writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { launch } from "./cdp.mjs";

const STORE = new URL("../store/", import.meta.url);
const c = await launch(9336);
await c.navigate(`http://localhost:8766/promo/store.html?t=${Date.now()}`);
await c.evaluate("window.ready");
for(const lang of ["nl", "en"]){
  const dir = new URL(`./${lang}/`, STORE); mkdirSync(dir, {recursive:true});
  for(let i = 0; i < 6; i++){
    writeFileSync(new URL(`screenshot-${i + 1}.jpg`, dir), Buffer.from(await c.evaluate(`screenshot("${lang}", ${i})`), "base64"));
  }
  writeFileSync(new URL(`feature-graphic.jpg`, dir), Buffer.from(await c.evaluate(`feature("${lang}")`), "base64"));
  console.log("klaar:", lang);
}
copyFileSync(new URL("../icons/icon-maskable-512.png", import.meta.url), new URL("icon-512.png", STORE));
c.close();
