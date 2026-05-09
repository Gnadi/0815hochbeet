import { SNAP_CM, plantById } from '../data/plants';

export const GOALS = [
  { id:'easy',   de:'Einfach',      desc:'Wenig Pflege — ideal für Einsteiger.' },
  { id:'yield',  de:'Hoher Ertrag', desc:'Maximale Ernte auf minimaler Fläche.' },
  { id:'family', de:'Familie',      desc:'Abwechslungsreich & kinderfreundlich.' },
];

const MAX_PER_ZONE = 10;

function snapV(v) { return Math.round(v / SNAP_CM) * SNAP_CM; }

export function generatePlan(goal, picks, widthCm, depthCm) {
  const available = picks.map(id => plantById(id)).filter(Boolean);
  if (!available.length) return null;

  let candidates = available.filter(plant =>
    Math.floor(depthCm / plant.spacing_cm) > 0
  );
  if (!candidates.length) return null;

  if (goal === 'yield') candidates.sort((a, b) => b.yield - a.yield);
  if (goal === 'easy')  candidates.sort((a, b) => (a.water==='low'?0:1) - (b.water==='low'?0:1));

  const zoneW = widthCm / candidates.length;
  const plantings = candidates.map(plant => {
    const fitCols = Math.max(1, Math.floor(zoneW   / plant.spacing_cm));
    const fitRows = Math.max(1, Math.floor(depthCm / plant.spacing_cm));
    return { plant, fitCols, fitRows, count: fitCols * fitRows };
  });

  const cells = {};
  plantings.forEach(({ plant, fitCols, fitRows }, idx) => {
    const xStart    = idx * zoneW;
    const total     = fitCols * fitRows;
    const show      = Math.min(total, MAX_PER_ZONE);
    const perCircle = Math.ceil(total / show);
    const step      = Math.ceil(total / show);
    let placed      = 0;
    for (let r = 0; r < fitRows && placed < show; r++) {
      for (let c = 0; c < fitCols && placed < show; c++) {
        if ((r * fitCols + c) % step !== 0) continue;
        const x = snapV(xStart + c * plant.spacing_cm + plant.spacing_cm / 2);
        const y = snapV(r       * plant.spacing_cm + plant.spacing_cm / 2);
        const key = `${x}_${y}`;
        if (!cells[key]) { cells[key] = { plantId:plant.id, x, y, count:perCircle }; placed++; }
      }
    }
  });

  const totalCount = plantings.reduce((s,p) => s + p.count, 0);
  const yieldKg   = plantings.reduce((s, {plant, count}) => s + plant.yield * count, 0);
  const careHours = goal==='easy' ? 1.5 : goal==='yield' ? 3 : 2;
  const usedPlants = plantings.map(p => p.plant);
  const names = usedPlants.slice(0,3).map(p => p.de).join(', ');

  const desc = goal==='yield'
    ? `Ertragsoptimiert: ${names} und mehr. Volle Nutzung aller Sonnenstunden.`
    : goal==='easy'
    ? `Pflegeleicht: Trockenheitsverträgliche Pflanzen wie ${names}. Wenig Pflege nötig.`
    : `Familienfreundlich: Abwechslungsreiche Ernte mit ${names}. Ideal für Kinder.`;

  return { cells, plantings, totalCount, yieldKg, careHours, description:desc, usedPlants };
}
