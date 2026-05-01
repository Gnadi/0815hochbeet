import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { T } from '../theme';
import { PLANTS, plantById } from '../data/plants';
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

// ─── Per-plant spacing planner ────────────────────────────────────────────────
// Each plant occupies spacing_cm × spacing_cm.
// plants_per_row = floor(bedWidth / spacing_cm)
// rows           = floor(bedDepth / spacing_cm)
// total          = plants_per_row × rows
function generatePlan(goal, picks, widthCm, depthCm) {
  const available = picks.map(id => plantById(id)).filter(Boolean);
  if (!available.length) return null;

  // Per-plant fit calculation
  const plantings = available.map(plant => {
    const fitCols = Math.max(0, Math.floor(widthCm / plant.spacing_cm));
    const fitRows = Math.max(0, Math.floor(depthCm / plant.spacing_cm));
    return { plant, fitCols, fitRows, count: fitCols * fitRows };
  }).filter(p => p.count > 0);

  if (!plantings.length) return null;

  // Sort by goal preference
  if (goal === 'yield') plantings.sort((a, b) => b.plant.yield - a.plant.yield);
  if (goal === 'easy')  plantings.sort((a, b) => (a.plant.water === 'low' ? 0 : 1) - (b.plant.water === 'low' ? 0 : 1));

  // Visual cell grid (8×4 rect shape): divide into equal vertical strips per plant
  const GRID_W = 8, GRID_H = 4;
  const cells = {};
  plantings.forEach(({ plant }, idx) => {
    const x0 = Math.round((idx / plantings.length) * GRID_W);
    const x1 = Math.round(((idx + 1) / plantings.length) * GRID_W);
    for (let y = 0; y < GRID_H; y++) {
      for (let x = x0; x < x1; x++) {
        cells[`${x},${y}`] = plant.id;
      }
    }
  });

  const totalCount = plantings.reduce((s, p) => s + p.count, 0);
  const yieldKg = plantings.reduce((s, { plant, count }) => s + plant.yield * count, 0);
  const careHours = goal === 'easy' ? 1.5 : goal === 'yield' ? 3 : 2;
  const usedPlants = plantings.map(p => p.plant);
  const names = usedPlants.slice(0, 3).map(p => p.de).join(', ');

  const desc = goal === 'yield'
    ? `Ertragsoptimiert: ${names} und mehr. Volle Nutzung aller Sonnenstunden.`
    : goal === 'easy'
    ? `Pflegeleicht: Trockenheitsverträgliche Pflanzen wie ${names}. Wenig Pflege nötig.`
    : `Familienfreundlich: Abwechslungsreiche Ernte mit ${names}. Ideal für Kinder.`;

  return { cells, cols: GRID_W, rows: GRID_H, plantings, totalCount, yieldKg, careHours, description: desc, usedPlants };
}

const GOALS = [
  { id:'easy',   de:'Einfach',      desc:'Wenig Pflege — ideal für Einsteiger.' },
  { id:'yield',  de:'Hoher Ertrag', desc:'Maximale Ernte auf minimaler Fläche.' },
  { id:'family', de:'Familie',      desc:'Abwechslungsreich & kinderfreundlich.' },
];

