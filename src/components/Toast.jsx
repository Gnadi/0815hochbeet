import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { T } from '../theme';

const Ctx = createContext(() => {});

/**
 * Short confirmations with an optional "Rückgängig" action — the safety net
 * that makes a tap-to-delete canvas usable on a phone.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts(list => list.filter(t => t.id !== id));
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);

  const toast = useCallback(({ message, action, actionLabel = 'Rückgängig', tone = 'default', duration = 4200 }) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(list => [...list.slice(-2), { id, message, action, actionLabel, tone }]);
    timers.current.set(id, setTimeout(() => dismiss(id), duration));
    return id;
  }, [dismiss]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const tones = {
    default: { background:T.ink, color:T.bg },
    bad:     { background:T.bad, color:'#fff' },
    good:    { background:T.green, color:'var(--panel)' },
  };

  return (
    <Ctx.Provider value={toast}>
      {children}
      <div
        aria-live="polite"
        style={{
          position:'fixed', left:12, right:12, zIndex:200,
          bottom:'calc(var(--tabbar-h) + 12px)',
          display:'flex', flexDirection:'column', gap:8, alignItems:'center',
          pointerEvents:'none',
        }}
      >
        {toasts.map(t => (
          <div key={t.id} className="toast-in" style={{
            pointerEvents:'auto', display:'flex', alignItems:'center', gap:14,
            padding:'12px 14px 12px 18px', borderRadius:16, maxWidth:440, width:'100%',
            boxShadow:'0 10px 30px -8px rgba(0,0,0,0.4)', fontSize:13, fontWeight:500,
            ...tones[t.tone],
          }}>
            <span style={{ flex:1, minWidth:0 }}>{t.message}</span>
            {t.action && (
              <button
                onClick={() => { t.action(); dismiss(t.id); }}
                style={{ background:'rgba(255,255,255,0.16)', border:'none', color:'inherit', borderRadius:999, padding:'8px 14px', fontSize:12, fontWeight:700, cursor:'pointer', minHeight:36, flexShrink:0 }}
              >{t.actionLabel}</button>
            )}
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Meldung schließen"
              style={{ background:'none', border:'none', color:'inherit', opacity:0.6, fontSize:16, cursor:'pointer', padding:'4px 2px', lineHeight:1, flexShrink:0 }}
            >×</button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);

/** Short buzz on destructive or blocked actions, where the device supports it. */
export function haptic(pattern = 12) {
  try { navigator.vibrate?.(pattern); } catch {}
}
