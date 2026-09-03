import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useBeds } from '../hooks/useBeds';
import { createBed, currentSeason } from '../lib/beds';
import { LABEL, MONO, T } from '../theme';
import { AuthModal } from '../components/AuthModal';
import { Btn } from '../components/Btn';
import { LogoFull, LogoMark } from '../components/Logo';

/** Common German raised-bed formats, so most people never touch the numbers. */
const PRESETS = [
  { id:'classic', de:'Klassisch',  w:120, d:80,  h:80, note:'Der Standard aus dem Baumarkt' },
  { id:'balcony', de:'Balkon',     w:100, d:40,  h:75, note:'Schmal für Balkon & Terrasse' },
  { id:'long',    de:'Groß',       w:200, d:75,  h:85, note:'Viel Platz für Mischkultur' },
  { id:'square',  de:'Quadrat',    w:100, d:100, h:80, note:'Von allen Seiten erreichbar' },
];

const field = {
  width:'100%', padding:'14px', borderRadius:12,
  border:`1px solid ${T.border}`, background:T.panel, color:T.ink,
  outline:'none', minHeight:50,
};

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const mobile = useBreakpoint();
  const beds = useBeds();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('Mein Hochbeet');
  const [preset, setPreset] = useState('classic');
  const [dims, setDims] = useState({ width:120, depth:80, height:80 });
  const [sun, setSun] = useState('5-7');
  const [zone, setZone] = useState('zone7');
  const [showAuth, setShowAuth] = useState(false);
  const [saving, setSaving] = useState(false);

  function choosePreset(p) {
    setPreset(p.id);
    setDims({ width:p.w, depth:p.d, height:p.h });
  }

  function finish(then = 'planner') {
    setSaving(true);
    const bed = createBed({
      name: name.trim() || 'Mein Hochbeet',
      width: Math.max(20, Number(dims.width) || 120),
      depth: Math.max(20, Number(dims.depth) || 80),
      height: Math.max(10, Number(dims.height) || 80),
      sun, zone, season: currentSeason(),
    });
    navigate(then === 'autoplan' ? `/autoplan?bed=${bed.id}` : `/bed/${bed.id}`);
  }

  const area = ((Number(dims.width) * Number(dims.depth)) / 10000).toFixed(2);

  const step1 = (
    <>
      <div style={LABEL}>Schritt 1 von 2</div>
      <h2 style={{ fontFamily:"'Fraunces',serif", fontSize:mobile ? 26 : 30, margin:'6px 0 6px', fontWeight:500 }}>
        Wie groß ist dein <em style={{ color:T.green, fontStyle:'italic' }}>Beet</em>?
      </h2>
      <p style={{ fontSize:13, color:T.inkDim, marginBottom:18, lineHeight:1.6 }}>
        Wähle ein Standardmaß oder gib deine eigenen Zahlen ein. Änderbar ist das jederzeit.
      </p>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:16 }}>
        {PRESETS.map(p => {
          const on = preset === p.id;
          return (
            <button key={p.id} onClick={() => choosePreset(p)} aria-pressed={on}
              style={{
                padding:'14px 12px', textAlign:'left', borderRadius:16, cursor:'pointer', fontFamily:'inherit',
                background:on ? T.goodBg : T.panel, color:T.ink,
                border:`${on ? 2 : 1}px solid ${on ? T.green : T.border}`,
              }}>
              <div style={{ fontFamily:"'Fraunces',serif", fontSize:15, fontWeight:600, color:on ? T.green : T.ink }}>{p.de}</div>
              <div style={{ ...MONO, fontSize:11, color:T.inkDim, marginTop:3 }}>{p.w} × {p.d} cm</div>
              <div style={{ fontSize:10.5, color:T.inkMute, marginTop:3, lineHeight:1.4 }}>{p.note}</div>
            </button>
          );
        })}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:12 }}>
        {[['width','Breite'], ['depth','Tiefe'], ['height','Höhe']].map(([k, l]) => (
          <div key={k}>
            <div style={{ ...LABEL, marginBottom:6 }}>{l} (cm)</div>
            <input type="number" inputMode="numeric" value={dims[k]} aria-label={`${l} in Zentimetern`}
              onChange={e => { setDims(d => ({ ...d, [k]:e.target.value })); setPreset('custom'); }}
              style={{ ...field, ...MONO }} />
          </div>
        ))}
      </div>
      <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:12, padding:'12px 16px', ...MONO, fontSize:12.5, color:T.inkDim, textAlign:'center', marginBottom:16 }}>
        {area} m² Anbaufläche
      </div>

      <div style={{ ...LABEL, marginBottom:6 }}>Name</div>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Mein Hochbeet" aria-label="Beetname" style={field} />
    </>
  );

  const step2 = (
    <>
      <div style={LABEL}>Schritt 2 von 2</div>
      <h2 style={{ fontFamily:"'Fraunces',serif", fontSize:mobile ? 26 : 30, margin:'6px 0 6px', fontWeight:500 }}>
        Standort &amp; <em style={{ color:T.green, fontStyle:'italic' }}>Sonne</em>
      </h2>
      <p style={{ fontSize:13, color:T.inkDim, marginBottom:18, lineHeight:1.6 }}>
        Danach richten sich die Pflanzenvorschläge und die Frostwarnungen.
      </p>

      <div style={{ ...LABEL, marginBottom:8 }}>Sonnenstunden pro Tag</div>
      <div style={{ display:'flex', gap:6, marginBottom:18 }}>
        {['<3', '3-5', '5-7', '7+'].map(s => (
          <button key={s} onClick={() => setSun(s)} aria-pressed={sun === s}
            style={{ flex:1, minHeight:50, borderRadius:14, cursor:'pointer', fontWeight:700, fontFamily:'inherit', fontSize:14,
              background:sun === s ? T.ochre : T.panel, color:sun === s ? 'var(--panel)' : T.ink,
              border:`1px solid ${sun === s ? 'transparent' : T.border}` }}>{s} h</button>
        ))}
      </div>

      <div style={{ ...LABEL, marginBottom:8 }}>Klimazone</div>
      <select value={zone} onChange={e => setZone(e.target.value)} style={field} aria-label="Klimazone">
        <option value="zone7">Mitteleuropa · Zone 7</option>
        <option value="zone8">Süddeutschland · Zone 8</option>
        <option value="zone6">Norddeutschland · Zone 6</option>
        <option value="zone9">Österreich Tiefland · Zone 9</option>
        <option value="zone5">Alpen · Zone 5–6</option>
      </select>

      <div style={{ marginTop:20, display:'flex', flexDirection:'column', gap:8 }}>
        <Btn variant="primary" size="lg" full loading={saving} onClick={() => finish('planner')}>Beet anlegen &amp; planen</Btn>
        <Btn size="lg" full disabled={saving} onClick={() => finish('autoplan')}>✦ Beet anlegen &amp; Vorschlag generieren</Btn>
      </div>
    </>
  );

  const hero = (
    <div style={{
      flex:1, background:`linear-gradient(170deg, ${T.green} 0%, #1F2A1B 100%)`, color:'#fff',
      display:'flex', flexDirection:'column', justifyContent:'space-between',
      padding:mobile ? `calc(20px + var(--safe-t)) 22px 18px` : 40,
      position:'relative', overflow:'hidden', minHeight:mobile ? 150 : undefined,
    }}>
      <div aria-hidden="true" style={{ position:'absolute', inset:0, opacity:0.07, background:'radial-gradient(circle at 30% 20%,#fff 1px,transparent 2px),radial-gradient(circle at 70% 80%,#fff 1px,transparent 2px)', backgroundSize:'20px 20px,30px 30px' }} />
      <div style={{ display:'flex', alignItems:'center', gap:10, position:'relative' }}>
        <LogoMark size={mobile ? 38 : 46} />
        <span style={{ ...MONO, fontSize:10.5, opacity:0.75, letterSpacing:'0.12em' }}>HOCHBEET-PLANER</span>
      </div>
      <div style={{ position:'relative' }}>
        <div style={{ fontFamily:"'Fraunces',serif", fontSize:mobile ? 40 : 80, lineHeight:0.98, marginBottom:mobile ? 6 : 16, fontWeight:500 }}>
          Plane<br />dein <em style={{ color:T.ochre, fontStyle:'italic' }}>Hochbeet</em>.
        </div>
        {!mobile && (
          <div style={{ fontSize:15, opacity:0.85, maxWidth:420, lineHeight:1.6 }}>
            Maßstabsgetreu planen, gute Nachbarn finden, Aufgaben automatisch bekommen — vom Handy aus, auch offline.
          </div>
        )}
      </div>
      {beds.length > 0 && (
        <button onClick={() => navigate('/dashboard')}
          style={{ position:'relative', alignSelf:'flex-start', background:'rgba(255,255,255,0.16)', border:'none', color:'#fff', borderRadius:999, padding:'10px 18px', fontSize:12.5, fontWeight:600, cursor:'pointer', fontFamily:'inherit', minHeight:44 }}>
          ← Zurück zu meinen Beeten
        </button>
      )}
    </div>
  );

  const form = (
    <div style={{
      width:mobile ? undefined : 460, flex:mobile ? 1 : undefined,
      padding:mobile ? '22px 18px calc(28px + var(--safe-b))' : 44,
      display:'flex', flexDirection:'column', background:T.paper,
      borderLeft:mobile ? 'none' : `1px solid ${T.border}`, overflowY:'auto',
    }}>
      {!mobile && (
        <div style={{ display:'flex', justifyContent:'center', marginBottom:26 }}>
          <LogoFull width={190} />
        </div>
      )}
      <div style={{ display:'flex', gap:6, marginBottom:24 }}>
        {[1, 2].map(n => <div key={n} style={{ flex:1, height:4, borderRadius:2, background:n <= step ? T.green : T.border, transition:'background 0.3s' }} />)}
      </div>

      {step === 1 ? step1 : step2}

      <div style={{ flex:1, minHeight:18 }} />

      {step === 1 && (
        <div style={{ display:'flex', gap:8, marginTop:22 }}>
          <Btn variant="primary" size="lg" full onClick={() => setStep(2)}>Weiter →</Btn>
        </div>
      )}
      {step === 2 && (
        <div style={{ marginTop:14 }}>
          <Btn variant="quiet" full onClick={() => setStep(1)}>← Zurück</Btn>
        </div>
      )}

      {!user && (
        <div style={{ marginTop:16, textAlign:'center' }}>
          <button onClick={() => setShowAuth(true)}
            style={{ background:'none', border:'none', color:T.green, cursor:'pointer', fontSize:12.5, fontFamily:'inherit', textDecoration:'underline', minHeight:44, padding:'0 8px' }}>
            Anmelden, um auf allen Geräten zu synchronisieren
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      <div style={{ minHeight:'100vh', display:'flex', flexDirection:mobile ? 'column' : 'row', background:T.bg }}>
        {hero}
        {form}
      </div>
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </>
  );
}
