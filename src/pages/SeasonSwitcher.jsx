import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { T } from '../theme';
import { SEASONS, plantById } from '../data/plants';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { TabBar } from '../components/TabBar';

const MONO = { fontFamily:'JetBrains Mono,monospace' };
const LABEL = { ...MONO, fontSize:10, textTransform:'uppercase', letterSpacing:'0.1em', color:T.inkMute };

const SEASON_PLANS = {
  spring:  ['radish','lettuce','spinach','carrot','onion','pea'],
  summer:  ['tomato','basil','cucumber','bean','carrot','pepper'],
  autumn:  ['lettuce','spinach','radish','carrot','kohlrabi'],
  winter:  ['spinach','leek'],
};

const TRANSITIONS = [
  { from:'Frühling → Sommer', action:'Radieschen → Tomate', note:'Boden warm genug. Tomaten direkt nach Radieschen-Ernte setzen.' },
  { from:'Sommer → Herbst',   action:'Bohne → Spinat',      note:'Bohnen hinterlassen stickstoffreichen Boden — perfekt für Spinat.' },
  { from:'Herbst → Winter',   action:'Salat → Mulch',       note:'Letzte Ernte, Beet abdecken. Spinat überwintert.' },
];

export default function SeasonSwitcher() {
  const { bedId } = useParams();
  const navigate = useNavigate();
  const mobile = useBreakpoint();
  const [active, setActive] = useState('summer');
  const plants = SEASON_PLANS[active];

  if (mobile) return (
    <div style={{ height:'100%', background:T.bg, paddingTop:56, paddingBottom:110, overflow:'auto', position:'relative' }}>
      <div style={{ padding:'8px 20px 16px' }}>
        <button onClick={()=>navigate(`/bed/${bedId}`)} style={{ background:'none', border:'none', color:T.inkMute, cursor:'pointer', fontSize:12, fontFamily:'inherit', padding:'0 0 4px' }}>← Beet</button>
        <div style={LABEL}>Beet 01 · Saison</div>
        <h1 style={{ fontFamily:'Fraunces,serif', fontSize:28, margin:'2px 0 0', fontWeight:500 }}>Über das <em style={{ color:T.green, fontStyle:'italic' }}>Jahr</em>.</h1>
      </div>
      <div style={{ padding:'0 16px 16px', display:'flex', gap:6, overflowX:'auto' }}>
        {SEASONS.map(s => (
          <button key={s.id} onClick={()=>setActive(s.id)} style={{ padding:'10px 16px', borderRadius:999, fontSize:12, fontWeight:600, fontFamily:'inherit', flexShrink:0, background:active===s.id?T.green:T.panel, color:active===s.id?'#fff':T.ink, border:`1px solid ${active===s.id?'transparent':T.border}`, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ color:active===s.id?'#fff':`oklch(0.55 0.13 ${s.hue})` }}>{s.glyph}</span>{s.de}
          </button>
        ))}
      </div>
      <div style={{ padding:'0 16px 16px' }}>
        <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:18, padding:16 }}>
          <div style={{ ...LABEL, marginBottom:10 }}>{SEASONS.find(s=>s.id===active).de} · {plants.length} Pflanzen</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(8,1fr)', gap:2, height:120, padding:8, background:T.bg, borderRadius:10, marginBottom:12 }}>
            {Array.from({length:32}).map((_,k) => {
              const pid = k < plants.length*5 ? plants[k%plants.length] : null;
              const p = pid ? plantById(pid) : null;
              return <div key={k} style={{ background:p?`oklch(0.62 0.1 ${p.hue})`:'rgba(31,42,27,0.06)', borderRadius:3 }} />;
            })}
          </div>
          <div style={{ display:'flex' }}>
            {plants.map((pid,k) => { const p=plantById(pid); return p?<div key={k} style={{ width:28,height:28,borderRadius:14,background:`oklch(0.62 0.1 ${p.hue})`,border:`2px solid ${T.panel}`,marginLeft:k>0?-8:0,fontFamily:'Fraunces,serif',fontStyle:'italic',color:'#fff',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center' }}>{p.glyph[0]}</div>:null; })}
          </div>
        </div>
      </div>
      <div style={{ padding:'8px 20px' }}><div style={LABEL}>Übergänge · Transitions</div></div>
      <div style={{ padding:'0 16px', display:'flex', flexDirection:'column', gap:10 }}>
        {TRANSITIONS.map((t,i) => (
          <div key={i} style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:14, padding:14 }}>
            <div style={{ ...MONO, fontSize:10, color:T.terra, fontWeight:600, marginBottom:4 }}>{t.from}</div>
            <div style={{ fontFamily:'Fraunces,serif', fontSize:15, fontWeight:500 }}>{t.action}</div>
          </div>
        ))}
      </div>
      <TabBar active="beds" />
    </div>
  );

  // Desktop
  return (
    <div style={{ minHeight:'100vh', background:T.bg, padding:32, overflow:'auto' }}>
      <div style={{ maxWidth:1100, margin:'0 auto' }}>
        <button onClick={()=>navigate(`/bed/${bedId}`)} style={{ background:'none', border:'none', color:T.inkMute, cursor:'pointer', fontSize:13, fontFamily:'inherit', marginBottom:16, display:'flex', alignItems:'center', gap:6 }}>← Zurück zum Beet</button>
        <div style={LABEL}>Beet 01 · Saisonansicht</div>
        <h1 style={{ fontFamily:'Fraunces,serif', fontSize:40, margin:'4px 0 28px', fontWeight:500 }}>Über das <em style={{ color:T.green, fontStyle:'italic' }}>Jahr</em>.</h1>

        <div style={{ display:'flex', gap:6, marginBottom:28 }}>
          {SEASONS.map(s => (
            <button key={s.id} onClick={()=>setActive(s.id)} style={{ padding:'10px 18px', background:active===s.id?T.green:'transparent', color:active===s.id?'#fff':T.ink, border:`1px solid ${active===s.id?'transparent':T.border}`, borderRadius:999, cursor:'pointer', fontSize:13, fontWeight:500, fontFamily:'inherit', display:'flex', alignItems:'center', gap:8, transition:'all 0.15s' }}>
              <span style={{ color:active===s.id?'#fff':`oklch(0.55 0.13 ${s.hue})` }}>{s.glyph}</span>{s.de}
            </button>
          ))}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:32 }}>
          {SEASONS.map(s => {
            const pl = SEASON_PLANS[s.id];
            return (
              <div key={s.id} onClick={()=>setActive(s.id)} style={{ background:T.panel, border:`${active===s.id?2:1}px solid ${active===s.id?T.green:T.border}`, borderRadius:18, padding:18, cursor:'pointer', boxShadow:'0 1px 0 rgba(31,42,27,0.04),0 8px 24px -16px rgba(31,42,27,0.18)', transition:'border-color 0.15s' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                  <div style={{ fontFamily:'Fraunces,serif', fontSize:22, fontStyle:'italic', color:T.green }}>{s.de}</div>
                  <span style={{ color:`oklch(0.55 0.13 ${s.hue})`, fontSize:18 }}>{s.glyph}</span>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(8,1fr)', gap:2, height:90, padding:6, background:T.bg, borderRadius:8 }}>
                  {Array.from({length:32}).map((_,k) => { const pid=k<pl.length*5?pl[k%pl.length]:null; const p=pid?plantById(pid):null; return <div key={k} style={{ background:p?`oklch(0.62 0.1 ${p.hue})`:'rgba(31,42,27,0.06)', borderRadius:2 }} />; })}
                </div>
                <div style={{ marginTop:12, fontSize:11, color:T.inkMute, ...MONO }}>{pl.length} Pflanzen</div>
              </div>
            );
          })}
        </div>

        <div style={LABEL}>Übergänge · Transitions</div>
        <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:18, padding:22, marginTop:12 }}>
          {TRANSITIONS.map((t,i) => (
            <div key={i} style={{ display:'grid', gridTemplateColumns:'200px 1fr', gap:24, padding:'14px 0', borderBottom:i<2?`1px solid ${T.border}`:'none' }}>
              <div style={{ ...MONO, fontSize:11, color:T.terra, fontWeight:600 }}>{t.from}</div>
              <div>
                <div style={{ fontFamily:'Fraunces,serif', fontSize:16, fontWeight:500, marginBottom:4 }}>{t.action}</div>
                <div style={{ fontSize:12, color:T.inkDim }}>{t.note}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
