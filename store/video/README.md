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
