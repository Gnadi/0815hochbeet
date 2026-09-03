import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LABEL, MONO, T } from '../theme';
import { PLANTS, SEASONS, pairScore, plantById } from '../data/plants';
import { FEEDERS, monthRangeLabel } from '../data/plantDetails';
import { createBed, currentSeason, saveBed } from '../lib/beds';
import { useBedRecord, useBeds } from '../hooks/useBeds';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { BedCanvas } from '../components/BedCanvas';
import { Btn, IconBtn } from '../components/Btn';
import { Chip } from '../components/Chip';
import { useToast } from '../components/Toast';

const card = { background:T.panel, border:`1px solid ${T.border}`, borderRadius:16, padding:14 };
const field = {
  width:'100%', padding:'13px 14px', borderRadius:12,
  border:`1px solid ${T.border}`, background:T.panel, color:T.ink, outline:'none', minHeight:48,
};

const MAX_PER_BAND = 24;

const GOALS = [
  { id:'easy',   de:'Pflegeleicht', desc:'Robuste Kulturen, wenig Gießen.',        pick:p => p.difficulty === 1 && p.water !== 'high' },
  { id:'yield',  de:'Viel Ertrag',  desc:'Maximale Erntemenge je m².',             pick:p => p.yield >= 0.3 },
  { id:'family', de:'Vielfalt',     desc:'Bunte Mischung für die Küche.',          pick:p => p.yield > 0 },
  { id:'kids',   de:'Mit Kindern',  desc:'Schnelle Erfolge, große Samen.',         pick:p => p.tags.includes('kinder') || p.harvestWeeks <= 6 },
  { id:'herbs',  de:'Küchenkräuter',desc:'Würze direkt vor der Tür.',              pick:p => p.tags.includes('kräuter') || p.tags.includes('schutzpflanze') },
];

/**
 * Builds a row-based mixed-culture plan (Reihenmischkultur).
 *
 * Rows run across the bed. The set of rows is chosen first — variety before
 * repetition — then sorted tall-to-short so nothing shades what is planted in
 * front of it, and finally any bad neighbours are separated by local swaps.
 *
 * Choosing the set before the order matters: a purely greedy row-by-row loop
 * that also enforced "never taller than the row behind" painted itself into a
 * corner and filled two thirds of the bed with radishes.
 */
