# App Store Connect invullen: Skipilot 1.1.0

Dit bestand is gemaakt door `tools/store-texts.mjs`. Pas het niet met de hand aan: verander de bron (`store/ios/teksten/`, `store/ios/review-notes.txt`) en draai het script opnieuw.

## Voor wie dit invult (Cowork)

Je vult App Store Connect in voor de iPhone-app **Skipilot**. Werk de schermen hieronder af in deze volgorde. Neem elke waarde letterlijk over uit de grijze blokken.

Regels:
- **Druk niet op "Add for Review" of "Submit for Review".** Dat doet Thom zelf, nadat hij alles heeft nagekeken. Bewaar alleen ("Save").
- Verander niets aan prijzen, belasting, bankgegevens, overeenkomsten of gebruikers.
- Staat er bij een veld **"vult Thom in"**, laat het dan leeg en zet het op de lijst aan het eind.
- Ziet een scherm er anders uit dan hier beschreven, of vraagt het iets wat hier niet staat: sla het over, verzin niets, en zet het op de lijst aan het eind.
- Vul nergens wachtwoorden, sleutels of andere geheimen in.

Aan het eind lever je een korte lijst: wat is ingevuld, wat is overgeslagen en waarom, en wat Thom nog moet doen.

## 1. De app

| Veld | Waarde |
|---|---|
| App | Skipilot |
| Bundle ID | `nl.skipilot.app` |
| Versie | `1.1.0` |
| Primaire taal (Primary Language) | Dutch |
| Categorie (Primary Category) | Navigation |
| Tweede categorie (Secondary Category) | Sports |
| Content Rights | De app bevat inhoud van derden (kaartgegevens van OpenStreetMap en OpenSkiMap, weer van MET Norway) en heeft het recht die te gebruiken: kies **Yes** bij beide vragen |
| Copyright | `2026 Thom de Wit` |

## 2. Prijs en beschikbaarheid (Pricing and Availability)

| Veld | Waarde |
|---|---|
| Prijs | Gratis (Free, USD 0.00) |
| Beschikbaarheid | Alle landen en regio's |
| In-app-aankopen | Geen in deze versie; maak er geen aan |

Staat dit al goed, verander dan niets.

## 3. Leeftijdsclassificatie (Age Rating)

Beantwoord de vragenlijst zo:

| Vraag | Antwoord |
|---|---|
| Geweld, seksuele inhoud, grof taalgebruik, alcohol, drugs, gokken, horror, medische informatie | Overal **None / No** |
| Advertenties (Advertising) | **Yes**: de app toont advertenties van Google AdMob |
| Onbeperkte toegang tot internet (Unrestricted Web Access) | **No** |
| Berichten of chat tussen gebruikers (Messaging and Chat) | **Yes**: binnen een groep die je zelf maakt of waarvoor je bent uitgenodigd kun je korte berichten sturen |
| Door gebruikers gemaakte inhoud die openbaar is (User-Generated Content) | **No**: berichten gaan alleen naar je eigen groep; sneeuwberichten zijn anoniem en bestaan uit een vaste keuze, geen vrije tekst |
| Ouderlijk toezicht, leeftijdscontrole | **No** |

Vraagt de lijst iets wat hier niet staat: overslaan en melden.

## 4. App-privacy (App Privacy)

**Privacy Policy URL**: `https://thomdewit05-design.github.io/Pistenplanner/privacy.html` (per taal staat het adres in hoofdstuk 6).

Bij "Data Collection": **Yes, we collect data from this app**. Vul deze gegevenssoorten in en geen andere:

| Gegevenssoort (Apple) | Waarvoor | Gekoppeld aan de gebruiker? | Gebruikt om te volgen? |
|---|---|---|---|
| Location → **Precise Location** | App Functionality | No | No |
| Contact Info → **Name** | App Functionality | No | No |
| Location → **Coarse Location** (uit het IP-adres, door AdMob) | Third-Party Advertising | No | **Yes** |
| Identifiers → **Device ID** | Third-Party Advertising | No | **Yes** |
| Usage Data → **Advertising Data** en **Product Interaction** | Third-Party Advertising | No | **Yes** |
| Diagnostics → **Crash Data** en **Performance Data** | Third-Party Advertising | No | No |

De eerste twee regels komen van Skipilot zelf en staan vast. De laatste vier komen van Google AdMob: neem daarvoor de uitleg van Google als waarheid (adres hieronder) en meld het als die afwijkt van deze tabel.

Toelichting, niet invullen:
- Precieze locatie en naam verlaten de telefoon alleen als de gebruiker zelf een groep gebruikt; ze gaan dan versleuteld naar de groepsgenoten.
- Uitleg van Google over wat AdMob verzamelt: `https://developers.google.com/admob/ios/privacy/data-disclosure`.
- **Niet** invullen: Health & Fitness (de app schrijft alleen naar Apple Gezondheid, op de telefoon zelf), Photos (blijven op de telefoon), Purchases (er zijn geen aankopen).

## 5. Gegevens voor de keurder (App Review Information)

| Veld | Waarde |
|---|---|
| Sign-in required | **No** (uitvinken): de app heeft geen account |
| First name / Last name | `Thom de Wit` |
| Email | `thomdewit05@gmail.com` |
| Phone | **vult Thom in** |
| Attachment | geen |

**Notes** (3312 van 4000 tekens), in zijn geheel plakken:

```text
Skipilot is a ski map and turn-by-turn navigation app for ski areas. No login or account is required. It runs on iPhone and iPad (full screen, portrait and landscape).

How to test
1. On first launch a short tour appears; then pick a ski area, for example "Ski Arlberg" or "Zillertal Arena".
2. A ski area must be downloaded once before use (about 10 to 30 MB), so the map, 3D and navigation work without mobile signal on the mountain. Tap "Download".
3. Tap two points on the map to plan a route, or tap "Dagroute van vandaag" (Today's day route) for a ready-made route. Then tap "Start navigatie" (Start navigation).
4. The language can be changed in the menu under Taal / Language. Available: Dutch, English, German, French, Italian, Spanish, Portuguese, Russian, Chinese and Japanese.

Location
Location is used to show the user on the map, for navigation and for the ski diary. Background location is used only while the user has started navigation, so the Live Activity (Lock Screen, Dynamic Island, Apple Watch) can show the next turn while the phone is locked with gloves on. It stops as soon as navigation ends.

Groups
Group position sharing is optional. Only when the user creates or joins a group and enables position sharing is the position sent to group members, end-to-end encrypted (AES-GCM, key derived from the group code), via ntfy.sh.

HealthKit
HealthKit is used only to write a finished ski day as a workout (start and end time, distance, estimated active energy) when the user turns on "Save to Apple Health" in the menu. The app never reads health data, never sends it off the device and never uses it for advertising.

Camera, photos and motion
The camera and photo library are used only when the user adds a photo to a ski day or saves a share image. The motion sensor is used during a recorded ski day to detect jumps. All of this stays on the device.

Ads and tracking
The app is free with ads from Google AdMob. The App Tracking Transparency prompt appears about one second after the first launch, before any ad is loaded or any advertising data is collected; if another system alert is showing, it appears as soon as that alert is closed. AdMob is only started after the user has answered. With "Ask App Not to Track" the app shows non-personalised ads only. There is a banner in the ski area list, the route details, the ski diary and the menu, and occasionally a full-screen ad at a natural pause; never during navigation or right after it. There are no in-app purchases in this version.

Widgets and Watch
The app includes home screen and lock screen widgets (ski area weather, ski day stats), a Live Activity for navigation and an Apple Watch app that shows the ski day and the next turn. While navigation is running, the Watch app holds an HKWorkoutSession (downhill skiing) so it stays active and can play a haptic for each turn with the wrist down. No HKLiveWorkoutBuilder is used: nothing is written to or read from HealthKit by the Watch app, and the session ends when navigation stops. The user can turn this off in Settings > Apple Watch.

Data
Run and lift data comes from OpenStreetMap via OpenSkiMap. Weather comes from MET Norway; measured snow depth from GeoSphere Austria and SLF Switzerland. The app does not know which lifts are open today; it says so in the app.
```

## 6. Teksten en afbeeldingen per taal

Voeg onder de versie deze tien talen toe (linksboven bij de taalkeuze, "Add Language") en vul per taal de velden in. De namen tussen haakjes zijn de Nederlandse namen van de velden.

App Store Connect kent twee soorten Portugees en Chinees. De app heeft er van elk één: kies **Portuguese (Brazil)** en **Chinese (Simplified)**, want de app zelf is in Braziliaans Portugees en vereenvoudigd Chinees geschreven. Apple toont die pagina ook aan gebruikers in Portugal.

De **Name** en **Subtitle** staan onder "App Information" (per taal); de overige velden onder de versie.

### Nederlands — in App Store Connect: **Dutch**

**Name** (Naam; 24 van 30 tekens)

```text
Skipilot: pistenavigatie
```

**Subtitle** (Ondertitel; 26 van 30 tekens)

```text
Pistekaart en skinavigatie
```

**Promotional Text** (Promotietekst; 164 van 170 tekens)

