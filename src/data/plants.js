// Plant library — research-based companion planting data for Central Europe
// Sources: Gertrud Franck "Mischkulturen im Gemüsegarten", DGG,
// Sepp Brunner, Bioland-Anbaurichtlinien, multiple German horticultural
// research publications. This data is also seeded to Firestore (plants/{id}).

export const PLANTS = [
  { id:"tomato",     de:"Tomate",      en:"Tomato",      glyph:"T",  hue:8,   spacing:2, sun:"full", water:"high", seasons:["summer","autumn"],           yield:1.8, sowDepth:0.5,  harvestWeeks:12, description:"Wärmeliebend, benötigt Stütze. Ideal für sonnige, windgeschützte Plätze.",                             careNotes:"Regelmäßig ausgeizen, mulchen, gleichmäßig wässern. Nicht von oben gießen." },
  { id:"carrot",     de:"Karotte",     en:"Carrot",      glyph:"K",  hue:28,  spacing:1, sun:"full", water:"low",  seasons:["spring","summer","autumn"],  yield:0.4, sowDepth:1,    harvestWeeks:10, description:"Tiefwurzler, lockert den Boden. Mag lockere, sandige, tiefgründige Erde.",                            careNotes:"Beim Keimen gleichmäßig feucht halten, danach trockenheitsverträglich." },
  { id:"lettuce",    de:"Salat",       en:"Lettuce",     glyph:"S",  hue:95,  spacing:1, sun:"part", water:"med",  seasons:["spring","summer","autumn"],  yield:0.3, sowDepth:0.5,  harvestWeeks:6,  description:"Schnellwachsend, ideal als Lückenfüller. Verträgt Halbschatten gut.",                                  careNotes:"Vor Hitzestau schützen. Gleichmäßig und bodenah gießen." },
  { id:"basil",      de:"Basilikum",   en:"Basil",       glyph:"B",  hue:130, spacing:1, sun:"full", water:"med",  seasons:["summer"],                    yield:0.2, sowDepth:0.3,  harvestWeeks:8,  description:"Kälteempfindlich, wärmeliebend. Ätherische Öle halten viele Schädlinge fern.",                        careNotes:"Blüten regelmäßig entfernen für aromatisches Wachstum. Niemals kalt gießen." },
  { id:"onion",      de:"Zwiebel",     en:"Onion",       glyph:"Z",  hue:280, spacing:1, sun:"full", water:"low",  seasons:["spring","summer"],           yield:0.3, sowDepth:2,    harvestWeeks:16, description:"Schwefelverbindungen halten viele Schädlinge fern. Wichtiger Mischkulturpartner.",                     careNotes:"Trockenphasen vor der Ernte fördern Haltbarkeit. Nicht häufeln." },
  { id:"radish",     de:"Radieschen",  en:"Radish",      glyph:"R",  hue:350, spacing:1, sun:"part", water:"med",  seasons:["spring","summer","autumn"],  yield:0.2, sowDepth:1,    harvestWeeks:4,  description:"Extrem schnellwachsend (3–5 Wochen). Lockert Boden und dient als Fangpflanze für Erdflöhe.",            careNotes:"Bei starker Hitze schießen die Pflanzen — Halbschatten bevorzugen." },
  { id:"bean",       de:"Buschbohne",  en:"Bush Bean",   glyph:"Bo", hue:110, spacing:1, sun:"full", water:"med",  seasons:["summer"],                    yield:0.5, sowDepth:3,    harvestWeeks:10, description:"Leguminose: bindet Luftstickstoff und bereichert den Boden für Folgekulturen.",                        careNotes:"Nie von oben gießen (fördert Bohnenfäule). Stets warm halten." },
  { id:"cucumber",   de:"Gurke",       en:"Cucumber",    glyph:"G",  hue:75,  spacing:2, sun:"full", water:"high", seasons:["summer"],                    yield:1.2, sowDepth:1,    harvestWeeks:8,  description:"Wärme- und wasserbedürftig. Im Hochbeet profitiert sie besonders vom warmen Boden.",                   careNotes:"Rankhilfe anbieten. Gleichmäßig gießen, keine Staunässe." },
  { id:"spinach",    de:"Spinat",      en:"Spinach",     glyph:"Sp", hue:145, spacing:1, sun:"part", water:"med",  seasons:["spring","autumn","winter"],  yield:0.3, sowDepth:2,    harvestWeeks:6,  description:"Kältetolerant, ideal als Vor- und Nachkultur. Schießt bei großer Hitze.",                              careNotes:"Kühl und feucht halten. Bei Hitze schattieren oder ernten." },
  { id:"potato",     de:"Kartoffel",   en:"Potato",      glyph:"P",  hue:38,  spacing:2, sun:"full", water:"med",  seasons:["spring","summer"],           yield:1.4, sowDepth:10,   harvestWeeks:16, description:"Stark zehrend, braucht nährstoffreichen, lockeren Boden. Im Hochbeet gut möglich.",                    careNotes:"Anhäufeln wenn Triebe 15 cm hoch sind. Krautfäule beobachten." },
  { id:"leek",       de:"Lauch",       en:"Leek",        glyph:"La", hue:85,  spacing:1, sun:"full", water:"med",  seasons:["spring","summer","autumn","winter"], yield:0.3, sowDepth:1, harvestWeeks:20, description:"Mit Karotten die klassische Mischkultur-Kombination. Sehr winterhart.",                          careNotes:"Anhäufeln für weiße Schäfte. Braucht tiefe lockere Erde." },
  { id:"pea",        de:"Erbse",       en:"Pea",         glyph:"Er", hue:115, spacing:1, sun:"full", water:"med",  seasons:["spring","autumn"],           yield:0.4, sowDepth:3,    harvestWeeks:10, description:"Leguminose: bindet Stickstoff. Kältetolerant und früh aussäbar.",                                      careNotes:"Rankhilfe anbieten. Wurzeln nach Ernte im Boden lassen (Stickstoff)." },
  { id:"kohlrabi",   de:"Kohlrabi",    en:"Kohlrabi",    glyph:"Kh", hue:60,  spacing:1, sun:"full", water:"med",  seasons:["spring","summer","autumn"],  yield:0.4, sowDepth:1,    harvestWeeks:8,  description:"Schnellwachsendes Kohlgemüse. Radieschen als Fangpflanze für Erdflöhe nutzen.",                        careNotes:"Gleichmäßig gießen — bei Trockenheit wird das Fleisch holzig." },
  { id:"zucchini",   de:"Zucchini",    en:"Zucchini",    glyph:"Zu", hue:88,  spacing:2, sun:"full", water:"high", seasons:["summer"],                    yield:2.0, sowDepth:2,    harvestWeeks:8,  description:"Sehr ertragreich. Große Blätter beschatten und kühlen den Boden.",                                    careNotes:"Regelmäßig jung ernten. Viel Kompost und Mulch geben." },
  { id:"pepper",     de:"Paprika",     en:"Pepper",      glyph:"Pa", hue:18,  spacing:1, sun:"full", water:"med",  seasons:["summer","autumn"],           yield:0.6, sowDepth:0.5,  harvestWeeks:14, description:"Wärmeliebend wie Tomate. Windgeschützter Standort wichtig.",                                          careNotes:"Stütze bei schwerer Frucht. Mulchen empfohlen." },
  { id:"strawberry", de:"Erdbeere",    en:"Strawberry",  glyph:"Eb", hue:5,   spacing:1, sun:"full", water:"med",  seasons:["spring","summer"],           yield:0.5, sowDepth:0,    harvestWeeks:8,  description:"Mehrjährig. Mit Spinat das klassische deutsche Gartenduo.",                                           careNotes:"Ausläufer entfernen. Stroh unter die Früchte gegen Fäulnis." },
  { id:"marigold",   de:"Tagetes",     en:"Marigold",    glyph:"Tg", hue:45,  spacing:1, sun:"full", water:"low",  seasons:["spring","summer","autumn"],  yield:0.0, sowDepth:0.5,  harvestWeeks:0,  description:"Universelle Schutzpflanze: Nematoden, Blattläuse, Weiße Fliege u.v.m.",                              careNotes:"Verblühtes regelmäßig entfernen. Sehr robust und pflegeleicht." },
  { id:"dill",       de:"Dill",        en:"Dill",        glyph:"Di", hue:82,  spacing:1, sun:"full", water:"low",  seasons:["spring","summer","autumn"],  yield:0.1, sowDepth:0.5,  harvestWeeks:6,  description:"Zieht Schlupfwespen und Schwebfliegen an. Achtung: hemmt Möhren bei Reife.",                         careNotes:"Direkt aussäen, mag keinen Umzug. Sehr intensiver Duft." },
  { id:"parsley",    de:"Petersilie",  en:"Parsley",     glyph:"Pe", hue:112, spacing:1, sun:"part", water:"med",  seasons:["spring","summer","autumn"],  yield:0.1, sowDepth:0.5,  harvestWeeks:12, description:"Zieht Schwebfliegen an, die Blattläuse bekämpfen. Gut neben Tomate.",                                careNotes:"Langsamer Keimer (3–4 Wochen). Beim Keimen regelmäßig gießen." },
];

