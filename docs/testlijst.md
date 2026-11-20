# Testlijst Skipilot 1.1 (TestFlight)

Loop dit door op een echte iPhone, en waar het kan op een Android-telefoon.

- Een deel test je thuis.
- Een deel test je alleen op de piste. Die punten hebben het teken ⛷.
- Vink af wat werkt. Schrijf bij ✗ op wat je zag, met een screenshot als dat kan.

## 1. Eerste start en downloaden
- [ ] **Na het installeren**
  - Doen: de app openen.
  - Verwacht: het opstartscherm, daarna de rondleiding en dan de gebiedenlijst.
- [ ] **Gebied downloaden**
  - Doen: een gebied kiezen.
  - Verwacht: het downloadscherm met de grootte, bijvoorbeeld "ca. 24 MB". Na het tikken loopt de voortgangsbalk en daarna opent de kaart.
- [ ] **Opnieuw openen**
  - Doen: hetzelfde gebied nog eens kiezen.
  - Verwacht: geen downloadscherm.
- [ ] **Vliegtuigmodus, gedownload gebied**
  - Doen: de app volledig sluiten en weer openen.
  - Verwacht: de kaart, de winterkaart, 3D, routes en navigatie werken.
- [ ] **Vliegtuigmodus, niet-gedownload gebied**
  - Doen: een ander gebied kiezen.
  - Verwacht: de melding "Je bent offline…" met de lijst van gedownloade gebieden.
- [ ] **Download onderbreken**
  - Doen: halverwege het downloaden de wifi uitzetten.
  - Verwacht: "Opnieuw proberen". Na weer aanzetten gaat de download verder.

## 2. Route en navigatie
- [ ] **Beginnerniveau**
  - Doen: niveau beginner, route van het dal naar de top.
  - Verwacht: alleen groen en blauw. Is er geen andere weg, dan staat er een duidelijke melding "Boven je niveau".
- [ ] **Gesloten lift**
  - Doen: een lift op de route op "dicht" zetten.
  - Verwacht: de route gaat eromheen.
- [ ] **Gezinsmodus**
  - Doen: de gezinsmodus aanzetten.
  - Verwacht: alleen groen en blauw.
- [ ] ⛷ **Navigatie starten**
  - Verwacht: gesproken aanwijzingen op het juiste moment, en de stip volgt je.
- [ ] ⛷ **Afwijken van de route**
  - Verwacht: de route wordt binnen een paar seconden opnieuw berekend.
- [ ] ⛷ **Lockscreen tijdens het navigeren**
  - Verwacht: de Live Activity en het Dynamic Island tonen de volgende stap.

## 3. Skidag (alles ⛷)
- [ ] **Skidag starten**
  - Verwacht: de Live Activity met km, hoogtemeters en snelheid.
- [ ] **Hele dag laten lopen**
  - Doen: het accupercentage noteren om 9:00, 12:00 en 16:00.
- [ ] **Sprongen** (beta)
  - Doen: een paar sprongen maken, en kijken of er vals alarm komt in de stoeltjeslift of bij een val.
- [ ] **Dagboek na afloop**
  - Verwacht: de juiste afstand, het aantal afdalingen en de topsnelheid.
- [ ] **Apple Gezondheid** (als dat aan staat)
  - Verwacht: de training staat in de Gezondheid-app, met calorieën die passen bij het ingevulde gewicht.
- [ ] **Dagkaart en Wrapped delen**
  - Verwacht: het beeld klopt en het delen werkt.

## 4. Groep (twee telefoons, allebei met versie 1.1)
- [ ] **Groep maken en meedoen**
  - Doen: op telefoon A een groep maken, op telefoon B meedoen met de code.
- [ ] **Positie delen**
  - Verwacht: B ziet A binnen ongeveer 1 tot 2 minuten op de kaart.
- [ ] **Bericht of ontmoetpunt**
  - Verwacht: het komt aan op de andere telefoon.
- [ ] **Oude versie**
  - Doen: een telefoon met 1.0.x doet mee.
  - Verwacht: die ziet de groep niet. Dit is bekend, omdat de versleuteling nieuw is.

## 5. Batterij sparen
- [ ] **Handmatig aanzetten**
  - Doen: Menu, Batterij sparen aan, dan 3D openen.
  - Verwacht: geen bewegende cabines en geen sneeuw.
- [ ] **Automatisch**
  - Doen: de accu onder 20% laten zakken (niet aan de lader).
  - Verwacht: binnen 5 minuten één keer de melding "Batterij …%: batterij sparen staat aan". De energiebesparingsmodus van iOS alleen zet het niet aan.

## 6. Widgets, Siri en Watch
- [ ] **Widgets**
  - Doen: een widget op het beginscherm en op het toegangsscherm zetten.
  - Verwacht: het gebied en het weer kloppen. Tikken opent het juiste scherm.
- [ ] **Siri**
  - Doen: "Start skidag in Skipilot" en "Hoeveel kilometer heb ik vandaag geskied".
- [ ] **Apple Watch**
  - Doen: de app op de Watch openen tijdens een skidag.
  - Verwacht: km, hoogtemeters en de volgende routestap.

