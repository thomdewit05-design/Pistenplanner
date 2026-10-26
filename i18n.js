"use strict";
// Vertalingen. De app is in het Nederlands geschreven; deze laag vertaalt alles wat op het scherm komt
// (en wat wordt voorgelezen) naar Engels of Duits. Losse teksten via EXACT, zinnen met namen via PATTERNS,
// en losse woorden die in samengestelde regels staan via WORDS.
const I18N_LANGS = {nl:"Nederlands", en:"English", de:"Deutsch"};
let LANG = (() => {
  try{ const s = localStorage.getItem("pp-lang"); if(s && I18N_LANGS[s]) return s; }catch(e){}
  const n = (navigator.language || "nl").slice(0, 2).toLowerCase();
  return n === "nl" ? "nl" : n === "de" ? "de" : n === "en" ? "en" : "nl";
})();
let LOCALE = {nl:"nl-NL", en:"en-GB", de:"de-DE"}[LANG];
let DEC = LANG === "en" ? "." : ",";
const SPEECH_LANG = () => ({nl:"nl-NL", en:"en-GB", de:"de-DE"}[LANG]);

// ---------- liftsoorten en moeilijkheden ----------
const LIFT_T = {
  en:{stoeltjeslift:"chairlift", gondel:"gondola", kabelbaan:"cable car", sleeplift:"T-bar", schotellift:"button lift", touwlift:"rope tow",
      "lopende band":"magic carpet", combibaan:"combined lift", kabeltrein:"funicular", lift:"lift"},
  de:{stoeltjeslift:"Sessellift", gondel:"Gondelbahn", kabelbaan:"Seilbahn", sleeplift:"Schlepplift", schotellift:"Tellerlift", touwlift:"Seillift",
      "lopende band":"Förderband", combibaan:"Kombibahn", kabeltrein:"Standseilbahn", lift:"Lift"}};
// Duitse lidwoorden: [nominatief, accusatief, datief]
const LIFT_DE_ART = {stoeltjeslift:["der","den","dem"], gondel:["die","die","der"], kabelbaan:["die","die","der"], sleeplift:["der","den","dem"],
  schotellift:["der","den","dem"], touwlift:["der","den","dem"], "lopende band":["das","das","dem"], combibaan:["die","die","der"], kabeltrein:["die","die","der"], lift:["der","den","dem"]};
const LIFT_RX = "(stoeltjeslift|gondel|kabelbaan|sleeplift|schotellift|touwlift|lopende band|combibaan|kabeltrein|lift)";
const COLOR_T = {
  en:{groen:"green", blauw:"blue", rood:"red", zwart:"black", skiroute:"ski route", onbekend:"unmarked", "blauw (gemiddeld)":"blue (intermediate)", "dubbel zwart":"double black"},
  de:{groen:"grün", blauw:"blau", rood:"rot", zwart:"schwarz", skiroute:"Skiroute", onbekend:"unmarkiert", "blauw (gemiddeld)":"blau (mittel)", "dubbel zwart":"doppelschwarz"}};
const ADJ = {groene:["green","grünen"], blauwe:["blue","blauen"], rode:["red","roten"], zwarte:["black","schwarzen"], ongemarkeerde:["unmarked","unmarkierten"], dubbelzwarte:["double black","doppelschwarzen"]};
const uc1 = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

// "piste 6 Velill", "de blauwe piste", "de skiroute", of een naam
function pisteT(x, kase){   // kase: "nom" | "dat" (Duits)
  let m;
  if((m = /^de (groene|blauwe|rode|zwarte|ongemarkeerde|dubbelzwarte) piste$/i.exec(x)))
    return LANG === "en" ? `the ${ADJ[m[1].toLowerCase()][0]} run` : `${kase === "dat" ? "der" : "die"} ${ADJ[m[1].toLowerCase()][1]} Piste`;
  if(/^de skiroute$/i.test(x)) return LANG === "en" ? "the ski route" : (kase === "dat" ? "der Skiroute" : "die Skiroute");
  if((m = /^piste (.+)$/i.exec(x))) return LANG === "en" ? `run ${m[1]}` : `Piste ${m[1]}`;
  return x;
}
function liftT(kind, rest, kase){  // kase: acc | dat | none
  const k = kind.toLowerCase();
  if(LANG === "en") return `the ${LIFT_T.en[k]}${rest || ""}`;
  const a = LIFT_DE_ART[k] || ["der","den","dem"];
  return `${kase === "dat" ? a[2] : a[1]} ${LIFT_T.de[k]}${rest || ""}`;
}
const TURN = {
  en:{"houd links aan":"keep left onto", "houd rechts aan":"keep right onto", "ga linksaf":"turn left onto", "ga rechtsaf":"turn right onto", "rechtdoor":"continue onto"},
  de:{"houd links aan":"links halten zu", "houd rechts aan":"rechts halten zu", "ga linksaf":"links abbiegen zu", "ga rechtsaf":"rechts abbiegen zu", "rechtdoor":"geradeaus zu"}};
// "naar de blauwe piste" -> Duits "zur blauen Piste"
const deZu = x => { const t = pisteT(x, "dat"); return t.startsWith("der ") ? "zur " + t.slice(4) : "zu " + t; };

// ---------- plaatsen ----------
function placeT(x){
  let m;
  if((m = /^(Dalstation|dalstation) (.+)$/.exec(x))) return LANG === "en" ? `${m[1][0] === "D" ? "B" : "b"}ottom station ${placeLift(m[2])}` : `Talstation ${placeLift(m[2])}`;
  if((m = /^(Bergstation|bergstation) (.+)$/.exec(x))) return LANG === "en" ? `${m[1][0] === "B" ? "T" : "t"}op station ${placeLift(m[2])}` : `Bergstation ${placeLift(m[2])}`;
  if((m = /^(Begin|begin) (.+)$/.exec(x))) return LANG === "en" ? `${m[1][0] === "B" ? "S" : "s"}tart of ${pisteT(m[2])}` : `Anfang ${pisteT(m[2])}`;
  if((m = /^(Einde|einde) (.+)$/.exec(x))) return LANG === "en" ? `${m[1][0] === "E" ? "E" : "e"}nd of ${pisteT(m[2])}` : `Ende ${pisteT(m[2])}`;
  if((m = /^(kruising|Kruising) op (.+)$/.exec(x))) return LANG === "en" ? `junction at ${m[2]}` : `Kreuzung auf ${m[2]}`;
  return null;
}
const placeLift = s => { const m = new RegExp("^" + LIFT_RX + "( .+)?$", "i").exec(s); return m ? (LANG === "en" ? LIFT_T.en[m[1].toLowerCase()] : LIFT_T.de[m[1].toLowerCase()]) + (m[2] || "") : s; };
const placeOrSelf = s => placeT(s) || pisteT(s);