// COMPANIONS — research-based matrix (Mischkultur / Central Europe)
// +1 = Gute Nachbarn | -1 = Schlechte Nachbarn
// pairScore() liest beide Richtungen — Matrix muss nicht vollständig symmetrisch sein.
export const COMPANIONS = {
  tomato:  { basil:1, carrot:1, parsley:1, marigold:1, spinach:1, lettuce:1, pepper:1,  potato:-1, kohlrabi:-1, cucumber:-1, dill:-1, zucchini:-1 },
  carrot:  { onion:1, leek:1, tomato:1, lettuce:1, radish:1, bean:1, pea:1,            dill:-1, parsley:-1 },
  lettuce: { carrot:1, radish:1, onion:1, cucumber:1, strawberry:1, dill:1, bean:1,    parsley:-1 },
  basil:   { tomato:1, pepper:1, lettuce:1 },
  onion:   { carrot:1, leek:1, lettuce:1, strawberry:1, cucumber:1, tomato:1,          bean:-1, pea:-1, spinach:-1 },
  radish:  { lettuce:1, carrot:1, cucumber:1, bean:1, kohlrabi:1, spinach:1, pea:1 },
  bean:    { carrot:1, radish:1, cucumber:1, spinach:1, kohlrabi:1, potato:1, strawberry:1, dill:1, onion:-1, leek:-1, pea:-1 },
  cucumber:{ bean:1, radish:1, lettuce:1, dill:1, onion:1, leek:1,                    tomato:-1, potato:-1, zucchini:-1 },
  spinach: { strawberry:1, radish:1, leek:1, carrot:1, bean:1, pea:1,                 onion:-1 },
  potato:  { bean:1, marigold:1,                                                        tomato:-1, cucumber:-1, strawberry:-1, zucchini:-1 },
  leek:    { carrot:1, lettuce:1, onion:1, spinach:1, cucumber:1,                      bean:-1, pea:-1 },
  pea:     { carrot:1, spinach:1, radish:1, lettuce:1, cucumber:1, kohlrabi:1,         onion:-1, leek:-1, bean:-1 },
  kohlrabi:{ cucumber:1, bean:1, radish:1, pea:1, dill:1,                              tomato:-1, pepper:-1, strawberry:-1 },
  zucchini:{ dill:1, marigold:1, bean:1, parsley:1,                                    potato:-1, tomato:-1, cucumber:-1 },
  pepper:  { basil:1, tomato:1, carrot:1, parsley:1,                                   kohlrabi:-1 },
  strawberry:{ spinach:1, onion:1, lettuce:1, bean:1,                                  kohlrabi:-1, potato:-1 },
  marigold:{ tomato:1, carrot:1, cucumber:1, potato:1, zucchini:1 },
  dill:    { cucumber:1, lettuce:1, bean:1, kohlrabi:1, onion:1,                       carrot:-1, tomato:-1 },
  parsley: { tomato:1, pepper:1, zucchini:1,                                            lettuce:-1, carrot:-1 },
};

