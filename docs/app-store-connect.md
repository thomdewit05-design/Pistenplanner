# App Store Connect bijwerken voor versie 1.1

Dit moet jij zelf aanpassen in App Store Connect voordat je 1.1 ter beoordeling indient.

## 1. App-privacy (privacylabels)
In App Store Connect vind je dit onder je app → **App-privacy** → Bewerken. Daar komen een paar gegevenstypen bij.

| Gegevenstype | Verzameld? | Gekoppeld aan jou? | Volgen? | Waarom |
|---|---|---|---|---|
| **Precieze locatie** | Ja, alleen bij groepen | Nee | Nee | Appfunctionaliteit: je positie gaat versleuteld naar je groepsgenoten |
| **Gezondheid en fitness** | Nee | – | – | Wordt alleen *naar* Apple Gezondheid geschreven en verlaat de telefoon niet. Dat telt bij Apple niet als "verzamelen". |
| **Foto's** | Nee | – | – | Blijven op de telefoon |
| **Advertentiegegevens, apparaat-ID, gebruiksgegevens** | Ja (AdMob) | zoals nu | zoals nu | Laat dit staan zoals je het voor AdMob had ingevuld |
| **Aankopen** | zoals nu | | | |

Twijfel je bij locatie? Apple telt het als verzamelen als gegevens de telefoon verlaten, ook als ze versleuteld zijn. Vul dus **"Precieze locatie: ja, appfunctionaliteit, niet gekoppeld, niet volgen"** in.

## 2. Beoordelingsnotities (App Review Information → Notes)
Plak dit erin. Apple is streng bij HealthKit, en zonder uitleg volgt vaak een afwijzing.

> Skipilot is a ski map and navigation app. HealthKit is used only to **write** a finished ski day as a workout (start/end time, distance, estimated active energy) when the user turns on "Save to Apple Health" in Menu → Notifications & Health. The app never reads health data and never sends it off the device or uses it for advertising.
> Location is used for navigation and the ski diary. Only when the user joins a group and enables position sharing is the position sent, end-to-end encrypted (AES-GCM, key derived from the group code), via ntfy.sh to group members.
> Ski areas must be downloaded once before use so the map works without mobile signal. To test: pick "Ski Arlberg", tap Download (about 25 MB).
> Motion sensor: used during a recorded ski day to detect jumps (on device only).

## 3. Wat er nieuw is in deze versie
Dit is de tekst voor "Wat is er nieuw". Vertalingen kun je per taal toevoegen.

> Skipilot 1.1
> • Download je skigebied: de winterkaart, 3D en navigatie werken nu ook zonder bereik
> • Groepen zijn versleuteld
> • Batterij sparen, automatisch onder 20%
> • Opslaan in Apple Gezondheid, Apple Watch-app, nieuwe widgets en Siri-opdrachten
> • Steilheidskaart, zon en schaduw, heatmap van je sporen, reisplanner en nog veel meer

## 4. Screenshots
- **Apple Watch:** voor een app met een Watch-onderdeel zijn screenshots van de Watch verplicht. Gebruik 410×502 (Series 10/11, 46 mm) of een van de andere toegestane maten. Maak ze in de simulator met Xcode, of op je eigen Watch: tegelijk op de zijknop en de Digital Crown drukken. De foto staat dan in Foto's op je iPhone.
- **iPhone:** nieuwe screenshots zijn niet verplicht, maar het downloadscherm, 3D en de steilheidskaart zijn goede nieuwe beelden.

## 5. Privacyverklaring
De privacyverklaring op de website (`privacy.html`) is bijgewerkt met Apple Gezondheid, foto's, de bewegingssensor, de versleutelde groep, sneeuwberichten en gedownloade gebieden. Controleer dat de link in App Store Connect naar die pagina wijst.

## 6. Exportnaleving (versleuteling)
TestFlight en App Store Connect vragen of de app versleuteling gebruikt.
Dat is al geregeld: `Info.plist` heeft `ITSAppUsesNonExemptEncryption = false`. De groepsversleuteling gebruikt alleen de standaard WebCrypto van het besturingssysteem, en dat valt onder de vrijstelling. Je krijgt de vraag dus niet meer.