export default function AutoPlan() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const mobile = useBreakpoint();
  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState('family');
  const [picks, setPicks] = useState(['tomato','basil','carrot','lettuce','bean']);
  const [widthCm, setWidthCm] = useState(120);
  const [depthCm, setDepthCm] = useState(80);
  const [plan, setPlan] = useState(null);
  const [saving, setSaving] = useState(false);

  function toggle(id) { setPicks(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]); }

  function goToResult() {
    const result = generatePlan(goal, picks, +widthCm, +depthCm);
    setPlan(result);
    setStep(3);
  }

  function restart() {
    setPlan(null);
    setStep(1);
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

  const inputStyle = { padding:'12px 14px', background:'#fff', border:`1px solid ${T.border}`, color:T.ink, borderRadius:12, fontSize:14, ...MONO, outline:'none' };

  const stepContent = () => {
    if (step === 1) return (
      <div>
        <div style={LABEL}>Schritt 1 · Beetgröße</div>
        <h2 style={{ fontFamily:'Fraunces,serif', fontSize:28, margin:'6px 0 8px', fontWeight:500 }}>
          Wie groß ist dein <em style={{ color:T.green, fontStyle:'italic' }}>Beet</em>?
        </h2>
        <p style={{ fontSize:13, color:T.inkDim, marginBottom:28, lineHeight:1.6 }}>
          Gib die Maße deines Hochbeets ein. Jede Pflanze nutzt ihren eigenen Abstandswert.
        </p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:16 }}>
          <div>
            <div style={{ ...LABEL, marginBottom:8 }}>Breite (cm)</div>
            <input type="number" value={widthCm} onChange={e=>setWidthCm(e.target.value)} style={{ ...inputStyle, width:'100%', boxSizing:'border-box' }} />
          </div>
          <div>
            <div style={{ ...LABEL, marginBottom:8 }}>Tiefe (cm)</div>
            <input type="number" value={depthCm} onChange={e=>setDepthCm(e.target.value)} style={{ ...inputStyle, width:'100%', boxSizing:'border-box' }} />
          </div>
        </div>
        <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:12, padding:'12px 16px', display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ ...MONO, fontSize:22, color:T.green, fontWeight:700 }}>
            {((+widthCm * +depthCm) / 10000).toFixed(2)}
          </span>
          <div>
            <div style={{ fontSize:12, fontWeight:600, color:T.ink }}>m² Beetfläche</div>
            <div style={{ fontSize:11, color:T.inkMute }}>{+widthCm} × {+depthCm} cm</div>
          </div>
        </div>
      </div>
    );

    if (step === 2) return (
      <div>
        <div style={LABEL}>Schritt 2 · Pflanzen</div>
        <h2 style={{ fontFamily:'Fraunces,serif', fontSize:28, margin:'6px 0 8px', fontWeight:500 }}>
          Welche <em style={{ color:T.green, fontStyle:'italic' }}>Pflanzen</em>?
        </h2>
        <p style={{ fontSize:13, color:T.inkDim, marginBottom:20, lineHeight:1.6 }}>
          Wähle dein Ziel und die Pflanzen für dein Beet.
        </p>

        {/* Goal */}
        <div style={{ ...LABEL, marginBottom:8 }}>Ziel</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:24 }}>
          {GOALS.map(g => (
            <button key={g.id} onClick={()=>setGoal(g.id)} style={{ padding:'14px 10px', textAlign:'left', cursor:'pointer', background:goal===g.id?'rgba(107,142,78,0.08)':T.panel, border:`${goal===g.id?2:1}px solid ${goal===g.id?T.green:T.border}`, borderRadius:14, transition:'all 0.15s', fontFamily:'inherit' }}>
              <div style={{ fontFamily:'Fraunces,serif', fontSize:14, fontWeight:500, marginBottom:3, color:goal===g.id?T.green:T.ink }}>{g.de}</div>
              <div style={{ fontSize:10, color:T.inkDim, lineHeight:1.4 }}>{g.desc}</div>
            </button>
          ))}
        </div>

        {/* Plant picker */}
        <div style={{ ...LABEL, marginBottom:8 }}>Pflanzen · {picks.length} ausgewählt</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:6 }}>
          {PLANTS.map(p => (
            <button key={p.id} onClick={()=>toggle(p.id)} style={{ padding:8, borderRadius:12, background:picks.includes(p.id)?'#fff':T.panel, border:`1.5px solid ${picks.includes(p.id)?T.green:T.border}`, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:5, transition:'all 0.15s', fontFamily:'inherit' }}>
              <PlantTile plant={p} size={32} showLabel={false} draggable={false} />
              <div style={{ fontSize:9, fontWeight:600, textAlign:'center', lineHeight:1.2 }}>{p.de}</div>
            </button>
          ))}
        </div>
      </div>
    );

    // Step 3: result
    if (!plan) return null;
    return (
      <div>
        <div style={LABEL}>Schritt 3 · Ergebnis</div>
        <h2 style={{ fontFamily:'Fraunces,serif', fontSize:28, margin:'6px 0 16px', fontWeight:500, fontStyle:'italic', color:T.green }}>
          {goal==='yield'?'Ertrags-Plan':goal==='easy'?'Pflegeleicht-Plan':'Familien-Plan'}
        </h2>

        {/* Visual grid preview */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(8,1fr)', gap:3, marginBottom:18, padding:10, background:T.bg, borderRadius:12 }}>
          {Array.from({length: plan.cols * plan.rows}).map((_,k) => {
            const pid = plan.cells[`${k % plan.cols},${Math.floor(k / plan.cols)}`];
            const p = pid ? plantById(pid) : null;
            return p
              ? <div key={k} style={{ height:32, background:`oklch(0.62 0.1 ${p.hue})`, borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Fraunces,serif', fontStyle:'italic', fontSize:13, color:'#fff' }}>{p.glyph[0]}</div>
              : <div key={k} style={{ height:32, background:'rgba(31,42,27,0.06)', borderRadius:4 }} />;
          })}
        </div>

        {/* Summary chips */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:16 }}>
          <Chip style={{ justifyContent:'center' }}>Ertrag <strong style={{ ...MONO, color:T.green, marginLeft:4 }}>~{plan.yieldKg.toFixed(1)} kg</strong></Chip>
          <Chip style={{ justifyContent:'center' }}>Pflege <strong style={{ ...MONO, color:T.green, marginLeft:4 }}>{plan.careHours}h/Wo</strong></Chip>
        </div>

        {/* Per-plant breakdown */}
        <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:12, overflow:'hidden', marginBottom:16 }}>
          {plan.plantings.map(({ plant, fitCols, fitRows, count }, idx) => (
            <div key={plant.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderBottom: idx < plan.plantings.length - 1 ? `1px solid ${T.border}` : 'none' }}>
              <PlantTile plant={plant} size={28} showLabel={false} draggable={false} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:600, color:T.ink }}>{plant.de}</div>
                <div style={{ fontSize:10, color:T.inkMute, ...MONO }}>{plant.spacing_cm} cm Abstand</div>
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <div style={{ ...MONO, fontSize:14, fontWeight:700, color:T.green }}>{count}×</div>
                <div style={{ fontSize:10, color:T.inkMute }}>{fitCols}×{fitRows}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ fontSize:12, color:T.inkDim, lineHeight:1.6 }}>{plan.description}</div>
      </div>
    );
  };

  const isStep3 = step === 3;

  const navButtons = (
    <div style={{ display:'flex', gap:8, marginTop:28 }}>
      {isStep3 ? (
        <>
          <Btn onClick={restart} style={{ flex:1, justifyContent:'center' }}>Neu starten</Btn>
          <Btn onClick={accept} disabled={saving} variant="primary" style={{ flex:1, justifyContent:'center' }}>
            {saving ? 'Speichern…' : 'Zum Planer →'}
          </Btn>
        </>
      ) : (
        <>
          {step > 1 && (
            <button onClick={()=>setStep(s=>s-1)} style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'9px 16px', borderRadius:999, background:T.panel, color:T.ink, border:`1px solid ${T.border}`, cursor:'pointer', fontSize:13, fontWeight:500, fontFamily:'inherit' }}>← Zurück</button>
          )}
          <button
            onClick={step === 2 ? goToResult : ()=>setStep(s=>s+1)}
            style={{ flex:1, display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8, padding:'9px 16px', borderRadius:999, background:T.green, color:'#fff', border:'none', cursor:'pointer', fontSize:13, fontWeight:500, fontFamily:'inherit' }}
          >
            {step === 2 ? 'Plan generieren ✦' : 'Weiter →'}
          </button>
        </>
      )}
    </div>
  );

  const cardStyle = {
    background:T.paper,
    borderRadius:20,
    padding: mobile ? '28px 20px' : 40,
    width: mobile ? undefined : 520,
    margin: mobile ? undefined : '0 auto',
    boxShadow:'0 1px 0 rgba(31,42,27,0.04),0 8px 32px -16px rgba(31,42,27,0.14)',
    border:`1px solid ${T.border}`,
  };

  return (
    <div style={{ minHeight:'100vh', background:T.bg, padding: mobile ? '56px 16px 48px' : '48px 24px 64px', overflow:'auto' }}>
      <button onClick={()=>navigate('/dashboard')} style={{ background:'none', border:'none', color:T.inkMute, cursor:'pointer', fontSize:12, fontFamily:'inherit', marginBottom:20, display:'block' }}>
        ← Dashboard
      </button>

      <div style={cardStyle}>
        {/* Progress bar */}
        <div style={{ display:'flex', gap:6, marginBottom:32 }}>
          {[1,2,3].map(n => (
            <div key={n} style={{ flex:1, height:4, borderRadius:2, background:n<=step?T.green:'rgba(31,42,27,0.1)', transition:'background 0.3s' }} />
          ))}
        </div>

        {stepContent()}
        {navButtons}
      </div>
    </div>
  );
}
