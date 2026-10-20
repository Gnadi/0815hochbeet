// The bed's timeline.
//
// A bed used to hold four fixed season layouts. Real raised-bed practice is a
// sequence instead — Spinat bis Mai, dann Paradeiser, dann Vogerlsalat — so
// every planting now carries the dates it occupies its spot:
//
//   { id, plantId, x, y, count, start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }
//
// The canvas shows what stands in the bed on one day of the chosen month, and
// two plantings only collide when they overlap in space *and* in time. Years
// fall out of the dates, which is what makes multi-year rotation possible.
//
// Everything here is pure so it can be tested without a browser.

import { plantById, SNAP_CM } from '../data/plants.js';

const DAY = 86400000;

/** Local calendar date as YYYY-MM-DD (not UTC — toISOString is off by a day at night). */
export function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function parseDate(str) {
  const [y, m, d] = String(str).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(str, days) {
  const d = parseDate(str);
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

export function daysBetween(a, b) {
  return Math.round((parseDate(b) - parseDate(a)) / DAY);
}

export const monthStart = (year, month) => toDateStr(new Date(year, month, 1));
export const monthEnd = (year, month) => toDateStr(new Date(year, month + 1, 0));

/** The day the canvas shows for a month: the middle, so early and late sowings both count. */
export const viewDate = (year, month) => toDateStr(new Date(year, month, 15));

/** Meteorological season of a month — the plant data still describes suitability by season. */
export function seasonOfMonth(month) {
  if (month <= 1 || month === 11) return 'winter';
  if (month <= 4) return 'spring';
  if (month <= 7) return 'summer';
  return 'autumn';
}

export const isActive = (p, dateStr) => p.start <= dateStr && dateStr <= p.end;
export const timeOverlap = (a, b) => a.start <= b.end && b.start <= a.end;

export function spaceOverlap(a, b) {
  const pa = plantById(a.plantId), pb = plantById(b.plantId);
  if (!pa || !pb) return false;
  return Math.hypot(a.x - b.x, a.y - b.y) < (pa.spacing_cm + pb.spacing_cm) / 2;
}

/** Plantings standing in the bed on `dateStr`, keyed by id (the canvas' `cells`). */
export function activeAt(plantings, dateStr) {
  const out = {};
  for (const [id, p] of Object.entries(plantings || {})) {
    if (p && isActive(p, dateStr)) out[id] = p;
  }
  return out;
}

/** Plantings that touch the calendar year at all. */
export function inYear(plantings, year) {
  const a = `${year}-01-01`, b = `${year}-12-31`;
  return Object.values(plantings || {}).filter(p => p && p.start <= b && p.end >= a);
}

/** Calendar year a planting counts towards for rotation: the year it was in the ground longest. */
export function mainYear(p) {
  const y0 = Number(p.start.slice(0, 4));
  const y1 = Number(p.end.slice(0, 4));
  if (y0 === y1) return y0;
  const firstPart = daysBetween(p.start, `${y0}-12-31`);
  const lastPart = daysBetween(`${y1}-01-01`, p.end);
  return lastPart > firstPart ? y1 : y0;
}

/**
 * Default dates when a plant goes in during `month` of `year`: from the first
 * of the month until maturity plus the plant's harvest span. Perennials stay
 * for several years; pure flowers bloom until the first frosts.
 */
export function defaultRange(plant, year, month) {
  const start = monthStart(year, month);
  if (plant.perennial) return { start, end: `${year + 3}-12-31` };
  const weeks = plant.harvestWeeks > 0
    ? plant.harvestWeeks + (plant.harvestSpanWeeks ?? 3)
    : 20;
  return { start, end: addDays(start, Math.max(14, weeks * 7)) };
}

export function formatRange(p) {
  const fmt = new Intl.DateTimeFormat('de-AT', { day: 'numeric', month: 'short' });
  const fmtY = new Intl.DateTimeFormat('de-AT', { day: 'numeric', month: 'short', year: 'numeric' });
  const a = parseDate(p.start), b = parseDate(p.end);
  return a.getFullYear() === b.getFullYear()
    ? `${fmt.format(a)} – ${fmt.format(b)}`
    : `${fmtY.format(a)} – ${fmtY.format(b)}`;
}

/** Plantings that would share space with `candidate` while it is in the ground. */
export function blockersFor(plantings, candidate, ignoreId) {
  return Object.entries(plantings || {})
    .filter(([id, p]) => id !== ignoreId && p && timeOverlap(p, candidate) && spaceOverlap(p, candidate))
    .map(([id, p]) => ({ id, ...p }));
}

/**
 * Fits a new planting around its neighbours in time. Anything at the spot that
 * already ended before `onDate` becomes its Vorkultur (we start the day after),
 * anything starting later becomes its Nachkultur (we end the day before). A
 * neighbour standing there on `onDate` itself is a real collision.
 *
 * Returns the adjusted candidate, or `{ blocked, blockers }`.
 */
export function fitInTime(plantings, candidate, onDate, ignoreId, minDays = 14) {
  const blockers = blockersFor(plantings, candidate, ignoreId);
  if (!blockers.length) return { planting: candidate };
  if (blockers.some(b => isActive(b, onDate))) return { blocked: true, blockers };

  let { start, end } = candidate;
  for (const b of blockers) {
    if (b.end < onDate) start = start > addDays(b.end, 1) ? start : addDays(b.end, 1);
    else if (b.start > onDate) end = end < addDays(b.start, -1) ? end : addDays(b.start, -1);
  }
  if (start > onDate || end < onDate || daysBetween(start, end) < minDays) return { blocked: true, blockers };
  return { planting: { ...candidate, start, end }, adjusted: true };
}

/**
 * Converts the old four-season layout into dated plantings for `year`. Each
 * season starts in its first month — or the plant's own sowing month when one
 * lies within two months of it, so Paradeiser in "Sommer" go in in May. Where
 * an earlier season's plant sits on the spot of a later one, it ends the day
 * before the later one starts (it was the Vorkultur).
 */
const SEASON_START = { spring: 2, summer: 5, autumn: 8, winter: 11 };

export function migrateSeasonCells(seasonCells, year, genId) {
  const list = [];
  for (const season of ['spring', 'summer', 'autumn', 'winter']) {
    const s0 = SEASON_START[season];
    for (const item of Object.values(seasonCells?.[season] || {})) {
      if (!item || typeof item !== 'object') continue;
      const plant = plantById(item.plantId);
      if (!plant) continue;
      const near = plant.sowMonths
        .filter(m => Math.abs(m - s0) <= 2)
        .sort((a, b) => Math.abs(a - s0) - Math.abs(b - s0) || a - b)[0];
      const range = defaultRange(plant, year, near ?? s0);
      list.push({ id: genId(), plantId: item.plantId, x: item.x, y: item.y, count: item.count || 1, ...range });
    }
  }
  list.sort((a, b) => a.start.localeCompare(b.start));
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      if (a.start < b.start && timeOverlap(a, b) && spaceOverlap(a, b)) {
        a.end = addDays(b.start, -1);
      }
    }
  }
  return Object.fromEntries(list.filter(p => p.end >= p.start).map(p => [p.id, p]));
}

