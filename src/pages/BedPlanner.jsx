import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LABEL, MONO, T } from '../theme';
import { DIFFICULTY_DE, SEASONS, SUN_DE, WATER_DE, companionReason, plantById } from '../data/plants';
import { FEEDERS, monthRangeLabel } from '../data/plantDetails';
import { deleteBed as removeBed, duplicateBed, saveBed } from '../lib/beds';
import { useBedRecord } from '../hooks/useBeds';
import { useBed } from '../hooks/useBed';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useHarvestLog } from '../hooks/useHarvestLog';
import { useTodos } from '../hooks/useTodos';
import { getRotationAnalysis } from '../utils/rotationAdvice';
import { TASK_KINDS } from '../utils/taskEngine';
import { BedCanvas } from '../components/BedCanvas';
import { PlantPicker } from '../components/PlantPicker';
import { Sheet } from '../components/Sheet';
import { TabBar } from '../components/TabBar';
import { Btn, IconBtn, TrashIcon } from '../components/Btn';
import { LogoLockup } from '../components/Logo';
import { haptic, useToast } from '../components/Toast';

const card = { background:T.panel, border:`1px solid ${T.border}`, borderRadius:16, padding:14 };

const SEASON_ORDER = ['spring', 'summer', 'autumn', 'winter'];

/** Order-independent fingerprint of a whole year's plantings. */
function seasonCellsSig(seasonCells = {}) {
  return SEASON_ORDER.map(season => {
    const cells = seasonCells[season] || {};
    return Object.keys(cells).sort()
      .map(k => `${k}:${cells[k]?.plantId}:${cells[k]?.count || 1}`)
      .join(',');
  }).join('|');
}
const field = {
  width:'100%', padding:'12px 14px', borderRadius:12,
  border:`1px solid ${T.border}`, background:T.panel, color:T.ink,
  outline:'none', minHeight:48,
};

