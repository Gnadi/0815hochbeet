import { useState, useMemo, useEffect } from 'react';
import { PLANTS, SHAPES, pairScore, plantById, defaultFreeformMask } from '../data/plants';

const EMPTY_SC = { spring:{}, summer:{}, autumn:{}, winter:{} };

export function useBed(initialShapeId = 'rect', bedWidth = null, bedDepth = null) {
  const [shapeId, setShapeId] = useState(initialShapeId);
  const [customMask, setCustomMask] = useState(() => defaultFreeformMask());
  // Each season has its own independent cell map
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

  // Shape change resets ALL seasons (shape is shared across seasons)
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

  // Snapshots store the full seasonCells so undo/redo works across season switches
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

  // All mutations operate on the current season only
  function place(x,y,plantId) {
    if (!shape.mask(x,y)) return;
    snapshot();
    setSeasonCells(sc=>({ ...sc, [season]:{ ...sc[season], [`${x},${y}`]:plantId } }));
  }
  function remove(x,y) {
    snapshot();
    setSeasonCells(sc=>{ const n={...sc[season]}; delete n[`${x},${y}`]; return {...sc,[season]:n}; });
  }
  function clear() {
    snapshot();
    setSeasonCells(sc=>({ ...sc, [season]:{} }));
  }

  // Freeform mask ops — removing a cell clears it in ALL seasons
  function setMaskCell(x,y,on) {
    if (shapeId!=='freeform') return;
    const key=`${x},${y}`;
    if (!!customMask[key]===on) return;
    snapshot();
    setCustomMask(m=>{const n={...m};if(on)n[key]=true;else delete n[key];return n;});
    if (!on) {
      setSeasonCells(sc=>{
        const next={};
        Object.entries(sc).forEach(([s,c])=>{ const n={...c}; delete n[key]; next[s]=n; });
        return next;
      });
    }
  }
  function toggleMaskCell(x,y) { setMaskCell(x,y,!customMask[`${x},${y}`]); }
  function clearMask()  { snapshot(); setCustomMask({}); setSeasonCells(EMPTY_SC); }
  function resetMask()  { snapshot(); setCustomMask(defaultFreeformMask()); setSeasonCells(EMPTY_SC); }

  // Called once after loading saved data to hydrate all seasons
  function loadSeasonCells(sc) {
    setSeasonCells({ ...EMPTY_SC, ...sc });
    setHistory([]); setFuture([]);
  }

  const cellStatus = useMemo(() => {
    const out={};
    Object.entries(cells).forEach(([key,pid])=>{
      const [x,y]=key.split(',').map(Number);
      let bad=0,good=0,neighbors=[];
      [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy])=>{
        const nk=`${x+dx},${y+dy}`, np=cells[nk];
        if (!np) return;
        const s=pairScore(pid,np);
        if (s<0){bad++;neighbors.push({key:nk,plant:np,score:s});}
        else if (s>0){good++;neighbors.push({key:nk,plant:np,score:s});}
      });
      out[key]={bad,good,neighbors,status:bad?'bad':good?'good':'neutral'};
    });
    return out;
  }, [cells]);

  const issues = useMemo(() => {
    const seen=new Set(), list=[];
    Object.entries(cellStatus).forEach(([key,info])=>{
      if (!info.bad) return;
      info.neighbors.filter(n=>n.score<0).forEach(n=>{
        const sig=[key,n.key].sort().join('|');
        if (seen.has(sig)) return; seen.add(sig);
        list.push({type:'bad',a:plantById(cells[key]),b:plantById(n.plant),key,nKey:n.key});
      });
    });
    return list;
  }, [cellStatus,cells]);

  const wins = useMemo(() => {
    const seen=new Set(), list=[];
    Object.entries(cellStatus).forEach(([key,info])=>{
      info.neighbors.filter(n=>n.score>0).forEach(n=>{
        const sig=[key,n.key].sort().join('|');
        if (seen.has(sig)) return; seen.add(sig);
        list.push({type:'good',a:plantById(cells[key]),b:plantById(n.plant)});
      });
    });
    return list;
  }, [cellStatus,cells]);

  function fixBed() {
    snapshot();
    let next={...cells}, changed=true, guard=0;
    while (changed && guard++<50) {
      changed=false;
      Object.keys(next).forEach(key=>{
        const [x,y]=key.split(',').map(Number);
        const pid=next[key];
        const nbrs=[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>next[`${x+dx},${y+dy}`]).filter(Boolean);
        if (!nbrs.some(np=>pairScore(pid,np)<0)) return;
        const cands=PLANTS.filter(p=>p.seasons.includes(season))
          .map(p=>({p,score:nbrs.reduce((s,np)=>s+pairScore(p.id,np),0),hasBad:nbrs.some(np=>pairScore(p.id,np)<0)}))
          .filter(c=>!c.hasBad).sort((a,b)=>b.score-a.score);
        if (cands.length){next[key]=cands[0].p.id;changed=true;}
      });
    }
    setSeasonCells(sc=>({...sc,[season]:next}));
  }

  const stats = useMemo(() => {
    const filled=Object.keys(cells).length;
    let totalCells=0;
    for (let y=0;y<shape.h;y++) for (let x=0;x<shape.w;x++) if (shape.mask(x,y)) totalCells++;
    const yieldKg=Object.values(cells).reduce((s,pid)=>s+(plantById(pid)?.yield||0),0);
    return {filled,totalCells,yieldKg,fillPct:totalCells?Math.round(filled/totalCells*100):0};
  }, [cells,shape]);

  return {
    shape,shapeId,setShape:setShapeId,
    cells,seasonCells,loadSeasonCells,
    place,remove,clear,
    cellStatus,issues,wins,
    season,setSeason,
    sunMap,
    undo,redo,canUndo:history.length>0,canRedo:future.length>0,
    fixBed,stats,
    isFreeform:shapeId==='freeform',
    shapeEditing,setShapeEditing,
    toggleMaskCell,setMaskCell,clearMask,resetMask,
    customMask,
    bedWidth, bedDepth,
  };
}
