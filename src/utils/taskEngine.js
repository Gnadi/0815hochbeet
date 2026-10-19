// Turns what is actually planted into a concrete to-do list.
//
// Everything is derived from the bed's dated plantings, the calendar and —
// when available — the weather, so the list is real work:
//
// - Vorziehen six weeks before a planting starts, säen/pflanzen on its start
//   date, Erntereife from maturity until it ends. (The season-based version
//   only looked at the season the day fell in, so a Paradeiser in the summer
//   layout never got its February "vorziehen" or its Eisheiligen warning.)
// - Gießen on fixed weekdays while something stands in the bed — skipped when
//   it rained, added on hot days.
// - Auffüllen once the bed is past its third year.

import { plantById, PLANTS } from '../data/plants.js';
import { addDays, isActive, parseDate, seasonOfMonth, toDateStr } from '../lib/timeline.js';
import { ageAdvice, bedAge } from './bedAge.js';

export { toDateStr };

const DAY = 86400000;

/** Recurring, plant-specific chores that only make sense in certain months. */
const CARE_RULES = {
  tomato:     [{ months:[5,6,7,8],   weekday:2, title:'Paradeiser ausgeizen' }],
  potato:     [{ months:[4,5],       weekday:6, title:'Kartoffeln anhäufeln' }],
  leek:       [{ months:[6,7,8],     weekday:6, title:'Lauch anhäufeln (weiße Schäfte)' }],
  strawberry: [{ months:[5,6,7],     weekday:6, title:'Erdbeer-Ausläufer entfernen' }],
  basil:      [{ months:[5,6,7],     weekday:4, title:'Basilikum-Blüten ausknipsen' }],
  zucchini:   [{ months:[5,6,7,8],   weekday:5, title:'Zucchini jung ernten' }],
  cucumber:   [{ months:[5,6,7],     weekday:3, title:'Gurken aufbinden & ausgeizen' }],
  marigold:   [{ months:[5,6,7,8],   weekday:6, title:'Verblühte Tagetes abschneiden' }],
  calendula:  [{ months:[5,6,7,8],   weekday:6, title:'Verblühte Ringelblumen abschneiden' }],
  pepper:     [{ months:[6,7,8],     weekday:2, title:'Paprika abstützen' }],
  eggplant:   [{ months:[6,7,8],     weekday:2, title:'Melanzani abstützen, Früchte begrenzen' }],
  dill:       [{ months:[4,5,6],     weekday:5, title:'Dill nachsäen für Nachschub' }],
  cabbage:    [{ months:[4,5,6,7,8], weekday:3, title:'Kohl: Netz und Blattunterseiten auf Eier prüfen' }],
  kale:       [{ months:[6,7,8],     weekday:3, title:'Grünkohl: auf Kohlweißling-Raupen prüfen' }],
  brussels:   [{ months:[6,7,8],     weekday:3, title:'Kohlsprossen: auf Raupen prüfen' }, { months:[8], weekday:6, title:'Kohlsprossen: Triebspitze kappen' }],
  broccoli:   [{ months:[4,5,6,7,8], weekday:3, title:'Brokkoli: auf Raupen prüfen' }],
  cauliflower:[{ months:[5,6,7,8],   weekday:4, title:'Karfiol-Rose mit Blättern abdecken' }],
  pumpkin:    [{ months:[6,7],       weekday:6, title:'Kürbis-Ranken lenken, Früchte unterlegen' }],
  polebean:   [{ months:[5,6],       weekday:6, title:'Stangenbohnen an die Stangen leiten' }],
  celeriac:   [{ months:[6,7],       weekday:6, title:'Sellerie: Seitenwurzeln freilegen' }],
};

/** Watering weekdays (0 = Sunday) by thirst level and season. */
const WATER_DAYS = {
  summer: { high:[1,3,5,0], med:[1,4], low:[6] },
  spring: { high:[1,4],     med:[2],   low:[] },
  autumn: { high:[1,4],     med:[5],   low:[] },
  winter: { high:[],        med:[],    low:[] },
};

