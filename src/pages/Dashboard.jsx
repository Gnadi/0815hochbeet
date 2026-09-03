import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useBeds } from '../hooks/useBeds';
import { useTodos } from '../hooks/useTodos';
import { useWeather } from '../hooks/useWeather';
import { currentSeason, pushAllToRemote } from '../lib/beds';
import { applyTheme, getStoredTheme, LABEL, MONO, T } from '../theme';
import { monthRangeLabel, MONTHS_DE } from '../data/plantDetails';
import { getWeatherAdvice } from '../utils/weatherAdvice';
import { TASK_KINDS, sowableNow, toDateStr } from '../utils/taskEngine';
import { TabBar } from '../components/TabBar';
import { AuthModal } from '../components/AuthModal';
import { Sheet } from '../components/Sheet';
import { Btn, IconBtn } from '../components/Btn';
import { BedCard } from '../components/BedCard';
import { useToast } from '../components/Toast';
import { LogoLockup, LogoMark } from '../components/Logo';
import { canInstall, promptInstall } from '../pwa';

const DE_DAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const card = { background:T.panel, border:`1px solid ${T.border}`, borderRadius:18, padding:16, boxShadow:'var(--shadow)' };

function greeting() {
  const h = new Date().getHours();
  return h < 11 ? 'Guten Morgen' : h < 18 ? 'Guten Tag' : 'Guten Abend';
}

