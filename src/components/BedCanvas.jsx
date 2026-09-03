import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { T } from '../theme';
import { SNAP_CM, plantById } from '../data/plants';

/**
 * Smallest comfortable tap target, in screen pixels. It applies to the
 * invisible hit area only — never to the drawn circle. Inflating the drawing
 * turned a dense carrot row (5 cm spacing) into an unreadable smear, because
 * every circle was painted 60 % wider than the gap it actually sits in.
 */
const MIN_HIT = 30;
/**
 * Above these on-screen diameters a circle can carry its initial, then its
 * name. Below the first, an italic serif capital is just a smudge — a block of
 * 5 cm carrots reads far better as plain dots, with the legend naming them.
 */
const GLYPH_AT = 24;
const LABEL_AT = 54;
const MAX_ZOOM = 5;
const TAP_SLOP = 9;

const snap = (v) => Math.round(v / SNAP_CM) * SNAP_CM;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/**
 * The bed. Rebuilt around pointer events so one code path serves mouse, touch
 * and pen.
 *
 * The three things that made the old canvas painful on a phone are gone:
 * a tap on a plant now *selects* it instead of silently deleting one, a
 * placement that does not fit says so instead of doing nothing, and the plan
 * can be pinched open so 5 cm spacings are actually workable.
 */
