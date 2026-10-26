# Promotievideo Skipiloot

Teaser van 30 seconden, staand (1080 x 1920), voor Reels, TikTok en Shorts.

1. Start de lokale server (`start.bat` of `python -m http.server 8766` in de projectmap).
2. `node promo/shots.mjs`: schermafbeeldingen van de app (Ischgl) in `promo/shots/`.
3. `node promo/make_video.mjs --stills`: voorbeeldbeelden in `promo/stills/` om de opmaak te controleren.
4. `node promo/make_video.mjs`: neemt de video op met Chrome.
5. `python promo/fix_mp4.py promo/skipiloot-teaser.mp4 promo/skipiloot-teaser-def.mp4`: maakt er een gewone MP4 van met de juiste lengte.

De animatie zelf staat in `video.html` (teksten, timing en volgorde van de scènes).
