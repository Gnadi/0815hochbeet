// Turns what is actually planted into a concrete weekly to-do list.
//
// Before this, the "Diese Woche" panel showed four hard-coded rows ("MO
// Tomaten ausgeizen") no matter what was in the bed. Everything here is
// derived from the bed contents, the calendar month and the plant data, so the
// list is real work the gardener has to do.

import { plantById, PLANTS } from '../data/plants';

const DAY = 86400000;

/** Recurring, plant-specific chores that only make sense in certain months. */
const CARE_RULES = {
  tomato:     [{ months:[5,6,7,8],   every:'week', weekday:2, title:'Tomaten ausgeizen' }],
  potato:     [{ months:[4,5],       every:'week', weekday:6, title:'Kartoffeln anhäufeln' }],
  leek:       [{ months:[6,7,8],     every:'week', weekday:6, title:'Lauch anhäufeln (weiße Schäfte)' }],
  strawberry: [{ months:[5,6,7],     every:'week', weekday:6, title:'Erdbeer-Ausläufer entfernen' }],
  basil:      [{ months:[5,6,7],     every:'week', weekday:4, title:'Basilikum-Blüten ausknipsen' }],
  zucchini:   [{ months:[5,6,7,8],   every:'week', weekday:5, title:'Zucchini jung ernten' }],
  cucumber:   [{ months:[5,6,7],     every:'week', weekday:3, title:'Gurken aufbinden & ausgeizen' }],
  marigold:   [{ months:[5,6,7,8],   every:'week', weekday:6, title:'Verblühte Tagetes abschneiden' }],
  pepper:     [{ months:[6,7,8],     every:'week', weekday:2, title:'Paprika abstützen' }],
  dill:       [{ months:[4,5,6],     every:'week', weekday:5, title:'Dill nachsäen für Nachschub' }],
};

/** Watering weekdays (0 = Sunday) by thirst level and season. */
const WATER_DAYS = {
  summer: { high:[1,3,5,0], med:[1,4], low:[6] },
  spring: { high:[1,4],     med:[2],   low:[] },
  autumn: { high:[1,4],     med:[5],   low:[] },
  winter: { high:[],        med:[],    low:[] },
};

export const TASK_KINDS = {
  water:      { de:'Gießen',     icon:'💧', color:'var(--green)' },
  sow:        { de:'Aussaat',    icon:'✦',  color:'var(--terra)' },
  preculture: { de:'Vorziehen',  icon:'🪴', color:'var(--ochre)' },
  harvest:    { de:'Ernte',      icon:'🧺', color:'var(--good)' },
  care:       { de:'Pflege',     icon:'✂',  color:'var(--ink-dim)' },
  protect:    { de:'Schutz',     icon:'❄',  color:'var(--warn)' },
};

export function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Monday-based week containing `date`. */
export function weekRange(date = new Date()) {
  const start = new Date(date);
  const dow = start.getDay();
  start.setDate(start.getDate() + (dow === 0 ? -6 : 1 - dow));
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 6 * DAY);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function plantIdsIn(bed, season) {
  const cells = bed.seasonCells?.[season] || {};
  const ids = new Set();
  Object.values(cells).forEach(v => {
    if (v && typeof v === 'object' && v.plantId) ids.add(v.plantId);
    else if (typeof v === 'string') ids.add(v);
  });
  return [...ids];
}

function seasonOf(month) {
  if (month <= 1 || month === 11) return 'winter';
  if (month <= 4) return 'spring';
  if (month <= 7) return 'summer';
  return 'autumn';
}

function push(out, task) {
  if (!out.some(t => t.id === task.id)) out.push(task);
}

/**
 * Builds every auto-task for the days between `from` and `to` (inclusive).
 * Ids are deterministic so a completed task stays completed across reloads.
 */
