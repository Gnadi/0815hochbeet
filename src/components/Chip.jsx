import { T } from '../theme';
export function Chip({ children, style={} }) {
  return (
    <div style={{
      display:'inline-flex', alignItems:'center', gap:6,
      padding:'5px 10px', borderRadius:999,
      background:T.panel, border:`1px solid ${T.border}`,
      fontSize:11, ...style,
    }}>{children}</div>
  );
}
