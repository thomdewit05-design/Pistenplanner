"""Haalt hutten, restaurants, cafés en bars rond alle skigebieden op uit OpenStreetMap (Overpass), en ook de voorzieningen:
skipaskassa's, skiverhuur, skidepots/kluisjes, skischolen en bushaltes. Schrijft ze naar data/h000.json ...
(zelfde indeling als de kaartbestanden s000.json ...). Per plek: [lon, lat, soort, naam, website].

Draait elke maand op de servers van GitHub (zie .github/workflows/huts.yml), zodat de app de hutten van de eigen site
haalt en niet afhangt van de vaak overbelaste Overpass-servers. Een stuk kaart dat niet lukt, houdt de vorige gegevens.
Gebruik: python tools/update_huts.py [--shard N] [--budget MINUTEN]
  --shard N       alleen de gebieden van kaartbestand N (de workflow draait elk kaartbestand als aparte taak)
  --budget M      na M minuten geen nieuwe vragen meer stellen en opslaan wat er is; de rest volgt de volgende keer
Gebieden zonder gegevens komen eerst aan de beurt, zodat elke run iets toevoegt, ook als Overpass traag is.
"""
import argparse, json, math, os, sys, time, urllib.parse, urllib.request
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter",
             "https://maps.mail.ru/osm/tools/overpass/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]
UA = "Skipilot/1.0 (ski route planner; github.com/thomdewit05-design/Pistenplanner)"
TILE = 0.25         # stukken kaart van een kwart graad: kleine vragen lukken veel vaker dan grote
PAD = 0.01          # marge rond een skigebied
KIND = {"restaurant": "r", "cafe": "c", "bar": "b", "pub": "b", "biergarten": "b", "fast_food": "f"}
Q = """[out:json][timeout:90];
(nwr["amenity"~"^(restaurant|cafe|bar|pub|fast_food|biergarten)$"]({s},{w},{n},{e});
 nwr["tourism"="alpine_hut"]({s},{w},{n},{e});
 nwr["shop"~"^(ticket|ski)$"]({s},{w},{n},{e});
 nwr["amenity"~"^(ski_rental|ski_school|locker|luggage_locker|ski_storage)$"]({s},{w},{n},{e});
 nwr["office"="ski_school"]({s},{w},{n},{e});
 nwr["shop"="sports"]["rental"~"ski"]({s},{w},{n},{e});
 node["highway"="bus_stop"]({s},{w},{n},{e}););
out center tags;"""


def kind_of(t):
    """Soort plek: h hut, r/c/b/f eten en drinken, p skipas, v verhuur, d depot, s skischool, o bushalte (None = overslaan)."""
    if t.get("tourism") == "alpine_hut": return "h"
    a, shop = t.get("amenity", ""), t.get("shop", "")
    if a in KIND: return KIND[a]
    if shop == "ticket": return "p"
    if a == "ski_school" or t.get("office") == "ski_school": return "s"
    if a == "ski_rental" or shop == "ski" or "ski" in t.get("rental", ""): return "v"
    if a in ("locker", "luggage_locker", "ski_storage"): return "d"
    if t.get("highway") == "bus_stop": return "o"
    return None


def website(t):
    w = (t.get("website") or t.get("contact:website") or t.get("url") or "").split(";")[0].strip()
    return w[:200] if w.startswith(("http://", "https://")) else ""


DEADLINE = float("inf")


def query(s, w, n, e):
    q = Q.format(s=s, w=w, n=n, e=e)
    for attempt in range(2 * len(ENDPOINTS)):
        if time.time() > DEADLINE: return None
        url = ENDPOINTS[attempt % len(ENDPOINTS)]
        try:
            req = urllib.request.Request(url, data=urllib.parse.urlencode({"data": q}).encode(), headers={"User-Agent": UA})
            res = json.load(urllib.request.urlopen(req, timeout=120))
            if "error" in (res.get("remark") or "").lower() or "timed out" in (res.get("remark") or "").lower():
                raise RuntimeError(res["remark"][:120])
            return res.get("elements", [])
        except Exception as ex:
            wait = 5 + 5 * attempt
            print(f"  {url.split('/')[2]}: {str(ex)[:100]}; opnieuw over {wait}s", flush=True)
            time.sleep(wait)
    return None