function generatePlan({ picks, widthCm, depthCm, heightCm, season, goal }) {
  const pool = picks
    .map(plantById)
    .filter(p => p && p.seasons.includes(season) && p.spacing_cm <= depthCm);
  if (!pool.length) return null;

  // How well a plant mixes with the rest of the selection, plus the goal bias.
  const affinity = p => pool.reduce((s, o) => (o.id === p.id ? s : s + pairScore(p.id, o.id)), 0);
  const goalScore = p =>
    goal === 'yield' ? p.yield * 3 :
    goal === 'easy' ? (3 - p.difficulty) * 2 :
    goal === 'kids' ? Math.max(0, 12 - p.harvestWeeks) / 3 :
    0;
  const ranked = [...pool].sort((a, b) => (affinity(b) + goalScore(b)) - (affinity(a) + goalScore(a)));

  // Pass 1 — one row of each plant that still fits.
  const rows = [];
  let used = 0;
  for (const p of ranked) {
    if (used + p.spacing_cm > depthCm) continue;
    rows.push(p);
    used += p.spacing_cm;
  }
  if (!rows.length) return null;

  // Pass 2 — spend the remaining depth on the least-used plants that fit.
  for (let guard = 0; guard < 40; guard++) {
    const count = id => rows.filter(r => r.id === id).length;
    const fits = ranked
      .filter(p => used + p.spacing_cm <= depthCm)
      .sort((a, b) => count(a.id) - count(b.id) || a.spacing_cm - b.spacing_cm);
    if (!fits.length) break;
    rows.push(fits[0]);
    used += fits[0].spacing_cm;
  }

  // Tall at the back (top of the canvas = north side of the bed).
  rows.sort((a, b) => b.height_cm - a.height_cm);

  // Separate bad neighbours by swapping in a compatible row from further down.
  for (let i = 1; i < rows.length; i++) {
    if (pairScore(rows[i - 1].id, rows[i].id) >= 0) continue;
    const j = rows.findIndex((p, k) =>
      k > i &&
      pairScore(rows[i - 1].id, p.id) >= 0 &&
      (k + 1 >= rows.length || pairScore(p.id, rows[k + 1].id) >= 0));
    if (j > -1) { const tmp = rows[i]; rows[i] = rows[j]; rows[j] = tmp; }
  }

  // Lay the rows out and fill each with evenly spaced plants.
  const cells = {};
  const layout = [];
  let y = 0;
  rows.forEach(plant => {
    const rowY = Math.round(y + plant.spacing_cm / 2);
    const cols = Math.max(1, Math.floor(widthCm / plant.spacing_cm));
    const shown = Math.min(cols, MAX_PER_BAND);
    const perCircle = Math.ceil(cols / shown);
    const stepCm = (widthCm - plant.spacing_cm) / Math.max(1, shown - 1);
    for (let i = 0; i < shown; i++) {
      // Exact centimetres, not 5 cm steps — snapping distorted the even
      // spacing enough to make neighbouring circles visibly overlap.
      const x = Math.round(plant.spacing_cm / 2 + (shown === 1 ? (widthCm - plant.spacing_cm) / 2 : i * stepCm));
      const key = `${x}_${rowY}`;
      if (cells[key]) continue;
      const count = i === shown - 1 ? Math.max(1, cols - perCircle * (shown - 1)) : perCircle;
      cells[key] = { plantId: plant.id, x, y: rowY, count };
    }
    layout.push({ plant, total: cols, rowY, yieldKg: plant.yield * cols });
    y += plant.spacing_cm;
  });

  const totalCount = layout.reduce((s, r) => s + r.total, 0);
  const yieldKg = layout.reduce((s, r) => s + r.yieldKg, 0);
  const careHours = Math.round((layout.reduce((s, r) => s + r.plant.difficulty, 0) / 2 + layout.length * 0.3) * 10) / 10;
  const kinds = [...new Set(layout.map(r => r.plant.id))];
  const tooDeep = kinds.map(plantById).filter(p => p.rootDepth_cm > heightCm);
  const unused = pool.filter(p => !kinds.includes(p.id));

  return { cells, rows: layout, totalCount, yieldKg, careHours, tooDeep, unused, kinds, usedDepth: y };
}

