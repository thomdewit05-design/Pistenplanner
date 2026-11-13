# Skipilot in de Google Play Store (Android-app)

De Android-app is, net als de iOS-app, gemaakt met **Capacitor**: dezelfde webapp, met de bestanden in de app zelf.
GitHub bouwt hem automatisch (`.github/workflows/android.yml`).

| | iOS-app | Android-app |
|---|---|---|
| Kaart, routes, 3D, navigatie | ✅ | ✅ |
| Gesproken navigatie | ✅ | ✅ (spraak van Android) |
| Scherm blijft aan tijdens navigeren | ✅ | ✅ |
| AdMob-advertenties | ✅ | ✅ (eigen app in AdMob) |
| Live Activity, widgets, Siri, Apple Watch | ✅ | – (bestaat niet op Android) |
| Skipilot Pro kopen | App Store | nog niet: alles is gratis tot er Google Play Billing is |

## 1. Google Play-ontwikkelaarsaccount
- Maak een account op [play.google.com/console](https://play.google.com/console): eenmalig $ 25, met identiteitscontrole.
- Nieuwe persoonlijke accounts moeten eerst een **gesloten test** doen: minstens 12 testers, 14 dagen lang. Daarna kun je *productietoegang* aanvragen.

## 2. Uploadsleutel (eenmalig)
1. GitHub > repo **Pistenplanner** > **Settings > Secrets and variables > Actions > New repository secret**:
   - Naam: `ANDROID_KEY_PASSWORD`
   - Waarde: een lang wachtwoord dat je zelf verzint (minstens 16 tekens). **Bewaar het ook in je wachtwoordbeheerder.**
2. **Actions > Android-app > Run workflow**, kies **sleutel**.
   GitHub maakt de uploadsleutel, versleutelt hem met dat wachtwoord en zet hem in de repo (`android/upload-key.p12.enc`).

Kwijt? Met *Play App Signing* (standaard) bewaart Google de echte sleutel; een nieuwe uploadsleutel kun je aanvragen in de Play Console.

## 3. Het .aab bouwen
**Actions > Android-app > Run workflow**, kies **playstore**. Na ongeveer 10 minuten staat onder *Artifacts* `Skipilot-playstore-aab`.
Pak de zip uit en upload `app-release.aab` in de Play Console (*Testen > Gesloten test > Nieuwe release*).
Het bouwnummer telt vanzelf op; het versienummer staat in `android/app/build.gradle` (`versionName`).

Zelf proberen op een Android-telefoon kan met **proef**: dat geeft een `.apk` (met proefadvertenties) om te installeren.

## 4. AdMob voor Android
1. AdMob > **Apps > App toevoegen > Android**. Is de app nog niet in de Play Store, kies dan "Nee" bij de vraag of hij al gepubliceerd is.
2. Maak twee advertentieblokken: **Banner** en **Interstitial** (schermvullend).
3. Zet de app-ID als geheim `ADMOB_ANDROID_APP_ID` (ziet eruit als `ca-app-pub-2889563354210788~1234567890`).
4. Stuur de twee advertentieblok-ID's door; die komen in `config.js` onder `ads.android`. Tot die tijd toont de app proefadvertenties.
5. app-ads.txt staat al op `https://thomdewit05-design.github.io/app-ads.txt`; vul in de Play Console bij **Website** `https://thomdewit05-design.github.io/Pistenplanner/` in.

## 5. Winkelvermelding in de Play Console
- **Teksten**: `store/listing-nl.md` (standaardtaal) en `store/listing-en.md`. **Afbeeldingen**: `store/nl/`, `store/en/`, `store/icon-512.png`.
- **Categorie**: Kaarten en navigatie. **Privacybeleid**: `https://thomdewit05-design.github.io/Pistenplanner/privacy.html`.
- **Bevat advertenties**: **Ja** (AdMob).
- **Doelgroep**: 13 jaar en ouder.
- **Gegevensveiligheid** (controleer zelf, jij bent verantwoordelijk voor de antwoorden):
  - *Locatie, precies*: verzameld, voor app-functionaliteit (alleen bij een groep; de navigatie zelf blijft op de telefoon).
  - *Locatie, bij benadering*, *Apparaat-ID's (advertentie-ID)*, *App-interacties*, *Crashlogs/diagnostiek*: verzameld en gedeeld door Google AdMob, voor advertenties en analyse.
  - *Naam* (in een groep): optioneel, voor app-functionaliteit.
  - Versleuteld verstuurd: ja. Gegevens laten verwijderen: er is geen account.
- **Advertentie-ID**: ja, de app gebruikt de advertentie-ID (AdMob).
