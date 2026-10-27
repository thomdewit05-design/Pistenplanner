# Skipilot

Routekaart en pistenavigatie voor 1.883 skigebieden in de Alpen, de Pyreneeën, Scandinavië en Noord-Amerika, met satellietkaart en GPS. In het Nederlands, Engels en Duits. Te installeren als app op je telefoon of computer.

- Kies een skigebied, tik A en B aan op de kaart en zie welke liften en pistes je moet nemen.
- Stel je niveau in (blauw, rood, zwart) en kies de snelste of de rustigste route.
- Start de navigatie: de app volgt je locatie en berekent een nieuwe route als je ervan afwijkt.
- Werkt grotendeels offline: de app, de pistedata en bekeken kaartstukjes worden bewaard.

## Lokaal starten

Dubbelklik `start.bat` (Windows) of draai `python -m http.server 8766` in deze map en open http://localhost:8766.

## Data bijwerken

`tools/build.py` maakt de bestanden in `data/` opnieuw uit de exports van [OpenSkiMap](https://openskimap.org). Welke gebieden meegaan staat in `tools/regions.py`. Hutten en restaurants haalt de app zelf op uit OpenStreetMap (Overpass) als je een gebied opent.

```
python tools/build.py <map-met-ski_areas-lifts-runs.geojson> .
```

Verhoog daarna `VERSION` in `sw.js`, zodat geïnstalleerde apps de nieuwe data ophalen.

## Bronnen

- Pistes en liften: © OpenStreetMap-bijdragers (ODbL), via OpenSkiMap.
- Satellietbeelden: © Esri, Maxar, Earthstar Geographics, GIS User Community.
- Terreinkaart: © OpenTopoMap (CC-BY-SA).
- Kaartbibliotheek: Leaflet 1.9.4 (BSD-2).

Tijden zijn schattingen. De app weet niets van echte afsluitingen of lawinegevaar: volg altijd de borden ter plaatse.

## Een update uitbrengen

Verhoog bij elke update het versienummer op drie plekken, zodat telefoons de nieuwe code ophalen:
`app.css?v=…` en `app.js?v=…` in `index.html`, en `VERSION` plus dezelfde bestandsnamen in `sw.js`.

Na het opnieuw bouwen van `data/` ook `DATA_V` in `app.js` en `data/index.json?…` in `sw.js` verhogen.

## Skipilot Pro en kaartsleutels

Alles staat in `config.js`. Zolang `pro.enforce` op `false` staat, kan iedereen alles gebruiken.
Met `?pro=preview` achter het adres zie je de app zoals hij met Pro aan werkt.

1. Maak bij Lemon Squeezy een product "Skipilot Pro" met licentiecodes aan.
2. Vul in `config.js` de betaallink (`checkout`), het winkelnummer (`storeId`) en het productnummer (`productId`) in.
3. Zet `enforce` op `true` en verhoog het versienummer.

Pro-functies: een groep maken en "Start voor iedereen", lunchstop, zon en schaduw, hotel of auto, seizoensoverzicht, GPX-export en de kaart van een heel gebied downloaden (in IndexedDB, werkt ook in de iOS-app).
Veiligheid (route, navigatie, weer, laatste lift, SOS) en meedoen met een groep blijven gratis.

Eigen kaarttegels met een sleutel zet je in `config.js` onder `maps` (per laag een `url` en eventueel Leaflet-`options`).
Naam en e-mailadres voor `privacy.html` en `voorwaarden.html` staan onder `contact`.

## Advertenties en de website

`python tools/make_pages.py [basis-url]` maakt een pagina per skigebied in `gebieden/`, plus een overzicht, `sitemap.xml` en `robots.txt`.
Draai dit opnieuw na het bijwerken van `data/` of bij een eigen domeinnaam (geef dan de nieuwe basis-url mee).

Advertenties (Google AdSense) staan in `config.js` onder `ads`. Zolang `client` leeg is, verschijnen er geen advertenties.
Plekken: bovenaan en onderaan elke gebiedspagina, in het overzicht, en in de app in de skigebiedkiezer, het dagboek en het menu (nooit tijdens het navigeren).
Zet in AdSense onder "Privacy en berichten" de toestemmingsmelding voor Europa aan.

## iOS-app

Skipilot bestaat ook als iPhone-app (Capacitor, map `ios/`). GitHub bouwt hem op een Mac in de cloud; uploaden naar TestFlight en de App Store staat in `store/ios/README.md`.
Na een wijziging aan de webapp: een nieuwe bouw via Actions > iOS-app > Run workflow (de iOS-app haalt zijn code niet van de website).