function TaskRow({ task, onToggle, bedName }) {
  const kind = TASK_KINDS[task.kind] || TASK_KINDS.care;
  const d = new Date(task.date + 'T00:00:00');
  const isToday = toDateStr(new Date()) === task.date;
  const overdue = task.date < toDateStr(new Date()) && !task.done;

  return (
    <div style={{ ...card, padding:'12px 14px', display:'flex', gap:12, alignItems:'flex-start', opacity:task.done ? 0.5 : 1 }}>
      <button onClick={() => onToggle(task.id)}
        aria-label={task.done ? `${task.title} als offen markieren` : `${task.title} als erledigt markieren`}
        style={{
          width:26, height:26, minWidth:26, borderRadius:8, marginTop:1, flexShrink:0,
          border:`1.5px solid ${task.done ? T.green : T.borderHi}`,
          background:task.done ? T.green : 'transparent', cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
        {task.done && <span style={{ color:'var(--panel)', fontSize:13, fontWeight:700, lineHeight:1 }}>✓</span>}
      </button>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13.5, fontWeight:600, textDecoration:task.done ? 'line-through' : 'none', lineHeight:1.35 }}>
          <span aria-hidden="true" style={{ marginRight:7 }}>{kind.icon}</span>{task.title}
        </div>
        <div style={{ ...MONO, fontSize:9.5, color:overdue ? T.bad : isToday ? T.terra : T.inkMute, marginTop:3, fontWeight:600 }}>
          {isToday ? 'HEUTE' : DE_DAYS[d.getDay()].toUpperCase()} {d.getDate()}.{d.getMonth() + 1}.
          {bedName ? ` · ${bedName}` : ''}
        </div>
        {task.detail && <div style={{ fontSize:11.5, color:T.inkDim, marginTop:5, lineHeight:1.5 }}>{task.detail}</div>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const mobile = useBreakpoint();
  const beds = useBeds();
  const weather = useWeather();
  const toast = useToast();
  const { todos, toggleTodo } = useTodos();
  const [showAuth, setShowAuth] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [theme, setTheme] = useState(getStoredTheme);
  const [installable, setInstallable] = useState(canInstall);

  useEffect(() => {
    const onInstallable = () => setInstallable(true);
    window.addEventListener('hb:installable', onInstallable);
    return () => window.removeEventListener('hb:installable', onInstallable);
  }, []);

  const season = currentSeason();
  const month = new Date().getMonth();
  const todayStr = toDateStr(new Date());

  const upcoming = useMemo(() => {
    const in7 = toDateStr(new Date(Date.now() + 7 * 86400000));
    return todos
      .filter(t => t.date >= toDateStr(new Date(Date.now() - 3 * 86400000)) && t.date <= in7)
      .sort((a, b) => Number(a.done) - Number(b.done) || a.date.localeCompare(b.date));
  }, [todos]);

  const openToday = upcoming.filter(t => t.date <= todayStr && !t.done).length;

  const plantedIds = useMemo(() => {
    const ids = new Set();
    beds.forEach(b => Object.values(b.seasonCells || {}).forEach(sc =>
      Object.values(sc || {}).forEach(v => { if (v?.plantId) ids.add(v.plantId); })));
    return [...ids];
  }, [beds]);

  const advice = useMemo(() => getWeatherAdvice(weather.forecast, plantedIds), [weather.forecast, plantedIds]);
  const sowable = useMemo(() => sowableNow(month).slice(0, 8), [month]);

  const dateStr = new Intl.DateTimeFormat('de-DE', { weekday:'long', day:'2-digit', month:'long' }).format(new Date());
  const weatherStr = weather.error || weather.loading ? '' : `${weather.temp}° ${weather.description}`;

  function changeTheme(mode) {
    setTheme(mode);
    applyTheme(mode);
  }

  // ── Sections ─────────────────────────────────────────────────────────────
  const header = (
    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
      <div style={{ minWidth:0 }}>
        {!mobile && <div style={{ marginBottom:12 }}><LogoLockup size={38} onClick={() => navigate('/dashboard')} /></div>}
        <div style={{ ...LABEL, display:'flex', alignItems:'center', gap:8 }}>
          {mobile && <LogoMark size={26} />}
          <span style={{ minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{dateStr}{weatherStr ? ` · ${weatherStr}` : ''}</span>
        </div>
        <h1 style={{ fontFamily:"'Fraunces',serif", fontSize:mobile ? 28 : 44, margin:'6px 0 0', fontWeight:500, lineHeight:1.08 }}>
          {greeting()},{mobile ? <br /> : ' '}
          <em style={{ color:T.green, fontStyle:'italic' }}>{user?.displayName || 'Gärtner'}</em>.
        </h1>
      </div>
      <div style={{ display:'flex', gap:8, flexShrink:0 }}>
        {!mobile && <Btn onClick={() => navigate('/onboarding')}>+ Neues Beet</Btn>}
        {!mobile && <Btn variant="primary" onClick={() => navigate('/autoplan')}>✦ Plan generieren</Btn>}
        <IconBtn size={mobile ? 40 : 44} label="Einstellungen" onClick={() => setSettingsOpen(true)}>⚙</IconBtn>
      </div>
    </div>
  );

  const tasksSection = (
    <section>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <div style={LABEL}>Anstehend{openToday > 0 ? ` · ${openToday} offen` : ''}</div>
        <button onClick={() => navigate('/calendar')}
          style={{ background:'none', border:'none', color:T.green, cursor:'pointer', ...MONO, fontSize:10.5, fontWeight:700, padding:'6px 0', minHeight:34 }}>
          Kalender →
        </button>
      </div>
      {upcoming.length === 0 ? (
        <div style={{ ...card, fontSize:13, color:T.inkDim, lineHeight:1.55 }}>
          Nichts zu tun. Sobald du Pflanzen ins Beet setzt, entstehen hier automatisch Gieß-, Aussaat- und Ernteaufgaben.
        </div>
      ) : (
        <div style={{ display:mobile ? 'flex' : 'grid', gridTemplateColumns:mobile ? undefined : 'repeat(auto-fill,minmax(280px,1fr))', flexDirection:mobile ? 'column' : undefined, gap:8 }}>
          {upcoming.slice(0, mobile ? 6 : 9).map(t => (
            <TaskRow key={t.id} task={t} onToggle={toggleTodo} bedName={beds.find(b => b.id === t.bedId)?.name} />
          ))}
        </div>
      )}
    </section>
  );

  const adviceSection = advice.length > 0 && (
    <section style={{ display:'grid', gridTemplateColumns:mobile ? '1fr' : `repeat(${Math.min(advice.length, 3)},1fr)`, gap:10 }}>
      {advice.map((a, i) => (
        <div key={i} style={{ background:a.bg, border:`1px solid ${a.border}`, borderRadius:16, padding:'14px 16px', display:'flex', gap:12, alignItems:'flex-start' }}>
          <span aria-hidden="true" style={{ fontSize:19, lineHeight:1, flexShrink:0, marginTop:1 }}>{a.icon}</span>
          <div>
            <div style={{ ...MONO, fontSize:9.5, fontWeight:700, color:a.color, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>{a.title}</div>
            <div style={{ fontSize:12.5, color:T.inkDim, lineHeight:1.5 }}>{a.text}</div>
          </div>
        </div>
      ))}
    </section>
  );

  const sowSection = (
    <section>
      <div style={{ ...LABEL, marginBottom:10 }}>Jetzt säen &amp; pflanzen · {MONTHS_DE[month]}</div>
      {sowable.length === 0 ? (
        <div style={{ ...card, fontSize:13, color:T.inkDim }}>Im {MONTHS_DE[month]} ist Pause — gute Zeit, das nächste Jahr zu planen.</div>
      ) : (
        <div className="hscroll" style={{ display:'flex', gap:8, paddingBottom:4 }}>
          {sowable.map(p => (
            <button key={p.id} onClick={() => navigate(`/plants?q=${encodeURIComponent(p.de)}`)}
              style={{ ...card, padding:12, minWidth:126, flexShrink:0, cursor:'pointer', textAlign:'left', fontFamily:'inherit', color:T.ink, scrollSnapAlign:'start' }}>
              <span aria-hidden="true" style={{ width:34, height:34, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', background:`radial-gradient(circle at 35% 30%, oklch(0.80 0.10 ${p.hue}), oklch(0.50 0.15 ${p.hue}))`, color:'#fff', fontFamily:"'Fraunces',serif", fontStyle:'italic', fontSize:15, marginBottom:8 }}>{p.glyph[0]}</span>
              <div style={{ fontSize:13, fontWeight:600 }}>{p.de}</div>
              <div style={{ ...MONO, fontSize:9.5, color:T.inkMute, marginTop:3 }}>{p.harvestWeeks > 0 ? `${p.harvestWeeks} Wo. bis Ernte` : 'Schutzpflanze'}</div>
              <div style={{ ...MONO, fontSize:9.5, color:T.green, marginTop:2 }}>Saat {monthRangeLabel(p.sowMonths)}</div>
            </button>
          ))}
        </div>
      )}
    </section>
  );

  const bedsSection = (
    <section>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <div style={LABEL}>Meine Beete · {beds.length}</div>
        <button onClick={() => navigate('/beds')}
          style={{ background:'none', border:'none', color:T.green, cursor:'pointer', ...MONO, fontSize:10.5, fontWeight:700, padding:'6px 0', minHeight:34 }}>
          Alle →
        </button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:mobile ? '1fr' : 'repeat(auto-fill,minmax(300px,1fr))', gap:12 }}>
        {beds.slice(0, mobile ? 2 : 6).map(bed => (
          <BedCard key={bed.id} bed={bed} season={season} onOpen={() => navigate(`/bed/${bed.id}`)} />
        ))}
        <button onClick={() => navigate('/onboarding')}
          style={{ background:'transparent', border:`1.5px dashed ${T.borderHi}`, borderRadius:18, padding:20, cursor:'pointer', minHeight:100, color:T.inkMute, fontSize:13, fontWeight:600, fontFamily:'inherit' }}>
          + Neues Beet anlegen
        </button>
      </div>
    </section>
  );

  const settingsSheet = (
    <Sheet open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Einstellungen">
      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
        <div>
          <div style={{ ...LABEL, marginBottom:8 }}>Darstellung</div>
          <div style={{ display:'flex', gap:6 }}>
            {[['system', 'System'], ['light', 'Hell'], ['dark', 'Dunkel']].map(([id, l]) => (
              <button key={id} onClick={() => changeTheme(id)} aria-pressed={theme === id}
                style={{ flex:1, minHeight:46, borderRadius:12, cursor:'pointer', fontWeight:600, fontFamily:'inherit', fontSize:13,
                  background:theme === id ? T.green : T.panel, color:theme === id ? 'var(--panel)' : T.ink,
                  border:`1px solid ${theme === id ? 'transparent' : T.border}` }}>{l}</button>
            ))}
          </div>
        </div>

        {installable && (
          <div>
            <div style={{ ...LABEL, marginBottom:8 }}>App installieren</div>
            <div style={{ ...card }}>
              <div style={{ fontSize:13, color:T.inkDim, lineHeight:1.55, marginBottom:12 }}>
                Als App auf dem Homescreen: startet ohne Browserleiste und funktioniert auch ohne Empfang im Garten.
              </div>
              <Btn variant="primary" full onClick={async () => {
                const ok = await promptInstall();
                setInstallable(canInstall());
                if (ok) toast({ message:'Hochbeet-Planer wird installiert', tone:'good' });
              }}>Zum Homescreen hinzufügen</Btn>
            </div>
          </div>
        )}

        <div>
          <div style={{ ...LABEL, marginBottom:8 }}>Konto</div>
          {user ? (
            <div style={{ ...card }}>
              <div style={{ fontSize:13.5, fontWeight:600 }}>{user.displayName || user.email}</div>
              <div style={{ ...MONO, fontSize:10.5, color:T.inkMute, marginTop:3 }}>Beete werden synchronisiert</div>
              <div style={{ display:'flex', gap:8, marginTop:12, flexWrap:'wrap' }}>
                <Btn size="sm" onClick={async () => { await pushAllToRemote(); toast({ message:'Alle Beete hochgeladen', tone:'good' }); }}>↑ Jetzt sichern</Btn>
                <Btn size="sm" variant="quiet" onClick={() => { logout(); setSettingsOpen(false); }}>Abmelden</Btn>
              </div>
            </div>
          ) : (
            <div style={{ ...card }}>
              <div style={{ fontSize:13, color:T.inkDim, lineHeight:1.55, marginBottom:12 }}>
                Ohne Konto bleiben deine Beete nur auf diesem Gerät. Melde dich an, um sie auf Handy und Rechner zu haben.
              </div>
              <Btn variant="primary" full onClick={() => { setSettingsOpen(false); setShowAuth(true); }}>Anmelden / Registrieren</Btn>
            </div>
          )}
        </div>

        <div>
          <div style={{ ...LABEL, marginBottom:8 }}>Wetter</div>
          <div style={{ ...card, fontSize:12.5, color:T.inkDim, lineHeight:1.55 }}>
            {weather.error === 'no-key' && 'Kein Wetter-API-Schlüssel hinterlegt — Frost- und Gießhinweise sind deaktiviert.'}
            {weather.error === 'geo-denied' && 'Standortfreigabe abgelehnt. Ohne Standort gibt es keine lokalen Wetterhinweise.'}
            {weather.error === 'fetch-failed' && 'Wetterdaten konnten nicht geladen werden.'}
            {!weather.error && !weather.loading && `${weather.city}: ${weather.temp}° ${weather.description}`}
            {weather.loading && 'Wetter wird geladen…'}
          </div>
        </div>
      </div>
    </Sheet>
  );

  return (
    <div style={{
      minHeight:'100vh', background:T.bg,
      padding:mobile
        ? `calc(14px + var(--safe-t)) 16px calc(var(--tabbar-h) + 16px)`
        : '30px 28px calc(var(--tabbar-h) + 28px)',
    }}>
      <div style={{ maxWidth:1200, margin:'0 auto', display:'flex', flexDirection:'column', gap:mobile ? 22 : 28 }}>
        {header}
        {mobile && (
          <div style={{ display:'flex', gap:8 }}>
            <Btn variant="primary" full onClick={() => navigate('/autoplan')}>✦ Plan generieren</Btn>
            <Btn onClick={() => navigate('/onboarding')} ariaLabel="Neues Beet anlegen">+</Btn>
          </div>
        )}
        {adviceSection}
        {tasksSection}
        {bedsSection}
        {sowSection}
      </div>
      {settingsSheet}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      <TabBar active="home" />
    </div>
  );
}
