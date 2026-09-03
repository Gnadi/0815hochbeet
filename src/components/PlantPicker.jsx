import { useMemo, useState } from 'react';
import { T, MONO } from '../theme';
import {
  DIFFICULTY_DE, PLANTS, SEASONS, SUN_ICON, WATER_ICON,
  pairScore, plantById, searchPlants,
} from '../data/plants';
import { monthRangeLabel } from '../data/plantDetails';

const FAV_KEY = 'hb_fav_plants';

export function getFavorites() {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch { return []; }
}
export function toggleFavorite(id) {
  const favs = getFavorites();
  const next = favs.includes(id) ? favs.filter(f => f !== id) : [...favs, id];
  try { localStorage.setItem(FAV_KEY, JSON.stringify(next)); } catch {}
  return next;
}

/** Green when it likes every neighbour already in the bed, red when it clashes. */
function companionVerdict(plantId, placedIds) {
  let good = 0;
  const clashes = [];
  for (const other of placedIds) {
    const s = pairScore(plantId, other);
    if (s > 0) good++;
    else if (s < 0) clashes.push(other);
  }
  if (clashes.length) return { tone: 'bad', clashes, good };
  if (good) return { tone: 'good', clashes, good };
  return { tone: 'neutral', clashes, good };
}

/**
 * The plant list, searchable and filtered.
 *
 * Scrolling 22 tiles to find "Rucola" was the slowest part of planting on a
 * phone, so this leads with a search box, a "was geht jetzt" filter driven by
 * the real sowing calendar, and a marker for anything that clashes with what
 * is already in the bed.
 */
