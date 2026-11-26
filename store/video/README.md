# Promovideo

`skipilot-promo-en.mp4` en `skipilot-promo-nl.mp4`: 1080×1920, 30 s, 30 beelden per seconde, zonder geluid. Met de echte schermen van de app. De TikTok-versie bestaat ook in beide talen (`skipilot-promo-tiktok-en.mp4`, `-nl.mp4`). De teksten staan per taal bovenin de twee html-bestanden.

`skipilot-promo-tiktok-en.mp4`: de TikTok-versie, 22 s, met snelle sneden en grote ondertitels (`promo-tiktok.html`; maken met `PAGE=promo-tiktok node tools/promo-video.mjs en`). De ondertitels staan bovenin in `CAPS`.

- `promo.html`: de animatie. Teksten staan bovenin het script in `TEXT`, de tijden in `render`. Bekijken in de browser: `promo.html?play` (R = opnieuw, P = pauze).
- `shots/<taal>/`: de schermen van de app, vastgelegd met `node tools/promo-shots.mjs en` (heeft internet nodig voor de winterkaart en 3D).
- `shots/watch-<taal>/`: de Watch-schermen uit `store/screenshots/watch/<taal>/`.
- Video opnieuw maken: `node tools/promo-video.mjs en`. Losse beelden om na te kijken: `node tools/promo-video.mjs en --stills 5,12,24 <map>`.

Een andere taal: de schermen vastleggen in die taal, de Watch-schermen kopiëren, `TEXT` vertalen en de video maken met die taalcode.

## Voice-over

`skipilot-promo-tiktok-en-voice.wav` / `.mp3`: de Engelse stem bij de TikTok-versie, 22 s, elke zin op het begin van zijn scène. `skipilot-promo-tiktok-en-voiced.mp4` is de video met die stem eronder.

Opnieuw maken: `python3 tools/promo-voice.py <map met het stemmodel> [stem]`. Het model is Kokoro (`pip install kokoro-onnx soundfile`; `kokoro-v1.0.onnx` en `voices-v1.0.bin` van de releases van github.com/thewh1teagle/kokoro-onnx) en hoort niet in het project. De zinnen en hun tijden staan bovenin het script; "POV" en "Skipilot" zijn daar anders geschreven zodat ze goed worden uitgesproken.

## De Watch-truc

`skipilot-promo-watch-en.mp4`: 13 s, alleen de Apple Watch: links voelt anders dan rechts (`promo-watch.html`; maken met `PAGE=promo-watch node tools/promo-video.mjs en`). De schermen met de grote pijl (`shots/watch-en/left.png`, `right.png`) komen uit de simulator: de voorbeeldstand van de Watch-app kent de scènes `left` en `right`, en de bouwstap "Watch-schermafbeeldingen" legt ze vast. De tikpatronen in de animatie zijn die van de app (`Signal.pattern`).

## Een dag met Skipilot

`skipilot-promo-day-en.mp4`: 25 s, een skidag van 08:45 tot 17:15 met een klok die doortikt (`promo-day.html`; maken met `PAGE=promo-day node tools/promo-video.mjs en`). De tijden van de klok staan in `CLOCK`, de tikken op het scherm in `TAPSCR`. Het scherm met "Lifts close in 25 min" komt uit `node tools/promo-shots.mjs en closing`.

## Follow the line (getekend)

`skipilot-promo-line-en.mp4`: 20 s, een getekende animatie in één doorlopend shot (`promo-line.html`; maken met `PAGE=promo-line node tools/promo-video.mjs en`). Alles is met code getekend als SVG; alleen het pictogram is een bestand. De route staat bovenin als rijen punten (`A`, `LIFT`, `B`, `C`), het tempo in `dist(t)`, de camera en de inzoom in `render`.
