// Plant library — research-based companion planting data for Central Europe
import { PLANT_DETAILS, FEEDERS, HARVEST_SPAN_WEEKS, BOLTS_IN_HEAT } from './plantDetails.js';

export const SNAP_CM = 5;
// Sources: Gertrud Franck "Mischkulturen im Gemüsegarten", DGG,
// Sepp Brunner, Bioland-Anbaurichtlinien, multiple German horticultural
// research publications. This data is also seeded to Firestore (plants/{id}).

const BASE_PLANTS = [
  { id:"tomato",     de:"Tomate",       en:"Tomato",       glyph:"T",  hue:8,   spacing_cm:60, sun:"full", water:"high", seasons:["summer","autumn"],                    yield:1.8, sowDepth:0.5,  harvestWeeks:12, family:"Solanaceae",     description:"Wärmeliebend, benötigt Stütze. Ideal für sonnige, windgeschützte Plätze.",                             careNotes:"Regelmäßig ausgeizen, mulchen, gleichmäßig wässern. Nicht von oben gießen." },
  { id:"carrot",     de:"Karotte",      en:"Carrot",       glyph:"K",  hue:28,  spacing_cm:5,  sun:"full", water:"low",  seasons:["spring","summer","autumn"],           yield:0.4, sowDepth:1,    harvestWeeks:10, family:"Apiaceae",       description:"Tiefwurzler, lockert den Boden. Mag lockere, sandige, tiefgründige Erde.",                            careNotes:"Beim Keimen gleichmäßig feucht halten, danach trockenheitsverträglich." },
  { id:"lettuce",    de:"Salat",        en:"Lettuce",      glyph:"S",  hue:95,  spacing_cm:25, sun:"part", water:"med",  seasons:["spring","summer","autumn"],           yield:0.3, sowDepth:0.5,  harvestWeeks:6,  family:"Asteraceae",     description:"Schnellwachsend, ideal als Lückenfüller. Verträgt Halbschatten gut.",                                  careNotes:"Vor Hitzestau schützen. Gleichmäßig und bodenah gießen." },
  { id:"basil",      de:"Basilikum",    en:"Basil",        glyph:"B",  hue:130, spacing_cm:25, sun:"full", water:"med",  seasons:["summer"],                             yield:0.2, sowDepth:0.3,  harvestWeeks:8,  family:"Lamiaceae",      description:"Kälteempfindlich, wärmeliebend. Ätherische Öle halten viele Schädlinge fern.",                        careNotes:"Blüten regelmäßig entfernen für aromatisches Wachstum. Niemals kalt gießen." },
  { id:"onion",      de:"Zwiebel",      en:"Onion",        glyph:"Z",  hue:280, spacing_cm:10, sun:"full", water:"low",  seasons:["spring","summer"],                    yield:0.3, sowDepth:2,    harvestWeeks:16, family:"Amaryllidaceae", description:"Schwefelverbindungen halten viele Schädlinge fern. Wichtiger Mischkulturpartner.",                     careNotes:"Trockenphasen vor der Ernte fördern Haltbarkeit. Nicht häufeln." },
  { id:"radish",     de:"Radieschen",   en:"Radish",       glyph:"R",  hue:350, spacing_cm:8,  sun:"part", water:"med",  seasons:["spring","summer","autumn"],           yield:0.2, sowDepth:1,    harvestWeeks:4,  family:"Brassicaceae",   description:"Extrem schnellwachsend (3–5 Wochen). Lockert Boden und dient als Fangpflanze für Erdflöhe.",            careNotes:"Bei starker Hitze schießen die Pflanzen — Halbschatten bevorzugen." },
  { id:"bean",       de:"Buschbohne",   en:"Bush Bean",    glyph:"Bo", hue:110, spacing_cm:20, sun:"full", water:"med",  seasons:["summer"],                             yield:0.5, sowDepth:3,    harvestWeeks:10, family:"Fabaceae",       description:"Leguminose: bindet Luftstickstoff und bereichert den Boden für Folgekulturen.",                        careNotes:"Nie von oben gießen (fördert Bohnenfäule). Stets warm halten." },
  { id:"cucumber",   de:"Gurke",        en:"Cucumber",     glyph:"G",  hue:75,  spacing_cm:50, sun:"full", water:"high", seasons:["summer"],                             yield:1.2, sowDepth:1,    harvestWeeks:8,  family:"Cucurbitaceae",  description:"Wärme- und wasserbedürftig. Im Hochbeet profitiert sie besonders vom warmen Boden.",                   careNotes:"Rankhilfe anbieten. Gleichmäßig gießen, keine Staunässe." },
  { id:"spinach",    de:"Spinat",       en:"Spinach",      glyph:"Sp", hue:145, spacing_cm:10, sun:"part", water:"med",  seasons:["spring","autumn","winter"],           yield:0.3, sowDepth:2,    harvestWeeks:6,  family:"Chenopodiaceae", description:"Kältetolerant, ideal als Vor- und Nachkultur. Schießt bei großer Hitze.",                              careNotes:"Kühl und feucht halten. Bei Hitze schattieren oder ernten." },
  { id:"potato",     de:"Kartoffel",    en:"Potato",       glyph:"P",  hue:38,  spacing_cm:35, sun:"full", water:"med",  seasons:["spring","summer"],                    yield:1.4, sowDepth:10,   harvestWeeks:16, family:"Solanaceae",     description:"Stark zehrend, braucht nährstoffreichen, lockeren Boden. Im Hochbeet gut möglich.",                    careNotes:"Anhäufeln wenn Triebe 15 cm hoch sind. Krautfäule beobachten." },
  { id:"leek",       de:"Lauch",        en:"Leek",         glyph:"La", hue:85,  spacing_cm:12, sun:"full", water:"med",  seasons:["spring","summer","autumn","winter"],  yield:0.3, sowDepth:1,    harvestWeeks:20, family:"Amaryllidaceae", description:"Mit Karotten die klassische Mischkultur-Kombination. Sehr winterhart.",                               careNotes:"Anhäufeln für weiße Schäfte. Braucht tiefe lockere Erde." },
  { id:"pea",        de:"Erbse",        en:"Pea",          glyph:"Er", hue:115, spacing_cm:10, sun:"full", water:"med",  seasons:["spring","autumn"],                    yield:0.4, sowDepth:3,    harvestWeeks:10, family:"Fabaceae",       description:"Leguminose: bindet Stickstoff. Kältetolerant und früh aussäbar.",                                      careNotes:"Rankhilfe anbieten. Wurzeln nach Ernte im Boden lassen (Stickstoff)." },
  { id:"kohlrabi",   de:"Kohlrabi",     en:"Kohlrabi",     glyph:"Kh", hue:60,  spacing_cm:25, sun:"full", water:"med",  seasons:["spring","summer","autumn"],           yield:0.4, sowDepth:1,    harvestWeeks:8,  family:"Brassicaceae",   description:"Schnellwachsendes Kohlgemüse. Radieschen als Fangpflanze für Erdflöhe nutzen.",                        careNotes:"Gleichmäßig gießen — bei Trockenheit wird das Fleisch holzig." },
  { id:"zucchini",   de:"Zucchini",     en:"Zucchini",     glyph:"Zu", hue:88,  spacing_cm:90, sun:"full", water:"high", seasons:["summer"],                             yield:2.0, sowDepth:2,    harvestWeeks:8,  family:"Cucurbitaceae",  description:"Sehr ertragreich. Große Blätter beschatten und kühlen den Boden.",                                    careNotes:"Regelmäßig jung ernten. Viel Kompost und Mulch geben." },
  { id:"pepper",     de:"Paprika",      en:"Pepper",       glyph:"Pa", hue:18,  spacing_cm:45, sun:"full", water:"med",  seasons:["summer","autumn"],                    yield:0.6, sowDepth:0.5,  harvestWeeks:14, family:"Solanaceae",     description:"Wärmeliebend wie Tomate. Windgeschützter Standort wichtig.",                                          careNotes:"Stütze bei schwerer Frucht. Mulchen empfohlen." },
  { id:"strawberry", de:"Erdbeere",     en:"Strawberry",   glyph:"Eb", hue:5,   spacing_cm:25, sun:"full", water:"med",  seasons:["spring","summer"],                    yield:0.5, sowDepth:0,    harvestWeeks:8,  family:"Rosaceae",       description:"Mehrjährig. Mit Spinat das klassische deutsche Gartenduo.",                                           careNotes:"Ausläufer entfernen. Stroh unter die Früchte gegen Fäulnis." },
  { id:"marigold",   de:"Tagetes",      en:"Marigold",     glyph:"Tg", hue:45,  spacing_cm:20, sun:"full", water:"low",  seasons:["spring","summer","autumn"],           yield:0.0, sowDepth:0.5,  harvestWeeks:0,  family:"Asteraceae",     description:"Universelle Schutzpflanze: Nematoden, Blattläuse, Weiße Fliege u.v.m.",                              careNotes:"Verblühtes regelmäßig entfernen. Sehr robust und pflegeleicht." },
  { id:"dill",       de:"Dill",         en:"Dill",         glyph:"Di", hue:82,  spacing_cm:25, sun:"full", water:"low",  seasons:["spring","summer","autumn"],           yield:0.1, sowDepth:0.5,  harvestWeeks:6,  family:"Apiaceae",       description:"Zieht Schlupfwespen und Schwebfliegen an. Achtung: hemmt Möhren bei Reife.",                         careNotes:"Direkt aussäen, mag keinen Umzug. Sehr intensiver Duft." },
  { id:"parsley",    de:"Petersilie",   en:"Parsley",      glyph:"Pe", hue:112, spacing_cm:20, sun:"part", water:"med",  seasons:["spring","summer","autumn"],           yield:0.1, sowDepth:0.5,  harvestWeeks:12, family:"Apiaceae",       description:"Zieht Schwebfliegen an, die Blattläuse bekämpfen. Gut neben Tomate.",                                careNotes:"Langsamer Keimer (3–4 Wochen). Beim Keimen regelmäßig gießen." },
  { id:"rucola",     de:"Rucola",       en:"Rocket",       glyph:"Ru", hue:105, spacing_cm:15, sun:"part", water:"med",  seasons:["spring","summer","autumn"],           yield:0.15,sowDepth:0.5,  harvestWeeks:4,  family:"Brassicaceae",   description:"Würzige Salat-Alternative mit pfeffrigem Aroma. Schnellwachsend und robust.",                         careNotes:"Kühlen Standort bevorzugen — bei Hitze schießt er schnell und wird bitter." },
  { id:"chive",      de:"Schnittlauch", en:"Chive",        glyph:"Sn", hue:115, spacing_cm:12, sun:"full", water:"low",  seasons:["spring","summer","autumn","winter"],  yield:0.1, sowDepth:0.5,  harvestWeeks:52, family:"Amaryllidaceae", description:"Mehrjährig. Schöne lila Blüten ziehen Bestäuber an. Sehr robust.",                                   careNotes:"Regelmäßiges Ernten fördert Wachstum. Sehr winterhart und pflegeleicht." },
  // ── Ergänzt für den österreichischen Hausgarten (Kohl, Rübengewächse, Kürbis, Wintergemüse, Blühpartner)
  { id:"cabbage",    de:"Weißkraut",    en:"Cabbage",      glyph:"Wk", hue:160, spacing_cm:50, sun:"full", water:"high", seasons:["spring","summer","autumn"],           yield:2.0, sowDepth:1,    harvestWeeks:16, family:"Brassicaceae",   description:"Klassisches Lagerkraut für Sauerkraut und Krautsalat. Starkzehrer, der viel Platz und Kompost braucht.", careNotes:"Kulturschutznetz gegen Kohlweißling und Kohlfliege. Gleichmäßig gießen, sonst platzen die Köpfe." },
  { id:"kale",       de:"Grünkohl",     en:"Kale",         glyph:"Gk", hue:140, spacing_cm:45, sun:"full", water:"med",  seasons:["summer","autumn","winter"],           yield:0.6, sowDepth:1,    harvestWeeks:16, family:"Brassicaceae",   description:"Sehr winterhart, wird erst nach den ersten Frösten richtig süß. Ernte Blatt für Blatt bis ins Frühjahr.", careNotes:"Von unten nach oben ernten, das Herz stehen lassen. Netz gegen Kohlweißling." },
  { id:"brussels",   de:"Kohlsprossen", en:"Brussels Sprouts", glyph:"Ks", hue:125, spacing_cm:50, sun:"full", water:"med", seasons:["summer","autumn","winter"],         yield:0.6, sowDepth:1,    harvestWeeks:22, family:"Brassicaceae",   description:"Lange Kultur, Ernte von Oktober bis in den Winter. Frost macht die Röschen milder.", careNotes:"Anhäufeln für Standfestigkeit. Im September die Triebspitze kappen, dann werden die Röschen gleichmäßig." },
  { id:"broccoli",   de:"Brokkoli",     en:"Broccoli",     glyph:"Bk", hue:150, spacing_cm:45, sun:"full", water:"med",  seasons:["spring","summer","autumn"],           yield:0.5, sowDepth:1,    harvestWeeks:12, family:"Brassicaceae",   description:"Nach dem Haupttrieb bilden sich Seitentriebe, die man wochenlang nachernten kann.", careNotes:"Ernten, solange die Knospen geschlossen sind. Gleichmäßig feucht halten." },
  { id:"cauliflower",de:"Karfiol",      en:"Cauliflower",  glyph:"Kf", hue:55,  spacing_cm:50, sun:"full", water:"high", seasons:["spring","summer","autumn"],           yield:0.7, sowDepth:1,    harvestWeeks:14, family:"Brassicaceae",   description:"Anspruchsvollster Kohl: Wassermangel oder Hitze lassen die Rose klein und locker bleiben.", careNotes:"Rose mit eigenen Blättern abdecken, damit sie weiß bleibt. Nie austrocknen lassen." },
  { id:"chard",      de:"Mangold",      en:"Swiss Chard",  glyph:"Mg", hue:330, spacing_cm:30, sun:"part", water:"med",  seasons:["spring","summer","autumn"],           yield:1.0, sowDepth:2,    harvestWeeks:8,  family:"Chenopodiaceae", description:"Robustes Blattgemüse, das von Juni bis zum Frost immer wieder nachwächst. Bunte Stiele sind ein Blickfang.", careNotes:"Äußere Blätter laufend ernten, Herz stehen lassen. Schießt nicht so schnell wie Spinat." },
  { id:"beetroot",   de:"Rote Rübe",    en:"Beetroot",     glyph:"Rr", hue:340, spacing_cm:10, sun:"full", water:"med",  seasons:["spring","summer","autumn"],           yield:0.4, sowDepth:2,    harvestWeeks:12, family:"Chenopodiaceae", description:"Unkompliziert und gut lagerfähig. Jede „Samenkugel“ enthält mehrere Keimlinge.", careNotes:"Auf 10 cm vereinzeln. Junge Blätter sind als Salat essbar." },
  { id:"pumpkin",    de:"Kürbis",       en:"Pumpkin",      glyph:"Kü", hue:30,  spacing_cm:80, sun:"full", water:"high", seasons:["summer","autumn"],                    yield:3.0, sowDepth:2,    harvestWeeks:16, family:"Cucurbitaceae",  description:"Hokkaido passt ins Hochbeet: an den Rand setzen und die Ranken über die Kante hängen lassen.", careNotes:"Viel Kompost, großzügig gießen. Früchte auf ein Brett legen. Vor dem ersten Frost ernten und nachreifen lassen." },
  { id:"polebean",   de:"Stangenbohne", en:"Pole Bean",    glyph:"Sb", hue:120, spacing_cm:20, sun:"full", water:"med",  seasons:["summer"],                             yield:0.9, sowDepth:3,    harvestWeeks:12, family:"Fabaceae",       description:"Kletternde Fisole mit viel Ertrag auf wenig Grundfläche. Bindet Stickstoff.", careNotes:"Stangen oder Schnüre (2–2,5 m) vor der Aussaat setzen. Erst nach den Eisheiligen säen." },
  { id:"garlic",     de:"Knoblauch",    en:"Garlic",       glyph:"Kn", hue:290, spacing_cm:12, sun:"full", water:"low",  seasons:["spring","summer","autumn","winter"],  yield:0.15,sowDepth:4,    harvestWeeks:36, family:"Amaryllidaceae", description:"Im Herbst gesteckt, im Juli geerntet. Gilt als Pilzschutz für Erdbeeren und Rosen.", careNotes:"Zehen mit der Spitze nach oben stecken. Ernten, wenn ein Drittel des Laubs gelb ist." },
  { id:"lambslettuce",de:"Vogerlsalat", en:"Lamb's Lettuce", glyph:"Vs", hue:100, spacing_cm:10, sun:"part", water:"low", seasons:["autumn","winter","spring"],          yield:0.1, sowDepth:1,    harvestWeeks:10, family:"Caprifoliaceae", description:"Der Wintersalat schlechthin. Ideale Nachkultur, wenn im Spätsommer Beetfläche frei wird.", careNotes:"Boden nach der Aussaat andrücken. Bei Kahlfrost mit Vlies abdecken." },
  { id:"celeriac",   de:"Sellerie",     en:"Celeriac",     glyph:"Se", hue:75,  spacing_cm:40, sun:"full", water:"high", seasons:["spring","summer","autumn"],           yield:0.8, sowDepth:0,    harvestWeeks:20, family:"Apiaceae",       description:"Knollensellerie braucht eine lange, gleichmäßig feuchte Kultur. Lichtkeimer.", careNotes:"Flach pflanzen, die Knolle soll aus der Erde schauen. Unter 10 °C nach dem Auspflanzen droht Schossen." },
  { id:"fennel",     de:"Fenchel",      en:"Fennel",       glyph:"Fe", hue:90,  spacing_cm:30, sun:"full", water:"med",  seasons:["summer","autumn"],                    yield:0.4, sowDepth:1,    harvestWeeks:12, family:"Apiaceae",       description:"Knollenfenchel ab Juni säen — frühe Aussaaten schießen. Ein schwieriger Nachbar für viele Kulturen.", careNotes:"Gleichmäßig feucht halten und leicht anhäufeln, dann wird die Knolle zart." },
  { id:"parsnip",    de:"Pastinake",    en:"Parsnip",      glyph:"Pk", hue:50,  spacing_cm:15, sun:"full", water:"low",  seasons:["spring","summer","autumn","winter"],  yield:0.5, sowDepth:1.5,  harvestWeeks:24, family:"Apiaceae",       description:"Altes Wintergemüse mit nussig-süßem Geschmack. Kann bis zur Ernte im Beet bleiben.", careNotes:"Nur frisches Saatgut verwenden, keimt langsam. Nach Frost schmeckt sie süßer." },
  { id:"eggplant",   de:"Melanzani",    en:"Eggplant",     glyph:"Me", hue:285, spacing_cm:50, sun:"full", water:"med",  seasons:["summer","autumn"],                    yield:0.8, sowDepth:0.5,  harvestWeeks:16, family:"Solanaceae",     description:"Noch wärmebedürftiger als Paprika. Im Hochbeet an der sonnigsten, windgeschütztesten Stelle.", careNotes:"Früh vorziehen, nicht vor Mitte Mai pflanzen. Auf 4–6 Früchte je Pflanze begrenzen." },
  { id:"corn",       de:"Zuckermais",   en:"Sweet Corn",   glyph:"Zm", hue:50,  spacing_cm:35, sun:"full", water:"med",  seasons:["summer","autumn"],                    yield:0.6, sowDepth:4,    harvestWeeks:14, family:"Poaceae",        description:"Windbestäuber — im Block statt in einer einzelnen Reihe pflanzen. Mit Kürbis und Bohne die „Drei Schwestern“.", careNotes:"Hohe Pflanze an den Nordrand. Ernten, wenn die Fäden braun sind und der Kornsaft milchig ist." },
  { id:"nasturtium", de:"Kapuzinerkresse", en:"Nasturtium", glyph:"Kk", hue:20, spacing_cm:30, sun:"full", water:"low",  seasons:["summer","autumn"],                    yield:0.05,sowDepth:2,    harvestWeeks:8,  family:"Tropaeolaceae",  description:"Essbare Blüten und Blätter. Lockt Blattläuse und Kohlweißling als Fangpflanze weg.", careNotes:"Magerer Boden fördert Blüten statt Blätter. Darf über den Beetrand ranken." },
  { id:"calendula",  de:"Ringelblume",  en:"Pot Marigold", glyph:"Rb", hue:40,  spacing_cm:25, sun:"full", water:"low",  seasons:["spring","summer","autumn"],           yield:0.0, sowDepth:1,    harvestWeeks:0,  family:"Asteraceae",     description:"Heimische Schutzpflanze: hält Nematoden im Boden zurück und zieht Schwebfliegen an.", careNotes:"Verblühtes abschneiden, dann blüht sie bis zum Frost. Sät sich gern selbst aus." },
  { id:"borage",     de:"Borretsch",    en:"Borage",       glyph:"Bt", hue:220, spacing_cm:40, sun:"full", water:"med",  seasons:["summer","autumn"],                    yield:0.05,sowDepth:1.5,  harvestWeeks:8,  family:"Boraginaceae",   description:"Bienenmagnet mit blauen, essbaren Blüten. Verbessert die Bestäubung von Gurke, Zucchini und Erdbeere.", careNotes:"Direkt säen, verträgt kein Umpflanzen. Sät sich stark selbst aus." },
  { id:"thyme",      de:"Thymian",      en:"Thyme",        glyph:"Th", hue:300, spacing_cm:25, sun:"full", water:"low",  seasons:["spring","summer","autumn","winter"],  yield:0.05,sowDepth:0,    harvestWeeks:52, family:"Lamiaceae",      description:"Mehrjähriges Mittelmeerkraut. Der Duft verwirrt den Kohlweißling.", careNotes:"An den trockensten, sonnigsten Rand setzen. Nach der Blüte zurückschneiden, nie ins alte Holz." },
];

