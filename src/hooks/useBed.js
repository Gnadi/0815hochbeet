import { useState, useMemo, useEffect } from 'react';
import { PLANTS, SHAPES, SNAP_CM, pairScore, plantById, defaultFreeformMask } from '../data/plants';

const EMPTY_SC = { spring:{}, summer:{}, autumn:{}, winter:{} };

function snap(v) { return Math.round(v / SNAP_CM) * SNAP_CM; }

export function useBed(initialShapeId = 'rect', bedWidth = null, bedDepth = null) {
  const [shapeId, setShapeId] = useState(initialShapeId);
  const [customMask, setCustomMask] = useState(() => defaultFreeformMask());
  const [seasonCells, setSeasonCells] = useState(EMPTY_SC);
  const [sunMap, setSunMap] = useState({});
  const [season, setSeason] = useState('summer');
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const [shapeEditing, setShapeEditing] = useState(false);

  // Active season's cells — derived, not state
  const cells = seasonCells[season] || {};

  const baseShape = useMemo(() => {
    const s = SHAPES[shapeId];
    if (s.id === 'rect' && bedWidth > 0 && bedDepth > 0) {
      return { ...s, w: Math.max(1, Math.round(bedWidth / 25)), h: Math.max(1, Math.round(bedDepth / 25)) };
    }
    return s;
  }, [shapeId, bedWidth, bedDepth]);

  const shape = useMemo(() => {
    if (baseShape.preset) return { ...baseShape, mask: () => true };
    return { ...baseShape, mask: (x,y) => !!customMask[`${x},${y}`] };
  }, [baseShape, customMask]);

  // Shape change resets ALL seasons
  useEffect(() => {
    setSeasonCells(EMPTY_SC);
    setHistory([]); setFuture([]);
    const sun = {};
    const s = baseShape;
    const maskFn = s.preset ? s.mask : (x,y) => !!customMask[`${x},${y}`];
    for (let y=0;y<s.h;y++) for (let x=0;x<s.w;x++) {
      if (!maskFn(x,y)) continue;
      const t = x/Math.max(s.w-1,1);
      sun[`${x},${y}`] = t<0.45?'full':t<0.75?'part':'shade';
    }
    setSunMap(sun);
    if (shapeId !== 'freeform') setShapeEditing(false);
  // eslint-disable-next-line
  }, [shapeId, baseShape]);

  function snapshot() {
    setHistory(h=>[...h.slice(-30),{
      seasonCells: JSON.parse(JSON.stringify(seasonCells)),
      customMask: {...customMask},
    }]);
    setFuture([]);
  }
  function undo() {
    if (!history.length) return;
    setFuture(f=>[{ seasonCells:JSON.parse(JSON.stringify(seasonCells)), customMask:{...customMask} },...f]);
    const prev=history[history.length-1];
    setHistory(h=>h.slice(0,-1));
    setSeasonCells(prev.seasonCells);
    if (prev.customMask) setCustomMask(prev.customMask);
  }
  function redo() {
    if (!future.length) return;
    setHistory(h=>[...h,{ seasonCells:JSON.parse(JSON.stringify(seasonCells)), customMask:{...customMask} }]);
    const nxt=future[0]; setFuture(f=>f.slice(1));
    setSeasonCells(nxt.seasonCells);
    if (nxt.customMask) setCustomMask(nxt.customMask);
  }

  // Checks whether a plant can be placed at the given cm position (no circle overlap)
  function canPlace(xCm, yCm, plantId, existing = cells) {
    const p = plantById(plantId);
    if (!p) return false;
    for (const item of Object.values(existing)) {
      if (typeof item !== 'object') continue;
      const p2 = plantById(item.plantId);
      if (!p2) continue;
      const minDist = (p.spacing_cm + p2.spacing_cm) / 2;
      if (Math.hypot(xCm - item.x, yCm - item.y) < minDist) return false;
    }
    return true;
  }

  // Place a plant at cm coordinates — snaps, clamps, checks collision.
  // If the same plant type exists nearby (within 1.5× spacing), increments its count instead.
  function place(xCm, yCm, plantId) {
    const p = plantById(plantId);
    if (!p) return;
    const r = p.spacing_cm / 2;
    const bw = bedWidth || (shape.w * 25);
    const bh = bedDepth || (shape.h * 25);
    const cx = Math.max(r, Math.min(bw - r, snap(xCm)));
    const cy = Math.max(r, Math.min(bh - r, snap(yCm)));

    // Stack onto a nearby cell of the same plant type
    const nearby = Object.entries(cells).find(([, item]) => {
      if (typeof item !== 'object' || item.plantId !== plantId) return false;
      return Math.hypot(cx - item.x, cy - item.y) < p.spacing_cm * 1.5;
    });
    if (nearby) {
      const [nearKey, nearItem] = nearby;
      snapshot();
      setSeasonCells(sc => ({
        ...sc,
        [season]: { ...sc[season], [nearKey]: { ...nearItem, count: (nearItem.count || 1) + 1 } },
      }));
      return;
    }

    if (!canPlace(cx, cy, plantId)) return;
    snapshot();
    const key = `${cx}_${cy}`;
    setSeasonCells(sc => ({ ...sc, [season]: { ...sc[season], [key]: { plantId, x:cx, y:cy, count:1 } } }));
  }

  // Decrement count; remove cell when count reaches 0
  function remove(key) {
    const item = cells[key];
    snapshot();
    if (typeof item === 'object' && (item.count || 1) > 1) {
      setSeasonCells(sc => ({
        ...sc,
        [season]: { ...sc[season], [key]: { ...item, count: item.count - 1 } },
      }));
    } else {
      setSeasonCells(sc => { const n = {...sc[season]}; delete n[key]; return {...sc, [season]:n}; });
    }
  }

  function move(fromKey, toX, toY) {
    const item = cells[fromKey];
    if (!item || typeof item !== 'object') return;
    const { plantId } = item;
    const p = plantById(plantId);
    if (!p) return;
    const r = p.spacing_cm / 2;
    const bw = bedWidth || (shape.w * 25);
    const bh = bedDepth || (shape.h * 25);
    const cx = Math.max(r, Math.min(bw - r, snap(toX)));
    const cy = Math.max(r, Math.min(bh - r, snap(toY)));
    const toKey = `${cx}_${cy}`;
    if (toKey === fromKey) return;
    const withoutSelf = Object.fromEntries(Object.entries(cells).filter(([k]) => k !== fromKey));
    if (!canPlace(cx, cy, plantId, withoutSelf)) return;
    snapshot();
    setSeasonCells(sc => {
      const n = { ...sc[season] };
      delete n[fromKey];
      n[toKey] = { plantId, x: cx, y: cy };
      return { ...sc, [season]: n };
    });
  }

  function clear() {
    snapshot();
    setSeasonCells(sc => ({ ...sc, [season]:{} }));
  }

  // Freeform mask ops
  function setMaskCell(x,y,on) {
    if (shapeId!=='freeform') return;
    const key=`${x},${y}`;
    if (!!customMask[key]===on) return;
    snapshot();
    setCustomMask(m=>{const n={...m};if(on)n[key]=true;else delete n[key];return n;});
  }
  function toggleMaskCell(x,y) { setMaskCell(x,y,!customMask[`${x},${y}`]); }
  function clearMask()  { snapshot(); setCustomMask({}); setSeasonCells(EMPTY_SC); }
  function resetMask()  { snapshot(); setCustomMask(defaultFreeformMask()); setSeasonCells(EMPTY_SC); }

  // Called once after loading saved data to hydrate all seasons
  function loadSeasonCells(sc) {
    setSeasonCells({ ...EMPTY_SC, ...sc });
    setHistory([]); setFuture([]);
  }

  // Distance-based companion status: neighbor = within 1.5× touching distance in cm
  const plantStatus = useMemo(() => {
    const out = {};
    const entries = Object.entries(cells).filter(([, v]) => typeof v === 'object');
    entries.forEach(([key, {plantId, x, y}]) => {
      const p = plantById(plantId);
      if (!p) return;
      let bad = 0, good = 0;
      const neighbors = [];
      entries.forEach(([key2, {plantId:pid2, x:x2, y:y2}]) => {
        if (key === key2) return;
        const p2 = plantById(pid2);
        if (!p2) return;
        const dist = Math.hypot(x - x2, y - y2);
        const touchDist = (p.spacing_cm + p2.spacing_cm) / 2;
        if (dist <= touchDist * 1.5) {
          const s = pairScore(plantId, pid2);
          if (s < 0) { bad++; neighbors.push({key:key2, plantId:pid2, score:s}); }
          else if (s > 0) { good++; neighbors.push({key:key2, plantId:pid2, score:s}); }
        }
      });
      out[key] = {bad, good, neighbors, status: bad?'bad':good?'good':'neutral'};
    });
    return out;
  }, [cells]);

  const issues = useMemo(() => {
    const seen = new Set(), list = [];
    Object.entries(plantStatus).forEach(([key, info]) => {
      if (!info.bad) return;
      info.neighbors.filter(n => n.score < 0).forEach(n => {
        const sig = [key, n.key].sort().join('|');
        if (seen.has(sig)) return; seen.add(sig);
        const item = cells[key];
        const pidA = typeof item === 'object' ? item.plantId : item;
        list.push({type:'bad', a:plantById(pidA), b:plantById(n.plantId), key, nKey:n.key});
      });
    });
    return list;
  }, [plantStatus, cells]);

  const wins = useMemo(() => {
    const seen = new Set(), list = [];
    Object.entries(plantStatus).forEach(([key, info]) => {
      info.neighbors.filter(n => n.score > 0).forEach(n => {
        const sig = [key, n.key].sort().join('|');
        if (seen.has(sig)) return; seen.add(sig);
        const item = cells[key];
        const pidA = typeof item === 'object' ? item.plantId : item;
        list.push({type:'good', a:plantById(pidA), b:plantById(n.plantId)});
      });
    });
    return list;
  }, [plantStatus, cells]);

  function fixBed() {
    snapshot();
    let next = {...cells}, changed = true, guard = 0;
    while (changed && guard++ < 50) {
      changed = false;
      Object.entries(next).forEach(([key, item]) => {
        if (typeof item !== 'object') return;
        const {plantId, x, y} = item;
        const p = plantById(plantId);
        if (!p) return;
        const nbrs = Object.entries(next)
          .filter(([k2, item2]) => {
            if (k2 === key || typeof item2 !== 'object') return false;
            const p2 = plantById(item2.plantId);
            if (!p2) return false;
            return Math.hypot(x - item2.x, y - item2.y) <= (p.spacing_cm + p2.spacing_cm) / 2 * 1.5;
          })
          .map(([, {plantId:pid2}]) => pid2);
        if (!nbrs.some(np => pairScore(plantId, np) < 0)) return;
        const cands = PLANTS.filter(pl => pl.seasons.includes(season))
          .map(pl => ({
            p: pl,
            score: nbrs.reduce((s, np) => s + pairScore(pl.id, np), 0),
            hasBad: nbrs.some(np => pairScore(pl.id, np) < 0),
          }))
          .filter(c => !c.hasBad)
          .sort((a, b) => b.score - a.score);
        if (cands.length) { next[key] = {plantId:cands[0].p.id, x, y}; changed = true; }
      });
    }
    setSeasonCells(sc => ({...sc, [season]:next}));
  }

  const stats = useMemo(() => {
    const validCells = Object.values(cells).filter(v => typeof v === 'object');
    const placed   = validCells.reduce((s, {count=1}) => s + count, 0);
    const yieldKg  = validCells.reduce((s, {plantId, count=1}) => s + (plantById(plantId)?.yield || 0) * count, 0);
    return {placed, yieldKg};
  }, [cells]);

  return {
    shape, shapeId, setShape:setShapeId,
    cells, seasonCells, loadSeasonCells,
    place, remove, move, clear, canPlace,
    plantStatus,
    issues, wins,
    season, setSeason,
    sunMap,
    undo, redo, canUndo:history.length>0, canRedo:future.length>0,
    fixBed, stats,
    isFreeform: shapeId==='freeform',
    shapeEditing, setShapeEditing,
    toggleMaskCell, setMaskCell, clearMask, resetMask,
    customMask,
    bedWidth, bedDepth,
  };
}
