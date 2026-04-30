import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { T } from '../theme';
import { PLANTS, COMPANIONS, plantById, pairScore } from '../data/plants';
import { PlantTile } from '../components/PlantTile';
import { Btn } from '../components/Btn';
import { Chip } from '../components/Chip';

const MONO = { fontFamily:'JetBrains Mono,monospace' };
const LABEL = { ...MONO, fontSize:10, textTransform:'uppercase', letterSpacing:'0.1em', color:T.inkMute };

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function saveBedLocally(bedId, data) {
  localStorage.setItem(`hb_bed_${bedId}`, JSON.stringify(data));
  const ids = JSON.parse(localStorage.getItem('hb_beds')||'[]');
  if (!ids.includes(bedId)) ids.push(bedId);
  localStorage.setItem('hb_beds', JSON.stringify(ids));
}

// ─── Optimized greedy companion-aware bed planner ───────────────────────────
function generatePlan(goal, picks, widthCm, depthCm) {
  const cols = Math.max(1, Math.floor(widthCm / 25));
  const rows = Math.max(1, Math.floor(depthCm / 25));
  const available = picks.map(id => plantById(id)).filter(Boolean);
  if (!available.length) return null;

  function goalScore(p) {
    if (goal === 'yield')  return p.yield * 3;
    if (goal === 'easy')   return p.water === 'low' ? 3 : p.water === 'med' ? 2 : 1;
    if (goal === 'family') return p.yield + (p.water === 'low' ? 1 : 0) + 0.5;
    return 1;
  }

  const scored = available.map(p => ({ ...p, gs: goalScore(p) })).sort((a,b) => b.gs - a.gs);
  const grid = Array.from({length:rows}, () => Array(cols).fill(null));
  const cells = {};
  const placedOnce = new Set();

  function nbrs(x, y) {
    return [[x-1,y],[x+1,y],[x,y-1],[x,y+1]].map(([nx,ny]) => grid[ny]?.[nx]).filter(Boolean);
  }

  // Pass 1: greedy fill — plants not yet placed get a large bonus so they appear at
  // least once before the algorithm reverts to pure companion/goal optimisation
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const neighbors = nbrs(x, y);

      const candidates = scored.map(p => {
        const companionScore = neighbors.reduce((s,n) => s + pairScore(p.id, n), 0);
        const hasBad = neighbors.some(n => pairScore(p.id, n) < 0);
        // 500-pt bonus dwarfs any normal score (~10–30), guaranteeing first placement
        // when the cell is conflict-free for this plant
        const firstBonus = placedOnce.has(p.id) ? 0 : 500;
        return { p, score: p.gs * 2 + companionScore * 4 + firstBonus, hasBad };
      }).filter(c => !c.hasBad).sort((a,b) => b.score - a.score);

      const chosen = candidates[0]?.p ?? scored.reduce((best, cur) => {
        const bs = neighbors.reduce((s,n)=>s+pairScore(best.id,n),0);
        const cs = neighbors.reduce((s,n)=>s+pairScore(cur.id,n),0);
        return cs > bs ? cur : best;
      }, scored[0]);

      grid[y][x] = chosen.id;
      cells[`${x},${y}`] = chosen.id;
      placedOnce.add(chosen.id);
    }
  }

  // Pass 2: rescue — any plant that still didn't make it (all its cells had conflicts
  // in pass 1) gets force-placed on its best available cell, overwriting the occupant
  const allKeys = Object.keys(cells);
  for (const p of scored) {
    if (placedOnce.has(p.id)) continue;
    let bestKey = allKeys[0], bestScore = -Infinity;
    for (const key of allKeys) {
      const [kx, ky] = key.split(',').map(Number);
      const score = [[kx-1,ky],[kx+1,ky],[kx,ky-1],[kx,ky+1]]
        .map(([nx,ny]) => cells[`${nx},${ny}`]).filter(Boolean)
        .reduce((s, n) => s + pairScore(p.id, n), 0);
      if (score > bestScore) { bestScore = score; bestKey = key; }
    }
    const [bx, by] = bestKey.split(',').map(Number);
    grid[by][bx] = p.id;
    cells[bestKey] = p.id;
    placedOnce.add(p.id);
  }

  // Pass 3: local swap — resolve remaining conflicts (3 iterations)
  for (let iter = 0; iter < 3; iter++) {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const key = `${x},${y}`;
        const pid = cells[key];
        const neighbors = [[x-1,y],[x+1,y],[x,y-1],[x,y+1]].map(([nx,ny])=>cells[`${nx},${ny}`]).filter(Boolean);
        if (!neighbors.some(n => pairScore(pid, n) < 0)) continue;
        const better = scored.find(p => !neighbors.some(n => pairScore(p.id, n) < 0) && p.id !== pid);
        if (better) { grid[y][x] = better.id; cells[key] = better.id; }
      }
    }
  }

  const yieldKg = Object.values(cells).reduce((s,pid)=>s+(plantById(pid)?.yield||0),0);
  const careHours = goal==='easy'?1.5:goal==='yield'?3:2;
  const usedPlants = [...new Set(Object.values(cells))].map(plantById).filter(Boolean);

  const names = usedPlants.slice(0,3).map(p=>p.de).join(', ');
  const desc = goal==='yield'
    ? `Ertragsoptimiert: ${names} und mehr. Volle Nutzung aller Sonnenstunden.`
    : goal==='easy'
    ? `Pflegeleicht: Trockenheitsverträgliche Pflanzen wie ${names}. Wenig Pflege nötig.`
    : `Familienfreundlich: Abwechslungsreiche Ernte mit ${names}. Ideal für Kinder.`;

  return { cells, grid, cols, rows, yieldKg, careHours, description:desc, usedPlants };
}