export default function AutoPlan() {
  const navigate = useNavigate();
  const mobile = useBreakpoint();
  const toast = useToast();
  const [params] = useSearchParams();
  const beds = useBeds();
  const targetBed = useBedRecord(params.get('bed'));

  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState('family');
  // Arriving from a bed carries that bed's season, so the suggestion replaces
  // the season the gardener was actually looking at.
  const [season, setSeason] = useState(() => {
    const wanted = params.get('season');
    return SEASONS.some(x => x.id === wanted) ? wanted : currentSeason();
  });
  const [picks, setPicks] = useState(() => PLANTS.filter(p => p.tags.includes('anfänger')).map(p => p.id).slice(0, 6));
  const [dims, setDims] = useState({
    width: targetBed?.width || beds[0]?.width || 120,
    depth: targetBed?.depth || beds[0]?.depth || 80,
    height: targetBed?.height || beds[0]?.height || 80,
  });
  const [applyTo, setApplyTo] = useState(targetBed?.id || 'new');
  const [saving, setSaving] = useState(false);

  const seasonPlants = useMemo(() => PLANTS.filter(p => p.seasons.includes(season)), [season]);

  const plan = useMemo(() => generatePlan({
    picks, widthCm:Number(dims.width) || 120, depthCm:Number(dims.depth) || 80,
    heightCm:Number(dims.height) || 80, season, goal,
  }), [picks, dims, season, goal]);

  const previewBed = useMemo(() => plan ? {
    cells:plan.cells, plantStatus:{}, bedWidth:Number(dims.width), bedDepth:Number(dims.depth),
  } : null, [plan, dims]);

  function applyGoalPreset(id) {
    setGoal(id);
    const g = GOALS.find(x => x.id === id);
    const auto = seasonPlants.filter(g.pick).slice(0, 7).map(p => p.id);
    if (auto.length >= 2) setPicks(auto);
  }

  function toggle(id) {
    setPicks(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));
  }

  function accept() {
    if (!plan) return;
    setSaving(true);
    if (applyTo !== 'new') {
      const target = beds.find(b => b.id === applyTo);
      const prev = target.seasonCells;
      saveBed(applyTo, { seasonCells: { ...prev, [season]: plan.cells } });
      toast({
        message:`Plan in „${target.name}" (${SEASONS.find(s => s.id === season).de}) übernommen`,
        tone:'good',
        action: () => saveBed(applyTo, { seasonCells: prev }),
      });
      navigate(`/bed/${applyTo}`);
      return;
    }
    const bed = createBed({
      name:`Plan ${new Date().toLocaleDateString('de-DE')}`,
      width:Number(dims.width), depth:Number(dims.depth), height:Number(dims.height),
      season,
      seasonCells:{ spring:{}, summer:{}, autumn:{}, winter:{}, [season]:plan.cells },
    });
    navigate(`/bed/${bed.id}`);
  }

  // ── Steps ────────────────────────────────────────────────────────────────
  const step1 = (
    <>
      <div style={LABEL}>Schritt 1 · Beet &amp; Saison</div>
      <h2 style={{ fontFamily:"'Fraunces',serif", fontSize:mobile ? 24 : 28, margin:'6px 0 14px', fontWeight:500 }}>
        {targetBed
          ? <>Vorschlag für <em style={{ color:T.green, fontStyle:'italic' }}>{targetBed.name}</em></>
          : <>Für welches <em style={{ color:T.green, fontStyle:'italic' }}>Beet</em>?</>}
      </h2>

      {applyTo !== 'new' && (
        <div style={{ padding:'11px 13px', borderRadius:12, background:T.warnBg, border:`1px solid ${T.warnBorder}`, fontSize:12, color:T.inkDim, lineHeight:1.5, marginBottom:16 }}>
          Der Vorschlag ersetzt die bisherige Bepflanzung in der gewählten Saison.
          Andere Saisons bleiben unberührt, und du kannst den Schritt danach rückgängig machen.
        </div>
      )}

      {beds.length > 0 && (
        <>
          <div style={{ ...LABEL, marginBottom:8 }}>Plan anwenden auf</div>
          <select value={applyTo} onChange={e => {
            setApplyTo(e.target.value);
            const b = beds.find(x => x.id === e.target.value);
            if (b) setDims({ width:b.width, depth:b.depth, height:b.height });
          }} style={{ ...field, marginBottom:16 }} aria-label="Zielbeet">
            <option value="new">Neues Beet anlegen</option>
            {beds.map(b => <option key={b.id} value={b.id}>{b.name} ({b.width}×{b.depth} cm)</option>)}
          </select>
        </>
      )}

      <div style={{ ...LABEL, marginBottom:8 }}>Saison</div>
      <div className="hscroll" style={{ display:'flex', gap:6, marginBottom:16 }}>
        {SEASONS.map(s => (
          <button key={s.id} onClick={() => setSeason(s.id)} aria-pressed={season === s.id}
            style={{ padding:'9px 15px', borderRadius:999, fontSize:12.5, fontWeight:600, fontFamily:'inherit', flexShrink:0, cursor:'pointer', minHeight:42,
              background:season === s.id ? T.green : T.panel, color:season === s.id ? 'var(--panel)' : T.ink,
              border:`1px solid ${season === s.id ? 'transparent' : T.border}` }}>{s.glyph} {s.de}</button>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:12 }}>
        {[['width','Breite'], ['depth','Tiefe'], ['height','Höhe']].map(([k, l]) => (
          <div key={k}>
            <div style={{ ...LABEL, marginBottom:6 }}>{l} (cm)</div>
            <input type="number" inputMode="numeric" value={dims[k]} aria-label={`${l} in Zentimetern`}
              disabled={applyTo !== 'new'}
              onChange={e => setDims(d => ({ ...d, [k]:e.target.value }))}
              style={{ ...field, ...MONO, opacity:applyTo !== 'new' ? 0.6 : 1 }} />
          </div>
        ))}
      </div>
      <div style={{ ...card, ...MONO, fontSize:12.5, color:T.inkDim, textAlign:'center' }}>
        {((Number(dims.width) * Number(dims.depth)) / 10000).toFixed(2)} m² Anbaufläche
      </div>
    </>
  );

  const step2 = (
    <>
      <div style={LABEL}>Schritt 2 · Ziel &amp; Pflanzen</div>
      <h2 style={{ fontFamily:"'Fraunces',serif", fontSize:mobile ? 24 : 28, margin:'6px 0 14px', fontWeight:500 }}>
        Was ist dir <em style={{ color:T.green, fontStyle:'italic' }}>wichtig</em>?
      </h2>

      <div style={{ display:'grid', gridTemplateColumns:mobile ? '1fr 1fr' : 'repeat(3,1fr)', gap:8, marginBottom:20 }}>
        {GOALS.map(g => {
          const on = goal === g.id;
          return (
            <button key={g.id} onClick={() => applyGoalPreset(g.id)} aria-pressed={on}
              style={{ padding:'13px 12px', textAlign:'left', cursor:'pointer', borderRadius:14, fontFamily:'inherit', color:T.ink,
                background:on ? T.goodBg : T.panel, border:`${on ? 2 : 1}px solid ${on ? T.green : T.border}` }}>
              <div style={{ fontFamily:"'Fraunces',serif", fontSize:14, fontWeight:600, color:on ? T.green : T.ink }}>{g.de}</div>
              <div style={{ fontSize:10.5, color:T.inkDim, marginTop:3, lineHeight:1.4 }}>{g.desc}</div>
            </button>
          );
        })}
      </div>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <div style={LABEL}>Pflanzen · {picks.filter(id => seasonPlants.some(p => p.id === id)).length} in Saison</div>
        <button onClick={() => setPicks([])}
          style={{ background:'none', border:'none', color:T.inkMute, cursor:'pointer', ...MONO, fontSize:10, minHeight:32 }}>
          zurücksetzen
        </button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:mobile ? 'repeat(4,1fr)' : 'repeat(6,1fr)', gap:6 }}>
        {seasonPlants.map(p => {
          const on = picks.includes(p.id);
          return (
            <button key={p.id} onClick={() => toggle(p.id)} aria-pressed={on}
              style={{ padding:'9px 5px', borderRadius:12, cursor:'pointer', fontFamily:'inherit', color:T.ink, minHeight:78,
                background:on ? T.goodBg : T.panel, border:`1.5px solid ${on ? T.green : T.border}`,
                display:'flex', flexDirection:'column', alignItems:'center', gap:5 }}>
              <span aria-hidden="true" style={{ width:30, height:30, borderRadius:'50%', background:`radial-gradient(circle at 35% 30%, oklch(0.80 0.10 ${p.hue}), oklch(0.50 0.15 ${p.hue}))`, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontFamily:"'Fraunces',serif", fontStyle:'italic', fontSize:13 }}>{p.glyph[0]}</span>
              <span style={{ fontSize:9.5, fontWeight:600, textAlign:'center', lineHeight:1.2 }}>{p.de}</span>
            </button>
          );
        })}
      </div>
    </>
  );

  const step3 = plan ? (
    <>
      <div style={LABEL}>Schritt 3 · Ergebnis</div>
      <h2 style={{ fontFamily:"'Fraunces',serif", fontSize:mobile ? 24 : 28, margin:'6px 0 14px', fontWeight:500, fontStyle:'italic', color:T.green }}>
        {GOALS.find(g => g.id === goal).de}-Plan
      </h2>

      <div style={{ marginBottom:14 }}>
        <BedCanvas bed={previewBed} readOnly showConflict={false} />
      </div>

      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:14 }}>
        <Chip>{plan.totalCount} Pflanzen</Chip>
        <Chip tone="good">~{plan.yieldKg.toFixed(1)} kg Ertrag</Chip>
        <Chip>{plan.careHours} h/Woche Pflege</Chip>
        <Chip>{plan.rows.length} Reihen · {plan.kinds.length} Sorten</Chip>
      </div>

      {plan.tooDeep.length > 0 && (
        <div style={{ padding:13, borderRadius:14, background:T.warnBg, border:`1px solid ${T.warnBorder}`, marginBottom:14, fontSize:12, color:T.inkDim, lineHeight:1.55 }}>
          ⚠ {plan.tooDeep.map(p => `${p.de} (${p.rootDepth_cm} cm Wurzeltiefe)`).join(', ')} {plan.tooDeep.length > 1 ? 'brauchen' : 'braucht'} ein tieferes Beet als deine {dims.height} cm.
        </div>
      )}

      <div style={{ ...card, padding:0, overflow:'hidden', marginBottom:14 }}>
        {plan.rows.map((r, i) => (
          <div key={`${r.plant.id}-${i}`} style={{ display:'flex', alignItems:'center', gap:11, padding:'11px 14px', borderTop:i ? `1px solid ${T.border}` : 'none' }}>
            <span aria-hidden="true" style={{ width:28, height:28, borderRadius:'50%', flexShrink:0, background:`radial-gradient(circle at 35% 30%, oklch(0.80 0.10 ${r.plant.hue}), oklch(0.50 0.15 ${r.plant.hue}))`, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontFamily:"'Fraunces',serif", fontStyle:'italic', fontSize:12 }}>{r.plant.glyph[0]}</span>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12.5, fontWeight:600 }}>{r.plant.de}</div>
              <div style={{ ...MONO, fontSize:9.5, color:T.inkMute }}>
                Reihe bei {r.rowY} cm · {r.plant.spacing_cm} cm Abstand · {FEEDERS[r.plant.feeder]?.short}
              </div>
              <div style={{ ...MONO, fontSize:9.5, color:T.inkMute }}>Saat {monthRangeLabel(r.plant.sowMonths)}</div>
            </div>
            <div style={{ textAlign:'right', flexShrink:0 }}>
              <div style={{ ...MONO, fontSize:14, fontWeight:700, color:T.green }}>{r.total}×</div>
              {r.yieldKg > 0 && <div style={{ ...MONO, fontSize:9.5, color:T.inkMute }}>~{r.yieldKg.toFixed(1)} kg</div>}
            </div>
          </div>
        ))}
      </div>

      {plan.unused.length > 0 && (
        <div style={{ fontSize:11.5, color:T.inkMute, lineHeight:1.5, marginBottom:8 }}>
          Nicht untergebracht: {plan.unused.map(p => p.de).join(', ')} — dafür fehlt die Beettiefe oder es gäbe Konflikte in der Nachbarreihe.
        </div>
      )}
      <div style={{ fontSize:12, color:T.inkDim, lineHeight:1.6 }}>
        Hohe Pflanzen stehen hinten, damit sie die niedrigen nicht beschatten. Benachbarte Reihen sind auf gute Mischkultur geprüft.
      </div>
    </>
  ) : (
    <div style={{ ...card, textAlign:'center', padding:26, color:T.inkDim, fontSize:13, lineHeight:1.6 }}>
      Mit dieser Auswahl lässt sich kein Plan bauen. Wähle mehr Pflanzen für die {SEASONS.find(s => s.id === season).de}-Saison oder ein tieferes Beet.
    </div>
  );

  return (
    <div style={{
      minHeight:'100vh', background:T.bg,
      padding:mobile ? `calc(12px + var(--safe-t)) 16px 40px` : '30px 24px 60px',
    }}>
      <div style={{ maxWidth:560, margin:'0 auto' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
          <IconBtn size={40} tone="plain" label="Zurück"
            onClick={() => (step > 1 ? setStep(s => s - 1) : targetBed ? navigate(`/bed/${targetBed.id}`) : navigate(-1))}>‹</IconBtn>
          <div style={{ ...LABEL }}>
            Plan generieren{targetBed ? ` · ${targetBed.name}` : ''}
          </div>
        </div>

        <div style={{ background:T.paper, borderRadius:20, border:`1px solid ${T.border}`, boxShadow:'var(--shadow)', padding:mobile ? '22px 18px' : 34 }}>
          <div style={{ display:'flex', gap:6, marginBottom:24 }}>
            {[1, 2, 3].map(n => <div key={n} style={{ flex:1, height:4, borderRadius:2, background:n <= step ? T.green : T.border, transition:'background 0.3s' }} />)}
          </div>

          {step === 1 ? step1 : step === 2 ? step2 : step3}

          <div style={{ display:'flex', gap:8, marginTop:26 }}>
            {step > 1 && <Btn onClick={() => setStep(s => s - 1)}>← Zurück</Btn>}
            {step < 3 ? (
              <Btn variant="primary" full size="lg" onClick={() => setStep(s => s + 1)}
                disabled={step === 2 && picks.length === 0}>
                {step === 2 ? 'Plan generieren ✦' : 'Weiter →'}
              </Btn>
            ) : (
              <Btn variant="primary" full size="lg" loading={saving} disabled={!plan} onClick={accept}>
                {applyTo === 'new' ? 'Beet anlegen →' : 'In Beet übernehmen →'}
              </Btn>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
