import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { T } from '../theme';
import { SHAPES } from '../data/plants';
import { AuthModal } from '../components/AuthModal';

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

function saveBedLocally(bedId, data) {
  localStorage.setItem(`hb_bed_${bedId}`, JSON.stringify(data));
  const ids = JSON.parse(localStorage.getItem('hb_beds') || '[]');
  if (!ids.includes(bedId)) ids.push(bedId);
  localStorage.setItem('hb_beds', JSON.stringify(ids));
}

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const mobile = useBreakpoint();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('Mein Hochbeet');
  const [width, setWidth] = useState(120);
  const [depth, setDepth] = useState(80);
  const [shapeId, setShapeId] = useState('rect');
  const [sun, setSun] = useState('5-7');
  const [zone, setZone] = useState('zone7');
  const [saving, setSaving] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  async function finish() {
    setSaving(true);
    const bedId = genId();
    const now = new Date().toISOString();
    const bedData = { id:bedId, name, width:+width, depth:+depth, shapeId, sun, zone, cells:{}, customMask:{}, season:'summer', notes:'', createdAt:now, updatedAt:now };
    saveBedLocally(bedId, bedData);
    if (user && db) {
      try {
        await setDoc(doc(db,'users',user.uid,'beds',bedId), { ...bedData, createdAt:serverTimestamp(), updatedAt:serverTimestamp() });
      } catch {}
    }
    navigate(`/bed/${bedId}`);
  }

  const label = (text) => (
    <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:10, textTransform:'uppercase', letterSpacing:'0.1em', color:T.inkMute, marginBottom:8 }}>{text}</div>
  );

  const input = (props) => (
    <input {...props} style={{ width:'100%', padding:14, background:'#fff', border:`1px solid ${T.border}`, color:T.ink, borderRadius:12, fontSize:14, fontFamily:'inherit', outline:'none', ...props.style }} />
  );

  const stepContent = () => {
    if (step === 1) return (
      <div>
        {label('Schritt 1/3')}
        <h2 style={{ fontFamily:'Fraunces,serif', fontSize:30, margin:'0 0 8px', fontWeight:500 }}>Wie heißt dein Beet?</h2>
        <p style={{ fontSize:13, color:T.inkDim, marginBottom:24 }}>Du kannst das später jederzeit ändern.</p>
        {input({ value:name, onChange:e=>setName(e.target.value), placeholder:'Mein Hochbeet', style:{marginBottom:16} })}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <div>
            {label('Breite (cm)')}
            {input({ type:'number', value:width, onChange:e=>setWidth(e.target.value), style:{fontFamily:'JetBrains Mono,monospace'} })}
          </div>
          <div>
            {label('Tiefe (cm)')}
            {input({ type:'number', value:depth, onChange:e=>setDepth(e.target.value), style:{fontFamily:'JetBrains Mono,monospace'} })}
          </div>
        </div>
      </div>
    );
    if (step === 2) return (
      <div>
        {label('Schritt 2/3')}
        <h2 style={{ fontFamily:'Fraunces,serif', fontSize:30, margin:'0 0 8px', fontWeight:500 }}>Welche <em style={{ color:T.green }}>Form</em>?</h2>
        <p style={{ fontSize:13, color:T.inkDim, marginBottom:24 }}>Du kannst auch frei zeichnen.</p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          {Object.values(SHAPES).map(s => (
            <button key={s.id} onClick={() => setShapeId(s.id)} style={{ padding:'22px 12px', flexDirection:'column', display:'flex', gap:14, cursor:'pointer', alignItems:'center', background:shapeId===s.id?'rgba(107,142,78,0.08)':T.panel, border:`${shapeId===s.id?2:1}px solid ${shapeId===s.id?T.green:T.border}`, borderRadius:18, transition:'all 0.15s' }}>
              <div style={{ width:52, height:36, background:T.green, borderRadius:s.id==='freeform'?'40% 60% 50% 50%':6, opacity:shapeId===s.id?1:0.6, transition:'opacity 0.15s' }} />
              <div style={{ fontSize:13, fontWeight:600, color:shapeId===s.id?T.green:T.ink }}>{s.de}</div>
            </button>
          ))}
        </div>
      </div>
    );
    return (
      <div>
        {label('Schritt 3/3')}
        <h2 style={{ fontFamily:'Fraunces,serif', fontSize:30, margin:'0 0 8px', fontWeight:500 }}>Standort &amp; <em style={{ color:T.green }}>Sonne</em>.</h2>
        <p style={{ fontSize:13, color:T.inkDim, marginBottom:24 }}>Wir nutzen das für bessere Vorschläge.</p>
        <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:18, padding:18, marginBottom:12 }}>
          {label('Sonnenstunden / Tag')}
          <div style={{ display:'flex', gap:6 }}>
            {['<3','3-5','5-7','7+'].map(s => (
              <button key={s} onClick={() => setSun(s)} style={{ flex:1, padding:'10px 4px', border:'none', borderRadius:999, background:sun===s?T.ochre:'#fff', color:sun===s?'#fff':T.ink, cursor:'pointer', fontWeight:600, fontSize:13, fontFamily:'inherit', transition:'all 0.15s' }}>{s}h</button>
            ))}
          </div>
        </div>
        <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:18, padding:18 }}>
          {label('Klimazone')}
          <select value={zone} onChange={e=>setZone(e.target.value)} style={{ width:'100%', padding:12, background:'#fff', border:`1px solid ${T.border}`, color:T.ink, borderRadius:10, fontSize:13, fontFamily:'inherit' }}>
            <option value="zone7">Mitteleuropa · Zone 7</option>
            <option value="zone8">Süddeutschland · Zone 8</option>
            <option value="zone6">Norddeutschland · Zone 6</option>
            <option value="zone9">Österreich Tiefland · Zone 9</option>
            <option value="zone5">Alpen · Zone 5–6</option>
          </select>
        </div>
      </div>
    );
  };

  const hero = (
    <div style={{ flex:mobile?'0 0 160px':1, background:`linear-gradient(170deg,${T.green} 0%,#1F2A1B 100%)`, display:'flex', flexDirection:'column', justifyContent:'space-between', padding:mobile?'24px 24px 20px':36, color:'#fff', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', inset:0, opacity:0.06, background:'radial-gradient(circle at 30% 20%,#fff 1px,transparent 2px),radial-gradient(circle at 70% 80%,#fff 1px,transparent 2px)', backgroundSize:'20px 20px,30px 30px' }} />
      <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:11, opacity:0.7, position:'relative' }}>HOCHBEETPLANER · 2026</div>
      <div style={{ position:'relative' }}>
        <div style={{ fontFamily:'Fraunces,serif', fontSize:mobile?48:88, lineHeight:0.95, marginBottom:mobile?10:18, fontWeight:500 }}>
          Plane<br/>dein <em style={{ color:T.ochre, fontStyle:'italic' }}>Hochbeet</em>.
        </div>
        {!mobile && <div style={{ fontSize:15, opacity:0.8, maxWidth:420, lineHeight:1.6 }}>Visuell. Saisonal. Mit smarten Vorschlägen für gute Nachbarn — und Warnungen vor schlechten.</div>}
      </div>
      {!mobile && <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:10, opacity:0.5 }}>Cultivated with care</div>}
    </div>
  );

  const form = (
    <div style={{ width:mobile?undefined:440, padding:mobile?0:44, display:'flex', flexDirection:'column', background:T.paper, borderLeft:mobile?'none':`1px solid ${T.border}`, flex:mobile?1:undefined, overflowY:mobile?'hidden':'auto' }}>
      <div style={{ flex:1, overflowY:mobile?'auto':'visible', padding:mobile?'24px 20px 12px':0 }}>
        <div style={{ display:'flex', gap:6, marginBottom:32 }}>
          {[1,2,3].map(n => <div key={n} style={{ flex:1, height:4, borderRadius:2, background:n<=step?T.green:'rgba(31,42,27,0.1)', transition:'background 0.3s' }} />)}
        </div>
        {stepContent()}
      </div>
      <div style={{ padding:mobile?'12px 20px 24px':undefined, borderTop:mobile?`1px solid ${T.border}`:undefined, marginTop:mobile?0:24 }}>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => setStep(s=>s-1)} disabled={step===1} style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'9px 16px', borderRadius:999, background:T.panel, color:T.ink, border:`1px solid ${T.border}`, cursor:step===1?'default':'pointer', fontSize:13, fontWeight:500, opacity:step===1?0.4:1, fontFamily:'inherit' }}>← Zurück</button>
          <button onClick={step===3?finish:()=>setStep(s=>s+1)} disabled={saving} style={{ flex:1, display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8, padding:'9px 16px', borderRadius:999, background:T.green, color:'#fff', border:'none', cursor:'pointer', fontSize:13, fontWeight:500, fontFamily:'inherit', opacity:saving?0.6:1 }}>
            {saving?'Speichern…':step===3?'Beet erstellen ✦':'Weiter →'}
          </button>
        </div>
        {!user && step===3 && (
          <div style={{ marginTop:16, textAlign:'center' }}>
            <button onClick={() => setShowAuth(true)} style={{ background:'none', border:'none', color:T.green, cursor:'pointer', fontSize:12, fontFamily:'inherit', textDecoration:'underline' }}>
              Anmelden um zu speichern
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div style={{ height:'100dvh', display:'flex', flexDirection:mobile?'column':'row', background:T.bg }}>
        {hero}
        {form}
      </div>
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </>
  );
}