## 7. Meldingen en achtergrond
- [ ] **Poederalarm**
  - Doen: het poederalarm aanzetten en de app een nacht dicht laten.
  - Verwacht: een melding bij verse sneeuw. Die kan uitblijven als er geen sneeuw viel.
- [ ] **Melding openen**
  - Verwacht: tikken op een melding opent het juiste gebied en scherm.

## 8. Pro en advertenties
- [ ] **Advertenties**
  - Verwacht: alleen in de kiezer, het dagboek en het menu, nooit tijdens het navigeren.
- [ ] **Pro kopen**
  - Doen: Pro kopen in de sandbox van TestFlight.
  - Verwacht: de advertenties verdwijnen en de Pro-functies werken.
- [ ] **Aankoop herstellen**
  - Doen: de app verwijderen, opnieuw installeren en "Aankoop herstellen" kiezen.
  - Verwacht: Pro is terug.

## 9. Talen en weergave
- [ ] **Taal wisselen**
  - Doen: de taal op Engels en Duits zetten.
  - Verwacht: geen Nederlandse resten, en de tekst past in de knoppen.
- [ ] **Donker thema en grote tekst**
  - Doen: het donkere thema aanzetten en in iOS de grote tekst.
  - Verwacht: alles leesbaar, niets valt weg.
- [ ] **VoiceOver**
  - Verwacht: knoppen hebben een zinnig label.

## iPad (één keer voor het indienen)
De app is nu ook voor de iPad gebouwd. Dit kan ik niet zelf proberen; loop het na op een iPad via TestFlight.

- [ ] De app start schermvullend, staand en liggend, en draait mee als je de iPad kantelt.
- [ ] Liggend: het paneel en de tabbalk staan links, de kaart vult de rest; niets valt achter de camera of de ronde hoeken.
- [ ] Staand: Vandaag, Plannen, Groep en Ik staan in een kolom in het midden, niet uitgerekt.
- [ ] Een skigebied downloaden, een route plannen en "Start navigatie" werken; de kaart in 3D blijft soepel.
- [ ] Het toetsenbord dekt het zoekveld en de naamvelden niet af.
- [ ] Foto toevoegen opent de camera.
- [ ] De widgets staan in de lijst met widgets op de iPad.
- [ ] Zonder gps (iPad met alleen wifi): de app meldt dat er geen gps-ontvangst is en loopt niet vast.


## Apple Watch: trilsignalen en bedienen (⛷ = op de berg)

Nodig: een iPhone met de TestFlight-versie en een gekoppelde Apple Watch waarop Skipilot staat. Dit kan niet in een simulator; alleen jij kunt het voelen.

**Thuis, de code leren**
- [ ] Ik → Instellingen → Apple Watch: tik op *Links*, *Rechts*, *Lift* en *Van de route af*. De Watch trilt en toont een groot scherm met dezelfde betekenis.
- [ ] Links (tik-tik … tik-tik) en rechts (tik-tik-tik) zijn met je ogen dicht uit elkaar te houden. Ook door een jas of handschoen heen?
- [ ] Op de Watch: Bedienen → Trilsignalen. Elke knop geeft hetzelfde signaal als de knop op de iPhone.
- [ ] Sluit Skipilot op de Watch en tik op de iPhone op een oefenknop: er staat dat de Watch niet bereikbaar is.
- [ ] Zet *Sterker* aan: elk signaal komt twee keer. Zet *Vooraankondiging* uit: bij het navigeren komt alleen het signaal bij de afslag.

**Bedienen vanaf je pols** (iPhone-app open of op de achtergrond)
- [ ] Start een route op de iPhone. Op de Watch: de afslag, daaronder "Daarna" met de volgende stappen, de aankomsttijd en de afstand.
- [ ] Watch → Bedienen → *Stop navigatie*: de iPhone stopt met navigeren.
- [ ] Watch → *Naar het dal*: de iPhone plant de route naar het dal en begint te navigeren.
- [ ] Watch → *Start opname* en daarna *Stop opname*: de skidag op de iPhone start en stopt.
- [ ] iPhone-app helemaal afgesloten: de Watch meldt "iPhone niet bereikbaar" in plaats van te doen alsof het gelukt is.

**⛷ Op de piste**
- [ ] De vooraankondiging komt vroeg genoeg om nog te kunnen kiezen (ongeveer 150 m, bij hard skiën eerder).
- [ ] Het signaal bij de afslag klopt met de werkelijke richting: links voelt als links.
- [ ] Sla bewust verkeerd af: één keer de "van de route af"-trilling, niet steeds opnieuw; het scherm kleurt rood.
- [ ] Bij het dalstation van een lift: de oplopende trilling. Op je bestemming: de "gelukt"-trilling.
- [ ] **Arm naar beneden, scherm uit**: komen de signalen dan nog door? In deze versie waarschijnlijk niet altijd; schrijf op wanneer wel en wanneer niet. De volgende stap (trainingssessie op de Watch) moet dit oplossen.
- [ ] Schrijf op welke tussenpozen niet prettig voelen (te snel, te zwak, te veel op elkaar lijkend); die stel ik daarna bij.
