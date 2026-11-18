# Waar komen de getallen in Skipilot vandaan?

Elk getal in de app is een **meting**, een **opgave** van iemand anders, of een **schatting**. Schattingen dragen in de app het teken ≈ of het woord "schatting". Wat we niet betrouwbaar weten, tonen we niet als feit.

Bijgewerkt: november 2026.

## Skigebied

| Getal | Soort | Bron |
|---|---|---|
| Kilometers piste "gemeten" | Meting | Lengte langs de pistes op de kaart: OpenStreetMap via OpenSkiMap, berekend in `tools/build.py` |
| Kilometers piste "opgave" | Opgave | Het skigebied of het toeristenbureau, met bron en seizoen (tabel `OFFICIAL_KM` in `app.js`). Alleen voor 21 grote gebieden |
| Aantal liften | Meting | Geteld op de kaart (OpenStreetMap) |
| Hoogte van dal en top | Meting | Hoogste en laagste punt van pistes en liften, uit hoogtegegevens (Terrain Tiles) |
| Kilometers per kleur | Meting | Kaart (OpenStreetMap), kleur zoals daar ingevoerd |
| Aantal hutten en restaurants | Meting | OpenStreetMap; onvolledig waar de kaart onvolledig is |

De opgave van een gebied ligt vaak hoger dan de meting, omdat gebieden de breedte van pistes en skiroutes meetellen. Zermatt–Cervinia (360 km opgave, 208 km gemeten) is nagekeken: er ontbreekt geen deel op de kaart; Valtournenche (27 km) staat als apart gebied in de lijst.

## Weer en sneeuw

| Getal | Soort | Bron |
|---|---|---|
| Temperatuur top en dal, gevoelstemperatuur | Voorspelling | MET Norway (api.met.no), voor het hoogste en het laagste liftstation |
| Wind (gemiddeld) | Voorspelling | MET Norway |
| Bewolking, mist | Voorspelling | MET Norway |
| Weer per dag, 10 dagen | Voorspelling | MET Norway; na dag 5 gemarkeerd als onzeker |
| Verwachte sneeuw (24 uur, per dag) | Schatting ≈ | Afgeleid uit voorspelde neerslag en temperatuur: 1 cm per mm bij vorst, de helft rond het vriespunt |
| Nulgradengrens | Schatting ≈ | Afgeleid uit de temperatuur op de top (0,65 °C per 100 m) |
| Temperatuur op de hoogte van een piste | Schatting ≈ | Tussen top en dal naar hoogte verdeeld |
| Sneeuwhoogte | Meting | Station binnen 15 km: GeoSphere Austria (Oostenrijk) of WSL-Institut SLF (Zwitserland, alleen in de apps). Met stationsnaam en hoogte. Geen station: geen getal |
| Verse sneeuw afgelopen 24 uur | Meting | Alleen bij SLF-stations (Zwitserland, in de apps). Elders niet getoond |
| "Mogelijk dicht door wind" | Schatting ≈ | Gemiddelde wind op de top boven 45 km/u, voor hoge kabelbanen en stoeltjesliften |
| "Beste sneeuw nu" | Schatting ≈ | Eigen rekenregel op basis van hoogte, zon, temperatuur en wind |
| Sneeuwzeker (reisplanner) | Schatting | Op basis van de hoogte van het gebied |
| Lawinebericht | Verwijzing | Link naar de officiële lawinedienst van het land of de regio; de app toont zelf geen gevarenniveau |

Niet meer getoond omdat de bron het niet levert: windstoten, zicht in meters, sneeuwhoogte uit een weermodel.

## Route en navigatie

| Getal | Soort | Bron |
|---|---|---|
| Afstand en hoogtemeters van een route | Meting | Kaart en hoogtegegevens |
| Reistijd, aankomsttijd | Schatting | Afdalen: lengte, helling en je tempo-instelling. Liften: de duur uit de kaart, of lengte gedeeld door een gemiddelde snelheid per liftsoort. Wachttijden bij liften zitten er niet in |
| "Liften sluiten om …" | Instelling | De tijd die je zelf hebt ingesteld (standaard 16:30), niet de werkelijke sluitingstijd van het gebied |
| Open of dicht van een piste of lift | Instelling | Alleen wat je zelf dicht hebt gezet. De app heeft geen live gegevens van het skigebied |
| Zon op de piste, percentage in de zon | Schatting ≈ | Berekend uit de stand van de zon en het reliëf; bewolking telt niet mee |
| Helling en steilste stuk | Meting | Hoogtegegevens (rasters van ongeveer 30 m); korte steile stukken kunnen afgevlakt zijn |

## Jouw skidag

| Getal | Soort | Bron |
|---|---|---|
| Kilometers, hoogtemeters, topsnelheid, afdalingen | Meting | De gps van je telefoon. Onder bomen of in een gondel kan gps afwijken; de topsnelheid wordt gefilterd op uitschieters |
| Sprongen, tijd in de lucht | Meting | Bewegingssensor van je telefoon |
| Calorieën | Schatting ≈ | Rekenregel op gewicht en tijd op de berg |

## Wat de app niet weet
- Of een lift of piste vandaag open is.
- Wachttijden.
- De sneeuwhoogte die het skigebied zelf opgeeft.
- Gemeten sneeuwhoogte buiten Oostenrijk en Zwitserland.