```text
Kies waar je heen wilt en Skipilot vertelt welke pistes en liften je neemt, met gesproken aanwijzingen. In meer dan 1.800 skigebieden, ook zonder bereik op de berg.
```

**Keywords** (Trefwoorden; 96 van 100 tekens)

```text
ski,piste,skigebied,wintersport,route,navigatie,lift,gps,alpen,snowboard,kaart,skidagboek,sneeuw
```

**Description** (Beschrijving; 3371 van 4000 tekens)

```text
Nooit meer verdwalen op de piste. Skipilot is je piloot in het skigebied: kies waar je heen wilt en de app vertelt je welke pistes en liften je moet nemen, stap voor stap, met gesproken aanwijzingen.

ROUTE PLANNEN
• Tik op de kaart je vertrekpunt en je bestemming aan, of tik een piste aan om hem te skiën
• Skipilot kiest pistes die bij jouw niveau passen: makkelijk, gemiddeld of moeilijk
• Kies de snelste of de rustigste route, en vermijd sleepliften of buckelpistes
• Lukt het niet binnen je niveau? Dan zoekt de app de makkelijkste weg en zegt eerlijk waar het lastiger wordt
• Dagroute van vandaag: elke dag een andere route langs mooie pistes, met een lunchstop in een hut
• Snowboard? Dan mijdt de route vlakke stukken waar je moet steppen, en sleepliften
• Of teken je eigen route

NAVIGEREN
• Gesproken aanwijzingen: welke piste, welke lift, links of rechts
• Ben je van de route af, dan rekent Skipilot vanzelf een nieuwe route
• "Naar het dal": de snelste weg naar beneden, vanaf waar je bent
• Hoogteprofiel, tijden en een waarschuwing als je de laatste lift niet meer haalt
• Op je toegangsscherm, in het Dynamic Island en in de Apple Watch-app, met een tikje op je pols voor elke afslag
• Siri: "naar het dal" of "naar mijn hotel"

SAMEN SKIËN
• Maak een groep met een code of QR-code
• Eén persoon kiest de bestemming en tikt op "Start voor iedereen": de hele groep krijgt de route
• Zie op de kaart waar je vrienden zijn

KAARTEN
• 3D-bergen: zie de hoogtes echt, met liften als kabels in de lucht
• Winterkaart: besneeuwde bergen met dorpen, hoogtelijnen en bergtoppen
• Satellietkaart, terreinkaart en gewone kaart

WIDGETS
• Skigebied: het weer bovenop de berg, verwachte sneeuw, bewolking en wind, op je beginscherm en toegangsscherm
• Skidag: kilometers, hoogtemeters en afdalingen van vandaag in één oogopslag

HANDIGE EXTRA'S
• Zon en schaduw: zie welke pistes nu in de zon liggen
• Lunchstop: de app kiest een hut op je route, rond het tijdstip dat jij wilt lunchen
• Vul het adres van je hotel in en kom aan het eind van de dag makkelijk terug
• Skipas kopen: rechtstreeks naar de ticketshop van het skigebied
• Weer op de top en in het dal, met waarschuwingen voor wind en mist
• Gemeten sneeuwhoogte van meetstations in Oostenrijk en Zwitserland
• Skidagboek met kilometers, hoogtemeters, topsnelheid en seizoensrecords
• Snelheidsmeter en GPX-export
• SOS-knop met het juiste noodnummer en je exacte plek

MEER DAN 1.800 SKIGEBIEDEN
In de Alpen (Oostenrijk, Frankrijk, Zwitserland, Italië, Duitsland, Slovenië), de Pyreneeën, Scandinavië en Noord-Amerika. Download je skigebied één keer; daarna werken de kaart, 3D en de navigatie ook zonder bereik op de berg.

PRIVACY
Geen account nodig. Skipilot is gratis dankzij advertenties, nooit tijdens het navigeren. Je routes en je skidagboek blijven op je iPhone. Je positie gaat alleen naar je groepsgenoten als je zelf een groep gebruikt.

VEILIGHEID
Skipilot is een hulpmiddel. De pistedata komt van OpenStreetMap en kan afwijken van de werkelijkheid. De app weet niet welke pistes en liften vandaag echt open zijn en kent geen lawinegevaar. Volg altijd de borden en de pistedienst.

Beschikbaar in het Nederlands, Engels, Duits, Frans, Italiaans, Spaans, Portugees, Russisch, Chinees en Japans.
Pistedata © OpenStreetMap-bijdragers, via OpenSkiMap. Weer: MET Norway. Satellietbeelden © Esri.
```

**What's New in This Version** (Wat is er nieuw; 544 van 4000 tekens)

```text
• De hele pistekaart: open je Courchevel, Lech of Les Arcs, dan zie je het hele aaneengesloten gebied
• Beter weer: voorspelling van MET Norway en gemeten sneeuwhoogte van meetstations
• Eerlijke cijfers: de pistekilometers volgens het skigebied naast wat op de kaart gemeten is
• Soepeler, ook in de energiebesparingsmodus van je iPhone
• Een gps-storing in de gondel stopt je opname en navigatie niet meer
• Waarschuwingen voor wind, mist en de laatste lift nu in alle tien talen
• Nu ook in het Spaans, Portugees, Russisch, Chinees en Japans
```

**Support URL**: `https://thomdewit05-design.github.io/Pistenplanner/support.html`
**Marketing URL**: `https://thomdewit05-design.github.io/Pistenplanner/`
**Privacy Policy URL** (staat onder App Privacy, per taal): `https://thomdewit05-design.github.io/Pistenplanner/privacy.html`

**Schermafbeeldingen**, vak *iPhone 6.9" Display*, in deze volgorde:
1. `store/screenshots/1290x2796/nl-1.jpg`
2. `store/screenshots/1290x2796/nl-2.jpg`
3. `store/screenshots/1290x2796/nl-3.jpg`

---

### Engels — in App Store Connect: **English (U.S.)**

**Name** (Naam; 24 van 30 tekens)

```text
Skipilot: ski navigation
```

**Subtitle** (Ondertitel; 29 van 30 tekens)

```text
Ski maps and slope navigation
```

**Promotional Text** (Promotietekst; 153 van 170 tekens)

```text
Pick where you want to go and Skipilot tells you which runs and lifts to take, with spoken directions. In more than 1,800 ski areas, even without signal.
```

**Keywords** (Trefwoorden; 91 van 100 tekens)

```text
ski,piste,slopes,resort,snowboard,route,navigation,lift,gps,alps,trail map,ski tracker,snow
```

**Description** (Beschrijving; 3224 van 4000 tekens)

```text
Never get lost on the mountain again. Skipilot is your pilot in the ski area: pick where you want to go and the app tells you which runs and lifts to take, step by step, with spoken directions.

PLAN YOUR ROUTE
• Tap your start and destination on the map, or tap a run to ski it
• Skipilot picks runs that match your level: easy, intermediate or difficult
• Choose the fastest or the most relaxed route, and avoid drag lifts or mogul runs
• Not possible at your level? The app finds the easiest way and tells you honestly where it gets harder
• Today's day route: a different route every day along great runs, with a lunch stop at a mountain hut
• On a snowboard? The route avoids flat stretches where you'd have to skate, and drag lifts
• Or draw your own route

NAVIGATE
• Spoken directions: which run, which lift, left or right
• Off the route? Skipilot recalculates automatically
• "To the valley": the fastest way down from where you are
• Elevation profile, times, and a warning if you won't make the last lift
• On your lock screen, in the Dynamic Island and in the Apple Watch app, with a tap on your wrist before every turn
• Siri: "to the valley" or "to my hotel"

SKI TOGETHER
• Create a group with a code or QR code
• One person picks the destination and taps "Start for everyone": the whole group gets the route
• See where your friends are on the map

MAPS
• 3D mountains: really see the terrain, with lifts as cables in the air
• Winter map: snowy mountains with villages, contour lines and peaks
• Satellite, terrain and street maps

WIDGETS
• Ski area: weather at the top, expected snow, cloud cover and wind, on your home screen and lock screen
• Ski day: today's distance, vertical and runs at a glance

HANDY EXTRAS
• Sun and shade: see which slopes are in the sun right now
• Lunch stop: the app picks a mountain hut on your route, around the time you want to eat
• Enter your hotel's address and get back easily at the end of the day
• Buy a ski pass: straight to the resort's ticket shop
• Weather at the top and in the valley, with wind and fog warnings
• Measured snow depth from weather stations in Austria and Switzerland
• Ski diary with distance, vertical, top speed and season records
• Speedometer and GPX export
• SOS button with the right emergency number and your exact location

MORE THAN 1,800 SKI AREAS
In the Alps (Austria, France, Switzerland, Italy, Germany, Slovenia), the Pyrenees, Scandinavia and North America. Download your ski area once; after that the map, 3D and navigation also work without signal on the mountain.

PRIVACY
No account needed. Skipilot is free thanks to ads, never during navigation. Your routes and ski diary stay on your iPhone. Your position is only shared with your group members when you use a group yourself.

SAFETY
Skipilot is a guide. Run data comes from OpenStreetMap and may differ from reality. The app doesn't know which runs and lifts are actually open today and has no avalanche information. Always follow the signs and the ski patrol.

Available in English, Dutch, German, French, Italian, Spanish, Portuguese, Russian, Chinese and Japanese.
Run data © OpenStreetMap contributors, via OpenSkiMap. Weather: MET Norway. Satellite imagery © Esri.
```

