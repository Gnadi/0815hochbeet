// Agronomic detail per plant, merged into PLANTS in ./plants.js.
//
// Months are 0-indexed (0 = Januar) and describe Central-European practice
// (Zone 6–8). `sowMonths` is when seed goes into the bed, `precultureMonths`
// when it goes on the windowsill, `harvestMonths` the picking window.
//
// `feeder` follows the German Starkzehrer / Mittelzehrer / Schwachzehrer
// classification — the backbone of a proper Fruchtfolge.
// `rootDepth_cm` matters in a raised bed, where soil depth is finite.
// `height_cm` drives the shading hint (tall plants belong on the north edge).

export const FEEDERS = {
  heavy:  { de: 'Starkzehrer',   short: 'Stark',  order: 1, tip: 'Braucht viel Kompost. Danach Mittel- oder Schwachzehrer setzen.' },
  medium: { de: 'Mittelzehrer',  short: 'Mittel', order: 2, tip: 'Moderater Nährstoffbedarf. Gut als zweites Jahr nach Starkzehrern.' },
  light:  { de: 'Schwachzehrer', short: 'Schwach',order: 3, tip: 'Kommt mit wenig aus. Ideal im dritten Jahr der Fruchtfolge.' },
  fixer:  { de: 'Stickstoffsammler', short: 'N-Sammler', order: 4, tip: 'Reichert den Boden mit Stickstoff an — perfekte Vorfrucht.' },
};

