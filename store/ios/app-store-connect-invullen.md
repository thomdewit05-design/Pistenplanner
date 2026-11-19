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

**Notes** (2889 van 4000 tekens), in zijn geheel plakken:

```text
Skipilot is a ski map and turn-by-turn navigation app for ski areas. No login or account is required.

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
The app includes home screen and lock screen widgets (ski area weather, ski day stats), a Live Activity for navigation and an Apple Watch app that shows the ski day and the next turn.

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

**Description** (Beschrijving; 199 van 4000 tekens)

```text
Nooit meer verdwalen op de piste. Skipilot is je piloot in het skigebied: kies waar je heen wilt en de app vertelt je welke pistes en liften je moet nemen, stap voor stap, met gesproken aanwijzingen.
```

**What's New in This Version** (Wat is er nieuw; 101 van 4000 tekens)

```text
• De hele pistekaart: open je Courchevel, Lech of Les Arcs, dan zie je het hele aaneengesloten gebied
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

**Description** (Beschrijving; 193 van 4000 tekens)

```text
Never get lost on the mountain again. Skipilot is your pilot in the ski area: pick where you want to go and the app tells you which runs and lifts to take, step by step, with spoken directions.
```

**What's New in This Version** (Wat is er nieuw; 94 van 4000 tekens)

```text
• The whole piste map: open Courchevel, Lech or Les Arcs and you see the entire connected area
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

**Description** (Beschrijving; 199 van 4000 tekens)

```text
Nie wieder auf der Piste verirren. Skipilot ist dein Pilot im Skigebiet: Wähle, wohin du willst, und die App sagt dir, welche Pisten und Lifte du nehmen musst, Schritt für Schritt, mit Sprachansagen.
```

**What's New in This Version** (Wat is er nieuw; 113 van 4000 tekens)

```text
• Die ganze Pistenkarte: Öffnest du Courchevel, Lech oder Les Arcs, siehst du das gesamte zusammenhängende Gebiet
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

**Description** (Beschrijving; 222 van 4000 tekens)

```text
Ne te perds plus jamais sur les pistes. Skipilot est ton pilote dans le domaine skiable : choisis où tu veux aller et l'appli t'indique les pistes et les remontées à prendre, étape par étape, avec des instructions vocales.
```

**What's New in This Version** (Wat is er nieuw; 95 van 4000 tekens)

```text
• Tout le plan des pistes : ouvre Courchevel, Lech ou Les Arcs et tu vois tout le domaine relié
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

**Description** (Beschrijving; 184 van 4000 tekens)

```text
Mai più persi sulle piste. Skipilot è il tuo pilota nel comprensorio: scegli dove vuoi andare e l'app ti dice quali piste e impianti prendere, passo dopo passo, con indicazioni vocali.
```

**What's New in This Version** (Wat is er nieuw; 93 van 4000 tekens)

```text
• Tutta la mappa delle piste: apri Courchevel, Lech o Les Arcs e vedi l'intera area collegata
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

**Description** (Beschrijving; 203 van 4000 tekens)

```text
No vuelvas a perderte en las pistas. Skipilot es tu piloto en la estación de esquí: elige adónde quieres ir y la app te dice qué pistas y remontes tienes que tomar, paso a paso, con indicaciones por voz.
```

**What's New in This Version** (Wat is er nieuw; 92 van 4000 tekens)

```text
• Todo el mapa de pistas: abre Courchevel, Lech o Les Arcs y verás todo el dominio conectado
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

**Description** (Beschrijving; 200 van 4000 tekens)

```text
Nunca mais se perca nas pistas. O Skipilot é o seu piloto na estância de esqui: escolha para onde quer ir e o app diz quais pistas e teleféricos você deve pegar, passo a passo, com instruções por voz.
```

**What's New in This Version** (Wat is er nieuw; 99 van 4000 tekens)

```text
• O mapa de pistas completo: ao abrir Courchevel, Lech ou Les Arcs, você vê toda a área interligada
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

