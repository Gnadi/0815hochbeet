import { useCallback, useMemo, useRef, useState } from 'react';
import { PLANTS, SNAP_CM, pairScore, plantById } from '../data/plants';

const SEASON_IDS = ['spring', 'summer', 'autumn', 'winter'];
const emptySeasons = () => ({ spring:{}, summer:{}, autumn:{}, winter:{} });

const snap = (v) => Math.round(v / SNAP_CM) * SNAP_CM;
const clone = (o) => JSON.parse(JSON.stringify(o));

/** Neighbours count as touching within 1.5× the sum of their half-spacings. */
const NEIGHBOUR_FACTOR = 1.5;

/**
 * Everything that can happen to one bed's plantings.
 *
 * Coordinates are centimetres from the bed's top-left corner, so a bed can be
 * resized without the layout falling apart — plants are clamped back inside
 * the new outline instead of the whole plan being wiped, which is what the
 * previous shape-effect did.
 */
export function useBed({ bedId, width, depth, initialSeason = 'summer', initialSeasonCells }) {
  const bw = Number(width) > 0 ? Number(width) : 120;
  const bh = Number(depth) > 0 ? Number(depth) : 80;

  const [seasonCells, setSeasonCells] = useState(() => ({ ...emptySeasons(), ...(initialSeasonCells || {}) }));
  const [season, setSeason] = useState(initialSeason);
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const [selectedKey, setSelectedKey] = useState(null);

  const cells = seasonCells[season] || {};
  const cellsRef = useRef(cells);
  cellsRef.current = cells;

  const commit = useCallback((updater) => {
    setHistory(h => [...h.slice(-40), clone(seasonCells)]);
    setFuture([]);
    setSeasonCells(sc => {
      const nextSeasonCells = updater(sc[season] || {}, sc);
      return { ...sc, [season]: nextSeasonCells };
    });
  }, [season, seasonCells]);

  function undo() {
    if (!history.length) return;
    setFuture(f => [clone(seasonCells), ...f]);
    setSeasonCells(history[history.length - 1]);
    setHistory(h => h.slice(0, -1));
    setSelectedKey(null);
  }

  function redo() {
    if (!future.length) return;
    setHistory(h => [...h, clone(seasonCells)]);
    setSeasonCells(future[0]);
    setFuture(f => f.slice(1));
    setSelectedKey(null);
  }

  /** True when a circle of `plantId` at (x,y) clears every other circle. */
  const canPlace = useCallback((xCm, yCm, plantId, existing = cellsRef.current) => {
    const p = plantById(plantId);
    if (!p) return false;
    for (const item of Object.values(existing)) {
      if (!item || typeof item !== 'object') continue;
      const p2 = plantById(item.plantId);
      if (!p2) continue;
      if (Math.hypot(xCm - item.x, yCm - item.y) < (p.spacing_cm + p2.spacing_cm) / 2) return false;
    }
    return true;
  }, []);

  /** Key of an existing circle of the same kind that the point falls inside. */
  const hitSameKind = useCallback((xCm, yCm, plantId) => {
    const p = plantById(plantId);
    if (!p) return null;
    const found = Object.entries(cellsRef.current).find(([, item]) =>
      item && typeof item === 'object' && item.plantId === plantId &&
      Math.hypot(xCm - item.x, yCm - item.y) <= Math.max(p.spacing_cm / 2, 8),
    );
    return found?.[0] ?? null;
  }, []);

  /**
   * Places a plant. Returns 'placed' | 'stacked' | 'blocked' so the UI can tell
   * the gardener why nothing happened — the old version failed silently.
   */
  const place = useCallback((xCm, yCm, plantId) => {
    const p = plantById(plantId);
    if (!p) return 'blocked';
    const r = p.spacing_cm / 2;
    const cx = Math.max(r, Math.min(bw - r, snap(xCm)));
    const cy = Math.max(r, Math.min(bh - r, snap(yCm)));

    const stackKey = hitSameKind(cx, cy, plantId);
    if (stackKey) {
      commit(cur => ({ ...cur, [stackKey]: { ...cur[stackKey], count: (cur[stackKey].count || 1) + 1 } }));
      setSelectedKey(stackKey);
      return 'stacked';
    }

    if (!canPlace(cx, cy, plantId)) return 'blocked';
    const key = `${cx}_${cy}`;
    commit(cur => ({ ...cur, [key]: { plantId, x:cx, y:cy, count:1 } }));
    setSelectedKey(key);
    return 'placed';
  }, [bw, bh, commit, canPlace, hitSameKind]);

  /** Decrements the count, removing the circle when it hits zero. */
  const decrement = useCallback((key) => {
    const item = cellsRef.current[key];
    if (!item) return;
    if ((item.count || 1) > 1) {
      commit(cur => ({ ...cur, [key]: { ...cur[key], count: cur[key].count - 1 } }));
    } else {
      commit(cur => { const n = { ...cur }; delete n[key]; return n; });
      setSelectedKey(null);
    }
  }, [commit]);

  const increment = useCallback((key) => {
    if (!cellsRef.current[key]) return;
    commit(cur => ({ ...cur, [key]: { ...cur[key], count: (cur[key].count || 1) + 1 } }));
  }, [commit]);

  /** Removes the circle outright, whatever its count. */
  const removeCell = useCallback((key) => {
    const item = cellsRef.current[key];
    if (!item) return null;
    commit(cur => { const n = { ...cur }; delete n[key]; return n; });
    setSelectedKey(null);
    return item;
  }, [commit]);

  const move = useCallback((fromKey, toX, toY) => {
    const item = cellsRef.current[fromKey];
    if (!item || typeof item !== 'object') return false;
    const p = plantById(item.plantId);
    if (!p) return false;
    const r = p.spacing_cm / 2;
    const cx = Math.max(r, Math.min(bw - r, snap(toX)));
    const cy = Math.max(r, Math.min(bh - r, snap(toY)));
    const toKey = `${cx}_${cy}`;
    if (toKey === fromKey) return false;
    const without = Object.fromEntries(Object.entries(cellsRef.current).filter(([k]) => k !== fromKey));
    if (!canPlace(cx, cy, item.plantId, without)) return false;
    commit(() => ({ ...without, [toKey]: { ...item, x:cx, y:cy } }));
    setSelectedKey(toKey);
    return true;
  }, [bw, bh, commit, canPlace]);

  const clearSeason = useCallback(() => {
    commit(() => ({}));
    setSelectedKey(null);
  }, [commit]);

  /** Copies one season's layout onto another — the core of rotation planning. */
  const copySeason = useCallback((from, to) => {
    if (from === to) return;
    setHistory(h => [...h.slice(-40), clone(seasonCells)]);
    setFuture([]);
    setSeasonCells(sc => ({ ...sc, [to]: clone(sc[from] || {}) }));
  }, [seasonCells]);

  const loadSeasonCells = useCallback((sc) => {
    setSeasonCells({ ...emptySeasons(), ...(sc || {}) });
    setHistory([]); setFuture([]); setSelectedKey(null);
  }, []);

  /** Keeps every plant inside the outline after the bed was resized. */
  const clampToBed = useCallback(() => {
    setSeasonCells(sc => {
      let touched = false;
      const next = {};
      for (const s of SEASON_IDS) {
        const out = {};
        for (const item of Object.values(sc[s] || {})) {
          if (!item || typeof item !== 'object') continue;
          const p = plantById(item.plantId);
          if (!p) continue;
          const r = p.spacing_cm / 2;
          const cx = Math.max(r, Math.min(Math.max(r, bw - r), snap(item.x)));
          const cy = Math.max(r, Math.min(Math.max(r, bh - r), snap(item.y)));
          if (cx !== item.x || cy !== item.y) touched = true;
          out[`${cx}_${cy}`] = { ...item, x:cx, y:cy };
        }
        next[s] = out;
      }
      return touched ? next : sc;
    });
  }, [bw, bh]);

  // ── Derived analysis ─────────────────────────────────────────────────────
  const plantStatus = useMemo(() => {
    const out = {};
    const entries = Object.entries(cells).filter(([, v]) => v && typeof v === 'object');
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

  /** Swaps conflicting plants for the best-scoring compatible alternative. */
  const fixBed = useCallback(() => {
    const next = { ...cellsRef.current };
    let changed = true, guard = 0, swaps = 0;
    while (changed && guard++ < 40) {
      changed = false;
      Object.entries(next).forEach(([key, item]) => {
        if (!item || typeof item !== 'object') return;
        const p = plantById(item.plantId);
        if (!p) return;
        const nbrs = Object.entries(next)
          .filter(([k2, i2]) => {
            if (k2 === key || !i2 || typeof i2 !== 'object') return false;
            const p2 = plantById(i2.plantId);
            return p2 && Math.hypot(item.x - i2.x, item.y - i2.y) <= (p.spacing_cm + p2.spacing_cm) / 2 * NEIGHBOUR_FACTOR;
          })
          .map(([, i2]) => i2.plantId);
        if (!nbrs.some(np => pairScore(item.plantId, np) < 0)) return;
        const cand = PLANTS
          .filter(pl => pl.seasons.includes(season) && pl.spacing_cm <= p.spacing_cm * 1.2)
          .map(pl => ({ pl, score: nbrs.reduce((s, np) => s + pairScore(pl.id, np), 0), bad: nbrs.some(np => pairScore(pl.id, np) < 0) }))
          .filter(c => !c.bad)
          .sort((a, b) => b.score - a.score)[0];
        if (cand) { next[key] = { ...item, plantId: cand.pl.id }; changed = true; swaps++; }
      });
    }
    if (swaps) commit(() => next);
    return swaps;
  }, [season, commit]);

  const stats = useMemo(() => {
    const valid = Object.values(cells).filter(v => v && typeof v === 'object');
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

  /** Per-season summary for the year overview. */
  const seasonSummary = useMemo(() => Object.fromEntries(SEASON_IDS.map(s => {
    const vals = Object.values(seasonCells[s] || {}).filter(v => v && typeof v === 'object');
    return [s, {
      count: vals.reduce((n, v) => n + (v.count || 1), 0),
      kinds: [...new Set(vals.map(v => v.plantId))],
      yieldKg: vals.reduce((n, v) => n + (plantById(v.plantId)?.yield || 0) * (v.count || 1), 0),
    }];
  })), [seasonCells]);

  return {
    bedWidth: bw, bedDepth: bh,
    cells, seasonCells, season, setSeason, loadSeasonCells,
    place, decrement, increment, removeCell, move, clearSeason, copySeason, clampToBed,
    canPlace, plantStatus, issues, wins, fixBed, stats, seasonSummary,
    selectedKey, setSelectedKey,
    undo, redo, canUndo: history.length > 0, canRedo: future.length > 0,
  };
}
