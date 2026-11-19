// Maakt de privacyverklaring, de voorwaarden en de hulppagina in alle talen van de app.
//   node tools/legal.mjs          schrijft de pagina's
//   node tools/legal.mjs --check  schrijft niets; faalt als een taal afwijkt van de Nederlandse of een pagina verouderd is
// Bron: store/legal/<taal>/{privacy,terms,support}.html (alleen de tekst) en strings.json (titels en vaste regels).
// Nederlands is leidend en houdt de oude adressen: privacy.html, voorwaarden.html, support.html.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const ROOT = new URL("..", import.meta.url).pathname, CHECK = process.argv.includes("--check");
export const LANGS = ["nl", "en", "de", "fr", "it", "es", "pt", "ru", "zh", "ja"];
const KINDS = ["privacy", "terms", "support"];
export const pageName = (kind, l) => l === "nl" ? {privacy:"privacy.html", terms:"voorwaarden.html", support:"support.html"}[kind] : `${kind}-${l}.html`;
const read = p => readFileSync(ROOT + p, "utf8");
const CSS = `:root{--bg:#F3F6F9;--card:#fff;--ink:#0F1B2A;--muted:#5E6E80;--line:#E1E7EE;--accent:#2A6FDB;--warn:#FCE8E6;--warn-ink:#7A1E14}
@media (prefers-color-scheme:dark){:root{--bg:#0B1520;--card:#121E2C;--ink:#E8EEF5;--muted:#9AAABB;--line:#26364A;--accent:#6EA2F0;--warn:#3A1712;--warn-ink:#F6C9C2}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans","Noto Sans CJK SC",sans-serif}
main{max-width:720px;margin:0 auto;padding:24px 16px 48px}
header{display:flex;align-items:center;gap:12px;margin-bottom:8px}
header img{width:44px;height:44px}
h1{font-size:28px;line-height:1.15;margin:0}
h2{font-size:19px;margin:28px 0 6px}
p,li{color:var(--ink)}
.meta{color:var(--muted);font-size:14px;margin:0 0 12px}
.langs{display:flex;flex-wrap:wrap;gap:4px 12px;margin:0 0 20px;font-size:14px}
.langs b{font-weight:600}
.lead{color:var(--muted);font-size:14px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:4px 18px 14px}
.safety{background:var(--warn);color:var(--warn-ink);border-radius:14px;padding:12px 16px}
.safety p{margin:6px 0;color:inherit}
table{width:100%;border-collapse:collapse;font-size:14.5px;table-layout:fixed}
th,td{text-align:left;vertical-align:top;padding:8px 6px;border-top:1px solid var(--line);overflow-wrap:anywhere;hyphens:auto}
th{color:var(--muted);font-weight:600}
a{color:var(--accent)}
.todo{background:#FFF1C2;color:#5A4300;padding:0 4px;border-radius:4px}
@media (prefers-color-scheme:dark){.todo{background:#5A4300;color:#FFF1C2}}
.back{display:inline-block;margin-top:28px}`;
const SCRIPT = `<script src="config.js"></script>
<script>
// advertentieteksten alleen tonen als advertenties op de website aan staan
if(((window.PP_CONFIG || {}).ads || {}).client){ document.querySelectorAll(".ads-on").forEach(e => e.hidden = false); document.querySelectorAll(".ads-off").forEach(e => e.hidden = true); }
// naam en e-mailadres uit config.js invullen
const c = (window.PP_CONFIG || {}).contact || {};
document.querySelectorAll("[data-cfg]").forEach(el => {
  const v = c[el.dataset.cfg]; if(!v) return;
  if(el.dataset.cfg === "email"){ const a = document.createElement("a"); a.href = "mailto:" + v; a.textContent = v; el.replaceWith(a); }
  else { el.textContent = v; el.classList.remove("todo"); }
});
</script>`;
// de opbouw van een tekst: welke onderdelen er in welke volgorde staan (tekst zelf telt niet mee)
const shape = h => (h.match(/<\/?(h2|p|li|ul|table|tr|td|th|div|span)\b[^>]*>|href="[^"]*"|data-cfg="[^"]*"|class="[^"]*"/g) || [])
  .map(t => t.replace(/href="(https?:\/\/[^"\/]*)[^"]*"/, 'href="$1"')).join("|");   // bij een link telt alleen de website: de pagina mag per taal verschillen

