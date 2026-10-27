# Skipilot in de Google Play Store

Skipilot gaat de Play Store in als **Trusted Web Activity**: een klein Android-pakket dat de webapp schermvullend opent.
Updates van de website komen dus vanzelf in de app; alleen bij een nieuw icoon of een nieuwe naam is een nieuw pakket nodig.

## Wat er in deze map staat

| Bestand | Waarvoor |
|---|---|
| `nl/screenshot-1..6.jpg`, `en/...` | Telefoonschermafbeeldingen (1080 × 1920) |
| `nl/feature-graphic.jpg`, `en/...` | Banner bovenaan de winkelpagina (1024 × 500) |
| `icon-512.png` | App-icoon voor de Play Console (512 × 512) |
| `listing-nl.md`, `listing-en.md` | Naam, korte en volledige beschrijving |
| `assetlinks-voorbeeld.json` | Voorbeeld voor de koppeling tussen app en website |

Opnieuw maken: `node promo/shots.mjs nl`, `node promo/shots.mjs en` en daarna `node promo/make_store.mjs` (lokale server op poort 8766).

## Stappen

### 1. Eigen domein (aangeraden)
De koppeling tussen app en website (`/.well-known/assetlinks.json`) moet in de hoofdmap van het domein staan.
Op `thomdewit05-design.github.io/Pistenplanner` kan dat niet; met een eigen domein (bijvoorbeeld skipilot.nl) wel.
Zonder die koppeling werkt de app ook, maar met een adresbalk bovenin.

### 2. Ontwikkelaarsaccount
Maak een account in de [Google Play Console](https://play.google.com/console) (eenmalig $ 25, met identiteitscontrole).
Nieuwe persoonlijke accounts moeten eerst een **gesloten test** doen met een groep testers (Google noemt nu 12 testers gedurende 14 dagen; kijk in de Play Console wat er voor jou geldt).

### 3. Het pakket maken met PWABuilder
1. Ga naar [pwabuilder.com](https://www.pwabuilder.com) en vul het adres van de app in.
2. Kies **Package for stores → Android → Google Play**, en vul in de opties in:
   - **Package ID**: bijvoorbeeld `nl.skipilot.app` (kan later niet meer veranderen)
   - **App name**: `Skipilot`, **Launcher name**: `Skipilot`
   - **Start URL**: `/?src=play` (met je eigen pad als je nog geen domein hebt: `/Pistenplanner/?src=play`)
     Hieraan herkent de app de Play-versie: geen betaling buiten Google Play om en geen AdSense.
   - **Theme / background color**: `#0F1B2A`
   - **Location delegation**: aan (dan vraagt Android zelf om toestemming voor je locatie, nodig voor de navigatie)
   - **Notification delegation**: uit
   - **Signing key**: *Create new*. **Bewaar het sleutelbestand en de wachtwoorden goed**; zonder deze sleutel kun je de app nooit meer bijwerken.
3. Download de zip. Daarin zitten het pakket (`.aab`) en een `assetlinks.json`.

### 4. De koppeling op de website
Stuur `assetlinks.json` (of de SHA-256-vingerafdruk die PWABuilder toont) door, dan zet ik hem op `/.well-known/assetlinks.json`.
Gebruik je *Play App Signing* (standaard), voeg dan ook de vingerafdruk toe die de Play Console toont onder *App-integriteit*.

### 5. In de Play Console
- **Winkelvermelding**: teksten uit `listing-nl.md` (standaardtaal Nederlands) en `listing-en.md` als vertaling; afbeeldingen uit `nl/` en `en/`.
- **Categorie**: Kaarten en navigatie. **Contact-e-mail**: verplicht. **Privacybeleid**: `https://<jouw-adres>/privacy.html`.
- **Doelgroep**: 13 jaar en ouder (de app deelt in groepen je locatie; voor kinderen gelden strengere regels).
- **Advertenties**: "Nee, mijn app bevat geen advertenties" (de Play-versie toont geen AdSense).
- **Contentclassificatie**: vul de vragenlijst in; let op de vraag of de app de locatie van gebruikers met andere gebruikers deelt (ja, in groepen).
- **Gegevensveiligheid** (controleer dit zelf, jij bent verantwoordelijk voor de antwoorden):
  - *Locatie, precies*: verzameld, optioneel, voor app-functionaliteit (alleen als je een groep gebruikt en positie delen aan staat; gaat via ntfy.sh naar je groepsgenoten).
  - *Naam* (je naam in een groep): verzameld, optioneel, voor app-functionaliteit.
  - Gegevens worden versleuteld verstuurd (https). Er is geen account; groepsberichten verdwijnen vanzelf na korte tijd.
  - Locatie voor de navigatie en het skidagboek blijft op de telefoon en telt niet als "verzameld".
- **Toegang voor beoordeling**: niet nodig (geen login).

### 6. Testen en uitbrengen
Upload het `.aab` naar *Gesloten test*, nodig je testers uit en laat ze de app een paar dagen echt gebruiken.
Daarna kun je *productietoegang* aanvragen en de app openbaar maken.

## Pro en betalen in de Play-versie
Google staat niet toe dat je in een Play-app digitale functies verkoopt via een eigen kassa (zoals Lemon Squeezy).
Daarom is Pro in de Play-versie uitgeschakeld en is alles gratis. Wil je later Pro in de Play-versie verkopen,
dan moet dat via Google Play Billing (de *Digital Goods API* werkt ook in een Trusted Web Activity).
