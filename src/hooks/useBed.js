import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PLANTS, SNAP_CM, pairScore, plantById } from '../data/plants';
import { genId } from '../lib/beds';
import {
  activeAt, blockersFor, clampPlantings, daysBetween, defaultRange,
  fitInTime, inYear, monthEnd, monthStart, seasonOfMonth, viewDate,
} from '../lib/timeline';

const snap = (v) => Math.round(v / SNAP_CM) * SNAP_CM;

/** Neighbours count as touching within 1.5× the sum of their half-spacings. */
const NEIGHBOUR_FACTOR = 1.5;

/**
 * Everything that can happen to one bed's plantings.
 *
 * The bed holds dated plantings (see lib/timeline.js). The planner looks at
 * one month of one year at a time: `cells` are the plantings standing in the
 * bed in the middle of that month, keyed by planting id. Placing a plant
 * gives it default dates from the plant data and fits it around whatever
 * grew there before or comes after (Vor- und Nachkultur).
 *
 * Coordinates are centimetres from the bed's top-left corner, so a bed can be
 * resized without the layout falling apart.
 */
export function useBed({ width, depth, initialPlantings, initialView }) {
  const bw = Number(width) > 0 ? Number(width) : 120;
  const bh = Number(depth) > 0 ? Number(depth) : 80;

  const [plantings, setPlantings] = useState(() => initialPlantings || {});
  const [view, setViewState] = useState(() => initialView || { year: new Date().getFullYear(), month: new Date().getMonth() });
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const [selectedKey, setSelectedKey] = useState(null);

  const onDate = viewDate(view.year, view.month);
  const cells = useMemo(() => activeAt(plantings, onDate), [plantings, onDate]);
  const plantingsRef = useRef(plantings);
  plantingsRef.current = plantings;

  const setView = useCallback((v) => { setViewState(v); setSelectedKey(null); }, []);

  /** Applies a change to all plantings and records it for undo. */
  const commit = useCallback((updater) => {
    const prev = plantingsRef.current;
    const next = updater(prev);
    if (next === prev) return;
    plantingsRef.current = next;
    setHistory(h => [...h.slice(-40), prev]);
    setFuture([]);
    setPlantings(next);
  }, []);

  function undo() {
    if (!history.length) return;
    setFuture(f => [plantingsRef.current, ...f]);
    setPlantings(history[history.length - 1]);
    setHistory(h => h.slice(0, -1));
    setSelectedKey(null);
  }

  function redo() {
    if (!future.length) return;
    setHistory(h => [...h, plantingsRef.current]);
    setPlantings(future[0]);
    setFuture(f => f.slice(1));
    setSelectedKey(null);
  }

  // A resized bed pulls every planting back inside the new outline. This runs
  // on the new dimensions — calling it from the settings handler used the
  // previous render's width and depth and did nothing.
  useEffect(() => {
    const next = clampPlantings(plantingsRef.current, bw, bh);
    if (next !== plantingsRef.current) {
      plantingsRef.current = next;
      setPlantings(next);
    }
  }, [bw, bh]);

  const clampPoint = (plant, x, y) => {
    const r = plant.spacing_cm / 2;
    return {
      x: Math.max(r, Math.min(Math.max(r, bw - r), snap(x))),
      y: Math.max(r, Math.min(Math.max(r, bh - r), snap(y))),
    };
  };

  /** True when a circle of `plantId` at (x,y) clears everything standing on the view date. */
  const canPlace = useCallback((xCm, yCm, plantId, ignoreKey) => {
    const p = plantById(plantId);
    if (!p) return false;
    const probe = { plantId, x: xCm, y: yCm, start: onDate, end: onDate };
    return blockersFor(plantingsRef.current, probe, ignoreKey).length === 0;
  }, [onDate]);

  /** Key of a visible circle of the same kind that the point falls inside. */
  const hitSameKind = useCallback((xCm, yCm, plantId) => {
    const p = plantById(plantId);
    if (!p) return null;
    const found = Object.entries(cells).find(([, item]) =>
      item.plantId === plantId &&
      Math.hypot(xCm - item.x, yCm - item.y) <= Math.max(p.spacing_cm / 2, 8),
    );
    return found?.[0] ?? null;
  }, [cells]);

  /**
   * Places a plant in the viewed month. Returns
   * `{ status: 'placed' | 'stacked' | 'blocked', planting?, adjusted? }` so the
   * UI can say what happened — including when the dates were shortened to
   * make room for a Vor- or Nachkultur.
   */
  const place = useCallback((xCm, yCm, plantId) => {
    const plant = plantById(plantId);
    if (!plant) return { status: 'blocked' };
    const { x, y } = clampPoint(plant, xCm, yCm);

    const stackKey = hitSameKind(x, y, plantId);
    if (stackKey) {
      commit(cur => ({ ...cur, [stackKey]: { ...cur[stackKey], count: (cur[stackKey].count || 1) + 1 } }));
      setSelectedKey(stackKey);
      return { status: 'stacked' };
    }

    const range = defaultRange(plant, view.year, view.month);
    const id = genId();
    const fit = fitInTime(plantingsRef.current, { id, plantId, x, y, count: 1, ...range }, onDate);
    if (fit.blocked) return { status: 'blocked', blockers: fit.blockers };
    commit(cur => ({ ...cur, [id]: fit.planting }));
    setSelectedKey(id);
    return { status: 'placed', planting: fit.planting, adjusted: !!fit.adjusted };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bw, bh, view, onDate, commit, hitSameKind]);

  /** Decrements the count, removing the planting when it hits zero. */
  const decrement = useCallback((key) => {
    const item = plantingsRef.current[key];
    if (!item) return;
    if ((item.count || 1) > 1) {
      commit(cur => ({ ...cur, [key]: { ...cur[key], count: cur[key].count - 1 } }));
    } else {
      commit(cur => { const n = { ...cur }; delete n[key]; return n; });
      setSelectedKey(null);
    }
  }, [commit]);

  const increment = useCallback((key) => {
    if (!plantingsRef.current[key]) return;
    commit(cur => ({ ...cur, [key]: { ...cur[key], count: (cur[key].count || 1) + 1 } }));
  }, [commit]);

  /** Removes the planting outright, whatever its count. */
  const removeCell = useCallback((key) => {
    const item = plantingsRef.current[key];
    if (!item) return null;
    commit(cur => { const n = { ...cur }; delete n[key]; return n; });
    setSelectedKey(null);
    return item;
  }, [commit]);

  /** Moves a planting; it must stay clear of everything during its whole time in the bed. */
  const move = useCallback((key, toX, toY) => {
    const item = plantingsRef.current[key];
    const plant = item && plantById(item.plantId);
    if (!plant) return false;
    const { x, y } = clampPoint(plant, toX, toY);
    if (x === item.x && y === item.y) return false;
    if (blockersFor(plantingsRef.current, { ...item, x, y }, key).length) return false;
    commit(cur => ({ ...cur, [key]: { ...cur[key], x, y } }));
    setSelectedKey(key);
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bw, bh, commit]);

  /**
   * Changes when a planting is in the bed. Returns `{ ok }` or `{ ok:false,
   * reason, blockers }` — the dates may not overlap a neighbour on the spot.
   */
  const setRange = useCallback((key, start, end) => {
    const item = plantingsRef.current[key];
    if (!item) return { ok: false, reason: 'missing' };
    if (!start || !end || end < start) return { ok: false, reason: 'order' };
    const blockers = blockersFor(plantingsRef.current, { ...item, start, end }, key);
    if (blockers.length) return { ok: false, reason: 'overlap', blockers };
    commit(cur => ({ ...cur, [key]: { ...cur[key], start, end } }));
    return { ok: true };
  }, [commit]);

  /** Removes everything standing in the bed in the viewed month. */
  const clearView = useCallback(() => {
    const keys = Object.keys(cells);
    if (!keys.length) return 0;
    commit(cur => Object.fromEntries(Object.entries(cur).filter(([k]) => !keys.includes(k))));
    setSelectedKey(null);
    return keys.length;
  }, [cells, commit]);

  /** Replaces the plantings with a whole new set (generator, undo from outside). */
  const loadPlantings = useCallback((next) => {
    plantingsRef.current = next || {};
    setPlantings(next || {});
    setHistory([]); setFuture([]); setSelectedKey(null);
  }, []);

  // ── Derived analysis (for what stands in the bed on the view date) ─────────
  const plantStatus = useMemo(() => {
    const out = {};
    const entries = Object.entries(cells);
    entries.forEach(([key, { plantId, x, y }]) => {
      const p = plantById(plantId);
      if (!p) return;
      let bad = 0, good = 0;
      const neighbors = [];
      entries.forEach(([key2, { plantId: pid2, x: x2, y: y2 }]) => {
        if (key === key2) return;
        const p2 = plantById(pid2);
        if (!p2) return;
        const touch = (p.spacing_cm + p2.spacing_cm) / 2 * NEIGHBOUR_FACTOR;
        if (Math.hypot(x - x2, y - y2) > touch) return;
        const s = pairScore(plantId, pid2);
        if (s < 0) { bad++; neighbors.push({ key:key2, plantId:pid2, score:s }); }
        else if (s > 0) { good++; neighbors.push({ key:key2, plantId:pid2, score:s }); }
      });
      out[key] = { bad, good, neighbors, status: bad ? 'bad' : good ? 'good' : 'neutral' };
    });
    return out;
  }, [cells]);

  const { issues, wins } = useMemo(() => {
    const seenBad = new Set(), seenGood = new Set();
    const issues = [], wins = [];
    Object.entries(plantStatus).forEach(([key, info]) => {
      info.neighbors.forEach(n => {
        const sig = [key, n.key].sort().join('|');
        const pidA = cells[key]?.plantId;
        if (!pidA) return;
        if (n.score < 0 && !seenBad.has(sig)) {
          seenBad.add(sig);
          issues.push({ type:'bad', a:plantById(pidA), b:plantById(n.plantId), key, nKey:n.key });
        } else if (n.score > 0 && !seenGood.has(sig)) {
          seenGood.add(sig);
          wins.push({ type:'good', a:plantById(pidA), b:plantById(n.plantId), key, nKey:n.key });
        }
      });
    });
    return { issues, wins };
  }, [plantStatus, cells]);

  /**
   * Swaps conflicting plants for the best-scoring compatible alternative that
   * fits the same spot — never a larger plant, which used to produce
   * overlapping circles.
   */
  const fixBed = useCallback(() => {
    const next = { ...plantingsRef.current };
    const season = seasonOfMonth(view.month);
    let changed = true, guard = 0, swaps = 0;
    while (changed && guard++ < 40) {
      changed = false;
      for (const key of Object.keys(cells)) {
        const item = next[key];
        const p = item && plantById(item.plantId);
        if (!p) continue;
        const nbrs = Object.entries(next)
          .filter(([k2, i2]) => {
            if (k2 === key || !(i2.start <= onDate && onDate <= i2.end)) return false;
            const p2 = plantById(i2.plantId);
            return p2 && Math.hypot(item.x - i2.x, item.y - i2.y) <= (p.spacing_cm + p2.spacing_cm) / 2 * NEIGHBOUR_FACTOR;
          })
          .map(([, i2]) => i2.plantId);
        if (!nbrs.some(np => pairScore(item.plantId, np) < 0)) continue;
        const cand = PLANTS
          .filter(pl => pl.id !== item.plantId && pl.seasons.includes(season) && pl.spacing_cm <= p.spacing_cm)
          .map(pl => ({ pl, score: nbrs.reduce((s, np) => s + pairScore(pl.id, np), 0), bad: nbrs.some(np => pairScore(pl.id, np) < 0) }))
          .filter(c => !c.bad && !blockersFor(next, { ...item, plantId: c.pl.id }, key).length)
          .sort((a, b) => b.score - a.score)[0];
        if (cand) { next[key] = { ...item, plantId: cand.pl.id }; changed = true; swaps++; }
      }
    }
    if (swaps) commit(() => next);
    return swaps;
  }, [cells, view.month, onDate, commit]);

  const stats = useMemo(() => {
    const valid = Object.values(cells);
    const placed = valid.reduce((s, { count = 1 }) => s + count, 0);
    const yieldKg = valid.reduce((s, { plantId, count = 1 }) => s + (plantById(plantId)?.yield || 0) * count, 0);
    // Coverage = footprint of every circle against the bed area, capped at 100.
    const areaCm = valid.reduce((s, { plantId, count = 1 }) => {
      const p = plantById(plantId);
      return p ? s + Math.PI * (p.spacing_cm / 2) ** 2 * count : s;
    }, 0);
    const coverage = Math.min(100, Math.round((areaCm / (bw * bh)) * 100));
    const kinds = new Set(valid.map(v => v.plantId)).size;
    return { placed, yieldKg, coverage, kinds };
  }, [cells, bw, bh]);

  /** Plants standing per month of the viewed year — drives the month rail. */
  const monthCounts = useMemo(() => Array.from({ length: 12 }, (_, m) => {
    const d = viewDate(view.year, m);
    return Object.values(plantings).reduce((n, p) => n + (p.start <= d && d <= p.end ? (p.count || 1) : 0), 0);
  }), [plantings, view.year]);

  /** Every planting touching the viewed year, in planting order (the timeline). */
  const yearPlantings = useMemo(
    () => inYear(plantings, view.year).sort((a, b) => a.start.localeCompare(b.start) || a.y - b.y),
    [plantings, view.year],
  );

  /** What comes before and after on the spots of the visible plants. */
  const neighboursInTime = useMemo(() => {
    const from = monthStart(view.year, view.month), to = monthEnd(view.year, view.month);
    const ended = [], upcoming = [];
    for (const p of Object.values(plantings)) {
      if (p.start <= onDate && onDate <= p.end) continue;
      if (p.end < onDate && daysBetween(p.end, from) <= 60) ended.push(p);
      else if (p.start > onDate && daysBetween(to, p.start) <= 60) upcoming.push(p);
    }
    return { ended, upcoming };
  }, [plantings, onDate, view]);

  return {
    bedWidth: bw, bedDepth: bh,
    plantings, cells, view, setView, onDate, loadPlantings,
    place, decrement, increment, removeCell, move, setRange, clearView,
    canPlace, plantStatus, issues, wins, fixBed, stats, monthCounts, yearPlantings, neighboursInTime,
    selectedKey, setSelectedKey,
    undo, redo, canUndo: history.length > 0, canRedo: future.length > 0,
  };
}

