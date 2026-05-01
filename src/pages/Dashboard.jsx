import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useWeather } from '../hooks/useWeather';
import { T } from '../theme';
import { plantById, SHAPES } from '../data/plants';
import { TabBar } from '../components/TabBar';
import { AuthModal } from '../components/AuthModal';
import { Btn, TrashIcon } from '../components/Btn';

const MONTH_NAMES = ['JAN','FEB','MÄR','APR','MAI','JUN','JUL','AUG','SEP','OKT','NOV','DEZ'];
const TASKS = [
  { day:'MO', task:'Tomaten ausgeizen', bed:'Mein Hochbeet' },
  { day:'MI', task:'Bewässern (alle Beete)', bed:'' },
  { day:'FR', task:'Salat ernten', bed:'Kräuterbeet' },
  { day:'SO', task:'Mulchen', bed:'Eckbeet Süd' },
];
const TIMELINE = [
  { plant:'carrot',  start:2, end:9  },
  { plant:'tomato',  start:4, end:9  },
  { plant:'lettuce', start:2, end:5  },
  { plant:'basil',   start:4, end:8  },
  { plant:'spinach', start:8, end:11 },
];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Guten Morgen' : h < 17 ? 'Guten Tag' : 'Guten Abend';
}

function loadLocalBeds() {
  const ids = JSON.parse(localStorage.getItem('hb_beds') || '[]');
  return ids.map(id => {
    try { return JSON.parse(localStorage.getItem(`hb_bed_${id}`) || 'null'); } catch { return null; }
  }).filter(Boolean);
}

function MiniGrid({ cells, plants, filled, total }) {
  const filledCount = Object.keys(cells || {}).length || filled || 0;
  const pIds = plants || Object.values(cells || {}).slice(0,5);
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(8,1fr)', gap:2, padding:8, background:T.bg, borderRadius:10 }}>
      {Array.from({length:24}).map((_,k) => {
        const pid = k < filledCount ? pIds[k % Math.max(pIds.length,1)] : null;
        const p = pid ? plantById(pid) : null;
        return <div key={k} style={{ aspectRatio:'1', background:p?`oklch(0.62 0.1 ${p.hue})`:'rgba(31,42,27,0.06)', borderRadius:3 }} />;
      })}
    </div>
  );
}

function resolveCells(bed) {
  if (bed.seasonCells) {
    const sc = bed.seasonCells;
    return sc.summer || sc.spring || sc.autumn || sc.winter || sc[Object.keys(sc)[0]] || {};
  }
  return bed.cells || {};
}

function calcFillPct(bed) {
  const cells = resolveCells(bed);
  const filled = Object.keys(cells).length;
  const shape = SHAPES[bed.shapeId] || SHAPES.rect;
  let totalCells = 0;
  if (shape.id === 'freeform') {
    totalCells = Object.keys(bed.customMask || {}).length;
  } else {
    for (let y = 0; y < shape.h; y++)
      for (let x = 0; x < shape.w; x++)
        if (shape.mask(x, y)) totalCells++;
  }
  return totalCells ? Math.round(filled / totalCells * 100) : 0;
}

