"""Haalt hutten, restaurants, cafés en bars op uit OpenStreetMap (Overpass) rond de skigebieden.
Gebruik: python tools/fetch_huts.py <osm-dir>   (schrijft <osm-dir>/amenities.json; hervat waar hij gebleven was)"""
import json, os, sys, time, math, urllib.request, urllib.parse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from regions import region_of

SRC = "\\\\?\\" + os.path.abspath(sys.argv[1])
OUT = os.path.join(SRC, "amenities.json")
URL = "https://overpass-api.de/api/interpreter"
STEP = 1.0   # tegels van 1 x 1 graad

tiles = {}   # tegel -> regio (eerst de Alpen ophalen)
ORDER = {"alpen":0, "pyreneeen":1, "scandinavie":2, "noord-amerika":3}
with open(os.path.join(SRC, "ski_areas.geojson"), encoding="utf-8") as f:
    for line in f:
        line = line.strip().rstrip(",")
        if not (line.startswith('{"type":"Feature"') or line.startswith('{"properties"')): continue
        ft = json.loads(line); p = ft["properties"]
        if "downhill" not in (p.get("activities") or []) or p.get("status") not in ("operating", None): continue
        g = ft["geometry"]
        if g["type"] == "Point": x, y = g["coordinates"][:2]
        else:
            c = (p.get("viewportHint") or {}).get("center")
            if not c: continue
            x, y = c
        cc = ((p.get("places") or [{}])[0] or {}).get("iso3166_1Alpha2")
        reg = region_of(x, y, cc)
        if not reg: continue
        # de tegel van het midden, plus een buurtegel als het gebied vlak bij de rand ligt
        for dx in (-0.06, 0, 0.06):
            for dy in (-0.05, 0, 0.05):
                t = (math.floor((x + dx)/STEP), math.floor((y + dy)/STEP))
                tiles[t] = min(tiles.get(t, 9), ORDER[reg])
tiles = sorted(tiles, key=lambda t: (tiles[t], t))
print(len(tiles), "tegels", flush=True)

done = {}
if os.path.exists(OUT):
    done = json.load(open(OUT, encoding="utf-8"))
Q = """[out:json][timeout:180];
(nwr["amenity"~"^(restaurant|cafe|bar|pub|fast_food|biergarten)$"]({s},{w},{n},{e});
 nwr["tourism"="alpine_hut"]({s},{w},{n},{e}););
out center tags;"""
for i, (tx, ty) in enumerate(tiles):
    key = f"{tx},{ty}"
    if key in done: continue
    q = Q.format(s=ty*STEP, w=tx*STEP, n=(ty+1)*STEP, e=(tx+1)*STEP)
    for attempt in range(6):
        try:
            req = urllib.request.Request(URL, data=urllib.parse.urlencode({"data": q}).encode(),
                                         headers={"User-Agent": "Pistenplanner/1.0 (hobbyproject; github.com/thomdewit05-design/Pistenplanner)"})
            res = json.load(urllib.request.urlopen(req, timeout=200))
            out = []
            for el in res.get("elements", []):
                t = el.get("tags", {}); c = el.get("center") or el
                if "lat" not in c: continue
                kind = "h" if t.get("tourism") == "alpine_hut" else {"restaurant":"r", "cafe":"c", "bar":"b", "pub":"b", "biergarten":"b", "fast_food":"f"}.get(t.get("amenity"), "r")
                out.append([round(c["lon"], 5), round(c["lat"], 5), kind, (t.get("name") or "")[:60], t.get("ele") or ""])
            done[key] = out
            break
        except Exception as ex:
            wait = 15 * (attempt + 1)
            print(f"tegel {key}: {ex}; opnieuw over {wait}s", flush=True)
            time.sleep(wait)
    else:
        print(f"tegel {key} overgeslagen", flush=True)
    if (i + 1) % 10 == 0 or i == len(tiles) - 1:
        json.dump(done, open(OUT, "w", encoding="utf-8"))
        print(f"{i+1}/{len(tiles)} tegels, {sum(len(v) for v in done.values())} plekken", flush=True)
    time.sleep(1.5)
json.dump(done, open(OUT, "w", encoding="utf-8"))
print("klaar", sum(len(v) for v in done.values()), "plekken", flush=True)