/**
 * Keeps every planting inside the outline after a resize. Plants that land on
 * the same spot are nudged along the grid instead of overwriting each other.
 */
export function clampPlantings(plantings, width, depth) {
  const snap = v => Math.round(v / SNAP_CM) * SNAP_CM;
  const out = {};
  let touched = false;
  for (const [id, p] of Object.entries(plantings || {})) {
    const plant = plantById(p.plantId);
    if (!plant) { out[id] = p; continue; }
    const r = plant.spacing_cm / 2;
    const clampX = v => Math.max(r, Math.min(Math.max(r, width - r), v));
    const clampY = v => Math.max(r, Math.min(Math.max(r, depth - r), v));
    let x = clampX(p.x), y = clampY(p.y);
    if (x !== p.x || y !== p.y) {
      x = clampX(snap(x)); y = clampY(snap(y));
      // Same-time neighbours already placed at this exact point → step aside.
      const taken = (cx, cy) => Object.values(out).some(o => o.x === cx && o.y === cy && timeOverlap(o, p));
      for (let step = 1; taken(x, y) && step < 40; step++) {
        const dx = (step % 2 ? 1 : -1) * Math.ceil(step / 2) * SNAP_CM;
        x = clampX(snap(x + dx));
        if (taken(x, y)) y = clampY(snap(y + dx));
      }
      touched = true;
    }
    out[id] = x === p.x && y === p.y ? p : { ...p, x, y };
  }
  return touched ? out : plantings;
}

/**
 * Adds `added` plantings to a bed, replacing whatever stands there on
 * `onDate`. Earlier plantings on the same spot end the day before a new one
 * starts; later ones cut the new one short. Used when a generated plan is
 * applied to an existing bed.
 */
export function mergePlantings(existing, added, onDate) {
  const out = Object.fromEntries(Object.entries(existing || {}).filter(([, p]) => !isActive(p, onDate)));
  for (const n of added) {
    let planting = { ...n };
    for (const [id, p] of Object.entries(out)) {
      if (!timeOverlap(p, planting) || !spaceOverlap(p, planting)) continue;
      if (p.start < planting.start) {
        const end = addDays(planting.start, -1);
        if (end < p.start) delete out[id]; else out[id] = { ...p, end };
      } else {
        planting = { ...planting, end: addDays(p.start, -1) };
      }
    }
    if (planting.end >= planting.start) out[planting.id] = planting;
  }
  return out;
}