export function generateTasks(beds, from, to) {
  const out = [];
  if (!beds?.length) return out;

  for (let ts = new Date(from).setHours(0, 0, 0, 0); ts <= to.getTime(); ts += DAY) {
    const day = new Date(ts);
    const dateStr = toDateStr(day);
    const month = day.getMonth();
    const weekday = day.getDay();
    const season = seasonOf(month);

    for (const bed of beds) {
      const ids = plantIdsIn(bed, season);
      if (!ids.length) continue;
      const plants = ids.map(plantById).filter(Boolean);

      // ── Watering ────────────────────────────────────────────────────────
      const thirst = plants.some(p => p.water === 'high') ? 'high'
        : plants.some(p => p.water === 'med') ? 'med' : 'low';
      if (WATER_DAYS[season][thirst].includes(weekday)) {
        const thirstiest = plants
          .filter(p => p.water === thirst)
          .slice(0, 3).map(p => p.de).join(', ');
        push(out, {
          id: `auto:${bed.id}:water:${dateStr}`,
          kind: 'water', date: dateStr, bedId: bed.id, auto: true,
          title: `${bed.name} gießen`,
          detail: thirst === 'high' ? `Durstig: ${thirstiest}. Morgens und bodennah wässern.` : `Erde 3 cm tief prüfen — nur gießen wenn trocken.`,
        });
      }

      // ── Sowing / planting window ────────────────────────────────────────
      if (weekday === 6) {
        plants.filter(p => p.sowMonths.includes(month)).forEach(p => {
          push(out, {
            id: `auto:${bed.id}:sow:${p.id}:${dateStr}`,
            kind: 'sow', date: dateStr, bedId: bed.id, plantId: p.id, auto: true,
            title: `${p.de} säen/pflanzen`,
            detail: `${p.sowDepth > 0 ? `${p.sowDepth} cm tief, ` : ''}${p.spacing_cm} cm Abstand. Erntereif in ca. ${p.harvestWeeks} Wochen.`,
          });
        });
      }

      // ── Pre-growing on the windowsill ───────────────────────────────────
      if (weekday === 6) {
        plants.filter(p => p.precultureMonths.includes(month)).forEach(p => {
          push(out, {
            id: `auto:${bed.id}:preculture:${p.id}:${dateStr}`,
            kind: 'preculture', date: dateStr, bedId: bed.id, plantId: p.id, auto: true,
            title: `${p.de} vorziehen`,
            detail: 'Auf der Fensterbank ansäen — im Beet ist es noch zu kalt.',
          });
        });
      }

      // ── Harvest window ──────────────────────────────────────────────────
      if (weekday === 5) {
        plants.filter(p => p.harvestMonths.includes(month)).forEach(p => {
          push(out, {
            id: `auto:${bed.id}:harvest:${p.id}:${dateStr}`,
            kind: 'harvest', date: dateStr, bedId: bed.id, plantId: p.id, auto: true,
            title: `${p.de} ernten`,
            detail: 'Erntereife prüfen und im Ernteprotokoll eintragen.',
          });
        });
      }

      // ── Plant-specific chores ───────────────────────────────────────────
      plants.forEach(p => {
        (CARE_RULES[p.id] || []).forEach((rule, i) => {
          if (!rule.months.includes(month) || rule.weekday !== weekday) return;
          push(out, {
            id: `auto:${bed.id}:care:${p.id}:${i}:${dateStr}`,
            kind: 'care', date: dateStr, bedId: bed.id, plantId: p.id, auto: true,
            title: rule.title,
            detail: p.careNotes,
          });
        });
      });

      // ── Late-frost warning (Eisheilige, 11.–15. Mai) ────────────────────
      if (month === 4 && day.getDate() === 11) {
        const tender = plants.filter(p => !p.frostHardy).map(p => p.de);
        if (tender.length) {
          push(out, {
            id: `auto:${bed.id}:protect:${dateStr}`,
            kind: 'protect', date: dateStr, bedId: bed.id, auto: true,
            title: 'Eisheilige — Frostschutz bereitlegen',
            detail: `Bis zum 15. Mai kann es nochmal frieren. Empfindlich: ${tender.join(', ')}.`,
          });
        }
      }
    }
  }

  return out.sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind));
}

/**
 * "Was kann ich jetzt pflanzen?" — plants whose sowing window is open this
 * month, ranked so the easy and fast ones come first.
 */
export function sowableNow(month = new Date().getMonth()) {
  return PLANTS
    .filter(p => p.sowMonths.includes(month))
    .sort((a, b) => a.difficulty - b.difficulty || a.harvestWeeks - b.harvestWeeks);
}