def main():
    global DEADLINE
    ap = argparse.ArgumentParser()
    ap.add_argument("--shard", type=int)
    ap.add_argument("--budget", type=float, help="minuten")
    args = ap.parse_args()
    start = time.time()
    if args.budget: DEADLINE = start + args.budget * 60

    rows = json.load(open(os.path.join(DATA, "index.json"), encoding="utf-8"))
    shards = sorted({r[8] for r in rows})
    if args.shard is not None:
        if args.shard not in shards: sys.exit(f"kaartbestand {args.shard} bestaat niet")
        shards = [args.shard]
    boxes, shard_of, old = {}, {}, {}
    for shard in shards:
        raw = json.load(open(os.path.join(DATA, f"s{shard:03d}.json"), encoding="utf-8"))
        path = os.path.join(DATA, f"h{shard:03d}.json")
        old[shard] = json.load(open(path, encoding="utf-8")) if os.path.exists(path) else {}
        for aid, a in raw.items():
            lons = [p[0] / 1e5 for p in a["n"]]; lats = [p[1] / 1e5 for p in a["n"]]
            boxes[aid] = (min(lats) - PAD, min(lons) - PAD, max(lats) + PAD, max(lons) + PAD); shard_of[aid] = shard
    # welke stukken kaart zijn nodig, en welke gebieden liggen erin
    tiles = defaultdict(list)
    for aid, (s, w, n, e) in boxes.items():
        for ty in range(math.floor(s / TILE), math.floor(n / TILE) + 1):
            for tx in range(math.floor(w / TILE), math.floor(e / TILE) + 1):
                tiles[(tx, ty)].append(aid)
    todo = defaultdict(set)        # gebied -> stukken kaart die nog moeten
    for t, aids in tiles.items():
        for aid in aids: todo[aid].add(t)
    # stukken met gebieden die nog niets hebben eerst, daarna van zuid naar noord
    has = lambda aid: aid in old[shard_of[aid]]
    order = sorted(tiles.items(), key=lambda kv: (all(has(a) for a in kv[1]), kv[0][1], kv[0][0]))
    print(f"{len(boxes)} gebieden in {len(shards)} kaartbestand(en), {len(tiles)} stukken kaart", flush=True)

    found = defaultdict(dict)      # gebied -> {osm-id: [lon, lat, soort, naam, website]}
    failed = set()
    for i, ((tx, ty), aids) in enumerate(order):
        if time.time() > DEADLINE:
            print(f"tijd op na {i}/{len(tiles)} stukken; de rest volgt de volgende keer", flush=True)
            failed.update(a for _, aa in order[i:] for a in aa); break
        # alleen het deel van het stuk kaart waar echt gebieden liggen
        s = max(ty * TILE, min(boxes[a][0] for a in aids)); w = max(tx * TILE, min(boxes[a][1] for a in aids))
        n = min((ty + 1) * TILE, max(boxes[a][2] for a in aids)); e = min((tx + 1) * TILE, max(boxes[a][3] for a in aids))
        els = query(round(s, 4), round(w, 4), round(n, 4), round(e, 4))
        if els is None:
            failed.update(aids); print(f"{i + 1}/{len(tiles)} mislukt", flush=True); continue
        for el in els:
            t = el.get("tags", {}); c = el.get("center") or el
            if "lat" not in c: continue
            kind = kind_of(t)
            if not kind: continue
            item = [round(c["lon"], 5), round(c["lat"], 5), kind, (t.get("name") or "")[:60], website(t)]
            for aid in aids:
                bs, bw, bn, be = boxes[aid]
                if bs <= c["lat"] <= bn and bw <= c["lon"] <= be:
                    found[aid][f"{el['type'][0]}{el['id']}"] = item
        for aid in aids: todo[aid].discard((tx, ty))
        if (i + 1) % 25 == 0: print(f"{i + 1}/{len(tiles)} stukken, {sum(len(v) for v in found.values())} plekken", flush=True)
        time.sleep(1.0)

    # per kaartbestand schrijven; een gebied is alleen bijgewerkt als al zijn stukken kaart gelukt zijn,
    # anders houdt het wat er al stond
    done = {aid for aid in boxes if not todo[aid] and aid not in failed}
    for shard in shards:
        out = {}
        for aid, sh in shard_of.items():
            if sh != shard: continue
            if aid in done: out[aid] = sorted(found.get(aid, {}).values())   # ook leeg: dan weet de app dat er niets is
            elif aid in old[shard]: out[aid] = old[shard][aid]
        if not out and not old[shard]: continue
        json.dump(out, open(os.path.join(DATA, f"h{shard:03d}.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    mins = (time.time() - start) / 60
    print(f"klaar na {mins:.0f} min: {len(done)}/{len(boxes)} gebieden bijgewerkt, {sum(len(found[a]) for a in done)} plekken", flush=True)
    # alleen een fout als er helemaal niets lukte (dan is er waarschijnlijk iets mis met het script of met Overpass)
    if not done and boxes: sys.exit("niets gelukt")


if __name__ == "__main__":
    main()