**What's New in This Version** (Wat is er nieuw; 532 van 4000 tekens)

```text
• The whole piste map: open Courchevel, Lech or Les Arcs and you see the entire connected area
• Better weather: forecast from MET Norway and measured snow depth from weather stations
• Honest numbers: the resort's stated piste kilometres next to what is measured on the map
• Smoother, also in your iPhone's Low Power Mode
• A GPS dropout in the gondola no longer stops your recording or navigation
• Warnings for wind, fog and the last lift now in all ten languages
• Now also in Spanish, Portuguese, Russian, Chinese and Japanese
```

**Support URL**: `https://thomdewit05-design.github.io/Pistenplanner/support-en.html`
**Marketing URL**: `https://thomdewit05-design.github.io/Pistenplanner/`
**Privacy Policy URL** (staat onder App Privacy, per taal): `https://thomdewit05-design.github.io/Pistenplanner/privacy-en.html`

**Schermafbeeldingen**, vak *iPhone 6.9" Display*, in deze volgorde:
1. `store/screenshots/1290x2796/en-1.jpg`
2. `store/screenshots/1290x2796/en-2.jpg`
3. `store/screenshots/1290x2796/en-3.jpg`

---

### Duits — in App Store Connect: **German**

**Name** (Naam; 27 van 30 tekens)

```text
Skipilot: Pisten-Navigation
```

**Subtitle** (Ondertitel; 23 van 30 tekens)

```text
Pistenplan und Ski-Navi
```

**Promotional Text** (Promotietekst; 150 van 170 tekens)

```text
Wähle dein Ziel und Skipilot sagt dir, welche Pisten und Lifte du nimmst, mit Sprachansagen. In mehr als 1.800 Skigebieten, auch ohne Empfang am Berg.
```

**Keywords** (Trefwoorden; 96 van 100 tekens)

```text
ski,skigebiet,pistenkarte,skifahren,wintersport,route,lift,gps,alpen,snowboard,skitracker,schnee
```

**Description** (Beschrijving; 3575 van 4000 tekens)

```text
Nie wieder auf der Piste verirren. Skipilot ist dein Pilot im Skigebiet: Wähle, wohin du willst, und die App sagt dir, welche Pisten und Lifte du nehmen musst, Schritt für Schritt, mit Sprachansagen.

ROUTE PLANEN
• Tippe auf der Karte auf Start und Ziel, oder tippe auf eine Piste, um sie zu fahren
• Skipilot wählt Pisten, die zu deinem Niveau passen: leicht, mittel oder schwer
• Wähle die schnellste oder die ruhigste Route und meide Schlepplifte oder Buckelpisten
• Klappt es nicht innerhalb deines Niveaus? Dann sucht die App den leichtesten Weg und sagt ehrlich, wo es schwieriger wird
• Tagesroute von heute: jeden Tag eine andere Route über schöne Pisten, mit Mittagspause in einer Hütte
• Snowboard? Dann meidet die Route Flachstücke, auf denen du anschieben musst, und Schlepplifte
• Oder zeichne deine eigene Route

NAVIGIEREN
• Sprachansagen: welche Piste, welcher Lift, links oder rechts
• Bist du von der Route abgekommen, berechnet Skipilot von selbst eine neue
• „Ins Tal“: der schnellste Weg nach unten, von dort, wo du gerade bist
• Höhenprofil, Zeiten und eine Warnung, wenn du den letzten Lift nicht mehr schaffst
• Auf dem Sperrbildschirm, in der Dynamic Island und in der Apple Watch-App, mit einem Tippen am Handgelenk vor jeder Abzweigung
• Siri: „ins Tal“ oder „zu meinem Hotel“

GEMEINSAM SKI FAHREN
• Erstelle eine Gruppe mit einem Code oder QR-Code
• Eine Person wählt das Ziel und tippt auf „Für alle starten“: Die ganze Gruppe bekommt die Route
• Sieh auf der Karte, wo deine Freunde sind

KARTEN
• 3D-Berge: Sieh die Höhen wirklich, mit Liften als Seilen in der Luft
• Winterkarte: verschneite Berge mit Dörfern, Höhenlinien und Gipfeln
• Satellitenkarte, Geländekarte und normale Karte

WIDGETS
• Skigebiet: das Wetter oben am Berg, erwarteter Schnee, Bewölkung und Wind, auf Home- und Sperrbildschirm
• Skitag: Kilometer, Höhenmeter und Abfahrten von heute auf einen Blick

PRAKTISCHE EXTRAS
• Sonne und Schatten: Sieh, welche Pisten jetzt in der Sonne liegen
• Mittagspause: Die App wählt eine Hütte auf deiner Route, etwa zu der Zeit, zu der du essen möchtest
• Gib die Adresse deines Hotels ein und finde am Ende des Tages leicht zurück
• Skipass kaufen: direkt zum Ticketshop des Skigebiets
• Wetter am Gipfel und im Tal, mit Warnungen vor Wind und Nebel
• Gemessene Schneehöhe von Messstationen in Österreich und der Schweiz
• Skitagebuch mit Kilometern, Höhenmetern, Höchstgeschwindigkeit und Saisonrekorden
• Tacho und GPX-Export
• SOS-Taste mit der richtigen Notrufnummer und deinem genauen Standort

MEHR ALS 1.800 SKIGEBIETE
In den Alpen (Österreich, Frankreich, Schweiz, Italien, Deutschland, Slowenien), den Pyrenäen, Skandinavien und Nordamerika. Lade dein Skigebiet einmal herunter; danach funktionieren die Karte, 3D und die Navigation auch ohne Empfang am Berg.

DATENSCHUTZ
Kein Konto nötig. Skipilot ist dank Werbung kostenlos, nie während der Navigation. Deine Routen und dein Skitagebuch bleiben auf deinem iPhone. Deine Position geht nur an deine Gruppenmitglieder, wenn du selbst eine Gruppe nutzt.

SICHERHEIT
Skipilot ist ein Hilfsmittel. Die Pistendaten stammen von OpenStreetMap und können von der Wirklichkeit abweichen. Die App weiß nicht, welche Pisten und Lifte heute wirklich geöffnet sind, und kennt keine Lawinengefahr. Befolge immer die Schilder und den Pistendienst.

Verfügbar auf Deutsch, Niederländisch, Englisch, Französisch, Italienisch, Spanisch, Portugiesisch, Russisch, Chinesisch und Japanisch.
Pistendaten © OpenStreetMap-Mitwirkende, über OpenSkiMap. Wetter: MET Norway. Satellitenbilder © Esri.
```

**What's New in This Version** (Wat is er nieuw; 589 van 4000 tekens)

```text
• Die ganze Pistenkarte: Öffnest du Courchevel, Lech oder Les Arcs, siehst du das gesamte zusammenhängende Gebiet
• Besseres Wetter: Vorhersage von MET Norway und gemessene Schneehöhe von Messstationen
• Ehrliche Zahlen: die Pistenkilometer laut Skigebiet neben dem, was auf der Karte gemessen wurde
• Flüssiger, auch im Stromsparmodus deines iPhones
• Ein GPS-Ausfall in der Gondel stoppt deine Aufzeichnung und Navigation nicht mehr
• Warnungen vor Wind, Nebel und dem letzten Lift jetzt in allen zehn Sprachen
• Jetzt auch auf Spanisch, Portugiesisch, Russisch, Chinesisch und Japanisch
```

**Support URL**: `https://thomdewit05-design.github.io/Pistenplanner/support-de.html`
**Marketing URL**: `https://thomdewit05-design.github.io/Pistenplanner/`
**Privacy Policy URL** (staat onder App Privacy, per taal): `https://thomdewit05-design.github.io/Pistenplanner/privacy-de.html`

**Schermafbeeldingen**, vak *iPhone 6.9" Display*, in deze volgorde:
1. `store/screenshots/1290x2796/de-1.jpg`
2. `store/screenshots/1290x2796/de-2.jpg`
3. `store/screenshots/1290x2796/de-3.jpg`

---

### Frans — in App Store Connect: **French**

**Name** (Naam; 25 van 30 tekens)

```text
Skipilot : navigation ski
```

**Subtitle** (Ondertitel; 29 van 30 tekens)

```text
Plan des pistes et GPS de ski
```

**Promotional Text** (Promotietekst; 166 van 170 tekens)

```text
Choisis ta destination : Skipilot t'indique les pistes et remontées à prendre, avec guidage vocal. Dans plus de 1 800 domaines skiables, même sans réseau en montagne.
```

**Keywords** (Trefwoorden; 98 van 100 tekens)

```text
piste,station,domaine skiable,snowboard,itinéraire,remontée,gps,alpes,neige,carte,forfait,montagne
```

