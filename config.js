// Instellingen voor Skipilot Pro, de kaartdiensten en de privacyverklaring.
// Leeg laten = nog niet ingesteld; de app werkt dan zoals altijd en iedereen kan alles gebruiken.
window.PP_CONFIG = {
  pro: {
    enforce: false,       // pas op true zetten als de betaallink en de productgegevens hieronder kloppen
    checkout: "",         // betaallink van Lemon Squeezy, bijvoorbeeld https://jouwwinkel.lemonsqueezy.com/buy/...
    storeId: null,        // winkelnummer in Lemon Squeezy (Settings > Stores)
    productId: null,      // productnummer van Skipilot Pro
    price: "€ 9,99",
    period: "eenmalig, voor altijd"
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
      "app-list": "", "app-diary": "", "app-menu": ""      // in de app (nooit tijdens het navigeren)
    }
  },
  // contactgegevens voor de privacyverklaring en de voorwaarden
  contact: {
    name: "",
    email: ""
  }
};