// ---------- losse teksten ----------
const EXACT = {
en:{
 "Skigebied":"Ski area", "Kiezen…":"Choose…", "Kaartweergave":"Map style", "Satelliet":"Satellite", "Terrein":"Terrain", "Kaart":"Map", "Lagen":"Layers",
 "Pistes en liften":"Runs and lifts", "Pistenummers":"Run numbers", "Hutten en restaurants":"Huts and restaurants", "Plaatsnamen":"Place names",
 "Vertrekpunt":"Start", "Bestemming of piste":"Destination or run", "Bestemming":"Destination", "Start vanaf mijn locatie":"Start from my location",
 "Omdraaien":"Swap", "Vertrek en bestemming omdraaien":"Swap start and destination", "Kies een skigebied om te beginnen.":"Choose a ski area to begin.",
 "Niveau en voorkeuren":"Level and preferences", "Jouw niveau":"Your level", "Makkelijk":"Easy", "Gemiddeld":"Intermediate", "Moeilijk":"Difficult",
 "Voorkeur":"Preference", "Snelste route":"Fastest route", "Rustigste route":"Easiest route", "Openingstijden liften":"Lift opening hours",
 "Open vanaf":"Opens", "Laatste lift":"Last lift", "Kijk op de website van het skigebied; veel liften sluiten tussen 16:00 en 17:00, in het voorjaar later.":"Check the ski area's website; many lifts close between 4 and 5 pm, later in spring.",
 "Skiroutes en freeride meenemen":"Include ski routes and freeride", "Met gondel naar beneden toestaan":"Allow riding gondolas down", "Gesproken aanwijzingen":"Spoken directions",
 "Door jou afgesloten":"Closed by you", "Alles is open.":"Everything is open.", "Mijn routes":"My routes", "Bewaar":"Save", "Naam van de route":"Route name",
 "Naam, bijv. Ochtendrondje":"Name, e.g. Morning loop", "Nog geen routes bewaard. Teken of plan een route en bewaar hem hier.":"No saved routes yet. Draw or plan a route and save it here.",
 "Kies een skigebied":"Choose a ski area", "Zoek op naam, dorp of regio":"Search by name, village or region", "Zoek skigebied":"Search ski area", "Bij mij in de buurt":"Near me",
 "Overal":"Everywhere", "Alle landen":"All countries", "Favorieten":"Favourites", "Alle skigebieden":"All ski areas", "Skigebieden":"Ski areas", "Skigebieden laden…":"Loading ski areas…",
 "Mijn locatie":"My location", "Zoom naar route":"Zoom to route", "Heel skigebied":"Whole ski area", "Kaartlagen":"Map layers", "Route tekenen":"Draw route",
 "Noodgeval (SOS)":"Emergency (SOS)", "Noodgeval":"Emergency", "Groep":"Group", "Open en dicht vandaag":"Open and closed today", "Paneel openen of sluiten":"Open or close panel",
 "Sluiten":"Close", "Klaar":"Done", "Laatste punt weghalen":"Remove last point", "Alle punten wissen":"Clear all points", "Alles wissen":"Clear all",
 "Tik je startpunt aan: een liftstation, kruising of piste":"Tap your starting point: a lift station, junction or run", "Tik op liftstations, kruisingen of pistes":"Tap lift stations, junctions or runs",
 "Tik het volgende punt aan":"Tap the next point", "Start bij jou. Tik het eerste punt aan.":"Starts at you. Tap the first point.",
 "Tik het volgende punt aan om de route verder te tekenen.":"Tap the next point to continue drawing.",
 "Start navigatie":"Start navigation", "Navigatie stoppen":"Stop navigation", "Naar het dal":"To the valley", "Routebeschrijving":"Directions", "Hoogteprofiel":"Elevation profile",
 "Terug naar het vertrekpunt":"Back to the start", "Terug bij je vertrekpunt":"Back at your start", "Je bent er bijna":"Almost there", "Je bent op je bestemming.":"You have arrived.",
 "Kies een vertrekpunt en een bestemming, of tik op een piste.":"Choose a start and a destination, or tap a run.",
 "Je bent al op je bestemming. Kies een andere bestemming.":"You are already at your destination. Choose another one.",
 "Geen route gevonden.":"No route found.", "Geen route gevonden":"No route found", "Probeer:":"Try:", "kies een hoger niveau":"choose a higher level", "neem skiroutes mee":"include ski routes",
 "open een gesloten piste":"open a closed run", "Sommige delen van een skigebied zijn alleen met de skibus bereikbaar; die staan niet in de kaart.":"Some parts of a ski area can only be reached by ski bus; those are not on the map.",
 "met deze instellingen.":"with these settings.", "Ski deze piste":"Ski this run", "Neem deze lift":"Take this lift", "Hierheen":"Go here", "Vertrek hier":"Start here",
 "Piste afsluiten":"Close run", "Lift afsluiten":"Close lift", "Lengte":"Length", "Dalen":"Descent", "Stijgen":"Ascent", "Duur":"Duration", "Als tussenstop in mijn route":"Add as a stop on my route",
 "Weer en sneeuw laden…":"Loading weather and snow…", "Weer niet beschikbaar. Geen verbinding?":"Weather unavailable. No connection?", "Wind":"Wind", "Gevoel":"Feels like", "Zicht":"Visibility",
 "Sneeuw":"Snow", "Vers":"Fresh", "0°-grens":"Freezing level", "op de top":"at the top", "op de top (model)":"at the top (model)", "laatste 24 uur":"last 24 hours", "vriespunt":"freezing point",
 "Vandaag":"Today", "Morgen":"Tomorrow", "Lawinebericht":"Avalanche report", "Offline":"Offline",
 "Open en dicht":"Open and closed", "Officiële liftstatus":"Official lift status", "Zoek liftstatus":"Find lift status", "Delen met groep":"Share with group",
 "Laat je groep deze code scannen":"Let your group scan this code", "Of stuur de link. Wie hem opent, krijgt dezelfde liften en pistes op dicht, alleen voor vandaag.":"Or send the link. Whoever opens it gets the same closed lifts and runs, for today only.",
 "Stuur link":"Send link", "Kopieer":"Copy", "Zoek lift of piste, naam of nummer":"Search lift or run, name or number", "Zoek lift of piste":"Search lift or run",
 "Liften":"Lifts", "Pistes":"Runs", "Alles weer open":"Reopen all", "Zet ze op dicht":"Mark them closed", "Mogelijk dicht door wind":"Possibly closed due to wind",
 "Samen skiën":"Ski together", "Jouw groep":"Your group", "Jouw naam":"Your name", "Bijvoorbeeld Thom":"For example Thom", "Nieuwe groep maken":"Create new group",
 "of doe mee met een code":"or join with a code", "Groepscode":"Group code", "Meedoen":"Join", "Laat de anderen deze code scannen of stuur de link.":"Let the others scan this code or send the link.",
 "Stuur mijn route naar de groep":"Send my route to the group", "Stuur deze route naar je groep":"Send this route to your group", "Leden":"Members",
 "Route van de groep automatisch volgen":"Follow the group's route automatically", "Mijn positie delen met de groep":"Share my position with the group", "Groep verlaten":"Leave group",
 "Berichten gaan via ntfy.sh, een gratis openbare dienst. Alleen wie de groepscode heeft kan meekijken, en berichten verdwijnen daar na 12 uur.":"Messages go through ntfy.sh, a free public service. Only people with the group code can follow along, and messages disappear there after 12 hours.",
 "Eén persoon kiest de bestemming, iedereen krijgt meteen de route ernaartoe vanaf zijn eigen plek. En je ziet elkaar op de kaart.":"One person picks the destination; everyone instantly gets the route there from where they are. And you see each other on the map.",
 "Nog niemand anders. Laat ze de code scannen.":"Nobody else yet. Let them scan the code.", "positie niet gedeeld":"position not shared", "positie nog onbekend":"position not known yet", "in de buurt":"nearby",
 "Hulp nodig?":"Need help?", "Jouw locatie, lees dit voor aan de hulpdienst":"Your location, read this to the emergency services", "Kopiëren":"Copy", "Delen":"Share",
 "Europees alarmnummer, werkt in heel Europa":"European emergency number, works all over Europe", "Nauwkeurig":"Accuracy", "Hoogte":"Altitude", "Waar":"Where", "onbekend":"unknown",
 "Niet bij een piste of lift":"Not near a run or lift", "Zorg voor je eigen veiligheid":"Keep yourself safe", "en die van het slachtoffer.":"and the injured person.",
 "Markeer de plek":"Mark the spot", "boven het slachtoffer met gekruiste ski's, zodat anderen afremmen.":"above the injured person with crossed skis, so others slow down.",
 "Houd het slachtoffer warm":"Keep the injured person warm", "en blijf erbij tot de hulp er is.":"and stay with them until help arrives.", "Geen bereik?":"No signal?",
 "Stuur iemand naar de dichtstbijzijnde lift of hut en waarschuw het personeel.":"Send someone to the nearest lift or hut and alert the staff.",
 "Skidagboek":"Ski diary", "Houd je skidag bij: kilometers, hoogtemeters en topsnelheid":"Track your ski day: distance, vertical and top speed", "Opname":"Recording",
 "Begin met opnemen":"Start recording", "Verder opnemen":"Resume recording", "Opname stoppen":"Stop recording", "Terug naar vandaag":"Back to today", "Eerdere dag":"Earlier day",
 "geskied":"skied", "Omlaag":"Down", "Top":"Top", "Afdalingen":"Runs", "Op de berg":"On the mountain", "In de lift":"On lifts", "Deel mijn dag":"Share my day",
 "Mijn spoor op de kaart tonen":"Show my track on the map", "Scherm aan houden tijdens opnemen":"Keep screen on while recording", "Mijn skidagen":"My ski days",
 "Je telefoon pauzeert web-apps als het scherm uit gaat. Laat de app open staan, of zet \"Scherm aan houden\" aan (kost meer batterij). Het spoor blijft alleen op deze telefoon.":"Your phone pauses web apps when the screen turns off. Keep the app open, or turn on \"Keep screen on\" (uses more battery). The track stays on this phone only.",
 "Opname loopt. Ga skiën!":"Recording. Go skiing!", "wacht op GPS…":"waiting for GPS…", "Taal":"Language",
 "Locatie zoeken…":"Finding location…", "Locatie zoeken… Ga zo mogelijk naar een open plek.":"Finding location… Move to an open spot if you can.",
 "Weer laden…":"Loading weather…", "Kaart laden…":"Loading map…", "Lijst kon niet laden. Herlaad de app.":"The list could not load. Reload the app.",
 "Laden mislukt. Controleer je verbinding.":"Loading failed. Check your connection.", "Kaartdata kon niet laden.":"Map data could not load.",
 "Tik op een piste, een lift of een liftstation.":"Tap a run, a lift or a lift station.", "Dit apparaat geeft geen locatie door.":"This device does not provide a location.",
 "Locatie geweigerd. Sta locatie toe in je browserinstellingen.":"Location denied. Allow location in your browser settings.", "Locatie niet gevonden. Probeer het buiten opnieuw.":"Location not found. Try again outside.",
 "Je bent van de route af. Nieuwe route berekend.":"You left the route. New route calculated.", "Je hebt de groep verlaten.":"You left the group.", "Vul eerst je naam in.":"Enter your name first.",
 "Vul de groepscode in.":"Enter the group code.", "Vul je naam in en tik op Meedoen.":"Enter your name and tap Join.", "Route gestuurd naar de groep.":"Route sent to the group.",
 "Versturen lukte niet. Controleer je verbinding.":"Sending failed. Check your connection.", "Kies eerst een bestemming of piste.":"Choose a destination or run first.",
 "Link gekopieerd.":"Link copied.", "Kopiëren lukte niet.":"Copying failed.", "Link gekopieerd. Plak hem in de groepsapp.":"Link copied. Paste it in your group chat.",
 "Kopiëren lukte niet. Lees de coördinaten voor.":"Copying failed. Read out the coordinates.", "Locatie gekopieerd. Plak hem in een bericht.":"Location copied. Paste it in a message.",
 "Teken of plan eerst een route.":"Draw or plan a route first.", "Dit punt staat er al.":"This point is already there.",
 "Dit punt is vanaf het vorige niet te bereiken met jouw niveau. Kies een ander punt.":"This point can't be reached from the previous one at your level. Choose another point.",
 "Kies eerst een route, dan kun je er een stop aan toevoegen.":"Choose a route first, then you can add a stop.", "Deze plek is niet in je route te passen met jouw niveau.":"This place can't be fitted into your route at your level.",
 "Kies eerst waar je nu bent (A).":"First choose where you are now (A).", "Vanaf hier is geen weg naar beneden gevonden.":"No way down was found from here.",
 "Het dagboek neemt op. Veel skiplezier!":"The diary is recording. Have fun skiing!", "Opname gestopt. Je dag is bewaard.":"Recording stopped. Your day is saved.",
 "Het skidagboek neemt weer op.":"The ski diary is recording again.", "Stop eerst de opname van vandaag.":"Stop today's recording first.",
 "Tik nog een keer om deze dag te verwijderen.":"Tap again to delete this day.", "Dag verwijderd.":"Day deleted.", "Het dagboek is vol. Verwijder een paar oude dagen.":"The diary is full. Delete a few old days.",
 "Opslaan lukte niet. Is het geheugen vol?":"Saving failed. Is storage full?", "Samenvatting gekopieerd.":"Summary copied.", "Delen lukte niet.":"Sharing failed.",
 "Alles staat weer op open.":"Everything is open again.", "Liften met windrisico op dicht gezet.":"Lifts at wind risk marked closed.", "QR-code lukte niet. Stuur de link.":"QR code failed. Send the link.",
 "De gratis dienst is even overbelast. Probeer het over een paar minuten opnieuw.":"The free service is busy. Try again in a few minutes.",
 "Verbinden…":"Connecting…", "Verbinding met de groep herstellen…":"Reconnecting to the group…", "Geen internet. Je ziet de groep weer zodra je verbinding hebt.":"No internet. You'll see the group again once you're online.",
 "Status van je groep geladen: alles open.":"Your group's status loaded: everything open.", "Liftstatus vandaag":"Lift status today", "Mijn skidag":"My ski day",
 "Gondel":"Gondola", "Stoeltjeslift":"Chairlift", "Sleeplift":"T-bar", "Kabelbaan":"Cable car", "Schotellift":"Button lift", "Touwlift":"Rope tow", "Lopende band":"Magic carpet",
 "Berghut":"Mountain hut", "Restaurant":"Restaurant", "Café":"Café", "Bar":"Bar", "Snackbar":"Snack bar", "Skiroute":"Ski route",
 "Pistedata ©":"Run data ©", "-bijdragers via":" contributors via", "Tijden zijn schattingen. Volg altijd de borden en afsluitingen ter plaatse.":"Times are estimates. Always follow the signs and closures on site.",
 "Nog geen weerbericht bewaard.":"No weather report saved yet.", "Nog niet offline.":"Not offline yet.",
 "Van de achtergrondkaart worden alleen de stukken bewaard die je hebt bekeken. Zoom thuis op wifi even rond over het gebied.":"Only the parts of the background map you have viewed are saved. Zoom around the area on wifi at home.",
 "Open dit gebied één keer met internet; daarna werkt het ook zonder bereik.":"Open this area once with internet; after that it works without signal too.",
 "Alpen":"Alps", "Pyreneeën":"Pyrenees", "Scandinavië":"Scandinavia", "Noord-Amerika":"North America",
 "Oostenrijk":"Austria", "Zwitserland":"Switzerland", "Frankrijk":"France", "Italië":"Italy", "Duitsland":"Germany", "Slovenië":"Slovenia", "Spanje":"Spain",
 "Noorwegen":"Norway", "Zweden":"Sweden", "Verenigde Staten":"United States", "Canada":"Canada", "Andorra":"Andorra", "Finland":"Finland", "Liechtenstein":"Liechtenstein",
 "Helder":"Clear", "Overwegend helder":"Mostly clear", "Half bewolkt":"Partly cloudy", "Bewolkt":"Cloudy", "Mist":"Fog", "Mist met rijp":"Freezing fog", "Lichte motregen":"Light drizzle",
 "Motregen":"Drizzle", "IJzel":"Freezing rain", "Lichte regen":"Light rain", "Regen":"Rain", "Zware regen":"Heavy rain", "Lichte sneeuw":"Light snow", "Zware sneeuw":"Heavy snow",
 "Korrelsneeuw":"Snow grains", "Regenbuien":"Rain showers", "Zware buien":"Heavy showers", "Sneeuwbuien":"Snow showers", "Zware sneeuwbuien":"Heavy snow showers",
 "Onweer":"Thunderstorm", "Onweer met hagel":"Thunderstorm with hail", "Onbekend":"Unknown", "Dicht":"Closed", "Open":"Open",
 "Bijgehouden met de Pistenplanner":"Tracked with the Pistenplanner",
 "Menu en instellingen":"Menu and settings",
 "Route wissen":"Clear route", "Route stoppen en van de kaart halen":"Stop the route and remove it from the map", "Geen route":"No route", "Kies je bestemming":"Choose your destination",
 "Tik op de kaart op je vertrekpunt, tik een piste aan, of laat de app een rondje voorstellen.":"Tap your starting point on the map, tap a run, or let the app suggest a loop.",
 "Tik op de kaart op je bestemming, of tik een piste aan.":"Tap your destination on the map, or tap a run.", "Stel een route voor":"Suggest a route",
 "Route gewist. Tik op de kaart voor een nieuwe.":"Route cleared. Tap the map for a new one.",
 "Snelste weg naar het dal":"Fastest way down to the valley",
 "Een groep maken en de route voor iedereen starten":"Create a group and start the route for everyone", "Lunchstop bij een hut op het juiste moment":"Lunch stop at a hut at the right time", "Zon en schaduw, en routes door de zon":"Sun and shade, and routes through the sun", "Terug naar je hotel of auto":"Back to your hotel or car", "Seizoensoverzicht en persoonlijke records":"Season overview and personal records", "Je skidagen als GPX-bestand":"Your ski days as a GPX file", "hoort bij Pro.":"is part of Pro.", "hoort bij Pistenplanner Pro.":"is part of Pistenplanner Pro.", "Pro staat aan op dit apparaat.":"Pro is on for this device.", "Alles voor je veiligheid blijft gratis: route plannen, navigatie, weer, de laatste-liftwaarschuwing en SOS. Meedoen met een groep is ook gratis.":"Everything for your safety stays free: route planning, navigation, weather, the last-lift warning and SOS. Joining a group is free too.", "Pro op dit apparaat uitzetten":"Turn off Pro on this device", "Koop Pro":"Buy Pro", "Binnenkort te koop":"Available soon", "Heb je al een licentiecode?":"Already have a licence key?", "Activeren":"Activate", "Na het betalen krijg je de code per e-mail. Je kunt hem op meerdere eigen apparaten gebruiken.":"After paying you get the key by email. You can use it on several of your own devices.", "Privacyverklaring":"Privacy statement", "Voorwaarden":"Terms", "Bekijk Pro":"See Pro", "Beheer Pro":"Manage Pro", "Pistenplanner Pro":"Pistenplanner Pro", "Groepen, lunchstop, zon en schaduw, je hotel of auto, en je seizoensrecords.":"Groups, lunch stop, sun and shade, your hotel or car, and your season records.", "eenmalig, voor altijd":"one-time, forever", "Vul je licentiecode in.":"Enter your licence key.", "Deze code werkt niet. Controleer of je hem goed hebt overgenomen.":"This key doesn't work. Check that you copied it correctly.", "Deze code is al op het maximale aantal apparaten gebruikt. Zet Pro eerst uit op een ander apparaat.":"This key is already used on the maximum number of devices. Turn off Pro on another device first.", "Deze code hoort niet bij de Pistenplanner.":"This key isn't for the Pistenplanner.", "Pro staat aan. Veel skiplezier!":"Pro is on. Enjoy your skiing!", "Geen verbinding met de licentieserver. Probeer het later opnieuw.":"No connection to the licence server. Please try again later.", "Pro staat uit op dit apparaat. Je kunt je code nu op een ander apparaat gebruiken.":"Pro is off on this device. You can now use your key on another device.",
 "Zon en schaduw":"Sun and shade", "Zonnige pistes opzoeken":"Prefer sunny runs", "Lunchstop toevoegen":"Add a lunch stop", "Lunchstop":"Lunch stop", "Lunchen rond":"Lunch around", "Pauze":"Break", "Zoek een plek":"Find a place", "Annuleren":"Cancel", "De app kiest een hut of restaurant op of vlak bij je route, waar je rond die tijd bent.":"The app picks a hut or restaurant on or near your route, where you'll be around that time.", "Kies eerst een route, dan zoekt de app een plek voor de lunch.":"Choose a route first, then the app finds a place for lunch.", "In dit gebied zijn nog geen hutten of restaurants bekend. Open het gebied met internet en probeer het opnieuw.":"No huts or restaurants are known in this area yet. Open the area with internet and try again.", "Geen hut of restaurant gevonden die in je route past.":"No hut or restaurant found that fits your route.", "Lunchstop weghalen":"Remove lunch stop", "Bij je auto":"At your car", "Bij je hotel":"At your hotel", "Naar je auto":"To your car", "Naar je hotel":"To your hotel", "Route naar je auto":"Route to your car", "Route naar je hotel":"Route to your hotel", "Hotel of auto bewaren":"Save hotel or car", "Waar wil je vanavond terug zijn?":"Where do you want to be tonight?", "Hotel":"Hotel", "Auto":"Car", "Mijn huidige locatie":"My current location", "Tik op de kaart":"Tap the map", "Route erheen":"Route there", "Wissen":"Clear", "Al bewaard. Kies opnieuw om de plek te veranderen.":"Already saved. Choose again to change the place.", "Bewaar 's ochtends waar je logeert of geparkeerd staat. Aan het eind van de dag brengt één knop je terug.":"In the morning, save where you're staying or parked. At the end of the day one button takes you back.", "Plek gewist.":"Place cleared.", "Kies eerst waar je nu bent (A), of zet je locatie aan.":"First choose where you are (A), or turn on your location.", "Je bent al bij je auto.":"You're already at your car.", "Je bent al bij je hotel.":"You're already at your hotel.", "Tik op de kaart waar je auto staat.":"Tap the map where your car is.", "Tik op de kaart waar je hotel is.":"Tap the map where your hotel is.", "Je auto":"Your car", "Je hotel":"Your hotel",
 "Start voor iedereen":"Start for everyone", "Nu starten":"Start now", "Niet meedoen":"Skip", "Meedoen":"Join", "Tik om mee te doen.":"Tap to join.",
 "Route gestart voor de hele groep.":"Route started for the whole group.",
 "Alles staat op":"Everything is set to", "Zet dicht wat vandaag dicht is; de routes houden er rekening mee.":"Mark closed what's closed today; routes take it into account.",
 "Binnen je instellingen kon het niet.":"Not possible within your settings.", "Boven je niveau":"Above your level", "Buiten je instellingen":"Outside your settings",
 "Grijs valt buiten je niveau. Kies je het toch, dan zoekt de app de makkelijkste weg.":"Grey is beyond your level. Pick it anyway and the app finds the easiest way.",
 "Tik op de kaart op je bestemming, of tik een piste aan. Grijs valt buiten je niveau.":"Tap your destination on the map, or tap a run. Grey is beyond your level.",
 "Hier kom je niet over de piste":"You can't get here on the slopes", "Wel kun je dichtbij komen.":"But you can get close.", "Kies een ander punt, of laat de app een rondje voorstellen.":"Choose another point, or let the app suggest a loop.",
 "Probeer een gesloten piste of lift te openen.":"Try reopening a closed run or lift.",
 "Dit deel van het skigebied is vanaf je vertrekpunt niet over pistes en liften te bereiken, bijvoorbeeld omdat je er met de skibus heen moet; die staat niet in de kaart.":"This part of the ski area can't be reached from your starting point by runs and lifts, for example because you need the ski bus; that isn't on the map.",
 "Dit punt is vanaf het vorige niet over pistes en liften te bereiken. Kies een ander punt.":"This point can't be reached from the previous one by runs and lifts. Choose another point.",
 "Snelheidsmeter tonen":"Show speedometer", "km/u":"km/h", "top":"top", "Exporteer GPX":"Export GPX", "GPX-bestand opgeslagen.":"GPX file saved.",
 "Deze dag heeft nog te weinig punten.":"This day doesn't have enough points yet.", "Seizoen":"Season", "Dagen":"Days", "Geskied":"Skied", "Per dag":"Per day",
 "Persoonlijke records":"Personal records", "Topsnelheid":"Top speed", "Langste dag":"Longest day", "Meeste hoogtemeters":"Most vertical", "Meeste afdalingen":"Most runs",
 "Favoriet gebied:":"Favourite area:",
 "Sleepliften vermijden":"Avoid T-bars and drag lifts", "Buckelpistes vermijden":"Avoid mogul runs", "Avondskiën: alleen verlichte pistes":"Night skiing: lit runs only", "Avondskiën":"Night skiing",
 "Sleepliften vermijden is fijn voor beginners en kinderen: de route neemt ze alleen als er geen andere weg is.":"Avoiding drag lifts is handy for beginners and children: the route only uses them when there's no other way.",
 "Geprepareerd":"Groomed", "Buckelpiste":"Moguls", "Niet geprepareerd":"Ungroomed", "Verlicht":"Floodlit", "Kunstsneeuw":"Snowmaking", "Bospiste":"Glades",
 "In dit gebied zijn geen verlichte pistes bekend.":"No floodlit runs are known in this area.", "Skiën":"Skiing", "Jouw tempo":"Your pace", "Rustig":"Relaxed", "Normaal":"Normal", "Sportief":"Sporty",
 "Het tempo bepaalt hoe lang een afdaling volgens de app duurt.":"Your pace sets how long the app thinks a run takes.", "Navigatie":"Navigation",
 "Scherm aan tijdens navigatie":"Keep screen on while navigating", "Weergave":"Display", "Thema":"Theme", "Automatisch":"Automatic", "Licht":"Light", "Donker":"Dark",
 "Kaartweergave en lagen":"Map style and layers", "Jouw naam in een groep":"Your name in a group", "Opslag en privacy":"Storage and privacy", "Opslag berekenen…":"Calculating storage…",
 "Wis mijn routes":"Delete my routes", "Wis skidagboek":"Delete ski diary", "Wis offline kaart":"Delete offline map", "Alles wissen":"Delete everything", "Tik nogmaals om te wissen":"Tap again to delete",
 "Alles wat je in de app doet, blijft op deze telefoon. Alleen als je een groep gebruikt, gaan je naam, route en positie via ntfy.sh naar je groepsgenoten.":"Everything you do in the app stays on this phone. Only when you use a group do your name, route and position go to your group via ntfy.sh.",
 "App":"App", "Over":"About", "Broncode op GitHub":"Source code on GitHub", "Installeren":"Install", "Installeer als app":"Install as an app", "Geïnstalleerd":"Installed",
 "Je gebruikt de Pistenplanner als app.":"You are using the Pistenplanner as an app.", "Met een eigen icoon, schermvullend en offline.":"With its own icon, full screen and offline.",
 "Op je beginscherm zetten":"Add to your home screen", "Tik in Safari op het deel-icoon en kies":"In Safari, tap the share icon and choose", "Zet op beginscherm":"Add to Home Screen",
 "Open het browsermenu (⋮) en kies":"Open the browser menu (⋮) and choose", "App installeren":"Install app", "of":"or", "Toevoegen aan startscherm":"Add to home screen",
 "Je bewaarde routes zijn gewist.":"Your saved routes have been deleted.", "Je skidagboek is gewist.":"Your ski diary has been deleted.",
 "Offline kaart gewist. Hij wordt opnieuw opgehaald zodra je hem bekijkt.":"Offline map deleted. It will be fetched again when you view it.",
 "De Pistenplanner staat nu tussen je apps.":"The Pistenplanner is now among your apps.",
 "Tijden zijn schattingen en de app kent geen echte afsluitingen of lawinegevaar. Volg altijd de borden en de pistedienst ter plaatse.":"Times are estimates and the app does not know about real closures or avalanche danger. Always follow the signs and the ski patrol on site.",
 "Pistedata en hutten ©":"Run data and huts ©", "-bijdragers (ODbL), via":" contributors (ODbL), via", ". Satellietbeelden © Esri, Maxar, Earthstar Geographics. Terreinkaart © OpenTopoMap (CC-BY-SA). Weer van":". Satellite imagery © Esri, Maxar, Earthstar Geographics. Terrain map © OpenTopoMap (CC-BY-SA). Weather from",
 ". Kaart met":". Map with", ", lettertype Barlow.":", Barlow typeface.",
 "Tik op een":"Tap a", "om hem te skiën, of op een punt om het":"to ski it, or a point to choose the", "om hem te skiën, of op een punt om de":"to ski it, or a point to choose the",
 "vertrekpunt (A)":"start (A)", "bestemming (B)":"destination (B)", "te kiezen.":".",
 "· okt 2026. Tijden zijn schattingen. Volg altijd de borden en afsluitingen ter plaatse.":"· Oct 2026. Times are estimates. Always follow the signs and closures on site.", "Liftstatus vandaag":"Lift status today", "Skiën in een groep":"Skiing as a group", "Mijn locatie (noodgeval)":"My location (emergency)",
},
de:{
 "Skigebied":"Skigebiet", "Kiezen…":"Auswählen…", "Kaartweergave":"Kartenansicht", "Satelliet":"Satellit", "Terrein":"Gelände", "Kaart":"Karte", "Lagen":"Ebenen",
 "Pistes en liften":"Pisten und Lifte", "Pistenummers":"Pistennummern", "Hutten en restaurants":"Hütten und Restaurants", "Plaatsnamen":"Ortsnamen",
 "Vertrekpunt":"Start", "Bestemming of piste":"Ziel oder Piste", "Bestemming":"Ziel", "Start vanaf mijn locatie":"Von meinem Standort starten",
 "Omdraaien":"Tauschen", "Vertrek en bestemming omdraaien":"Start und Ziel tauschen", "Kies een skigebied om te beginnen.":"Wähle ein Skigebiet, um zu beginnen.",
 "Niveau en voorkeuren":"Niveau und Einstellungen", "Jouw niveau":"Dein Niveau", "Makkelijk":"Leicht", "Gemiddeld":"Mittel", "Moeilijk":"Schwer",
 "Voorkeur":"Vorliebe", "Snelste route":"Schnellste Route", "Rustigste route":"Leichteste Route", "Openingstijden liften":"Liftöffnungszeiten",
 "Open vanaf":"Öffnet um", "Laatste lift":"Letzter Lift", "Kijk op de website van het skigebied; veel liften sluiten tussen 16:00 en 17:00, in het voorjaar later.":"Sieh auf der Website des Skigebiets nach; viele Lifte schließen zwischen 16 und 17 Uhr, im Frühling später.",
 "Skiroutes en freeride meenemen":"Skirouten und Freeride einbeziehen", "Met gondel naar beneden toestaan":"Talfahrt mit der Gondel erlauben", "Gesproken aanwijzingen":"Sprachansagen",
 "Door jou afgesloten":"Von dir gesperrt", "Alles is open.":"Alles ist offen.", "Mijn routes":"Meine Routen", "Bewaar":"Speichern", "Naam van de route":"Name der Route",
 "Naam, bijv. Ochtendrondje":"Name, z. B. Morgenrunde", "Nog geen routes bewaard. Teken of plan een route en bewaar hem hier.":"Noch keine Routen gespeichert. Zeichne oder plane eine Route und speichere sie hier.",
 "Kies een skigebied":"Skigebiet wählen", "Zoek op naam, dorp of regio":"Nach Name, Ort oder Region suchen", "Zoek skigebied":"Skigebiet suchen", "Bij mij in de buurt":"In meiner Nähe",
 "Overal":"Überall", "Alle landen":"Alle Länder", "Favorieten":"Favoriten", "Alle skigebieden":"Alle Skigebiete", "Skigebieden":"Skigebiete", "Skigebieden laden…":"Skigebiete werden geladen…",
 "Mijn locatie":"Mein Standort", "Zoom naar route":"Zur Route zoomen", "Heel skigebied":"Ganzes Skigebiet", "Kaartlagen":"Kartenebenen", "Route tekenen":"Route zeichnen",
 "Noodgeval (SOS)":"Notfall (SOS)", "Noodgeval":"Notfall", "Groep":"Gruppe", "Open en dicht vandaag":"Heute offen und geschlossen", "Paneel openen of sluiten":"Bereich öffnen oder schließen",
 "Sluiten":"Schließen", "Klaar":"Fertig", "Laatste punt weghalen":"Letzten Punkt entfernen", "Alle punten wissen":"Alle Punkte löschen", "Alles wissen":"Alles löschen",
 "Tik je startpunt aan: een liftstation, kruising of piste":"Tippe deinen Startpunkt an: eine Liftstation, Kreuzung oder Piste", "Tik op liftstations, kruisingen of pistes":"Tippe auf Liftstationen, Kreuzungen oder Pisten",
 "Tik het volgende punt aan":"Tippe den nächsten Punkt an", "Start bij jou. Tik het eerste punt aan.":"Start bei dir. Tippe den ersten Punkt an.",
 "Tik het volgende punt aan om de route verder te tekenen.":"Tippe den nächsten Punkt an, um weiterzuzeichnen.",
 "Start navigatie":"Navigation starten", "Navigatie stoppen":"Navigation beenden", "Naar het dal":"Ins Tal", "Routebeschrijving":"Wegbeschreibung", "Hoogteprofiel":"Höhenprofil",
 "Terug naar het vertrekpunt":"Zurück zum Start", "Terug bij je vertrekpunt":"Zurück am Start", "Je bent er bijna":"Fast da", "Je bent op je bestemming.":"Du bist am Ziel.",
 "Kies een vertrekpunt en een bestemming, of tik op een piste.":"Wähle Start und Ziel oder tippe auf eine Piste.",
 "Je bent al op je bestemming. Kies een andere bestemming.":"Du bist schon am Ziel. Wähle ein anderes Ziel.",
 "Geen route gevonden.":"Keine Route gefunden.", "Geen route gevonden":"Keine Route gefunden", "Probeer:":"Versuche:", "kies een hoger niveau":"wähle ein höheres Niveau", "neem skiroutes mee":"beziehe Skirouten ein",
 "open een gesloten piste":"öffne eine gesperrte Piste", "Sommige delen van een skigebied zijn alleen met de skibus bereikbaar; die staan niet in de kaart.":"Manche Teile eines Skigebiets erreicht man nur mit dem Skibus; die sind nicht auf der Karte.",
 "met deze instellingen.":"mit diesen Einstellungen.", "Ski deze piste":"Diese Piste fahren", "Neem deze lift":"Diesen Lift nehmen", "Hierheen":"Hierhin", "Vertrek hier":"Hier starten",
 "Piste afsluiten":"Piste sperren", "Lift afsluiten":"Lift sperren", "Lengte":"Länge", "Dalen":"Abfahrt", "Stijgen":"Aufstieg", "Duur":"Dauer", "Als tussenstop in mijn route":"Als Zwischenstopp in meine Route",
 "Weer en sneeuw laden…":"Wetter und Schnee werden geladen…", "Weer niet beschikbaar. Geen verbinding?":"Wetter nicht verfügbar. Keine Verbindung?", "Wind":"Wind", "Gevoel":"Gefühlt", "Zicht":"Sicht",
 "Sneeuw":"Schnee", "Vers":"Neuschnee", "0°-grens":"Nullgradgrenze", "op de top":"am Gipfel", "op de top (model)":"am Gipfel (Modell)", "laatste 24 uur":"letzte 24 Stunden", "vriespunt":"Gefrierpunkt",
 "Vandaag":"Heute", "Morgen":"Morgen", "Lawinebericht":"Lawinenbericht", "Offline":"Offline",
 "Open en dicht":"Offen und geschlossen", "Officiële liftstatus":"Offizieller Liftstatus", "Zoek liftstatus":"Liftstatus suchen", "Delen met groep":"Mit Gruppe teilen",
 "Laat je groep deze code scannen":"Lass deine Gruppe diesen Code scannen", "Of stuur de link. Wie hem opent, krijgt dezelfde liften en pistes op dicht, alleen voor vandaag.":"Oder schick den Link. Wer ihn öffnet, bekommt dieselben gesperrten Lifte und Pisten, nur für heute.",
 "Stuur link":"Link senden", "Kopieer":"Kopieren", "Zoek lift of piste, naam of nummer":"Lift oder Piste suchen, Name oder Nummer", "Zoek lift of piste":"Lift oder Piste suchen",
 "Liften":"Lifte", "Pistes":"Pisten", "Alles weer open":"Alles wieder öffnen", "Zet ze op dicht":"Als geschlossen markieren", "Mogelijk dicht door wind":"Wegen Wind evtl. geschlossen",
 "Samen skiën":"Gemeinsam Ski fahren", "Jouw groep":"Deine Gruppe", "Jouw naam":"Dein Name", "Bijvoorbeeld Thom":"Zum Beispiel Thom", "Nieuwe groep maken":"Neue Gruppe erstellen",
 "of doe mee met een code":"oder mit Code beitreten", "Groepscode":"Gruppencode", "Meedoen":"Beitreten", "Laat de anderen deze code scannen of stuur de link.":"Lass die anderen diesen Code scannen oder schick den Link.",
 "Stuur mijn route naar de groep":"Meine Route an die Gruppe senden", "Stuur deze route naar je groep":"Diese Route an deine Gruppe senden", "Leden":"Mitglieder",
 "Route van de groep automatisch volgen":"Route der Gruppe automatisch folgen", "Mijn positie delen met de groep":"Meine Position mit der Gruppe teilen", "Groep verlaten":"Gruppe verlassen",
 "Berichten gaan via ntfy.sh, een gratis openbare dienst. Alleen wie de groepscode heeft kan meekijken, en berichten verdwijnen daar na 12 uur.":"Nachrichten laufen über ntfy.sh, einen kostenlosen öffentlichen Dienst. Nur wer den Gruppencode hat, kann mitlesen, und Nachrichten verschwinden dort nach 12 Stunden.",
 "Eén persoon kiest de bestemming, iedereen krijgt meteen de route ernaartoe vanaf zijn eigen plek. En je ziet elkaar op de kaart.":"Eine Person wählt das Ziel, alle bekommen sofort die Route dorthin von ihrem eigenen Standort. Und ihr seht euch auf der Karte.",
 "Nog niemand anders. Laat ze de code scannen.":"Noch niemand sonst. Lass sie den Code scannen.", "positie niet gedeeld":"Position nicht geteilt", "positie nog onbekend":"Position noch unbekannt", "in de buurt":"in der Nähe",
 "Hulp nodig?":"Brauchst du Hilfe?", "Jouw locatie, lees dit voor aan de hulpdienst":"Dein Standort, lies ihn der Rettung vor", "Kopiëren":"Kopieren", "Delen":"Teilen",
 "Europees alarmnummer, werkt in heel Europa":"Europäischer Notruf, funktioniert in ganz Europa", "Nauwkeurig":"Genauigkeit", "Hoogte":"Höhe", "Waar":"Wo", "onbekend":"unbekannt",
 "Niet bij een piste of lift":"Nicht bei einer Piste oder einem Lift", "Zorg voor je eigen veiligheid":"Achte auf deine eigene Sicherheit", "en die van het slachtoffer.":"und die der verletzten Person.",
 "Markeer de plek":"Markiere die Stelle", "boven het slachtoffer met gekruiste ski's, zodat anderen afremmen.":"oberhalb der verletzten Person mit gekreuzten Skiern, damit andere bremsen.",
 "Houd het slachtoffer warm":"Halte die verletzte Person warm", "en blijf erbij tot de hulp er is.":"und bleib bei ihr, bis Hilfe da ist.", "Geen bereik?":"Kein Empfang?",
 "Stuur iemand naar de dichtstbijzijnde lift of hut en waarschuw het personeel.":"Schick jemanden zum nächsten Lift oder zur nächsten Hütte und alarmiere das Personal.",
 "Skidagboek":"Skitagebuch", "Houd je skidag bij: kilometers, hoogtemeters en topsnelheid":"Zeichne deinen Skitag auf: Kilometer, Höhenmeter und Höchstgeschwindigkeit", "Opname":"Aufnahme",
 "Begin met opnemen":"Aufnahme starten", "Verder opnemen":"Aufnahme fortsetzen", "Opname stoppen":"Aufnahme beenden", "Terug naar vandaag":"Zurück zu heute", "Eerdere dag":"Früherer Tag",
 "geskied":"gefahren", "Omlaag":"Abwärts", "Top":"Spitze", "Afdalingen":"Abfahrten", "Op de berg":"Am Berg", "In de lift":"Im Lift", "Deel mijn dag":"Meinen Tag teilen",
 "Mijn spoor op de kaart tonen":"Meine Spur auf der Karte zeigen", "Scherm aan houden tijdens opnemen":"Bildschirm während der Aufnahme anlassen", "Mijn skidagen":"Meine Skitage",
 "Je telefoon pauzeert web-apps als het scherm uit gaat. Laat de app open staan, of zet \"Scherm aan houden\" aan (kost meer batterij). Het spoor blijft alleen op deze telefoon.":"Dein Handy pausiert Web-Apps, wenn der Bildschirm ausgeht. Lass die App offen oder schalte \"Bildschirm anlassen\" ein (braucht mehr Akku). Die Spur bleibt nur auf diesem Handy.",
 "Opname loopt. Ga skiën!":"Aufnahme läuft. Ab auf die Piste!", "wacht op GPS…":"warte auf GPS…", "Taal":"Sprache",
 "Locatie zoeken…":"Standort wird gesucht…", "Locatie zoeken… Ga zo mogelijk naar een open plek.":"Standort wird gesucht… Geh möglichst an eine offene Stelle.",
 "Weer laden…":"Wetter wird geladen…", "Kaart laden…":"Karte wird geladen…", "Lijst kon niet laden. Herlaad de app.":"Die Liste konnte nicht laden. Lade die App neu.",
 "Laden mislukt. Controleer je verbinding.":"Laden fehlgeschlagen. Prüfe deine Verbindung.", "Kaartdata kon niet laden.":"Kartendaten konnten nicht laden.",
 "Tik op een piste, een lift of een liftstation.":"Tippe auf eine Piste, einen Lift oder eine Liftstation.", "Dit apparaat geeft geen locatie door.":"Dieses Gerät liefert keinen Standort.",
 "Locatie geweigerd. Sta locatie toe in je browserinstellingen.":"Standort verweigert. Erlaube den Standort in den Browsereinstellungen.", "Locatie niet gevonden. Probeer het buiten opnieuw.":"Standort nicht gefunden. Versuch es draußen noch einmal.",
 "Je bent van de route af. Nieuwe route berekend.":"Du hast die Route verlassen. Neue Route berechnet.", "Je hebt de groep verlaten.":"Du hast die Gruppe verlassen.", "Vul eerst je naam in.":"Gib zuerst deinen Namen ein.",
 "Vul de groepscode in.":"Gib den Gruppencode ein.", "Vul je naam in en tik op Meedoen.":"Gib deinen Namen ein und tippe auf Beitreten.", "Route gestuurd naar de groep.":"Route an die Gruppe gesendet.",
 "Versturen lukte niet. Controleer je verbinding.":"Senden fehlgeschlagen. Prüfe deine Verbindung.", "Kies eerst een bestemming of piste.":"Wähle zuerst ein Ziel oder eine Piste.",
 "Link gekopieerd.":"Link kopiert.", "Kopiëren lukte niet.":"Kopieren fehlgeschlagen.", "Link gekopieerd. Plak hem in de groepsapp.":"Link kopiert. Füge ihn in den Gruppenchat ein.",
 "Kopiëren lukte niet. Lees de coördinaten voor.":"Kopieren fehlgeschlagen. Lies die Koordinaten vor.", "Locatie gekopieerd. Plak hem in een bericht.":"Standort kopiert. Füge ihn in eine Nachricht ein.",
 "Teken of plan eerst een route.":"Zeichne oder plane zuerst eine Route.", "Dit punt staat er al.":"Dieser Punkt ist schon da.",
 "Dit punt is vanaf het vorige niet te bereiken met jouw niveau. Kies een ander punt.":"Dieser Punkt ist vom vorigen mit deinem Niveau nicht erreichbar. Wähle einen anderen Punkt.",
 "Kies eerst een route, dan kun je er een stop aan toevoegen.":"Wähle zuerst eine Route, dann kannst du einen Stopp hinzufügen.", "Deze plek is niet in je route te passen met jouw niveau.":"Dieser Ort passt mit deinem Niveau nicht in deine Route.",
 "Kies eerst waar je nu bent (A).":"Wähle zuerst, wo du gerade bist (A).", "Vanaf hier is geen weg naar beneden gevonden.":"Von hier wurde kein Weg nach unten gefunden.",
 "Het dagboek neemt op. Veel skiplezier!":"Das Tagebuch zeichnet auf. Viel Spaß beim Skifahren!", "Opname gestopt. Je dag is bewaard.":"Aufnahme beendet. Dein Tag ist gespeichert.",
 "Het skidagboek neemt weer op.":"Das Skitagebuch zeichnet wieder auf.", "Stop eerst de opname van vandaag.":"Beende zuerst die heutige Aufnahme.",
 "Tik nog een keer om deze dag te verwijderen.":"Tippe noch einmal, um diesen Tag zu löschen.", "Dag verwijderd.":"Tag gelöscht.", "Het dagboek is vol. Verwijder een paar oude dagen.":"Das Tagebuch ist voll. Lösche ein paar alte Tage.",
 "Opslaan lukte niet. Is het geheugen vol?":"Speichern fehlgeschlagen. Ist der Speicher voll?", "Samenvatting gekopieerd.":"Zusammenfassung kopiert.", "Delen lukte niet.":"Teilen fehlgeschlagen.",
 "Alles staat weer op open.":"Alles ist wieder offen.", "Liften met windrisico op dicht gezet.":"Lifte mit Windrisiko als geschlossen markiert.", "QR-code lukte niet. Stuur de link.":"QR-Code fehlgeschlagen. Schick den Link.",
 "De gratis dienst is even overbelast. Probeer het over een paar minuten opnieuw.":"Der kostenlose Dienst ist gerade überlastet. Versuch es in ein paar Minuten noch einmal.",
 "Verbinden…":"Verbinden…", "Verbinding met de groep herstellen…":"Verbindung zur Gruppe wird wiederhergestellt…", "Geen internet. Je ziet de groep weer zodra je verbinding hebt.":"Kein Internet. Du siehst die Gruppe wieder, sobald du online bist.",
 "Status van je groep geladen: alles open.":"Status deiner Gruppe geladen: alles offen.", "Liftstatus vandaag":"Liftstatus heute", "Mijn skidag":"Mein Skitag",
 "Gondel":"Gondelbahn", "Stoeltjeslift":"Sessellift", "Sleeplift":"Schlepplift", "Kabelbaan":"Seilbahn", "Schotellift":"Tellerlift", "Touwlift":"Seillift", "Lopende band":"Förderband",
 "Berghut":"Berghütte", "Restaurant":"Restaurant", "Café":"Café", "Bar":"Bar", "Snackbar":"Imbiss", "Skiroute":"Skiroute",
 "Pistedata ©":"Pistendaten ©", "-bijdragers via":"-Mitwirkende via", "Tijden zijn schattingen. Volg altijd de borden en afsluitingen ter plaatse.":"Zeiten sind Schätzungen. Beachte immer die Schilder und Sperrungen vor Ort.",
 "Nog geen weerbericht bewaard.":"Noch kein Wetterbericht gespeichert.", "Nog niet offline.":"Noch nicht offline.",
 "Van de achtergrondkaart worden alleen de stukken bewaard die je hebt bekeken. Zoom thuis op wifi even rond over het gebied.":"Von der Hintergrundkarte werden nur die Teile gespeichert, die du angesehen hast. Zoom zu Hause im WLAN kurz durch das Gebiet.",
 "Open dit gebied één keer met internet; daarna werkt het ook zonder bereik.":"Öffne dieses Gebiet einmal mit Internet; danach funktioniert es auch ohne Empfang.",
 "Alpen":"Alpen", "Pyreneeën":"Pyrenäen", "Scandinavië":"Skandinavien", "Noord-Amerika":"Nordamerika",
 "Oostenrijk":"Österreich", "Zwitserland":"Schweiz", "Frankrijk":"Frankreich", "Italië":"Italien", "Duitsland":"Deutschland", "Slovenië":"Slowenien", "Spanje":"Spanien",
 "Noorwegen":"Norwegen", "Zweden":"Schweden", "Verenigde Staten":"Vereinigte Staaten", "Canada":"Kanada", "Andorra":"Andorra", "Finland":"Finnland", "Liechtenstein":"Liechtenstein",
 "Helder":"Klar", "Overwegend helder":"Überwiegend klar", "Half bewolkt":"Teilweise bewölkt", "Bewolkt":"Bewölkt", "Mist":"Nebel", "Mist met rijp":"Gefrierender Nebel", "Lichte motregen":"Leichter Nieselregen",
 "Motregen":"Nieselregen", "IJzel":"Glatteis", "Lichte regen":"Leichter Regen", "Regen":"Regen", "Zware regen":"Starker Regen", "Lichte sneeuw":"Leichter Schneefall", "Zware sneeuw":"Starker Schneefall",
 "Korrelsneeuw":"Schneegriesel", "Regenbuien":"Regenschauer", "Zware buien":"Starke Schauer", "Sneeuwbuien":"Schneeschauer", "Zware sneeuwbuien":"Starke Schneeschauer",
 "Onweer":"Gewitter", "Onweer met hagel":"Gewitter mit Hagel", "Onbekend":"Unbekannt", "Dicht":"Geschlossen", "Open":"Offen",
 "Bijgehouden met de Pistenplanner":"Aufgezeichnet mit dem Pistenplanner",
 "Menu en instellingen":"Menü und Einstellungen",
 "Route wissen":"Route löschen", "Route stoppen en van de kaart halen":"Route beenden und von der Karte entfernen", "Geen route":"Keine Route", "Kies je bestemming":"Wähle dein Ziel",
 "Tik op de kaart op je vertrekpunt, tik een piste aan, of laat de app een rondje voorstellen.":"Tippe auf der Karte deinen Startpunkt an, tippe eine Piste an oder lass dir eine Runde vorschlagen.",
 "Tik op de kaart op je bestemming, of tik een piste aan.":"Tippe auf der Karte dein Ziel an oder tippe eine Piste an.", "Stel een route voor":"Route vorschlagen",
 "Route gewist. Tik op de kaart voor een nieuwe.":"Route gelöscht. Tippe auf die Karte für eine neue.",
 "Snelste weg naar het dal":"Schnellster Weg ins Tal",
 "Een groep maken en de route voor iedereen starten":"Eine Gruppe erstellen und die Route für alle starten", "Lunchstop bij een hut op het juiste moment":"Mittagspause in einer Hütte zur richtigen Zeit", "Zon en schaduw, en routes door de zon":"Sonne und Schatten, und Routen durch die Sonne", "Terug naar je hotel of auto":"Zurück zu deinem Hotel oder Auto", "Seizoensoverzicht en persoonlijke records":"Saisonübersicht und persönliche Rekorde", "Je skidagen als GPX-bestand":"Deine Skitage als GPX-Datei", "hoort bij Pro.":"gehört zu Pro.", "hoort bij Pistenplanner Pro.":"gehört zu Pistenplanner Pro.", "Pro staat aan op dit apparaat.":"Pro ist auf diesem Gerät aktiv.", "Alles voor je veiligheid blijft gratis: route plannen, navigatie, weer, de laatste-liftwaarschuwing en SOS. Meedoen met een groep is ook gratis.":"Alles für deine Sicherheit bleibt kostenlos: Routenplanung, Navigation, Wetter, die Letzter-Lift-Warnung und SOS. Einer Gruppe beitreten ist auch kostenlos.", "Pro op dit apparaat uitzetten":"Pro auf diesem Gerät deaktivieren", "Koop Pro":"Pro kaufen", "Binnenkort te koop":"Bald erhältlich", "Heb je al een licentiecode?":"Hast du schon einen Lizenzschlüssel?", "Activeren":"Aktivieren", "Na het betalen krijg je de code per e-mail. Je kunt hem op meerdere eigen apparaten gebruiken.":"Nach der Zahlung bekommst du den Schlüssel per E-Mail. Du kannst ihn auf mehreren eigenen Geräten nutzen.", "Privacyverklaring":"Datenschutzerklärung", "Voorwaarden":"Bedingungen", "Bekijk Pro":"Pro ansehen", "Beheer Pro":"Pro verwalten", "Pistenplanner Pro":"Pistenplanner Pro", "Groepen, lunchstop, zon en schaduw, je hotel of auto, en je seizoensrecords.":"Gruppen, Mittagspause, Sonne und Schatten, dein Hotel oder Auto und deine Saisonrekorde.", "eenmalig, voor altijd":"einmalig, für immer", "Vul je licentiecode in.":"Gib deinen Lizenzschlüssel ein.", "Deze code werkt niet. Controleer of je hem goed hebt overgenomen.":"Dieser Schlüssel funktioniert nicht. Prüfe, ob du ihn richtig übernommen hast.", "Deze code is al op het maximale aantal apparaten gebruikt. Zet Pro eerst uit op een ander apparaat.":"Dieser Schlüssel wird bereits auf der maximalen Anzahl Geräte genutzt. Deaktiviere Pro zuerst auf einem anderen Gerät.", "Deze code hoort niet bij de Pistenplanner.":"Dieser Schlüssel gehört nicht zum Pistenplanner.", "Pro staat aan. Veel skiplezier!":"Pro ist aktiv. Viel Spaß beim Skifahren!", "Geen verbinding met de licentieserver. Probeer het later opnieuw.":"Keine Verbindung zum Lizenzserver. Bitte versuche es später erneut.", "Pro staat uit op dit apparaat. Je kunt je code nu op een ander apparaat gebruiken.":"Pro ist auf diesem Gerät deaktiviert. Du kannst deinen Schlüssel jetzt auf einem anderen Gerät nutzen.",
 "Zon en schaduw":"Sonne und Schatten", "Zonnige pistes opzoeken":"Sonnige Pisten bevorzugen", "Lunchstop toevoegen":"Mittagspause einplanen", "Lunchstop":"Mittagspause", "Lunchen rond":"Mittagessen gegen", "Pauze":"Pause", "Zoek een plek":"Ort suchen", "De app kiest een hut of restaurant op of vlak bij je route, waar je rond die tijd bent.":"Die App wählt eine Hütte oder ein Restaurant an oder nahe deiner Route, wo du um diese Zeit bist.", "Kies eerst een route, dan zoekt de app een plek voor de lunch.":"Wähle zuerst eine Route, dann sucht die App einen Ort fürs Mittagessen.", "In dit gebied zijn nog geen hutten of restaurants bekend. Open het gebied met internet en probeer het opnieuw.":"In diesem Gebiet sind noch keine Hütten oder Restaurants bekannt. Öffne das Gebiet mit Internet und versuche es erneut.", "Geen hut of restaurant gevonden die in je route past.":"Keine Hütte und kein Restaurant gefunden, die in deine Route passen.", "Lunchstop weghalen":"Mittagspause entfernen", "Bij je auto":"Bei deinem Auto", "Bij je hotel":"Bei deinem Hotel", "Naar je auto":"Zu deinem Auto", "Naar je hotel":"Zu deinem Hotel", "Route naar je auto":"Route zu deinem Auto", "Route naar je hotel":"Route zu deinem Hotel", "Hotel of auto bewaren":"Hotel oder Auto speichern", "Waar wil je vanavond terug zijn?":"Wo willst du heute Abend zurück sein?", "Hotel":"Hotel", "Auto":"Auto", "Mijn huidige locatie":"Mein aktueller Standort", "Tik op de kaart":"Auf die Karte tippen", "Route erheen":"Route dorthin", "Wissen":"Löschen", "Al bewaard. Kies opnieuw om de plek te veranderen.":"Bereits gespeichert. Wähle erneut, um den Ort zu ändern.", "Bewaar 's ochtends waar je logeert of geparkeerd staat. Aan het eind van de dag brengt één knop je terug.":"Speichere morgens, wo du wohnst oder parkst. Am Ende des Tages bringt dich ein Knopf zurück.", "Plek gewist.":"Ort gelöscht.", "Kies eerst waar je nu bent (A), of zet je locatie aan.":"Wähle zuerst, wo du bist (A), oder schalte deinen Standort ein.", "Je bent al bij je auto.":"Du bist schon bei deinem Auto.", "Je bent al bij je hotel.":"Du bist schon bei deinem Hotel.", "Tik op de kaart waar je auto staat.":"Tippe auf der Karte an, wo dein Auto steht.", "Tik op de kaart waar je hotel is.":"Tippe auf der Karte an, wo dein Hotel ist.", "Je auto":"Dein Auto", "Je hotel":"Dein Hotel",
 "Start voor iedereen":"Für alle starten", "Nu starten":"Jetzt starten", "Niet meedoen":"Nicht mitmachen", "Meedoen":"Mitmachen", "Tik om mee te doen.":"Tippe, um mitzumachen.",
 "Route gestart voor de hele groep.":"Route für die ganze Gruppe gestartet.",
 "Alles staat op":"Alles steht auf", "open":"offen", "Zet dicht wat vandaag dicht is; de routes houden er rekening mee.":"Markiere als geschlossen, was heute zu ist; die Routen berücksichtigen das.",
 "Binnen je instellingen kon het niet.":"Mit deinen Einstellungen ging es nicht.", "Boven je niveau":"Über deinem Niveau", "Buiten je instellingen":"Außerhalb deiner Einstellungen",
 "Grijs valt buiten je niveau. Kies je het toch, dan zoekt de app de makkelijkste weg.":"Grau liegt über deinem Niveau. Wählst du es trotzdem, sucht die App den leichtesten Weg.",
 "Tik op de kaart op je bestemming, of tik een piste aan. Grijs valt buiten je niveau.":"Tippe auf der Karte dein Ziel an oder tippe eine Piste an. Grau liegt über deinem Niveau.",
 "Hier kom je niet over de piste":"Hierhin kommst du nicht über die Piste", "Wel kun je dichtbij komen.":"Aber du kannst nah herankommen.", "Kies een ander punt, of laat de app een rondje voorstellen.":"Wähle einen anderen Punkt oder lass dir eine Runde vorschlagen.",
 "Probeer een gesloten piste of lift te openen.":"Versuche, eine geschlossene Piste oder einen Lift zu öffnen.",
 "Dit deel van het skigebied is vanaf je vertrekpunt niet over pistes en liften te bereiken, bijvoorbeeld omdat je er met de skibus heen moet; die staat niet in de kaart.":"Dieser Teil des Skigebiets ist von deinem Startpunkt aus nicht über Pisten und Lifte erreichbar, zum Beispiel weil du den Skibus brauchst; der ist nicht auf der Karte.",
 "Dit punt is vanaf het vorige niet over pistes en liften te bereiken. Kies een ander punt.":"Dieser Punkt ist vom vorigen nicht über Pisten und Lifte erreichbar. Wähle einen anderen Punkt.",
 "Snelheidsmeter tonen":"Tacho anzeigen", "km/u":"km/h", "top":"max", "Exporteer GPX":"GPX exportieren", "GPX-bestand opgeslagen.":"GPX-Datei gespeichert.",
 "Deze dag heeft nog te weinig punten.":"Dieser Tag hat noch zu wenige Punkte.", "Seizoen":"Saison", "Dagen":"Tage", "Geskied":"Gefahren", "Per dag":"Pro Tag",
 "Persoonlijke records":"Persönliche Rekorde", "Topsnelheid":"Höchstgeschwindigkeit", "Langste dag":"Längster Tag", "Meeste hoogtemeters":"Meiste Höhenmeter", "Meeste afdalingen":"Meiste Abfahrten",
 "Favoriet gebied:":"Lieblingsgebiet:",
 "Sleepliften vermijden":"Schlepplifte meiden", "Buckelpistes vermijden":"Buckelpisten meiden", "Avondskiën: alleen verlichte pistes":"Nachtskilauf: nur beleuchtete Pisten", "Avondskiën":"Nachtskilauf",
 "Sleepliften vermijden is fijn voor beginners en kinderen: de route neemt ze alleen als er geen andere weg is.":"Schlepplifte meiden ist praktisch für Anfänger und Kinder: Die Route nutzt sie nur, wenn es keinen anderen Weg gibt.",
 "Geprepareerd":"Präpariert", "Buckelpiste":"Buckelpiste", "Niet geprepareerd":"Nicht präpariert", "Verlicht":"Beleuchtet", "Kunstsneeuw":"Beschneit", "Bospiste":"Waldpiste",
 "In dit gebied zijn geen verlichte pistes bekend.":"In diesem Gebiet sind keine beleuchteten Pisten bekannt.", "Skiën":"Skifahren", "Jouw tempo":"Dein Tempo", "Rustig":"Gemütlich", "Normaal":"Normal", "Sportief":"Sportlich",
 "Het tempo bepaalt hoe lang een afdaling volgens de app duurt.":"Das Tempo bestimmt, wie lange eine Abfahrt laut App dauert.", "Navigatie":"Navigation",
 "Scherm aan tijdens navigatie":"Bildschirm während der Navigation anlassen", "Weergave":"Darstellung", "Thema":"Design", "Automatisch":"Automatisch", "Licht":"Hell", "Donker":"Dunkel",
 "Kaartweergave en lagen":"Kartenansicht und Ebenen", "Jouw naam in een groep":"Dein Name in einer Gruppe", "Opslag en privacy":"Speicher und Datenschutz", "Opslag berekenen…":"Speicher wird berechnet…",
 "Wis mijn routes":"Meine Routen löschen", "Wis skidagboek":"Skitagebuch löschen", "Wis offline kaart":"Offline-Karte löschen", "Alles wissen":"Alles löschen", "Tik nogmaals om te wissen":"Zum Löschen erneut tippen",
 "Alles wat je in de app doet, blijft op deze telefoon. Alleen als je een groep gebruikt, gaan je naam, route en positie via ntfy.sh naar je groepsgenoten.":"Alles, was du in der App machst, bleibt auf diesem Handy. Nur wenn du eine Gruppe nutzt, gehen Name, Route und Position über ntfy.sh an deine Gruppe.",
 "App":"App", "Over":"Über", "Broncode op GitHub":"Quellcode auf GitHub", "Installeren":"Installieren", "Installeer als app":"Als App installieren", "Geïnstalleerd":"Installiert",
 "Je gebruikt de Pistenplanner als app.":"Du nutzt den Pistenplanner als App.", "Met een eigen icoon, schermvullend en offline.":"Mit eigenem Symbol, im Vollbild und offline.",
 "Op je beginscherm zetten":"Zum Startbildschirm hinzufügen", "Tik in Safari op het deel-icoon en kies":"Tippe in Safari auf das Teilen-Symbol und wähle", "Zet op beginscherm":"Zum Home-Bildschirm",
 "Open het browsermenu (⋮) en kies":"Öffne das Browsermenü (⋮) und wähle", "App installeren":"App installieren", "of":"oder", "Toevoegen aan startscherm":"Zum Startbildschirm hinzufügen",
 "Je bewaarde routes zijn gewist.":"Deine gespeicherten Routen wurden gelöscht.", "Je skidagboek is gewist.":"Dein Skitagebuch wurde gelöscht.",
 "Offline kaart gewist. Hij wordt opnieuw opgehaald zodra je hem bekijkt.":"Offline-Karte gelöscht. Sie wird neu geladen, sobald du sie ansiehst.",
 "De Pistenplanner staat nu tussen je apps.":"Der Pistenplanner ist jetzt bei deinen Apps.",
 "Tijden zijn schattingen en de app kent geen echte afsluitingen of lawinegevaar. Volg altijd de borden en de pistedienst ter plaatse.":"Zeiten sind Schätzungen, und die App kennt keine echten Sperrungen oder Lawinengefahr. Beachte immer die Schilder und den Pistendienst vor Ort.",
 "Pistedata en hutten ©":"Pistendaten und Hütten ©", "-bijdragers (ODbL), via":"-Mitwirkende (ODbL), über", ". Satellietbeelden © Esri, Maxar, Earthstar Geographics. Terreinkaart © OpenTopoMap (CC-BY-SA). Weer van":". Satellitenbilder © Esri, Maxar, Earthstar Geographics. Geländekarte © OpenTopoMap (CC-BY-SA). Wetter von",
 ". Kaart met":". Karte mit", ", lettertype Barlow.":", Schrift Barlow.",
 "Tik op een":"Tippe auf eine", "om hem te skiën, of op een punt om het":", um sie zu fahren, oder auf einen Punkt, um den", "om hem te skiën, of op een punt om de":", um sie zu fahren, oder auf einen Punkt, um das",
 "vertrekpunt (A)":"Start (A)", "bestemming (B)":"Ziel (B)", "te kiezen.":"zu wählen.",
 "· okt 2026. Tijden zijn schattingen. Volg altijd de borden en afsluitingen ter plaatse.":"· Okt. 2026. Zeiten sind Schätzungen. Beachte immer die Schilder und Sperrungen vor Ort.", "Liftstatus vandaag":"Liftstatus heute", "Skiën in een groep":"Gemeinsam Skifahren", "Mijn locatie (noodgeval)":"Mein Standort (Notfall)",
}};