**Description** (Beschrijving; 3895 van 4000 tekens)

```text
Ne te perds plus jamais sur les pistes. Skipilot est ton pilote dans le domaine skiable : choisis où tu veux aller et l'appli t'indique les pistes et les remontées à prendre, étape par étape, avec des instructions vocales.

PLANIFIER UN ITINÉRAIRE
• Touche ton point de départ et ta destination sur la carte, ou touche une piste pour la skier
• Skipilot choisit des pistes adaptées à ton niveau : facile, moyen ou difficile
• Choisis l'itinéraire le plus rapide ou le plus tranquille, et évite les téléskis ou les pistes à bosses
• Impossible à ton niveau ? L'appli cherche alors le chemin le plus facile et te dit honnêtement où ça se complique
• Itinéraire du jour : chaque jour un itinéraire différent sur de belles pistes, avec une pause déjeuner dans un refuge
• En snowboard ? L'itinéraire évite alors les plats où il faut pousser, ainsi que les téléskis
• Ou dessine ton propre itinéraire

NAVIGUER
• Instructions vocales : quelle piste, quelle remontée, à gauche ou à droite
• Si tu quittes l'itinéraire, Skipilot en calcule automatiquement un nouveau
• « Vers la vallée » : le chemin le plus rapide pour redescendre, depuis l'endroit où tu es
• Profil d'altitude, horaires et un avertissement si tu ne peux plus attraper la dernière remontée
• Sur ton écran verrouillé, dans la Dynamic Island et dans l'app Apple Watch, avec une tape sur le poignet avant chaque changement de direction
• Siri : « vers la vallée » ou « vers mon hôtel »

SKIER ENSEMBLE
• Crée un groupe avec un code ou un code QR
• Une personne choisit la destination et touche « Lancer pour tout le monde » : tout le groupe reçoit l'itinéraire
• Vois sur la carte où sont tes amis

CARTES
• Montagnes en 3D : vois vraiment le relief, avec les remontées comme des câbles dans les airs
• Carte d'hiver : montagnes enneigées avec villages, courbes de niveau et sommets
• Carte satellite, carte du relief et plan classique

WIDGETS
• Domaine skiable : la météo au sommet, la neige attendue, la couverture nuageuse et le vent, sur ton écran d'accueil et ton écran verrouillé
• Journée de ski : kilomètres, dénivelé et descentes du jour en un coup d'œil

DES PLUS BIEN PRATIQUES
• Soleil et ombre : vois quelles pistes sont au soleil en ce moment
• Pause déjeuner : l'appli choisit un refuge sur ton itinéraire, vers l'heure à laquelle tu veux déjeuner
• Saisis l'adresse de ton hôtel et rentre facilement en fin de journée
• Acheter un forfait : directement vers la billetterie du domaine skiable
• Météo au sommet et dans la vallée, avec alertes de vent et de brouillard
• Hauteur de neige mesurée par des stations de mesure en Autriche et en Suisse
• Carnet de ski avec kilomètres, dénivelé, vitesse maximale et records de saison
• Compteur de vitesse et export GPX
• Bouton SOS avec le bon numéro d'urgence et ta position exacte

PLUS DE 1 800 DOMAINES SKIABLES
Dans les Alpes (Autriche, France, Suisse, Italie, Allemagne, Slovénie), les Pyrénées, en Scandinavie et en Amérique du Nord. Télécharge ton domaine skiable une seule fois ; ensuite, la carte, la 3D et la navigation fonctionnent aussi sans réseau en montagne.

CONFIDENTIALITÉ
Pas besoin de compte. Skipilot est gratuit grâce aux publicités, jamais pendant la navigation. Tes itinéraires et ton carnet de ski restent sur ton iPhone. Ta position n'est envoyée aux membres de ton groupe que si tu utilises toi-même un groupe.

SÉCURITÉ
Skipilot est un outil d'aide. Les données des pistes proviennent d'OpenStreetMap et peuvent différer de la réalité. L'appli ne sait pas quelles pistes et remontées sont réellement ouvertes aujourd'hui et ne connaît pas le risque d'avalanche. Suis toujours les panneaux et le service des pistes.

Disponible en français, néerlandais, anglais, allemand, italien, espagnol, portugais, russe, chinois et japonais.
Données des pistes © les contributeurs d'OpenStreetMap, via OpenSkiMap. Météo : MET Norway. Images satellite © Esri.
```

**What's New in This Version** (Wat is er nieuw; 624 van 4000 tekens)

```text
• Tout le plan des pistes : ouvre Courchevel, Lech ou Les Arcs et tu vois tout le domaine relié
• Météo améliorée : prévisions de MET Norway et hauteur de neige mesurée par des stations de mesure
• Des chiffres honnêtes : les kilomètres de pistes annoncés par le domaine à côté de ceux mesurés sur la carte
• Plus fluide, même en mode économie d'énergie sur ton iPhone
• Une perte de signal GPS dans la télécabine n'arrête plus ton enregistrement ni ta navigation
• Les alertes de vent, de brouillard et de dernière remontée désormais dans les dix langues
• Désormais aussi en espagnol, portugais, russe, chinois et japonais
```

**Support URL**: `https://thomdewit05-design.github.io/Pistenplanner/support-fr.html`
**Marketing URL**: `https://thomdewit05-design.github.io/Pistenplanner/`
**Privacy Policy URL** (staat onder App Privacy, per taal): `https://thomdewit05-design.github.io/Pistenplanner/privacy-fr.html`

**Schermafbeeldingen**, vak *iPhone 6.9" Display*, in deze volgorde:
1. `store/screenshots/1290x2796/fr-1.jpg`
2. `store/screenshots/1290x2796/fr-2.jpg`
3. `store/screenshots/1290x2796/fr-3.jpg`

---

### Italiaans — in App Store Connect: **Italian**

**Name** (Naam; 24 van 30 tekens)

```text
Skipilot: navigatore sci
```

**Subtitle** (Ondertitel; 29 van 30 tekens)

```text
Mappa piste e navigazione sci
```

**Promotional Text** (Promotietekst; 160 van 170 tekens)

```text
Scegli dove vuoi andare e Skipilot ti dice quali piste e impianti prendere, con indicazioni vocali. In oltre 1.800 comprensori, anche senza segnale in montagna.
```

**Keywords** (Trefwoorden; 96 van 100 tekens)

```text
piste,comprensorio,skipass,neve,snowboard,impianti,mappa,gps,alpi,dolomiti,percorso,meteo,sciare
```

**Description** (Beschrijving; 3576 van 4000 tekens)

```text
Mai più persi sulle piste. Skipilot è il tuo pilota nel comprensorio: scegli dove vuoi andare e l'app ti dice quali piste e impianti prendere, passo dopo passo, con indicazioni vocali.

PIANIFICA IL PERCORSO
• Tocca sulla mappa la partenza e la destinazione, oppure tocca una pista per sciarla
• Skipilot sceglie piste adatte al tuo livello: facile, medio o difficile
• Scegli il percorso più veloce o il più tranquillo, ed evita gli skilift o le piste con gobbe
• Non è possibile restando nel tuo livello? L'app cerca la via più facile e ti dice con sincerità dove diventa più impegnativo
• Percorso del giorno: ogni giorno un percorso diverso lungo belle piste, con sosta pranzo in un rifugio
• In snowboard? Il percorso evita i tratti in piano dove dovresti spingerti, e gli skilift
• Oppure disegna il tuo percorso

NAVIGA
• Indicazioni vocali: quale pista, quale impianto, a sinistra o a destra
• Se esci dal percorso, Skipilot ne calcola da solo uno nuovo
• "Verso valle": la via più veloce per scendere, da dove ti trovi
• Profilo altimetrico, tempi e un avviso se non fai più in tempo per l'ultima corsa
• Sulla schermata di blocco, nella Dynamic Island e nell'app per Apple Watch, con un colpetto sul polso prima di ogni svolta
• Siri: "verso valle" o "al mio hotel"

SCIARE INSIEME
• Crea un gruppo con un codice o un codice QR
• Una persona sceglie la destinazione e tocca "Avvia per tutti": tutto il gruppo riceve il percorso
• Guarda sulla mappa dove sono i tuoi amici

MAPPE
• Montagne 3D: vedi davvero i dislivelli, con gli impianti come cavi nell'aria
• Mappa invernale: montagne innevate con paesi, curve di livello e cime
• Mappa satellitare, mappa del rilievo e mappa normale

WIDGET
• Comprensorio: il meteo in vetta, neve prevista, nuvolosità e vento, sulla schermata Home e sulla schermata di blocco
• Giornata di sci: chilometri, dislivello e discese di oggi a colpo d'occhio

EXTRA UTILI
• Sole e ombra: guarda quali piste sono al sole in questo momento
• Sosta pranzo: l'app sceglie un rifugio sul tuo percorso, intorno all'ora in cui vuoi pranzare
• Inserisci l'indirizzo del tuo hotel e a fine giornata torni senza problemi
• Compra lo skipass: direttamente al negozio online del comprensorio
• Meteo in vetta e a valle, con avvisi per vento e nebbia
• Altezza della neve misurata dalle stazioni di misura in Austria e Svizzera
• Diario di sci con chilometri, dislivello, velocità massima e record stagionali
• Tachimetro ed esportazione GPX
• Pulsante SOS con il numero di emergenza giusto e la tua posizione esatta

OLTRE 1.800 COMPRENSORI
Nelle Alpi (Austria, Francia, Svizzera, Italia, Germania, Slovenia), nei Pirenei, in Scandinavia e in Nord America. Scarica il tuo comprensorio una sola volta; dopo, la mappa, il 3D e la navigazione funzionano anche senza segnale in montagna.

PRIVACY
Nessun account necessario. Skipilot è gratuito grazie agli annunci, mai durante la navigazione. I tuoi percorsi e il tuo diario di sci restano sul tuo iPhone. La tua posizione viene inviata ai membri del tuo gruppo solo se usi tu stesso un gruppo.

SICUREZZA
Skipilot è uno strumento di supporto. I dati delle piste provengono da OpenStreetMap e possono differire dalla realtà. L'app non sa quali piste e impianti sono davvero aperti oggi e non conosce il pericolo valanghe. Segui sempre la segnaletica e il soccorso piste.

Disponibile in italiano, olandese, inglese, tedesco, francese, spagnolo, portoghese, russo, cinese e giapponese.
Dati delle piste © contributori di OpenStreetMap, tramite OpenSkiMap. Meteo: MET Norway. Immagini satellitari © Esri.
```

