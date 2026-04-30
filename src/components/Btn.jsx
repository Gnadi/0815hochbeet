import { T } from '../theme';
export function TrashIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4h12" /><path d="M5 4V2.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 .5.5V4" /><path d="M13 4l-.867 8.664A1 1 0 0 1 11.14 13.6H4.86a1 1 0 0 1-.993-.936L3 4" /><path d="M6.5 7v3.5M9.5 7v3.5" />
    </svg>
  );
}
const V = {
  default: { background:T.panel, color:T.ink, border:`1px solid ${T.border}` },
  primary: { background:T.green, color:'#fff', border:'none' },
  terra:   { background:T.terra, color:'#fff', border:'none' },
  ghost:   { background:'transparent', color:T.ink, border:`1px solid ${T.border}` },
};
export function Btn({ children, variant='default', onClick, disabled, style={}, type='button', title }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title} style={{
      display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8,
      padding:'9px 16px', borderRadius:999, cursor:disabled?'not-allowed':'pointer',
      fontSize:13, fontWeight:500, transition:'all 0.15s', fontFamily:'inherit',
      opacity:disabled?0.4:1, ...V[variant], ...style,
    }}>{children}</button>
  );
}