**Description** (Beschrijving; 217 van 4000 tekens)

```text
Больше никогда не заблудишься на склоне. Skipilot — твой пилот на горнолыжном курорте: выбери, куда хочешь попасть, и приложение подскажет, по каким трассам и подъёмникам ехать, шаг за шагом, с голосовыми подсказками.
```

**What's New in This Version** (Wat is er nieuw; 100 van 4000 tekens)

```text
• Вся карта трасс: открой Куршевель, Лех или Лез-Арк и увидишь всю объединённую зону катания целиком
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

**Description** (Beschrijving; 72 van 4000 tekens)

```text
在雪道上再也不会迷路。Skipilot 是你在滑雪场里的领航员：选好想去的地方，应用就会一步一步告诉你该滑哪些雪道、乘哪些缆车，并提供语音导航。
```

**What's New in This Version** (Wat is er nieuw; 53 van 4000 tekens)

```text
• 完整的雪道地图：打开 Courchevel、Lech 或 Les Arcs，就能看到整片相连的滑雪区域
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

**Description** (Beschrijving; 93 van 4000 tekens)

```text
もうゲレンデで迷いません。Skipilotはスキー場でのあなたのパイロットです。行きたい場所を選ぶだけで、どのコースを滑り、どのリフトに乗ればいいかを、音声案内でひとつずつお伝えします。
```

**What's New in This Version** (Wat is er nieuw; 53 van 4000 tekens)

```text
• コースマップ全体を表示：クールシュヴェル、レッヒ、レ・ザルクを開くと、つながったエリア全体が見られます
```

**Support URL**: `https://thomdewit05-design.github.io/Pistenplanner/support-ja.html`
**Marketing URL**: `https://thomdewit05-design.github.io/Pistenplanner/`
**Privacy Policy URL** (staat onder App Privacy, per taal): `https://thomdewit05-design.github.io/Pistenplanner/privacy-ja.html`

**Schermafbeeldingen**, vak *iPhone 6.9" Display*, in deze volgorde:
1. `store/screenshots/1290x2796/ja-1.jpg`
2. `store/screenshots/1290x2796/ja-2.jpg`
3. `store/screenshots/1290x2796/ja-3.jpg`

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
- **Schermafbeeldingen van de Apple Watch** (bijvoorbeeld 410×502): Apple vraagt ze omdat de app een Watch-onderdeel heeft. Maak ze op je eigen Watch (zijknop en Digital Crown tegelijk) of in de simulator.
- Nakijken van de vertalingen als je iemand kent die de taal spreekt, vooral Russisch, Chinees en Japans. De Nederlandse tekst is de bron; de juridische pagina's zeggen dat de Nederlandse versie leidend is.
- Wat de vertalers zelf als onzeker hebben opgegeven en wat een moedertaalspreker het snelst kan nakijken: de namen van Apple-onderdelen (Live Activity, het pad naar "Volgen" in de instellingen, de energiebesparingsmodus) zijn uit het hoofd vertaald en niet op een toestel gecontroleerd; de Siri-zinnen in de beschrijving ("naar het dal", "naar mijn hotel") zijn vertaald, terwijl Siri ze alleen in het Nederlands, Engels en Duits kent.
- De knop **Add for Review / Submit for Review**.

## 9. Controlelijst

- [ ] Alle tien talen staan onder de versie, elk met naam, ondertitel, promotietekst, trefwoorden, beschrijving en "Wat is er nieuw".
- [ ] Elke taal heeft drie schermafbeeldingen in het vak van 6,9 inch.
- [ ] Support-URL en privacy-URL openen in de browser en tonen de pagina in de juiste taal.
- [ ] App-privacy bevat de regels uit hoofdstuk 4 en geen andere.
- [ ] De notities voor de keurder staan er in hun geheel.
- [ ] Er is niets ingediend.
