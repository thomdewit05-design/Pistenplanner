// Instellingen voor Pistenplanner Pro, de kaartdiensten en de privacyverklaring.
// Leeg laten = nog niet ingesteld; de app werkt dan zoals altijd en iedereen kan alles gebruiken.
window.PP_CONFIG = {
  pro: {
    enforce: false,       // pas op true zetten als de betaallink en de productgegevens hieronder kloppen
    checkout: "",         // betaallink van Lemon Squeezy, bijvoorbeeld https://jouwwinkel.lemonsqueezy.com/buy/...
    storeId: null,        // winkelnummer in Lemon Squeezy (Settings > Stores)
    productId: null,      // productnummer van Pistenplanner Pro
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
  // contactgegevens voor de privacyverklaring en de voorwaarden
  contact: {
    name: "",
    email: ""
  }
};
