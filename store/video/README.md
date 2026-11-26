# Promovideo

`skipilot-promo-en.mp4`: 1080×1920, 30 s, 30 beelden per seconde, zonder geluid. Met de echte schermen van de app.

- `promo.html`: de animatie. Teksten staan bovenin het script in `TEXT`, de tijden in `render`. Bekijken in de browser: `promo.html?play` (R = opnieuw, P = pauze).
- `shots/<taal>/`: de schermen van de app, vastgelegd met `node tools/promo-shots.mjs en` (heeft internet nodig voor de winterkaart en 3D).
- `shots/watch-<taal>/`: de Watch-schermen uit `store/screenshots/watch/<taal>/`.
- Video opnieuw maken: `node tools/promo-video.mjs en`. Losse beelden om na te kijken: `node tools/promo-video.mjs en --stills 5,12,24 <map>`.

Een andere taal: de schermen vastleggen in die taal, de Watch-schermen kopiëren, `TEXT` vertalen en de video maken met die taalcode.
