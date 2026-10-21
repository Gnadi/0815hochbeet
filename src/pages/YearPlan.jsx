import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LABEL, MONO, T } from '../theme';
import { plantById } from '../data/plants';
import { FEEDERS } from '../data/plantDetails';
import { useBedRecord } from '../hooks/useBeds';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { saveBed, setBedView } from '../lib/beds';
import { inYear, mainYear, parseDate, toDateStr } from '../lib/timeline';
import { ageAdvice, bedAge } from '../utils/bedAge';
import { familyDe, getRotationAnalysis, nextYearAdvice } from '../utils/rotationAdvice';
import { Timeline } from '../components/Timeline';
import { TabBar } from '../components/TabBar';
import { Btn, IconBtn } from '../components/Btn';
import { useToast } from '../components/Toast';

const card = { background:T.panel, border:`1px solid ${T.border}`, borderRadius:18, padding:16 };

/**
 * One bed across the years: where it stands in its Befüllungs-cycle, what grew
 * in it the last seasons, whether this year's plan respects the rotation
 * pauses, and the year's Vor-, Haupt- und Nachkultur on a timeline.
 */
export default function YearPlan() {
  const { bedId } = useParams();
  const navigate = useNavigate();
  const mobile = useBreakpoint();
  const toast = useToast();
  const bed = useBedRecord(bedId);
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);

  const yearPlantings = useMemo(
    () => (bed ? inYear(bed.plantings, year).sort((a, b) => a.start.localeCompare(b.start) || a.y - b.y) : []),
    [bed, year],
  );
  const rotation = useMemo(() => (bed ? getRotationAnalysis(bed.plantings, year) : { score:100, warnings:[] }), [bed, year]);
  const next = useMemo(() => (bed ? nextYearAdvice(bed.plantings, year) : { blocked:[] }), [bed, year]);

  /** Four years of history ending with the viewed one: families and feeder classes per year. */
  const history = useMemo(() => {
    if (!bed) return [];
    return [year - 3, year - 2, year - 1, year].map(y => {
      const plants = Object.values(bed.plantings)
        .filter(p => mainYear(p) === y)
        .map(p => plantById(p.plantId))
        .filter(Boolean);
      const unique = [...new Map(plants.map(p => [p.id, p])).values()];
      return {
        year: y,
        age: bedAge(bed, y),
        plants: unique,
        families: [...new Set(unique.filter(p => !p.perennial).map(p => p.family))],
      };
    });
  }, [bed, year]);

  if (!bed) {
    return (
      <div style={{ minHeight:'100vh', background:T.bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ ...MONO, fontSize:12, color:T.inkMute }}>Beet wird geladen…</div>
      </div>
    );
  }

  const age = bedAge(bed, year);
  const advice = ageAdvice(age);
  const nextAdvice = ageAdvice(bedAge(bed, year + 1));
  const tone = rotation.score >= 75 ? 'good' : rotation.score >= 50 ? 'warn' : 'bad';

  function openInBed(p) {
    const start = p.start < `${year}-01-01` ? `${year}-01-01` : p.start;
    setBedView(bedId, { year, month: parseDate(start).getMonth() });
    navigate(`/bed/${bedId}`);
  }

  function markRefilled() {
    saveBed(bedId, { filledYear: thisYear });
    toast({ message:`Befüllungsjahr auf ${thisYear} gesetzt.`, tone:'good' });
  }

  return (
    <div style={{
      minHeight:'100vh', background:T.bg,
      padding:mobile
        ? `calc(14px + var(--safe-t)) 16px calc(var(--tabbar-h) + 16px)`
        : '30px 28px calc(var(--tabbar-h) + 28px)',
    }}>
      <div style={{ maxWidth:1100, margin:'0 auto' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14, flexWrap:'wrap' }}>
          <IconBtn size={40} tone="plain" label="Zurück zum Beet" onClick={() => navigate(`/bed/${bedId}`)}>‹</IconBtn>
          <div style={{ minWidth:0, flex:'1 1 200px' }}>
            <div style={LABEL}>{bed.name} · Jahresplan</div>
            <h1 style={{ fontFamily:"'Fraunces',serif", fontSize:mobile ? 24 : 34, margin:'3px 0 0', fontWeight:500 }}>
              Über die <em style={{ color:T.green, fontStyle:'italic' }}>Jahre</em>
            </h1>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginLeft:mobile ? 50 : 0 }}>
            <IconBtn size={38} tone="plain" label="Vorheriges Jahr" onClick={() => setYear(y => y - 1)}>‹</IconBtn>
            <div style={{ fontFamily:"'Fraunces',serif", fontSize:18, fontWeight:500 }}>{year}</div>
            <IconBtn size={38} tone="plain" label="Nächstes Jahr" onClick={() => setYear(y => y + 1)}>›</IconBtn>
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:mobile ? '1fr' : '1fr 1fr', gap:12, marginBottom:16 }}>
          {/* Befüllungsjahr */}
          {advice && (
            <div style={{ ...card, background:advice.phase === 'rich' ? T.goodBg : T.warnBg, borderColor:advice.phase === 'rich' ? T.goodBorder : T.warnBorder }}>
              <div style={{ ...LABEL, color:advice.phase === 'rich' ? T.good : T.warn, marginBottom:6 }}>
                Befüllt {bed.filledYear} · {age}. Beetjahr
              </div>
              <div style={{ fontFamily:"'Fraunces',serif", fontSize:16, fontWeight:500 }}>{advice.title}</div>
              <div style={{ fontSize:12, color:T.inkDim, marginTop:5, lineHeight:1.55 }}>{advice.text}</div>
              <div style={{ ...MONO, fontSize:10.5, color:T.inkMute, marginTop:8 }}>
                Passend: {advice.ideal.map(f => FEEDERS[f].de).join(', ')}
              </div>
              {advice.refill && year === thisYear && (
                <div style={{ marginTop:10 }}><Btn size="sm" onClick={markRefilled}>✓ Heuer aufgefüllt</Btn></div>
              )}
            </div>
          )}

          {/* Rotation health */}
          <div style={{ ...card, display:'flex', alignItems:'center', gap:14 }}>
            <div style={{
              width:52, height:52, borderRadius:26, flexShrink:0,
              background:T[`${tone}Bg`], border:`1px solid ${T[`${tone}Border`]}`, color:T[tone],
              display:'flex', alignItems:'center', justifyContent:'center', ...MONO, fontSize:14, fontWeight:700,
            }}>{rotation.score}</div>
            <div style={{ minWidth:0 }}>
              <div style={{ fontFamily:"'Fraunces',serif", fontSize:16, fontWeight:500 }}>
                {tone === 'good' ? 'Gute Fruchtfolge' : tone === 'warn' ? 'Fruchtfolge prüfen' : 'Fruchtfolge verbessern'}
              </div>
              <div style={{ fontSize:12, color:T.inkDim, marginTop:3, lineHeight:1.5 }}>
                {rotation.warnings.length === 0
                  ? `Keine Pflanzenfamilie kommt ${year} zu früh in dieses Beet zurück.`
                  : `${rotation.warnings.length} Hinweis${rotation.warnings.length > 1 ? 'e' : ''} für ${year}.`}
              </div>
            </div>
          </div>
        </div>

        {rotation.warnings.length > 0 && (
          <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:16 }}>
            {rotation.warnings.map((w, i) => (
              <div key={i} style={{ padding:14, borderRadius:14, background:T.warnBg, border:`1px solid ${T.warnBorder}` }}>
                <div style={{ ...LABEL, color:T.warn, marginBottom:5 }}>{w.kind === 'rotation' ? 'Zu früh wieder im Beet' : 'Folgekultur'}</div>
                <div style={{ fontSize:12.5, color:T.ink, lineHeight:1.55 }}>{w.text}</div>
                {w.tip && <div style={{ fontSize:11.5, color:T.inkDim, marginTop:5, lineHeight:1.55 }}>{w.tip}</div>}
              </div>
            ))}
          </div>
        )}

        {/* Timeline */}
        <div style={{ ...card, marginBottom:16 }}>
          <div style={{ ...LABEL, marginBottom:10 }}>Zeitachse {year} · Vor-, Haupt- und Nachkultur</div>
          <Timeline
            plantings={yearPlantings}
            year={year}
            markerDate={year === thisYear ? toDateStr(new Date()) : null}
            onPick={openInBed}
            emptyText={`${year} ist in diesem Beet noch nichts geplant.`}
          />
        </div>

        {/* History */}
        <div style={{ ...card, marginBottom:16 }}>
          <div style={{ ...LABEL, marginBottom:10 }}>Fruchtfolge der letzten Jahre</div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {history.map(h => (
              <div key={h.year} style={{ display:'flex', gap:12, alignItems:'flex-start', paddingTop:10, borderTop:h.year === history[0].year ? 'none' : `1px solid ${T.border}` }}>
                <div style={{ width:58, flexShrink:0 }}>
                  <div style={{ fontFamily:"'Fraunces',serif", fontSize:16, fontWeight:500, color:h.year === year ? T.green : T.ink }}>{h.year}</div>
                  {h.age && <div style={{ ...MONO, fontSize:9.5, color:T.inkMute }}>{h.age}. Jahr</div>}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  {h.plants.length === 0 ? (
                    <div style={{ fontSize:12, color:T.inkMute }}>Nichts eingetragen.</div>
                  ) : (
                    <>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                        {h.plants.map(p => (
                          <span key={p.id} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'4px 9px', borderRadius:999, background:T.bg, border:`1px solid ${T.border}`, fontSize:11.5 }}>
                            <span aria-hidden="true" style={{ width:11, height:11, borderRadius:6, background:`oklch(0.64 0.1 ${p.hue})` }} />
                            {p.de}
                            <span style={{ ...MONO, fontSize:8.5, color:T.inkMute }}>{FEEDERS[p.feeder]?.short}</span>
                          </span>
                        ))}
                      </div>
                      {h.families.length > 0 && (
                        <div style={{ ...MONO, fontSize:10, color:T.inkMute, marginTop:6 }}>{h.families.map(familyDe).join(' · ')}</div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Next year */}
        <div style={{ ...card }}>
          <div style={{ ...LABEL, marginBottom:10 }}>Planung für {year + 1}</div>
          {nextAdvice && (
            <div style={{ fontSize:12.5, color:T.inkDim, lineHeight:1.55, marginBottom:10 }}>
              <strong style={{ color:T.ink }}>{nextAdvice.title}.</strong> Passend: {nextAdvice.ideal.map(f => FEEDERS[f].de).join(', ')}.
            </div>
          )}
          {next.blocked.length === 0 ? (
            <div style={{ fontSize:12.5, color:T.inkDim }}>Alle Pflanzenfamilien sind {year + 1} wieder erlaubt.</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {next.blocked.map(b => (
                <div key={b.family} style={{ fontSize:12.5, color:T.inkDim }}>
                  <strong style={{ color:T.ink }}>{b.familyDe}</strong> — Pause bis {b.freeFrom}
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop:14 }}>
            <Btn variant="primary" full onClick={() => navigate(`/bed/${bedId}`)}>Im Beet bearbeiten</Btn>
          </div>
        </div>
      </div>
      <TabBar active="beds" />
    </div>
  );
}