// ---------- zinnen met namen of getallen ----------
const N = "([\\d.,]+)";
// onderdelen van "Deze route gaat via …" (ruimer gezochte route)
const DIFF_T = {groene:["green","grüne"], blauwe:["blue","blaue"], rode:["red","rote"], zwarte:["black","schwarze"], dubbelzwarte:["double black","doppelschwarze"], ongemarkeerde:["unmarked","unmarkierte"]};
function viaT(s, l){
  return s.split(" en ").map(b => { let m;
    if((m = b.match(/^één skiroute boven je niveau$/))) return ["one ski route above your level", "eine Skiroute über deinem Niveau"][l];
    if((m = b.match(/^één (\S+) piste boven je niveau$/))) return [`one ${DIFF_T[m[1]]?.[0] || m[1]} run above your level`, `eine ${DIFF_T[m[1]]?.[1] || m[1]} Piste über deinem Niveau`][l];
    if((m = b.match(/^(\d+) pistes boven je niveau$/))) return [`${m[1]} runs above your level`, `${m[1]} Pisten über deinem Niveau`][l];
    if(b === "één keer met de lift naar beneden") return ["riding a lift down once", "einmal mit dem Lift nach unten"][l];
    if((m = b.match(/^(\d+) keer met de lift naar beneden$/))) return [`riding a lift down ${m[1]} times`, `${m[1]}-mal mit dem Lift nach unten`][l];
    if((m = b.match(/^(.+) lopen$/))) return [`walking ${m[1]}`, `${m[1]} zu Fuß`][l];
    return b;
  }).join([" and ", " und "][l]);
}
const P = (rx, en, de) => [new RegExp(rx), en, de];
const PATTERNS = [
 P("^Gekocht met (.+)\\.$", (m) => `Bought with ${m[1]}.`, (m) => `Gekauft mit ${m[1]}.`),
 P("^Lunch bij (.+) rond (\\d\\d:\\d\\d)\\. Dichter bij (\\d\\d:\\d\\d) lukt niet met deze route\\.$", (m) => `Lunch at ${m[1]} around ${m[2]}. Closer to ${m[3]} isn't possible with this route.`, (m) => `Mittagessen bei ${m[1]} gegen ${m[2]}. Näher an ${m[3]} geht mit dieser Route nicht.`),
 P("^Lunch bij (.+) rond (\\d\\d:\\d\\d)\\.$", (m) => `Lunch at ${m[1]} around ${m[2]}.`, (m) => `Mittagessen bei ${m[1]} gegen ${m[2]}.`),
 P("^Lunch bij (.+)$", (m) => `Lunch at ${m[1]}`, (m) => `Mittagessen bei ${m[1]}`),
 P("^Lunch: (.+)$", (m) => `Lunch: ${m[1]}`, (m) => `Mittag: ${m[1]}`),
 P("^Rond (\\d\\d:\\d\\d) · (\\d+) min pauze$", (m) => `Around ${m[1]} · ${m[2]} min break`, (m) => `Gegen ${m[1]} · ${m[2]} Min. Pause`),
 P("^Daarna nog (.+) lopen$", (m) => `Then walk ${m[1]}`, (m) => `Danach noch ${m[1]} zu Fuß`),
 P("^Om (\\d\\d:\\d\\d) in de zon$", (m) => `In the sun at ${m[1]}`, (m) => `Um ${m[1]} in der Sonne`),
 P("^Om (\\d\\d:\\d\\d) in de schaduw$", (m) => `In the shade at ${m[1]}`, (m) => `Um ${m[1]} im Schatten`),
 P("^Om (\\d\\d:\\d\\d): (\\d+)% van de pistes in de zon \\(schatting\\)\\.$", (m) => `At ${m[1]}: ${m[2]}% of the runs in the sun (estimate).`, (m) => `Um ${m[1]}: ${m[2]} % der Pisten in der Sonne (Schätzung).`),
 P("^Om (\\d\\d:\\d\\d) staat de zon te laag\\. Alles ligt in de schaduw\\.$", (m) => `At ${m[1]} the sun is too low. Everything is in the shade.`, (m) => `Um ${m[1]} steht die Sonne zu tief. Alles liegt im Schatten.`),
 P("^(Je auto|Je hotel) is bewaard, (.+) van de dichtstbijzijnde piste of lift\\.$", (m) => `${m[1] === "Je auto" ? "Your car" : "Your hotel"} is saved, ${m[2]} from the nearest run or lift.`, (m) => `${m[1] === "Je auto" ? "Dein Auto" : "Dein Hotel"} ist gespeichert, ${m[2]} von der nächsten Piste oder dem nächsten Lift.`),
 P("^(Je auto|Je hotel) is bewaard\\.$", (m) => `${m[1] === "Je auto" ? "Your car" : "Your hotel"} is saved.`, (m) => `${m[1] === "Je auto" ? "Dein Auto" : "Dein Hotel"} ist gespeichert.`),
 P("^(.+) start de route$", (m) => `${m[1]} is starting the route`, (m) => `${m[1]} startet die Route`),
 P("^Navigatie start over (\\d+) s$", (m) => `Navigation starts in ${m[1]} s`, (m) => `Navigation startet in ${m[1]} s`),
 P("^(.+) heeft de route voor iedereen gestart\\.$", (m) => `${m[1]} started the route for everyone.`, (m) => `${m[1]} hat die Route für alle gestartet.`),
 P("^(.+) start de route\\. Navigatie start over vijf seconden\\.$", (m) => `${m[1]} is starting the route. Navigation starts in five seconds.`, (m) => `${m[1]} startet die Route. Die Navigation startet in fünf Sekunden.`),
 P("^(.+) heeft de route gestart\\.$", (m) => `${m[1]} started the route.`, (m) => `${m[1]} hat die Route gestartet.`),
 P("^De liften zijn nu dicht\\. Tijden zijn gerekend vanaf de opening om (.+)\\.$", (m) => `The lifts are closed now. Times are calculated from opening at ${m[1]}.`, (m) => `Die Lifte sind jetzt geschlossen. Zeiten ab Öffnung um ${m[1]} berechnet.`),
 P("^Hoogteprofiel van (.+) tot (.+) meter over (.+)$", (m) => `Elevation profile from ${m[1]} to ${m[2]} metres over ${m[3]}`, (m) => `Höhenprofil von ${m[1]} bis ${m[2]} Meter über ${m[3]}`),
 P("^Als favoriet bewaren: (.+)$", (m) => `Save as favourite: ${m[1]}`, (m) => `Als Favorit speichern: ${m[1]}`),
 P("^Uit favorieten halen: (.+)$", (m) => `Remove from favourites: ${m[1]}`, (m) => `Aus Favoriten entfernen: ${m[1]}`),
 P("^Naar het dichtstbijzijnde punt · (.+) van je bestemming$", (m) => `To the nearest point · ${m[1]} from your destination`, (m) => `Zum nächsten Punkt · ${m[1]} von deinem Ziel`),
 P("^Deze route gaat via (.+)\.$", (m) => `This route uses ${viaT(m[1], 0)}.`, (m) => `Diese Route führt über ${viaT(m[1], 1)}.`),
 P("^\\((\\d+) (dag|dagen)\\)$", (m) => `(${m[1]} ${m[1] === "1" ? "day" : "days"})`, (m) => `(${m[1]} ${m[1] === "1" ? "Tag" : "Tage"})`),
 P("^(\\d+) km/u$", (m) => `${m[1]} km/h`, (m) => `${m[1]} km/h`),
 P("^(.+) hm$", (m) => `${m[1]} m`, (m) => `${m[1]} Hm`),
 P("^Avondskiën: (.+) km verlichte piste\.$", (m) => `Night skiing: ${m[1]} km of floodlit runs.`, (m) => `Nachtskilauf: ${m[1]} km beleuchtete Pisten.`),
 P("^Versie (.+) · (.+) skigebieden · kaartdata (.+)$", (m) => `Version ${m[1]} · ${m[2]} ski areas · map data ${m[3]}`, (m) => `Version ${m[1]} · ${m[2]} Skigebiete · Kartendaten ${m[3]}`),
 P("^(.+) MB in gebruik · (\\d+) bewaarde (route|routes) · (\\d+) (skidag|skidagen) in het dagboek$", (m) => `${m[1]} MB in use · ${m[2]} saved ${m[2] === "1" ? "route" : "routes"} · ${m[4]} ski ${m[4] === "1" ? "day" : "days"} in the diary`, (m) => `${m[1]} MB belegt · ${m[2]} gespeicherte ${m[2] === "1" ? "Route" : "Routen"} · ${m[4]} ${m[4] === "1" ? "Skitag" : "Skitage"} im Tagebuch`),
 P("^(\\d+) bewaarde (route|routes) · (\\d+) (skidag|skidagen) in het dagboek$", (m) => `${m[1]} saved ${m[1] === "1" ? "route" : "routes"} · ${m[3]} ski ${m[3] === "1" ? "day" : "days"} in the diary`, (m) => `${m[1]} gespeicherte ${m[1] === "1" ? "Route" : "Routen"} · ${m[3]} ${m[3] === "1" ? "Skitag" : "Skitage"} im Tagebuch`),
 P("^Je naam is nu (.+)\\.$", (m) => `Your name is now ${m[1]}.`, (m) => `Dein Name ist jetzt ${m[1]}.`),
 P("^(\\d+)u (\\d\\d)$", (m) => `${m[1]} h ${m[2]}`, (m) => `${m[1]} Std. ${m[2]}`),
 // gesproken: "Volg piste 6, 1,2 kilometer." (eerst, anders pakt "Volg ..." de hele zin)
 P("^(.+), " + N + " (kilometer|meter)\\.$", (m) => `${tr(m[1])}, ${m[2]} ${m[3] === "kilometer" ? "kilometres" : "metres"}.`, (m) => `${tr(m[1])}, ${m[2]} ${m[3] === "kilometer" ? "Kilometer" : "Meter"}.`),
 // routestappen
 P("^(Neem) de " + LIFT_RX + "( .*)?$", (m) => `Take ${liftT(m[2], m[3])}`, (m) => `Nimm ${liftT(m[2], m[3], "acc")}`),
 P("^Ga met de " + LIFT_RX + "( .*)? naar beneden$", (m) => `Ride ${liftT(m[1], m[2])} down`, (m) => `Fahre mit ${liftT(m[1], m[2], "dat")} hinunter`),
 P("^(stap|Stap) in bij de " + LIFT_RX + "( .*)?$", (m) => `${m[1][0] === "S" ? "B" : "b"}oard ${liftT(m[2], m[3])}`, (m) => `${m[1][0] === "S" ? "S" : "s"}teig in ${liftT(m[2], m[3], "acc")} ein`),
 P("^(Volg|volg) (.+)$", (m) => `${m[1][0] === "V" ? "F" : "f"}ollow ${pisteT(m[2])}`, (m) => `${m[1][0] === "V" ? "F" : "f"}olge ${pisteT(m[2], "dat")}`),
 P("^(Houd links aan|Houd rechts aan|Ga linksaf|Ga rechtsaf|Rechtdoor|houd links aan|houd rechts aan|ga linksaf|ga rechtsaf|rechtdoor) naar (.+)$",
   (m) => { const t = TURN.en[m[1].toLowerCase()]; return `${m[1][0] === m[1][0].toUpperCase() ? uc1(t) : t} ${pisteT(m[2])}`; },
   (m) => { const t = TURN.de[m[1].toLowerCase()].replace(/ zu$/, ""); return `${m[1][0] === m[1][0].toUpperCase() ? uc1(t) : t} ${deZu(m[2])}`; }),
 P("^(Loop|loop) of skate (.+)$", (m) => `${m[1][0] === "L" ? "W" : "w"}alk or skate ${m[2]}`, (m) => `${m[1][0] === "L" ? "G" : "g"}ehen oder skaten ${m[2]}`),
 P("^Over " + N + " meter: (.+)\\.$", (m) => `In ${m[1]} metres: ${tr(m[2])}.`, (m) => `In ${m[1]} Metern: ${tr(m[2])}.`),
 P("^Skiën: (.+)$", (m) => `Ski: ${pisteT(m[1])}`, (m) => `Fahren: ${pisteT(m[1])}`),
 P("^Getekende route · (\\d+) (punt|punten)$", (m) => `Drawn route · ${m[1]} ${m[1] === "1" ? "point" : "points"}`, (m) => `Gezeichnete Route · ${m[1]} ${m[1] === "1" ? "Punkt" : "Punkte"}`),
 P("^Getekende route \\((\\d+) punten\\)$", (m) => `Drawn route (${m[1]} points)`, (m) => `Gezeichnete Route (${m[1]} Punkte)`),
 P("^Mijn locatie \\((.+)\\)$", (m) => `My location (${placeOrSelf(m[1])})`, (m) => `Mein Standort (${placeOrSelf(m[1])})`),
 P("^Rondje via (.+)$", (m) => `Loop via ${placeOrSelf(m[1])}`, (m) => `Runde über ${placeOrSelf(m[1])}`),
 P("^Via (.+)$", (m) => `Via ${placeOrSelf(m[1])}`, (m) => `Über ${placeOrSelf(m[1])}`),
 P("^Route van (.+)$", (m) => `Route from ${m[1]}`, (m) => `Route von ${m[1]}`),
 P("^Einde (.+)$", (m) => placeT("Einde " + m[1]), (m) => placeT("Einde " + m[1])),
 // regels onder de stappen
 P("^Naar (.+)$", (m) => `To ${placeOrSelf(m[1])}`, (m) => `Zu ${placeOrSelf(m[1])}`),
 // samenvatting
 P("^" + N + " km piste · klaar om (.+)$", (m) => `${m[1]} km of runs · done at ${m[2]}`, (m) => `${m[1]} km Piste · fertig um ${m[2]}`),
 P("^Aankomst rond (.+)$", (m) => `Arrival around ${m[1]}`, (m) => `Ankunft gegen ${m[1]}`),
 P("^(\\d+) pistes$", (m) => `${m[1]} runs`, (m) => `${m[1]} Pisten`),
 P("^(\\d+) liften$", (m) => `${m[1]} lifts`, (m) => `${m[1]} Lifte`),
 P("^" + N + " hm dalen$", (m) => `${m[1]} m descent`, (m) => `${m[1]} Hm Abfahrt`),
 P("^(\\d+) stappen$", (m) => `${m[1]} steps`, (m) => `${m[1]} Schritte`),
 P("^↑ (.+) m · ↓ (.+) m · hoogste (.+) m$", (m) => `↑ ${m[1]} m · ↓ ${m[2]} m · highest ${m[3]} m`, (m) => `↑ ${m[1]} m · ↓ ${m[2]} m · höchster Punkt ${m[3]} m`),
 // gebied
 P("^(.+) · " + N + " km piste · (\\d+) liften(.*)$", (m) => `${tr(m[1])} · ${m[2]} km of runs · ${m[3]} lifts${m[4] ? " · " + words(m[4].replace(/^ · /, "")) : ""}`, (m) => `${tr(m[1])} · ${m[2]} km Pisten · ${m[3]} Lifte${m[4] ? " · " + words(m[4].replace(/^ · /, "")) : ""}`),
 P("^" + N + " skigebieden$", (m) => `${m[1]} ski areas`, (m) => `${m[1]} Skigebiete`),
 P("^(\\d+) van (\\d+) getoond\\. Typ om te zoeken\\.$", (m) => `${m[1]} of ${m[2]} shown. Type to search.`, (m) => `${m[1]} von ${m[2]} angezeigt. Tippe, um zu suchen.`),
 P("^Geen skigebied gevonden voor \"(.+)\"\\.$", (m) => `No ski area found for "${m[1]}".`, (m) => `Kein Skigebiet gefunden für "${m[1]}".`),
 P("^Geen skigebied gevonden\\.$", () => "No ski area found.", () => "Kein Skigebiet gefunden."),
 P("^(\\d+) liften · (.+)$", (m) => `${m[1]} lifts · ${m[2]}`, (m) => `${m[1]} Lifte · ${m[2]}`),
 P("^km piste$", () => "km of runs", () => "km Pisten"),
 // weer
 P("^(.+) · wind (\\d+) km/u(?: · (\\d+) cm vers)?$", (m) => `${tr(m[1])} · wind ${m[2]} km/h${m[3] ? ` · ${m[3]} cm fresh` : ""}`, (m) => `${tr(m[1])} · Wind ${m[2]} km/h${m[3] ? ` · ${m[3]} cm Neuschnee` : ""}`),
 P("^top · (.+) dal$", (m) => `top · ${m[1]} valley`, (m) => `Gipfel · ${m[1]} Tal`),
 P("^stoten (\\d+)$", (m) => `gusts ${m[1]}`, (m) => `Böen ${m[1]}`),
 P("^op (\\d+) m$", (m) => `at ${m[1]} m`, (m) => `auf ${m[1]} m`),
 // stappen-subregels en losse woorden: zie WORDS
 // groep
 P("^Groep (.+)$", (m) => `Group ${m[1]}`, (m) => `Gruppe ${m[1]}`),
 P("^(.+) heeft de route gekozen\\. Jouw route staat klaar\\.$", (m) => `${m[1]} picked the route. Your route is ready.`, (m) => `${m[1]} hat die Route gewählt. Deine Route ist bereit.`),
 P("^(.+) heeft een nieuwe route gekozen\\.$", (m) => `${m[1]} picked a new route.`, (m) => `${m[1]} hat eine neue Route gewählt.`),
 P("^Je doet mee met groep (.+)\\.$", (m) => `You joined group ${m[1]}.`, (m) => `Du bist Gruppe ${m[1]} beigetreten.`),
 P("^(\\d+) min geleden$", (m) => `${m[1]} min ago`, (m) => `vor ${m[1]} Min.`),
 P("^(\\d+) u geleden$", (m) => `${m[1]} h ago`, (m) => `vor ${m[1]} Std.`),
 P("^nu$", () => "now", () => "jetzt"),
 P("^(.+) \\(jij\\)$", (m) => `${m[1]} (you)`, (m) => `${m[1]} (du)`),
 P("^Jij$", () => "You", () => "Du"),
 // status
 P("^Volgens jou dicht: $", () => "Closed according to you: ", () => "Laut dir geschlossen: "),
 P("^(\\d+) (lift|liften)$", (m) => `${m[1]} ${m[1] === "1" ? "lift" : "lifts"}`, (m) => `${m[1]} ${m[1] === "1" ? "Lift" : "Lifte"}`),
 P("^(\\d+) (piste|pistes)$", (m) => `${m[1]} ${m[1] === "1" ? "run" : "runs"}`, (m) => `${m[1]} ${m[1] === "1" ? "Piste" : "Pisten"}`),
 P("^Status van je groep geladen: (\\d+) (lift of piste|liften en pistes) dicht\\.$", (m) => `Your group's status loaded: ${m[1]} closed.`, (m) => `Status deiner Gruppe geladen: ${m[1]} geschlossen.`),
 P("^(Lift|Piste) gesloten\\. Nieuwe route berekend\\.$", (m) => `${m[1] === "Lift" ? "Lift" : "Run"} closed. New route calculated.`, (m) => `${m[1]} gesperrt. Neue Route berechnet.`),
 P("^(.+) gesloten\\.$", (m) => `${tr(m[1])} closed.`, (m) => `${tr(m[1])} gesperrt.`),
 // dagboek
 P("^Vandaag: " + N + " km · " + N + " hm · (\\d+) km/u$", (m) => `Today: ${m[1]} km · ${m[2]} m vert · ${m[3]} km/h`, (m) => `Heute: ${m[1]} km · ${m[2]} Hm · ${m[3]} km/h`),
 P("^Pistes \\((\\d+)\\)$", (m) => `Runs (${m[1]})`, (m) => `Pisten (${m[1]})`),
 P("^Liften \\((\\d+)\\)$", (m) => `Lifts (${m[1]})`, (m) => `Lifte (${m[1]})`),
 P("^sinds (.+) · (\\d+) punten$", (m) => `since ${m[1]} · ${m[2]} points`, (m) => `seit ${m[1]} · ${m[2]} Punkte`),
 P("^(\\d+) punten$", (m) => `${m[1]} points`, (m) => `${m[1]} Punkte`),
 P("^(\\d+) punten · (.+)$", (m) => `${m[1]} points · ${m[2]}`, (m) => `${m[1]} Punkte · ${m[2]}`),
 P("^Vandaag · (.+)$", (m) => `Today · ${m[1]}`, (m) => `Heute · ${m[1]}`),
 // diversen
 P("^Route \"(.+)\" geladen\\.$", (m) => `Route "${m[1]}" loaded.`, (m) => `Route "${m[1]}" geladen.`),
 P("^Route \"(.+)\" bewaard\\.$", (m) => `Route "${m[1]}" saved.`, (m) => `Route "${m[1]}" gespeichert.`),
 P("^\"(.+)\" verwijderd\\.$", (m) => `"${m[1]}" deleted.`, (m) => `"${m[1]}" gelöscht.`),
 P("^Naar het dal: (.+)$", (m) => `To the valley: ${placeOrSelf(m[1].replace(/, .*$/, ""))}${/, (.+)$/.test(m[1]) ? ", " + /, (.+)$/.exec(m[1])[1] : ""}`, (m) => `Ins Tal: ${placeOrSelf(m[1].replace(/, .*$/, ""))}${/, (.+)$/.test(m[1]) ? ", " + /, (.+)$/.exec(m[1])[1] : ""}`),
 P("^Je bent bij (.+)\\. Kaart geladen\\.$", (m) => `You are at ${m[1]}. Map loaded.`, (m) => `Du bist bei ${m[1]}. Karte geladen.`),
 P("^Geen punt gevonden voor \"(.+)\"\\.$", (m) => `No place found for "${m[1]}".`, (m) => `Kein Ort gefunden für "${m[1]}".`),
 P("^(.+) staat bij je favorieten\\.$", (m) => `${m[1]} added to your favourites.`, (m) => `${m[1]} ist jetzt ein Favorit.`),
 P("^(.+) is geen favoriet meer\\.$", (m) => `${m[1]} removed from favourites.`, (m) => `${m[1]} ist kein Favorit mehr.`),
 P("^De liften sluiten over (\\d+) minuten\\.$", (m) => `The lifts close in ${m[1]} minutes.`, (m) => `Die Lifte schließen in ${m[1]} Minuten.`),
 P("^Let op: de liften sluiten over (\\d+) minuten\\.$", (m) => `Note: the lifts close in ${m[1]} minutes.`, (m) => `Achtung: Die Lifte schließen in ${m[1]} Minuten.`),
 P("^Liften sluiten om (.+), over (\\d+) min$", (m) => `Lifts close at ${m[1]}, in ${m[2]} min`, (m) => `Lifte schließen um ${m[1]}, in ${m[2]} Min.`),
 P("^Om (.+), na sluitingstijd$", (m) => `At ${m[1]}, after closing time`, (m) => `Um ${m[1]}, nach Betriebsschluss`),
 P("^Route naar (.+)\\.$", (m) => `Route to ${m[1]}.`, (m) => `Route zu ${m[1]}.`),
 P("^(.+) toegevoegd als tussenstop\\.$", (m) => `${m[1]} added as a stop.`, (m) => `${m[1]} als Zwischenstopp hinzugefügt.`),
 P("^Bel (\\d+)$", (m) => `Call ${m[1]}`, (m) => `${m[1]} anrufen`),
 P("^Alarmnummer (.+)$", (m) => `Emergency number ${tr(m[1])}`, (m) => `Notruf ${tr(m[1])}`),
 P("^ca\\. (\\d+) m$", (m) => `approx. ${m[1]} m`, (m) => `ca. ${m[1]} m`),
 P("^± (\\d+) m$", (m) => `± ${m[1]} m`, (m) => `± ${m[1]} m`),
 P("^(Op|op) ([^·]+)$", (m) => `${m[1] === "Op" ? "On" : "on"} ${words(placeOrSelf(m[2]))}`, (m) => `${m[1] === "Op" ? "Auf" : "auf"} ${words(placeOrSelf(m[2]))}`),
 P("^(\\d+) m van ([^·]+)$", (m) => `${m[1]} m from ${words(placeOrSelf(m[2]))}`, (m) => `${m[1]} m von ${words(placeOrSelf(m[2]))}`),
 P("^Over (.+)$", (m) => `In ${m[1]}`, (m) => `In ${m[1]}`),
 P("^Mijn skidag in (.+) \\((.+)\\):$", (m) => `My ski day in ${m[1]} (${m[2]}):`, (m) => `Mein Skitag in ${m[1]} (${m[2]}):`),
 P("^" + N + " km geskied · " + N + " hoogtemeters omlaag · topsnelheid (\\d+) km/u$", (m) => `${m[1]} km skied · ${m[2]} m vertical down · top speed ${m[3]} km/h`, (m) => `${m[1]} km gefahren · ${m[2]} Höhenmeter abwärts · Höchstgeschwindigkeit ${m[3]} km/h`),
 P("^(\\d+) afdalingen · (\\d+) liften$", (m) => `${m[1]} runs · ${m[2]} lifts`, (m) => `${m[1]} Abfahrten · ${m[2]} Lifte`),
 P("^Pistes: (.+)$", (m) => `Runs: ${m[1]}`, (m) => `Pisten: ${m[1]}`),
 P("^Liftstatus (.+) vandaag: (.+)\\. Open in de Pistenplanner:$", (m) => `Lift status ${m[1]} today: ${m[2].replace(/(\\d+) (lift of piste|liften en pistes) dicht/, "$1 closed").replace("alles open", "everything open")}. Open in the Pistenplanner:`,
   (m) => `Liftstatus ${m[1]} heute: ${m[2].replace(/(\\d+) (lift of piste|liften en pistes) dicht/, "$1 geschlossen").replace("alles open", "alles offen")}. In der Pistenplanner öffnen:`),
 P("^Doe mee met mijn groep in de Pistenplanner \\(code (.+)\\):$", (m) => `Join my group in the Pistenplanner (code ${m[1]}):`, (m) => `Tritt meiner Gruppe in der Pistenplanner bei (Code ${m[1]}):`),
 P("^NOODGEVAL – mijn locatie: (.+)$", (m) => "EMERGENCY – my location: " + m[1].replace(", hoogte ca. ", ", altitude approx. ").replace(", op ", ", on ").replace(" m van ", " m from ").replace(", skigebied ", ", ski area ").replace(". Kaart: ", ". Map: "),
   (m) => "NOTFALL – mein Standort: " + m[1].replace(", hoogte ca. ", ", Höhe ca. ").replace(", op ", ", auf ").replace(" m van ", " m von ").replace(", skigebied ", ", Skigebiet ").replace(". Kaart: ", ". Karte: ")),
];

