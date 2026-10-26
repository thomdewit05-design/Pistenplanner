"""Zet de donkere-modusregels in app.css om, zodat je in de app ook zelf licht of donker kunt kiezen.
Elke regel binnen @media (prefers-color-scheme:dark) geldt dan alleen als je niet 'licht' kiest,
en wordt herhaald voor :root[data-theme=dark]. Gebruik: python tools/theme_css.py app.css"""
import re, sys

p = sys.argv[1]
css = open(p, encoding="utf-8").read()
MARK = "/* thema: omgezet */"
if MARK in css:
    print("al omgezet"); sys.exit()

def block_end(s, i):
    depth = 0
    for j in range(i, len(s)):
        if s[j] == "{": depth += 1
        elif s[j] == "}":
            depth -= 1
            if depth == 0: return j
    raise ValueError("geen sluitende accolade")

def prefix(sel, pre):
    sel = sel.strip()
    return pre + sel[5:] if sel.startswith(":root") else f"{pre} {sel}"

out, extra, i = [], [], 0
for m in re.finditer(r"@media\s*\(prefers-color-scheme:\s*dark\)\s*\{", css):
    pass
pos = 0
pattern = re.compile(r"@media\s*\(prefers-color-scheme:\s*dark\)\s*\{")
while True:
    m = pattern.search(css, pos)
    if not m: out.append(css[pos:]); break
    out.append(css[pos:m.start()])
    end = block_end(css, m.end() - 1)
    inner = css[m.end():end]
    rules = re.findall(r"([^{}]+)\{([^{}]*)\}", inner)
    auto = "".join(",".join(prefix(s, ":root:not([data-theme=light])") for s in sel.split(",")) + "{" + body + "}" for sel, body in rules)
    forced = "".join(",".join(prefix(s, ":root[data-theme=dark]") for s in sel.split(",")) + "{" + body + "}" for sel, body in rules)
    out.append("@media (prefers-color-scheme:dark){" + auto + "}\n" + forced)
    pos = end + 1
res = "".join(out)
# licht forceren: kleurschema van formulieren
res += "\n" + MARK + "\n:root[data-theme=light]{color-scheme:light}\n"
open(p, "w", encoding="utf-8").write(res)
print("ok")
