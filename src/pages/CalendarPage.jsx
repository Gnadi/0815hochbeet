import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useBeds } from '../hooks/useBeds';
import { useTodos } from '../hooks/useTodos';
import { LABEL, MONO, T } from '../theme';
import { MONTHS_DE } from '../data/plantDetails';
import { TASK_KINDS, sowableNow, toDateStr } from '../utils/taskEngine';
import { TabBar } from '../components/TabBar';
import { IconBtn, Btn } from '../components/Btn';

const DE_DAYS_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const card = { background:T.panel, border:`1px solid ${T.border}`, borderRadius:18, padding:16 };

/** Monday-first grid covering the whole month plus the surrounding part-weeks. */
function buildMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const offset = first.getDay() === 0 ? -6 : 1 - first.getDay();
  const start = new Date(year, month, 1 + offset);
  const days = [];
  const cursor = new Date(start);
  while (days.length < 42) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
    if (cursor.getMonth() !== month && cursor.getDay() === 1 && days.length >= 28) break;
  }
  return days;
}

export default function CalendarPage() {
  const mobile = useBreakpoint();
  const navigate = useNavigate();
  const beds = useBeds();
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(toDateStr(today));
  const [newTitle, setNewTitle] = useState('');
  const [newBed, setNewBed] = useState('');
  const swipe = useRef(null);

  // The generated window has to cover whatever month is on screen.
  const gridDays = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const { todos, addTodo, deleteTodo, toggleTodo } = useTodos({
    from: gridDays[0],
    to: gridDays[gridDays.length - 1],
  });

  const byDate = useMemo(() => {
    const map = {};
    todos.forEach(t => { (map[t.date] ||= []).push(t); });
    return map;
  }, [todos]);

  const selectedTodos = byDate[selectedDate] || [];
  const todayStr = toDateStr(today);
  const sowable = useMemo(() => sowableNow(viewMonth), [viewMonth]);

  function shiftMonth(delta) {
    let m = viewMonth + delta, y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewMonth(m); setViewYear(y);
  }

  function handleAdd() {
    if (!newTitle.trim()) return;
    addTodo({ title:newTitle, date:selectedDate, bedId:newBed || undefined });
    setNewTitle('');
  }

  const header = (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, marginBottom:14 }}>
      <IconBtn label="Voriger Monat" onClick={() => shiftMonth(-1)}>‹</IconBtn>
      <div style={{ textAlign:'center', minWidth:0 }}>
        <h1 style={{ fontFamily:"'Fraunces',serif", fontSize:mobile ? 21 : 28, fontWeight:500, margin:0 }}>
          {MONTHS_DE[viewMonth]} {viewYear}
        </h1>
        {(viewMonth !== today.getMonth() || viewYear !== today.getFullYear()) && (
          <button onClick={() => { setViewMonth(today.getMonth()); setViewYear(today.getFullYear()); setSelectedDate(todayStr); }}
            style={{ background:'none', border:'none', color:T.green, cursor:'pointer', ...MONO, fontSize:10, fontWeight:700, padding:'4px 0' }}>
            Heute
          </button>
        )}
      </div>
      <IconBtn label="Nächster Monat" onClick={() => shiftMonth(1)}>›</IconBtn>
    </div>
  );

  const grid = (
    <div
      onTouchStart={e => { swipe.current = e.touches[0].clientX; }}
      onTouchEnd={e => {
        if (swipe.current === null) return;
        const dx = e.changedTouches[0].clientX - swipe.current;
        if (Math.abs(dx) > 60) shiftMonth(dx < 0 ? 1 : -1);
        swipe.current = null;
      }}
    >
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:mobile ? 4 : 6, marginBottom:6 }}>
        {DE_DAYS_SHORT.map(d => (
          <div key={d} style={{ ...MONO, fontSize:9, textTransform:'uppercase', textAlign:'center', color:T.inkMute, letterSpacing:'0.06em' }}>{d}</div>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:mobile ? 4 : 6 }}>
        {gridDays.map(d => {
          const ds = toDateStr(d);
          const inMonth = d.getMonth() === viewMonth;
          const isToday = ds === todayStr;
          const sel = ds === selectedDate;
          const dayTodos = byDate[ds] || [];
          const open = dayTodos.filter(t => !t.done);
          return (
            <button key={ds} onClick={() => setSelectedDate(ds)} aria-pressed={sel}
              aria-label={`${d.getDate()}. ${MONTHS_DE[d.getMonth()]}, ${open.length} offene Aufgaben`}
              style={{
                background:sel ? T.green : inMonth ? T.panel : 'transparent',
                border:`1px solid ${isToday && !sel ? T.ochre : T.border}`,
                borderRadius:12, padding:mobile ? '6px 3px' : '8px 6px',
                cursor:'pointer', minHeight:mobile ? 50 : 68,
                display:'flex', flexDirection:'column', alignItems:'center', gap:4,
                fontFamily:'inherit', color:sel ? 'var(--panel)' : inMonth ? T.ink : T.inkMute,
              }}>
              <span style={{ ...MONO, fontSize:mobile ? 11 : 12, fontWeight:isToday ? 700 : 400, lineHeight:1 }}>{d.getDate()}</span>
              {dayTodos.length > 0 && (
                <span style={{ display:'flex', gap:2, flexWrap:'wrap', justifyContent:'center' }}>
                  {dayTodos.slice(0, 3).map(t => (
                    <span key={t.id} aria-hidden="true" style={{
                      width:5, height:5, borderRadius:3,
                      background:sel ? 'rgba(255,255,255,0.85)' : t.done ? T.inkMute : (TASK_KINDS[t.kind]?.color || T.terra),
                    }} />
                  ))}
                  {dayTodos.length > 3 && (
                    <span style={{ ...MONO, fontSize:7, lineHeight:'6px', color:sel ? 'rgba(255,255,255,0.85)' : T.inkMute }}>+{dayTodos.length - 3}</span>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  const dayPanel = (
    <div style={card}>
      <div style={{ fontFamily:"'Fraunces',serif", fontSize:17, fontWeight:500, marginBottom:12 }}>
        {new Intl.DateTimeFormat('de-DE', { weekday:'long', day:'numeric', month:'long' }).format(new Date(selectedDate + 'T00:00:00'))}
      </div>

      {selectedTodos.length === 0 && (
        <div style={{ ...MONO, fontSize:11, color:T.inkMute, marginBottom:14 }}>Keine Aufgaben.</div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:9, marginBottom:14 }}>
        {selectedTodos.map(t => {
          const kind = TASK_KINDS[t.kind] || { icon:'•', de:'Aufgabe' };
          const bed = t.bedId ? beds.find(b => b.id === t.bedId) : null;
          return (
            <div key={t.id} style={{ display:'flex', alignItems:'flex-start', gap:11 }}>
              <button onClick={() => toggleTodo(t.id)}
                aria-label={t.done ? 'Als offen markieren' : 'Als erledigt markieren'}
                style={{ width:24, height:24, minWidth:24, borderRadius:7, marginTop:1, flexShrink:0,
                  border:`1.5px solid ${t.done ? T.green : T.borderHi}`, background:t.done ? T.green : 'transparent',
                  cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                {t.done && <span style={{ color:'var(--panel)', fontSize:12, fontWeight:700, lineHeight:1 }}>✓</span>}
              </button>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, color:T.ink, textDecoration:t.done ? 'line-through' : 'none', opacity:t.done ? 0.55 : 1, lineHeight:1.4 }}>
                  <span aria-hidden="true" style={{ marginRight:6 }}>{kind.icon}</span>{t.title}
                </div>
                {(bed || t.detail) && (
                  <div style={{ ...MONO, fontSize:9.5, color:T.inkMute, marginTop:3 }}>
                    {bed ? bed.name : ''}{bed && t.detail ? ' · ' : ''}{t.detail || ''}
                  </div>
                )}
              </div>
              {!t.auto && (
                <IconBtn size={32} tone="plain" label="Aufgabe löschen" onClick={() => deleteTodo(t.id)}>×</IconBtn>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
          placeholder="Eigene Aufgabe…" aria-label="Neue Aufgabe"
          style={{ flex:'1 1 160px', minWidth:0, padding:'12px 14px', background:T.bg, border:`1px solid ${T.border}`, borderRadius:12, color:T.ink, outline:'none', minHeight:46 }} />
        {beds.length > 1 && (
          <select value={newBed} onChange={e => setNewBed(e.target.value)} aria-label="Beet zuordnen"
            style={{ padding:'12px 10px', background:T.bg, border:`1px solid ${T.border}`, borderRadius:12, color:T.ink, minHeight:46 }}>
            <option value="">Ohne Beet</option>
            {beds.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <Btn variant="primary" onClick={handleAdd} disabled={!newTitle.trim()}>Hinzufügen</Btn>
      </div>
    </div>
  );

  const sowingStrip = (
    <div style={{ ...card, marginTop:12 }}>
      <div style={{ ...LABEL, marginBottom:10 }}>Aussaat im {MONTHS_DE[viewMonth]}</div>
      {sowable.length === 0 ? (
        <div style={{ fontSize:12.5, color:T.inkDim }}>In diesem Monat wird nicht gesät.</div>
      ) : (
        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
          {sowable.map(p => (
            <button key={p.id} onClick={() => navigate(`/plants?q=${encodeURIComponent(p.de)}`)}
              style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'7px 12px', borderRadius:999, background:T.bg, border:`1px solid ${T.border}`, cursor:'pointer', fontFamily:'inherit', color:T.ink, fontSize:12, minHeight:38 }}>
              <span aria-hidden="true" style={{ width:16, height:16, borderRadius:8, background:`oklch(0.64 0.1 ${p.hue})` }} />
              {p.de}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div style={{
      minHeight:'100vh', background:T.bg,
      padding:mobile
        ? `calc(14px + var(--safe-t)) 16px calc(var(--tabbar-h) + 16px)`
        : '30px 28px calc(var(--tabbar-h) + 28px)',
    }}>
      <div style={{ maxWidth:1100, margin:'0 auto' }}>
        {header}
        {mobile ? (
          <>
            {grid}
            <div style={{ marginTop:14 }}>{dayPanel}</div>
            {sowingStrip}
          </>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 380px', gap:24, alignItems:'start' }}>
            <div>{grid}{sowingStrip}</div>
            {dayPanel}
          </div>
        )}
      </div>
      <TabBar active="calendar" />
    </div>
  );
}
