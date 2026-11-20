# App Store Connect

Alles wat in App Store Connect ingevuld moet worden staat in één bestand: [`store/ios/app-store-connect-invullen.md`](../store/ios/app-store-connect-invullen.md). Het is geschreven als opdracht voor Cowork en per scherm geordend.

- De teksten per taal: `store/ios/teksten/<taal>.md` (tien talen).
- De notities voor de keurder: `store/ios/review-notes.txt`.
- De schermafbeeldingen: `store/screenshots/1290x2796/` (maken met `node tools/store-shots.mjs`).
- Privacy, voorwaarden en hulp in tien talen: bron in `store/legal/<taal>/`, pagina's maken met `node tools/legal.mjs`.

Na een wijziging in de teksten: `node tools/store-texts.mjs`. Dat controleert Apples limieten en schrijft het invulbestand opnieuw.
