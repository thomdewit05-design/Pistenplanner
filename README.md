# Pistenplanner

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
