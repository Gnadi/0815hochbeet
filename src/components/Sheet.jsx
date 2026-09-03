import { useEffect, useRef, useState } from 'react';
import { T } from '../theme';

/**
 * Bottom sheet for phones (centred dialog on wide screens).
 *
 * Handles the three things a hand-rolled overlay usually gets wrong: the page
 * behind it keeps its scroll position, Escape and a swipe down both close it,
 * and the content never disappears behind the home indicator.
 */
export function Sheet({ open, onClose, title, subtitle, children, footer, maxHeight = '85vh', desktopWidth = 460 }) {
  const [drag, setDrag] = useState(0);
  const startY = useRef(null);
  const sheetRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  useEffect(() => { if (open) setDrag(0); }, [open]);

  if (!open) return null;

  // Only start a dismiss-drag when the content is already scrolled to the top,
  // otherwise the gesture belongs to the list inside.
  function onTouchStart(e) {
    if ((scrollRef.current?.scrollTop || 0) > 0) return;
    startY.current = e.touches[0].clientY;
  }
  function onTouchMove(e) {
    if (startY.current === null) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) setDrag(dy);
  }
  function onTouchEnd() {
    if (drag > 110) onClose?.();
    setDrag(0);
    startY.current = null;
  }

  return (
    <div
      className="fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position:'fixed', inset:0, zIndex:80,
        background:'var(--scrim)', backdropFilter:'blur(3px)',
        display:'flex', alignItems:'flex-end', justifyContent:'center',
      }}
    >
      <div
        ref={sheetRef}
        className="sheet-up"
        onClick={e => e.stopPropagation()}
        style={{
          width:'100%', maxWidth:desktopWidth,
          background:T.paper,
          borderTopLeftRadius:26, borderTopRightRadius:26,
          borderBottomLeftRadius:0, borderBottomRightRadius:0,
          boxShadow:'var(--shadow-lg)',
          maxHeight, display:'flex', flexDirection:'column',
          transform:drag ? `translateY(${drag}px)` : undefined,
          transition:drag ? 'none' : 'transform 0.2s',
          border:`1px solid ${T.border}`, borderBottom:'none',
        }}
      >
        <div
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          style={{ padding:'10px 20px 6px', flexShrink:0, touchAction:'none', cursor:'grab' }}
        >
          <div style={{ width:40, height:4, background:T.borderHi, borderRadius:2, margin:'0 auto 12px' }} />
          {title && (
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
              <div style={{ minWidth:0 }}>
                <h2 style={{ fontFamily:"'Fraunces',serif", fontSize:20, fontWeight:500, margin:0 }}>{title}</h2>
                {subtitle && <div style={{ fontSize:12, color:T.inkDim, marginTop:2 }}>{subtitle}</div>}
              </div>
              <button
                onClick={onClose}
                aria-label="Schließen"
                style={{ width:34, height:34, minWidth:34, borderRadius:17, border:`1px solid ${T.border}`, background:T.panel, color:T.inkDim, fontSize:16, cursor:'pointer', flexShrink:0, lineHeight:1 }}
              >×</button>
            </div>
          )}
        </div>

        <div
          ref={scrollRef}
          style={{ overflowY:'auto', WebkitOverflowScrolling:'touch', padding:'8px 20px 4px', flex:1, overscrollBehavior:'contain' }}
        >
          {children}
        </div>

        <div style={{ padding:`12px 20px calc(14px + var(--safe-b))`, flexShrink:0, borderTop:footer ? `1px solid ${T.border}` : 'none' }}>
          {footer}
        </div>
      </div>
    </div>
  );
}
