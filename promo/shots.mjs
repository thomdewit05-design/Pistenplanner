// Maakt scherpe schermafbeeldingen van de app (telefoonformaat, 3x) voor de promotievideo.
// Gebruik: node promo/shots.mjs [nl|en|de]   (met de lokale server op poort 8766)
import { writeFileSync, mkdirSync } from "node:fs";
import { launch } from "./cdp.mjs";

const LANG = process.argv[2] || "nl";
const OUT = new URL(LANG === "nl" ? "./shots/" : `./shots/${LANG}/`, import.meta.url); mkdirSync(OUT, {recursive:true});
const c = await launch();
await c.send("Emulation.setDeviceMetricsOverride", {width:390, height:844, deviceScaleFactor:3, mobile:true});
await c.send("Emulation.setTouchEmulationEnabled", {enabled:true});
// klok op 10:20 's ochtends, zodat tijden in beeld kloppen met een skidag
await c.send("Page.addScriptToEvaluateOnNewDocument", {source:`(() => { const R = Date, t = new R(); t.setHours(10, 20, 0, 0); const off = t - R.now();
  class D extends R { constructor(...a){ a.length ? super(...a) : super(R.now() + off); } static now(){ return R.now() + off; } }
  window.Date = D; try{ localStorage.setItem("pp-lang", "${LANG}"); }catch(e){} })();`});
await c.navigate("http://localhost:8766/?promo=1");
await c.sleep(4000);

const shot = async name => {
  await c.sleep(4500);   // kaarttegels laten laden
  const r = await c.send("Page.captureScreenshot", {format:"png"});
  writeFileSync(new URL(name + ".png", OUT), Buffer.from(r.data, "base64")); console.log("gemaakt:", name);
};

// gemeenschappelijk: Ischgl openen, toasts weg
await c.evaluate(`(async () => {
  const r = S.index.find(x => x[1].startsWith("Silvretta Arena")); await openArea(r[0]);
  window.toast = () => {}; document.getElementById("toast").style.display = "none";
  S.level = 2; S.liftOpen = "08:30"; S.liftClose = "16:30";
})()`);

// 1. een route over de pistes
await c.evaluate(`(async () => { defaultRoute(); update(); fitRoute(); setSheet(false); })()`);
await shot("1-route");

// 2. navigeren: je staat op de route, met gesproken aanwijzingen
await c.evaluate(`(async () => {
  const st = S.steps[4], p = st.line[Math.floor(st.line.length * .3)];
  S.fromMe = true; S.follow = true;
  await onPos({coords:{latitude:p[0], longitude:p[1], accuracy:6, altitude:2100, speed:11, heading:null}, timestamp:Date.now()});
  update(); map.setView(p, 16, {animate:false}); setSheet(false);
})()`);
await shot("2-nav");

// 3. samen skiën: vrienden op de kaart, iemand start de route voor iedereen
await c.evaluate(`(async () => {
  S.follow = false; S.fromMe = false; defaultRoute(); update();
  const L_ = S.steps.flatMap(s => s.line), now = Date.now(), at = f => L_[Math.floor(L_.length * f)];
  G.code = "DEMO"; G.name = "Thom";
  G.members = new Map([["a", {id:"a", name:"Sanne", lat:at(.15)[0], lon:at(.15)[1], posTs:now, seen:now}],
                       ["b", {id:"b", name:"Daan", lat:at(.45)[0], lon:at(.45)[1], posTs:now, seen:now}],
                       ["c", {id:"c", name:"Lotte", lat:at(.7)[0], lon:at(.7)[1], posTs:now, seen:now}]]);
  meMarker?.remove(); meCircle?.remove(); meMarker = meCircle = null; S.pos = null;
  drawMembers(); update(); fitRoute();
  Object.defineProperty(navigator, "userActivation", {value:{hasBeenActive:true}});
  goBanner({name:"Sanne", id:"a"}); clearInterval(goTimer);
})()`);
await shot("3-group");

// 4. zon en schaduw op een winterse middag
await c.evaluate(`(async () => {
  document.getElementById("goBanner")?.remove(); G.code = null; G.members = new Map(); drawMembers(); clearRoute();
  window.sunTime = () => ({ms:Date.UTC(2027, 0, 20, 12, 30), m:13*60 + 30}); S.area.sun = null;
  S.sunOn = true; document.getElementById("sunToggle").checked = true; drawSun(); fitArea(true);
  map.setZoom(map.getZoom() + 1, {animate:false}); setSheet(false);
})()`);
await shot("4-sun");

// 5. routebeschrijving uitgeklapt, met het weer
await c.evaluate(`(async () => {
  S.sunOn = false; drawSun(); defaultRoute(); update(); fitRoute(); setSheet(true);
  document.getElementById("result").scrollIntoView({block:"start"});
})()`);
await shot("5-steps");

// 6. skigebied kiezen: ruim 1.800 gebieden
await c.evaluate(`(async () => { setSheet(false); openPicker(); document.getElementById("q").blur(); })()`);
await shot("6-areas");

c.close();