export default function AutoPlan() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const mobile = useBreakpoint();
  const [goal, setGoal] = useState('family');
  const [picks, setPicks] = useState(['tomato','basil','carrot','lettuce','bean']);
  const [widthCm, setWidthCm] = useState(120);
  const [depthCm, setDepthCm] = useState(80);
  const [plan, setPlan] = useState(null);
  const [genTime, setGenTime] = useState(null);
  const [saving, setSaving] = useState(false);

  function toggle(id) { setPicks(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]); }

  function generate() {
    const t0 = Date.now();
    const result = generatePlan(goal, picks, +widthCm, +depthCm);
    setGenTime(Date.now()-t0);
    setPlan(result);
  }

  async function accept() {
    if (!plan) return;
    setSaving(true);
    const bedId = genId();
    const now = new Date().toISOString();
    const bedData = { id:bedId, name:`Plan ${new Date().toLocaleDateString('de-DE')}`, width:+widthCm, depth:+depthCm, shapeId:'rect', seasonCells:{ spring:{}, summer:plan.cells, autumn:{}, winter:{} }, customMask:{}, season:'summer', notes:'', createdAt:now, updatedAt:now };
    saveBedLocally(bedId, bedData);
    if (user && db) {
      try { await setDoc(doc(db,'users',user.uid,'beds',bedId),{...bedData,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}); } catch {}
    }
    navigate(`/bed/${bedId}`);
  }

  const GOALS = [
    { id:'easy',   de:'Einfach',      desc:'Wenig Pflege — ideal für Einsteiger.' },
    { id:'yield',  de:'Hoher Ertrag', desc:'Maximale Ernte auf minimaler Fläche.' },
    { id:'family', de:'Familie',      desc:'Abwechslungsreich & kinderfreundlich.' },
  ];

  const preview = plan ? (
    <div>
      <div style={{ ...LABEL, color:T.green, marginBottom:6 }}>● Generiert in {genTime}ms</div>
      <h3 style={{ fontFamily:'Fraunces,serif', fontSize:26, margin:'8px 0 16px', fontStyle:'italic' }}>
        {goal==='yield'?'Ertrags-Plan':goal==='easy'?'Pflegeleicht-Plan':'Familien-Plan'}
      </h3>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(8,1fr)', gap:3, marginBottom:18, padding:10, background:T.bg, borderRadius:12 }}>
        {Array.from({length:Math.min(plan.cols*plan.rows,32)}).map((_,k)=>{
          const pid = plan.cells[`${k%plan.cols},${Math.floor(k/plan.cols)}`];
          const p = pid ? plantById(pid) : null;
          return p ? <div key={k} style={{ height:32, background:`oklch(0.62 0.1 ${p.hue})`, borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Fraunces,serif', fontStyle:'italic', fontSize:13, color:'#fff' }}>{p.glyph[0]}</div>
            : <div key={k} style={{ height:32, background:'rgba(31,42,27,0.06)', borderRadius:4 }} />;
        })}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:16 }}>
        <Chip style={{ justifyContent:'center' }}>Ertrag <strong style={{ ...MONO, color:T.green, marginLeft:4 }}>~{plan.yieldKg.toFixed(1)} kg</strong></Chip>
        <Chip style={{ justifyContent:'center' }}>Pflege <strong style={{ ...MONO, color:T.green, marginLeft:4 }}>{plan.careHours}h/Wo</strong></Chip>
      </div>
      <div style={{ fontSize:12, color:T.inkDim, lineHeight:1.6, marginBottom:16 }}>{plan.description}</div>
      <div style={{ display:'flex', gap:8 }}>
        <Btn onClick={()=>setPlan(null)} style={{ flex:1 }}>Verwerfen</Btn>
        <Btn onClick={accept} disabled={saving} variant="primary" style={{ flex:1 }}>
          {saving?'Speichern…':'Übernehmen →'}
        </Btn>
      </div>
    </div>
  ) : (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', color:T.inkMute }}>
      <div style={{ fontFamily:'Fraunces,serif', fontSize:56, fontStyle:'italic', marginBottom:12, color:T.green }}>~</div>
      <div style={{ fontSize:13 }}>Vorschau erscheint hier</div>
      <div style={{ fontSize:11, marginTop:6 }}>Pflanze auswählen und Plan generieren</div>
    </div>
  );

  const controls = (
    <div>
      {/* Goal */}
      <div style={LABEL}>Ziel · Goal</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:24, marginTop:8 }}>
        {GOALS.map(g => (
          <button key={g.id} onClick={()=>setGoal(g.id)} style={{ padding:18, textAlign:'left', cursor:'pointer', background:goal===g.id?'rgba(107,142,78,0.08)':T.panel, border:`${goal===g.id?2:1}px solid ${goal===g.id?T.green:T.border}`, borderRadius:18, transition:'all 0.15s', fontFamily:'inherit' }}>
            <div style={{ fontFamily:'Fraunces,serif', fontSize:16, fontWeight:500, marginBottom:4, color:goal===g.id?T.green:T.ink }}>{g.de}</div>
            <div style={{ fontSize:11, color:T.inkDim }}>{g.desc}</div>
          </button>
        ))}
      </div>

      {/* Plant picker */}
      <div style={LABEL}>Pflanzen wählen · {picks.length} ausgewählt</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8, marginBottom:24, marginTop:8 }}>
        {PLANTS.map(p => (
          <button key={p.id} onClick={()=>toggle(p.id)} style={{ padding:10, borderRadius:14, background:picks.includes(p.id)?'#fff':T.panel, border:`1.5px solid ${picks.includes(p.id)?T.green:T.border}`, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:6, transition:'all 0.15s', fontFamily:'inherit' }}>
            <PlantTile plant={p} size={36} showLabel={false} draggable={false} />
            <div style={{ fontSize:10, fontWeight:600 }}>{p.de}</div>
          </button>
        ))}
      </div>

      {/* Bed size */}
      <div style={LABEL}>Beetgröße</div>
      <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:24, marginTop:8 }}>
        <input type="number" value={widthCm} onChange={e=>setWidthCm(e.target.value)} style={{ width:80, padding:10, background:T.panel, border:`1px solid ${T.border}`, color:T.ink, borderRadius:10, ...MONO }} />
        <span style={{ ...MONO, color:T.inkMute, fontSize:11 }}>cm ×</span>
        <input type="number" value={depthCm} onChange={e=>setDepthCm(e.target.value)} style={{ width:80, padding:10, background:T.panel, border:`1px solid ${T.border}`, color:T.ink, borderRadius:10, ...MONO }} />
        <span style={{ ...MONO, color:T.inkMute, fontSize:11 }}>cm = {Math.floor(widthCm/25)*Math.floor(depthCm/25)} Felder</span>
      </div>

      <Btn onClick={generate} variant="primary" style={{ width:'100%', justifyContent:'center', padding:'14px 24px', fontSize:14 }}>
        ✦ Plan generieren →
      </Btn>
    </div>
  );

  if (mobile) return (
    <div style={{ minHeight:'100vh', background:T.bg, padding:'56px 16px 32px', overflow:'auto' }}>
      <button onClick={()=>navigate('/dashboard')} style={{ background:'none', border:'none', color:T.inkMute, cursor:'pointer', fontSize:12, fontFamily:'inherit', marginBottom:12 }}>← Dashboard</button>
      <div style={LABEL}>Schritt 2/3 · Step 2/3</div>
      <h1 style={{ fontFamily:'Fraunces,serif', fontSize:32, margin:'4px 0 24px', fontWeight:500 }}>Plan <em style={{ color:T.green, fontStyle:'italic' }}>generieren</em>.</h1>
      {controls}
      {plan && <div style={{ marginTop:24, background:T.panel, border:`1px solid ${T.border}`, borderRadius:18, padding:24 }}>{preview}</div>}
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:T.bg, padding:32, overflow:'auto' }}>
      <div style={{ maxWidth:1200, margin:'0 auto' }}>
        <button onClick={()=>navigate('/dashboard')} style={{ background:'none', border:'none', color:T.inkMute, cursor:'pointer', fontSize:13, fontFamily:'inherit', marginBottom:16, display:'flex', alignItems:'center', gap:6 }}>← Dashboard</button>
        <div style={LABEL}>Schritt 2/3 · Step 2/3</div>
        <h1 style={{ fontFamily:'Fraunces,serif', fontSize:40, margin:'4px 0 28px', fontWeight:500 }}>Plan <em style={{ color:T.green, fontStyle:'italic' }}>generieren</em>.</h1>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:28 }}>
          <div>{controls}</div>
          <div style={{ background:plan?T.panel:'transparent', border:plan?`1px solid ${T.border}`:`2px dashed ${T.border}`, borderRadius:18, padding:24, minHeight:480, boxShadow:plan?'0 1px 0 rgba(31,42,27,0.04),0 8px 24px -16px rgba(31,42,27,0.18)':'none' }}>
            {preview}
          </div>
        </div>
      </div>
    </div>
  );
}
