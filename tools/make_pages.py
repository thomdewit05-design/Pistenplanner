"""Maakt de website-pagina's per skigebied (gebieden/*.html), een overzicht, sitemap.xml en robots.txt.

De pagina's zijn gewone HTML, zodat zoekmachines ze kunnen lezen. Elke pagina linkt naar het gebied in de app
en heeft plekken voor advertenties (die alleen verschijnen als ze in config.js zijn ingesteld).

Gebruik:  python tools/make_pages.py [basis-url]
"""
import html, json, math, os, re, sys, unicodedata
from collections import defaultdict
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = (sys.argv[1] if len(sys.argv) > 1 else "https://thomdewit05-design.github.io/Pistenplanner/").rstrip("/") + "/"
OUT = os.path.join(ROOT, "gebieden")
MIN_KM = 2          # kleinere gebiedjes krijgen geen eigen pagina (te weinig inhoud)

COUNTRY = {"AT": "Oostenrijk", "CH": "Zwitserland", "FR": "Frankrijk", "IT": "Italië", "DE": "Duitsland", "SI": "Slovenië",
           "LI": "Liechtenstein", "AD": "Andorra", "ES": "Spanje", "NO": "Noorwegen", "SE": "Zweden", "FI": "Finland",
           "US": "Verenigde Staten", "CA": "Canada"}
DIFF = {"g": ("groen", "#22984A", 1), "b": ("blauw", "#1E66CC", 1), "r": ("rood", "#D22E2E", 2), "s": ("zwart", "#121417", 3),
        "f": ("skiroute", "#E08A1E", 4), "u": ("onbekend", "#8C99A6", 2), "B": ("blauw (gemiddeld)", "#1E66CC", 2), "x": ("dubbel zwart", "#121417", 3)}
LIFT = {"chair_lift": "stoeltjeslift", "gondola": "gondel", "cable_car": "kabelbaan", "t-bar": "sleeplift", "j-bar": "sleeplift",
        "platter": "schotellift", "drag_lift": "sleeplift", "rope_tow": "touwlift", "magic_carpet": "lopende band", "mixed_lift": "combibaan",
        "funicular": "kabeltrein", "lift": "lift"}
PLURAL = {"stoeltjeslift": "stoeltjesliften", "gondel": "gondels", "kabelbaan": "kabelbanen", "sleeplift": "sleepliften", "schotellift": "schotelliften",
          "touwlift": "touwliften", "lopende band": "lopende banden", "combibaan": "combibanen", "kabeltrein": "kabeltreinen", "lift": "liften"}
ORDER = "gbBrusxf"   # volgorde in de balk: van makkelijk naar moeilijk
LEVEL = {1: "makkelijk", 2: "gemiddeld", 3: "moeilijk", 4: "skiroute"}

esc = lambda s: html.escape(str(s or ""), quote=True)


def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-") or "gebied"


def km(m):
    return f"{m/1000:.1f}".replace(".", ",") + " km" if m >= 1000 else f"{round(m/10)*10} m"


def dist(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[5], a[4], b[5], b[4]))
    h = math.sin((la2-la1)/2)**2 + math.cos(la1)*math.cos(la2)*math.sin((lo2-lo1)/2)**2
    return 6371 * 2 * math.asin(math.sqrt(h))


def stats(raw):
    """km per moeilijkheid, de langste pistes en de liften van één gebied."""
    t = raw["t"]
    per = defaultdict(float)
    runs = defaultdict(lambda: {"len": 0.0, "drop": 0, "diff": None})
    lifts = []
    for e in raw["e"]:
        name = t[e[3]] if e[3] is not None and 0 <= e[3] < len(t) else ""
        ref = e[4] or ""
        if e[0] == "r":
            per[e[5]] += e[6]
            if name or ref:
                r = runs[(name, ref, e[5])]
                r["len"] += e[6]; r["drop"] += max(0, e[7] or 0); r["diff"] = e[5]
        else:
            lifts.append({"name": name or (f"{LIFT.get(e[5], 'lift')} {ref}" if ref else ""), "kind": e[5], "len": e[6], "dur": e[7]})
    top = sorted(([k, v] for k, v in runs.items()), key=lambda x: -x[1]["len"])[:10]
    lifts.sort(key=lambda x: -x["len"])
    kinds = defaultdict(int)
    for l in lifts: kinds[LIFT.get(l["kind"], "lift")] += 1
    return per, top, lifts, kinds


