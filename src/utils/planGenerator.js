// The Reihenmischkultur generator.
//
// Lives outside the page so it can be exercised directly: fitting rows into a
// fixed depth is the kind of arithmetic that is far easier to get right with a
// test than with a screenshot. See tests/planGenerator.test.mjs.

import { pairScore, plantById } from '../data/plants.js';

/** Circles drawn per row before each one starts standing for several plants. */
const MAX_PER_BAND = 24;

// `title` is the headline of the finished plan — "Viel Ertrag" + "-Plan" made
// for clumsy German, so each goal carries its own phrasing.
export const GOALS = [
  { id:'easy',   de:'Pflegeleicht',  title:'Pflegeleichter Plan', desc:'Robuste Kulturen, wenig Gießen.', pick:p => p.difficulty === 1 && p.water !== 'high' },
  { id:'yield',  de:'Viel Ertrag',   title:'Ertragsplan',         desc:'Maximale Erntemenge je m².',      pick:p => p.yield >= 0.3 },
  { id:'family', de:'Vielfalt',      title:'Vielfaltsplan',       desc:'Bunte Mischung für die Küche.',   pick:p => p.yield > 0 },
  { id:'kids',   de:'Mit Kindern',   title:'Plan für Kinder',     desc:'Schnelle Erfolge, große Samen.',  pick:p => p.tags.includes('kinder') || p.harvestWeeks <= 6 },
  { id:'herbs',  de:'Küchenkräuter', title:'Kräuterplan',         desc:'Würze direkt vor der Tür.',       pick:p => p.tags.includes('kräuter') || p.tags.includes('schutzpflanze') },
];

/** Why a chosen plant did not make it into the plan. */
export const SKIP_REASONS = { season:'season', depth:'depth', space:'space' };

/**
 * Picks the rows to grow: the subset of `pool` that fits into `depthCm` and
 * contains as many of the gardener's actual choices as possible, ties broken
 * by the goal score.
 *
 * This is a 0/1 knapsack over centimetres rather than a greedy walk. Greedy
 * dropped a plant that would have fitted if an earlier, lower-ranked one had
 * been left out — so adding a plant could silently push a different one out of
 * the plan, which is exactly what "meine Auswahl wird ignoriert" looks like.
 */
function chooseRows(pool, depthCm, scoreOf) {
  const capacity = Math.floor(depthCm);
  // best[d] = best packing whose rows total exactly d cm, or null if d is not
  // reachable. Counting kinds first keeps the gardener's selection intact.
  const best = new Array(capacity + 1).fill(null);
  best[0] = { count: 0, score: 0, items: [] };

  for (const plant of pool) {
    const w = Math.max(1, Math.round(plant.spacing_cm));
    for (let d = capacity; d >= w; d--) {
      const from = best[d - w];
      if (!from) continue;
      const candidate = { count: from.count + 1, score: from.score + scoreOf(plant), items: [...from.items, plant] };
      const current = best[d];
      if (!current || candidate.count > current.count ||
          (candidate.count === current.count && candidate.score > current.score)) {
        best[d] = candidate;
      }
    }
  }

  let winner = best[0];
  for (let d = 1; d <= capacity; d++) {
    const c = best[d];
    if (!c) continue;
    if (c.count > winner.count || (c.count === winner.count && c.score > winner.score)) winner = c;
  }
  return winner.items;
}

/**
 * Builds a row-based mixed-culture plan (Reihenmischkultur).
 *
 * Rows run across the bed, are chosen to honour as much of the selection as
 * the depth allows, then sorted tall-to-short so nothing shades what grows in
 * front of it, and finally bad neighbours are separated by local swaps.
 *
 * Anything that could not be planted comes back in `skipped` with a reason, so
 * the screen can say why instead of quietly leaving it out.
 */
