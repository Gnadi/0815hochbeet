import { plantById } from '../data/plants';

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
};

const SEASON_DE = { spring:'Frühling', summer:'Sommer', autumn:'Herbst', winter:'Winter' };

const ROTATION_TIPS = {
  Solanaceae:    'Nach Nachtschattengewächsen Hülsenfrüchter oder Wurzelgemüse pflanzen.',
  Brassicaceae:  'Kohl mindestens 3 Jahre Pause an derselben Stelle — Clubroot-Gefahr.',
  Cucurbitaceae: 'Kürbisgewächse stark zehrend — danach Hülsenfrüchter zum Stickstoffaufbau.',
  Fabaceae:      'Prima Vorfrucht! Stickstoffknöllchen im Boden lassen — Nachfolger profitiert.',
};

export function familyDe(family) {
  return FAMILY_DE[family] || family;
}

export function getRotationAnalysis(seasonCells) {
  const familiesPerSeason = {};
  for (const [season, cells] of Object.entries(seasonCells || {})) {
    const families = new Set();
    for (const v of Object.values(cells || {})) {
      if (typeof v !== 'object') continue;
      const p = plantById(v.plantId);
      if (p?.family) families.add(p.family);
    }
    if (families.size > 0) familiesPerSeason[season] = [...families];
  }

  const allSeasons = Object.keys(familiesPerSeason);
  if (allSeasons.length === 0) return { score: 100, warnings: [] };

  // Count how many seasons each family appears in
  const familyCounts = {};
  for (const families of Object.values(familiesPerSeason)) {
    for (const f of families) {
      familyCounts[f] = (familyCounts[f] || 0) + 1;
    }
  }

  const warnings = [];
  for (const [family, count] of Object.entries(familyCounts)) {
    if (count > 1) {
      const seasons = allSeasons.filter(s => familiesPerSeason[s]?.includes(family));
      warnings.push({
        family,
        familyDe: FAMILY_DE[family] || family,
        seasons: seasons.map(s => SEASON_DE[s] || s),
        tip: ROTATION_TIPS[family] || null,
      });
    }
  }

  // Score: 100 minus 25 per repeated family, floor at 0
  const score = Math.max(0, 100 - warnings.length * 25);
  return { score, warnings };
}