const problems = [], names = Object.fromEntries(LANGS.map(l => [l, existsSync(`${ROOT}store/legal/${l}/strings.json`) ? JSON.parse(read(`store/legal/${l}/strings.json`)).name : null]));
const have = LANGS.filter(l => names[l]);
for(const l of LANGS) if(!names[l]) problems.push(`taal ${l}: store/legal/${l}/ ontbreekt`);
const nlShape = Object.fromEntries(KINDS.map(k => [k, shape(read(`store/legal/nl/${k}.html`))]));
let wrote = 0;
for(const l of have){
  const S = JSON.parse(read(`store/legal/${l}/strings.json`));
  for(const need of ["name", "privacyTitle", "termsTitle", "supportTitle", "updated", "supportMeta", "back", "seeAlso"]) if(!S[need]) problems.push(`${l}: strings.json mist "${need}"`);
  if(l !== "nl" && !S.leading) problems.push(`${l}: strings.json mist "leading" (de regel dat de Nederlandse versie leidend is)`);
  for(const kind of KINDS){
    const src = `store/legal/${l}/${kind}.html`;
    if(!existsSync(ROOT + src)){ problems.push(`${l}: ${src} ontbreekt`); continue; }
    let body = read(src).trim();
    if(shape(body) !== nlShape[kind]) problems.push(`${l}: ${kind} heeft een andere opbouw dan de Nederlandse tekst (een alinea, tabelrij of link ontbreekt of is te veel)`);
    if(/\[(naam|name|e-mail)/i.test(body.replace(/<span data-cfg[^>]*>[^<]*<\/span>/g, ""))) problems.push(`${l}: ${kind} bevat een losse invulplek`);
    body = body.replaceAll("{privacy}", pageName("privacy", l)).replaceAll("{terms}", pageName("terms", l)).replaceAll("{support}", pageName("support", l));
    const title = S[kind + "Title"], meta = kind === "support" ? S.supportMeta : `Skipilot · ${S.updated}`;
    const langs = have.map(x => x === l ? `<b>${names[x]}</b>` : `<a href="${pageName(kind, x)}" hreflang="${x}" lang="${x}">${names[x]}</a>`).join("\n");
    const others = KINDS.filter(k => k !== kind).map(k => `<a href="${pageName(k, l)}">${S[k + "Title"]}</a>`).join(" · ");
    const html = `<!doctype html>
<html lang="${l}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · Skipilot</title>
<link rel="icon" href="icons/logo.svg">
<!-- Gemaakt door tools/legal.mjs uit store/legal/${l}/${kind}.html; pas de bron aan, niet dit bestand. -->
<style>
${CSS}
</style>
</head>
<body>
<main>
<header><img src="icons/logo.svg" alt=""><h1>${title}</h1></header>
<p class="meta">${meta}</p>
<nav class="langs" aria-label="Language">
${langs}
</nav>
${l !== "nl" ? `<p class="lead">${S.leading} <a href="${pageName(kind, "nl")}" hreflang="nl" lang="nl">Nederlands</a></p>\n` : ""}
${body}

<p>${S.seeAlso} ${others}</p>
<a class="back" href="./">${S.back}</a>
</main>
${SCRIPT}
</body>
</html>
`;
    const out = pageName(kind, l);
    if(CHECK){ if(!existsSync(ROOT + out) || read(out) !== html) problems.push(`${out} is verouderd; draai node tools/legal.mjs`); }
    else { writeFileSync(ROOT + out, html); wrote++; }
  }
}
if(problems.length){ console.log(problems.join("\n") + `\n\n${problems.length} problemen.`); process.exit(1); }
console.log(CHECK ? `Juridische pagina's in orde (${have.length} talen).` : `${wrote} pagina's geschreven (${have.length} talen).`);
