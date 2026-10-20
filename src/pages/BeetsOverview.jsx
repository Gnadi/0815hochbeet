import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useBeds } from '../hooks/useBeds';
import { deleteBed } from '../lib/beds';
import { LABEL, MONO, T } from '../theme';
import { plantById } from '../data/plants';
import { MONTHS_DE, MONTHS_DE_SHORT } from '../data/plantDetails';
import { activeAt, viewDate } from '../lib/timeline';
import { TabBar } from '../components/TabBar';
import { BedCard } from '../components/BedCard';
import { Btn } from '../components/Btn';
import { useToast } from '../components/Toast';
import { LogoLockup } from '../components/Logo';

export default function BeetsOverview() {
  const navigate = useNavigate();
  const mobile = useBreakpoint();
  const beds = useBeds();
  const toast = useToast();
  const year = new Date().getFullYear();
  const [month, setMonth] = useState(new Date().getMonth());
  const date = viewDate(year, month);

  const totalYield = beds.reduce((s, b) =>
    s + Object.values(activeAt(b.plantings, date))
      .reduce((n, v) => n + (plantById(v.plantId)?.yield || 0) * (v.count || 1), 0), 0);
  const totalArea = beds.reduce((s, b) => s + (b.width * b.depth) / 10000, 0);

  function handleDelete(id) {
    const bed = beds.find(b => b.id === id);
    deleteBed(id);
    toast({ message:`„${bed?.name || 'Beet'}" gelöscht`, tone:'bad', duration:3200 });
  }

  return (
    <div style={{
      minHeight:'100vh', background:T.bg,
      padding:mobile
        ? `calc(14px + var(--safe-t)) 16px calc(var(--tabbar-h) + 16px)`
        : '30px 28px calc(var(--tabbar-h) + 28px)',
    }}>
      <div style={{ maxWidth:1200, margin:'0 auto' }}>
        <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:14, marginBottom:16 }}>
          <div>
            {!mobile && <div style={{ marginBottom:12 }}><LogoLockup size={38} onClick={() => navigate('/dashboard')} /></div>}
            <div style={LABEL}>{beds.length} Beete · {totalArea.toFixed(2)} m² · ~{totalYield.toFixed(1)} kg geplant</div>
            <h1 style={{ fontFamily:"'Fraunces',serif", fontSize:mobile ? 28 : 44, margin:'6px 0 0', fontWeight:500 }}>
              <em style={{ color:T.green, fontStyle:'italic' }}>Beete</em>
            </h1>
          </div>
          {!mobile && (
            <div style={{ display:'flex', gap:8 }}>
              <Btn onClick={() => navigate('/onboarding')}>+ Neues Beet</Btn>
              <Btn variant="primary" onClick={() => navigate('/autoplan')}>✦ Plan generieren</Btn>
            </div>
          )}
        </div>

        <div className="hscroll" style={{ display:'flex', gap:6, marginBottom:16 }}>
          {MONTHS_DE_SHORT.map((label, m) => {
            const on = month === m;
            return (
              <button key={m} onClick={() => setMonth(m)} aria-pressed={on} aria-label={`${MONTHS_DE[m]} ${year}`}
                style={{
                  padding:'9px 13px', borderRadius:999, fontSize:12.5, fontWeight:600, fontFamily:'inherit',
                  flexShrink:0, cursor:'pointer', minHeight:42,
                  background:on ? T.green : T.panel, color:on ? 'var(--panel)' : T.ink,
                  border:`1px solid ${on ? 'transparent' : T.border}`,
                }}>
                {label}
              </button>
            );
          })}
        </div>

        {mobile && (
          <div style={{ display:'flex', gap:8, marginBottom:16 }}>
            <Btn variant="primary" full onClick={() => navigate('/autoplan')}>✦ Plan generieren</Btn>
            <Btn onClick={() => navigate('/onboarding')} ariaLabel="Neues Beet anlegen">+</Btn>
          </div>
        )}

        <div style={{ display:'grid', gridTemplateColumns:mobile ? '1fr' : 'repeat(auto-fill,minmax(320px,1fr))', gap:12 }}>
          {beds.map(bed => (
            <BedCard key={bed.id} bed={bed} date={date}
              onOpen={() => navigate(`/bed/${bed.id}`)} onDelete={handleDelete} />
          ))}
          <button onClick={() => navigate('/onboarding')}
            style={{ background:'transparent', border:`1.5px dashed ${T.borderHi}`, borderRadius:18, padding:24, cursor:'pointer', minHeight:mobile ? 90 : 180, color:T.inkMute, fontSize:13, fontWeight:600, fontFamily:'inherit' }}>
            + Neues Beet anlegen
          </button>
        </div>

        {beds.length === 0 && (
          <div style={{ ...MONO, fontSize:12, color:T.inkMute, textAlign:'center', padding:'30px 0' }}>
            Noch kein Beet angelegt.
          </div>
        )}
      </div>
      <TabBar active="beds" />
    </div>
  );
}