**What's New in This Version** (Wat is er nieuw; 583 van 4000 tekens)

```text
• Tutta la mappa delle piste: apri Courchevel, Lech o Les Arcs e vedi l'intera area collegata
• Meteo migliore: previsioni di MET Norway e altezza della neve misurata dalle stazioni di misura
• Numeri onesti: i chilometri di piste dichiarati dal comprensorio accanto a quelli misurati sulla mappa
• Più fluida, anche con il Risparmio energetico del tuo iPhone
• Un'interruzione del GPS in cabinovia non ferma più la registrazione e la navigazione
• Avvisi per vento, nebbia e ultima corsa ora in tutte e dieci le lingue
• Ora anche in spagnolo, portoghese, russo, cinese e giapponese
```

**Support URL**: `https://thomdewit05-design.github.io/Pistenplanner/support-it.html`
**Marketing URL**: `https://thomdewit05-design.github.io/Pistenplanner/`
**Privacy Policy URL** (staat onder App Privacy, per taal): `https://thomdewit05-design.github.io/Pistenplanner/privacy-it.html`

**Schermafbeeldingen**, vak *iPhone 6.9" Display*, in deze volgorde:
1. `store/screenshots/1290x2796/it-1.jpg`
2. `store/screenshots/1290x2796/it-2.jpg`
3. `store/screenshots/1290x2796/it-3.jpg`

---

### Spaans — in App Store Connect: **Spanish (Spain)**

**Name** (Naam; 29 van 30 tekens)

```text
Skipilot: navegación de esquí
```

**Subtitle** (Ondertitel; 29 van 30 tekens)

```text
Mapa de pistas y guía por voz
```

**Promotional Text** (Promotietekst; 157 van 170 tekens)

```text
Elige adónde quieres ir y Skipilot te dice qué pistas y remontes tomar, con indicaciones por voz. En más de 1.800 estaciones de esquí, también sin cobertura.
```

**Keywords** (Trefwoorden; 94 van 100 tekens)

```text
esquiar,estación,nieve,snowboard,remontes,forfait,gps,ruta,alpes,pirineos,montaña,ski,invierno
```

**Description** (Beschrijving; 3520 van 4000 tekens)

```text
No vuelvas a perderte en las pistas. Skipilot es tu piloto en la estación de esquí: elige adónde quieres ir y la app te dice qué pistas y remontes tienes que tomar, paso a paso, con indicaciones por voz.

PLANIFICA TU RUTA
• Toca en el mapa tu punto de salida y tu destino, o toca una pista para esquiarla
• Skipilot elige pistas adecuadas a tu nivel: fácil, intermedio o difícil
• Elige la ruta más rápida o la más tranquila, y evita los telesquís o las pistas de bañeras
• ¿No es posible dentro de tu nivel? La app busca el camino más fácil y te dice con sinceridad dónde se complica
• Ruta del día: cada día una ruta distinta por pistas bonitas, con parada para comer en un refugio
• ¿Vas en snowboard? La ruta evita los tramos llanos en los que tendrías que remar, y los telesquís
• O dibuja tu propia ruta

NAVEGA
• Indicaciones por voz: qué pista, qué remonte, izquierda o derecha
• Si te sales de la ruta, Skipilot calcula una nueva automáticamente
• «Al valle»: el camino más rápido hacia abajo, desde donde estés
• Perfil de altitud, tiempos y un aviso si ya no llegas al último remonte
• En tu pantalla de bloqueo, en la Dynamic Island y en la app para Apple Watch, con un toque en la muñeca antes de cada giro
• Siri: «al valle» o «a mi hotel»

ESQUIAR JUNTOS
• Crea un grupo con un código o un código QR
• Una persona elige el destino y toca «Iniciar para todos»: todo el grupo recibe la ruta
• Mira en el mapa dónde están tus amigos

MAPAS
• Montañas en 3D: aprecia de verdad el relieve, con los remontes como cables en el aire
• Mapa de invierno: montañas nevadas con pueblos, curvas de nivel y cimas
• Mapa de satélite, mapa de terreno y mapa normal

WIDGETS
• Estación de esquí: el tiempo en lo alto de la montaña, nieve prevista, nubosidad y viento, en tu pantalla de inicio y de bloqueo
• Día de esquí: kilómetros, desnivel y descensos de hoy de un vistazo

EXTRAS ÚTILES
• Sol y sombra: mira qué pistas están ahora al sol
• Parada para comer: la app elige un refugio en tu ruta, hacia la hora a la que quieres comer
• Introduce la dirección de tu hotel y vuelve fácilmente al final del día
• Comprar forfait: directo a la tienda de forfaits de la estación
• Tiempo en la cima y en el valle, con avisos de viento y niebla
• Espesor de nieve medido en estaciones de medición de Austria y Suiza
• Diario de esquí con kilómetros, desnivel, velocidad máxima y récords de la temporada
• Velocímetro y exportación GPX
• Botón SOS con el número de emergencias correcto y tu ubicación exacta

MÁS DE 1.800 ESTACIONES DE ESQUÍ
En los Alpes (Austria, Francia, Suiza, Italia, Alemania, Eslovenia), los Pirineos, Escandinavia y Norteamérica. Descarga tu estación una sola vez; después, el mapa, el 3D y la navegación funcionan también sin cobertura en la montaña.

PRIVACIDAD
No necesitas cuenta. Skipilot es gratis gracias a los anuncios, nunca durante la navegación. Tus rutas y tu diario de esquí se quedan en tu iPhone. Tu posición solo se envía a los miembros de tu grupo si tú mismo usas un grupo.

SEGURIDAD
Skipilot es una herramienta de ayuda. Los datos de las pistas proceden de OpenStreetMap y pueden diferir de la realidad. La app no sabe qué pistas y remontes están realmente abiertos hoy y no conoce el peligro de aludes. Sigue siempre las señales y al servicio de pistas.

Disponible en español, neerlandés, inglés, alemán, francés, italiano, portugués, ruso, chino y japonés.
Datos de pistas © colaboradores de OpenStreetMap, a través de OpenSkiMap. Tiempo: MET Norway. Imágenes de satélite © Esri.
```

**What's New in This Version** (Wat is er nieuw; 548 van 4000 tekens)

```text
• Todo el mapa de pistas: abre Courchevel, Lech o Les Arcs y verás todo el dominio conectado
• Mejor tiempo: previsión de MET Norway y espesor de nieve medido en estaciones de medición
• Cifras honestas: los kilómetros de pistas según la estación junto a lo medido en el mapa
• Más fluida, también en el modo de bajo consumo de tu iPhone
• Un fallo del GPS en la telecabina ya no detiene tu grabación ni la navegación
• Avisos de viento, niebla y último remonte ahora en los diez idiomas
• Ahora también en español, portugués, ruso, chino y japonés
```

**Support URL**: `https://thomdewit05-design.github.io/Pistenplanner/support-es.html`
**Marketing URL**: `https://thomdewit05-design.github.io/Pistenplanner/`
**Privacy Policy URL** (staat onder App Privacy, per taal): `https://thomdewit05-design.github.io/Pistenplanner/privacy-es.html`

**Schermafbeeldingen**, vak *iPhone 6.9" Display*, in deze volgorde:
1. `store/screenshots/1290x2796/es-1.jpg`
2. `store/screenshots/1290x2796/es-2.jpg`
3. `store/screenshots/1290x2796/es-3.jpg`

---

### Portugees — in App Store Connect: **Portuguese (Brazil)**

**Name** (Naam; 28 van 30 tekens)

```text
Skipilot: navegação de esqui
```

**Subtitle** (Ondertitel; 26 van 30 tekens)

```text
Mapa de pistas e navegação
```