// Merge the agronomic detail (sowing months, feeder class, root depth …) onto
// every plant so callers only ever see one flat object.
export const PLANTS = BASE_PLANTS.map(p => ({
  precultureMonths: [], sowMonths: [], harvestMonths: [],
  feeder: 'medium', rootDepth_cm: 30, height_cm: 40,
  difficulty: 1, frostHardy: false, perennial: false, tags: [], aka: [],
  ...p,
  ...(PLANT_DETAILS[p.id] || {}),
  harvestSpanWeeks: HARVEST_SPAN_WEEKS[p.id] ?? 3,
  boltsInHeat: BOLTS_IN_HEAT.includes(p.id),
}));

export { FEEDERS };

// COMPANIONS — research-based matrix (Mischkultur / Central Europe)
// +1 = Gute Nachbarn | -1 = Schlechte Nachbarn
// pairScore() liest beide Richtungen — Matrix muss nicht vollständig symmetrisch sein.
export const COMPANIONS = {
  tomato:  { basil:1, carrot:1, parsley:1, marigold:1, spinach:1, lettuce:1, pepper:1, chive:1, potato:-1, kohlrabi:-1, cucumber:-1, dill:-1, zucchini:-1 },
  carrot:  { onion:1, leek:1, tomato:1, lettuce:1, radish:1, bean:1, pea:1, chive:1,   dill:-1, parsley:-1 },
  lettuce: { carrot:1, radish:1, onion:1, cucumber:1, strawberry:1, dill:1, bean:1, rucola:1, parsley:-1 },
  basil:   { tomato:1, pepper:1, lettuce:1 },
  onion:   { carrot:1, leek:1, lettuce:1, strawberry:1, cucumber:1, tomato:1,          bean:-1, pea:-1, spinach:-1 },
  radish:  { lettuce:1, carrot:1, cucumber:1, bean:1, kohlrabi:1, spinach:1, pea:1, rucola:1 },
  bean:    { carrot:1, radish:1, cucumber:1, spinach:1, kohlrabi:1, potato:1, strawberry:1, dill:1, onion:-1, leek:-1, pea:-1, chive:-1 },
  cucumber:{ bean:1, radish:1, lettuce:1, dill:1, onion:1, leek:1,                    tomato:-1, potato:-1, zucchini:-1 },
  spinach: { strawberry:1, radish:1, leek:1, carrot:1, bean:1, pea:1, rucola:1,       onion:-1 },
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
  rucola:  { lettuce:1, radish:1, spinach:1, carrot:1 },
  chive:   { tomato:1, carrot:1, strawberry:1, parsley:1,                              bean:-1 },
  cabbage: { celeriac:1, lettuce:1, spinach:1, bean:1, pea:1, dill:1, potato:1, beetroot:1, chard:1, thyme:1, nasturtium:1, calendula:1, strawberry:-1, onion:-1, garlic:-1 },
  kale:    { celeriac:1, spinach:1, lettuce:1, potato:1, leek:1, pea:1, beetroot:1, thyme:1, strawberry:-1, garlic:-1 },
  brussels:{ celeriac:1, spinach:1, lettuce:1, leek:1, pea:1, potato:1, nasturtium:1, strawberry:-1, onion:-1, garlic:-1 },
  broccoli:{ celeriac:1, lettuce:1, bean:1, pea:1, dill:1, potato:1, beetroot:1, chard:1, nasturtium:1, strawberry:-1, onion:-1, garlic:-1 },
  cauliflower:{ celeriac:1, lettuce:1, bean:1, pea:1, spinach:1, dill:1, beetroot:1, nasturtium:1, strawberry:-1, onion:-1, garlic:-1 },
  chard:   { bean:1, carrot:1, radish:1, lettuce:1, kohlrabi:1, onion:1,               spinach:-1, beetroot:-1 },
  beetroot:{ onion:1, garlic:1, dill:1, bean:1, kohlrabi:1, lettuce:1, zucchini:1, cucumber:1, spinach:-1, potato:-1, corn:-1 },
  pumpkin: { corn:1, polebean:1, nasturtium:1, dill:1, onion:1, marigold:1, borage:1,  potato:-1, cucumber:-1, zucchini:-1, tomato:-1 },
  polebean:{ corn:1, cucumber:1, lettuce:1, radish:1, celeriac:1, strawberry:1, cabbage:1, onion:-1, garlic:-1, leek:-1, pea:-1, chive:-1, fennel:-1 },
  garlic:  { strawberry:1, tomato:1, carrot:1, cucumber:1,                             bean:-1, pea:-1 },
  lambslettuce:{ onion:1, leek:1, strawberry:1, kohlrabi:1, radish:1 },
  celeriac:{ leek:1, bean:1, tomato:1, cucumber:1, spinach:1,                          lettuce:-1, potato:-1, parsley:-1 },
  fennel:  { lettuce:1, cucumber:1, pea:1,                                              tomato:-1, bean:-1, kohlrabi:-1, dill:-1, pepper:-1 },
  parsnip: { onion:1, garlic:1, leek:1, radish:1, lettuce:1,                            carrot:-1 },
  eggplant:{ bean:1, basil:1, pepper:1, marigold:1, thyme:1,                            potato:-1, fennel:-1 },
  corn:    { bean:1, cucumber:1, zucchini:1, pea:1, potato:1, lettuce:1,               tomato:-1 },
  nasturtium:{ tomato:1, cucumber:1, zucchini:1, broccoli:1, bean:1, potato:1, radish:1 },
  calendula:{ tomato:1, carrot:1, potato:1, bean:1, strawberry:1, lettuce:1 },
  borage:  { strawberry:1, cucumber:1, zucchini:1, tomato:1, cabbage:1 },
  thyme:   { cabbage:1, kale:1, tomato:1, strawberry:1, lettuce:1 },
};

