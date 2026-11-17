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
  - Doen: de iOS-energiebesparingsmodus aanzetten, of de accu onder 20% laten zakken.
  - Verwacht: binnen 5 minuten de melding "batterij sparen staat aan".

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
