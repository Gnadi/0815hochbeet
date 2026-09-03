import { T } from '../theme';

export function Chip({ children, tone = 'default', style = {} }) {
  const tones = {
    default: { background:T.panel, border:`1px solid ${T.border}`, color:T.ink },
    good:    { background:T.goodBg, border:`1px solid ${T.goodBorder}`, color:T.good },
    bad:     { background:T.badBg,  border:`1px solid ${T.badBorder}`,  color:T.bad },
    warn:    { background:T.warnBg, border:`1px solid ${T.warnBorder}`, color:T.warn },
  };
  return (
    <div style={{
      display:'inline-flex', alignItems:'center', gap:6,
      padding:'6px 11px', borderRadius:999, fontSize:11.5, whiteSpace:'nowrap',
      ...tones[tone], ...style,
    }}>{children}</div>
  );
}