export function BedCanvas({
  bed,
  armedPlant = null,
  selectedKey = null,
  onSelect,
  onPlace,
  onMove,
  onBlocked,
  showConflict = true,
  showSun = false,
  readOnly = false,
  height,
}) {
  const { cells, plantStatus, bedWidth, bedDepth } = bed;
  const bw = bedWidth || 120;
  const bh = bedDepth || 80;

  const viewportRef = useRef(null);
  const [vw, setVw] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [ghost, setGhost] = useState(null);      // { xCm, yCm, plantId, ok }
  const [dragKey, setDragKey] = useState(null);

  const pointers = useRef(new Map());
  const gesture = useRef(null);
  const lastTap = useRef({ t: 0, x: 0, y: 0 });

  // ── Layout ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const set = (w) => { if (w > 0) setVw(w); };
    set(el.getBoundingClientRect().width);
    const obs = new ResizeObserver(([e]) => set(e.contentRect.width));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const base = vw > 0 ? vw / bw : 0;          // px per cm at zoom 1
  const stageW = vw;
  const stageH = base * bh;
  const scale = base * zoom;                   // px per cm on screen

  const clampPan = useCallback((p, z) => ({
    x: stageW * z <= stageW ? 0 : clamp(p.x, stageW - stageW * z, 0),
    y: stageH * z <= stageH ? 0 : clamp(p.y, stageH - stageH * z, 0),
  }), [stageW, stageH]);

  useEffect(() => { setPan(p => clampPan(p, zoom)); }, [zoom, clampPan]);

  const toCm = useCallback((clientX, clientY) => {
    const r = viewportRef.current?.getBoundingClientRect();
    if (!r || !base) return null;
    return {
      xCm: snap((clientX - r.left - pan.x) / (base * zoom)),
      yCm: snap((clientY - r.top - pan.y) / (base * zoom)),
    };
  }, [base, zoom, pan]);

  const zoomAt = useCallback((nextZoom, clientX, clientY) => {
    const r = viewportRef.current?.getBoundingClientRect();
    if (!r) return;
    const z = clamp(nextZoom, 1, MAX_ZOOM);
    setZoom(prevZ => {
      setPan(prevPan => {
        const lx = (clientX - r.left - prevPan.x) / prevZ;
        const ly = (clientY - r.top - prevPan.y) / prevZ;
        return clampPan({ x: clientX - r.left - lx * z, y: clientY - r.top - ly * z }, z);
      });
      return z;
    });
  }, [clampPan]);

  const resetView = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, []);

  // ── Collision test for the placement ghost ───────────────────────────────
  const fits = useCallback((xCm, yCm, plantId, ignoreKey) => {
    const p = plantById(plantId);
    if (!p) return false;
    for (const [k, item] of Object.entries(cells)) {
      if (k === ignoreKey || !item || typeof item !== 'object') continue;
      const p2 = plantById(item.plantId);
      if (!p2) continue;
      if (Math.hypot(xCm - item.x, yCm - item.y) < (p.spacing_cm + p2.spacing_cm) / 2) {
        // Landing on an existing circle of the same kind means "one more".
        return item.plantId === plantId && Math.hypot(xCm - item.x, yCm - item.y) <= Math.max(p.spacing_cm / 2, 8);
      }
    }
    return true;
  }, [cells]);

  // ── Pointer gestures ─────────────────────────────────────────────────────
  const onPointerDown = (e) => {
    if (readOnly) return;
    const el = viewportRef.current;
    el?.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = {
        mode: 'pinch',
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        zoom,
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      };
      setGhost(null);
      setDragKey(null);
      return;
    }
    if (pointers.current.size > 2) return;

    const key = e.target?.closest?.('[data-cell-key]')?.dataset?.cellKey || null;
    gesture.current = {
      mode: null,
      key,
      startX: e.clientX, startY: e.clientY,
      startPan: pan,
    };
  };

  const onPointerMove = (e) => {
    if (readOnly) return;
    const g = gesture.current;
    if (!g) {
      // Desktop hover preview for the armed plant.
      if (armedPlant && e.pointerType === 'mouse') {
        const pos = toCm(e.clientX, e.clientY);
        if (pos) setGhost({ ...pos, plantId: armedPlant, ok: fits(pos.xCm, pos.yCm, armedPlant) });
      }
      return;
    }
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (g.mode === 'pinch') {
      const pts = [...pointers.current.values()];
      if (pts.length < 2) return;
      const [a, b] = pts;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (g.dist > 0) zoomAt(g.zoom * (dist / g.dist), g.mid.x, g.mid.y);
      return;
    }

    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    if (g.mode === null) {
      if (Math.hypot(dx, dy) < TAP_SLOP) return;
      if (g.key) { g.mode = 'drag'; setDragKey(g.key); }
      else if (zoom > 1) g.mode = 'pan';
      else g.mode = 'idle';
    }

    if (g.mode === 'pan') {
      setPan(clampPan({ x: g.startPan.x + dx, y: g.startPan.y + dy }, zoom));
    } else if (g.mode === 'drag') {
      const pos = toCm(e.clientX, e.clientY);
      const item = cells[g.key];
      if (pos && item) setGhost({ ...pos, plantId: item.plantId, ok: fits(pos.xCm, pos.yCm, item.plantId, g.key) });
    }
  };

  const endGesture = (e) => {
    if (readOnly) return;
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (!g) return;
    if (pointers.current.size > 0) {
      // Second finger lifted mid-pinch: drop the gesture rather than jumping.
      if (g.mode === 'pinch') gesture.current = null;
      return;
    }
    gesture.current = null;

    if (g.mode === 'drag') {
      const pos = toCm(e.clientX, e.clientY);
      if (pos) {
        const moved = onMove?.(g.key, pos.xCm, pos.yCm);
        if (moved === false) onBlocked?.('move');
      }
      setDragKey(null);
      setGhost(null);
      return;
    }
    if (g.mode === 'pan' || g.mode === 'pinch' || g.mode === 'idle') { setGhost(null); return; }

    // ── It was a tap ───────────────────────────────────────────────────────
    if (g.key) { onSelect?.(g.key); setGhost(null); return; }

    const now = Date.now();
    const isDoubleTap = now - lastTap.current.t < 320 && Math.hypot(e.clientX - lastTap.current.x, e.clientY - lastTap.current.y) < 30;
    lastTap.current = { t: now, x: e.clientX, y: e.clientY };

    if (armedPlant) {
      const pos = toCm(e.clientX, e.clientY);
      if (pos) {
        const res = onPlace?.(pos.xCm, pos.yCm, armedPlant);
        if (res === 'blocked') onBlocked?.('place');
      }
      setGhost(null);
      return;
    }

    if (isDoubleTap) { zoomAt(zoom > 1.2 ? 1 : 2.6, e.clientX, e.clientY); return; }
    onSelect?.(null);
    setGhost(null);
  };

  const onWheel = (e) => {
    if (readOnly || !e.ctrlKey) return;   // trackpad pinch arrives as ctrl+wheel
    e.preventDefault();
    zoomAt(zoom * (e.deltaY < 0 ? 1.12 : 0.89), e.clientX, e.clientY);
  };

  // ── Static layers ────────────────────────────────────────────────────────
  const grid = useMemo(() => {
    if (!base || readOnly) return null;
    const step = bw > 200 ? 20 : 10;             // cm between grid lines
    const lines = [];
    for (let x = step; x < bw; x += step) lines.push(<line key={`v${x}`} x1={x * base} y1={0} x2={x * base} y2={stageH} stroke="var(--dot)" strokeWidth={x % (step * 5) === 0 ? 0.9 : 0.4} />);
    for (let y = step; y < bh; y += step) lines.push(<line key={`h${y}`} x1={0} y1={y * base} x2={stageW} y2={y * base} stroke="var(--dot)" strokeWidth={y % (step * 5) === 0 ? 0.9 : 0.4} />);
    return lines;
  }, [base, bw, bh, stageW, stageH, readOnly]);

  const items = useMemo(
    () => Object.entries(cells).filter(([, v]) => v && typeof v === 'object'),
    [cells],
  );

  if (!base) {
    return <div ref={viewportRef} style={{ width:'100%', aspectRatio:`${bw} / ${bh}`, borderRadius:16, background:'var(--soil)' }} />;
  }

  const ghostPlant = ghost ? plantById(ghost.plantId) : null;

  return (
    <div style={{ position:'relative', width:'100%' }}>
      {/* Scale + zoom controls */}
      {!readOnly && (
        <div className="no-print" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8, gap:8 }}>
          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:T.inkMute, letterSpacing:'0.08em', textTransform:'uppercase' }}>
            {bw} × {bh} cm
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            {zoom > 1.01 && (
              <button onClick={resetView} style={zoomBtn} aria-label="Ansicht zurücksetzen">
                {zoom.toFixed(1)}× ⤢
              </button>
            )}
            <button onClick={(e) => zoomAt(zoom / 1.5, e.currentTarget.getBoundingClientRect().left, e.currentTarget.getBoundingClientRect().top)} style={zoomBtn} aria-label="Verkleinern">−</button>
            <button onClick={() => { const r = viewportRef.current.getBoundingClientRect(); zoomAt(zoom * 1.5, r.left + r.width / 2, r.top + r.height / 2); }} style={zoomBtn} aria-label="Vergrößern">+</button>
          </div>
        </div>
      )}

      <div
        ref={viewportRef}
        id="bed-canvas"
        role="application"
        aria-label={`Beetfläche ${bw} mal ${bh} Zentimeter mit ${items.length} Pflanzgruppen`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
        onPointerLeave={() => { if (!gesture.current) setGhost(null); }}
        onWheel={onWheel}
        onContextMenu={(e) => e.preventDefault()}
        className="no-select"
        style={{
          position:'relative', width:'100%',
          height: height || stageH,
          borderRadius:16, overflow:'hidden',
          background:'var(--soil)',
          border:`1px solid var(--soil-line)`,
          boxShadow: readOnly ? 'none' : 'inset 0 2px 8px rgba(0,0,0,0.14)',
          touchAction: readOnly ? 'auto' : 'none',
          cursor: readOnly ? 'default' : armedPlant ? 'crosshair' : zoom > 1 ? 'grab' : 'default',
        }}
      >
        <div style={{
          position:'absolute', top:0, left:0,
          width:stageW, height:stageH,
          transform:`translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin:'0 0',
          willChange:'transform',
        }}>
          {/* Sun bands */}
          {showSun && (
            <div style={{ position:'absolute', inset:0, display:'flex', pointerEvents:'none' }}>
              {[['Sonne', 0.45, 'rgba(217,164,65,0.24)'], ['Halbschatten', 0.30, 'rgba(217,164,65,0.12)'], ['Schatten', 0.25, 'rgba(31,42,27,0.16)']].map(([label, frac, bg]) => (
                <div key={label} style={{ flex:frac, background:bg, display:'flex', alignItems:'flex-start', justifyContent:'center', paddingTop:4 }}>
                  <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:8, color:'rgba(255,255,255,0.85)', textShadow:'0 1px 2px rgba(0,0,0,0.5)' }}>{label}</span>
                </div>
              ))}
            </div>
          )}

          {grid && (
            <svg width={stageW} height={stageH} style={{ position:'absolute', inset:0, pointerEvents:'none' }} aria-hidden="true">
              {grid}
            </svg>
          )}

          {/* Plants */}
          {items.map(([key, item]) => {
            const p = plantById(item.plantId);
            if (!p) return null;

            // Drawn at its true footprint, always: the circle on screen is the
            // room the plant actually claims in the bed. Only the hit area is
            // padded out to something a finger can find, and never so far that
            // it swallows a neighbour.
            const drawn = p.spacing_cm * base;
            const onScreen = drawn * zoom;
            const hit = readOnly ? drawn : Math.max(drawn, Math.min(MIN_HIT / zoom, drawn * 1.8));

            const cx = item.x * base;
            const cy = item.y * base;
            const status = showConflict ? plantStatus?.[key] : null;
            // A conflict is actionable and always gets its ring. "Good
            // neighbour" is a confirmation, and on a dense row of 5 cm carrots
            // 48 touching green rings merge into a mesh that hides the bed —
            // so it is only drawn where there is room for it to read as a ring.
            const ring = status?.status === 'bad' ? T.bad
              : (status?.status === 'good' && onScreen >= 26) ? T.good
              : null;
            const isSelected = selectedKey === key;
            const isDragging = dragKey === key;
            const count = item.count || 1;

            // A drop shadow under every circle is what turns a tight row to
            // mud; small circles get a crisp rim instead so they stay apart.
            const rim = `inset 0 0 0 ${Math.max(0.5, onScreen * 0.05) / zoom}px rgba(255,255,255,0.5)`;
            const lift = onScreen > 26 ? `, 0 3px 10px -2px rgba(0,0,0,${ring ? 0.35 : 0.3})` : '';
            // Ring widths scale with the circle: a fixed 4 px halo swallowed a
            // 15 px carrot whole, hiding the very plant it was pointing at.
            const selW = Math.min(2.5, Math.max(1, onScreen * 0.13)) / zoom;
            const statusW = Math.min(2, Math.max(0.8, onScreen * 0.1)) / zoom;
            // Green hugs the circle, the light halo sits outside it. The other
            // way round, the halo covered a 15 px carrot's own colour.
            const shadow = isSelected
              ? `0 0 0 ${selW}px ${T.green}, 0 0 0 ${selW * 2}px var(--panel), 0 4px 14px -2px rgba(0,0,0,0.45)`
              : ring
                ? `0 0 0 ${statusW}px ${ring}${lift}`
                : `${rim}${lift}`;

            return (
              <div key={key} style={{ position:'absolute', left:cx, top:cy, width:0, height:0 }}>
                {/* The selected plant shows the space it claims, so the
                    gardener can see why nothing else fits beside it. */}
                {isSelected && drawn > 8 && (
                  <div aria-hidden="true" style={{
                    position:'absolute', left:-drawn * 0.9, top:-drawn * 0.9,
                    width:drawn * 1.8, height:drawn * 1.8, borderRadius:'50%',
                    border:`${1 / zoom}px dashed oklch(0.70 0.09 ${p.hue} / 0.65)`,
                    pointerEvents:'none',
                  }} />
                )}

                {/* Invisible, finger-sized hit area */}
                <div
                  data-cell-key={key}
                  title={`${p.de}${count > 1 ? ` ×${count}` : ''}`}
                  style={{
                    position:'absolute', left:-hit / 2, top:-hit / 2,
                    width:hit, height:hit, borderRadius:'50%',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    cursor: readOnly ? 'default' : 'grab',
                    pointerEvents: readOnly ? 'none' : 'auto',
                  }}
                >
                  {/* The visible plant */}
                  <div style={{
                    width:drawn, height:drawn, borderRadius:'50%',
                    background:`radial-gradient(circle at 35% 30%, oklch(0.80 0.10 ${p.hue}), oklch(0.50 0.15 ${p.hue}))`,
                    boxShadow:shadow,
                    display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                    opacity: isDragging ? 0.28 : 1,
                    transition:'opacity 0.12s, box-shadow 0.15s',
                    pointerEvents:'none', position:'relative',
                  }}>
                    {onScreen > GLYPH_AT && (
                      <span style={{ fontSize:Math.min(drawn * 0.42, 26 / zoom), fontFamily:"'Fraunces',serif", fontStyle:'italic', color:'rgba(255,255,255,0.96)', lineHeight:1 }}>
                        {p.glyph[0]}
                      </span>
                    )}
                    {onScreen > LABEL_AT && (
                      <span style={{ fontSize:Math.min(drawn * 0.14, 12 / zoom), color:'rgba(255,255,255,0.9)', fontWeight:600, marginTop:1 }}>
                        {p.de}
                      </span>
                    )}
                    {count > 1 && onScreen > 26 && (
                      <span style={{
                        position:'absolute', bottom:-2 / zoom, right:-2 / zoom,
                        background:'var(--ink)', color:'var(--bg)',
                        fontFamily:"'JetBrains Mono',monospace",
                        fontSize:Math.max(7, Math.min(11, drawn * 0.26)),
                        borderRadius:999, padding:`${1 / zoom}px ${4 / zoom}px`,
                        lineHeight:1.4,
                        border:`${1 / zoom}px solid var(--panel)`,
                      }}>×{count}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Placement / move ghost */}
          {ghostPlant && (() => {
            const d = Math.max(14 / zoom, ghostPlant.spacing_cm * base);
            return (
              <div aria-hidden="true" style={{
                position:'absolute', pointerEvents:'none',
                left:ghost.xCm * base - d / 2, top:ghost.yCm * base - d / 2,
                width:d, height:d, borderRadius:'50%',
                background: ghost.ok ? `oklch(0.80 0.10 ${ghostPlant.hue} / 0.42)` : 'rgba(192,68,42,0.30)',
                border:`${2 / zoom}px dashed ${ghost.ok ? `oklch(0.55 0.15 ${ghostPlant.hue})` : T.bad}`,
                display:'flex', alignItems:'center', justifyContent:'center',
                color:'#fff', fontSize:Math.min(d * 0.4, 22 / zoom), lineHeight:1,
              }}>
                {!ghost.ok && '✕'}
              </div>
            );
          })()}
        </div>

        {/* Empty state */}
        {items.length === 0 && !readOnly && (
          <div style={{
            position:'absolute', inset:0, display:'flex', flexDirection:'column',
            alignItems:'center', justifyContent:'center', gap:6, pointerEvents:'none',
            color:'rgba(255,255,255,0.85)', textAlign:'center', padding:20,
          }}>
            <div style={{ fontFamily:"'Fraunces',serif", fontSize:22, fontStyle:'italic', textShadow:'0 1px 4px rgba(0,0,0,0.4)' }}>Leeres Beet</div>
            <div style={{ fontSize:12, maxWidth:230, lineHeight:1.5, textShadow:'0 1px 3px rgba(0,0,0,0.45)' }}>
              {armedPlant ? 'Tippe auf die Erde, um zu pflanzen.' : 'Wähle unten eine Pflanze aus.'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const zoomBtn = {
  minWidth:36, height:32, padding:'0 10px', borderRadius:10,
  border:`1px solid ${T.border}`, background:T.panel, color:T.ink,
  fontSize:13, fontWeight:600, cursor:'pointer', lineHeight:1,
  fontFamily:"'JetBrains Mono',monospace", touchAction:'manipulation',
};
