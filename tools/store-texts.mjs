// Leest de App Store-teksten per taal (store/ios/teksten/<taal>.md), controleert Apples limieten
// en schrijft het invulbestand voor App Store Connect: store/ios/app-store-connect-invullen.md.
//   node tools/store-texts.mjs          schrijft het invulbestand
//   node tools/store-texts.mjs --check  schrijft niets; faalt bij een te lange tekst, een ontbrekende taal of een verouderd invulbestand
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const ROOT = new URL("..", import.meta.url).pathname, CHECK = process.argv.includes("--check");
const read = p => readFileSync(ROOT + p, "utf8");
const LANGS = [["nl", "Nederlands", "Dutch"], ["en", "Engels", "English (U.S.)"], ["de", "Duits", "German"], ["fr", "Frans", "French"], ["it", "Italiaans", "Italian"],
  ["es", "Spaans", "Spanish (Spain)"], ["pt", "Portugees", "Portuguese (Brazil)"], ["ru", "Russisch", "Russian"], ["zh", "Chinees", "Chinese (Simplified)"], ["ja", "Japans", "Japanese"]];
const FIELDS = [["Naam", 30, "Name"], ["Ondertitel", 30, "Subtitle"], ["Promotietekst", 170, "Promotional Text"], ["Trefwoorden", 100, "Keywords"], ["Beschrijving", 4000, "Description"], ["Wat is er nieuw", 4000, "What's New in This Version"]];
const page = (kind, l) => l === "nl" ? {privacy:"privacy.html", terms:"voorwaarden.html", support:"support.html"}[kind] : `${kind}-${l}.html`;
const cfg = read("config.js"), site = /site:\s*"([^"]+)"/.exec(cfg)[1], owner = /name:\s*"([^"]+)"/.exec(cfg)[1], email = /email:\s*"([^"]+)"/.exec(cfg)[1];
const bundle = JSON.parse(read("capacitor.config.json")).appId, version = /MARKETING_VERSION = ([\d.]+);/.exec(read("ios/App/App.xcodeproj/project.pbxproj"))[1];
const notes = read("store/ios/review-notes.txt").trim();
const len = s => [...s].length;   // Apple telt tekens, geen bytes

const problems = [], texts = {};
for(const [l] of LANGS){
  const f = `store/ios/teksten/${l}.md`;
  if(!existsSync(ROOT + f)){ problems.push(`${f} ontbreekt`); continue; }
  const src = read(f), T = texts[l] = {};
  for(const [name, max] of FIELDS){
    const m = new RegExp(`(?:^|\\n)## ${name}[^\\n]*\\n([\\s\\S]*?)(?=\\n## |$)`).exec(src);   // zonder "m": $ is het einde van het bestand, niet van de regel
    if(!m || !m[1].trim()){ problems.push(`${f}: blok "${name}" ontbreekt`); continue; }
    T[name] = m[1].trim();
    if(name === "Beschrijving" && len(T[name]) < 800) problems.push(`${f}: de beschrijving is maar ${len(T[name])} tekens; het blok is niet heel ingelezen of de tekst is te kort`);
    if(len(T[name]) > max) problems.push(`${f}: ${name} is ${len(T[name])} tekens, Apple staat er ${max} toe`);
  }
  if(T.Naam && !T.Naam.startsWith("Skipilot")) problems.push(`${f}: de naam begint niet met "Skipilot"`);
  if(T.Trefwoorden && /,\s/.test(T.Trefwoorden)) problems.push(`${f}: trefwoorden hebben een spatie na een komma (dat kost tekens)`);
  for(const n of [1, 2, 3]) if(!existsSync(`${ROOT}store/screenshots/1290x2796/${l}-${n}.jpg`)) problems.push(`schermafbeelding store/screenshots/1290x2796/${l}-${n}.jpg ontbreekt`);
  for(const k of ["privacy", "support"]) if(!existsSync(ROOT + page(k, l))) problems.push(`pagina ${page(k, l)} ontbreekt (draai node tools/legal.mjs)`);
}
if(len(notes) > 4000) problems.push(`store/ios/review-notes.txt is ${len(notes)} tekens, Apple staat er 4000 toe`);

// schermafbeeldingen van de Apple Watch (gemaakt door .github/workflows/watch-shots.yml)
const WATCH = ["1-nav.png", "2-day.png", "3-wx.png", "4-group.png", "5-sos.png"].filter(f => existsSync(`${ROOT}store/screenshots/watch/${f}`));
const block = t => "```text\n" + t + "\n```";
const perLang = LANGS.filter(([l]) => texts[l]).map(([l, nl, apple]) => { const T = texts[l];
  return `### ${nl} — in App Store Connect: **${apple}**

${FIELDS.map(([name, max, appleName]) => `**${appleName}** (${name}; ${len(T[name] || "")} van ${max} tekens)\n\n${block(T[name] || "")}`).join("\n\n")}

**Support URL**: \`${site}${page("support", l)}\`
**Marketing URL**: \`${site}\`
**Privacy Policy URL** (staat onder App Privacy, per taal): \`${site}${page("privacy", l)}\`

**Schermafbeeldingen**, vak *iPhone 6.9" Display*, in deze volgorde:
1. \`store/screenshots/1290x2796/${l}-1.jpg\`
2. \`store/screenshots/1290x2796/${l}-2.jpg\`
3. \`store/screenshots/1290x2796/${l}-3.jpg\``; }).join("\n\n---\n\n");