export const SEASONS = [
  { id:"spring", de:"Frühling", en:"Spring", glyph:"✦", hue:95  },
  { id:"summer", de:"Sommer",   en:"Summer", glyph:"◉", hue:38  },
  { id:"autumn", de:"Herbst",   en:"Autumn", glyph:"◐", hue:22  },
  { id:"winter", de:"Winter",   en:"Winter", glyph:"❄", hue:210 },
];

export const SHAPES = {
  rect:     { id:"rect",     de:"Rechteck", en:"Rectangle", w:8,  h:4,  preset:true,  mask:()=>true },
  square:   { id:"square",   de:"Quadrat",  en:"Square",    w:5,  h:5,  preset:true,  mask:()=>true },
  l:        { id:"l",        de:"L-Form",   en:"L-shape",   w:7,  h:6,  preset:true,  mask:(x,y)=>!(x>=4&&y<3) },
  freeform: { id:"freeform", de:"Frei",     en:"Freeform",  w:12, h:10, preset:false },
};

// Reads both directions so the COMPANIONS object doesn't need to be symmetric
export function pairScore(a, b) {
  if (!a || !b || a === b) return 0;
  return (COMPANIONS[a]?.[b]) ?? (COMPANIONS[b]?.[a]) ?? 0;
}

export function plantById(id) { return PLANTS.find(p => p.id === id); }

