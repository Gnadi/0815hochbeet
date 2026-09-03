import { useState } from 'react';
import { MONO, T } from '../theme';
import { SEASONS, plantById } from '../data/plants';
import { getRotationAnalysis } from '../utils/rotationAdvice';
import { IconBtn, TrashIcon } from './Btn';

/** True-to-scale thumbnail of a bed — the old 8×4 mock grid told you nothing. */
export function BedMiniMap({ bed, season, height = 88 }) {
  const bw = bed.width || 120;
  const bh = bed.depth || 80;
  const cells = bed.seasonCells?.[season] || {};
  const items = Object.values(cells).filter(v => v && typeof v === 'object');

  return (
    <svg
      viewBox={`0 0 ${bw} ${bh}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ width:'100%', height, borderRadius:10, background:'var(--soil)', border:'1px solid var(--soil-line)' }}
      role="img"
      aria-label={`${items.length} Pflanzgruppen im Beet`}
    >
      {items.map((it, i) => {
        const p = plantById(it.plantId);
        if (!p) return null;
        return (
          <circle
            key={i}
            cx={it.x} cy={it.y} r={Math.max(2.5, p.spacing_cm / 2)}
            fill={`oklch(0.66 0.11 ${p.hue})`}
            stroke="rgba(255,255,255,0.35)" strokeWidth="0.6"
          />
        );
      })}
    </svg>
  );
}

function stats(bed, season) {
  const cells = bed.seasonCells?.[season] || {};
  const items = Object.values(cells).filter(v => v && typeof v === 'object');
  const count = items.reduce((s, v) => s + (v.count || 1), 0);
  const areaCm = items.reduce((s, v) => {
    const p = plantById(v.plantId);
    return p ? s + Math.PI * (p.spacing_cm / 2) ** 2 * (v.count || 1) : s;
  }, 0);
  const coverage = Math.min(100, Math.round((areaCm / ((bed.width || 120) * (bed.depth || 80))) * 100));
  const kinds = [...new Set(items.map(v => v.plantId))];
  const yieldKg = items.reduce((s, v) => s + (plantById(v.plantId)?.yield || 0) * (v.count || 1), 0);
  return { count, coverage, kinds, yieldKg };
}

export function BedCard({ bed, season, onOpen, onDelete }) {
  const [confirm, setConfirm] = useState(false);
  const s = stats(bed, season);
  const rotation = getRotationAnalysis(bed.seasonCells || {});
  const planted = Object.values(bed.seasonCells || {}).some(sc => Object.keys(sc || {}).length > 0);
  const seasonLabel = SEASONS.find(x => x.id === season)?.de;

  return (
    <div style={{
      background:T.panel, border:`1px solid ${T.border}`, borderRadius:18,
      boxShadow:'var(--shadow)', overflow:'hidden',
    }}>
      <button
        onClick={onOpen}
        style={{ display:'block', width:'100%', textAlign:'left', background:'none', border:'none', padding:16, cursor:'pointer', fontFamily:'inherit', color:T.ink }}
      >
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10, marginBottom:12 }}>
          <div style={{ minWidth:0 }}>
            <h3 style={{ fontFamily:"'Fraunces',serif", fontSize:19, margin:0, fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{bed.name}</h3>
            <div style={{ ...MONO, fontSize:10, color:T.inkMute, marginTop:3 }}>
              {bed.width} × {bed.depth} cm · {seasonLabel}
            </div>
          </div>
          <div style={{
            width:44, height:44, borderRadius:22, flexShrink:0,
            background:s.coverage > 0 ? T.green : T.bg,
            color:s.coverage > 0 ? 'var(--panel)' : T.inkMute,
            border:s.coverage > 0 ? 'none' : `1px solid ${T.border}`,
            display:'flex', alignItems:'center', justifyContent:'center',
            ...MONO, fontSize:11, fontWeight:700,
          }}>{s.coverage}%</div>
        </div>

        <BedMiniMap bed={bed} season={season} />

        <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:12, flexWrap:'wrap' }}>
          <div style={{ display:'flex' }}>
            {s.kinds.slice(0, 6).map((pid, k) => {
              const p = plantById(pid);
              return p ? (
                <span key={pid} aria-hidden="true" style={{
                  width:24, height:24, borderRadius:12, marginLeft:k ? -8 : 0,
                  background:`oklch(0.64 0.1 ${p.hue})`, border:`2px solid ${T.panel}`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontFamily:"'Fraunces',serif", fontStyle:'italic', color:'#fff', fontSize:11,
                }}>{p.glyph[0]}</span>
              ) : null;
            })}
          </div>
          <div style={{ ...MONO, fontSize:10, color:T.inkMute }}>
            {s.count > 0 ? `${s.count} Pflanzen · ~${s.yieldKg.toFixed(1)} kg` : 'Noch leer'}
          </div>
        </div>

        {planted && rotation.warnings.length > 0 && (
          <div style={{ ...MONO, fontSize:9.5, color:T.warn, fontWeight:700, marginTop:8 }}>
            ↻ Fruchtfolge · {rotation.warnings.length} Hinweis{rotation.warnings.length > 1 ? 'e' : ''}
          </div>
        )}
      </button>

      {onDelete && (
        <div style={{ display:'flex', justifyContent:'flex-end', gap:6, padding:'0 12px 12px' }}>
          {confirm ? (
            <>
              <button onClick={() => setConfirm(false)}
                style={{ minHeight:38, padding:'0 14px', borderRadius:999, border:`1px solid ${T.border}`, background:T.panel, color:T.inkDim, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                Abbrechen
              </button>
              <button onClick={() => onDelete(bed.id)}
                style={{ minHeight:38, padding:'0 14px', borderRadius:999, border:`1px solid ${T.badBorder}`, background:T.badBg, color:T.bad, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                Löschen
              </button>
            </>
          ) : (
            <IconBtn size={38} tone="plain" label={`${bed.name} löschen`} onClick={() => setConfirm(true)}>
              <TrashIcon size={15} />
            </IconBtn>
          )}
        </div>
      )}
    </div>
  );
}