const out = `# App Store Connect invullen: Skipilot ${version}

Dit bestand is gemaakt door \`tools/store-texts.mjs\`. Pas het niet met de hand aan: verander de bron (\`store/ios/teksten/\`, \`store/ios/review-notes.txt\`) en draai het script opnieuw.

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
| Bundle ID | \`${bundle}\` |
| Versie | \`${version}\` |
| Primaire taal (Primary Language) | Dutch |
| Categorie (Primary Category) | Navigation |
| Tweede categorie (Secondary Category) | Sports |
| Content Rights | De app bevat inhoud van derden (kaartgegevens van OpenStreetMap en OpenSkiMap, weer van MET Norway) en heeft het recht die te gebruiken: kies **Yes** bij beide vragen |
| Copyright | \`${new Date().getFullYear()} ${owner}\` |

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

**Privacy Policy URL**: \`${site}privacy.html\` (per taal staat het adres in hoofdstuk 6).

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
- Uitleg van Google over wat AdMob verzamelt: \`https://developers.google.com/admob/ios/privacy/data-disclosure\`.
- **Niet** invullen: Health & Fitness (de app schrijft alleen naar Apple Gezondheid, op de telefoon zelf), Photos (blijven op de telefoon), Purchases (er zijn geen aankopen).

## 5. Gegevens voor de keurder (App Review Information)

| Veld | Waarde |
|---|---|
| Sign-in required | **No** (uitvinken): de app heeft geen account |
| First name / Last name | \`${owner}\` |
| Email | \`${email}\` |
| Phone | **vult Thom in** |
| Attachment | geen |

**Notes** (${len(notes)} van 4000 tekens), in zijn geheel plakken:

${block(notes)}

## 6. Teksten en afbeeldingen per taal

Voeg onder de versie deze tien talen toe (linksboven bij de taalkeuze, "Add Language") en vul per taal de velden in. De namen tussen haakjes zijn de Nederlandse namen van de velden.

App Store Connect kent twee soorten Portugees en Chinees. De app heeft er van elk één: kies **Portuguese (Brazil)** en **Chinese (Simplified)**, want de app zelf is in Braziliaans Portugees en vereenvoudigd Chinees geschreven. Apple toont die pagina ook aan gebruikers in Portugal.

De **Name** en **Subtitle** staan onder "App Information" (per taal); de overige velden onder de versie.

${perLang}

---

### Apple Watch

${WATCH.length === 5 ? `Apple vraagt ook schermafbeeldingen van de Watch-app. Zet deze vijf, in deze volgorde, onder het tabblad **Apple Watch** bij de primaire taal (Dutch), in het vak *Apple Watch Series 10 / 11 (46mm)* (416×496). Ze gelden dan voor alle talen.

1. \`store/screenshots/watch/1-nav.png\` (de volgende afslag)
2. \`store/screenshots/watch/2-day.png\` (je skidag)
3. \`store/screenshots/watch/3-wx.png\` (weer en lifttijden)
4. \`store/screenshots/watch/4-group.png\` (je groep)
5. \`store/screenshots/watch/5-sos.png\` (de noodknop met je locatie)` : "De schermafbeeldingen van de Watch ontbreken nog; zie hoofdstuk 8."}

## 7. De versie afmaken

| Veld | Waarde |
|---|---|
| Build | De nieuwste build van versie ${version} uit TestFlight |
| Export Compliance | Niets te kiezen: de app meldt zelf dat hij alleen standaardversleuteling gebruikt (\`ITSAppUsesNonExemptEncryption = false\`). Komt de vraag toch: "None of the algorithms mentioned above" |
| Advertising Identifier (IDFA) | **Yes**, voor het tonen van advertenties ("Serve advertisements within the app") |
| Version Release | Handmatig vrijgeven ("Manually release this version") |
| Phased Release | Uit |

## 8. Dit kan alleen Thom

- Het **telefoonnummer** bij de gegevens voor de keurder.
${WATCH.length === 5 ? "" : "- **Schermafbeeldingen van de Apple Watch** (bijvoorbeeld 410×502): Apple vraagt ze omdat de app een Watch-onderdeel heeft. Maak ze op je eigen Watch (zijknop en Digital Crown tegelijk) of start de bouwstap \"Watch-schermafbeeldingen\" op GitHub.\n"}- **Schermafbeeldingen van de iPad**: de app werkt ook op de iPad, dus Apple vraagt ze in het vak *iPad 13" Display* (2064×2752 staand of 2752×2064 liggend), minstens één. Maak ze op je eigen iPad (bovenste knop en volumeknop tegelijk) en zet ze bij de primaire taal; ze gelden dan voor alle talen. Proberen kan ook met \`DEVICE=ipad node tools/store-shots.mjs\`, maar de 3D-beelden laden daar niet betrouwbaar.
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
`;
const target = "store/ios/app-store-connect-invullen.md";
if(CHECK && !problems.length && (!existsSync(ROOT + target) || read(target) !== out)) problems.push(`${target} is verouderd; draai node tools/store-texts.mjs`);
if(problems.length){ console.log(problems.join("\n") + `\n\n${problems.length} problemen.`); process.exit(1); }
if(!CHECK) writeFileSync(ROOT + target, out);
console.log(CHECK ? `Winkelteksten in orde (${Object.keys(texts).length} talen).` : `${target} geschreven (${Object.keys(texts).length} talen).`);
