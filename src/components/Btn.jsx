import { T, TAP } from '../theme';

export function TrashIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 4h12" /><path d="M5 4V2.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 .5.5V4" /><path d="M13 4l-.867 8.664A1 1 0 0 1 11.14 13.6H4.86a1 1 0 0 1-.993-.936L3 4" /><path d="M6.5 7v3.5M9.5 7v3.5" />
    </svg>
  );
}

const V = {
  default: { background:T.panel, color:T.ink,   border:`1px solid ${T.border}` },
  primary: { background:T.green, color:'var(--panel)', border:'1px solid transparent' },
  terra:   { background:T.terra, color:'var(--panel)', border:'1px solid transparent' },
  ghost:   { background:'transparent', color:T.ink, border:`1px solid ${T.border}` },
  quiet:   { background:'transparent', color:T.inkDim, border:'1px solid transparent' },
  danger:  { background:T.badBg, color:T.bad, border:`1px solid ${T.badBorder}` },
};

const SIZES = {
  sm: { padding:'8px 14px', fontSize:12, minHeight:36 },
  md: { padding:'11px 18px', fontSize:13, minHeight:TAP },
  lg: { padding:'15px 22px', fontSize:15, minHeight:52 },
};

export function Btn({
  children, variant = 'default', size = 'md', onClick, disabled, loading,
  style = {}, type = 'button', title, ariaLabel, full,
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      aria-label={ariaLabel || title}
      aria-busy={loading || undefined}
      style={{
        display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8,
        borderRadius:999, cursor:(disabled || loading) ? 'not-allowed' : 'pointer',
        fontWeight:600, transition:'filter 0.15s, opacity 0.15s, background 0.15s',
        fontFamily:'inherit', lineHeight:1.2, whiteSpace:'nowrap',
        opacity:(disabled || loading) ? 0.45 : 1,
        width: full ? '100%' : undefined,
        touchAction:'manipulation',
        ...SIZES[size], ...V[variant], ...style,
      }}
    >
      {loading && <span className="spin" style={{ width:12, height:12, border:'2px solid currentColor', borderTopColor:'transparent', borderRadius:'50%' }} />}
      {children}
    </button>
  );
}

/** Square icon button that always meets the 44 px touch-target minimum. */
export function IconBtn({ children, onClick, label, active, disabled, tone = 'default', size = TAP, style = {} }) {
  const tones = {
    default: { background:T.panel, color:T.ink, border:`1px solid ${T.border}` },
    primary: { background:T.green, color:'var(--panel)', border:'1px solid transparent' },
    terra:   { background:T.terra, color:'var(--panel)', border:'1px solid transparent' },
    danger:  { background:T.badBg, color:T.bad, border:`1px solid ${T.badBorder}` },
    plain:   { background:'transparent', color:T.inkDim, border:'1px solid transparent' },
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      title={label}
      style={{
        width:size, height:size, minWidth:size, borderRadius:size / 2,
        display:'inline-flex', alignItems:'center', justifyContent:'center',
        cursor:disabled ? 'not-allowed' : 'pointer', fontSize:16, lineHeight:1,
        opacity:disabled ? 0.35 : 1, flexShrink:0, touchAction:'manipulation',
        transition:'background 0.15s, color 0.15s',
        ...(active ? tones.primary : tones[tone]), ...style,
      }}
    >
      {children}
    </button>
  );
}
