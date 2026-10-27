# Skipilot in de Apple App Store

De iOS-app is gemaakt met [Capacitor](https://capacitorjs.com): een echte iPhone-app waarin de webapp zelf zit
(alle code en de pistedata van `data/`), dus hij start meteen en werkt zonder bereik.
Anders dan de Play-versie haalt hij de code **niet** van de website: een nieuwe versie van de app moet opnieuw naar Apple.
Alleen de hutten en restaurants komen van de website (`data/h*.json`), zodat die maandelijks vers blijven.

Je hebt **geen Mac** nodig: GitHub bouwt de app op een Mac in de cloud (`.github/workflows/ios.yml`).

## Wat er anders is in de iOS-app

- De app herkent zichzelf (`PP_STORE = "ios"` in `config.js`): geen AdSense en geen Lemon Squeezy.
  Pro is in de app een **eenmalige In-App Purchase** via de App Store (zie hieronder).
- Het scherm blijft aan tijdens navigeren en het skidagboek via de plug-in `@capacitor-community/keep-awake`.
- Locatie vraagt iOS zelf, met de tekst uit `ios/App/App/Info.plist` (`NSLocationWhenInUseUsageDescription`).
- De link "Alle skigebieden op de website" opent de website in Safari.
- Bekeken satelliettegels worden in de app niet extra bewaard (daar draait geen service worker);
  de app zelf en de pistedata werken wel volledig offline.
- Alleen voor iPhone (op een iPad draait hij als iPhone-app). Dan zijn er ook geen iPad-schermafbeeldingen nodig.

## Mappen en bestanden

| Wat | Waar |
|---|---|
| Instellingen (app-ID `nl.skipilot.app`, naam) | `capacitor.config.json` |
| Xcode-project | `ios/App/` |
| Webbestanden kopiëren naar de app | `tools/build_www.mjs` (`npm run ios` doet dit en `cap sync`) |
| Icoon en opstartscherm | `python tools/make_icons.py` maakt ze opnieuw |
| Versienummer (1.0) | `MARKETING_VERSION` in `ios/App/App.xcodeproj/project.pbxproj`; het bouwnummer telt GitHub zelf op |

## Stappen

### 1. Apple Developer-account
Meld je aan bij het [Apple Developer Program](https://developer.apple.com/programs/) (€ 99 per jaar).
Noteer je **Team ID** (Membership details).

### 2. App aanmaken in App Store Connect
In [App Store Connect](https://appstoreconnect.apple.com) → Apps → **+** → Nieuwe app:
- Platform iOS, naam **Skipilot**, hoofdtaal Nederlands
- Bundle ID: `nl.skipilot.app` (eerst registreren onder Certificates, Identifiers & Profiles → Identifiers, als hij nog niet in de lijst staat)
- SKU: bijvoorbeeld `skipilot`

### 3. API-sleutel voor GitHub
App Store Connect → Gebruikers en toegang → **Integraties** → App Store Connect API → sleutel maken met rol **Admin**
(Admin is nodig zodat GitHub zelf de certificaten en profielen kan maken).
Download het `.p8`-bestand (kan maar één keer) en noteer de **Key ID** en de **Issuer ID**.

### 4. Geheimen in GitHub
Repository → Settings → Secrets and variables → Actions → *New repository secret*:

| Naam | Inhoud |
|---|---|
| `APPLE_TEAM_ID` | je Team ID |
| `ASC_KEY_ID` | Key ID van de API-sleutel |
| `ASC_ISSUER_ID` | Issuer ID |
| `ASC_KEY_P8` | de hele inhoud van het `.p8`-bestand (open het in Kladblok en kopieer alles, inclusief de BEGIN- en END-regel) |

### 5. Bouwen en uploaden
GitHub → Actions → **iOS-app** → *Run workflow* → vink **Naar TestFlight** aan → Run.
Na 10 à 20 minuten staat de bouw in App Store Connect onder **TestFlight**.
Installeer de app **TestFlight** op je iPhone, voeg jezelf toe als interne tester en probeer de app uit (vooral GPS en navigatie op de piste).

Zonder het vinkje maakt de workflow alleen een proefbouw voor de simulator; dat gebeurt ook vanzelf bij elke wijziging aan de app.

### 6. Winkelpagina en beoordeling
- **Teksten**: uit `store/listing-nl.md` en `store/listing-en.md` (Apple kent ook een *ondertitel* van max. 30 tekens en *trefwoorden* van max. 100 tekens).
- **Schermafbeeldingen**: Apple wil iPhone 6,9" (1320 × 2868) of 6,5" (1284 × 2778). De Play-afbeeldingen (1080 × 1920) passen niet;
  maak ze in de iOS-simulator, op een iPhone, of pas `promo/shots.mjs` aan naar dat formaat.
- **Categorie**: Navigatie (tweede: Sport). **Leeftijd**: vul de vragenlijst in.
- **Privacybeleid-URL**: `https://thomdewit05-design.github.io/Pistenplanner/privacy.html`. **Support-URL**: de website.
- **App-privacy** (controleer dit zelf): *Precieze locatie* en *Naam* worden alleen verzameld als je een groep gebruikt
  (gedeeld met je groepsgenoten via ntfy.sh), niet gekoppeld aan je identiteit, niet voor tracking.
  Locatie voor navigatie en het skidagboek blijft op de telefoon.
- **Encryptie**: al ingevuld in de app (`ITSAppUsesNonExemptEncryption = false`, alleen https).
- Kies de bouw uit TestFlight bij de versie en klik **Ter beoordeling indienen**.

Tip voor de beoordeling: Apple weigert apps die "alleen een website" zijn. Leg in de opmerking voor de beoordelaar uit
dat de app offline werkt met de ingebouwde pistedata van 1.800+ skigebieden, GPS-navigatie met gesproken aanwijzingen
en een skidagboek heeft, en dat de kaart werkt zonder account.

## Skipilot Pro als In-App Purchase

In de iOS-app koop je Pro met je Apple ID: eenmalig, voor altijd, op al je iPhones.
Apple int het geld, regelt btw en terugbetalingen en houdt 15 % in (met het *App Store Small Business Program*, anders 30 %).
De code zit in `ios/App/App/StorePlugin.swift` (StoreKit 2) en het Pro-gedeelte van `app.js`.
De app controleert bij elke start bij de App Store of je Pro hebt; dat werkt ook zonder internet, en een terugbetaalde aankoop zet Pro weer uit.
Een licentiecode van de website werkt in de iOS-app niet (Apple staat dat niet toe voor aankopen buiten de App Store).

### Instellen
1. **Betaalde apps-overeenkomst**: App Store Connect → Zakelijk → onderteken de *Paid Apps Agreement* en vul bankrekening en belastinggegevens in.
   Zonder dit verschijnt het product niet in de app.
2. Meld je aan voor het [App Store Small Business Program](https://developer.apple.com/app-store/small-business-program/) (15 % in plaats van 30 %).
3. App Store Connect → je app → **In-App Purchases** → **+**:
   - Type: **Niet-verbruikbaar** (Non-Consumable)
   - Referentienaam: `Skipilot Pro`, Product-ID: `nl.skipilot.app.pro` (moet gelijk zijn aan `pro.ios.productId` in `config.js`)
   - Prijs: kies een prijsniveau (bijvoorbeeld € 9,99). De app toont de prijs uit de App Store, in de valuta van de koper.
   - Weergavenaam en beschrijving in het Nederlands, Engels en Duits, bijvoorbeeld "Skipilot Pro" en
     "Groepen, lunchstop, zon en schaduw, terug naar je hotel, seizoensoverzicht en GPX-export."
   - Schermafbeelding voor de beoordeling: het Pro-scherm uit de app.
4. Zet in `config.js` bij `pro.ios` **`enforce: true`**, en bouw een nieuwe versie (Actions → iOS-app → Run workflow met TestFlight).
   Zolang het `false` is, is alles in de iOS-app gratis, zoals nu.
5. Kies bij het indienen van de app-versie onder *In-App Purchases* het product **Skipilot Pro**, zodat Apple ze samen beoordeelt.
   De eerste In-App Purchase moet altijd samen met een app-versie ingediend worden.

### Testen
- Maak in App Store Connect → Gebruikers en toegang → **Sandbox** een testaccount aan (een e-mailadres dat nog geen Apple ID is).
- Installeer de app via TestFlight en koop Pro: in TestFlight betaal je nooit echt.
- Probeer ook **Aankopen herstellen** (Apple eist die knop) en kijk of Pro na het opnieuw installeren terugkomt.

## Lokaal werken op een Mac (optioneel)
```
npm install
npm run ios
npx cap open ios
```
Kies in Xcode bij *Signing & Capabilities* je team en druk op ▶.