/** Rain (mm) over the day and the day before that makes watering unnecessary. */
export const RAIN_SKIP_MM = 5;
/** Daily maximum (°C) that adds an extra watering. */
export const HEAT_C = 30;

export const TASK_KINDS = {
  water:      { de:'Gießen',     icon:'💧', color:'var(--green)' },
  sow:        { de:'Aussaat',    icon:'✦',  color:'var(--terra)' },
  preculture: { de:'Vorziehen',  icon:'🪴', color:'var(--ochre)' },
  harvest:    { de:'Ernte',      icon:'🧺', color:'var(--good)' },
  care:       { de:'Pflege',     icon:'✂',  color:'var(--ink-dim)' },
  protect:    { de:'Schutz',     icon:'❄',  color:'var(--warn)' },
};

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

/** Rain on `dateStr` plus the day before, or null when the weather does not cover it. */
export function recentRain(weather, dateStr) {
  const today = weather?.daily?.[dateStr];
  if (!today) return null;
  const before = weather.daily[addDays(dateStr, -1)];
  return (today.rain || 0) + (before?.rain || 0);
}

const fmtDay = new Intl.DateTimeFormat('de-AT', { day:'numeric', month:'long' });

function push(out, task) {
  if (!out.some(t => t.id === task.id)) out.push(task);
}

/**
 * Builds every auto-task for the days between `from` and `to` (inclusive).
 * Ids are deterministic so a completed task stays completed across reloads.
 */
