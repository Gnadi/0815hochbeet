import { T, MONO } from '../theme';
import { plantById } from '../data/plants';
import { MONTHS_DE_SHORT } from '../data/plantDetails';
import { formatRange, parseDate } from '../lib/timeline';

/**
 * A year as a Gantt chart: one bar per planting from its start to its end, so
 * Vor-, Haupt- und Nachkultur on the same bed read left to right.
 */
export function Timeline({ plantings, year, markerDate, onPick, emptyText }) {
  if (!plantings.length) {
    return (
      <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:16, padding:14, fontSize:12.5, color:T.inkDim, lineHeight:1.55 }}>
        {emptyText || `${year} ist noch nichts geplant.`}
      </div>
    );
  }
  const y0 = new Date(year, 0, 1).getTime();
  const len = new Date(year + 1, 0, 1).getTime() - y0;
  const frac = (str) => Math.max(0, Math.min(1, (parseDate(str).getTime() - y0) / len));
  const marker = markerDate && markerDate.startsWith(String(year)) ? frac(markerDate) : null;

  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(12, 1fr)', marginLeft:96, marginBottom:4 }}>
        {MONTHS_DE_SHORT.map(m => <div key={m} style={{ ...MONO, fontSize:8.5, color:T.inkMute, textAlign:'center' }}>{m[0]}</div>)}
      </div>
      {plantings.map(p => {
        const plant = plantById(p.plantId);
        if (!plant) return null;
        const a = frac(p.start), b = frac(p.end);
        return (
          <button key={p.id} onClick={() => onPick?.(p)} disabled={!onPick}
            title={`${plant.de}: ${formatRange(p)}`}
            style={{ display:'flex', alignItems:'center', width:'100%', background:'none', border:'none', padding:'5px 0', cursor:onPick ? 'pointer' : 'default', fontFamily:'inherit', color:T.ink }}>
            <span style={{ width:96, flexShrink:0, fontSize:12, fontWeight:600, textAlign:'left', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', paddingRight:6 }}>
              {plant.de}{(p.count || 1) > 1 ? ` ×${p.count}` : ''}
            </span>
            <span style={{ position:'relative', flex:1, height:18, background:T.bg, borderRadius:6 }}>
              <span style={{ position:'absolute', left:`${a * 100}%`, width:`${Math.max(1.5, (b - a) * 100)}%`, top:2, bottom:2, borderRadius:5, background:`oklch(0.66 0.11 ${plant.hue})` }} />
              {marker !== null && <span aria-hidden="true" style={{ position:'absolute', left:`${marker * 100}%`, top:-2, bottom:-2, width:1.5, background:T.terra }} />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
