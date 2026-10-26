# Promotievideo Skipiloot

Teaser van 30 seconden (33 met voice-over), staand (1080 x 1920), voor Reels, TikTok en Shorts. In het Nederlands en Engels.

1. Start de lokale server (`start.bat` of `python -m http.server 8766` in de projectmap).
2. `node promo/shots.mjs`: schermafbeeldingen van de app (Ischgl) in `promo/shots/`.
3. `node promo/make_video.mjs --stills`: voorbeeldbeelden in `promo/stills/` om de opmaak te controleren.
4. Voice-over (optioneel): zet de zinnen met hun starttijd in `vo-en.txt`, en draai
   `powershell -File promo/voiceover.ps1 -Lang en -Rate 1` en daarna `python promo/vo_measure.py en` (meldt overlappende zinnen).
5. `node promo/make_video.mjs --lang=en --vo`: neemt de video op met Chrome (zonder `--vo` zonder geluid, zonder `--lang` in het Nederlands).
6. `python promo/fix_mp4.py promo/<naam>-raw.mp4 promo/<naam>.mp4`: maakt er een gewone MP4 van met de juiste lengte (beeld en geluid).

Schermafbeeldingen in een andere taal: `node promo/shots.mjs en`.

De animatie zelf staat in `video.html` (teksten, timing en volgorde van de scènes).
