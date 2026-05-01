import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { T } from '../theme';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useTodos } from '../hooks/useTodos';
import { TabBar } from '../components/TabBar';

const DE_MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const DE_DAYS_SHORT = ['MO','DI','MI','DO','FR','SA','SO'];

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function buildMonthGrid(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth  = new Date(year, month + 1, 0);
  const dow = firstOfMonth.getDay();
  const startOffset = dow === 0 ? -6 : 1 - dow;
  const gridStart = new Date(year, month, 1 + startOffset);
  const days = [];
  const cursor = new Date(gridStart);
  while (cursor <= lastOfMonth || cursor.getDay() !== 1) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
    if (days.length > 42) break;
  }
  return days;
}

function loadLocalBeds() {
  const ids = JSON.parse(localStorage.getItem('hb_beds') || '[]');
  return ids.map(id => { try { return JSON.parse(localStorage.getItem(`hb_bed_${id}`) || 'null'); } catch { return null; } }).filter(Boolean);
}

function DayCell({ date, isCurrentMonth, isToday, todos, selectedDate, onSelect, mobile }) {
  const ds = toDateStr(date);
  const isSelected = selectedDate === ds;
  const maxDots = mobile ? 2 : 3;

  return (
    <div
      onClick={() => onSelect(ds)}
      style={{
        background: isSelected ? T.green : isCurrentMonth ? T.panel : T.bg,
        border: `1px solid ${isToday && !isSelected ? T.ochre : T.border}`,
        borderRadius: mobile ? 10 : 12,
        padding: mobile ? '6px 4px' : '8px 6px',
        cursor: 'pointer',
        minHeight: mobile ? 48 : 72,
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        transition: 'background 0.12s',
        boxSizing: 'border-box',
      }}
    >
      <div style={{
        fontFamily: 'JetBrains Mono,monospace',
        fontSize: mobile ? 10 : 11,
        fontWeight: isToday ? 700 : 400,
        color: isSelected ? '#fff' : isCurrentMonth ? T.ink : T.inkMute,
        lineHeight: 1,
      }}>
        {date.getDate()}
      </div>
      {todos.length > 0 && (
        <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {todos.slice(0, maxDots).map(t => (
            <div key={t.id} style={{
              width: 5, height: 5, borderRadius: '50%',
              background: isSelected ? 'rgba(255,255,255,0.7)' : t.done ? T.inkMute : T.terra,
              flexShrink: 0,
            }} />
          ))}
          {todos.length > maxDots && (
            <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 7, color: isSelected ? 'rgba(255,255,255,0.7)' : T.inkMute, lineHeight: '6px' }}>
              +{todos.length - maxDots}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TodoPanel({ date, todos, onToggle, onDelete, onAdd, newTitle, setNewTitle, beds }) {
  const d = new Date(date + 'T00:00:00');
  const dateLabel = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }).format(d);

  return (
    <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 18, padding: 20 }}>
      <div style={{ fontFamily: 'Fraunces,serif', fontSize: 18, fontWeight: 500, marginBottom: 14 }}>{dateLabel}</div>
      {todos.length === 0 && (
        <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11, color: T.inkMute, marginBottom: 14 }}>
          Keine Aufgaben.
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        {todos.map(t => {
          const bed = t.bedId ? beds.find(b => b.id === t.bedId) : null;
          return (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={() => onToggle(t.id)}
                style={{
                  width: 18, height: 18, borderRadius: 4,
                  border: `1.5px solid ${t.done ? T.green : T.borderHi}`,
                  background: t.done ? T.green : 'transparent',
                  flexShrink: 0, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: 0,
                }}
              >
                {t.done && <span style={{ color: '#fff', fontSize: 10, fontWeight: 700, lineHeight: 1 }}>✓</span>}
              </button>
              <div style={{ flex: 1, fontSize: 13, color: T.ink, textDecoration: t.done ? 'line-through' : 'none', opacity: t.done ? 0.5 : 1 }}>
                {t.title}
              </div>
              {bed && (
                <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 9, color: T.inkMute, flexShrink: 0 }}>
                  {bed.name}
                </div>
              )}
              <button
                onClick={() => onDelete(t.id)}
                style={{ background: 'transparent', border: 'none', color: T.inkMute, cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '2px 4px', flexShrink: 0 }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onAdd(); }}
          placeholder="Neue Aufgabe…"
          style={{
            flex: 1, padding: '9px 12px',
            background: T.bg, border: `1px solid ${T.border}`,
            borderRadius: 10, fontSize: 13, fontFamily: 'inherit', color: T.ink, outline: 'none',
          }}
        />
        <button
          onClick={onAdd}
          disabled={!newTitle.trim()}
          style={{
            padding: '9px 16px', borderRadius: 999,
            background: T.green, color: '#fff', border: 'none',
            fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            opacity: newTitle.trim() ? 1 : 0.4,
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const mobile = useBreakpoint();
  const navigate = useNavigate();
  const { todos, addTodo, toggleTodo, deleteTodo, todosForDate } = useTodos();
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(toDateStr(today));
  const [newTitle, setNewTitle] = useState('');

  const beds = useMemo(() => loadLocalBeds(), []);
  const days = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const selectedTodos = todosForDate(selectedDate);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  function handleAdd() {
    if (!newTitle.trim()) return;
    addTodo({ title: newTitle.trim(), date: selectedDate });
    setNewTitle('');
  }

  const todayStr = toDateStr(today);

  const navBtnStyle = {
    width: 32, height: 32, borderRadius: 8,
    border: `1px solid ${T.border}`, background: T.panel,
    color: T.ink, cursor: 'pointer', fontSize: 18, lineHeight: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'inherit',
  };

  const header = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
      <button
        onClick={() => navigate('/dashboard')}
        style={{ background: 'none', border: 'none', color: T.green, cursor: 'pointer', fontFamily: 'JetBrains Mono,monospace', fontSize: 11, fontWeight: 600, padding: 0 }}
      >
        ← Zurück
      </button>
      <h2 style={{ fontFamily: 'Fraunces,serif', fontSize: mobile ? 22 : 28, fontWeight: 500, margin: 0 }}>
        {DE_MONTHS[viewMonth]} {viewYear}
      </h2>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={prevMonth} style={navBtnStyle}>‹</button>
        <button onClick={nextMonth} style={navBtnStyle}>›</button>
      </div>
    </div>
  );

  const weekdayHeader = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: mobile ? 3 : 6, marginBottom: mobile ? 3 : 6 }}>
      {DE_DAYS_SHORT.map(d => (
        <div key={d} style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 9, textTransform: 'uppercase', textAlign: 'center', color: T.inkMute, letterSpacing: '0.08em' }}>{d}</div>
      ))}
    </div>
  );

  const calendarGrid = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: mobile ? 3 : 6 }}>
      {days.map(d => {
        const ds = toDateStr(d);
        return (
          <DayCell
            key={ds}
            date={d}
            isCurrentMonth={d.getMonth() === viewMonth}
            isToday={ds === todayStr}
            todos={todosForDate(ds)}
            selectedDate={selectedDate}
            onSelect={setSelectedDate}
            mobile={mobile}
          />
        );
      })}
    </div>
  );

  const panel = (
    <TodoPanel
      date={selectedDate}
      todos={selectedTodos}
      onToggle={toggleTodo}
      onDelete={deleteTodo}
      onAdd={handleAdd}
      newTitle={newTitle}
      setNewTitle={setNewTitle}
      beds={beds}
    />
  );

  if (mobile) {
    return (
      <div style={{ height: '100%', background: T.bg, paddingTop: 16, paddingBottom: 100, overflow: 'auto' }}>
        <div style={{ padding: '0 16px' }}>
          {header}
          {weekdayHeader}
          {calendarGrid}
          <div style={{ marginTop: 16 }}>{panel}</div>
        </div>
        <TabBar active="calendar" />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: T.bg, padding: 32, overflow: 'auto' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {header}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24, alignItems: 'start' }}>
          <div>
            {weekdayHeader}
            {calendarGrid}
          </div>
          {panel}
        </div>
      </div>
    </div>
  );
}