export function generatePlan({ picks, widthCm, depthCm, heightCm, season, goal }) {
  const selected = (picks || []).map(plantById).filter(Boolean);
  if (!selected.length) return null;

  // Sort out what cannot grow here at all before trying to fit anything.
  const skipped = [];
  const pool = [];
  for (const p of selected) {
    if (!p.seasons.includes(season)) skipped.push({ plant: p, reason: SKIP_REASONS.season });
    else if (p.spacing_cm > depthCm) skipped.push({ plant: p, reason: SKIP_REASONS.depth });
    else pool.push(p);
  }

  const emptyPlan = {
    cells: {}, rows: [], kinds: [], skipped,
    totalCount: 0, yieldKg: 0, careHours: 0, tooDeep: [], usedDepth: 0,
  };
  if (!pool.length) return emptyPlan;

  // How well a plant mixes with the rest of the selection, plus the goal bias.
  const affinity = p => pool.reduce((s, o) => (o.id === p.id ? s : s + pairScore(p.id, o.id)), 0);
  const goalScore = p =>
    goal === 'yield' ? p.yield * 3 :
    goal === 'easy' ? (3 - p.difficulty) * 2 :
    goal === 'kids' ? Math.max(0, 12 - p.harvestWeeks) / 3 :
    0;
  const scoreOf = p => affinity(p) + goalScore(p);

  const rows = chooseRows(pool, depthCm, scoreOf);
  for (const p of pool) {
    if (!rows.some(r => r.id === p.id)) skipped.push({ plant: p, reason: SKIP_REASONS.space });
  }
  if (!rows.length) return emptyPlan;

  // Spend whatever depth is left on a second row of the least-used plants.
  // Nothing unplaced can fit here — the knapsack would have taken it instead.
  let used = rows.reduce((s, p) => s + p.spacing_cm, 0);
  for (let guard = 0; guard < 40; guard++) {
    const times = id => rows.filter(r => r.id === id).length;
    const fits = rows
      .filter(p => used + p.spacing_cm <= depthCm)
      .sort((a, b) => times(a.id) - times(b.id) || a.spacing_cm - b.spacing_cm);
    if (!fits.length) break;
    rows.push(fits[0]);
    used += fits[0].spacing_cm;
  }

  // Tall at the back (top of the canvas is the north side of the bed).
  rows.sort((a, b) => b.height_cm - a.height_cm);

  // Separate bad neighbours by swapping in a compatible row from further down.
  for (let i = 1; i < rows.length; i++) {
    if (pairScore(rows[i - 1].id, rows[i].id) >= 0) continue;
    const j = rows.findIndex((p, k) =>
      k > i &&
      pairScore(rows[i - 1].id, p.id) >= 0 &&
      (k + 1 >= rows.length || pairScore(p.id, rows[k + 1].id) >= 0));
    if (j > -1) { const tmp = rows[i]; rows[i] = rows[j]; rows[j] = tmp; }
  }

  // Lay the rows out and fill each with evenly spaced plants.
  const cells = {};
  const layout = [];
  let y = 0;
  rows.forEach(plant => {
    const rowY = Math.round(y + plant.spacing_cm / 2);
    const cols = Math.max(1, Math.floor(widthCm / plant.spacing_cm));
    const shown = Math.min(cols, MAX_PER_BAND);
    const perCircle = Math.ceil(cols / shown);
    const stepCm = (widthCm - plant.spacing_cm) / Math.max(1, shown - 1);
    for (let i = 0; i < shown; i++) {
      // Exact centimetres, not 5 cm steps — snapping distorted the even
      // spacing enough to make neighbouring circles visibly overlap.
      const x = Math.round(plant.spacing_cm / 2 + (shown === 1 ? (widthCm - plant.spacing_cm) / 2 : i * stepCm));
      const key = `${x}_${rowY}`;
      if (cells[key]) continue;
      const count = i === shown - 1 ? Math.max(1, cols - perCircle * (shown - 1)) : perCircle;
      cells[key] = { plantId: plant.id, x, y: rowY, count };
    }
    layout.push({ plant, total: cols, rowY, yieldKg: plant.yield * cols });
    y += plant.spacing_cm;
  });

  const kinds = [...new Set(layout.map(r => r.plant.id))];
  return {
    cells,
    rows: layout,
    kinds,
    skipped,
    totalCount: layout.reduce((s, r) => s + r.total, 0),
    yieldKg: layout.reduce((s, r) => s + r.yieldKg, 0),
    careHours: Math.round((layout.reduce((s, r) => s + r.plant.difficulty, 0) / 2 + layout.length * 0.3) * 10) / 10,
    tooDeep: kinds.map(plantById).filter(p => p.rootDepth_cm > heightCm),
    usedDepth: y,
  };
}