export function PlantPicker({ season, placedIds = [], armedPlant, onPick, bedHeightCm, compact = false }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('season');
  const [favs, setFavs] = useState(getFavorites);
  const month = new Date().getMonth();

  const list = useMemo(() => {
    let out = PLANTS;
    if (filter === 'season') out = out.filter(p => p.seasons.includes(season));
    else if (filter === 'now') out = out.filter(p => p.sowMonths.includes(month) || p.precultureMonths.includes(month));
    else if (filter === 'easy') out = out.filter(p => p.difficulty === 1);
    else if (filter === 'fast') out = out.filter(p => p.harvestWeeks > 0 && p.harvestWeeks <= 8);
    else if (filter === 'fits') out = out.filter(p => companionVerdict(p.id, placedIds).tone !== 'bad');
    else if (filter === 'fav') out = out.filter(p => favs.includes(p.id));
    out = searchPlants(out, query);
    // Recommended order: no clashes first, then good companions, then name.
    return [...out].sort((a, b) => {
      const va = companionVerdict(a.id, placedIds);
      const vb = companionVerdict(b.id, placedIds);
      const rank = v => (v.tone === 'bad' ? 2 : v.tone === 'good' ? 0 : 1);
      return rank(va) - rank(vb) || vb.good - va.good || a.de.localeCompare(b.de, 'de');
    });
  }, [filter, query, season, placedIds, favs, month]);

  const FILTERS = [
    { id:'season', label: SEASONS.find(s => s.id === season)?.de || 'Saison' },
    { id:'now',    label:'Jetzt säen' },
    { id:'fits',   label:'Passt dazu' },
    { id:'easy',   label:'Einfach' },
    { id:'fast',   label:'Schnell' },
    { id:'fav',    label:`★ ${favs.length || ''}`.trim() },
    { id:'all',    label:'Alle' },
  ];

  return (
    <div>
      <div style={{ position:'sticky', top:0, zIndex:2, background:T.paper, paddingBottom:8 }}>
        <div style={{ position:'relative', marginBottom:8 }}>
          <span aria-hidden="true" style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:T.inkMute, fontSize:15 }}>⌕</span>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            type="search"
            placeholder="Pflanze suchen — z. B. Salat, Kräuter, schnell"
            aria-label="Pflanze suchen"
            style={{
              width:'100%', padding:'13px 40px 13px 38px', borderRadius:14,
              border:`1px solid ${T.border}`, background:T.panel, color:T.ink,
              outline:'none', minHeight:48,
            }}
          />
          {query && (
            <button onClick={() => setQuery('')} aria-label="Suche löschen"
              style={{ position:'absolute', right:6, top:'50%', transform:'translateY(-50%)', width:34, height:34, borderRadius:17, border:'none', background:'transparent', color:T.inkMute, fontSize:16, cursor:'pointer' }}>×</button>
          )}
        </div>

        <div className="hscroll" style={{ display:'flex', gap:6, paddingBottom:2 }}>
          {FILTERS.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              style={{
                padding:'8px 14px', borderRadius:999, fontSize:12, fontWeight:600,
                fontFamily:'inherit', flexShrink:0, cursor:'pointer', minHeight:38,
                background:filter === f.id ? T.green : T.panel,
                color:filter === f.id ? 'var(--panel)' : T.ink,
                border:`1px solid ${filter === f.id ? 'transparent' : T.border}`,
              }}>{f.label}</button>
          ))}
        </div>
      </div>

      {list.length === 0 && (
        <div style={{ padding:'28px 12px', textAlign:'center', color:T.inkMute, fontSize:13 }}>
          Nichts gefunden. Versuch einen anderen Filter oder Suchbegriff.
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:compact ? '1fr' : 'repeat(auto-fill,minmax(150px,1fr))', gap:8, paddingBottom:8 }}>
        {list.map(p => {
          const v = companionVerdict(p.id, placedIds);
          const armed = armedPlant === p.id;
          const tooDeep = bedHeightCm && p.rootDepth_cm > bedHeightCm;
          return (
            <button
              key={p.id}
              onClick={() => onPick(p.id)}
              aria-pressed={armed}
              style={{
                display:'flex', alignItems:'center', gap:11, textAlign:'left',
                padding:'10px 12px', borderRadius:14, cursor:'pointer', minHeight:64,
                background:armed ? T.goodBg : T.panel,
                border:`1.5px solid ${armed ? T.green : T.border}`,
                fontFamily:'inherit', color:T.ink, position:'relative',
              }}
            >
              <span aria-hidden="true" style={{
                width:38, height:38, borderRadius:'50%', flexShrink:0,
                background:`radial-gradient(circle at 35% 30%, oklch(0.80 0.10 ${p.hue}), oklch(0.50 0.15 ${p.hue}))`,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontFamily:"'Fraunces',serif", fontStyle:'italic', color:'#fff', fontSize:16,
              }}>{p.glyph[0]}</span>

              <span style={{ flex:1, minWidth:0 }}>
                <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontSize:13.5, fontWeight:600 }}>{p.de}</span>
                  {v.tone === 'good' && <span title="Guter Nachbar" style={{ width:7, height:7, borderRadius:4, background:T.good }} />}
                  {v.tone === 'bad' && <span title={`Konflikt mit ${v.clashes.map(c => plantById(c)?.de).join(', ')}`} style={{ width:7, height:7, borderRadius:4, background:T.bad }} />}
                </span>
                <span style={{ ...MONO, display:'block', fontSize:9.5, color:T.inkMute, marginTop:3 }}>
                  {SUN_ICON[p.sun]} {WATER_ICON[p.water]} · {p.spacing_cm} cm · {DIFFICULTY_DE[p.difficulty]}
                </span>
                <span style={{ ...MONO, display:'block', fontSize:9.5, color: p.sowMonths.includes(month) ? T.good : T.inkMute, marginTop:2 }}>
                  Saat {monthRangeLabel(p.sowMonths)}
                </span>
                {tooDeep && (
                  <span style={{ ...MONO, display:'block', fontSize:9.5, color:T.warn, marginTop:2 }}>
                    ⚠ braucht {p.rootDepth_cm} cm Erde
                  </span>
                )}
              </span>

              <span
                role="button"
                tabIndex={0}
                aria-label={favs.includes(p.id) ? `${p.de} aus Favoriten entfernen` : `${p.de} zu Favoriten`}
                onClick={e => { e.stopPropagation(); setFavs(toggleFavorite(p.id)); }}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setFavs(toggleFavorite(p.id)); } }}
                style={{ width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, color:favs.includes(p.id) ? T.ochre : T.inkMute, fontSize:15, cursor:'pointer' }}
              >{favs.includes(p.id) ? '★' : '☆'}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