export function generateTasks(beds, from, to, { weather } = {}) {
  const out = [];
  if (!beds?.length) return out;
  const fromStr = toDateStr(from), toStr = toDateStr(to);
  const inRange = d => d >= fromStr && d <= toStr;

  for (const bed of beds) {
    const plantings = Object.entries(bed.plantings || {})
      .map(([id, p]) => ({ ...p, id, plant: plantById(p.plantId) }))
      .filter(p => p.plant);

    // ── One-off events per planting ──────────────────────────────────────
    for (const p of plantings) {
      const { plant } = p;
      if (plant.precultureMonths.length && !plant.perennial) {
        // Saturday on or before six weeks ahead of planting out.
        const d = parseDate(addDays(p.start, -42));
        d.setDate(d.getDate() - ((d.getDay() + 1) % 7));
        const date = toDateStr(d);
        if (inRange(date)) push(out, {
          id: `auto:${bed.id}:preculture:${p.id}`, kind: 'preculture', date, bedId: bed.id, plantId: plant.id, auto: true,
          title: `${plant.de} vorziehen`,
          detail: `Auf der Fensterbank ansäen — ausgepflanzt wird am ${fmtDay.format(parseDate(p.start))} in „${bed.name}".`,
        });
      }

      if (inRange(p.start)) {
        const early = !plant.frostHardy && p.start.slice(5) < '05-15' && p.start.slice(5) >= '03-01';
        push(out, {
          id: `auto:${bed.id}:sow:${p.id}`, kind: 'sow', date: p.start, bedId: bed.id, plantId: plant.id, auto: true,
          title: `${plant.de} ${plant.precultureMonths.length ? 'auspflanzen' : 'säen/pflanzen'}`,
          detail: [
            `${plant.sowDepth > 0 ? `${plant.sowDepth} cm tief, ` : ''}${plant.spacing_cm} cm Abstand.`,
            plant.harvestWeeks > 0 ? `Erntereif in ca. ${plant.harvestWeeks} Wochen.` : '',
            early ? 'Vor den Eisheiligen: nur mit Vlies oder Frühbeetaufsatz.' : '',
          ].filter(Boolean).join(' '),
        });
      }
    }

    // ── Befüllungsjahr: top up once the bed is spent ─────────────────────
    for (let y = from.getFullYear(); y <= to.getFullYear(); y++) {
      const advice = ageAdvice(bedAge(bed, y));
      const date = `${y}-03-15`;
      if (advice?.refill && inRange(date)) push(out, {
        id: `auto:${bed.id}:refill:${y}`, kind: 'care', date, bedId: bed.id, auto: true,
        title: `${bed.name} auffüllen`,
        detail: `${advice.age}. Jahr nach dem Befüllen: obere 20–30 cm mit reifem Kompost erneuern und das Befüllungsjahr im Beet auf ${y} setzen.`,
      });
    }

    // ── Day by day ───────────────────────────────────────────────────────
    for (let ts = new Date(from).setHours(0, 0, 0, 0); ts <= to.getTime(); ts += DAY) {
      const day = new Date(ts);
      const dateStr = toDateStr(day);
      const month = day.getMonth();
      const weekday = day.getDay();
      const active = plantings.filter(p => isActive(p, dateStr));
      if (!active.length) continue;
      const plants = [...new Map(active.map(p => [p.plant.id, p.plant])).values()];

      // Watering — weather decides whether the schedule holds.
      const thirst = plants.some(p => p.water === 'high') ? 'high'
        : plants.some(p => p.water === 'med') ? 'med' : 'low';
      const scheduled = WATER_DAYS[seasonOfMonth(month)][thirst].includes(weekday);
      const rain = recentRain(weather, dateStr);
      const hot = (weather?.daily?.[dateStr]?.tMax ?? -99) >= HEAT_C && thirst !== 'low';
      if ((scheduled || hot) && !(rain !== null && rain >= RAIN_SKIP_MM)) {
        const thirstiest = plants.filter(p => p.water === thirst).slice(0, 3).map(p => p.de).join(', ');
        const notes = [];
        if (hot) notes.push(`Hitzetag (${Math.round(weather.daily[dateStr].tMax)} °C): morgens oder abends gründlich gießen.`);
        else if (thirst === 'high') notes.push(`Durstig: ${thirstiest}. Morgens und bodennah wässern.`);
        else notes.push('Erde 3 cm tief prüfen — nur gießen wenn trocken.');
        if (rain !== null && rain > 0) notes.push(`Nur ${rain.toFixed(1)} mm Regen — reicht nicht.`);
        push(out, {
          id: `auto:${bed.id}:water:${dateStr}`, kind: 'water', date: dateStr, bedId: bed.id, auto: true,
          title: `${bed.name} gießen`, detail: notes.join(' '),
        });
      }

      // Harvest — weekly from maturity until the planting ends.
      if (weekday === 5) {
        for (const p of active) {
          if (!(p.plant.harvestWeeks > 0) || !(p.plant.yield > 0)) continue;
          if (dateStr < addDays(p.start, p.plant.harvestWeeks * 7)) continue;
          push(out, {
            id: `auto:${bed.id}:harvest:${p.plant.id}:${dateStr}`, kind: 'harvest', date: dateStr, bedId: bed.id, plantId: p.plant.id, auto: true,
            title: `${p.plant.de} ernten`,
            detail: 'Erntereife prüfen und im Ernteprotokoll eintragen.',
          });
        }
      }

      // Plant-specific chores.
      for (const plant of plants) {
        (CARE_RULES[plant.id] || []).forEach((rule, i) => {
          if (!rule.months.includes(month) || rule.weekday !== weekday) return;
          push(out, {
            id: `auto:${bed.id}:care:${plant.id}:${i}:${dateStr}`, kind: 'care', date: dateStr, bedId: bed.id, plantId: plant.id, auto: true,
            title: rule.title, detail: plant.careNotes,
          });
        });
      }

      // Eisheilige (11.–15. Mai): tender plants in the bed during those days.
      if (month === 4 && day.getDate() === 11) {
        const y = day.getFullYear();
        const tender = [...new Set(plantings
          .filter(p => !p.plant.frostHardy && p.start <= `${y}-05-15` && p.end >= `${y}-05-11`)
          .map(p => p.plant.de))];
        if (tender.length) push(out, {
          id: `auto:${bed.id}:protect:${dateStr}`, kind: 'protect', date: dateStr, bedId: bed.id, auto: true,
          title: 'Eisheilige — Frostschutz bereitlegen',
          detail: `Bis zum 15. Mai kann es nochmal frieren. Empfindlich: ${tender.join(', ')}.`,
        });
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