export const SEASONS = [
  { id:"spring", de:"Frühling", en:"Spring", glyph:"✦", hue:95  },
  { id:"summer", de:"Sommer",   en:"Summer", glyph:"◉", hue:38  },
  { id:"autumn", de:"Herbst",   en:"Autumn", glyph:"◐", hue:22  },
  { id:"winter", de:"Winter",   en:"Winter", glyph:"❄", hue:210 },
];

// Reads both directions so the COMPANIONS object doesn't need to be symmetric
export function pairScore(a, b) {
  if (!a || !b || a === b) return 0;
  return (COMPANIONS[a]?.[b]) ?? (COMPANIONS[b]?.[a]) ?? 0;
}

export function plantById(id) { return PLANTS.find(p => p.id === id); }

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
    "cabbage-celeriac": "Sellerieduft hält den Kohlweißling fern — eine der bewährtesten Kohl-Mischkulturen.",
    "cabbage-thyme":    "Thymianduft stört den Kohlweißling bei der Eiablage.",
    "cabbage-nasturtium":"Kapuzinerkresse lockt Blattläuse und Kohlweißling als Fangpflanze vom Kohl weg.",
    "cabbage-strawberry":"Kohl und Erdbeere konkurrieren stark um Nährstoffe — die Erdbeere bleibt klein.",
    "chard-spinach":    "Beides Gänsefußgewächse: gleiche Schädlinge (Rübenfliege) und Blattflecken.",
    "beetroot-chard":   "Dieselbe Art (Beta vulgaris): teilen sämtliche Krankheiten und Schädlinge.",
    "corn-pumpkin":     "Drei Schwestern: Kürbisblätter beschatten den Boden, halten ihn feucht und unkrautfrei.",
    "corn-polebean":    "Drei Schwestern: Die Stangenbohne rankt am Mais hoch und versorgt ihn mit Stickstoff.",
    "garlic-strawberry":"Knoblauch schützt Erdbeeren vor Grauschimmel und anderen Pilzkrankheiten.",
    "eggplant-potato":  "Gleiche Familie (Solanaceae): Kartoffelkäfer und Krautfäule gehen auf die Melanzani über.",
    "carrot-parsnip":   "Gleiche Familie (Apiaceae): Die Möhrenfliege befällt beide.",
    "fennel-tomato":    "Fenchel hemmt über Wurzelausscheidungen viele Nachbarn — am besten mit Abstand pflanzen.",
    "borage-strawberry":"Borretsch lockt Bienen an und verbessert so die Bestäubung der Erdbeeren.",
  };
  return map[key] || null;
}