function Stat({ label, value, tone }) {
  return (
    <div style={{ ...card, padding:'9px 10px', minWidth:0 }}>
      <div style={{ ...LABEL, fontSize:8.5, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{label}</div>
      <div style={{ fontFamily:"'Fraunces',serif", fontSize:17, fontWeight:500, marginTop:2, color:tone || T.ink, whiteSpace:'nowrap' }}>{value}</div>
    </div>
  );
}

function PairCard({ a, b, tone, count = 1 }) {
  const reason = companionReason(a.id, b.id);
  const bad = tone === 'bad';
  return (
    <div style={{ padding:14, borderRadius:14, background:bad ? T.badBg : T.goodBg, border:`1px solid ${bad ? T.badBorder : T.goodBorder}` }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, marginBottom:6 }}>
        <div style={{ ...LABEL, color:bad ? T.bad : T.good }}>{bad ? '✗ Konflikt' : '✓ Gute Nachbarn'}</div>
        {count > 1 && <div style={{ ...MONO, fontSize:10, color:bad ? T.bad : T.good, fontWeight:700 }}>{count}×</div>}
      </div>
      <div style={{ fontFamily:"'Fraunces',serif", fontSize:15.5, fontWeight:500 }}>
        {a.de} <em style={{ color:bad ? T.bad : T.good }}>{bad ? 'vs.' : '+'}</em> {b.de}
      </div>
      {reason && <div style={{ fontSize:11.5, color:T.inkDim, marginTop:6, lineHeight:1.55 }}>{reason}</div>}
    </div>
  );
}

/**
 * Collapses the raw neighbour pairs into one card per species combination.
 * A 47-plant bed produced dozens of identical "Erbse + Kohlrabi" rows, which
 * buried the one pairing that actually needed attention.
 */
function groupPairs(list) {
  const map = new Map();
  for (const item of list) {
    if (!item.a || !item.b) continue;
    const key = [item.a.id, item.b.id].sort().join('|');
    const hit = map.get(key);
    if (hit) hit.count++;
    else map.set(key, { a:item.a, b:item.b, count:1 });
  }
  return [...map.values()].sort((x, y) => y.count - x.count);
}

export default function BedPlanner() {
  const { bedId } = useParams();
  const navigate = useNavigate();
  const mobile = useBreakpoint();
  const toast = useToast();
  const record = useBedRecord(bedId);
  const [missing, setMissing] = useState(false);

  // A bed that is not in the store yet may still be syncing down from
  // Firestore — only give up after a beat.
  useEffect(() => {
    if (record) { setMissing(false); return; }
    const t = setTimeout(() => setMissing(true), 1500);
    return () => clearTimeout(t);
  }, [record]);

  if (!record) {
    return (
      <div style={{ minHeight:'100vh', background:T.bg, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:14, padding:24, textAlign:'center' }}>
        <div style={{ ...MONO, fontSize:12, color:T.inkMute }}>{missing ? 'Beet nicht gefunden.' : 'Beet wird geladen…'}</div>
        {missing && <Btn variant="primary" onClick={() => navigate('/beds')}>Zu meinen Beeten</Btn>}
      </div>
    );
  }
  return <Planner key={record.id} record={record} mobile={mobile} navigate={navigate} toast={toast} />;
}

function Planner({ record, mobile, navigate, toast }) {
  const bedId = record.id;
  const bed = useBed({
    bedId,
    width: record.width,
    depth: record.depth,
    initialSeason: record.season,
    initialSeasonCells: record.seasonCells,
  });

  const { addEntry: addHarvest, deleteEntry: deleteHarvest, entriesForBed } = useHarvestLog();
  const { todos, toggleTodo } = useTodos();

  const [armedPlant, setArmedPlant] = useState(null);
  const [sheet, setSheet] = useState(null);          // picker | analysis | care | harvest | notes | settings | plant
  const [inspect, setInspect] = useState(null);      // plantId shown in the detail sheet
  const [showSun, setShowSun] = useState(false);
  const [notes, setNotes] = useState(record.notes);
  const [draft, setDraft] = useState(null);          // settings form draft
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [harvestPlant, setHarvestPlant] = useState('');
  const [harvestAmount, setHarvestAmount] = useState('');

  // ── Persistence ──────────────────────────────────────────────────────────
  //
  // `syncedSig` is the plan both sides last agreed on. Comparing against it
  // tells a local edit (write it out) apart from a change that arrived from
  // elsewhere — the generator's undo, another tab, a Firestore pull — which
  // has to be adopted instead. Without this the canvas kept showing a plan the
  // store had already thrown away.
  const syncedSig = useRef(null);

  useEffect(() => {
    const sig = seasonCellsSig(bed.seasonCells);
    if (syncedSig.current === null) { syncedSig.current = sig; return; }  // hydrate render
    if (sig === syncedSig.current) {
      saveBed(bedId, { season: bed.season });
      return;
    }
    syncedSig.current = sig;
    saveBed(bedId, { seasonCells: bed.seasonCells, season: bed.season });
  }, [bed.seasonCells, bed.season, bedId]);

  useEffect(() => {
    const sig = seasonCellsSig(record.seasonCells);
    if (syncedSig.current === null || sig === syncedSig.current) return;
    syncedSig.current = sig;
    bed.loadSeasonCells(record.seasonCells);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record.seasonCells]);

  const notesTimer = useRef(null);
  function changeNotes(v) {
    setNotes(v);
    clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => saveBed(bedId, { notes: v }), 600);
  }

  // ── Derived ──────────────────────────────────────────────────────────────
  const placedIds = useMemo(
    () => [...new Set(Object.values(bed.cells).filter(v => v && typeof v === 'object').map(v => v.plantId))],
    [bed.cells],
  );
  /**
   * Legend for the canvas. Densely spaced crops are drawn as plain dots — too
   * small to carry a label — so the bed needs somewhere to say what they are.
   */
  const legend = useMemo(() => {
    const byPlant = new Map();
    for (const item of Object.values(bed.cells)) {
      if (!item || typeof item !== 'object') continue;
      byPlant.set(item.plantId, (byPlant.get(item.plantId) || 0) + (item.count || 1));
    }
    return [...byPlant.entries()]
      .map(([id, count]) => ({ plant: plantById(id), count }))
      .filter(e => e.plant)
      .sort((a, b) => b.count - a.count);
  }, [bed.cells]);

  const selected = bed.selectedKey ? bed.cells[bed.selectedKey] : null;
  const selectedPlant = selected ? plantById(selected.plantId) : null;
  const rotation = useMemo(() => getRotationAnalysis(bed.seasonCells), [bed.seasonCells]);
  const issueGroups = useMemo(() => groupPairs(bed.issues), [bed.issues]);
  const winGroups = useMemo(() => groupPairs(bed.wins), [bed.wins]);
  const bedTasks = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return todos.filter(t => t.bedId === bedId && t.date >= today).slice(0, 12);
  }, [todos, bedId]);
  const harvests = entriesForBed(bedId);
  const harvestTotal = harvests.reduce((s, e) => s + e.amountKg, 0);
  const deepRooters = useMemo(
    () => placedIds.map(plantById).filter(p => p && p.rootDepth_cm > record.height),
    [placedIds, record.height],
  );

  // ── Actions ──────────────────────────────────────────────────────────────
  function handlePlace(x, y, plantId) {
    const res = bed.place(x, y, plantId);
    if (res === 'placed' || res === 'stacked') haptic(8);
    return res;
  }

  function handleBlocked(kind) {
    haptic([14, 40, 14]);
    toast({
      message: kind === 'move' ? 'Dort ist kein Platz — der Abstand reicht nicht.' : 'Zu eng. Die Nachbarpflanze braucht mehr Abstand.',
      tone:'bad', duration:2600,
    });
  }

  function handleRemove(key) {
    const item = bed.removeCell(key);
    if (!item) return;
    haptic(10);
    const p = plantById(item.plantId);
    toast({
      message: `${p?.de || 'Pflanze'} entfernt`,
      action: () => bed.undo(),
    });
  }

  function handleFix() {
    const swaps = bed.fixBed();
    haptic(12);
    toast({
      message: swaps ? `${swaps} Konflikt${swaps > 1 ? 'e' : ''} gelöst` : 'Keine Konflikte zu lösen.',
      action: swaps ? () => bed.undo() : undefined,
      tone: swaps ? 'good' : 'default',
    });
  }

  function handleClear() {
    if (!Object.keys(bed.cells).length) return;
    bed.clearSeason();
    toast({ message:`${SEASONS.find(s => s.id === bed.season)?.de} geleert`, action: () => bed.undo() });
  }

  /**
   * Hands the current bed and season to the generator, so the suggestion is
   * built for these exact measurements and lands back in this season.
   */
  function suggestPlan() {
    navigate(`/autoplan?bed=${bedId}&season=${bed.season}`);
  }

  function openSettings() {
    setDraft({ name:record.name, width:record.width, depth:record.depth, height:record.height, sun:record.sun, zone:record.zone });
    setSheet('settings');
  }

  function saveSettings() {
    const w = Math.max(20, Math.min(600, Number(draft.width) || record.width));
    const d = Math.max(20, Math.min(600, Number(draft.depth) || record.depth));
    const h = Math.max(10, Math.min(150, Number(draft.height) || record.height));
    const resized = w !== record.width || d !== record.depth;
    saveBed(bedId, { name: draft.name.trim() || 'Mein Hochbeet', width:w, depth:d, height:h, sun:draft.sun, zone:draft.zone });
    if (resized) {
      // Plants keep their cm coordinates; anything now outside is pulled back
      // in rather than the whole plan being thrown away.
      setTimeout(() => bed.clampToBed(), 0);
      toast({ message:`Beet auf ${w} × ${d} cm geändert — Pflanzen bleiben erhalten.`, tone:'good' });
    } else {
      toast({ message:'Gespeichert', tone:'good', duration:1800 });
    }
    setSheet(null);
  }

  function copyToSeason(target) {
    bed.copySeason(bed.season, target);
    toast({
      message:`Bepflanzung nach ${SEASONS.find(s => s.id === target)?.de} kopiert`,
      action: () => bed.undo(), tone:'good',
    });
  }

  async function sharePlan() {
    const lines = [
      `${record.name} — ${record.width} × ${record.depth} cm`,
      `Saison: ${SEASONS.find(s => s.id === bed.season)?.de}`,
      '',
      ...Object.values(bed.cells)
        .filter(v => v && typeof v === 'object')
        .reduce((acc, v) => {
          const hit = acc.find(a => a.id === v.plantId);
          if (hit) hit.n += v.count || 1; else acc.push({ id:v.plantId, n:v.count || 1 });
          return acc;
        }, [])
        .map(({ id, n }) => {
          const p = plantById(id);
          return `• ${n}× ${p?.de} (${p?.spacing_cm} cm Abstand, Saat ${monthRangeLabel(p?.sowMonths || [])})`;
        }),
      '',
      `Geschätzter Ertrag: ~${bed.stats.yieldKg.toFixed(1)} kg`,
    ].join('\n');
    try {
      if (navigator.share) await navigator.share({ title:record.name, text:lines });
      else { await navigator.clipboard.writeText(lines); toast({ message:'Pflanzliste kopiert', tone:'good' }); }
    } catch { /* user cancelled the share sheet */ }
  }

  // ── Reusable panels ──────────────────────────────────────────────────────
  const analysisPanel = (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {bed.issues.length === 0 && bed.wins.length === 0 && rotation.warnings.length === 0 && (
        <div style={{ ...card, textAlign:'center', padding:24 }}>
          <div style={{ fontFamily:"'Fraunces',serif", fontSize:32, color:T.green, fontStyle:'italic' }}>~</div>
          <div style={{ fontSize:12.5, color:T.inkDim, marginTop:6 }}>
            {placedIds.length ? 'Keine Konflikte — die Nachbarschaft passt.' : 'Setze Pflanzen, um Hinweise zu bekommen.'}
          </div>
        </div>
      )}
      {bed.issues.length > 0 && (
        <Btn variant="terra" full onClick={handleFix}>✦ {bed.issues.length} Konflikt{bed.issues.length > 1 ? 'e' : ''} automatisch lösen</Btn>
      )}
      {issueGroups.map((g, i) => <PairCard key={`i${i}`} a={g.a} b={g.b} count={g.count} tone="bad" />)}
      {winGroups.slice(0, 6).map((g, i) => <PairCard key={`w${i}`} a={g.a} b={g.b} count={g.count} tone="good" />)}

      {deepRooters.length > 0 && (
        <div style={{ padding:14, borderRadius:14, background:T.warnBg, border:`1px solid ${T.warnBorder}` }}>
          <div style={{ ...LABEL, color:T.warn, marginBottom:6 }}>⚠ Beettiefe</div>
          <div style={{ fontSize:12.5, color:T.inkDim, lineHeight:1.55 }}>
            Dein Beet ist {record.height} cm hoch. {deepRooters.map(p => `${p.de} (${p.rootDepth_cm} cm)`).join(', ')} {deepRooters.length > 1 ? 'brauchen' : 'braucht'} mehr Wurzelraum.
          </div>
        </div>
      )}

      {rotation.warnings.length > 0 && (
        <>
          <div style={LABEL}>Fruchtfolge über das Jahr</div>
          {rotation.warnings.map((w, i) => (
            <div key={i} style={{ padding:14, borderRadius:14, background:T.warnBg, border:`1px solid ${T.warnBorder}` }}>
              <div style={{ ...LABEL, color:T.warn, marginBottom:6 }}>Fruchtfolge-Hinweis</div>
              <div style={{ fontFamily:"'Fraunces',serif", fontSize:15, fontWeight:500 }}>{w.familyDe}</div>
              <div style={{ fontSize:11.5, color:T.inkDim, marginTop:4 }}>In mehreren Saisons: {w.seasons.join(', ')}.</div>
              {w.tip && <div style={{ fontSize:11.5, color:T.inkDim, marginTop:5, lineHeight:1.55 }}>{w.tip}</div>}
            </div>
          ))}
        </>
      )}
    </div>
  );

  const carePanel = (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div>
        <div style={{ ...LABEL, marginBottom:8 }}>Anstehende Aufgaben</div>
        {bedTasks.length === 0 ? (
          <div style={{ ...card, fontSize:12.5, color:T.inkDim }}>
            Für dieses Beet steht gerade nichts an. Aufgaben entstehen automatisch aus deiner Bepflanzung.
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {bedTasks.map(t => {
              const kind = TASK_KINDS[t.kind] || TASK_KINDS.care;
              return (
                <div key={t.id} style={{ ...card, display:'flex', gap:11, alignItems:'flex-start', opacity:t.done ? 0.5 : 1 }}>
                  <button onClick={() => toggleTodo(t.id)} aria-label={t.done ? 'Als offen markieren' : 'Als erledigt markieren'}
                    style={{ width:24, height:24, minWidth:24, borderRadius:7, marginTop:1, border:`1.5px solid ${t.done ? T.green : T.borderHi}`, background:t.done ? T.green : 'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    {t.done && <span style={{ color:'var(--panel)', fontSize:12, fontWeight:700, lineHeight:1 }}>✓</span>}
                  </button>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, textDecoration:t.done ? 'line-through' : 'none' }}>
                      <span aria-hidden="true" style={{ marginRight:6 }}>{kind.icon}</span>{t.title}
                    </div>
                    <div style={{ ...MONO, fontSize:9.5, color:T.inkMute, marginTop:2 }}>
                      {new Intl.DateTimeFormat('de-DE', { weekday:'short', day:'2-digit', month:'short' }).format(new Date(t.date + 'T00:00:00'))} · {kind.de}
                    </div>
                    {t.detail && <div style={{ fontSize:11.5, color:T.inkDim, marginTop:5, lineHeight:1.5 }}>{t.detail}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {placedIds.length > 0 && (
        <div>
          <div style={{ ...LABEL, marginBottom:8 }}>Pflegeanleitung</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {placedIds.map(plantById).filter(Boolean).map(p => (
              <button key={p.id} onClick={() => { setInspect(p.id); setSheet('plant'); }}
                style={{ ...card, textAlign:'left', cursor:'pointer', fontFamily:'inherit', color:T.ink }}>
                <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:6 }}>
                  <span aria-hidden="true" style={{ width:24, height:24, borderRadius:'50%', background:`oklch(0.62 0.1 ${p.hue})`, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontFamily:"'Fraunces',serif", fontStyle:'italic', fontSize:12 }}>{p.glyph[0]}</span>
                  <span style={{ fontWeight:600, fontSize:13 }}>{p.de}</span>
                  <span style={{ ...MONO, fontSize:9.5, color:T.inkMute, marginLeft:'auto' }}>{FEEDERS[p.feeder]?.short}</span>
                </div>
                <div style={{ fontSize:11.5, color:T.inkDim, lineHeight:1.55 }}>{p.careNotes}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const harvestPanel = (
    <div>
      <div style={{ ...LABEL, marginBottom:8 }}>Ernte erfassen</div>
      <div style={{ ...card, marginBottom:14 }}>
        <select value={harvestPlant} onChange={e => setHarvestPlant(e.target.value)} aria-label="Pflanze wählen"
          style={{ ...field, marginBottom:8 }}>
          <option value="">Pflanze wählen…</option>
          {placedIds.map(pid => plantById(pid)).filter(Boolean).map(p => <option key={p.id} value={p.id}>{p.de}</option>)}
        </select>
        <div style={{ display:'flex', gap:8 }}>
          <input type="number" inputMode="decimal" min="0" step="0.1" placeholder="Menge in kg"
            aria-label="Erntemenge in Kilogramm"
            value={harvestAmount} onChange={e => setHarvestAmount(e.target.value)}
            style={{ ...field, flex:1, ...MONO }} />
          <Btn variant="primary" disabled={!harvestPlant || !harvestAmount}
            onClick={() => {
              addHarvest({ bedId, plantId:harvestPlant, season:bed.season, amountKg:harvestAmount });
              setHarvestAmount('');
              toast({ message:'Ernte eingetragen', tone:'good', duration:1800 });
            }}>Eintragen</Btn>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
        <Stat label="Geplant" value={`~${bed.stats.yieldKg.toFixed(1)} kg`} tone={T.inkDim} />
        <Stat label="Geerntet" value={`${harvestTotal.toFixed(1)} kg`} tone={T.green} />
      </div>

      {harvests.length === 0 ? (
        <div style={{ fontSize:12.5, color:T.inkMute, textAlign:'center', padding:'16px 0' }}>Noch keine Ernte eingetragen.</div>
      ) : (
        <>
          <div style={{ ...LABEL, marginBottom:6 }}>Verlauf</div>
          {[...harvests].reverse().map(e => {
            const p = plantById(e.plantId);
            return (
              <div key={e.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 0', borderBottom:`1px solid ${T.border}` }}>
                <span aria-hidden="true" style={{ width:22, height:22, borderRadius:'50%', background:p ? `oklch(0.62 0.1 ${p.hue})` : T.border, flexShrink:0 }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12.5, fontWeight:600 }}>{p?.de || e.plantId}</div>
                  <div style={{ ...MONO, fontSize:10, color:T.inkMute }}>{e.date}</div>
                </div>
                <div style={{ ...MONO, fontSize:12.5, color:T.green, fontWeight:700 }}>{e.amountKg.toFixed(1)} kg</div>
                <IconBtn size={34} tone="plain" label="Eintrag löschen" onClick={() => deleteHarvest(e.id)}>×</IconBtn>
              </div>
            );
          })}
        </>
      )}
    </div>
  );

  const notesPanel = (
    <div>
      <div style={{ ...LABEL, marginBottom:8 }}>Notizen zu diesem Beet</div>
      <textarea value={notes} onChange={e => changeNotes(e.target.value)}
        placeholder="Beobachtungen, Sorten, Erinnerungen…"
        style={{ ...field, minHeight:160, lineHeight:1.6, fontSize:14 }} />
      <div style={{ ...MONO, fontSize:10, color:T.inkMute, marginTop:6 }}>Wird automatisch gespeichert.</div>

      <div style={{ ...LABEL, margin:'20px 0 8px' }}>Saison übertragen</div>
      <div style={{ ...card }}>
        <div style={{ fontSize:12.5, color:T.inkDim, lineHeight:1.55, marginBottom:10 }}>
          Übernimm die Bepflanzung von <strong>{SEASONS.find(s => s.id === bed.season)?.de}</strong> in eine andere Saison — als Startpunkt für die Fruchtfolge.
        </div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {SEASONS.filter(s => s.id !== bed.season).map(s => (
            <Btn key={s.id} size="sm" onClick={() => copyToSeason(s.id)}>→ {s.de}</Btn>
          ))}
        </div>
      </div>
    </div>
  );

  const settingsPanel = draft && (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div>
        <div style={{ ...LABEL, marginBottom:6 }}>Name</div>
        <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name:e.target.value }))} style={field} aria-label="Beetname" />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
        {[['width','Breite'], ['depth','Tiefe'], ['height','Höhe']].map(([k, l]) => (
          <div key={k}>
            <div style={{ ...LABEL, marginBottom:6 }}>{l} (cm)</div>
            <input type="number" inputMode="numeric" value={draft[k]}
              onChange={e => setDraft(d => ({ ...d, [k]:e.target.value }))}
              style={{ ...field, ...MONO }} aria-label={`${l} in Zentimetern`} />
          </div>
        ))}
      </div>
      <div style={{ ...card, ...MONO, fontSize:12, color:T.inkDim, textAlign:'center' }}>
        {((Number(draft.width) * Number(draft.depth)) / 10000).toFixed(2)} m² Anbaufläche
      </div>
      <div>
        <div style={{ ...LABEL, marginBottom:6 }}>Sonnenstunden pro Tag</div>
        <div style={{ display:'flex', gap:6 }}>
          {['<3', '3-5', '5-7', '7+'].map(s => (
            <button key={s} onClick={() => setDraft(d => ({ ...d, sun:s }))}
              style={{ flex:1, minHeight:44, borderRadius:12, cursor:'pointer', fontWeight:600, fontFamily:'inherit', fontSize:13,
                background:draft.sun === s ? T.ochre : T.panel, color:draft.sun === s ? 'var(--panel)' : T.ink,
                border:`1px solid ${draft.sun === s ? 'transparent' : T.border}` }}>{s}h</button>
          ))}
        </div>
      </div>
      <div>
        <div style={{ ...LABEL, marginBottom:6 }}>Klimazone</div>
        <select value={draft.zone} onChange={e => setDraft(d => ({ ...d, zone:e.target.value }))} style={field} aria-label="Klimazone">
          <option value="zone7">Mitteleuropa · Zone 7</option>
          <option value="zone8">Süddeutschland · Zone 8</option>
          <option value="zone6">Norddeutschland · Zone 6</option>
          <option value="zone9">Österreich Tiefland · Zone 9</option>
          <option value="zone5">Alpen · Zone 5–6</option>
        </select>
      </div>

      <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:14, display:'flex', flexDirection:'column', gap:8 }}>
        <Btn onClick={sharePlan} full>↗ Pflanzliste teilen</Btn>
        <Btn onClick={() => window.print()} full>⎙ Plan drucken</Btn>
        <Btn onClick={() => {
          const copy = duplicateBed(bedId);
          setSheet(null);
          if (copy) navigate(`/bed/${copy.id}`);
        }} full>⧉ Beet duplizieren</Btn>
        <Btn variant="danger" full onClick={() => {
          if (!confirmDelete) { setConfirmDelete(true); return; }
          removeBed(bedId);
          navigate('/beds');
        }}>
          <TrashIcon /> {confirmDelete ? 'Wirklich löschen?' : 'Beet löschen'}
        </Btn>
        {confirmDelete && <Btn variant="quiet" full onClick={() => setConfirmDelete(false)}>Abbrechen</Btn>}
      </div>
    </div>
  );

  // ── Shared chrome ────────────────────────────────────────────────────────
  const seasonRail = (
    <div className="hscroll" style={{ display:'flex', gap:6 }}>
      {SEASONS.map(s => {
        const on = bed.season === s.id;
        const n = bed.seasonSummary[s.id]?.count || 0;
        return (
          <button key={s.id} onClick={() => { bed.setSeason(s.id); bed.setSelectedKey(null); }}
            aria-pressed={on}
            style={{
              padding:'9px 15px', borderRadius:999, fontSize:12.5, fontWeight:600, fontFamily:'inherit',
              flexShrink:0, cursor:'pointer', minHeight:42, display:'flex', alignItems:'center', gap:7,
              background:on ? T.green : T.panel, color:on ? 'var(--panel)' : T.ink,
              border:`1px solid ${on ? 'transparent' : T.border}`,
            }}>
            <span aria-hidden="true" style={{ opacity:on ? 1 : 0.6 }}>{s.glyph}</span>
            {s.de}
            {n > 0 && (
              <span style={{ ...MONO, fontSize:9.5, padding:'1px 6px', borderRadius:999, background:on ? 'rgba(255,255,255,0.22)' : T.bg, color:on ? 'var(--panel)' : T.inkMute }}>{n}</span>
            )}
          </button>
        );
      })}
    </div>
  );

  const statsRow = (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(4, minmax(0, 1fr))', gap:7 }}>
      <Stat label="Pflanzen" value={bed.stats.placed} />
      <Stat label="Sorten" value={bed.stats.kinds} />
      <Stat label="Belegt" value={`${bed.stats.coverage}%`} />
      <Stat label="Ertrag" value={`~${bed.stats.yieldKg.toFixed(1)} kg`} tone={T.green} />
    </div>
  );

  const legendRow = legend.length > 0 && (
    <div className="hscroll" style={{ display:'flex', gap:6, paddingBottom:2 }}>
      {legend.map(({ plant, count }) => (
        <button key={plant.id} onClick={() => { setInspect(plant.id); setSheet('plant'); }}
          title={`${plant.de} — ${plant.spacing_cm} cm Abstand`}
          style={{
            display:'inline-flex', alignItems:'center', gap:7, flexShrink:0,
            padding:'7px 12px', borderRadius:999, minHeight:38, cursor:'pointer',
            background:T.panel, border:`1px solid ${T.border}`, color:T.ink,
            fontFamily:'inherit', fontSize:12, fontWeight:600,
          }}>
          <span aria-hidden="true" style={{
            width:13, height:13, borderRadius:7, flexShrink:0,
            background:`radial-gradient(circle at 35% 30%, oklch(0.80 0.10 ${plant.hue}), oklch(0.50 0.15 ${plant.hue}))`,
          }} />
          {plant.de}
          <span style={{ ...MONO, fontSize:10, color:T.inkMute, fontWeight:500 }}>×{count}</span>
        </button>
      ))}
    </div>
  );

  const canvas = (
    <BedCanvas
      bed={bed}
      armedPlant={armedPlant}
      selectedKey={bed.selectedKey}
      onSelect={bed.setSelectedKey}
      onPlace={handlePlace}
      onMove={bed.move}
      onBlocked={handleBlocked}
      showSun={showSun}
      showConflict
    />
  );

  /**
   * Contextual bar for the selected plant — what replaced tap-to-delete.
   * Wraps to a second row on a phone so every control keeps a real touch
   * target instead of being squeezed until the label truncates.
   */
  const selectionBar = selectedPlant && (
    <div style={{
      ...card, padding:'9px 10px', borderColor:T.green, background:T.goodBg,
      display:'flex', flexDirection:mobile ? 'column' : 'row',
      alignItems:mobile ? 'stretch' : 'center', gap:8,
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, flex:1, minWidth:0 }}>
        <span aria-hidden="true" style={{ width:34, height:34, borderRadius:'50%', flexShrink:0, background:`radial-gradient(circle at 35% 30%, oklch(0.80 0.10 ${selectedPlant.hue}), oklch(0.50 0.15 ${selectedPlant.hue}))`, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontFamily:"'Fraunces',serif", fontStyle:'italic' }}>{selectedPlant.glyph[0]}</span>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13.5, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{selectedPlant.de}</div>
          <div style={{ ...MONO, fontSize:9.5, color:T.inkMute, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
            Ziehen = verschieben · {selectedPlant.spacing_cm} cm Abstand
          </div>
        </div>
        <IconBtn size={38} tone="plain" label="Auswahl aufheben" onClick={() => bed.setSelectedKey(null)}>×</IconBtn>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:8, justifyContent:mobile ? 'space-between' : 'flex-end', flexShrink:0 }}>
        <IconBtn size={40} label="Eine weniger" onClick={() => bed.decrement(bed.selectedKey)}>−</IconBtn>
        <span style={{ ...MONO, fontSize:15, fontWeight:700, minWidth:26, textAlign:'center' }}>{selected.count || 1}</span>
        <IconBtn size={40} label="Eine mehr" onClick={() => bed.increment(bed.selectedKey)}>+</IconBtn>
        <IconBtn size={40} label="Pflanzen-Info" onClick={() => { setInspect(selectedPlant.id); setSheet('plant'); }}>ⓘ</IconBtn>
        <IconBtn size={40} tone="danger" label="Ganz entfernen" onClick={() => handleRemove(bed.selectedKey)}><TrashIcon size={15} /></IconBtn>
      </div>
    </div>
  );

  /**
   * An empty season is exactly when a generated plan is worth most, so the
   * offer appears there rather than being buried in a menu.
   */
  const emptySeasonCta = Object.keys(bed.cells).length === 0 && (
    <div style={{ ...card, borderStyle:'dashed', borderColor:T.borderHi, display:'flex', alignItems:'center', gap:12, padding:'12px 14px' }}>
      <span aria-hidden="true" style={{ fontSize:20, lineHeight:1, flexShrink:0 }}>✦</span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13.5, fontWeight:600 }}>
          {SEASONS.find(sx => sx.id === bed.season)?.de} ist noch leer
        </div>
        <div style={{ fontSize:11.5, color:T.inkDim, lineHeight:1.45 }}>
          Lass dir eine Mischkultur für {record.width} × {record.depth} cm vorschlagen.
        </div>
      </div>
      <Btn variant="terra" onClick={suggestPlan}>Vorschlag</Btn>
    </div>
  );

  const armedBar = (
    <div style={{ ...card, display:'flex', alignItems:'center', gap:11, padding:'10px 12px' }}>
      {armedPlant ? (
        <>
          <span aria-hidden="true" style={{ width:36, height:36, borderRadius:'50%', flexShrink:0, background:`radial-gradient(circle at 35% 30%, oklch(0.80 0.10 ${plantById(armedPlant).hue}), oklch(0.50 0.15 ${plantById(armedPlant).hue}))`, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontFamily:"'Fraunces',serif", fontStyle:'italic' }}>{plantById(armedPlant).glyph[0]}</span>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13.5, fontWeight:600 }}>{plantById(armedPlant).de}</div>
            <div style={{ fontSize:11.5, color:T.inkDim }}>Tippe auf das Beet zum Pflanzen</div>
          </div>
          <Btn size="sm" onClick={() => setSheet('picker')}>Wechseln</Btn>
          <IconBtn size={38} tone="plain" label="Auswahl aufheben" onClick={() => setArmedPlant(null)}>×</IconBtn>
        </>
      ) : (
        <>
          <span aria-hidden="true" style={{ width:36, height:36, borderRadius:10, flexShrink:0, background:T.bg, border:`1.5px dashed ${T.borderHi}`, display:'flex', alignItems:'center', justifyContent:'center', color:T.inkMute, fontSize:18 }}>+</span>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13.5, fontWeight:600 }}>Pflanze wählen</div>
            <div style={{ fontSize:11.5, color:T.inkDim }}>Suchen, filtern, pflanzen</div>
          </div>
          <Btn variant="primary" onClick={() => setSheet('picker')}>Auswählen</Btn>
        </>
      )}
    </div>
  );

  const toolRow = (
    <div className="hscroll no-print" style={{ display:'flex', gap:6 }}>
      {/* An empty season already offers this on its own card — one prompt is enough. */}
      {!emptySeasonCta && (
        <button onClick={suggestPlan}
          style={{ padding:'9px 15px', borderRadius:999, fontSize:12.5, fontWeight:600, fontFamily:'inherit', flexShrink:0, cursor:'pointer', minHeight:42, background:T.terra, color:'var(--panel)', border:'1px solid transparent' }}>
          ✦ Vorschlag
        </button>
      )}
      {[
        { id:'analysis', label:`Analyse${bed.issues.length ? ` · ${bed.issues.length}` : ''}`, tone: bed.issues.length ? 'bad' : null },
        { id:'care',     label:'Pflege' },
        { id:'harvest',  label:'Ernte' },
        { id:'notes',    label:'Notizen' },
      ].map(t => (
        <button key={t.id} onClick={() => setSheet(t.id)}
          style={{
            padding:'9px 15px', borderRadius:999, fontSize:12.5, fontWeight:600, fontFamily:'inherit',
            flexShrink:0, cursor:'pointer', minHeight:42,
            background:t.tone === 'bad' ? T.badBg : T.panel,
            color:t.tone === 'bad' ? T.bad : T.ink,
            border:`1px solid ${t.tone === 'bad' ? T.badBorder : T.border}`,
          }}>{t.label}</button>
      ))}
      <button onClick={() => setShowSun(s => !s)} aria-pressed={showSun}
        style={{ padding:'9px 15px', borderRadius:999, fontSize:12.5, fontWeight:600, fontFamily:'inherit', flexShrink:0, cursor:'pointer', minHeight:42, background:showSun ? T.ochre : T.panel, color:showSun ? 'var(--panel)' : T.ink, border:`1px solid ${showSun ? 'transparent' : T.border}` }}>
        ☀ Sonne
      </button>
      <button onClick={handleClear}
        style={{ padding:'9px 15px', borderRadius:999, fontSize:12.5, fontWeight:600, fontFamily:'inherit', flexShrink:0, cursor:'pointer', minHeight:42, background:T.panel, color:T.inkDim, border:`1px solid ${T.border}` }}>
        Saison leeren
      </button>
    </div>
  );

  const sheets = (
    <>
      <Sheet open={sheet === 'picker'} onClose={() => setSheet(null)} title="Pflanze wählen"
        subtitle={`${SEASONS.find(s => s.id === bed.season)?.de} · ${record.width} × ${record.depth} cm`}>
        <PlantPicker
          season={bed.season}
          placedIds={placedIds}
          armedPlant={armedPlant}
          bedHeightCm={record.height}
          compact={mobile}
          onPick={(id) => { setArmedPlant(id); setSheet(null); haptic(6); }}
        />
      </Sheet>

      <Sheet open={sheet === 'analysis'} onClose={() => setSheet(null)} title="Analyse" subtitle="Nachbarschaft & Fruchtfolge">{analysisPanel}</Sheet>
      <Sheet open={sheet === 'care'} onClose={() => setSheet(null)} title="Pflege" subtitle="Aufgaben aus deiner Bepflanzung">{carePanel}</Sheet>
      <Sheet open={sheet === 'harvest'} onClose={() => setSheet(null)} title="Ernte" subtitle={`${harvestTotal.toFixed(1)} kg erfasst`}>{harvestPanel}</Sheet>
      <Sheet open={sheet === 'notes'} onClose={() => setSheet(null)} title="Notizen & Saison">{notesPanel}</Sheet>

      <Sheet open={sheet === 'settings'} onClose={() => { setSheet(null); setConfirmDelete(false); }} title="Beet-Einstellungen"
        footer={<Btn variant="primary" full size="lg" onClick={saveSettings}>Speichern</Btn>}>
        {settingsPanel}
      </Sheet>

      <Sheet open={sheet === 'plant'} onClose={() => setSheet(null)} title={plantById(inspect)?.de || 'Pflanze'}>
        {inspect && <PlantDetail plant={plantById(inspect)} />}
      </Sheet>
    </>
  );

  // ── Mobile ───────────────────────────────────────────────────────────────
  if (mobile) return (
    <div style={{ minHeight:'100vh', background:T.bg, paddingBottom:'calc(var(--tabbar-h) + 12px)' }}>
      <header className="no-print" style={{
        position:'sticky', top:0, zIndex:20, background:'color-mix(in srgb, var(--bg) 92%, transparent)',
        backdropFilter:'blur(14px)', WebkitBackdropFilter:'blur(14px)',
        padding:`calc(10px + var(--safe-t)) 14px 10px`, borderBottom:`1px solid ${T.border}`,
        display:'flex', alignItems:'center', gap:8,
      }}>
        <IconBtn size={40} tone="plain" label="Zurück zu den Beeten" onClick={() => navigate('/beds')}>‹</IconBtn>
        <button onClick={openSettings} style={{ flex:1, minWidth:0, background:'none', border:'none', textAlign:'left', cursor:'pointer', padding:0, fontFamily:'inherit', color:T.ink }}>
          <div style={{ fontFamily:"'Fraunces',serif", fontSize:19, fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{record.name}</div>
          <div style={{ ...MONO, fontSize:9.5, color:T.inkMute }}>{record.width} × {record.depth} cm · bearbeiten</div>
        </button>
        <IconBtn size={40} label="Letzte Änderung rückgängig" disabled={!bed.canUndo} onClick={bed.undo}>↶</IconBtn>
        <IconBtn size={40} label="Änderung wiederholen" disabled={!bed.canRedo} onClick={bed.redo}>↷</IconBtn>
        <IconBtn size={40} label="Beet-Einstellungen" onClick={openSettings}>⚙</IconBtn>
      </header>

      <div style={{ padding:'12px 14px 0' }}>{seasonRail}</div>
      <div style={{ padding:'12px 14px 0' }}>{statsRow}</div>
      <div style={{ padding:'14px 14px 0' }}>{canvas}</div>
      {legendRow && <div style={{ padding:'10px 14px 0' }}>{legendRow}</div>}
      <div style={{ padding:'10px 14px 0', display:'flex', flexDirection:'column', gap:10 }}>
        {selectionBar}
        {emptySeasonCta}
        {armedBar}
        {toolRow}
      </div>
      {sheets}
      <TabBar active="beds" />
    </div>
  );

  // ── Desktop ──────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:'100vh', background:T.bg, display:'grid', gridTemplateColumns:'320px 1fr 360px' }}>
      <aside className="no-print" style={{ borderRight:`1px solid ${T.border}`, background:T.paper, padding:20, height:'100vh', overflow:'auto', position:'sticky', top:0 }}>
        <div style={{ marginBottom:18 }}>
          <LogoLockup size={36} onClick={() => navigate('/dashboard')} />
        </div>
        <PlantPicker
          season={bed.season}
          placedIds={placedIds}
          armedPlant={armedPlant}
          bedHeightCm={record.height}
          compact
          onPick={(id) => setArmedPlant(a => (a === id ? null : id))}
        />
      </aside>

      <main style={{ padding:'26px 28px 40px', minWidth:0 }}>
        <header style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:16, marginBottom:18, flexWrap:'wrap' }}>
          <div style={{ minWidth:0, flex:'1 1 240px' }}>
            <div style={{ ...LABEL, whiteSpace:'nowrap' }}>{record.width} × {record.depth} × {record.height} cm</div>
            <h1 style={{ fontFamily:"'Fraunces',serif", fontSize:34, fontWeight:500, margin:'4px 0 0', overflowWrap:'anywhere' }}>
              <em style={{ color:T.green, fontStyle:'italic' }}>{record.name}</em>
            </h1>
          </div>
          <div className="no-print" style={{ display:'flex', gap:8, flexShrink:0, flexWrap:'wrap', justifyContent:'flex-end' }}>
            <IconBtn label="Letzte Änderung rückgängig" disabled={!bed.canUndo} onClick={bed.undo}>↶</IconBtn>
            <IconBtn label="Änderung wiederholen" disabled={!bed.canRedo} onClick={bed.redo}>↷</IconBtn>
            <IconBtn label="Sonnenverlauf einblenden" active={showSun} onClick={() => setShowSun(s => !s)}>☀</IconBtn>
            <Btn variant="terra" onClick={suggestPlan}>✦ Vorschlag</Btn>
            <Btn onClick={() => navigate(`/bed/${bedId}/seasons`)}>🗓 Jahresplan</Btn>
            <Btn onClick={openSettings}>⚙ Einstellungen</Btn>
          </div>
        </header>

        <div style={{ marginBottom:14 }}>{seasonRail}</div>
        <div style={{ marginBottom:16 }}>{statsRow}</div>
        {canvas}
        {legendRow && <div style={{ marginTop:12 }}>{legendRow}</div>}
        <div style={{ marginTop:12, display:'flex', flexDirection:'column', gap:10 }}>
          {selectionBar}
          {emptySeasonCta}
          {armedBar}
        </div>
        <div className="no-print" style={{ marginTop:14, ...MONO, fontSize:11, color:T.inkMute, display:'flex', gap:18, flexWrap:'wrap' }}>
          <span>● Klick = auswählen</span>
          <span>● Ziehen = verschieben</span>
          <span>● Doppelklick = zoomen</span>
          <span>● Strg + Scrollen = zoomen</span>
        </div>
      </main>

      <aside className="no-print" style={{ borderLeft:`1px solid ${T.border}`, background:T.paper, padding:20, height:'100vh', overflow:'auto', position:'sticky', top:0 }}>
        <DesktopTabs
          bed={bed}
          panels={{ analysis:analysisPanel, care:carePanel, harvest:harvestPanel, notes:notesPanel }}
        />
      </aside>
      {sheets}
    </div>
  );
}

