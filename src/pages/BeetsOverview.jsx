import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { T } from '../theme';
import { plantById, SHAPES } from '../data/plants';
import { TabBar } from '../components/TabBar';
import { Btn, TrashIcon } from '../components/Btn';

function loadLocalBeds() {
  const ids = JSON.parse(localStorage.getItem('hb_beds') || '[]');
  return ids.map(id => {
    try { return JSON.parse(localStorage.getItem(`hb_bed_${id}`) || 'null'); } catch { return null; }
  }).filter(Boolean);
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

function MiniGrid({ bed }) {
  const cells = resolveCells(bed);
  const shape = SHAPES[bed.shapeId] || SHAPES.rect;
  const maskFn = shape.id === 'freeform'
    ? (x, y) => !!( bed.customMask || {} )[`${x},${y}`]
    : shape.mask;
  const gridCells = [];
  for (let y = 0; y < shape.h; y++)
    for (let x = 0; x < shape.w; x++)
      gridCells.push({ x, y, valid: maskFn(x, y), pid: cells[`${x},${y}`] || null });
  return (
    <div style={{ display:'grid', gridTemplateColumns:`repeat(${shape.w},1fr)`, gap:2, padding:8, background:T.bg, borderRadius:10 }}>
      {gridCells.map(({ x, y, valid, pid }) => {
        const p = pid ? plantById(pid) : null;
        return <div key={`${x},${y}`} style={{ aspectRatio:'1', background:!valid?'transparent':p?`oklch(0.62 0.1 ${p.hue})`:'rgba(31,42,27,0.06)', borderRadius:3 }} />;
      })}
    </div>
  );
}

function BedCard({ bed, onClick, desktop, onDelete }) {
  const cells = resolveCells(bed);
  const pIds = [...new Set(Object.values(cells))].slice(0, 5);
  const pct = calcFillPct(bed);
  const [confirm, setConfirm] = useState(false);

  function handleDelete(e) {
    e.stopPropagation();
    if (confirm) { onDelete(bed.id); } else { setConfirm(true); }
  }

  return (
    <div onClick={onClick} style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:18, padding:20, cursor:'pointer', transition:'transform 0.15s', boxShadow:'0 1px 0 rgba(31,42,27,0.04),0 8px 24px -16px rgba(31,42,27,0.18)', position:'relative' }}
      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; setConfirm(false); }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
        <div>
          <h3 style={{ fontFamily:'Fraunces,serif', fontSize:desktop ? 20 : 18, margin:0, fontWeight:500 }}>{bed.name}</h3>
          <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:10, color:T.inkMute, marginTop:2 }}>
            {bed.shapeId || 'Rechteck'} · {bed.width || 120}×{bed.depth || 80} cm
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <button onClick={handleDelete} title="Beet löschen"
            style={{ padding:confirm ? '4px 10px' : '4px 8px', borderRadius:8, border:`1px solid ${confirm ? 'rgba(201,84,58,0.5)' : T.border}`, background:confirm ? 'rgba(201,84,58,0.08)' : 'transparent', color:confirm ? T.bad : T.inkMute, fontFamily:'JetBrains Mono,monospace', fontSize:confirm ? 11 : 13, cursor:'pointer', transition:'all 0.15s', lineHeight:1, flexShrink:0 }}>
            {confirm ? 'Löschen?' : <TrashIcon size={14} />}
          </button>
          <div style={{ width:38, height:38, borderRadius:19, background:T.green, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'JetBrains Mono,monospace', fontSize:11, fontWeight:600, flexShrink:0 }}>{pct}%</div>
        </div>
      </div>
      <MiniGrid bed={bed} />
      <div style={{ display:'flex', marginTop:12 }}>
        {pIds.map((pid, k) => {
          const p = plantById(pid);
          return p ? <div key={k} style={{ width:24, height:24, borderRadius:12, background:`oklch(0.62 0.1 ${p.hue})`, border:`2px solid ${T.panel}`, marginLeft:k > 0 ? -8 : 0, fontFamily:'Fraunces,serif', fontStyle:'italic', color:'#fff', fontSize:12, display:'flex', alignItems:'center', justifyContent:'center' }}>{p.glyph[0]}</div> : null;
        })}
      </div>
    </div>
  );
}

