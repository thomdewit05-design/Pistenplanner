// Advertenties van Google AdSense. Doet niets zolang er in config.js geen publisher-ID (client) staat.
// Google toont zelf de cookiemelding voor bezoekers uit Europa (instellen in AdSense onder Privacy en berichten).
// Advertentieplekken zijn <div class="ad-slot" data-ad="naam">; de naam koppelt aan een advertentieblok in config.js.
(function(){
  const cfg = (window.PP_CONFIG || {}).ads || {};
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
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => fill());
  else fill();
})();
