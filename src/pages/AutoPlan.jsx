import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LABEL, MONO, T } from '../theme';
import { PLANTS, SEASONS, plantById } from '../data/plants';
import { FEEDERS, monthRangeLabel } from '../data/plantDetails';
import { GOALS, SKIP_REASONS, generatePlan } from '../utils/planGenerator';
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

/**
 * Says what happened to the plants the gardener picked that are not in the
 * plan. Leaving a choice out without a word reads as the app ignoring you,
 * which is exactly how the greedy packer used to come across.
 */
function SkippedNotice({ skipped, season, depthCm, onBack }) {
  if (!skipped?.length) return null;
  const seasonDe = SEASONS.find(x => x.id === season)?.de;
  const groups = [
    {
      reason: SKIP_REASONS.season,
      title: `Nicht in der ${seasonDe}-Saison`,
      hint: 'Diese Kulturen wachsen zu einer anderen Jahreszeit. Wechsle die Saison oder wähle sie ab.',
    },
    {
      reason: SKIP_REASONS.depth,
      title: 'Zu tief für dieses Beet',
      hint: `Eine Reihe braucht so viel Tiefe, wie die Pflanze Abstand braucht — dein Beet ist ${depthCm} cm tief.`,
    },
    {
      reason: SKIP_REASONS.space,
      title: 'Kein Platz mehr',
      hint: `Die ${depthCm} cm Beettiefe sind durch die übrigen Reihen belegt. Wähle etwas ab oder plane ein tieferes Beet.`,
    },
  ].map(g => ({ ...g, items: skipped.filter(s => s.reason === g.reason) })).filter(g => g.items.length);

  return (
    <div style={{ padding:14, borderRadius:14, background:T.warnBg, border:`1px solid ${T.warnBorder}`, marginBottom:14 }}>
      <div style={{ ...LABEL, color:T.warn, marginBottom:10 }}>
        {skipped.length} deiner Auswahl {skipped.length === 1 ? 'ist' : 'sind'} nicht im Plan
      </div>
      {groups.map(g => (
        <div key={g.reason} style={{ marginBottom:12 }}>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:6 }}>
            {g.items.map(({ plant }) => (
              <span key={plant.id} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'5px 10px', borderRadius:999, background:T.panel, border:`1px solid ${T.border}`, fontSize:12, fontWeight:600 }}>
                <span aria-hidden="true" style={{ width:14, height:14, borderRadius:7, background:`oklch(0.64 0.1 ${plant.hue})` }} />
                {plant.de}
                {g.reason === SKIP_REASONS.depth && (
                  <span style={{ ...MONO, fontSize:9.5, color:T.inkMute }}>{plant.spacing_cm} cm</span>
                )}
              </span>
            ))}
          </div>
          <div style={{ fontSize:11.5, color:T.inkDim, lineHeight:1.5 }}>
            <strong style={{ color:T.ink }}>{g.title}.</strong> {g.hint}
          </div>
        </div>
      ))}
      <Btn size="sm" onClick={onBack}>← Auswahl anpassen</Btn>
    </div>
  );
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
  const [touchedPicks, setTouchedPicks] = useState(false);

  const seasonPlants = useMemo(() => PLANTS.filter(p => p.seasons.includes(season)), [season]);

  const plan = useMemo(() => generatePlan({
    picks, widthCm:Number(dims.width) || 120, depthCm:Number(dims.depth) || 80,
    heightCm:Number(dims.height) || 80, season, goal,
  }), [picks, dims, season, goal]);

  const previewBed = useMemo(() => plan ? {
    cells:plan.cells, plantStatus:{}, bedWidth:Number(dims.width), bedDepth:Number(dims.depth),
  } : null, [plan, dims]);

  function presetFor(id) {
    const g = GOALS.find(x => x.id === id);
    return seasonPlants.filter(g.pick).slice(0, 7).map(p => p.id);
  }

  /**
   * A goal always changes the ranking, but it only refills the selection while
   * the gardener has not touched it. Silently replacing hand-picked plants is
   * the other way a choice appears to be "ignored".
   */
  function applyGoalPreset(id) {
    setGoal(id);
    if (touchedPicks) return;
    const auto = presetFor(id);
    if (auto.length >= 2) setPicks(auto);
  }

  function toggle(id) {
    setTouchedPicks(true);
    setPicks(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));
  }

  function accept() {
    if (!plan || !plan.rows.length) return;
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

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, marginBottom:8, flexWrap:'wrap' }}>
        <div style={LABEL}>Pflanzen · {picks.filter(id => seasonPlants.some(p => p.id === id)).length} in Saison</div>
        <div style={{ display:'flex', gap:10 }}>
          {touchedPicks && (
            <button onClick={() => { setPicks(presetFor(goal)); setTouchedPicks(false); }}
              style={{ background:'none', border:'none', color:T.green, cursor:'pointer', ...MONO, fontSize:10, minHeight:32, fontWeight:700 }}>
              Vorschlag zum Ziel
            </button>
          )}
          <button onClick={() => { setPicks([]); setTouchedPicks(true); }}
            style={{ background:'none', border:'none', color:T.inkMute, cursor:'pointer', ...MONO, fontSize:10, minHeight:32 }}>
            zurücksetzen
          </button>
        </div>
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

  const step3 = plan && plan.rows.length > 0 ? (
    <>
      <div style={LABEL}>Schritt 3 · Ergebnis</div>
      <h2 style={{ fontFamily:"'Fraunces',serif", fontSize:mobile ? 24 : 28, margin:'6px 0 14px', fontWeight:500, fontStyle:'italic', color:T.green }}>
        {GOALS.find(g => g.id === goal).title}
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

      <SkippedNotice skipped={plan.skipped} season={season} depthCm={Number(dims.depth)} onBack={() => setStep(2)} />
      <div style={{ fontSize:12, color:T.inkDim, lineHeight:1.6 }}>
        Hohe Pflanzen stehen hinten, damit sie die niedrigen nicht beschatten. Benachbarte Reihen sind auf gute Mischkultur geprüft.
      </div>
    </>
  ) : (
    <>
      <div style={LABEL}>Schritt 3 · Ergebnis</div>
      <h2 style={{ fontFamily:"'Fraunces',serif", fontSize:mobile ? 24 : 28, margin:'6px 0 14px', fontWeight:500 }}>
        Daraus wird noch <em style={{ color:T.terra, fontStyle:'italic' }}>kein Plan</em>
      </h2>
      <div style={{ ...card, marginBottom:14, fontSize:13, color:T.inkDim, lineHeight:1.6 }}>
        Keine deiner gewählten Pflanzen lässt sich in ein {dims.depth} cm tiefes
        {' '}{SEASONS.find(x => x.id === season)?.de}-Beet setzen.
      </div>
      <SkippedNotice skipped={plan?.skipped || []} season={season} depthCm={Number(dims.depth)} onBack={() => setStep(2)} />
    </>
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
              <Btn variant="primary" full size="lg" loading={saving} disabled={!plan || plan.rows.length === 0} onClick={accept}>
                {applyTo === 'new' ? 'Beet anlegen →' : 'In Beet übernehmen →'}
              </Btn>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
