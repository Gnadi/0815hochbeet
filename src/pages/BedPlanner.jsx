import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useBed } from '../hooks/useBed';
import { useHarvestLog } from '../hooks/useHarvestLog';
import { T } from '../theme';
import { PLANTS, SEASONS, SHAPES, plantById, companionReason } from '../data/plants';
import { generatePlan, GOALS } from '../utils/generatePlan';
import { getRotationAnalysis } from '../utils/rotationAdvice';
import { PlantTile } from '../components/PlantTile';
import { BedCanvas } from '../components/BedCanvas';
import { TabBar } from '../components/TabBar';
import { Btn, TrashIcon } from '../components/Btn';
import { Chip } from '../components/Chip';

const MONO = { fontFamily:'JetBrains Mono,monospace' };
const LABEL = { ...MONO, fontSize:10, textTransform:'uppercase', letterSpacing:'0.1em', color:T.inkMute };

function saveBedLocally(bedId, data) {
  try {
    const existing = JSON.parse(localStorage.getItem(`hb_bed_${bedId}`) || '{}');
    localStorage.setItem(`hb_bed_${bedId}`, JSON.stringify({ ...existing, ...data, updatedAt:new Date().toISOString() }));
  } catch {}
}

function GenerateModal({ goal, setGoal, picks, togglePick, plan, step, onGenerate, onApply, onBack, onClose, bedWidth, bedDepth }) {
  const previewBed = plan ? { cells:plan.cells, plantStatus:{}, bedWidth, bedDepth } : null;
  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(31,42,27,0.5)', zIndex:200 }} />
      <div style={{ position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', zIndex:210, background:'#fff', borderRadius:20, padding:'28px 28px 24px', width:Math.min(520, window.innerWidth - 32), maxHeight:'90vh', overflowY:'auto', boxShadow:'0 8px 48px -8px rgba(31,42,27,0.35)', border:`1px solid ${T.border}` }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:22 }}>
          <div style={{ fontFamily:'Fraunces,serif', fontSize:22, fontWeight:500 }}>✦ <em style={{ color:T.green, fontStyle:'italic' }}>Beet generieren</em></div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:18, color:T.inkMute, lineHeight:1, padding:'4px 6px' }}>×</button>
        </div>

        {step === 1 && (
          <>
            <div style={{ ...LABEL, marginBottom:8 }}>Ziel</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:22 }}>
              {GOALS.map(g => (
                <button key={g.id} onClick={()=>setGoal(g.id)} style={{ padding:'12px 8px', textAlign:'left', cursor:'pointer', background:goal===g.id?'rgba(107,142,78,0.08)':'rgba(31,42,27,0.03)', border:`${goal===g.id?2:1}px solid ${goal===g.id?T.green:T.border}`, borderRadius:12, transition:'all 0.15s', fontFamily:'inherit' }}>
                  <div style={{ fontFamily:'Fraunces,serif', fontSize:13, fontWeight:500, color:goal===g.id?T.green:T.ink, marginBottom:3 }}>{g.de}</div>
                  <div style={{ fontSize:9, color:T.inkDim, lineHeight:1.4 }}>{g.desc}</div>
                </button>
              ))}
            </div>
            <div style={{ ...LABEL, marginBottom:10 }}>Pflanzen · {picks.length} ausgewählt</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:6, marginBottom:24 }}>
              {PLANTS.map(p => (
                <button key={p.id} onClick={()=>togglePick(p.id)} style={{ padding:7, borderRadius:10, background:picks.includes(p.id)?'#fff':'rgba(31,42,27,0.03)', border:`1.5px solid ${picks.includes(p.id)?T.green:T.border}`, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:4, transition:'all 0.15s', fontFamily:'inherit' }}>
                  <PlantTile plant={p} size={28} showLabel={false} draggable={false} />
                  <div style={{ fontSize:8, fontWeight:600, textAlign:'center', lineHeight:1.2 }}>{p.de}</div>
                </button>
              ))}
            </div>
            <button onClick={onGenerate} disabled={picks.length === 0} style={{ width:'100%', padding:'12px 20px', borderRadius:999, background:picks.length?T.green:'rgba(31,42,27,0.12)', color:picks.length?'#fff':T.inkMute, border:'none', cursor:picks.length?'pointer':'default', fontSize:14, fontWeight:600, fontFamily:'inherit', transition:'all 0.15s' }}>
              Plan generieren ✦
            </button>
          </>
        )}

        {step === 2 && plan && previewBed && (
          <>
            <BedCanvas bed={previewBed} readOnly showConflict={false} />
            <div style={{ display:'flex', gap:8, margin:'14px 0' }}>
              <Chip style={{ flex:1, justifyContent:'center' }}>Ertrag <strong style={{ ...MONO, color:T.green, marginLeft:4 }}>~{plan.yieldKg.toFixed(1)} kg</strong></Chip>
              <Chip style={{ flex:1, justifyContent:'center' }}>Pflege <strong style={{ ...MONO, color:T.green, marginLeft:4 }}>{plan.careHours}h/Wo</strong></Chip>
            </div>
            <div style={{ background:'rgba(31,42,27,0.03)', border:`1px solid ${T.border}`, borderRadius:12, overflow:'hidden', marginBottom:16 }}>
              {plan.plantings.map(({ plant, fitCols, fitRows, count }, idx) => (
                <div key={plant.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderBottom: idx < plan.plantings.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                  <PlantTile plant={plant} size={24} showLabel={false} draggable={false} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, fontWeight:600 }}>{plant.de}</div>
                    <div style={{ fontSize:10, color:T.inkMute, ...MONO }}>{plant.spacing_cm} cm</div>
                  </div>
                  <div style={{ ...MONO, fontSize:13, fontWeight:700, color:T.green }}>{count}×</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize:12, color:T.inkDim, lineHeight:1.6, marginBottom:20 }}>{plan.description}</div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={onBack} style={{ flex:1, padding:'11px 16px', borderRadius:999, background:'rgba(31,42,27,0.05)', color:T.ink, border:`1px solid ${T.border}`, cursor:'pointer', fontSize:13, fontWeight:500, fontFamily:'inherit' }}>← Zurück</button>
              <button onClick={onApply} style={{ flex:2, padding:'11px 20px', borderRadius:999, background:T.green, color:'#fff', border:'none', cursor:'pointer', fontSize:13, fontWeight:600, fontFamily:'inherit' }}>Anwenden →</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default function BedPlanner() {
  const { bedId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const mobile = useBreakpoint();
  const [initialData, setInitialData] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`hb_bed_${bedId}`) || 'null'); } catch { return null; }
  });
  const [loaded, setLoaded] = useState(() => {
    try { return !!localStorage.getItem(`hb_bed_${bedId}`); } catch { return false; }
  });
  const bed = useBed(initialData?.shapeId || 'rect', initialData?.width, initialData?.depth);
  const { entries: harvestEntries, addEntry: addHarvest, deleteEntry: deleteHarvest, entriesForBed } = useHarvestLog();
  const [draggingPlant, setDraggingPlant] = useState(null);
  const [showSun, setShowSun] = useState(false);
  const [activeTab, setActiveTab] = useState('plants');
  const [notes, setNotes] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedPlant, setSelectedPlant] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [harvestPlant, setHarvestPlant] = useState('');
  const [harvestAmount, setHarvestAmount] = useState('');
  const [showGenModal, setShowGenModal] = useState(false);
  const [genGoal, setGenGoal] = useState('family');
  const [genPicks, setGenPicks] = useState(['tomato','basil','carrot','lettuce','bean']);
  const [genPlan, setGenPlan] = useState(null);
  const [genStep, setGenStep] = useState(1);
  const notesTimer = useRef(null);
  const saveTimer = useRef(null);
  const [bedName, setBedName] = useState('Mein Hochbeet');
  const touchDragRef = useRef({ active:false, plantId:null });
  const [touchGhost, setTouchGhost] = useState(null);

  function openGenModal() { setGenStep(1); setGenPlan(null); setShowGenModal(true); }
  function closeGenModal() { setShowGenModal(false); setGenPlan(null); setGenStep(1); }
  function toggleGenPick(id) { setGenPicks(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]); }
  function runGenerate() {
    const w = initialData?.width || bed.bedWidth || 120;
    const d = initialData?.depth || bed.bedDepth || 80;
    const result = generatePlan(genGoal, genPicks, w, d);
    if (result) { setGenPlan(result); setGenStep(2); }
  }
  function applyGenPlan() {
    if (!genPlan) return;
    bed.applySeasonCells(genPlan.cells);
    closeGenModal();
  }

  function startTouchDrag(plantId, e) {
    e.preventDefault();
    touchDragRef.current = { active:true, plantId };
    setDraggingPlant(plantId);
    const touch = e.touches[0];
    setTouchGhost({ plantId, x:touch.clientX, y:touch.clientY });
  }

  useEffect(() => {
    function onTouchMove(e) {
      if (!touchDragRef.current.active) return;
      e.preventDefault();
      const touch = e.touches[0];
      setTouchGhost({ plantId:touchDragRef.current.plantId, x:touch.clientX, y:touch.clientY });
    }
    function onTouchEnd(e) {
      if (!touchDragRef.current.active) return;
      const touch = e.changedTouches[0];
      const canvas = document.getElementById('bed-canvas');
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        if (touch.clientX >= rect.left && touch.clientX <= rect.right &&
            touch.clientY >= rect.top  && touch.clientY <= rect.bottom) {
          const bw = bed.bedWidth || 120;
          const bh = bed.bedDepth || 80;
          const scale = rect.width / bw;
          const xCm = Math.round(((touch.clientX - rect.left) / scale) / 5) * 5;
          const yCm = Math.round(((touch.clientY - rect.top)  / scale) / 5) * 5;
          bed.place(xCm, yCm, touchDragRef.current.plantId);
        }
      }
      touchDragRef.current = { active:false, plantId:null };
      setDraggingPlant(null);
      setTouchGhost(null);
    }
    window.addEventListener('touchmove', onTouchMove, { passive:false });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  // eslint-disable-next-line
  }, [bed]);

  // Load bed data
  useEffect(() => {
    if (initialData) {
      setBedName(initialData.name || 'Mein Hochbeet');
      setNotes(initialData.notes || '');
    }
    if (user && db) {
      const unsub = onSnapshot(doc(db,'users',user.uid,'beds',bedId), snap => {
        if (snap.exists()) {
          const d = snap.data();
          if (!initialData) { setInitialData(d); setBedName(d.name||'Mein Hochbeet'); setNotes(d.notes||''); setLoaded(true); }
        }
      }, ()=>{});
      return unsub;
    }
  // eslint-disable-next-line
  }, [bedId, user]);

  // Hydrate all season cells from saved data once
  const appliedRef = useRef(false);
  useEffect(() => {
    if (!loaded || appliedRef.current || !initialData) return;
    appliedRef.current = true;
    if (initialData.seasonCells) {
      bed.loadSeasonCells(initialData.seasonCells);
    } else if (initialData.cells && Object.keys(initialData.cells).length > 0) {
      // Migrate legacy format: single cells object → put in summer
      bed.loadSeasonCells({ summer: initialData.cells });
    }
  // eslint-disable-next-line
  }, [loaded, initialData]);

  const save = useCallback(() => {
    const data = { seasonCells:bed.seasonCells, shapeId:bed.shapeId, customMask:bed.customMask, season:bed.season, notes };
    saveBedLocally(bedId, data);
    if (user && db) {
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        setDoc(doc(db,'users',user.uid,'beds',bedId), { ...data, updatedAt:serverTimestamp() }, { merge:true }).catch(()=>{});
      }, 800);
    }
  }, [bed.cells, bed.shapeId, bed.customMask, bed.season, notes, bedId, user]);

  useEffect(() => { if (loaded) save(); }, [bed.cells, bed.shapeId, bed.customMask, bed.season]);

  function deleteBed() {
    localStorage.removeItem(`hb_bed_${bedId}`);
    const ids = JSON.parse(localStorage.getItem('hb_beds') || '[]');
    localStorage.setItem('hb_beds', JSON.stringify(ids.filter(id => id !== bedId)));
    if (user && db) deleteDoc(doc(db, 'users', user.uid, 'beds', bedId)).catch(() => {});
    navigate('/dashboard');
  }

  function handleNotesChange(val) {
    setNotes(val);
    clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => {
      saveBedLocally(bedId, { notes:val });
      if (user && db) {
        setDoc(doc(db,'users',user.uid,'beds',bedId), { notes:val, updatedAt:serverTimestamp() }, { merge:true }).catch(()=>{});
      }
    }, 800);
  }

  const seasonPlants = PLANTS.filter(p => p.seasons.includes(bed.season));

  if (!loaded) return <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:T.bg, color:T.inkMute, fontFamily:'JetBrains Mono,monospace', fontSize:12 }}>Laden…</div>;

  if (mobile) return (
    <div style={{ height:'100%', background:T.bg, paddingTop:56, paddingBottom:100, overflow:'auto', position:'relative' }}>
      {/* Header */}
      <div style={{ padding:'8px 20px 12px', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <button onClick={()=>navigate('/dashboard')} style={{ background:'none', border:'none', color:T.inkMute, cursor:'pointer', fontSize:12, fontFamily:'inherit', padding:'0 0 4px', display:'flex', alignItems:'center', gap:4 }}>← Dashboard</button>
          <div style={LABEL}>Beet 01</div>
          <h1 style={{ fontFamily:'Fraunces,serif', fontSize:24, margin:'2px 0 0', fontWeight:500 }}><em style={{ color:T.green, fontStyle:'italic' }}>{bedName}</em></h1>
        </div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', justifyContent:'flex-end' }}>
          <button onClick={bed.undo} disabled={!bed.canUndo} style={{ height:40, padding:'0 14px', borderRadius:999, background:T.panel, border:`1px solid ${T.border}`, fontSize:13, fontWeight:600, fontFamily:'inherit', cursor:'pointer', opacity:bed.canUndo?1:0.4, display:'flex', alignItems:'center', gap:5 }}>↶ <span>Undo</span></button>
          <button onClick={openGenModal} style={{ height:40, padding:'0 14px', borderRadius:999, background:T.green, border:'none', color:'#fff', fontSize:13, fontWeight:600, fontFamily:'inherit', cursor:'pointer', display:'flex', alignItems:'center', gap:5 }}>✦ <span>Generieren</span></button>
          <button onClick={bed.fixBed} style={{ height:40, padding:'0 14px', borderRadius:999, background:T.terra, border:'none', color:'#fff', fontSize:13, fontWeight:600, fontFamily:'inherit', cursor:'pointer', display:'flex', alignItems:'center', gap:5 }}>🪄 <span>Fix Beet</span></button>
          {confirmDelete
            ? <button onClick={deleteBed} style={{ height:40, padding:'0 14px', borderRadius:999, background:'rgba(201,84,58,0.12)', border:`1px solid rgba(201,84,58,0.4)`, color:T.bad, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Löschen?</button>
            : <button onClick={()=>setConfirmDelete(true)} style={{ width:40, height:40, borderRadius:999, background:T.panel, border:`1px solid ${T.border}`, cursor:'pointer', color:T.inkMute, display:'flex', alignItems:'center', justifyContent:'center' }}><TrashIcon size={14} /></button>
          }
        </div>
      </div>

      {/* Season pills */}
      <div style={{ padding:'0 16px 12px', display:'flex', gap:6, overflowX:'auto' }}>
        {SEASONS.map(s => (
          <button key={s.id} onClick={()=>bed.setSeason(s.id)} style={{ padding:'8px 14px', borderRadius:999, fontSize:12, fontWeight:600, fontFamily:'inherit', background:bed.season===s.id?T.green:T.panel, color:bed.season===s.id?'#fff':T.ink, border:`1px solid ${bed.season===s.id?'transparent':T.border}`, cursor:'pointer', flexShrink:0, transition:'all 0.15s' }}>{s.de}</button>
        ))}
      </div>

      {/* Stats */}
      <div style={{ padding:'0 16px 12px', display:'flex', gap:6, flexWrap:'wrap' }}>
        <Chip style={{ fontSize:10 }}><span style={{ color:T.inkMute }}>Pflanzen</span> <strong style={MONO}>{bed.stats.placed}</strong></Chip>
        <Chip style={{ fontSize:10 }}><span style={{ color:T.inkMute }}>Ertrag</span> <strong style={{ ...MONO, color:T.green }}>~{bed.stats.yieldKg.toFixed(1)} kg</strong></Chip>
        {bed.issues.length>0 && <Chip style={{ fontSize:10, background:'rgba(201,84,58,0.10)', borderColor:'rgba(201,84,58,0.3)' }}><span style={{ color:T.bad }}>⚠ {bed.issues.length} Konflikt{bed.issues.length>1?'e':''}</span></Chip>}
      </div>

      {/* Canvas */}
      <div style={{ padding:'20px 16px 0' }}>
        <BedCanvas
          bed={bed}
          showConflict={true}
          draggingPlant={selectedPlant}
          onCellPlace={(xCm, yCm, plantId) => bed.place(xCm, yCm, plantId)}
          onCellRemove={bed.remove}
          onCellMove={bed.move}
        />
      </div>

      {/* Plant selection bar */}
      <div style={{ padding:'16px 16px 0' }}>
        <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:14, padding:12, display:'flex', alignItems:'center', gap:12 }}>
          {selectedPlant ? (
            <>
              <PlantTile plant={plantById(selectedPlant)} size={36} showLabel={false} draggable={false} />
              <div style={{ flex:1 }}>
                <div style={{ fontFamily:'Fraunces,serif', fontSize:14, fontWeight:600 }}>{plantById(selectedPlant).de}</div>
                <div style={{ fontSize:11, color:T.inkDim }}>Tippe ein Feld zum Platzieren</div>
              </div>
              <button onClick={()=>setSelectedPlant(null)} style={{ width:26, height:26, borderRadius:13, background:T.bg, border:`1px solid ${T.border}`, fontSize:12, cursor:'pointer' }}>×</button>
            </>
          ) : (
            <>
              <div style={{ width:36, height:36, borderRadius:8, background:T.bg, border:`1.5px dashed ${T.borderHi}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, color:T.inkMute }}>+</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:500 }}>Pflanze wählen</div>
                <div style={{ fontSize:11, color:T.inkDim }}>Tippe um die Auswahl zu öffnen</div>
              </div>
              <button onClick={()=>setPickerOpen(true)} style={{ padding:'7px 14px', borderRadius:999, background:T.green, color:'#fff', border:'none', cursor:'pointer', fontSize:12, fontWeight:600, fontFamily:'inherit' }}>Wählen</button>
            </>
          )}
        </div>
      </div>

      {/* Conflict & companion details */}
      {(bed.issues.length > 0 || bed.wins.length > 0) && (
        <div style={{ padding:'12px 16px 0' }}>
          <div style={LABEL}>Konflikte & Nachbarn</div>
          <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:8 }}>
            {bed.issues.map((iss, i) => {
              const reason = companionReason(iss.a.id, iss.b.id);
              return (
                <div key={i} style={{ padding:14, borderRadius:14, background:'rgba(201,84,58,0.08)', border:`1px solid rgba(201,84,58,0.22)` }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                    <div style={{ width:8, height:8, borderRadius:4, background:T.bad, flexShrink:0 }} />
                    <div style={{ ...LABEL, color:T.bad }}>Konflikt</div>
                  </div>
                  <div style={{ fontFamily:'Fraunces,serif', fontSize:15, fontWeight:500 }}>{iss.a.de} <em style={{ color:T.bad }}>vs.</em> {iss.b.de}</div>
                  {reason && <div style={{ fontSize:11, color:T.inkDim, marginTop:5, lineHeight:1.5 }}>{reason}</div>}
                </div>
              );
            })}
            {bed.wins.slice(0, 4).map((w, i) => {
              const reason = companionReason(w.a.id, w.b.id);
              return (
                <div key={`w${i}`} style={{ padding:14, borderRadius:14, background:'rgba(107,142,78,0.08)', border:`1px solid rgba(107,142,78,0.22)` }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                    <div style={{ width:8, height:8, borderRadius:4, background:T.good, flexShrink:0 }} />
                    <div style={{ ...LABEL, color:T.good }}>Gute Nachbarn</div>
                  </div>
                  <div style={{ fontFamily:'Fraunces,serif', fontSize:15, fontWeight:500 }}>{w.a.de} <em style={{ color:T.good }}>+</em> {w.b.de}</div>
                  {reason && <div style={{ fontSize:11, color:T.inkDim, marginTop:5, lineHeight:1.5 }}>{reason}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom sheet picker */}
      {pickerOpen && (
        <>
          <div onClick={()=>setPickerOpen(false)} style={{ position:'fixed', inset:0, background:'rgba(31,42,27,0.4)', zIndex:40 }} />
          <div style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:50, background:T.paper, borderTopLeftRadius:24, borderTopRightRadius:24, padding:'12px 16px 100px', boxShadow:'0 -10px 30px -8px rgba(31,42,27,0.25)', maxHeight:'75vh', overflowY:'auto' }}>
            <div style={{ width:40, height:4, background:T.borderHi, borderRadius:2, margin:'0 auto 14px' }} />
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:14 }}>
              <h3 style={{ fontFamily:'Fraunces,serif', fontSize:20, margin:0, fontWeight:500 }}>Pflanze wählen</h3>
              <div style={{ ...MONO, fontSize:10, color:T.inkMute }}>{seasonPlants.length} in Saison</div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
              {seasonPlants.map(p => (
                <button key={p.id}
                  onClick={()=>{ setSelectedPlant(p.id); setPickerOpen(false); }}
                  onTouchStart={(e)=>{ startTouchDrag(p.id, e); setPickerOpen(false); }}
                  style={{ background:selectedPlant===p.id?'#fff':T.panel, border:`1.5px solid ${selectedPlant===p.id?T.green:T.border}`, borderRadius:14, padding:12, display:'flex', flexDirection:'column', alignItems:'center', gap:6, cursor:'pointer', fontFamily:'inherit' }}>
                  <PlantTile plant={p} size={44} showLabel={false} draggable={false} />
                  <div style={{ fontSize:12, fontWeight:600 }}>{p.de}</div>
                  <div style={{ fontSize:9, color:T.inkMute, ...MONO }}>{p.sun==='full'?'☀ Sonne':p.sun==='part'?'⛅ Halb':'☁ Schatten'}</div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
      {/* Touch drag ghost */}
      {touchGhost && (() => {
        const p = plantById(touchGhost.plantId);
        if (!p) return null;
        const size = 60;
        return (
          <div style={{ position:'fixed', left:touchGhost.x - size/2, top:touchGhost.y - size - 18, width:size, height:size, borderRadius:'50%', background:`radial-gradient(circle at 35% 30%, oklch(0.80 0.10 ${p.hue}), oklch(0.50 0.15 ${p.hue}))`, zIndex:1000, pointerEvents:'none', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 16px rgba(0,0,0,0.3)' }}>
            <span style={{ fontFamily:'Fraunces,serif', fontSize:24, color:'rgba(255,255,255,0.95)', fontStyle:'italic' }}>{p.glyph[0]}</span>
          </div>
        );
      })()}
      {showGenModal && <GenerateModal goal={genGoal} setGoal={setGenGoal} picks={genPicks} togglePick={toggleGenPick} plan={genPlan} step={genStep} onGenerate={runGenerate} onApply={applyGenPlan} onBack={()=>setGenStep(1)} onClose={closeGenModal} bedWidth={initialData?.width||bed.bedWidth||120} bedDepth={initialData?.depth||bed.bedDepth||80} />}
      <TabBar active="beds" />
    </div>
  );

  // ─── DESKTOP ────────────────────────────────────────────────────────────────
  return (
    <>
    <div style={{ display:'grid', gridTemplateColumns:'270px 1fr 320px', height:'100vh', background:T.bg }}>
      {/* LEFT PANEL */}
      <aside style={{ borderRight:`1px solid ${T.border}`, padding:20, overflow:'auto', background:T.paper, scrollbarWidth:'thin' }}>
        {/* Logo */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
          <button onClick={()=>navigate('/dashboard')} style={{ background:'none', border:'none', cursor:'pointer', padding:0 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:T.green, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontFamily:'Fraunces,serif', fontStyle:'italic', fontSize:18 }}>H</div>
          </button>
          <div>
            <div style={{ fontFamily:'Fraunces,serif', fontSize:16, fontWeight:600 }}>Hochbeet</div>
            <div style={{ ...MONO, fontSize:9, color:T.inkMute }}>PLANER · v0.1</div>
          </div>
        </div>

        {/* Season */}
        <div style={LABEL}>Saison · Season</div>
        <div style={{ display:'flex', gap:4, marginBottom:18, padding:4, background:T.bg, borderRadius:12, border:`1px solid ${T.border}` }}>
          {SEASONS.map(s => (
            <button key={s.id} onClick={()=>bed.setSeason(s.id)} style={{ flex:1, padding:'8px 4px', border:'none', borderRadius:8, background:bed.season===s.id?'#fff':'transparent', boxShadow:bed.season===s.id?'0 1px 3px rgba(0,0,0,0.06)':'none', color:bed.season===s.id?T.ink:T.inkMute, cursor:'pointer', fontSize:11, fontWeight:600, fontFamily:'inherit' }}>{s.de.slice(0,3)}</button>
          ))}
        </div>

        {/* Plants */}
        <div style={LABEL}>Pflanzen · Plants</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:20 }}>
          {seasonPlants.map(p => (
            <div key={p.id} draggable
              onDragStart={e=>{e.dataTransfer.setData('plant',p.id);setDraggingPlant(p.id);}}
              onDragEnd={()=>setDraggingPlant(null)}
              onClick={()=>setDraggingPlant(draggingPlant===p.id?null:p.id)}
              onTouchStart={(e)=>startTouchDrag(p.id, e)}
              style={{ background:draggingPlant===p.id?'#fff':T.panel, border:`1.5px solid ${draggingPlant===p.id?T.green:T.border}`, borderRadius:14, padding:10, cursor:'grab', transition:'all 0.15s', display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
              <PlantTile plant={p} size={42} showLabel={false} draggable={false} />
              <div style={{ fontSize:12, fontWeight:600 }}>{p.de}</div>
              <div style={{ fontSize:9, color:T.inkMute, ...MONO }}>{p.sun==='full'?'☀':p.sun==='part'?'⛅':'☁'}</div>
            </div>
          ))}
        </div>

        {/* Shape picker */}
        <div style={LABEL}>Beetform · Shape</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:16 }}>
          {Object.values(SHAPES).map(s => (
            <button key={s.id} onClick={()=>bed.setShape(s.id)} style={{ padding:'8px 6px', fontSize:11, border:'none', borderRadius:999, background:bed.shapeId===s.id?T.green:T.panel, color:bed.shapeId===s.id?'#fff':T.ink, cursor:'pointer', fontWeight:600, fontFamily:'inherit', transition:'all 0.15s' }}>{s.de}</button>
          ))}
        </div>

        {/* Freeform controls */}
        {bed.isFreeform && (
          <div style={{ padding:12, background:T.panel, border:`1px dashed ${T.terra}`, borderRadius:12 }}>
            <div style={{ ...LABEL, color:T.terra, marginBottom:8 }}>Frei zeichnen</div>
            <button onClick={()=>bed.setShapeEditing(!bed.shapeEditing)} style={{ width:'100%', padding:'8px 12px', border:'none', borderRadius:999, background:bed.shapeEditing?T.terra:T.panel, color:bed.shapeEditing?'#fff':T.ink, cursor:'pointer', fontSize:12, fontWeight:600, fontFamily:'inherit', marginBottom:6 }}>
              {bed.shapeEditing?'✓ Form fertig':'✎ Form bearbeiten'}
            </button>
            {bed.shapeEditing && (
              <div style={{ display:'flex', gap:6, marginTop:6 }}>
                <button onClick={bed.clearMask} style={{ flex:1, padding:'6px 4px', border:`1px solid ${T.border}`, borderRadius:999, background:T.panel, cursor:'pointer', fontSize:10, fontFamily:'inherit' }}>Leer</button>
                <button onClick={bed.resetMask} style={{ flex:1, padding:'6px 4px', border:`1px solid ${T.border}`, borderRadius:999, background:T.panel, cursor:'pointer', fontSize:10, fontFamily:'inherit' }}>Reset</button>
              </div>
            )}
            <div style={{ marginTop:10, fontSize:10, color:T.inkDim, lineHeight:1.4 }}>{bed.shapeEditing?'Klicken oder ziehen, um Felder hinzuzufügen / zu entfernen.':'Aktiviere den Modus, um die Form frei zu zeichnen.'}</div>
          </div>
        )}
      </aside>

      {/* CENTER */}
      <main style={{ overflow:'auto', padding:30, scrollbarWidth:'thin' }}>
        <header style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:22 }}>
          <div>
            <div style={LABEL}>Beet 01 · {bed.shape.de}</div>
            <h1 style={{ fontFamily:'Fraunces,serif', fontSize:38, margin:'4px 0 0', fontWeight:500 }}>Mein <em style={{ color:T.green, fontStyle:'italic' }}>{bedName}</em></h1>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <Btn onClick={bed.undo} disabled={!bed.canUndo} title="Rückgängig">↶</Btn>
            <Btn onClick={bed.redo} disabled={!bed.canRedo} title="Wiederholen">↷</Btn>
            <Btn onClick={()=>setShowSun(s=>!s)} style={{ background:showSun?T.ochre:T.panel, color:showSun?'#fff':T.ink, border:'none' }}>☀ Sonne</Btn>
            <Btn onClick={openGenModal} variant="primary">✦ Generieren</Btn>
            <Btn onClick={bed.fixBed} variant="terra">🪄 Fix my bed</Btn>
            <Btn onClick={()=>navigate(`/bed/${bedId}/seasons`)}>🗓 Saison</Btn>
            {confirmDelete
              ? <><Btn onClick={deleteBed} style={{ background:'rgba(201,84,58,0.12)', color:T.bad, borderColor:'rgba(201,84,58,0.4)' }}>Ja, löschen</Btn><Btn onClick={()=>setConfirmDelete(false)}>Abbrechen</Btn></>
              : <Btn onClick={()=>setConfirmDelete(true)} title="Beet löschen"><TrashIcon /></Btn>
            }
          </div>
        </header>

        {/* Stats */}
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:22 }}>
          <Chip><span style={{ color:T.inkMute }}>Pflanzen</span> <strong style={MONO}>{bed.stats.placed}</strong></Chip>
          <Chip><span style={{ color:T.inkMute }}>Ertrag</span> <strong style={{ ...MONO, color:T.green }}>~{bed.stats.yieldKg.toFixed(1)} kg</strong></Chip>
          <Chip style={{ background:bed.issues.length?'rgba(201,84,58,0.10)':T.panel, borderColor:bed.issues.length?'rgba(201,84,58,0.3)':T.border }}>
            <span style={{ color:bed.issues.length?T.bad:T.inkMute }}>Konflikte</span>
            <strong style={{ ...MONO, color:bed.issues.length?T.bad:T.inkMute }}>{bed.issues.length}</strong>
          </Chip>
        </div>

        <div>
          <BedCanvas
            bed={bed}
            showConflict={true}
            draggingPlant={draggingPlant}
            onCellPlace={(xCm, yCm, plantId) => bed.place(xCm, yCm, plantId)}
            onCellRemove={bed.remove}
            onCellMove={bed.move}
          />
        </div>

        <div style={{ marginTop:20, display:'flex', gap:18, justifyContent:'center', fontSize:11, color:T.inkMute, ...MONO }}>
          {bed.shapeEditing ? (
            <><span>● Klick = Feld an/aus</span><span>● Ziehen zum Malen</span></>
          ) : (
            <><span>● Klick zum Platzieren</span><span>● Drag &amp; Drop</span><span>● Klick auf Pflanze = entfernen</span></>
          )}
        </div>
      </main>

      {/* RIGHT PANEL */}
      <aside style={{ borderLeft:`1px solid ${T.border}`, padding:20, overflow:'auto', background:T.paper, scrollbarWidth:'thin' }}>
        <div style={{ display:'flex', gap:4, marginBottom:18, padding:4, background:T.bg, borderRadius:12, border:`1px solid ${T.border}` }}>
          {[{id:'plants',label:'Tipps'},{id:'issues',label:'Konflikte'},{id:'care',label:'Pflege'},{id:'harvest',label:'Ernte'}].map(t => (
            <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{ flex:1, padding:'8px 2px', border:'none', borderRadius:8, background:activeTab===t.id?'#fff':'transparent', boxShadow:activeTab===t.id?'0 1px 3px rgba(0,0,0,0.06)':'none', color:activeTab===t.id?T.ink:T.inkMute, cursor:'pointer', fontSize:11, fontWeight:600, fontFamily:'inherit' }}>{t.label}</button>
          ))}
        </div>

        {activeTab==='issues' && (() => {
          const rotation = getRotationAnalysis(bed.seasonCells);
          return (
            <div>
              {bed.issues.length===0 && bed.wins.length===0 && rotation.warnings.length===0 && (
                <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:18, padding:22, textAlign:'center' }}>
                  <div style={{ fontFamily:'Fraunces,serif', fontSize:36, color:T.green, marginBottom:6, fontStyle:'italic' }}>~</div>
                  <div style={{ fontSize:12, color:T.inkDim }}>Platziere Pflanzen, um Hinweise zu erhalten.</div>
                </div>
              )}
              {bed.issues.map((iss,i) => {
                const reason = companionReason(iss.a.id, iss.b.id);
                return (
                  <div key={i} style={{ padding:14, marginBottom:10, borderRadius:14, background:'rgba(201,84,58,0.08)', border:`1px solid rgba(201,84,58,0.22)` }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                      <div style={{ width:8, height:8, borderRadius:4, background:T.bad }} />
                      <div style={{ ...LABEL, color:T.bad }}>Konflikt</div>
                    </div>
                    <div style={{ fontFamily:'Fraunces,serif', fontSize:16, fontWeight:500 }}>{iss.a.de} <em style={{ color:T.bad }}>vs.</em> {iss.b.de}</div>
                    {reason && <div style={{ fontSize:11, color:T.inkDim, marginTop:6, lineHeight:1.5 }}>{reason}</div>}
                  </div>
                );
              })}
              {bed.wins.slice(0,6).map((w,i) => {
                const reason = companionReason(w.a.id, w.b.id);
                return (
                  <div key={`w${i}`} style={{ padding:14, marginBottom:10, borderRadius:14, background:'rgba(107,142,78,0.08)', border:`1px solid rgba(107,142,78,0.22)` }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                      <div style={{ width:8, height:8, borderRadius:4, background:T.good }} />
                      <div style={{ ...LABEL, color:T.good }}>Gute Nachbarn</div>
                    </div>
                    <div style={{ fontFamily:'Fraunces,serif', fontSize:16, fontWeight:500 }}>{w.a.de} <em style={{ color:T.good }}>+</em> {w.b.de}</div>
                    {reason && <div style={{ fontSize:11, color:T.inkDim, marginTop:6, lineHeight:1.5 }}>{reason}</div>}
                  </div>
                );
              })}
              {rotation.warnings.length > 0 && (
                <div style={{ marginTop: bed.issues.length || bed.wins.length ? 14 : 0 }}>
                  <div style={{ ...LABEL, marginBottom:8 }}>Fruchtfolge · Rotation</div>
                  {rotation.warnings.map((w,i) => (
                    <div key={i} style={{ padding:14, marginBottom:10, borderRadius:14, background:'rgba(217,164,65,0.08)', border:`1px solid rgba(217,164,65,0.3)` }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                        <div style={{ width:8, height:8, borderRadius:4, background:T.ochre }} />
                        <div style={{ ...LABEL, color:T.ochre }}>Fruchtfolge-Hinweis</div>
                      </div>
                      <div style={{ fontFamily:'Fraunces,serif', fontSize:15, fontWeight:500, marginBottom:4 }}>{w.familyDe}</div>
                      <div style={{ fontSize:11, color:T.inkDim }}>In mehreren Saisons: {w.seasons.join(', ')}.</div>
                      {w.tip && <div style={{ fontSize:11, color:T.inkDim, marginTop:5, lineHeight:1.5 }}>{w.tip}</div>}
                    </div>
                  ))}
                  {rotation.score >= 75 && rotation.warnings.length === 0 && (
                    <div style={{ padding:12, borderRadius:12, background:'rgba(107,142,78,0.08)', border:`1px solid rgba(107,142,78,0.22)`, fontSize:12, color:T.good }}>
                      ✓ Gute Fruchtfolge — Pflanzenfamilien gut verteilt.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {activeTab==='plants' && (
          <div>
            <div style={LABEL}>Tipp · Tip</div>
            <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:18, padding:18, marginBottom:18, boxShadow:'0 1px 0 rgba(31,42,27,0.04)' }}>
              <div style={{ fontFamily:'Fraunces,serif', fontSize:20, lineHeight:1.3, fontStyle:'italic', color:T.green }}>"Tomate liebt Basilikum — und hasst Kartoffel."</div>
              <div style={{ fontSize:11, color:T.inkMute, marginTop:8, ...MONO }}>— Mischkultur 101</div>
            </div>
            <div style={{ fontSize:13, color:T.inkDim, lineHeight:1.6, marginBottom:18 }}>
              Mischkultur erhöht den Ertrag um bis zu <strong style={{ color:T.ink }}>30%</strong> und reduziert Schädlingsbefall natürlich.
            </div>
            <div style={LABEL}>Notizen · Notes</div>
            <textarea value={notes} onChange={e=>handleNotesChange(e.target.value)} placeholder="Beobachtungen, Ideen, Erinnerungen…" style={{ width:'100%', minHeight:100, padding:12, background:T.panel, border:`1px solid ${T.border}`, borderRadius:12, color:T.ink, fontFamily:'inherit', fontSize:12, resize:'vertical', outline:'none' }} />
          </div>
        )}

        {activeTab==='care' && (
          <div>
            <div style={LABEL}>Diese Woche · This week</div>
            {[
              { day:'MO', task:'Tomaten ausgeizen', count:3 },
              { day:'MI', task:'Bewässern', count:null },
              { day:'FR', task:'Salat ernten', count:2 },
              { day:'SO', task:'Mulchen', count:null },
            ].map((t,i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 0', borderBottom:`1px solid ${T.border}` }}>
                <div style={{ ...MONO, fontSize:10, color:T.green, width:24, fontWeight:600 }}>{t.day}</div>
                <div style={{ flex:1, fontSize:13 }}>{t.task}</div>
                {t.count && <Chip style={{ fontSize:10 }}>{t.count}×</Chip>}
              </div>
            ))}
            {Object.values(bed.cells).length > 0 && (
              <div style={{ marginTop:20 }}>
                <div style={{ ...LABEL, marginBottom:12 }}>Pflegeanleitung</div>
                {[...new Set(Object.values(bed.cells).map(v => typeof v === 'object' ? v.plantId : v).filter(Boolean))].map(pid => {
                  const p = plantById(pid);
                  return p ? (
                    <div key={pid} style={{ marginBottom:12, padding:12, background:T.panel, border:`1px solid ${T.border}`, borderRadius:12 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                        <PlantTile plant={p} size={24} showLabel={false} draggable={false} />
                        <div style={{ fontWeight:600, fontSize:13 }}>{p.de}</div>
                        <div style={{ ...MONO, fontSize:9, color:T.inkMute }}>{p.water==='high'?'💧💧💧':p.water==='med'?'💧💧':'💧'}</div>
                      </div>
                      <div style={{ fontSize:11, color:T.inkDim, lineHeight:1.5 }}>{p.careNotes}</div>
                    </div>
                  ) : null;
                })}
              </div>
            )}
          </div>
        )}

        {activeTab==='harvest' && (() => {
          const bedHarvests = entriesForBed(bedId);
          const placedPlantIds = [...new Set(Object.values(bed.cells).map(v => typeof v === 'object' ? v.plantId : v).filter(Boolean))];
          const totalLogged = bedHarvests.reduce((s, e) => s + e.amountKg, 0);
          const planned = Object.values(bed.cells)
            .filter(v => typeof v === 'object')
            .reduce((s, { plantId, count = 1 }) => s + (plantById(plantId)?.yield || 0) * count, 0);
          return (
            <div>
              <div style={LABEL}>Ernte erfassen</div>
              <div style={{ padding:14, background:T.panel, border:`1px solid ${T.border}`, borderRadius:14, marginBottom:16 }}>
                <div style={{ display:'flex', gap:8, marginBottom:10 }}>
                  <select value={harvestPlant} onChange={e=>setHarvestPlant(e.target.value)}
                    style={{ flex:1, padding:'8px 10px', borderRadius:10, border:`1px solid ${T.border}`, background:T.bg, color:T.ink, fontFamily:'inherit', fontSize:12 }}>
                    <option value="">Pflanze wählen…</option>
                    {placedPlantIds.map(pid => {
                      const p = plantById(pid);
                      return p ? <option key={pid} value={pid}>{p.de}</option> : null;
                    })}
                  </select>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <input type="number" min="0" step="0.1" placeholder="kg" value={harvestAmount} onChange={e=>setHarvestAmount(e.target.value)}
                    style={{ flex:1, padding:'8px 10px', borderRadius:10, border:`1px solid ${T.border}`, background:T.bg, color:T.ink, fontFamily:'JetBrains Mono,monospace', fontSize:12 }} />
                  <button
                    disabled={!harvestPlant || !harvestAmount}
                    onClick={() => {
                      addHarvest({ bedId, plantId:harvestPlant, season:bed.season, amountKg:harvestAmount });
                      setHarvestAmount('');
                    }}
                    style={{ padding:'8px 16px', borderRadius:10, background:harvestPlant&&harvestAmount?T.green:'rgba(31,42,27,0.12)', color:harvestPlant&&harvestAmount?'#fff':T.inkMute, border:'none', cursor:harvestPlant&&harvestAmount?'pointer':'default', fontWeight:600, fontSize:12, fontFamily:'inherit', transition:'all 0.15s' }}>
                    Eintragen
                  </button>
                </div>
              </div>

              {(planned > 0 || totalLogged > 0) && (
                <div style={{ display:'flex', gap:8, marginBottom:16 }}>
                  <div style={{ flex:1, padding:12, background:T.panel, border:`1px solid ${T.border}`, borderRadius:12, textAlign:'center' }}>
                    <div style={{ ...MONO, fontSize:9, color:T.inkMute, textTransform:'uppercase', letterSpacing:'0.08em' }}>Geplant</div>
                    <div style={{ fontFamily:'Fraunces,serif', fontSize:20, fontWeight:500, color:T.inkDim, marginTop:2 }}>~{planned.toFixed(1)} kg</div>
                  </div>
                  <div style={{ flex:1, padding:12, background:T.panel, border:`1px solid ${T.border}`, borderRadius:12, textAlign:'center' }}>
                    <div style={{ ...MONO, fontSize:9, color:T.inkMute, textTransform:'uppercase', letterSpacing:'0.08em' }}>Geerntet</div>
                    <div style={{ fontFamily:'Fraunces,serif', fontSize:20, fontWeight:500, color:T.green, marginTop:2 }}>{totalLogged.toFixed(1)} kg</div>
                  </div>
                </div>
              )}

              {bedHarvests.length === 0 ? (
                <div style={{ fontSize:12, color:T.inkMute, textAlign:'center', padding:'20px 0' }}>Noch keine Ernten eingetragen.</div>
              ) : (
                <div>
                  <div style={LABEL}>Verlauf</div>
                  {[...bedHarvests].reverse().map(e => {
                    const p = plantById(e.plantId);
                    return (
                      <div key={e.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:`1px solid ${T.border}` }}>
                        {p && <PlantTile plant={p} size={22} showLabel={false} draggable={false} />}
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:12, fontWeight:600 }}>{p?.de || e.plantId}</div>
                          <div style={{ ...MONO, fontSize:10, color:T.inkMute }}>{e.date}</div>
                        </div>
                        <div style={{ ...MONO, fontSize:12, color:T.green, fontWeight:600 }}>{e.amountKg.toFixed(1)} kg</div>
                        <button onClick={() => deleteHarvest(e.id)} style={{ background:'none', border:'none', color:T.inkMute, cursor:'pointer', fontSize:14, lineHeight:1, padding:'2px 4px' }}>×</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}
      </aside>
    </div>
    {touchGhost && (() => {
      const p = plantById(touchGhost.plantId);
      if (!p) return null;
      const size = 60;
      return (
        <div style={{ position:'fixed', left:touchGhost.x - size/2, top:touchGhost.y - size - 18, width:size, height:size, borderRadius:'50%', background:`radial-gradient(circle at 35% 30%, oklch(0.80 0.10 ${p.hue}), oklch(0.50 0.15 ${p.hue}))`, zIndex:1000, pointerEvents:'none', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 16px rgba(0,0,0,0.3)' }}>
          <span style={{ fontFamily:'Fraunces,serif', fontSize:24, color:'rgba(255,255,255,0.95)', fontStyle:'italic' }}>{p.glyph[0]}</span>
        </div>
      );
    })()}
    {showGenModal && <GenerateModal goal={genGoal} setGoal={setGenGoal} picks={genPicks} togglePick={toggleGenPick} plan={genPlan} step={genStep} onGenerate={runGenerate} onApply={applyGenPlan} onBack={()=>setGenStep(1)} onClose={closeGenModal} bedWidth={initialData?.width||bed.bedWidth||120} bedDepth={initialData?.depth||bed.bedDepth||80} />}
    </>
  );
}