**Promotional Text** (Promotietekst; 158 van 170 tekens)

```text
Escolha o destino e o Skipilot diz quais pistas e teleféricos pegar, com instruções por voz. Em mais de 1.800 estâncias de esqui, mesmo sem sinal na montanha.
```

**Keywords** (Trefwoorden; 97 van 100 tekens)

```text
ski,pistas,neve,snowboard,estância,estação,rota,gps,alpes,teleférico,mapa,inverno,montanha,diário
```

**Description** (Beschrijving; 3553 van 4000 tekens)

```text
Nunca mais se perca nas pistas. O Skipilot é o seu piloto na estância de esqui: escolha para onde quer ir e o app diz quais pistas e teleféricos você deve pegar, passo a passo, com instruções por voz.

PLANEJAR A ROTA
• Toque no mapa no ponto de partida e no destino, ou toque em uma pista para esquiá-la
• O Skipilot escolhe pistas adequadas ao seu nível: fácil, médio ou difícil
• Escolha a rota mais rápida ou a mais tranquila, e evite teleskis ou pistas de bossas
• Não dá dentro do seu nível? O app procura o caminho mais fácil e diz com honestidade onde fica mais difícil
• Rota do dia: todo dia uma rota diferente por belas pistas, com uma parada para almoço em um refúgio
• De snowboard? A rota evita trechos planos, onde você teria que empurrar com o pé, e teleskis
• Ou desenhe a sua própria rota

NAVEGAR
• Instruções por voz: qual pista, qual teleférico, esquerda ou direita
• Saiu da rota? O Skipilot calcula uma nova automaticamente
• "Para o vale": o caminho mais rápido para baixo, de onde você está
• Perfil de altitude, tempos e um aviso se você não for mais conseguir pegar o último teleférico
• Na Tela Bloqueada, na Dynamic Island e no app para Apple Watch, com um toque no pulso antes de cada conversão
• Siri: "para o vale" ou "para o meu hotel"

ESQUIAR EM GRUPO
• Crie um grupo com um código ou QR code
• Uma pessoa escolhe o destino e toca em "Iniciar para todos": o grupo inteiro recebe a rota
• Veja no mapa onde estão os seus amigos

MAPAS
• Montanhas em 3D: veja as altitudes de verdade, com os teleféricos como cabos no ar
• Mapa de inverno: montanhas nevadas com vilarejos, curvas de nível e cumes
• Mapa de satélite, mapa de relevo e mapa comum

WIDGETS
• Estância de esqui: o tempo no topo da montanha, neve prevista, nebulosidade e vento, na Tela de Início e na Tela Bloqueada
• Dia de esqui: quilômetros, metros de desnível e descidas de hoje em um relance

EXTRAS ÚTEIS
• Sol e sombra: veja quais pistas estão no sol agora
• Parada para almoço: o app escolhe um refúgio na sua rota, por volta do horário em que você quer almoçar
• Informe o endereço do seu hotel e volte com facilidade no fim do dia
• Comprar passe de esqui: direto para a loja de ingressos da estância
• Tempo no topo e no vale, com avisos de vento e neblina
• Altura de neve medida por estações de medição na Áustria e na Suíça
• Diário de esqui com quilômetros, metros de desnível, velocidade máxima e recordes da temporada
• Velocímetro e exportação GPX
• Botão SOS com o número de emergência certo e a sua localização exata

MAIS DE 1.800 ESTÂNCIAS DE ESQUI
Nos Alpes (Áustria, França, Suíça, Itália, Alemanha, Eslovênia), nos Pireneus, na Escandinávia e na América do Norte. Baixe a sua estância de esqui uma única vez; depois disso, o mapa, o 3D e a navegação funcionam também sem sinal na montanha.

PRIVACIDADE
Não é preciso criar conta. O Skipilot é gratuito graças aos anúncios, nunca durante a navegação. Suas rotas e seu diário de esqui ficam no seu iPhone. Sua posição só é enviada aos membros do seu grupo se você mesmo usar um grupo.

SEGURANÇA
O Skipilot é uma ferramenta de apoio. Os dados das pistas vêm do OpenStreetMap e podem ser diferentes da realidade. O app não sabe quais pistas e teleféricos estão realmente abertos hoje e não conhece o risco de avalanches. Siga sempre as placas e o serviço de pistas.

Disponível em português, holandês, inglês, alemão, francês, italiano, espanhol, russo, chinês e japonês.
Dados das pistas © colaboradores do OpenStreetMap, via OpenSkiMap. Tempo: MET Norway. Imagens de satélite © Esri.
```

**What's New in This Version** (Wat is er nieuw; 554 van 4000 tekens)

```text
• O mapa de pistas completo: ao abrir Courchevel, Lech ou Les Arcs, você vê toda a área interligada
• Tempo melhor: previsão do MET Norway e altura de neve medida por estações de medição
• Números honestos: os quilômetros de pistas segundo a estância ao lado do que foi medido no mapa
• Mais fluido, também no Modo Pouca Energia do seu iPhone
• Uma falha de GPS na telecabine não interrompe mais a gravação nem a navegação
• Avisos de vento, neblina e último teleférico agora nos dez idiomas
• Agora também em espanhol, português, russo, chinês e japonês
```

**Support URL**: `https://thomdewit05-design.github.io/Pistenplanner/support-pt.html`
**Marketing URL**: `https://thomdewit05-design.github.io/Pistenplanner/`
**Privacy Policy URL** (staat onder App Privacy, per taal): `https://thomdewit05-design.github.io/Pistenplanner/privacy-pt.html`

**Schermafbeeldingen**, vak *iPhone 6.9" Display*, in deze volgorde:
1. `store/screenshots/1290x2796/pt-1.jpg`
2. `store/screenshots/1290x2796/pt-2.jpg`
3. `store/screenshots/1290x2796/pt-3.jpg`

---

### Russisch — in App Store Connect: **Russian**

**Name** (Naam; 26 van 30 tekens)

```text
Skipilot: лыжный навигатор
```

**Subtitle** (Ondertitel; 30 van 30 tekens)

```text
Карта трасс и маршруты в горах
```

**Promotional Text** (Promotietekst; 159 van 170 tekens)

```text
Выбери, куда хочешь попасть, и Skipilot подскажет, по каким трассам и подъёмникам ехать, с голосовыми подсказками. Более 1800 курортов, даже без связи в горах.
```

**Keywords** (Trefwoorden; 98 van 100 tekens)

```text
горные лыжи,сноуборд,горнолыжный курорт,склон,подъёмник,альпы,gps,трекер,снег,ски-пасс,погода,лифт
```

**Description** (Beschrijving; 3520 van 4000 tekens)

```text
Больше никогда не заблудишься на склоне. Skipilot — твой пилот на горнолыжном курорте: выбери, куда хочешь попасть, и приложение подскажет, по каким трассам и подъёмникам ехать, шаг за шагом, с голосовыми подсказками.

ПЛАНИРОВАНИЕ МАРШРУТА
• Отметь на карте старт и пункт назначения или нажми на трассу, чтобы проехать по ней
• Skipilot выбирает трассы твоего уровня: лёгкие, средние или сложные
• Выбери самый быстрый или самый спокойный маршрут, избегай бугельных подъёмников или бугристых трасс
• Не получается в пределах твоего уровня? Приложение найдёт самый лёгкий путь и честно скажет, где будет сложнее
• Маршрут дня: каждый день новый маршрут по красивым трассам, с остановкой на обед в хижине
• На сноуборде? Маршрут обходит пологие участки, где приходится толкаться, и бугельные подъёмники
• Или нарисуй свой маршрут

НАВИГАЦИЯ
• Голосовые подсказки: какая трасса, какой подъёмник, налево или направо
• Сошёл с маршрута? Skipilot сам проложит новый
• «В долину»: самый быстрый путь вниз оттуда, где ты находишься
• Профиль высот, время и предупреждение, если не успеваешь на последний подъёмник
• На экране блокировки, в Dynamic Island и в приложении для Apple Watch, с лёгким касанием на запястье перед каждым поворотом
• Siri: «в долину» или «к моему отелю»

КАТАНИЕ ВМЕСТЕ
• Создай группу с помощью кода или QR-кода
• Один человек выбирает пункт назначения и нажимает «Запустить для всех»: маршрут получает вся группа
• Смотри на карте, где твои друзья

КАРТЫ
• Горы в 3D: высоты видны по-настоящему, а подъёмники — как канаты в воздухе
• Зимняя карта: заснеженные горы с деревнями, горизонталями и вершинами
• Спутниковая карта, карта рельефа и обычная карта

ВИДЖЕТЫ
• Курорт: погода на вершине, ожидаемый снег, облачность и ветер, на экране «Домой» и экране блокировки
• Лыжный день: километры, перепад высот и спуски за сегодня с первого взгляда

ПОЛЕЗНЫЕ ДОПОЛНЕНИЯ
• Солнце и тень: смотри, какие трассы сейчас на солнце
• Обед: приложение выберет хижину на твоём маршруте примерно в то время, когда ты хочешь пообедать
• Укажи адрес своего отеля и легко возвращайся в конце дня
• Купить ски-пасс: сразу в билетный магазин курорта
• Погода на вершине и в долине, с предупреждениями о ветре и тумане
• Измеренная высота снега с метеостанций в Австрии и Швейцарии
• Дневник катания с километрами, перепадом высот, максимальной скоростью и рекордами сезона
• Спидометр и экспорт GPX
• Кнопка SOS с нужным номером экстренных служб и твоим точным местоположением

БОЛЕЕ 1800 ГОРНОЛЫЖНЫХ КУРОРТОВ
В Альпах (Австрия, Франция, Швейцария, Италия, Германия, Словения), Пиренеях, Скандинавии и Северной Америке. Скачай курорт один раз; после этого карта, 3D и навигация работают и без связи в горах.

КОНФИДЕНЦИАЛЬНОСТЬ
Учётная запись не нужна. Skipilot бесплатен благодаря рекламе, которой никогда нет во время навигации. Твои маршруты и дневник катания остаются на твоём iPhone. Твоя позиция передаётся участникам твоей группы, только если ты сам пользуешься группой.

БЕЗОПАСНОСТЬ
Skipilot — это вспомогательное средство. Данные о трассах взяты из OpenStreetMap и могут отличаться от реальности. Приложение не знает, какие трассы и подъёмники действительно открыты сегодня, и не учитывает лавинную опасность. Всегда следуй указателям и указаниям службы трасс.

Доступно на русском, нидерландском, английском, немецком, французском, итальянском, испанском, португальском, китайском и японском языках.
Данные о трассах © участники OpenStreetMap, через OpenSkiMap. Погода: MET Norway. Спутниковые снимки © Esri.
```