// losse woorden en zinsdelen in samengestelde regels (alleen hele woorden)
const WORDS = {
 en:[["naar het bergstation", "to the top station"], ["naar het dalstation", "to the bottom station"], ["tot het einde van", "to the end of"], ["tot einde piste", "to end of run"],
     ["tot begin piste", "to start of run"], ["tot dalstation", "to bottom station"], ["tot bergstation", "to top station"], ["tot kruising op", "to junction at"],
     ["tot einde", "to end of"], ["tot begin", "to start of"], ["tot ", "to "], ["einde piste", "end of run"], ["begin piste", "start of run"], ["dalstation", "bottom station"], ["bergstation", "top station"],
     ["kruising op", "junction at"], ["Blauw (gemiddeld)", "Blue (intermediate)"], ["Dubbel zwart", "Double black"], ["Blauw", "Blue"], ["Rood", "Red"], ["Zwart", "Black"], ["Groen", "Green"],
     ["Skiroute", "Ski route"], ["Onbekend", "Unmarked"], ["blauw", "blue"], ["rood", "red"], ["zwart", "black"], ["groen", "green"],
     ["Stoeltjeslift", "Chairlift"], ["Gondel", "Gondola"], ["Kabelbaan", "Cable car"], ["Sleeplift", "T-bar"], ["Schotellift", "Button lift"], ["Touwlift", "Rope tow"], ["Lopende band", "Magic carpet"],
     ["Combibaan", "Combined lift"], ["Kabeltrein", "Funicular"], ["stoeltjeslift", "chairlift"], ["gondel", "gondola"], ["kabelbaan", "cable car"], ["sleeplift", "T-bar"],
     [" hm", " m vert"], ["km/u", "km/h"], [" op ", " at "], ["van je", "from you"], ["vandaag", "today"], ["Piste", "Run"], ["piste", "run"], ["pistes", "runs"], ["liften", "lifts"],
     ["Hm dalen", "m descent"], ["Op ", "On "], ["buckelpiste", "moguls"], ["niet geprepareerd", "ungroomed"], ["bospiste", "glades"], ["verlicht", "floodlit"], ["kunstsneeuw", "snowmaking"], ["bij ", "near "], ["vriespunt", "freezing point"], ["bewaard om", "saved at"], ["uur", "h"], ["temperatuur top/dal", "temperature top/valley"]],
 de:[["naar het bergstation", "zur Bergstation"], ["naar het dalstation", "zur Talstation"], ["tot einde piste", "bis Ende Piste"], ["tot begin piste", "bis Anfang Piste"],
     ["tot dalstation", "bis Talstation"], ["tot bergstation", "bis Bergstation"], ["tot kruising op", "bis Kreuzung auf"], ["tot einde", "bis Ende"], ["tot begin", "bis Anfang"], ["tot ", "bis "],
     ["einde piste", "Ende Piste"], ["begin piste", "Anfang Piste"], ["dalstation", "Talstation"], ["bergstation", "Bergstation"], ["kruising op", "Kreuzung auf"],
     ["Blauw (gemiddeld)", "Blau (mittel)"], ["Dubbel zwart", "Doppelschwarz"], ["Blauw", "Blau"], ["Rood", "Rot"], ["Zwart", "Schwarz"], ["Groen", "Grün"], ["Onbekend", "Unmarkiert"],
     ["blauw", "blau"], ["rood", "rot"], ["zwart", "schwarz"], ["groen", "grün"],
     ["Stoeltjeslift", "Sessellift"], ["Gondel", "Gondelbahn"], ["Kabelbaan", "Seilbahn"], ["Sleeplift", "Schlepplift"], ["Schotellift", "Tellerlift"], ["Touwlift", "Seillift"], ["Lopende band", "Förderband"],
     ["Combibaan", "Kombibahn"], ["Kabeltrein", "Standseilbahn"], ["stoeltjeslift", "Sessellift"], ["gondel", "Gondelbahn"], ["kabelbaan", "Seilbahn"], ["sleeplift", "Schlepplift"],
     [" hm", " Hm"], ["km/u", "km/h"], [" op ", " auf "], ["van je", "von dir"], ["vandaag", "heute"], ["piste", "Piste"], ["pistes", "Pisten"], ["liften", "Lifte"],
     ["Op ", "Auf "], ["buckelpiste", "Buckelpiste"], ["niet geprepareerd", "nicht präpariert"], ["bospiste", "Waldpiste"], ["verlicht", "beleuchtet"], ["kunstsneeuw", "beschneit"], ["bij ", "bei "], ["vriespunt", "Gefrierpunkt"], ["bewaard om", "gespeichert um"], ["uur", "Uhr"], ["temperatuur top/dal", "Temperatur Gipfel/Tal"], ["top", "Gipfel"]]};
