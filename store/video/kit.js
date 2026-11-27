// Gedeelde hulpjes voor de korte video's (promo-tips, promo-resort, promo-wrapped, promo-types).
// Een pagina tekent zichzelf in render(t) en roept daarna boot(DUUR, render) aan.
// seek(t) zet de tijdlijn op een tijdstip (tools/promo-video.mjs); ?play speelt af in de browser (R = opnieuw).
const Q = new URLSearchParams(location.search), LANG = Q.get("l") || "en", $ = id => document.getElementById(id);
const clamp = x => Math.max(0, Math.min(1, x)), seg = (t, a, b) => clamp((t - a) / (b - a)), lerp = (a, b, x) => a + (b - a) * x;
const eo = x => 1 - Math.pow(1 - x, 3), eio = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const back = x => { const c = 2.2; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };   // doorschieten en terugveren
const tf = (el, x, y, s = 1, r = 0) => { el.style.transform = `translate(${x}px,${y}px) scale(${s}) rotate(${r}deg)`; };
const inout = (t, a, b, f = .3) => Math.min(seg(t, a, a + f), 1 - seg(t, b - f, b));       // 0 → 1 → 0 tussen a en b
const pop = (t, a, d = .4) => { const u = seg(t, a, a + d); return u > 0 ? lerp(.4, 1, back(u)) : 0; };   // in beeld veren vanaf tijdstip a
const count = (t, a, d, v, dec = 0, loc = "en-US") => (v * eo(seg(t, a, a + d))).toLocaleString(loc, {minimumFractionDigits:dec, maximumFractionDigits:dec});
let PENDING = [];
// een beeld uit een fragment (store/video/clips/<taal>/<naam>/0000.jpg …) in een <img> zetten; seek wacht tot het geladen is
function clipFrame(img, name, i, n){ const src = `clips/${window.CLIPS || LANG}/${name}/${String(Math.max(0, Math.min(n - 1, i))).padStart(4, "0")}.jpg`;
  if(img.dataset.src !== src){ img.dataset.src = src; img.src = src; PENDING.push(img.decode().catch(() => { document.body.dataset.missing = (document.body.dataset.missing || "") + " " + src; })); } }
function boot(DUR, render){
  window.DUR = DUR;
  window.seek = async t => { PENDING = []; render(Math.max(0, Math.min(DUR, t))); if(PENDING.length) await Promise.all(PENDING); };
  window.ready = Promise.all([document.fonts.ready, document.fonts.load("700 30px Barlow"), ...[...document.images].filter(i => i.getAttribute("src")).map(i => i.decode().catch(() => { document.body.dataset.missing = (document.body.dataset.missing || "") + " " + i.src.split("/").pop(); }))])
    .then(() => window.seek(0)).then(() => { document.body.dataset.ready = "1"; });
  if(Q.has("play")){
    const st = $("stage"), fit = () => { const k = Math.min(innerWidth / 1080, innerHeight / 1920); st.style.transform = `translate(${(innerWidth - 1080 * k) / 2}px,${(innerHeight - 1920 * k) / 2}px) scale(${k})`; };
    fit(); addEventListener("resize", fit); let t0 = performance.now();
    const loop = now => { render(Math.min(((now - t0) / 1000) % (DUR + 1.5), DUR)); requestAnimationFrame(loop); };
    addEventListener("keydown", e => { if(e.key === "r") t0 = performance.now(); }); window.ready.then(() => requestAnimationFrame(loop));
  }
}
