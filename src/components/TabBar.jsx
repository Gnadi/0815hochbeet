import { useLocation, useNavigate } from 'react-router-dom';
import { T } from '../theme';

const S = { width:22, height:22, viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', strokeWidth:1.7, strokeLinecap:'round', strokeLinejoin:'round' };

const ICONS = {
  home: (
    <svg {...S} aria-hidden="true"><path d="M12 21c-3.5 0-6-2.6-6-6.2C6 10.5 12 3 12 3s6 7.5 6 11.8C18 18.4 15.5 21 12 21Z" /><path d="M12 21v-8" /></svg>
  ),
  beds: (
    <svg {...S} aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M9 6v12M15 6v12M3 12h18" /></svg>
  ),
  calendar: (
    <svg {...S} aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
  ),
  plants: (
    <svg {...S} aria-hidden="true"><path d="M12 20v-7" /><path d="M12 13c0-3 2-5 5-5 0 3-2 5-5 5Z" /><path d="M12 15c0-3-2-5-5-5 0 3 2 5 5 5Z" /></svg>
  ),
};

const TABS = [
  { id:'home',     label:'Heute',    path:'/dashboard' },
  { id:'beds',     label:'Beete',    path:'/beds' },
  { id:'calendar', label:'Kalender', path:'/calendar' },
  { id:'plants',   label:'Pflanzen', path:'/plants' },
];

/**
 * Bottom navigation. `active` may be passed explicitly; otherwise it is derived
 * from the route so deep pages (a bed, the season view) still highlight the
 * right tab.
 */
export function TabBar({ active }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const current = active ?? (
    pathname.startsWith('/bed') ? 'beds'
    : pathname.startsWith('/calendar') ? 'calendar'
    : pathname.startsWith('/plants') ? 'plants'
    : 'home'
  );

  return (
    <nav
      className="no-print"
      aria-label="Hauptnavigation"
      style={{
        position:'fixed', left:0, right:0, bottom:0, zIndex:60,
        padding:`0 max(10px, var(--safe-l)) calc(8px + var(--safe-b)) max(10px, var(--safe-r))`,
        pointerEvents:'none',
      }}
    >
      <div style={{
        pointerEvents:'auto',
        background:'color-mix(in srgb, var(--panel) 88%, transparent)',
        backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)',
        borderRadius:26, padding:'6px 4px',
        border:`1px solid ${T.border}`,
        boxShadow:'0 8px 24px -8px rgba(0,0,0,0.22)',
        display:'flex', justifyContent:'space-around',
        maxWidth:520, margin:'0 auto',
      }}>
        {TABS.map(t => {
          const on = current === t.id;
          return (
            <button
              key={t.id}
              onClick={() => navigate(t.path)}
              aria-current={on ? 'page' : undefined}
              style={{
                flex:1, minHeight:52, padding:'6px 4px', border:'none', background:'transparent',
                display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3,
                cursor:'pointer', fontFamily:'inherit', touchAction:'manipulation',
                color:on ? T.green : T.inkMute, transition:'color 0.15s',
              }}
            >
              {ICONS[t.id]}
              <span style={{ fontSize:10, fontWeight:on ? 700 : 500, letterSpacing:'0.01em' }}>{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