export function defaultFreeformMask() {
  const mask = {};
  const W=8, H=6;
  for (let y=0;y<H;y++) for (let x=0;x<W;x++) {
    const cx=W/2-0.5, cy=H/2-0.5, dx=(x-cx)/(W/2), dy=(y-cy)/(H/2);
    if (dx*dx+dy*dy*1.4<1.05) mask[`${x},${y}`]=true;
  }
  return mask;
}

// Human-readable companion reason for UI display
export function companionReason(a, b) {
  const key = [a,b].sort().join('-');
  const map = {
    "basil-tomato":     "Basilikum vertreibt Blattläuse & weiße Fliege, verbessert den Tomatengeschmack.",
    "carrot-tomato":    "Karotte lockert den Boden rund um die Tomatenwurzeln.",
    "carrot-onion":     "Das klassische Mischkultur-Duo: Zwiebelduft vertreibt Möhrenfliege — und umgekehrt.",
    "carrot-leek":      "Lauch + Karotte: gegenseitige Abwehr von Möhren- und Lauchmotte.",
    "spinach-strawberry":"Klassisches deutsches Gartenpaar: Spinat hält Boden feucht, Erdbeere spendet Schatten.",
    "onion-strawberry": "Zwiebelduft hält Erdbeerschädlinge fern.",
    "bean-potato":      "Bohne bindet Luftstickstoff im Boden — Kartoffel profitiert direkt davon.",
    "potato-tomato":    "GLEICHE FAMILIE (Solanaceae): Phytophthora-Krautfäule breitet sich von Kartoffel auf Tomate aus!",
    "bean-onion":       "Schwefelverbindungen der Zwiebel hemmen das Bohnenwachstum messbar.",
    "carrot-dill":      "Reifer Dill hemmt Möhrenkeimung und -wachstum durch Terpenverbindungen.",
    "carrot-parsley":   "Gleiche Familie (Apiaceae): teilen Krankheiten und Schädlinge.",
    "cucumber-tomato":  "Krankheitsübertragung bei Feuchtigkeit, starke Nährstoffkonkurrenz.",
    "cucumber-dill":    "Dill zieht Schlupfwespen an, die Gurkenschädlinge parasitieren.",
    "marigold-tomato":  "Tagetes vertreibt Nematoden und weiße Fliege von Tomaten.",
    "basil-pepper":     "Basilikum schützt Paprika vor Blattläusen — gleicher Effekt wie bei der Tomate.",
  };
  return map[key] || null;
}
