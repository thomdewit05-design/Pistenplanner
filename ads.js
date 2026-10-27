// Advertenties van Google AdSense. Doet niets zolang er in config.js geen publisher-ID (client) staat.
// Google toont zelf de cookiemelding voor bezoekers uit Europa (instellen in AdSense onder Privacy en berichten).
// Advertentieplekken zijn <div class="ad-slot" data-ad="naam">; de naam koppelt aan een advertentieblok in config.js.
(function(){
  // in de Play Store- en iOS-app geen AdSense (daar hoort AdMob bij)
  const cfg = window.PP_STORE !== "web" ? {} : (window.PP_CONFIG || {}).ads || {};
  let loaded = false;
  function load(){
    if(loaded || !cfg.client) return; loaded = true;
    const s = document.createElement("script");
    s.async = true; s.crossOrigin = "anonymous";
    s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + encodeURIComponent(cfg.client);
    document.head.appendChild(s);
  }
  // vul alle lege advertentieplekken binnen root
  function fill(root){
    if(!cfg.client) return;
    (root || document).querySelectorAll(".ad-slot[data-ad]:not([data-filled])").forEach(el => {
      const slot = (cfg.slots || {})[el.dataset.ad] || (cfg.slots || {}).default;
      if(!slot) return;
      load();
      el.dataset.filled = "1";
      el.innerHTML = `<div class="ad-label">Advertentie</div><ins class="adsbygoogle" style="display:block" data-ad-client="${cfg.client}" data-ad-slot="${slot}" data-ad-format="auto" data-full-width-responsive="true"></ins>`;
      try{ (window.adsbygoogle = window.adsbygoogle || []).push({}); }catch(e){}
    });
  }
  window.ppAds = {fill, on:() => !!cfg.client};

  // ---- iOS-app: Google AdMob ----
  // Een balk onderin zolang de skigebiedkiezer, het dagboek of het menu open is; nooit tijdens het navigeren
  // en niet voor wie Pro gekocht heeft. Eerst de toestemmingsvragen: Google (Europa) en Apple (volgen).
  const ios = ((window.PP_CONFIG || {}).ads || {}).ios || {};
  if(window.PP_STORE === "ios" && (ios.banner || ios.test)){
    const TEST = "ca-app-pub-3940256099942544/2934735716";   // proefblok van Google
    const call = (m, o) => window.Capacitor.nativePromise("AdMob", m, o || {});
    const PANELS = ["picker", "diary", "menu"];
    let ready = false, made = false, shown = false;
    const want = () => ready && !(typeof proActive === "function" && proActive()) && !(typeof S !== "undefined" && S.follow)
      && PANELS.some(id => { const el = document.getElementById(id); return el && !el.hidden; });
    async function sync(){
      const on = want(); if(on === shown) return; shown = on;
      document.body.classList.toggle("admob", on);
      try{
        if(on && !made){ made = true; await call("showBanner", {adId:ios.banner || TEST, adSize:"ADAPTIVE_BANNER", position:"BOTTOM_CENTER", margin:0, isTesting:!ios.banner}); }
        else await call(on ? "resumeBanner" : "hideBanner");
      }catch(e){}
    }
    async function start(){
      if(typeof proActive === "function" && proActive()) return;   // Pro gekocht: geen advertenties, dus ook geen vragen
      try{
        await call("initialize", {initializeForTesting:!ios.banner});
        let c = await call("requestConsentInfo");
        if(c.status === "REQUIRED" && c.isConsentFormAvailable) c = await call("showConsentForm");
        if(c.privacyOptionsRequirementStatus === "REQUIRED"){ const b = document.getElementById("adPrivacy"); if(b) b.hidden = false; }
        try{ const t = await call("trackingAuthorizationStatus"); if(t.status === "notDetermined") await call("requestTrackingAuthorization"); }catch(e){}
        if(c.canRequestAds === false) return;
        ready = true; sync();
      }catch(e){}
    }
    window.ppAds.native = {sync, privacy:() => call("showPrivacyOptionsForm").catch(() => {})};
    const watch = () => {
      const obs = new MutationObserver(sync);
      PANELS.forEach(id => { const el = document.getElementById(id); if(el) obs.observe(el, {attributes:true, attributeFilter:["hidden"]}); });
      setTimeout(start, 2500);   // eerst de app laten zien, dan pas de toestemmingsvragen
    };
    if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", watch); else watch();
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => fill());
  else fill();
})();
