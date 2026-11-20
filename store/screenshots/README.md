# App Store-screenshots (iPhone)

`1290x2796/<taal>-<1|2|3>.jpg`: drie per taal (nl, en, de, fr, it, es, pt, ru, zh, ja), voor het iPhone-vak van 6,9 inch in App Store Connect. Apple schaalt ze zelf naar de kleinere vakken.

1. Elke dag een nieuwe route (dagroute op de winterkaart)
2. De bergen in 3D
3. Navigatie zoals in de auto

Opnieuw maken: `node tools/store-shots.mjs` (alle talen) of `node tools/store-shots.mjs nl,en`. Het script legt de echte app vast en zet die met een kop in een telefoonframe. Het heeft internet nodig voor de hoogtegegevens.

De koppen staan in `captions.json`, de opmaak in `compose.html`.

**Apple Watch:** voor een app met een Watch-onderdeel vraagt Apple ook schermafbeeldingen van de Watch (bijvoorbeeld 410×502). Die maak je in de simulator of op je eigen Watch; dat kan dit script niet.
