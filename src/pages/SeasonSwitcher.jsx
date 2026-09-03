import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LABEL, MONO, T } from '../theme';
import { SEASONS, plantById } from '../data/plants';
import { FEEDERS } from '../data/plantDetails';
import { useBedRecord } from '../hooks/useBeds';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { saveBed } from '../lib/beds';
import { getRotationAnalysis, familyDe } from '../utils/rotationAdvice';
import { BedMiniMap } from '../components/BedCard';
import { TabBar } from '../components/TabBar';
import { Btn, IconBtn } from '../components/Btn';
import { useToast } from '../components/Toast';

const card = { background:T.panel, border:`1px solid ${T.border}`, borderRadius:18, padding:16 };

const NEXT_SEASON = { spring:'summer', summer:'autumn', autumn:'winter', winter:'spring' };

/** What to grow next, by the Starkzehrer → Mittelzehrer → Schwachzehrer rule. */
const FEEDER_SEQUENCE = { heavy:'medium', medium:'light', light:'fixer', fixer:'heavy' };

function summarize(bed, seasonId) {
  const items = Object.values(bed.seasonCells?.[seasonId] || {}).filter(v => v && typeof v === 'object');
  const plants = items.map(v => plantById(v.plantId)).filter(Boolean);
  const count = items.reduce((s, v) => s + (v.count || 1), 0);
  const families = [...new Set(plants.map(p => p.family))];
  const feeders = [...new Set(plants.map(p => p.feeder))];
  const yieldKg = items.reduce((s, v) => s + (plantById(v.plantId)?.yield || 0) * (v.count || 1), 0);
  return { items, plants, count, families, feeders, yieldKg, kinds:[...new Set(plants.map(p => p.id))] };
}

