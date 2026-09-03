import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LABEL, MONO, T } from '../theme';
import {
  DIFFICULTY_DE, PLANTS, SEASONS, SUN_DE, SUN_ICON, WATER_ICON,
  companionReason, pairScore, searchPlants,
} from '../data/plants';
import { FEEDERS, MONTHS_DE_SHORT, monthRangeLabel } from '../data/plantDetails';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { TabBar } from '../components/TabBar';
import { getFavorites, toggleFavorite } from '../components/PlantPicker';

const card = { background:T.panel, border:`1px solid ${T.border}`, borderRadius:18 };

/** 12-month strip: when to pre-grow, when to sow, when to pick. */
function SeasonStrip({ plant }) {
  const now = new Date().getMonth();
  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(12,1fr)', gap:2 }}>
        {MONTHS_DE_SHORT.map((m, i) => (
          <div key={m} style={{ ...MONO, fontSize:8, textAlign:'center', color:i === now ? T.terra : T.inkMute, fontWeight:i === now ? 700 : 400 }}>
            {m[0]}
          </div>
        ))}
      </div>
      {[
        ['Vorziehen', plant.precultureMonths, T.ochre],
        ['Aussaat', plant.sowMonths, T.green],
        ['Ernte', plant.harvestMonths, T.terra],
      ].map(([label, months, color]) => (
        <div key={label} style={{ display:'flex', alignItems:'center', gap:8, marginTop:4 }}>
          <div style={{ ...MONO, fontSize:8.5, color:T.inkMute, width:52, flexShrink:0 }}>{label}</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(12,1fr)', gap:2, flex:1 }}>
            {Array.from({ length:12 }).map((_, i) => (
              <div key={i} style={{
                height:8, borderRadius:2,
                background:months.includes(i) ? color : 'var(--border)',
                outline:i === now ? `1px solid ${T.terra}` : 'none',
              }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PlantCard({ plant, open, onToggle, favs, setFavs }) {
  const good = PLANTS.filter(o => o.id !== plant.id && pairScore(plant.id, o.id) === 1);
  const bad = PLANTS.filter(o => o.id !== plant.id && pairScore(plant.id, o.id) === -1);
  const isFav = favs.includes(plant.id);

  return (
    <div style={{ ...card, overflow:'hidden' }}>
      <button onClick={onToggle} aria-expanded={open}
        style={{ display:'flex', gap:13, alignItems:'flex-start', width:'100%', textAlign:'left', padding:16, background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', color:T.ink }}>
        <span aria-hidden="true" style={{
          width:50, height:50, borderRadius:14, flexShrink:0,
          background:`radial-gradient(circle at 32% 26%, oklch(0.80 0.10 ${plant.hue}), oklch(0.52 0.14 ${plant.hue}))`,
          display:'flex', alignItems:'center', justifyContent:'center',
          fontFamily:"'Fraunces',serif", fontStyle:'italic', color:'#fff', fontSize:20,
        }}>{plant.glyph}</span>

        <span style={{ flex:1, minWidth:0 }}>
          <span style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
            <span style={{ fontFamily:"'Fraunces',serif", fontSize:18, fontWeight:500 }}>{plant.de}</span>
            <span style={{ color:T.inkMute, fontSize:13, flexShrink:0 }}>{open ? '▲' : '▼'}</span>
          </span>
          <span style={{ ...MONO, display:'flex', gap:9, marginTop:4, flexWrap:'wrap', fontSize:10, color:T.inkDim }}>
            <span>{SUN_ICON[plant.sun]} {SUN_DE[plant.sun]}</span>
            <span>{WATER_ICON[plant.water]}</span>
            <span>↔ {plant.spacing_cm} cm</span>
            {plant.yield > 0 && <span style={{ color:T.green }}>~{plant.yield} kg</span>}
          </span>
          <span style={{ display:'flex', gap:4, marginTop:6, flexWrap:'wrap' }}>
            {SEASONS.filter(s => plant.seasons.includes(s.id)).map(s => (
              <span key={s.id} style={{ ...MONO, fontSize:8.5, padding:'3px 8px', borderRadius:999, background:`oklch(0.85 0.07 ${s.hue})`, color:`oklch(0.32 0.09 ${s.hue})`, fontWeight:700 }}>
                {s.de.toUpperCase()}
              </span>
            ))}
            <span style={{ ...MONO, fontSize:8.5, padding:'3px 8px', borderRadius:999, background:T.bg, border:`1px solid ${T.border}`, color:T.inkDim, fontWeight:700 }}>
              {DIFFICULTY_DE[plant.difficulty].toUpperCase()}
            </span>
          </span>
          <span style={{ display:'block', fontSize:12.5, color:T.inkDim, lineHeight:1.55, marginTop:9 }}>{plant.description}</span>
        </span>
      </button>

      <div style={{ padding:'0 16px 12px', display:'flex', justifyContent:'flex-end' }}>
        <button onClick={() => setFavs(toggleFavorite(plant.id))}
          aria-label={isFav ? `${plant.de} aus Favoriten entfernen` : `${plant.de} zu Favoriten`}
          style={{ minHeight:38, padding:'0 14px', borderRadius:999, border:`1px solid ${isFav ? T.warnBorder : T.border}`, background:isFav ? T.warnBg : 'transparent', color:isFav ? T.ochre : T.inkMute, cursor:'pointer', fontSize:12, fontWeight:600, fontFamily:'inherit' }}>
          {isFav ? '★ Favorit' : '☆ Merken'}
        </button>
      </div>

      {open && (
        <div style={{ padding:'0 16px 16px', borderTop:`1px solid ${T.border}`, paddingTop:14 }}>
          <div style={{ ...LABEL, marginBottom:8 }}>Gartenjahr</div>
          <SeasonStrip plant={plant} />

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, margin:'14px 0' }}>
            {[
              ['Aussaat', monthRangeLabel(plant.sowMonths)],
              ['Ernte', plant.harvestMonths.length ? monthRangeLabel(plant.harvestMonths) : '—'],
              ['Saattiefe', plant.sowDepth > 0 ? `${plant.sowDepth} cm` : 'Lichtkeimer'],
              ['Wurzeltiefe', `${plant.rootDepth_cm} cm`],
              ['Wuchshöhe', `${plant.height_cm} cm`],
              ['Nährstoffe', FEEDERS[plant.feeder]?.de],
              ['Reifezeit', plant.harvestWeeks > 0 ? `${plant.harvestWeeks} Wochen` : '—'],
              ['Familie', plant.family],
            ].map(([k, v]) => (
              <div key={k} style={{ background:T.bg, borderRadius:10, padding:'9px 11px' }}>
                <div style={{ ...LABEL, fontSize:8.5 }}>{k}</div>
                <div style={{ ...MONO, fontSize:11.5, fontWeight:600, marginTop:2 }}>{v}</div>
              </div>
            ))}
          </div>

          <div style={{ ...LABEL, marginBottom:6 }}>Pflege</div>
          <p style={{ fontSize:12.5, color:T.inkDim, lineHeight:1.6, marginBottom:14 }}>{plant.careNotes}</p>

          {good.length > 0 && (
            <div style={{ marginBottom:12 }}>
              <div style={{ ...LABEL, color:T.good, marginBottom:7 }}>✓ Gute Nachbarn</div>
              <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                {good.map(o => (
                  <div key={o.id} style={{ display:'flex', alignItems:'flex-start', gap:8, flexWrap:'wrap' }}>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:12, fontWeight:600, color:T.good, background:T.goodBg, borderRadius:999, padding:'4px 10px', flexShrink:0 }}>
                      <span style={{ fontFamily:"'Fraunces',serif", fontStyle:'italic' }}>{o.glyph}</span>{o.de}
                    </span>
                    {companionReason(plant.id, o.id) && (
                      <span style={{ fontSize:11.5, color:T.inkDim, lineHeight:1.45, paddingTop:3 }}>{companionReason(plant.id, o.id)}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {bad.length > 0 && (
            <div>
              <div style={{ ...LABEL, color:T.bad, marginBottom:7 }}>✗ Nicht daneben pflanzen</div>
              <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                {bad.map(o => (
                  <div key={o.id} style={{ display:'flex', alignItems:'flex-start', gap:8, flexWrap:'wrap' }}>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:12, fontWeight:600, color:T.bad, background:T.badBg, borderRadius:999, padding:'4px 10px', flexShrink:0 }}>
                      <span style={{ fontFamily:"'Fraunces',serif", fontStyle:'italic' }}>{o.glyph}</span>{o.de}
                    </span>
                    {companionReason(plant.id, o.id) && (
                      <span style={{ fontSize:11.5, color:T.inkDim, lineHeight:1.45, paddingTop:3 }}>{companionReason(plant.id, o.id)}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PlantsPage() {
  const mobile = useBreakpoint();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') || '');
  const [filter, setFilter] = useState('all');
  const [openId, setOpenId] = useState(null);
  const [favs, setFavs] = useState(getFavorites);
  const month = new Date().getMonth();

  // Keep the URL in sync so a shared link reopens the same search.
  useEffect(() => {
    const next = new URLSearchParams(params);
    if (query) next.set('q', query); else next.delete('q');
    setParams(next, { replace:true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const list = useMemo(() => {
    let out = PLANTS;
    if (filter === 'now') out = out.filter(p => p.sowMonths.includes(month) || p.precultureMonths.includes(month));
    else if (filter === 'easy') out = out.filter(p => p.difficulty === 1);
    else if (filter === 'fav') out = out.filter(p => favs.includes(p.id));
    else if (SEASONS.some(s => s.id === filter)) out = out.filter(p => p.seasons.includes(filter));
    return searchPlants(out, query);
  }, [filter, query, favs, month]);

  const FILTERS = [
    { id:'all', label:`Alle (${PLANTS.length})` },
    { id:'now', label:'Jetzt säen' },
    { id:'easy', label:'Für Einsteiger' },
    { id:'fav', label:`★ Favoriten${favs.length ? ` (${favs.length})` : ''}` },
    ...SEASONS.map(s => ({ id:s.id, label:s.de })),
  ];

  return (
    <div style={{
      minHeight:'100vh', background:T.bg,
      padding:mobile
        ? `calc(14px + var(--safe-t)) 16px calc(var(--tabbar-h) + 16px)`
        : '30px 28px calc(var(--tabbar-h) + 28px)',
    }}>
      <div style={{ maxWidth:820, margin:'0 auto' }}>
        <div style={LABEL}>Pflanzenlexikon</div>
        <h1 style={{ fontFamily:"'Fraunces',serif", fontSize:mobile ? 28 : 40, margin:'6px 0 6px', fontWeight:500 }}>
          <em style={{ color:T.green, fontStyle:'italic' }}>Pflanzen</em>
        </h1>
        <p style={{ fontSize:13, color:T.inkDim, lineHeight:1.55, marginBottom:16 }}>
          Aussaatzeiten, Pflege und Mischkultur für {PLANTS.length} Kulturen im Hochbeet.
        </p>

        <div style={{ position:'sticky', top:0, zIndex:5, background:T.bg, paddingTop:6, paddingBottom:10 }}>
          <div style={{ position:'relative', marginBottom:8 }}>
            <span aria-hidden="true" style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:T.inkMute, fontSize:15 }}>⌕</span>
            <input value={query} onChange={e => setQuery(e.target.value)} type="search"
              placeholder="Suchen — Name, Familie oder Eigenschaft" aria-label="Pflanze suchen"
              style={{ width:'100%', padding:'13px 40px 13px 38px', borderRadius:14, border:`1px solid ${T.border}`, background:T.panel, color:T.ink, outline:'none', minHeight:48 }} />
            {query && (
              <button onClick={() => setQuery('')} aria-label="Suche löschen"
                style={{ position:'absolute', right:6, top:'50%', transform:'translateY(-50%)', width:34, height:34, borderRadius:17, border:'none', background:'transparent', color:T.inkMute, fontSize:16, cursor:'pointer' }}>×</button>
            )}
          </div>
          <div className="hscroll" style={{ display:'flex', gap:6 }}>
            {FILTERS.map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)} aria-pressed={filter === f.id}
                style={{ padding:'8px 14px', borderRadius:999, fontSize:12, fontWeight:600, fontFamily:'inherit', flexShrink:0, cursor:'pointer', minHeight:38,
                  background:filter === f.id ? T.green : T.panel, color:filter === f.id ? 'var(--panel)' : T.ink,
                  border:`1px solid ${filter === f.id ? 'transparent' : T.border}` }}>{f.label}</button>
            ))}
          </div>
        </div>

        {list.length === 0 ? (
          <div style={{ ...card, padding:28, textAlign:'center', color:T.inkMute, fontSize:13 }}>
            Nichts gefunden für „{query}".
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {list.map(p => (
              <PlantCard key={p.id} plant={p} favs={favs} setFavs={setFavs}
                open={openId === p.id} onToggle={() => setOpenId(o => (o === p.id ? null : p.id))} />
            ))}
          </div>
        )}
      </div>
      <TabBar active="plants" />
    </div>
  );
}
