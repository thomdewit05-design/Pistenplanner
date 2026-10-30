// Instellingen voor Skipilot Pro, de kaartdiensten en de privacyverklaring.
// Leeg laten = nog niet ingesteld; de app werkt dan zoals altijd en iedereen kan alles gebruiken.
// Play Store-versie: de Android-app opent de site met ?src=play (of verwijst vanuit android-app://).
// Daarin geen betaling buiten Google Play om en geen AdSense; onthouden per sessie, zodat dezelfde site in Chrome gewoon de webversie blijft.
// iOS-app (App Store): de bestanden zitten in de app zelf en worden geladen vanaf capacitor://; ook daar geen eigen kassa en geen AdSense.
window.PP_STORE = (() => {
  if(location.protocol === "capacitor:") return "ios";
  try{
    if(/[?&]src=play\b/.test(location.search) || document.referrer.startsWith("android-app://")) sessionStorage.setItem("pp-store", "play");
    return sessionStorage.getItem("pp-store") || "web";
  }catch(e){ return /[?&]src=play\b/.test(location.search) ? "play" : "web"; }
})();
window.PP_CONFIG = {
  // adres van de website; de iOS-app haalt hier de maandelijkse hutten-bestanden op en linkt hierheen
  site: "https://thomdewit05-design.github.io/Pistenplanner/",
  pro: {
    enforce: false,       // pas op true zetten als de betaallink en de productgegevens hieronder kloppen
    checkout: "",         // betaallink van Lemon Squeezy, bijvoorbeeld https://jouwwinkel.lemonsqueezy.com/buy/...
    storeId: null,        // winkelnummer in Lemon Squeezy (Settings > Stores)
    productId: null,      // productnummer van Skipilot Pro
    price: "€ 9,99",
    period: "eenmalig, voor altijd",
    // iOS-app: Pro als eenmalige aankoop in de App Store (In-App Purchase, zie store/ios/README.md).
    // Pas op true zetten als het product in App Store Connect bestaat; de prijs komt dan uit de App Store.
    ios: {
      enforce: false,
      productId: "nl.skipilot.app.pro"
    }
  },
  // eigen kaarttegels met een sleutel (voor commercieel gebruik); leeg = de gratis tegels van nu
  // per laag: {url, options}; options zijn Leaflet-instellingen zoals tileSize, zoomOffset, maxNativeZoom
  maps: {
    sat: null,
    labels: null,
    topo: null,
    osm: null,
    attribution: ""
  },
  // advertenties via Google AdSense; leeg = geen advertenties
  ads: {
    client: "",           // publisher-ID, bijvoorbeeld "ca-pub-1234567890123456"
    slots: {              // nummers van advertentieblokken (AdSense > Advertenties > Per advertentieblok)
      default: "",        // gebruikt voor elke plek zonder eigen blok
      "page-top": "", "page-bottom": "", "list-top": "",   // website-pagina's
      "app-list": "", "app-diary": "", "app-menu": "",     // in de app (nooit tijdens het navigeren)
      "app-status": "", "app-group": ""                    // liftstatus en groep
    },
    // iOS-app: Google AdMob (zie store/ios/README.md). Een balk onderin bij de skigebiedkiezer, het dagboek en het menu,
    // nooit tijdens het navigeren en niet voor wie Pro gekocht heeft.
    ios: {
      banner: "ca-app-pub-2889563354210788/5132755133",   // advertentieblok-ID uit AdMob, bijvoorbeeld "ca-app-pub-1234567890123456/1234567890"
      interstitial: "ca-app-pub-2889563354210788/2806421807",   // schermvullende advertentie na het navigeren of na je skidag (hooguit eens per 15 minuten)
      test: true          // zolang banner leeg is: proefadvertenties van Google laten zien; op false zetten = geen advertenties
    }
  },
  // contactgegevens voor de privacyverklaring en de voorwaarden
  contact: {
    name: "Thom de Wit",
    email: "thomdewit05@gmail.com"
  }
};
