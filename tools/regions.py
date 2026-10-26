"""Welke skigebieden de app meeneemt, per regio. Gedeeld door build.py en fetch_huts.py."""

ALPS = [(5.0,43.65),(6.6,43.6),(7.7,43.85),(8.25,44.1),(7.95,44.45),(7.35,44.9),(7.45,45.35),(8.4,45.75),
        (9.4,45.8),(10.4,45.65),(11.2,45.72),(12.3,45.9),(13.3,46.05),(14.3,46.15),(15.0,46.25),(15.7,46.35),
        (16.25,47.0),(16.2,47.75),(15.4,47.95),(13.6,47.92),(12.4,47.82),(11.0,47.72),(10.0,47.62),(9.7,47.48),
        (9.0,47.3),(8.3,47.12),(7.7,46.92),(7.0,46.7),(6.75,46.45),(6.45,46.2),(6.0,45.95),(5.75,45.6),
        (5.35,45.1),(5.2,44.5)]

def in_poly(x, y, poly):
    inside = False; j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi = poly[i]; xj, yj = poly[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi: inside = not inside
        j = i
    return inside

def region_of(x, y, cc):
    """Regiocode voor een skigebied op lengte x, breedte y in land cc, of None."""
    if cc in {"FR","CH","IT","AT","DE","SI","LI","MC"} and in_poly(x, y, ALPS): return "alpen"
    if cc in {"FR","ES","AD"} and -2.3 <= x <= 3.4 and 42.1 <= y <= 43.25: return "pyreneeen"
    if cc in {"NO","SE","FI"}: return "scandinavie"
    if cc in {"US","CA"}: return "noord-amerika"
    return None