export default function BeetsOverview() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const mobile = useBreakpoint();
  const [beds, setBeds] = useState([]);

  useEffect(() => {
    const local = loadLocalBeds();
    setBeds(local);
    if (user && db) {
      getDocs(collection(db, 'users', user.uid, 'beds')).then(snap => {
        const remote = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const merged = [...local];
        remote.forEach(r => { if (!merged.find(b => b.id === r.id)) merged.push(r); });
        setBeds(merged);
      }).catch(() => {});
    }
  }, [user]);

  function deleteBed(bedId) {
    localStorage.removeItem(`hb_bed_${bedId}`);
    const ids = JSON.parse(localStorage.getItem('hb_beds') || '[]');
    localStorage.setItem('hb_beds', JSON.stringify(ids.filter(id => id !== bedId)));
    if (user && db) deleteDoc(doc(db, 'users', user.uid, 'beds', bedId)).catch(() => {});
    setBeds(b => b.filter(x => x.id !== bedId));
  }

  if (mobile) return (
    <div style={{ height:'100%', background:T.bg, paddingTop:56, paddingBottom:100, overflow:'auto', position:'relative' }}>
      <div style={{ padding:'8px 20px 12px' }}>
        <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:10, textTransform:'uppercase', letterSpacing:'0.1em', color:T.inkMute, marginBottom:4 }}>Meine Beete · {beds.length}</div>
        <h1 style={{ fontFamily:'Fraunces,serif', fontSize:30, margin:'0 0 16px', fontWeight:500, lineHeight:1.1 }}>
          <em style={{ color:T.green, fontStyle:'italic' }}>Beete</em>
        </h1>
        <Btn onClick={() => navigate('/autoplan')} variant="primary" style={{ width:'100%', justifyContent:'center' }}>
          ✦ Plan generieren
        </Btn>
      </div>

      <div style={{ padding:'0 16px 16px', display:'flex', flexDirection:'column', gap:12 }}>
        {beds.map(bed => (
          <BedCard key={bed.id} bed={bed} onClick={() => navigate(`/bed/${bed.id}`)} onDelete={deleteBed} />
        ))}
        <div onClick={() => navigate('/onboarding')} style={{ background:'transparent', border:`1.5px dashed ${T.borderHi}`, borderRadius:18, padding:20, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', minHeight:60, color:T.inkMute, fontSize:13, fontWeight:500 }}>
          + Neues Beet anlegen
        </div>
      </div>

      <TabBar active="beds" />
    </div>
  );

  // Desktop
  return (
    <div style={{ minHeight:'100vh', background:T.bg, padding:32, overflow:'auto' }}>
      <div style={{ maxWidth:1280, margin:'0 auto' }}>
        <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:28 }}>
          <div>
            <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:10, textTransform:'uppercase', letterSpacing:'0.1em', color:T.inkMute }}>Meine Beete · {beds.length}</div>
            <h1 style={{ fontFamily:'Fraunces,serif', fontSize:48, margin:'6px 0 0', fontWeight:500 }}>
              <em style={{ color:T.green, fontStyle:'italic' }}>Beete</em>
            </h1>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            {user ? (
              <Btn onClick={logout} variant="ghost" style={{ fontSize:12 }}>Abmelden</Btn>
            ) : null}
            <Btn onClick={() => navigate('/onboarding')} variant="default">+ Neues Beet</Btn>
            <Btn onClick={() => navigate('/autoplan')} variant="primary">✦ Plan generieren</Btn>
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))', gap:16 }}>
          {beds.map(bed => (
            <BedCard key={bed.id} bed={bed} onClick={() => navigate(`/bed/${bed.id}`)} desktop onDelete={deleteBed} />
          ))}
          <div onClick={() => navigate('/onboarding')} style={{ background:'transparent', border:`1.5px dashed ${T.borderHi}`, borderRadius:18, padding:20, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', minHeight:160, color:T.inkMute, fontSize:13, fontWeight:500, gap:8, transition:'border-color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = T.green}
            onMouseLeave={e => e.currentTarget.style.borderColor = T.borderHi}>
            + Neues Beet anlegen
          </div>
        </div>
      </div>
    </div>
  );
}