function DesktopTabs({ bed, panels }) {
  const [tab, setTab] = useState('analysis');
  const TABS = [
    { id:'analysis', label:`Analyse${bed.issues.length ? ` (${bed.issues.length})` : ''}` },
    { id:'care', label:'Pflege' },
    { id:'harvest', label:'Ernte' },
    { id:'notes', label:'Notizen' },
  ];
  return (
    <>
      <div style={{ display:'flex', gap:3, marginBottom:16, padding:4, background:T.bg, borderRadius:12, border:`1px solid ${T.border}` }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} aria-pressed={tab === t.id}
            style={{
              flex:1, minHeight:38, border:'none', borderRadius:9, cursor:'pointer',
              fontSize:11.5, fontWeight:600, fontFamily:'inherit',
              background:tab === t.id ? T.panel : 'transparent',
              boxShadow:tab === t.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              color:tab === t.id ? T.ink : T.inkMute,
            }}>{t.label}</button>
        ))}
      </div>
      {panels[tab]}
    </>
  );
}

function PlantDetail({ plant: p }) {
  if (!p) return null;
  const rows = [
    ['Abstand', `${p.spacing_cm} cm`],
    ['Wurzeltiefe', `${p.rootDepth_cm} cm`],
    ['Wuchshöhe', `${p.height_cm} cm`],
    ['Saattiefe', p.sowDepth > 0 ? `${p.sowDepth} cm` : 'auf die Erde'],
    ['Standort', SUN_DE[p.sun]],
    ['Wasser', WATER_DE[p.water]],
    ['Aufwand', DIFFICULTY_DE[p.difficulty]],
    ['Nährstoffe', FEEDERS[p.feeder]?.de],
    ['Familie', p.family],
    ['Vorziehen', p.precultureMonths.length ? monthRangeLabel(p.precultureMonths) : '—'],
    ['Aussaat/Pflanzung', monthRangeLabel(p.sowMonths)],
    ['Ernte', p.harvestMonths.length ? monthRangeLabel(p.harvestMonths) : '—'],
    ['Reifezeit', p.harvestWeeks > 0 ? `${p.harvestWeeks} Wochen` : '—'],
    ['Ertrag', p.yield > 0 ? `~${p.yield} kg je Pflanze` : '—'],
  ];
  return (
    <div>
      <p style={{ fontSize:13.5, color:T.inkDim, lineHeight:1.6, marginBottom:14 }}>{p.description}</p>
      <div style={{ ...card, marginBottom:14 }}>
        <div style={{ ...LABEL, marginBottom:6 }}>Pflege</div>
        <div style={{ fontSize:12.5, color:T.inkDim, lineHeight:1.6 }}>{p.careNotes}</div>
      </div>
      <div style={{ ...card, padding:0, overflow:'hidden' }}>
        {rows.map(([k, v], i) => (
          <div key={k} style={{ display:'flex', justifyContent:'space-between', gap:12, padding:'10px 14px', borderTop:i ? `1px solid ${T.border}` : 'none' }}>
            <span style={{ fontSize:12, color:T.inkMute }}>{k}</span>
            <span style={{ ...MONO, fontSize:12, fontWeight:600, textAlign:'right' }}>{v}</span>
          </div>
        ))}
      </div>
      {FEEDERS[p.feeder]?.tip && (
        <div style={{ marginTop:12, padding:12, borderRadius:12, background:T.goodBg, border:`1px solid ${T.goodBorder}`, fontSize:12, color:T.inkDim, lineHeight:1.55 }}>
          {FEEDERS[p.feeder].tip}
        </div>
      )}
    </div>
  );
}