const WORD_RX = {};
for(const l of ["en","de"]) WORD_RX[l] = WORDS[l].map(([a, b]) => [new RegExp("(^|[^\\p{L}])" + a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/^ | $/g, "") + "(?=$|[^\\p{L}])", "gu"), b.trim(), a.startsWith(" "), a.endsWith(" ")]);

const words = t => { for(const [rx, b] of WORD_RX[LANG]) t = t.replace(rx, (m0, pre) => pre + b); return t; };
const trCache = new Map();
function tr(text){
  if(LANG === "nl" || text == null) return text;
  const raw = String(text), key = LANG + "|" + raw;
  if(trCache.has(key)) return trCache.get(key);
  const lead = raw.match(/^\s*/)[0], trail = raw.match(/\s*$/)[0], core = raw.trim();
  let out = null;
  if(!core || !/[A-Za-zÀ-ÿ]/.test(core)) out = raw;
  // begint de vertaling met een leesteken, dan geen spatie ervoor
  if(out == null && EXACT[LANG][core] != null){ const v = EXACT[LANG][core]; out = (/^[,.]/.test(v) ? "" : lead) + v + trail; }
  if(out == null){
    const p = placeT(core); if(p) out = lead + p + trail;
  }
  if(out == null){
    for(const [rx, en, de] of PATTERNS){
      const m = rx.exec(core);
      if(m){ const r = (LANG === "en" ? en : de)(m); if(r != null){ out = lead + r + trail; break; } }
    }
  }
  // regels met " · ": elk deel apart
  if(out == null && core.includes(" · ")) out = lead + core.split(" · ").map(tr).join(" · ") + trail;
  if(out == null) out = lead + words(core) + trail;   // losse woorden en zinsdelen
  if(trCache.size > 5000) trCache.clear();
  trCache.set(key, out);
  return out;
}