export const PLANT_DETAILS = {
  tomato:     { precultureMonths:[1,2],  sowMonths:[4],           harvestMonths:[6,7,8,9],        feeder:'heavy',  rootDepth_cm:60, height_cm:180, difficulty:3, frostHardy:false, perennial:false, tags:['ertragreich','stütze','vorziehen'] },
  carrot:     { precultureMonths:[],     sowMonths:[2,3,4,5],     harvestMonths:[5,6,7,8,9],      feeder:'medium', rootDepth_cm:40, height_cm:30,  difficulty:2, frostHardy:true,  perennial:false, tags:['lagerfähig','tiefwurzler'] },
  lettuce:    { precultureMonths:[1,2],  sowMonths:[2,3,4,5,6,7], harvestMonths:[4,5,6,7,8,9],    feeder:'light',  rootDepth_cm:20, height_cm:25,  difficulty:1, frostHardy:true,  perennial:false, tags:['schnell','anfänger','lückenfüller'] },
  basil:      { precultureMonths:[2,3],  sowMonths:[4,5],         harvestMonths:[5,6,7,8],        feeder:'medium', rootDepth_cm:20, height_cm:40,  difficulty:2, frostHardy:false, perennial:false, tags:['kräuter','vorziehen','kübel'] },
  onion:      { precultureMonths:[],     sowMonths:[2,3],         harvestMonths:[6,7],            feeder:'light',  rootDepth_cm:25, height_cm:40,  difficulty:1, frostHardy:true,  perennial:false, tags:['lagerfähig','anfänger'] },
  radish:     { precultureMonths:[],     sowMonths:[2,3,4,5,6,7,8], harvestMonths:[3,4,5,6,7,8,9],feeder:'light',  rootDepth_cm:15, height_cm:15,  difficulty:1, frostHardy:true,  perennial:false, tags:['schnell','anfänger','kinder'] },
  bean:       { precultureMonths:[],     sowMonths:[4,5,6],       harvestMonths:[6,7,8,9],        feeder:'fixer',  rootDepth_cm:40, height_cm:50,  difficulty:1, frostHardy:false, perennial:false, tags:['anfänger','bodenverbesserer','kinder'] },
  cucumber:   { precultureMonths:[3],    sowMonths:[4],           harvestMonths:[6,7,8],          feeder:'heavy',  rootDepth_cm:40, height_cm:200, difficulty:2, frostHardy:false, perennial:false, tags:['ertragreich','rankt','durstig'] },
  spinach:    { precultureMonths:[],     sowMonths:[2,3,7,8],     harvestMonths:[3,4,5,8,9,10],   feeder:'medium', rootDepth_cm:30, height_cm:25,  difficulty:1, frostHardy:true,  perennial:false, tags:['schnell','winterhart','vorkultur'] },
  potato:     { precultureMonths:[2],    sowMonths:[3],           harvestMonths:[6,7,8],          feeder:'heavy',  rootDepth_cm:40, height_cm:60,  difficulty:2, frostHardy:false, perennial:false, tags:['ertragreich','lagerfähig','platzhungrig'] },
  leek:       { precultureMonths:[1,2],  sowMonths:[5],           harvestMonths:[8,9,10,11,0,1,2],feeder:'medium', rootDepth_cm:30, height_cm:60,  difficulty:2, frostHardy:true,  perennial:false, tags:['winterhart','lange kultur'] },
  pea:        { precultureMonths:[],     sowMonths:[2,3,4],       harvestMonths:[5,6,7],          feeder:'fixer',  rootDepth_cm:40, height_cm:80,  difficulty:1, frostHardy:true,  perennial:false, tags:['anfänger','rankt','bodenverbesserer','kinder'] },
  kohlrabi:   { precultureMonths:[1,2],  sowMonths:[2,3,4,5,6],   harvestMonths:[4,5,6,7,8,9],    feeder:'medium', rootDepth_cm:30, height_cm:30,  difficulty:1, frostHardy:true,  perennial:false, tags:['schnell','anfänger'] },
  zucchini:   { precultureMonths:[3],    sowMonths:[4],           harvestMonths:[6,7,8],          feeder:'heavy',  rootDepth_cm:50, height_cm:60,  difficulty:1, frostHardy:false, perennial:false, tags:['ertragreich','platzhungrig','anfänger'] },
  pepper:     { precultureMonths:[1,2],  sowMonths:[4],           harvestMonths:[6,7,8,9],        feeder:'heavy',  rootDepth_cm:40, height_cm:80,  difficulty:3, frostHardy:false, perennial:false, tags:['vorziehen','wärmebedürftig','stütze'] },
  strawberry: { precultureMonths:[],     sowMonths:[7,8],         harvestMonths:[5,6],            feeder:'medium', rootDepth_cm:30, height_cm:25,  difficulty:1, frostHardy:true,  perennial:true,  tags:['mehrjährig','kinder'] },
  marigold:   { precultureMonths:[2],    sowMonths:[3,4],         harvestMonths:[],               feeder:'light',  rootDepth_cm:20, height_cm:40,  difficulty:1, frostHardy:false, perennial:false, tags:['schutzpflanze','blüht','bienen'] },
  dill:       { precultureMonths:[],     sowMonths:[3,4,5,6,7],   harvestMonths:[5,6,7,8],        feeder:'light',  rootDepth_cm:30, height_cm:80,  difficulty:1, frostHardy:false, perennial:false, tags:['kräuter','nützlinge','bienen'] },
  parsley:    { precultureMonths:[],     sowMonths:[2,3,4,5,6],   harvestMonths:[5,6,7,8,9,10],   feeder:'medium', rootDepth_cm:30, height_cm:30,  difficulty:2, frostHardy:true,  perennial:false, tags:['kräuter','langsam keimend'] },
  rucola:     { precultureMonths:[],     sowMonths:[2,3,4,5,6,7,8], harvestMonths:[3,4,5,6,7,8,9],feeder:'light',  rootDepth_cm:20, height_cm:25,  difficulty:1, frostHardy:true,  perennial:false, tags:['schnell','anfänger','lückenfüller'] },
  chive:      { precultureMonths:[],     sowMonths:[2,3,4,5],     harvestMonths:[3,4,5,6,7,8,9],  feeder:'light',  rootDepth_cm:20, height_cm:30,  difficulty:1, frostHardy:true,  perennial:true,  tags:['kräuter','mehrjährig','bienen'] },
};

export const MONTHS_DE       = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
export const MONTHS_DE_SHORT = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];

/** Compact "Mär–Jun" / "Mär, Aug–Sep" label for a set of month indices. */
export function monthRangeLabel(months) {
  if (!months?.length) return '—';
  const sorted = [...new Set(months)].sort((a, b) => a - b);
  const runs = [];
  let start = sorted[0], prev = sorted[0];
  for (const m of sorted.slice(1)) {
    if (m === prev + 1) { prev = m; continue; }
    runs.push([start, prev]);
    start = prev = m;
  }
  runs.push([start, prev]);
  // Dez→Jan wraps around the year end (leek overwinters).
  if (runs.length > 1 && runs[0][0] === 0 && runs[runs.length - 1][1] === 11) {
    const first = runs.shift();
    const last = runs.pop();
    runs.push([last[0], first[1]]);
  }
  return runs
    .map(([a, b]) => (a === b ? MONTHS_DE_SHORT[a] : `${MONTHS_DE_SHORT[a]}–${MONTHS_DE_SHORT[b]}`))
    .join(', ');
}
