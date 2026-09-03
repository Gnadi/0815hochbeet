// Design tokens.
//
// The values are CSS custom properties so that inline styles (which this app
// uses everywhere) follow the light/dark theme automatically. `RAW` keeps the
// literal light-mode values for the few places that need to compute with a
// colour rather than hand it to the browser.
export const T = {
  bg:       "var(--bg)",
  paper:    "var(--paper)",
  panel:    "var(--panel)",
  ink:      "var(--ink)",
  inkDim:   "var(--ink-dim)",
  inkMute:  "var(--ink-mute)",
  border:   "var(--border)",
  borderHi: "var(--border-hi)",
  green:    "var(--green)",
  greenLi:  "var(--green-li)",
  terra:    "var(--terra)",
  ochre:    "var(--ochre)",
  good:     "var(--good)",
  bad:      "var(--bad)",
  warn:     "var(--warn)",
  // Tinted surfaces — used for state cards (conflict / success / hint)
  badBg:    "var(--bad-bg)",
  badBorder:"var(--bad-border)",
  goodBg:   "var(--good-bg)",
  goodBorder:"var(--good-border)",
  warnBg:   "var(--warn-bg)",
  warnBorder:"var(--warn-border)",
  soil:     "var(--soil)",
  soilLine: "var(--soil-line)",
  shadow:   "var(--shadow)",
  shadowLg: "var(--shadow-lg)",
};

export const RAW = {
  bg: "#F5EFE0", paper: "#FBF6E9", panel: "#FFFCF2", ink: "#1F2A1B",
  green: "#3E5C30", terra: "#C97A5A", ochre: "#D9A441", bad: "#C9543A",
};

export const MONO = { fontFamily: "'JetBrains Mono', ui-monospace, monospace" };
export const SERIF = { fontFamily: "'Fraunces', Georgia, serif" };

export const LABEL = {
  ...MONO,
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: T.inkMute,
};

/** Minimum comfortable touch target (Apple HIG / Material). */
export const TAP = 44;

const THEME_KEY = 'hb_theme';

export function getStoredTheme() {
  try { return localStorage.getItem(THEME_KEY) || 'system'; } catch { return 'system'; }
}

export function applyTheme(mode) {
  const root = document.documentElement;
  if (mode === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', mode);
  try { localStorage.setItem(THEME_KEY, mode); } catch {}
  const resolved = mode === 'system'
    ? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : mode;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', resolved === 'dark' ? '#141a12' : '#F5EFE0');
}
