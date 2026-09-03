import { T } from '../theme';

/**
 * Brand assets, generated from assets/logo-source.png by `npm run icons`.
 *
 * The artwork carries its own cream ground, so it always sits on a light
 * "plate" — that keeps it readable on the dark hero panel and in dark mode
 * without needing a second colour version of the logo.
 */
export function LogoMark({ size = 40, radius, style = {} }) {
  return (
    <span style={{
      width:size, height:size, flexShrink:0,
      borderRadius:radius ?? Math.round(size * 0.26),
      background:'#FDFBF5', overflow:'hidden',
      display:'inline-flex', alignItems:'center', justifyContent:'center',
      boxShadow:'inset 0 0 0 1px rgba(31,42,27,0.08)',
      ...style,
    }}>
      <img src="/logo-mark.png" alt="" width={size} height={size}
        style={{ width:'100%', height:'100%', objectFit:'contain' }} />
    </span>
  );
}

/** Full lock-up: emblem plus the Hochbeet-Planer wordmark. */
export function LogoFull({ width = 200, style = {} }) {
  return (
    <span style={{
      display:'inline-flex', padding:'10px 16px', borderRadius:18,
      background:'#FDFBF5', boxShadow:'inset 0 0 0 1px rgba(31,42,27,0.07)',
      ...style,
    }}>
      <img src="/logo.png" alt="Hochbeet-Planer" width={width}
        style={{ width, height:'auto', display:'block' }} />
    </span>
  );
}

/** Mark plus text, for app bars and the sidebar. */
export function LogoLockup({ size = 34, onClick, subtitle = 'PLANER' }) {
  const inner = (
    <>
      <LogoMark size={size} />
      <span style={{ textAlign:'left' }}>
        <span style={{ display:'block', fontFamily:"'Fraunces',serif", fontSize:size * 0.46, fontWeight:600, lineHeight:1.1 }}>Hochbeet</span>
        <span style={{ display:'block', fontFamily:"'JetBrains Mono',monospace", fontSize:size * 0.27, color:T.inkMute, letterSpacing:'0.12em' }}>{subtitle}</span>
      </span>
    </>
  );
  if (!onClick) return <span style={{ display:'inline-flex', alignItems:'center', gap:10 }}>{inner}</span>;
  return (
    <button onClick={onClick} aria-label="Zur Startseite"
      style={{ display:'inline-flex', alignItems:'center', gap:10, background:'none', border:'none', padding:0, cursor:'pointer', fontFamily:'inherit', color:T.ink }}>
      {inner}
    </button>
  );
}