**What's New in This Version** (Wat is er nieuw; 547 van 4000 tekens)

```text
• Вся карта трасс: открой Куршевель, Лех или Лез-Арк и увидишь всю объединённую зону катания целиком
• Погода стала лучше: прогноз MET Norway и измеренная высота снега с метеостанций
• Честные цифры: километры трасс по данным курорта рядом с тем, что измерено по карте
• Плавнее, в том числе в режиме энергосбережения iPhone
• Сбой GPS в гондоле больше не останавливает запись и навигацию
• Предупреждения о ветре, тумане и последнем подъёмнике теперь на всех десяти языках
• Теперь также на испанском, португальском, русском, китайском и японском
```

**Support URL**: `https://thomdewit05-design.github.io/Pistenplanner/support-ru.html`
**Marketing URL**: `https://thomdewit05-design.github.io/Pistenplanner/`
**Privacy Policy URL** (staat onder App Privacy, per taal): `https://thomdewit05-design.github.io/Pistenplanner/privacy-ru.html`

**Schermafbeeldingen**, vak *iPhone 6.9" Display*, in deze volgorde:
1. `store/screenshots/1290x2796/ru-1.jpg`
2. `store/screenshots/1290x2796/ru-2.jpg`
3. `store/screenshots/1290x2796/ru-3.jpg`

---

### Chinees — in App Store Connect: **Chinese (Simplified)**

**Name** (Naam; 14 van 30 tekens)

```text
Skipilot: 滑雪导航
```

**Subtitle** (Ondertitel; 11 van 30 tekens)

```text
雪道地图与雪场路线规划
```

**Promotional Text** (Promotietekst; 68 van 170 tekens)

```text
选好想去的地方，Skipilot 就会告诉你该滑哪些雪道、乘哪些缆车，并提供语音导航。覆盖 1,800 多个滑雪场，山上没有信号也能用。
```

**Keywords** (Trefwoorden; 78 van 100 tekens)

```text
雪场,缆车,单板,双板,阿尔卑斯,GPS,轨迹记录,离线地图,粉雪,雪况,天气,欧洲,瑞士,法国,奥地利,日记,3D,ski,piste,snowboard
```

**Description** (Beschrijving; 1269 van 4000 tekens)

```text
在雪道上再也不会迷路。Skipilot 是你在滑雪场里的领航员：选好想去的地方，应用就会一步一步告诉你该滑哪些雪道、乘哪些缆车，并提供语音导航。

规划路线
• 在地图上点按出发点和目的地，或者点按一条雪道直接去滑
• Skipilot 会挑选适合你水平的雪道：初级、中级或高级
• 选择最快或最轻松的路线，并可避开拖牵或蘑菇道
• 在你的水平范围内走不通？应用会找出最容易的走法，并如实告诉你哪里会更难
• 今日路线：每天一条不同的路线，带你滑过漂亮的雪道，并在山屋安排一次午餐停靠
• 玩单板？路线会避开需要单脚蹬行的平缓路段，以及拖牵
• 也可以自己绘制路线

导航
• 语音导航：哪条雪道、哪条缆车、向左还是向右
• 偏离路线时，Skipilot 会自动重新计算路线
• “下山”：从你所在的位置出发，最快的下山路线
• 高度剖面图、时间，以及赶不上末班缆车时的提醒
• 显示在锁定屏幕、灵动岛和 Apple Watch 应用中，每个转弯前手腕都会感到一下轻点
• Siri：“下山”或“去我的酒店”

一起滑雪
• 用代码或二维码创建小组
• 一个人选好目的地并点按“为所有人开始”：整个小组都会收到这条路线
• 在地图上查看朋友们在哪里

地图
• 3D 山脉：真实地看到高低起伏，缆车就像悬在空中的缆线
• 冬季地图：白雪覆盖的群山，配有村庄、等高线和山峰
• 卫星地图、地形图和普通地图

小组件
• 滑雪场：山顶的天气、预计降雪、云量和风力，显示在主屏幕和锁定屏幕上
• 滑雪日：今天的公里数、落差和滑行趟数，一目了然

实用功能
• 阳光与阴影：查看哪些雪道此刻正晒着太阳
• 午餐停靠：应用会在你的路线上挑选一间山屋，时间就在你想吃午餐的前后
• 填入酒店地址，一天结束时轻松返回
• 购买雪票：直接前往滑雪场的售票网店
• 山顶和山谷的天气，并有大风和大雾警告
• 奥地利和瑞士测量站的实测积雪深度
• 滑雪日记：公里数、落差、最高速度和赛季纪录
• 速度表和 GPX 导出
• SOS 按钮：显示正确的紧急电话号码和你的精确位置

1,800 多个滑雪场
覆盖阿尔卑斯山（奥地利、法国、瑞士、意大利、德国、斯洛文尼亚）、比利牛斯山、斯堪的纳维亚和北美。滑雪场只需下载一次；之后在山上没有信号时，地图、3D 和导航也能使用。

隐私
无需账户。Skipilot 靠广告得以免费，广告绝不会在导航期间出现。你的路线和滑雪日记保留在你的 iPhone 上。只有当你自己使用小组时，你的位置才会发送给小组成员。

安全
Skipilot 是一种辅助工具。雪道数据来自 OpenStreetMap，可能与实际情况不符。应用不知道今天哪些雪道和缆车实际开放，也不了解雪崩危险。请始终遵守标志和雪道巡逻员的指示。

支持中文、荷兰语、英语、德语、法语、意大利语、西班牙语、葡萄牙语、俄语和日语。
雪道数据 © OpenStreetMap 贡献者，经由 OpenSkiMap。天气：MET Norway。卫星图像 © Esri。
```

**What's New in This Version** (Wat is er nieuw; 228 van 4000 tekens)

```text
• 完整的雪道地图：打开 Courchevel、Lech 或 Les Arcs，就能看到整片相连的滑雪区域
• 更好的天气：MET Norway 的预报和测量站的实测积雪深度
• 如实的数字：滑雪场公布的雪道公里数，与地图上实测的数字并列显示
• 更流畅，在 iPhone 的低电量模式下也一样
• 吊厢缆车里的 GPS 信号中断不会再让记录和导航停止
• 大风、大雾和末班缆车的警告现已支持全部十种语言
• 现在还支持西班牙语、葡萄牙语、俄语、中文和日语
```

**Support URL**: `https://thomdewit05-design.github.io/Pistenplanner/support-zh.html`
**Marketing URL**: `https://thomdewit05-design.github.io/Pistenplanner/`
**Privacy Policy URL** (staat onder App Privacy, per taal): `https://thomdewit05-design.github.io/Pistenplanner/privacy-zh.html`

**Schermafbeeldingen**, vak *iPhone 6.9" Display*, in deze volgorde:
1. `store/screenshots/1290x2796/zh-1.jpg`
2. `store/screenshots/1290x2796/zh-2.jpg`
3. `store/screenshots/1290x2796/zh-3.jpg`

---

### Japans — in App Store Connect: **Japanese**

**Name** (Naam; 16 van 30 tekens)

```text
Skipilot: スキー場ナビ
```

**Subtitle** (Ondertitel; 13 van 30 tekens)

```text
ゲレンデマップとコース案内
```

**Promotional Text** (Promotietekst; 87 van 170 tekens)

```text
行きたい場所を選ぶだけで、どのコースを滑り、どのリフトに乗ればいいかをSkipilotが音声で案内します。1,800か所以上のスキー場に対応、山の上で電波がなくても使えます。
```

