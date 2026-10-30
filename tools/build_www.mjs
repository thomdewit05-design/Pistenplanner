// Zet de bestanden van de webapp in www/, de map die Capacitor in de iOS-app stopt.
// Gebruik: node tools/build_www.mjs (vanuit de projectmap), daarna npx cap sync ios. Of in één keer: npm run ios.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const FILES = ["index.html", "app.css", "app.js", "i18n.js", "config.js", "ads.js", "map3d.js", "terrain.js", "privacy.html", "voorwaarden.html", "support.html"];
const DIRS = ["icons", "vendor", "data"];

rmSync("www", { recursive: true, force: true });
mkdirSync("www");
for (const f of FILES) cpSync(f, `www/${f}`);
for (const d of DIRS) cpSync(d, `www/${d}`, { recursive: true });

// de gebiedspagina's zitten niet in de app: daarvoor naar de website
const site = /site:\s*"([^"]+)"/.exec(readFileSync("config.js", "utf8"))?.[1];
if (!site) throw new Error("Geen site-adres gevonden in config.js");
const html = readFileSync("www/index.html", "utf8").replace('href="gebieden/"', `href="${site}gebieden/"`);
writeFileSync("www/index.html", html);
console.log("www klaar");