// ── Labels & lookups ──────────────────────────────────────────────────────
export const SUN_DE   = { full:'Volle Sonne', part:'Halbschatten', shade:'Schatten' };
export const SUN_ICON = { full:'☀', part:'⛅', shade:'☁' };
export const WATER_DE   = { high:'Viel Wasser', med:'Mittlerer Bedarf', low:'Wenig Wasser' };
export const WATER_ICON = { high:'💧💧💧', med:'💧💧', low:'💧' };
export const DIFFICULTY_DE = { 1:'Einfach', 2:'Mittel', 3:'Anspruchsvoll' };

/**
 * Free-text search over the German and English name, regional names and the
 * tag list, so "schnell", "kräuter", "tomato" or "Paradeiser" all find something.
 */
export function searchPlants(list, query) {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter(p =>
    p.de.toLowerCase().includes(q) ||
    p.en.toLowerCase().includes(q) ||
    p.family.toLowerCase().includes(q) ||
    p.aka.some(a => a.toLowerCase().includes(q)) ||
    p.tags.some(t => t.toLowerCase().includes(q)),
  );
}

/**
 * Warns when a plant's roots need more soil than the bed offers. A classic
 * raised-bed mistake: carrots or potatoes in a 25 cm shallow bed.
 */
export function fitsBedHeight(plant, bedHeightCm) {
  if (!bedHeightCm) return true;
  return plant.rootDepth_cm <= bedHeightCm;
}