**Keywords** (Trefwoorden; 91 van 100 tekens)

```text
スノーボード,スノボ,地図,リフト,雪山,ルート,GPS,滑走記録,ログ,積雪,天気,アルプス,パウダー,ウィンタースポーツ,ski,トラッカー,ヨーロッパ,海外,オフライン,山小屋
```

**Description** (Beschrijving; 1627 van 4000 tekens)

```text
もうゲレンデで迷いません。Skipilotはスキー場でのあなたのパイロットです。行きたい場所を選ぶだけで、どのコースを滑り、どのリフトに乗ればいいかを、音声案内でひとつずつお伝えします。

ルートを作る
• 地図上で出発地と目的地をタップ。コースをタップして、そのコースを滑ることもできます
• あなたのレベルに合ったコースをSkipilotが選びます：初級、中級、上級
• 最速ルートか、のんびりルートかを選択。Tバーリフトやコブ斜面を避けることもできます
• レベル内で行けないときは、いちばんやさしい道を探し、どこが難しくなるかを正直にお伝えします
• 今日のルート：景色のいいコースをめぐるルートを毎日日替わりで。山小屋でのランチ休憩付き
• スノーボードなら、歩かなければならない平らな区間とTバーリフトを避けます
• 自分でルートを描くこともできます

ナビゲーション
• 音声案内：どのコース、どのリフト、左か右か
• ルートを外れたら、Skipilotが自動で新しいルートを計算します
• 「麓へ」：今いる場所から麓までの最速ルート
• 標高プロファイル、所要時間、最終リフトに間に合わないときの警告
• ロック画面、Dynamic Island、Apple Watchアプリに表示。曲がり角ごとに手首へのタップでお知らせ
• Siri：「麓へ」「ホテルへ」

みんなで滑る
• コードまたはQRコードでグループを作成
• ひとりが目的地を選んで「全員で開始」をタップすると、グループ全員にルートが届きます
• 友達がどこにいるかを地図で確認

地図
• 3Dの山：高低差がひと目でわかり、リフトは空中のケーブルとして表示
• 冬季マップ：村、等高線、山頂が入った雪景色の山
• 衛星写真、地形図、通常の地図

ウィジェット
• スキー場：山頂の天気、降雪予報、雲量、風を、ホーム画面とロック画面に
• スキーの一日：今日の距離、標高差、滑走本数がひと目でわかります

便利な機能
• 日なたと日陰：今どのコースに日が当たっているかがわかります
• ランチ休憩：ランチをとりたい時間に合わせて、ルート上の山小屋をアプリが選びます
• ホテルの住所を入力しておけば、一日の終わりに迷わず戻れます
• リフト券を買う：スキー場のチケットショップへ直接移動
• 山頂と麓の天気、風と霧の警告付き
• オーストリアとスイスの観測所で計測された積雪深
• 距離、標高差、最高速度、シーズン記録が残るスキー日記
• スピードメーターとGPX書き出し
• 正しい緊急通報番号と正確な現在地を表示するSOSボタン

1,800か所以上のスキー場
アルプス（オーストリア、フランス、スイス、イタリア、ドイツ、スロベニア）、ピレネー、スカンジナビア、北米に対応。スキー場を一度ダウンロードすれば、その後は山の上で電波がなくても、地図、3D、ナビゲーションが使えます。

プライバシー
アカウントは不要です。Skipilotは広告のおかげで無料です。広告がナビゲーション中に表示されることはありません。ルートとスキー日記はあなたのiPhoneにとどまります。あなたの位置がグループのメンバーに送られるのは、自分でグループを使うときだけです。

安全
Skipilotは補助ツールです。コースデータはOpenStreetMapによるもので、実際と異なることがあります。アプリは今日どのコースやリフトが実際に営業しているかを把握しておらず、雪崩の危険も把握していません。必ず標識とパトロールの指示に従ってください。

対応言語：オランダ語、英語、ドイツ語、フランス語、イタリア語、スペイン語、ポルトガル語、ロシア語、中国語、日本語。
コースデータ © OpenStreetMap協力者、OpenSkiMap経由。天気：MET Norway。衛星写真 © Esri。
```

**What's New in This Version** (Wat is er nieuw; 262 van 4000 tekens)

```text
• コースマップ全体を表示：クールシュヴェル、レッヒ、レ・ザルクを開くと、つながったエリア全体が見られます
• 天気がより正確に：MET Norwayの予報と、観測所で計測された積雪深
• 正直な数字：スキー場公表のコース総延長と、地図上で計測した距離を並べて表示
• よりなめらかに。iPhoneの低電力モードでも快適です
• ゴンドラ内でGPSが途切れても、記録とナビゲーションが止まらなくなりました
• 風、霧、最終リフトの警告が全10言語に対応
• スペイン語、ポルトガル語、ロシア語、中国語、日本語にも対応しました
```

**Support URL**: `https://thomdewit05-design.github.io/Pistenplanner/support-ja.html`
**Marketing URL**: `https://thomdewit05-design.github.io/Pistenplanner/`
**Privacy Policy URL** (staat onder App Privacy, per taal): `https://thomdewit05-design.github.io/Pistenplanner/privacy-ja.html`

**Schermafbeeldingen**, vak *iPhone 6.9" Display*, in deze volgorde:
1. `store/screenshots/1290x2796/ja-1.jpg`
2. `store/screenshots/1290x2796/ja-2.jpg`
3. `store/screenshots/1290x2796/ja-3.jpg`

---

### Apple Watch

Apple vraagt ook schermafbeeldingen van de Watch-app. Zet deze vijf, in deze volgorde, onder het tabblad **Apple Watch** bij de primaire taal (Dutch), in het vak *Apple Watch Series 10 / 11 (46mm)* (416×496). Ze gelden dan voor alle talen.

1. `store/screenshots/watch/1-nav.png` (de volgende afslag)
2. `store/screenshots/watch/2-day.png` (je skidag)
3. `store/screenshots/watch/3-wx.png` (weer en lifttijden)
4. `store/screenshots/watch/4-group.png` (je groep)
5. `store/screenshots/watch/5-sos.png` (de noodknop met je locatie)

Dezelfde vijf staan er ook in de andere negen talen, in een map per taal: `store/screenshots/watch/en/`, `de/`, `fr/`, `it/`, `es/`, `pt/`, `ru/`, `zh/` en `ja/`. Zet ze bij de bijbehorende taal in App Store Connect als je per taal eigen afbeeldingen wilt; anders gebruikt Apple overal de Nederlandse.

## 7. De versie afmaken

| Veld | Waarde |
|---|---|
| Build | De nieuwste build van versie 1.1.0 uit TestFlight |
| Export Compliance | Niets te kiezen: de app meldt zelf dat hij alleen standaardversleuteling gebruikt (`ITSAppUsesNonExemptEncryption = false`). Komt de vraag toch: "None of the algorithms mentioned above" |
| Advertising Identifier (IDFA) | **Yes**, voor het tonen van advertenties ("Serve advertisements within the app") |
| Version Release | Handmatig vrijgeven ("Manually release this version") |
| Phased Release | Uit |

## 8. Dit kan alleen Thom

- Het **telefoonnummer** bij de gegevens voor de keurder.
- **Schermafbeeldingen van de iPad**: de app werkt ook op de iPad, dus Apple vraagt ze in het vak *iPad 13" Display* (2064×2752 staand of 2752×2064 liggend), minstens één. Maak ze op je eigen iPad (bovenste knop en volumeknop tegelijk) en zet ze bij de primaire taal; ze gelden dan voor alle talen. Proberen kan ook met `DEVICE=ipad node tools/store-shots.mjs`, maar de 3D-beelden laden daar niet betrouwbaar.
- Nakijken van de vertalingen als je iemand kent die de taal spreekt, vooral Russisch, Chinees en Japans. De Nederlandse tekst is de bron; de juridische pagina's zeggen dat de Nederlandse versie leidend is.
- Wat de vertalers zelf als onzeker hebben opgegeven en wat een moedertaalspreker het snelst kan nakijken: de namen van Apple-onderdelen (Live Activity, het pad naar "Volgen" in de instellingen, de energiebesparingsmodus) zijn uit het hoofd vertaald en niet op een toestel gecontroleerd; de Siri-zinnen in de beschrijving ("naar het dal", "naar mijn hotel") zijn vertaald, terwijl Siri ze alleen in het Nederlands, Engels en Duits kent.
- De knop **Add for Review / Submit for Review**.

## 9. Controlelijst

- [ ] Alle tien talen staan onder de versie, elk met naam, ondertitel, promotietekst, trefwoorden, beschrijving en "Wat is er nieuw".
- [ ] Elke taal heeft drie schermafbeeldingen in het vak van 6,9 inch.
- [ ] Onder Apple Watch staan drie schermafbeeldingen.
- [ ] Support-URL en privacy-URL openen in de browser en tonen de pagina in de juiste taal.
- [ ] App-privacy bevat de regels uit hoofdstuk 4 en geen andere.
- [ ] De notities voor de keurder staan er in hun geheel.
- [ ] Er is niets ingediend.
