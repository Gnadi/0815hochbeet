// Fruchtfolge across years and Folgekultur within a year.
//
// The old check flagged a family that showed up in two of the four seasons of
// one year — which is succession planting, not rotation, and said nothing
// about the rule that actually matters ("Kohl 3–4 Jahre Pause"). With dated
// plantings both questions can be answered:
//
// - Rotation: did this family grow in this bed within its pause period?
// - Succession: within a year, does a crop follow a close relative on the
//   same spot (Spinat → Mangold)?

import { plantById } from '../data/plants.js';
import { inYear, mainYear, spaceOverlap, timeOverlap } from '../lib/timeline.js';

const FAMILY_DE = {
  Solanaceae:     'Nachtschattengewächse',
  Apiaceae:       'Doldenblütler',
  Asteraceae:     'Korbblütler',
  Lamiaceae:      'Lippenblütler',
  Amaryllidaceae: 'Zwiebelgewächse',
  Brassicaceae:   'Kreuzblütler',
  Fabaceae:       'Hülsenfrüchtler',
  Cucurbitaceae:  'Kürbisgewächse',
  Chenopodiaceae: 'Gänsefußgewächse',
  Rosaceae:       'Rosengewächse',
  Poaceae:        'Süßgräser',
  Caprifoliaceae: 'Baldriangewächse',
  Tropaeolaceae:  'Kapuzinerkressengewächse',
  Boraginaceae:   'Raublattgewächse',
};

/**
 * Years a family should stay away from the same bed. Families not listed
 * (herbs, flowers) have no meaningful pause.
 */
export const PAUSE_YEARS = {
  Brassicaceae: 4, Fabaceae: 4, Apiaceae: 3, Solanaceae: 3,
  Chenopodiaceae: 3, Amaryllidaceae: 3, Cucurbitaceae: 3, Asteraceae: 2,
};

/** Paradeiser are famously self-tolerant — tomato after tomato is fine. */
const SELF_TOLERANT = new Set(['tomato']);

const ROTATION_TIPS = {
  Solanaceae:    'Nach Nachtschattengewächsen Hülsenfrüchtler oder Wurzelgemüse pflanzen.',
  Brassicaceae:  'Kohl mindestens 3–4 Jahre Pause an derselben Stelle — sonst droht Kohlhernie.',
  Cucurbitaceae: 'Kürbisgewächse zehren stark — danach Hülsenfrüchtler zum Stickstoffaufbau.',
  Fabaceae:      'Erbsen und Bohnen sind mit sich selbst unverträglich — 4 Jahre Pause.',
  Chenopodiaceae:'Mangold, Rote Rübe und Spinat sind eng verwandt — nicht direkt nacheinander anbauen.',
  Apiaceae:      'Karotte, Sellerie, Pastinake und Fenchel teilen die Möhrenfliege — 3–4 Jahre Abstand halten.',
  Amaryllidaceae:'Zwiebel, Lauch und Knoblauch 3 Jahre Pause — sonst Zwiebelfliege und Weißfäule.',
};

export function familyDe(family) {
  return FAMILY_DE[family] || family;
}

function plantingsWithPlant(plantings) {
  return Object.values(plantings || {})
    .map(p => ({ ...p, plant: plantById(p.plantId) }))
    .filter(p => p.plant && !p.plant.perennial);
}

/** Families grown in the bed per calendar year: `{ 2025: Set<family> }`. */
export function familiesByYear(plantings) {
  const out = {};
  for (const p of plantingsWithPlant(plantings)) {
    const y = mainYear(p);
    (out[y] ||= new Map());
    const ids = out[y].get(p.plant.family) || new Set();
    ids.add(p.plantId);
    out[y].set(p.plant.family, ids);
  }
  return out;
}

/**
 * Rotation and succession check for `year`.
 * `warnings` carry `kind: 'rotation' | 'succession'`; the score drops 25 per
 * rotation problem and 10 per succession problem.
 */
export function getRotationAnalysis(plantings, year = new Date().getFullYear()) {
  const byYear = familiesByYear(plantings);
  const now = byYear[year] || new Map();
  const warnings = [];

  for (const [family, ids] of now) {
    const pause = PAUSE_YEARS[family];
    if (!pause) continue;
    const hits = [];
    for (let y = year - pause + 1; y < year; y++) {
      const before = byYear[y]?.get(family);
      if (!before) continue;
      const onlySelfTolerant = [...ids, ...before].every(id => SELF_TOLERANT.has(id));
      if (!onlySelfTolerant) hits.push(y);
    }
    if (hits.length) {
      warnings.push({
        kind: 'rotation', family, familyDe: familyDe(family), years: hits, pause,
        text: `${familyDe(family)} standen schon ${hits.join(', ')} in diesem Beet. Empfohlen sind ${pause} Jahre Pause.`,
        tip: ROTATION_TIPS[family] || null,
      });
    }
  }

  // Succession within the year: a close relative on the same spot right after.
  const thisYear = plantingsWithPlant(Object.fromEntries(inYear(plantings, year).map(p => [p.id, p])));
  const seen = new Set();
  for (const a of thisYear) {
    for (const b of thisYear) {
      if (a === b || a.end >= b.start || a.plant.family !== b.plant.family) continue;
      if (!PAUSE_YEARS[a.plant.family] || timeOverlap(a, b) || !spaceOverlap(a, b)) continue;
      if (SELF_TOLERANT.has(a.plantId) && SELF_TOLERANT.has(b.plantId)) continue;
      const sig = `${a.plantId}>${b.plantId}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      warnings.push({
        kind: 'succession', family: a.plant.family, familyDe: familyDe(a.plant.family),
        text: `${b.plant.de} folgt auf ${a.plant.de} — beide ${familyDe(a.plant.family)}, gleiche Schädlinge und Krankheiten.`,
        tip: ROTATION_TIPS[a.plant.family] || null,
      });
    }
  }

  const rotations = warnings.filter(w => w.kind === 'rotation').length;
  const score = Math.max(0, 100 - rotations * 25 - (warnings.length - rotations) * 10);
  return { score, warnings };
}

/**
 * For the year after `year`: families that must still wait, and those that
 * would be a good next crop (pause satisfied, Hülsenfrüchtler after
 * Starkzehrer).
 */
export function nextYearAdvice(plantings, year = new Date().getFullYear()) {
  const byYear = familiesByYear(plantings);
  const blocked = [];
  for (const [family, pause] of Object.entries(PAUSE_YEARS)) {
    const last = [year, year - 1, year - 2, year - 3].find(y => byYear[y]?.has(family));
    if (last !== undefined && year + 1 - last < pause) {
      blocked.push({ family, familyDe: familyDe(family), freeFrom: last + pause });
    }
  }
  return { blocked };
}