CSS = """:root{--bg:#F3F6F9;--card:#fff;--ink:#0F1B2A;--muted:#5E6E80;--line:#E1E7EE;--accent:#2A6FDB;--navy:#0F1B2A}
@media (prefers-color-scheme:dark){:root{--bg:#0B1520;--card:#121E2C;--ink:#E8EEF5;--muted:#9AAABB;--line:#26364A;--accent:#6EA2F0;--navy:#1C2D42}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:var(--accent)}
.top{background:var(--navy);color:#fff}
.top .in{max-width:900px;margin:0 auto;padding:12px 16px;display:flex;align-items:center;gap:10px}
.top a{color:#fff;text-decoration:none;font-weight:800;letter-spacing:.02em;display:flex;align-items:center;gap:10px}
.top img{width:34px;height:34px}
.top nav{margin-left:auto;font-size:14px}
.top nav a{font-weight:600;opacity:.9}
main{max-width:900px;margin:0 auto;padding:20px 16px 48px}
.crumbs{font-size:13.5px;color:var(--muted);margin:0 0 6px}
.crumbs a{color:var(--muted)}
h1{font-size:30px;line-height:1.15;margin:0 0 8px}
h2{font-size:20px;margin:30px 0 10px}
.lead{font-size:17px;margin:0 0 16px}
.cta{display:inline-flex;align-items:center;gap:8px;background:#FFC400;color:#1A1300;font-weight:800;text-decoration:none;padding:13px 20px;border-radius:12px;margin:6px 0 4px}
.cta:hover{filter:brightness(1.05)}
.small{font-size:13px;color:var(--muted)}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin:18px 0}
.tile{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 14px}
.tile b{display:block;font-size:22px;line-height:1.2}
.tile span{font-size:13px;color:var(--muted)}
.bar{display:flex;height:14px;border-radius:7px;overflow:hidden;margin:6px 0 8px;background:var(--line)}
.legend{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:14px}
.legend i{display:inline-block;width:11px;height:11px;border-radius:50%;margin-right:6px;vertical-align:-1px}
table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden;font-size:14.5px}
th,td{text-align:left;padding:9px 12px;border-top:1px solid var(--line)}
th{color:var(--muted);font-weight:600;border-top:0}
td.n,th.n{text-align:right;white-space:nowrap}
.dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:8px}
.near{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px;padding:0;list-style:none}
.near a{display:block;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 12px;text-decoration:none;color:var(--ink)}
.near small{display:block;color:var(--muted)}
.ad-slot{margin:22px 0;min-height:0}
.ad-slot:empty{display:none}
.ad-slot .ad-label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px}
.list{columns:2 240px;column-gap:24px;padding-left:18px}
.list li{break-inside:avoid}
footer{max-width:900px;margin:0 auto;padding:0 16px 40px;font-size:13px;color:var(--muted)}
footer a{color:var(--muted)}
"""


def page_shell(title, desc, canon, body, depth="../"):
    return f"""<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<link rel="canonical" href="{esc(canon)}">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="{esc(canon)}">
<meta property="og:image" content="{BASE}icons/icon-512.png">
<link rel="icon" href="{depth}icons/logo.svg">
<link rel="stylesheet" href="{depth}gebieden/site.css">
</head>
<body>
<header class="top"><div class="in"><a href="{depth}"><img src="{depth}icons/logo.svg" alt="">PISTENPLANNER</a><nav><a href="{depth}gebieden/">Alle skigebieden</a></nav></div></header>
{body}
<footer>
<p>Pistedata © <a href="https://www.openstreetmap.org/copyright" rel="noopener">OpenStreetMap</a>-bijdragers (ODbL), via <a href="https://openskimap.org" rel="noopener">OpenSkiMap</a>. Gegevens kunnen afwijken van de werkelijkheid; volg ter plaatse altijd de borden en de pistedienst.</p>
<p><a href="{depth}privacy.html">Privacyverklaring</a> · <a href="{depth}voorwaarden.html">Voorwaarden</a></p>
</footer>
<script src="{depth}config.js"></script>
<script src="{depth}ads.js"></script>
</body>
</html>
"""


def ad(name):
    return f'<div class="ad-slot" data-ad="{name}"></div>'