function BedCard({ bed, onClick, desktop, onDelete }) {
  const cells = resolveCells(bed);
  const filled = Object.keys(cells).length;
  const pIds = [...new Set(Object.values(cells))].slice(0,5);
  const pct = calcFillPct(bed);
  const [confirm, setConfirm] = useState(false);

  function handleDelete(e) {
    e.stopPropagation();
    if (confirm) { onDelete(bed.id); } else { setConfirm(true); }
  }

  return (
    <div onClick={onClick} style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:18, padding:20, cursor:'pointer', transition:'transform 0.15s', boxShadow:'0 1px 0 rgba(31,42,27,0.04),0 8px 24px -16px rgba(31,42,27,0.18)', position:'relative' }}
      onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'}
      onMouseLeave={e=>{ e.currentTarget.style.transform=''; setConfirm(false); }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
        <div>
          <h3 style={{ fontFamily:'Fraunces,serif', fontSize:desktop?20:18, margin:0, fontWeight:500 }}>{bed.name}</h3>
          <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:10, color:T.inkMute, marginTop:2 }}>
            {bed.shapeId||'Rechteck'} · {bed.width||120}×{bed.depth||80} cm
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <button onClick={handleDelete} title="Beet löschen"
            style={{ padding:confirm?'4px 10px':'4px 8px', borderRadius:8, border:`1px solid ${confirm?'rgba(201,84,58,0.5)':T.border}`, background:confirm?'rgba(201,84,58,0.08)':'transparent', color:confirm?T.bad:T.inkMute, fontFamily:'JetBrains Mono,monospace', fontSize:confirm?11:13, cursor:'pointer', transition:'all 0.15s', lineHeight:1, flexShrink:0 }}>
            {confirm ? 'Löschen?' : <TrashIcon size={14} />}
          </button>
          <div style={{ width:38, height:38, borderRadius:19, background:T.green, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'JetBrains Mono,monospace', fontSize:11, fontWeight:600, flexShrink:0 }}>{pct}%</div>
        </div>
      </div>
      <MiniGrid cells={cells} filled={filled} />
      <div style={{ display:'flex', marginTop:12 }}>
        {pIds.slice(0,5).map((pid,k) => {
          const p = plantById(pid);
          return p ? <div key={k} style={{ width:24, height:24, borderRadius:12, background:`oklch(0.62 0.1 ${p.hue})`, border:`2px solid ${T.panel}`, marginLeft:k>0?-8:0, fontFamily:'Fraunces,serif', fontStyle:'italic', color:'#fff', fontSize:12, display:'flex', alignItems:'center', justifyContent:'center' }}>{p.glyph[0]}</div> : null;
        })}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const mobile = useBreakpoint();
  const weather = useWeather();
  const [beds, setBeds] = useState([]);
  const [showAuth, setShowAuth] = useState(false);
  const currentMonth = new Date().getMonth();

  const dateStr = new Intl.DateTimeFormat('de-DE', { weekday:'short', day:'2-digit', month:'long' }).format(new Date());

  useEffect(() => {
    const local = loadLocalBeds();
    setBeds(local);
    if (user && db) {
      getDocs(collection(db,'users',user.uid,'beds')).then(snap => {
        const remote = snap.docs.map(d=>({id:d.id,...d.data()}));
        const merged = [...local];
        remote.forEach(r => { if (!merged.find(b=>b.id===r.id)) merged.push(r); });
        setBeds(merged);
      }).catch(()=>{});
    }
  }, [user]);

  function deleteBed(bedId) {
    localStorage.removeItem(`hb_bed_${bedId}`);
    const ids = JSON.parse(localStorage.getItem('hb_beds') || '[]');
    localStorage.setItem('hb_beds', JSON.stringify(ids.filter(id => id !== bedId)));
    if (user && db) deleteDoc(doc(db, 'users', user.uid, 'beds', bedId)).catch(() => {});
    setBeds(b => b.filter(x => x.id !== bedId));
  }

  const weatherStr = weather.error ? '' : weather.loading ? '…' : `${weather.temp}° ${weather.description}`;

  if (mobile) return (
    <div style={{ height:'100%', background:T.bg, paddingTop:56, paddingBottom:100, overflow:'auto', position:'relative' }}>
      <div style={{ padding:'8px 20px 16px' }}>
        <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:10, textTransform:'uppercase', letterSpacing:'0.1em', color:T.inkMute, marginBottom:4 }}>{dateStr}{weatherStr?` · ${weatherStr}`:''}</div>
        <h1 style={{ fontFamily:'Fraunces,serif', fontSize:30, margin:0, fontWeight:500, lineHeight:1.1 }}>{greeting()},<br/><em style={{ color:T.green, fontStyle:'italic' }}>{user?.displayName || 'Gärtner'}</em>.</h1>
      </div>

      {beds[0] && (
        <div style={{ padding:'0 16px 16px' }}>
          <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:18, padding:18, boxShadow:'0 1px 0 rgba(31,42,27,0.04),0 8px 24px -16px rgba(31,42,27,0.18)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
              <div>
                <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:10, textTransform:'uppercase', letterSpacing:'0.1em', color:T.inkMute }}>Aktiv · Active</div>
                <h3 style={{ fontFamily:'Fraunces,serif', fontSize:22, margin:'4px 0 0', fontWeight:500 }}>{beds[0].name}</h3>
                <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:10, color:T.inkMute, marginTop:2 }}>{beds[0].width||120} × {beds[0].depth||80} cm</div>
              </div>
              <div style={{ width:44, height:44, borderRadius:22, background:T.green, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'JetBrains Mono,monospace', fontSize:12, fontWeight:600 }}>{calcFillPct(beds[0])}%</div>
            </div>
            <MiniGrid cells={resolveCells(beds[0])} />
            <button onClick={()=>navigate(`/bed/${beds[0].id}`)} style={{ width:'100%', marginTop:12, padding:'10px 16px', borderRadius:999, background:T.green, color:'#fff', border:'none', cursor:'pointer', fontSize:13, fontWeight:600, fontFamily:'inherit' }}>Beet öffnen →</button>
          </div>
        </div>
      )}

      <div style={{ padding:'0 20px 8px' }}><div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:10, textTransform:'uppercase', letterSpacing:'0.1em', color:T.inkMute }}>Diese Woche</div></div>
      <div style={{ padding:'0 16px 16px', display:'flex', flexDirection:'column', gap:8 }}>
        {TASKS.map((t,i) => (
          <div key={i} style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:14, padding:'12px 14px', display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:9, color:T.terra, fontWeight:600, width:24 }}>{t.day}</div>
            <div style={{ flex:1, fontSize:13, fontWeight:500 }}>{t.task}</div>
            {t.bed && <div style={{ fontSize:10, color:T.inkMute }}>{t.bed}</div>}
          </div>
        ))}
      </div>

      <div style={{ padding:'8px 20px' }}><div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:10, textTransform:'uppercase', letterSpacing:'0.1em', color:T.inkMute }}>Beete · {beds.length}</div></div>
      <div style={{ padding:'0 16px 8px', display:'flex', gap:10, overflowX:'auto' }}>
        {beds.map((bed,i) => (
          <div key={i} onClick={()=>navigate(`/bed/${bed.id}`)} style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:14, padding:14, minWidth:140, flexShrink:0, cursor:'pointer' }}>
            <div style={{ fontFamily:'Fraunces,serif', fontSize:15, fontWeight:500, marginBottom:6 }}>{bed.name}</div>
            <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:10, color:T.green, fontWeight:600 }}>{calcFillPct(bed)}% belegt</div>
          </div>
        ))}
        <div onClick={()=>navigate('/onboarding')} style={{ background:'transparent', border:`1.5px dashed ${T.borderHi}`, borderRadius:14, padding:14, minWidth:120, flexShrink:0, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ fontSize:13, color:T.inkMute, fontWeight:500 }}>+ Neu</div>
        </div>
      </div>
      <TabBar active="home" />
    </div>
  );

  // Desktop
  return (
    <>
      <div style={{ minHeight:'100vh', background:T.bg, padding:32, overflow:'auto' }}>
        <div style={{ maxWidth:1280, margin:'0 auto' }}>
          <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:28 }}>
            <div>
              <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:10, textTransform:'uppercase', letterSpacing:'0.1em', color:T.inkMute }}>{dateStr}{weatherStr?` · ${weatherStr}`:''}</div>
              <h1 style={{ fontFamily:'Fraunces,serif', fontSize:48, margin:'6px 0 0', fontWeight:500 }}>{greeting()}, <em style={{ color:T.green, fontStyle:'italic' }}>{user?.displayName || 'Gärtner'}</em>.</h1>
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              {user ? (
                <Btn onClick={logout} variant="ghost" style={{ fontSize:12 }}>Abmelden</Btn>
              ) : (
                <Btn onClick={()=>setShowAuth(true)} variant="ghost">Anmelden</Btn>
              )}
              <Btn onClick={()=>navigate('/onboarding')} variant="default">+ Neues Beet</Btn>
              <Btn onClick={()=>navigate('/autoplan')} variant="primary">✦ Plan generieren</Btn>
            </div>
          </div>

          {/* Seasonal timeline */}
          <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:18, padding:22, marginBottom:22, boxShadow:'0 1px 0 rgba(31,42,27,0.04),0 8px 24px -16px rgba(31,42,27,0.18)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
              <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:10, textTransform:'uppercase', letterSpacing:'0.1em', color:T.inkMute }}>Saisonkalender · Seasonal timeline</div>
              <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:11, color:T.terra }}>● Heute · {MONTH_NAMES[currentMonth]}</div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(12,1fr)', gap:4, marginBottom:8 }}>
              {MONTH_NAMES.map((m,i) => (
                <div key={m}>
                  <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:9, color:i===currentMonth?T.terra:T.inkMute, textAlign:'center', marginBottom:4, fontWeight:i===currentMonth?600:400 }}>{m}</div>
                  <div style={{ height:3, background:i===currentMonth?T.terra:'rgba(31,42,27,0.1)', borderRadius:2 }} />
                </div>
              ))}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(12,1fr)', gap:4, marginTop:14 }}>
              {TIMELINE.map((row,i) => (
                Array.from({length:12}).map((_,m) => {
                  const active = m>=row.start && m<=row.end;
                  const p = plantById(row.plant);
                  return <div key={`${i}-${m}`} style={{ height:22, background:active?`oklch(0.62 0.1 ${p.hue})`:'transparent', borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, color:'#fff', fontWeight:600 }}>{active&&m===row.start?p.de:''}</div>;
                })
              ))}
            </div>
          </div>

          {/* Beds grid */}
          <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:10, textTransform:'uppercase', letterSpacing:'0.1em', color:T.inkMute, marginBottom:12 }}>Meine Beete · {beds.length}</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))', gap:16, marginBottom:28 }}>
            {beds.map(bed => <BedCard key={bed.id} bed={bed} onClick={()=>navigate(`/bed/${bed.id}`)} desktop onDelete={deleteBed} />)}
            <div onClick={()=>navigate('/onboarding')} style={{ background:'transparent', border:`1.5px dashed ${T.borderHi}`, borderRadius:18, padding:20, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', minHeight:160, color:T.inkMute, fontSize:13, fontWeight:500, gap:8, transition:'border-color 0.15s' }}
              onMouseEnter={e=>e.currentTarget.style.borderColor=T.green}
              onMouseLeave={e=>e.currentTarget.style.borderColor=T.borderHi}>
              + Neues Beet anlegen
            </div>
          </div>

          {/* Weekly tasks */}
          <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:10, textTransform:'uppercase', letterSpacing:'0.1em', color:T.inkMute, marginBottom:12 }}>Diese Woche · This week</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
            {TASKS.map((t,i) => (
              <div key={i} style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:14, padding:16, boxShadow:'0 1px 0 rgba(31,42,27,0.04)' }}>
                <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:10, color:T.terra, marginBottom:6, fontWeight:600 }}>{t.day}</div>
                <div style={{ fontSize:13, fontWeight:500 }}>{t.task}</div>
                {t.bed && <div style={{ fontSize:11, color:T.inkMute, marginTop:2 }}>{t.bed}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
      {showAuth && <AuthModal onClose={()=>setShowAuth(false)} />}
    </>
  );
}
