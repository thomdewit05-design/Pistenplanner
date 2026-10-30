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
    const TEST = "ca-app-pub-3940256099942544/2934735716";   // proefblok van Google (balk)
    const TEST_FULL = "ca-app-pub-3940256099942544/4411468910";   // proefblok van Google (schermvullend)
    const call = (m, o) => window.Capacitor.nativePromise("AdMob", m, o || {});
    const PANELS = ["picker", "diary", "menu", "status", "group"];
    let ready = false, made = false, shown = false, retryT = 0;
    // waarom er wel of geen advertentie is, zichtbaar in het menu (anders zie je niet of het aan Google of aan de app ligt)
    let state = "Starten…";
    const setState = s => { state = s; const el = document.getElementById("adState"); if(el){ el.hidden = false; el.textContent = "Advertenties: " + s; } };
    const plugin = () => window.Capacitor?.Plugins?.AdMob;
    const NO_AD = {0:"interne fout bij Google", 1:"ongeldig verzoek (klopt het advertentieblok-ID?)", 2:"geen netwerk", 3:"Google heeft nog geen advertentie voor deze app (gebruikelijk bij een nieuwe app of zolang de app in AdMob wordt beoordeeld)", 8:"de app-ID in AdMob past niet bij dit advertentieblok"};
    // ook als het routepaneel helemaal open staat (je leest dan de routebeschrijving, de kaart is toch bedekt)
    const sheetOpen = () => document.getElementById("sheet")?.classList.contains("open");
    const want = () => ready && !(typeof proActive === "function" && proActive()) && !(typeof S !== "undefined" && S.follow)
      && (sheetOpen() || PANELS.some(id => { const el = document.getElementById(id); return el && !el.hidden; }));
    async function sync(){
      const on = want(); if(on === shown) return; shown = on;
      document.body.classList.toggle("admob", on);
      try{
        if(on && !made){ made = true; await call("showBanner", {adId:ios.banner || TEST, adSize:"ADAPTIVE_BANNER", position:"BOTTOM_CENTER", margin:0, isTesting:!ios.banner}); }
        else await call(on ? "resumeBanner" : "hideBanner");
      }catch(e){ made = false; shown = false; setState("de balk kon niet starten (" + (e?.message || e) + ")"); }
    }
    async function start(){
      if(typeof proActive === "function" && proActive()){ setState("uit, want je hebt Skipilot Pro"); return; }   // Pro gekocht: geen advertenties, dus ook geen vragen
      try{
        // meldingen van de advertenties zelf: geladen of waarom niet; bij "geen advertentie" over een minuut opnieuw
        const p = plugin();
        p?.addListener?.("bannerAdLoaded", () => setState(ios.banner ? "aan" : "aan (proefadvertenties)"));
        p?.addListener?.("bannerAdFailedToLoad", e => {
          setState(`geen balk: ${NO_AD[e?.code] || e?.message || "onbekende fout"}${e?.code != null ? ` (code ${e.code})` : ""}`);
          made = false; shown = false; clearTimeout(retryT);
          call("removeBanner").catch(() => {}).finally(() => { retryT = setTimeout(sync, 60000); });
        });
        await call("initialize", {initializeForTesting:!ios.banner});
        let c = await call("requestConsentInfo");
        if(c.status === "REQUIRED" && c.isConsentFormAvailable) c = await call("showConsentForm");
        if(c.privacyOptionsRequirementStatus === "REQUIRED"){ const b = document.getElementById("adPrivacy"); if(b) b.hidden = false; }
        try{ const t = await call("trackingAuthorizationStatus"); if(t.status === "notDetermined") await call("requestTrackingAuthorization"); }catch(e){}
        if(c.canRequestAds === false){
          setState(c.status === "REQUIRED" && !c.isConsentFormAvailable
            ? "geen toestemmingsmelding gevonden. Publiceer in AdMob onder Privacy en berichten een GDPR-melding voor Europa."
            : `nog geen toestemming (status ${c.status})`);
          return;
        }
        setState("wachten op een advertentie…");
        ready = true; sync(); prepFull();
      }catch(e){ setState("starten mislukt (" + (e?.message || e) + ")"); }
    }
    // schermvullende advertentie bij een natuurlijke pauze (navigatie gestopt, skidag klaar, ander skigebied gekozen): hooguit eens per 15 minuten,
    // niet in de eerste 10 minuten na het openen en nooit tijdens het navigeren of met Pro
    const full = ios.interstitial || (!ios.banner && ios.test ? TEST_FULL : "");
    let lastFull = Date.now() - 5*60e3, fullReady = false;
    async function prepFull(){
      if(!full || fullReady) return;
      try{ await call("prepareInterstitial", {adId:full, isTesting:!ios.interstitial}); fullReady = true; }
      catch(e){ setTimeout(prepFull, 120000); }   // nog geen schermvullende advertentie: later opnieuw
    }
    async function pause(){
      if(!ready || !full || (typeof proActive === "function" && proActive()) || (typeof S !== "undefined" && S.follow)) return;
      if(Date.now() - lastFull < 15*60e3) return;
      if(!fullReady) return prepFull();
      lastFull = Date.now(); fullReady = false;
      setTimeout(async () => { try{ await call("showInterstitial"); }catch(e){} prepFull(); }, 1200);
    }
    window.ppAds.native = {sync, pause, privacy:() => call("showPrivacyOptionsForm").catch(() => {})};
    const watch = () => {
      const obs = new MutationObserver(sync);
      PANELS.forEach(id => { const el = document.getElementById(id); if(el) obs.observe(el, {attributes:true, attributeFilter:["hidden"]}); });
      const sh = document.getElementById("sheet"); if(sh) obs.observe(sh, {attributes:true, attributeFilter:["class"]});
      setTimeout(start, 2500);   // eerst de app laten zien, dan pas de toestemmingsvragen
    };
    if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", watch); else watch();
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => fill());
  else fill();
})();