def main():
    rows = json.load(open(os.path.join(ROOT, "data", "index.json"), encoding="utf-8"))
    shards = {}
    def raw_of(r):
        if r[8] not in shards:
            shards[r[8]] = json.load(open(os.path.join(ROOT, "data", f"s{r[8]:03d}.json"), encoding="utf-8"))
        return shards[r[8]].get(r[0])

    rows_pg = [r for r in rows if (r[6] or 0) >= MIN_KM]
    used, slugs = set(), {}
    for r in sorted(rows_pg, key=lambda r: -(r[6] or 0)):     # grote gebieden krijgen de mooiste naam
        s = slug(r[1])
        if s in used: s = f"{s}-{r[2].lower()}"
        n = 2
        while s in used: s = f"{slug(r[1])}-{n}"; n += 1
        used.add(s); slugs[r[0]] = s

    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        if f.endswith(".html"): os.remove(os.path.join(OUT, f))
    open(os.path.join(OUT, "site.css"), "w", encoding="utf-8").write(CSS)

    urls = []
    for r in rows_pg:
        raw = raw_of(r)
        if not raw: continue
        name, cc, region, kmp, nl, lo, hi, web = r[1], r[2], r[3] or "", r[6], r[7], r[9], r[10], r[11]
        land = COUNTRY.get(cc, cc)
        per, top, lifts, kinds = stats(raw)
        tot = sum(per.values()) or 1
        by_lvl = defaultdict(float)
        for d, m in per.items(): by_lvl[DIFF.get(d, DIFF["u"])[2]] += m
        parts = [f"{round(100*by_lvl[l]/tot)}% {LEVEL[l]}" for l in (1, 2, 3, 4) if by_lvl[l]/tot >= .03]
        near = sorted(((dist(r, o), o) for o in rows_pg if o[0] != r[0]), key=lambda x: x[0])[:6]
        url = f"{BASE}gebieden/{slugs[r[0]]}.html"
        app = f"../#{r[0]}"
        hoogte = f"tussen {lo} en {hi} meter" if lo is not None and hi is not None else ""
        lead = (f"{esc(name)} ligt in {esc(region) + ', ' if region else ''}{esc(land)}. Het skigebied heeft ongeveer {kmp} km piste en {nl} liften"
                f"{', ' + hoogte if hoogte else ''}. " + (f"De pistes zijn {', '.join(parts)}. " if parts else "")
                + "Met de Pistenplanner zie je welke pistes en liften je moet nemen, en navigeer je met gesproken aanwijzingen naar je bestemming.")
        bar = "".join(f'<span style="width:{100*m/tot:.1f}%;background:{DIFF.get(d, DIFF["u"])[1]}" title="{esc(DIFF.get(d, DIFF["u"])[0])}"></span>'
                      for d, m in sorted(per.items(), key=lambda x: ORDER.find(x[0])) if m/tot >= .005)
        legend = "".join(f'<span><i style="background:{DIFF.get(d, DIFF["u"])[1]}"></i>{esc(DIFF.get(d, DIFF["u"])[0])}: {km(m)}</span>'
                         for d, m in sorted(per.items(), key=lambda x: ORDER.find(x[0])) if m/tot >= .005)
        runs_rows = "".join(f'<tr><td><span class="dot" style="background:{DIFF.get(v["diff"], DIFF["u"])[1]}"></span>'
                            f'{esc(("Piste " + k[1] + (" " + k[0] if k[0] and k[0] != k[1] else "")) if k[1] else k[0])}</td>'
                            f'<td>{esc(DIFF.get(v["diff"], DIFF["u"])[0])}</td><td class="n">{km(v["len"])}</td><td class="n">{round(v["drop"])} m</td></tr>'
                            for k, v in top)
        named_lifts = [l for l in lifts if l["name"]][:12]
        lift_rows = "".join(f'<tr><td>{esc(l["name"])}</td><td>{esc(LIFT.get(l["kind"], "lift"))}</td><td class="n">{km(l["len"])}</td>'
                            f'<td class="n">{max(1, round((l["dur"] or 0)/60))} min</td></tr>' for l in named_lifts)
        kinds_txt = ", ".join(f"{n} {k if n == 1 else PLURAL.get(k, k)}" for k, n in sorted(kinds.items(), key=lambda x: -x[1]))
        kinds_txt = re.sub(r", ([^,]+)$", lambda m: " en " + m.group(1), kinds_txt)
        near_li = "".join(f'<li><a href="{slugs[o[0]]}.html">{esc(o[1])}<small>{round(d)} km · {o[6]} km piste</small></a></li>' for d, o in near)
        body = f"""<main>
<p class="crumbs"><a href="./">Skigebieden</a> › <a href="./#{cc.lower()}">{esc(land)}</a>{' › ' + esc(region) if region else ''}</p>
<h1>{esc(name)}: pistekaart en routeplanner</h1>
<p class="lead">{lead}</p>
<a class="cta" href="{app}">Open {esc(name)} in de Pistenplanner →</a>
<p class="small">Gratis in je browser, ook te installeren als app op je telefoon.</p>
<div class="tiles">
  <div class="tile"><b>{kmp} km</b><span>piste</span></div>
  <div class="tile"><b>{nl}</b><span>liften</span></div>
  {f'<div class="tile"><b>{lo} m</b><span>laagste punt</span></div><div class="tile"><b>{hi} m</b><span>hoogste punt</span></div>' if lo is not None and hi is not None else ''}
</div>
<h2>Pistes naar moeilijkheid</h2>
<div class="bar">{bar}</div>
<div class="legend">{legend}</div>
{ad("page-top")}
{f'<h2>Langste pistes in {esc(name)}</h2><table><tr><th>Piste</th><th>Kleur</th><th class="n">Lengte</th><th class="n">Daling</th></tr>{runs_rows}</table>' if runs_rows else ''}
{f'<h2>Liften</h2><p>{esc(name)} heeft {kinds_txt}.</p>' if kinds_txt else ''}
{f'<table><tr><th>Lift</th><th>Soort</th><th class="n">Lengte</th><th class="n">Rit</th></tr>{lift_rows}</table>' if lift_rows else ''}
<h2>Je route plannen in {esc(name)}</h2>
<p>Tik in de Pistenplanner op je vertrekpunt en je bestemming, of laat de app een rondje voorstellen. De app kiest pistes die bij je niveau passen, waarschuwt voor de laatste lift en toont het weer op de top en in het dal. Ski je met vrienden, dan krijgt iedereen in je groep dezelfde route.</p>
<a class="cta" href="{app}">Plan je route in {esc(name)} →</a>
{f'<p class="small">Officiële website: <a href="{esc(web)}" rel="noopener nofollow">{esc(re.sub(r"^https?://(www\.)?", "", web).rstrip("/"))}</a> (openingstijden, skipassen en liftstatus)</p>' if web else ''}
{ad("page-bottom")}
<h2>Skigebieden in de buurt</h2>
<ul class="near">{near_li}</ul>
</main>"""
        desc = f"Pistekaart en routeplanner voor {name} ({land}): {kmp} km piste, {nl} liften. Plan je route over de pistes en navigeer met de gratis Pistenplanner."
        open(os.path.join(OUT, slugs[r[0]] + ".html"), "w", encoding="utf-8").write(
            page_shell(f"{name} pistekaart en routeplanner | Pistenplanner", desc, url, body))
        urls.append(url)

    # overzicht per land en regio
    by = defaultdict(lambda: defaultdict(list))
    for r in rows_pg:
        if r[0] in slugs: by[r[2]][r[3] or "Overig"].append(r)
    pref = "AT FR IT CH DE AD ES SI LI NO SE FI US CA".split()      # eerst waar de meeste Nederlanders skiën
    order = sorted(by, key=lambda c: pref.index(c) if c in pref else 99)
    sec = []
    for cc in order:
        regs = "".join(f'<h3>{esc(reg)}</h3><ul class="list">' + "".join(
            f'<li><a href="{slugs[r[0]]}.html">{esc(r[1])}</a> <span class="small">{r[6]} km</span></li>'
            for r in sorted(lst, key=lambda r: -r[6])) + "</ul>" for reg, lst in sorted(by[cc].items()))
        sec.append(f'<h2 id="{cc.lower()}">{esc(COUNTRY.get(cc, cc))} <span class="small">{sum(len(v) for v in by[cc].values())} gebieden</span></h2>{regs}')
    nav = " · ".join(f'<a href="#{cc.lower()}">{esc(COUNTRY.get(cc, cc))}</a>' for cc in order)
    body = f"""<main>
<h1>Alle skigebieden</h1>
<p class="lead">Pistekaarten en routeplanners voor {len(urls)} skigebieden in de Alpen, de Pyreneeën, Scandinavië en Noord-Amerika. Kies een gebied, bekijk de pistes en liften, en plan je route in de gratis Pistenplanner.</p>
<a class="cta" href="../">Open de Pistenplanner →</a>
<p>{nav}</p>
{ad("list-top")}
{''.join(sec)}
</main>"""
    open(os.path.join(OUT, "index.html"), "w", encoding="utf-8").write(
        page_shell("Alle skigebieden: pistekaarten en routeplanner | Pistenplanner",
                   f"Pistekaarten en routeplanners voor {len(urls)} skigebieden in Europa en Noord-Amerika. Gratis route plannen en navigeren over de pistes.",
                   f"{BASE}gebieden/", body))

    today = date.today().isoformat()
    sm = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          f"<url><loc>{BASE}</loc><lastmod>{today}</lastmod></url>", f"<url><loc>{BASE}gebieden/</loc><lastmod>{today}</lastmod></url>"]
    sm += [f"<url><loc>{u}</loc><lastmod>{today}</lastmod></url>" for u in urls]
    sm.append("</urlset>")
    open(os.path.join(ROOT, "sitemap.xml"), "w", encoding="utf-8").write("\n".join(sm) + "\n")
    open(os.path.join(ROOT, "robots.txt"), "w", encoding="utf-8").write(f"User-agent: *\nAllow: /\n\nSitemap: {BASE}sitemap.xml\n")
    print(f"{len(urls)} pagina's gemaakt in gebieden/, plus overzicht, sitemap.xml en robots.txt (basis {BASE})")


if __name__ == "__main__":
    main()