// ---------- vertalen van alles wat op het scherm komt ----------
const ORIG = new WeakMap(), ORIG_ATTR = new WeakMap();
const ATTRS = ["placeholder", "aria-label", "title"];
const SKIP = new Set(["SCRIPT", "STYLE", "svg", "use", "symbol", "path", "TEXTAREA"]);
function trNode(node){
  if(node.nodeType === 3){
    const p = node.parentNode; if(!p || SKIP.has(p.nodeName) || p.closest?.("[data-notr]")) return;
    if(!/[A-Za-zÀ-ÿ]/.test(node.nodeValue)) return;
    let o = ORIG.get(node);
    // tekst is door de app veranderd: dat is de nieuwe bron
    if(o == null || (node.nodeValue !== o.t && node.nodeValue !== o.out)){ o = {t:node.nodeValue}; ORIG.set(node, o); }
    const out = LANG === "nl" ? o.t : tr(o.t); o.out = out;
    if(node.nodeValue !== out) node.nodeValue = out;
  } else if(node.nodeType === 1){
    if(SKIP.has(node.nodeName) || node.hasAttribute?.("data-notr")) return;
    let oa = ORIG_ATTR.get(node);
    for(const a of ATTRS){
      if(!node.hasAttribute(a)) continue;
      const v = node.getAttribute(a);
      if(!oa) ORIG_ATTR.set(node, oa = {});
      if(oa[a] == null || (v !== oa[a].t && v !== oa[a].out)) oa[a] = {t:v};
      const out = LANG === "nl" ? oa[a].t : tr(oa[a].t); oa[a].out = out;
      if(v !== out) node.setAttribute(a, out);
    }
    for(const c of node.childNodes) trNode(c);
  }
}
let i18nBusy = false;
const i18nObs = new MutationObserver(muts => {
  if(i18nBusy) return; i18nBusy = true;
  try{
    for(const m of muts){
      if(m.type === "childList") m.addedNodes.forEach(trNode);
      else if(m.type === "characterData") trNode(m.target);
      else if(m.type === "attributes") trNode(m.target);
    }
  } finally { i18nBusy = false; }
});
function i18nStart(){
  document.documentElement.lang = LANG;
  trNode(document.body);
  i18nObs.observe(document.body, {subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:ATTRS});
}
function setLang(l){
  if(!I18N_LANGS[l]) return;
  LANG = l; LOCALE = {nl:"nl-NL", en:"en-GB", de:"de-DE"}[l]; DEC = l === "en" ? "." : ",";
  try{ localStorage.setItem("pp-lang", l); }catch(e){}
  location.reload();   // alles opnieuw opbouwen in de nieuwe taal (getallen, datums, stem)
}