export default function SeasonSwitcher() {
  const { bedId } = useParams();
  const navigate = useNavigate();
  const mobile = useBreakpoint();
  const toast = useToast();
  const bed = useBedRecord(bedId);
  // Open on the bed's own season, or the first one that has plants in it —
  // landing on an empty "Sommer" told the gardener nothing.
  const [active, setActive] = useState(() => {
    if (!bed) return 'summer';
    const filled = SEASONS.map(s => s.id).find(id => Object.keys(bed.seasonCells?.[id] || {}).length > 0);
    return Object.keys(bed.seasonCells?.[bed.season] || {}).length > 0 ? bed.season : (filled || bed.season || 'summer');
  });

  const summaries = useMemo(
    () => (bed ? Object.fromEntries(SEASONS.map(s => [s.id, summarize(bed, s.id)])) : {}),
    [bed],
  );
  const rotation = useMemo(() => (bed ? getRotationAnalysis(bed.seasonCells) : { score:100, warnings:[] }), [bed]);

  if (!bed) {
    return (
      <div style={{ minHeight:'100vh', background:T.bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ ...MONO, fontSize:12, color:T.inkMute }}>Beet wird geladen…</div>
      </div>
    );
  }

  function copySeason(from, to) {
    const prev = bed.seasonCells;
    saveBed(bedId, { seasonCells: { ...prev, [to]: JSON.parse(JSON.stringify(prev[from] || {})) } });
    toast({
      message:`${SEASONS.find(s => s.id === from).de} → ${SEASONS.find(s => s.id === to).de} übernommen`,
      tone:'good',
      action: () => saveBed(bedId, { seasonCells: prev }),
    });
  }

  const current = summaries[active];
  const next = NEXT_SEASON[active];
  const suggestedFeeder = current.feeders.length === 1 ? FEEDER_SEQUENCE[current.feeders[0]] : null;

  return (
    <div style={{
      minHeight:'100vh', background:T.bg,
      padding:mobile
        ? `calc(14px + var(--safe-t)) 16px calc(var(--tabbar-h) + 16px)`
        : '30px 28px calc(var(--tabbar-h) + 28px)',
    }}>
      <div style={{ maxWidth:1100, margin:'0 auto' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
          <IconBtn size={40} tone="plain" label="Zurück zum Beet" onClick={() => navigate(`/bed/${bedId}`)}>‹</IconBtn>
          <div style={{ minWidth:0 }}>
            <div style={LABEL}>{bed.name} · Jahresplan</div>
            <h1 style={{ fontFamily:"'Fraunces',serif", fontSize:mobile ? 24 : 34, margin:'3px 0 0', fontWeight:500 }}>
              Über das <em style={{ color:T.green, fontStyle:'italic' }}>Jahr</em>
            </h1>
          </div>
        </div>

        {/* Rotation health */}
        <div style={{ ...card, marginBottom:16, display:'flex', alignItems:'center', gap:14 }}>
          <div style={{
            width:52, height:52, borderRadius:26, flexShrink:0,
            background:rotation.score >= 75 ? T.goodBg : rotation.score >= 50 ? T.warnBg : T.badBg,
            border:`1px solid ${rotation.score >= 75 ? T.goodBorder : rotation.score >= 50 ? T.warnBorder : T.badBorder}`,
            color:rotation.score >= 75 ? T.good : rotation.score >= 50 ? T.warn : T.bad,
            display:'flex', alignItems:'center', justifyContent:'center', ...MONO, fontSize:14, fontWeight:700,
          }}>{rotation.score}</div>
          <div style={{ minWidth:0 }}>
            <div style={{ fontFamily:"'Fraunces',serif", fontSize:16, fontWeight:500 }}>
              {rotation.score >= 75 ? 'Gute Fruchtfolge' : rotation.score >= 50 ? 'Fruchtfolge prüfen' : 'Fruchtfolge verbessern'}
            </div>
            <div style={{ fontSize:12, color:T.inkDim, marginTop:3, lineHeight:1.5 }}>
              {rotation.warnings.length === 0
                ? 'Keine Pflanzenfamilie wiederholt sich über die Saisons.'
                : `${rotation.warnings.map(w => w.familyDe).join(', ')} ${rotation.warnings.length > 1 ? 'kommen' : 'kommt'} mehrfach vor.`}
            </div>
          </div>
        </div>

        {/* Season cards */}
        <div style={{ display:'grid', gridTemplateColumns:mobile ? '1fr 1fr' : 'repeat(4,1fr)', gap:12, marginBottom:18 }}>
          {SEASONS.map(s => {
            const sum = summaries[s.id];
            const on = active === s.id;
            return (
              <button key={s.id} onClick={() => setActive(s.id)} aria-pressed={on}
                style={{
                  ...card, padding:14, textAlign:'left', cursor:'pointer', fontFamily:'inherit', color:T.ink,
                  border:`${on ? 2 : 1}px solid ${on ? T.green : T.border}`,
                }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                  <span style={{ fontFamily:"'Fraunces',serif", fontSize:17, fontStyle:'italic', color:on ? T.green : T.ink }}>{s.de}</span>
                  <span aria-hidden="true" style={{ color:`oklch(0.58 0.13 ${s.hue})`, fontSize:15 }}>{s.glyph}</span>
                </div>
                <BedMiniMap bed={bed} season={s.id} height={66} />
                <div style={{ ...MONO, fontSize:9.5, color:T.inkMute, marginTop:9 }}>
                  {sum.count > 0 ? `${sum.count} Pflanzen · ~${sum.yieldKg.toFixed(1)} kg` : 'leer'}
                </div>
              </button>
            );
          })}
        </div>

        {/* Detail for the active season */}
        <div style={{ ...card, marginBottom:12 }}>
          <div style={{ ...LABEL, marginBottom:10 }}>
            {SEASONS.find(s => s.id === active).de} · {current.kinds.length} Sorten
          </div>

          {current.kinds.length === 0 ? (
            <div style={{ fontSize:13, color:T.inkDim, lineHeight:1.55 }}>
              Für diese Saison ist noch nichts geplant. Übernimm eine andere Saison als Startpunkt oder plane sie direkt im Beet.
            </div>
          ) : (
            <>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:12 }}>
                {current.kinds.map(pid => {
                  const p = plantById(pid);
                  return p ? (
                    <span key={pid} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'6px 11px', borderRadius:999, background:T.bg, border:`1px solid ${T.border}`, fontSize:12 }}>
                      <span aria-hidden="true" style={{ width:14, height:14, borderRadius:7, background:`oklch(0.64 0.1 ${p.hue})` }} />
                      {p.de}
                      <span style={{ ...MONO, fontSize:9, color:T.inkMute }}>{FEEDERS[p.feeder]?.short}</span>
                    </span>
                  ) : null;
                })}
              </div>
              <div style={{ ...MONO, fontSize:10.5, color:T.inkMute }}>
                Familien: {current.families.map(familyDe).join(', ')}
              </div>
            </>
          )}

          {suggestedFeeder && (
            <div style={{ marginTop:14, padding:13, borderRadius:14, background:T.goodBg, border:`1px solid ${T.goodBorder}` }}>
              <div style={{ ...LABEL, color:T.good, marginBottom:5 }}>Empfehlung für {SEASONS.find(s => s.id === next).de}</div>
              <div style={{ fontSize:12.5, color:T.inkDim, lineHeight:1.55 }}>
                Auf {FEEDERS[current.feeders[0]].de} folgen am besten {FEEDERS[suggestedFeeder].de}. {FEEDERS[current.feeders[0]].tip}
              </div>
            </div>
          )}
        </div>

        {/* Copy actions */}
        <div style={{ ...card }}>
          <div style={{ ...LABEL, marginBottom:10 }}>Bepflanzung übernehmen</div>
          <div style={{ fontSize:12.5, color:T.inkDim, lineHeight:1.55, marginBottom:12 }}>
            Kopiere <strong>{SEASONS.find(s => s.id === active).de}</strong> in eine andere Saison und passe sie dort an — schneller als von vorn zu planen.
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {SEASONS.filter(s => s.id !== active).map(s => (
              <Btn key={s.id} size="sm" disabled={current.count === 0} onClick={() => copySeason(active, s.id)}>
                → {s.de}
              </Btn>
            ))}
          </div>
          <div style={{ marginTop:14 }}>
            <Btn variant="primary" full onClick={() => navigate(`/bed/${bedId}`)}>Im Beet bearbeiten</Btn>
          </div>
        </div>

        {rotation.warnings.length > 0 && (
          <div style={{ marginTop:16 }}>
            <div style={{ ...LABEL, marginBottom:10 }}>Hinweise</div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {rotation.warnings.map((w, i) => (
                <div key={i} style={{ padding:14, borderRadius:14, background:T.warnBg, border:`1px solid ${T.warnBorder}` }}>
                  <div style={{ fontFamily:"'Fraunces',serif", fontSize:15, fontWeight:500 }}>{w.familyDe}</div>
                  <div style={{ fontSize:11.5, color:T.inkDim, marginTop:4 }}>Mehrfach in: {w.seasons.join(', ')}.</div>
                  {w.tip && <div style={{ fontSize:11.5, color:T.inkDim, marginTop:5, lineHeight:1.55 }}>{w.tip}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <TabBar active="beds" />
    </div>
  );
}
