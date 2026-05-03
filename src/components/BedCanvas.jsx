import { useState, useEffect, useRef } from 'react';
import { T } from '../theme';
import { plantById, SNAP_CM } from '../data/plants';

const MIN_D = 32; // minimum circle diameter in px regardless of spacing_cm

function snap(v) { return Math.round(v / SNAP_CM) * SNAP_CM; }

export function BedCanvas({ bed, showConflict=true, draggingPlant, onCellPlace, onCellRemove, onCellMove, readOnly=false }) {
  const { cells, plantStatus, bedWidth, bedDepth } = bed;
  const bw = bedWidth || 120;
  const bh = bedDepth || 80;
  const containerRef = useRef(null);
  const [canvasW, setCanvasW] = useState(0);
  const [ghostPos, setGhostPos] = useState(null);
  const [draggingKey, setDraggingKey] = useState(null);

  // Touch drag for placed plants (mobile reposition)
  const touchMoveRef = useRef({ active:false, key:null, plantId:null, startX:0, startY:0, dragging:false });
  const [touchGhost, setTouchGhost] = useState(null);
  const tapHandledRef = useRef(false);
  const onCellMoveRef = useRef(onCellMove);
  const onCellRemoveRef = useRef(onCellRemove);
  useEffect(() => { onCellMoveRef.current = onCellMove; }, [onCellMove]);
  useEffect(() => { onCellRemoveRef.current = onCellRemove; }, [onCellRemove]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width > 0) setCanvasW(rect.width);
    const obs = new ResizeObserver(([e]) => setCanvasW(e.contentRect.width));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (readOnly) return;

    function getCm(clientX, clientY) {
      const el = containerRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const s = rect.width / bw;
      return { xCm: snap((clientX - rect.left) / s), yCm: snap((clientY - rect.top) / s) };
    }

    function onMove(e) {
      const ref = touchMoveRef.current;
      if (!ref.active) return;
      const t = e.touches[0];
      const dx = Math.abs(t.clientX - ref.startX);
      const dy = Math.abs(t.clientY - ref.startY);
      if (!ref.dragging && (dx > 8 || dy > 8)) {
        touchMoveRef.current.dragging = true;
      }
      if (ref.dragging) {
        e.preventDefault();
        setTouchGhost({ x:t.clientX, y:t.clientY, plantId:ref.plantId });
        const pos = getCm(t.clientX, t.clientY);
        if (pos) setGhostPos(pos);
      }
    }

    function onEnd(e) {
      const ref = touchMoveRef.current;
      if (!ref.active) return;
      if (ref.dragging) {
        const t = e.changedTouches[0];
        const pos = getCm(t.clientX, t.clientY);
        if (pos) onCellMoveRef.current?.(ref.key, pos.xCm, pos.yCm);
      } else {
        // Tap — decrement/remove
        tapHandledRef.current = true;
        onCellRemoveRef.current?.(ref.key);
        setTimeout(() => { tapHandledRef.current = false; }, 400);
      }
      touchMoveRef.current = { active:false, key:null, plantId:null, startX:0, startY:0, dragging:false };
      setTouchGhost(null);
      setGhostPos(null);
    }

    window.addEventListener('touchmove', onMove, { passive:false });
    window.addEventListener('touchend', onEnd);
    return () => {
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, [readOnly, bw, bh]);

  const scale = canvasW > 0 ? canvasW / bw : 1;
  const canvasH = scale * bh;

  function getCanvasCm(clientX, clientY) {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    return {
      xCm: snap((clientX - rect.left) / scale),
      yCm: snap((clientY - rect.top)  / scale),
    };
  }

  function handleDrop(e) {
    if (readOnly) return;
    e.preventDefault();
    const sourceKey = e.dataTransfer.getData('sourceKey');
    const pos = getCanvasCm(e.clientX, e.clientY);
    setGhostPos(null);
    setDraggingKey(null);
    if (!pos) return;
    if (sourceKey) {
      onCellMove?.(sourceKey, pos.xCm, pos.yCm);
    } else {
      const plantId = e.dataTransfer.getData('plant');
      if (plantId) onCellPlace(pos.xCm, pos.yCm, plantId);
    }
  }

  function handleDragOver(e) {
    if (readOnly) return;
    e.preventDefault();
    const pos = getCanvasCm(e.clientX, e.clientY);
    if (pos) setGhostPos(pos);
  }

  function handleClick(e) {
    if (readOnly || !draggingPlant) return;
    const pos = getCanvasCm(e.clientX, e.clientY);
    if (pos) onCellPlace(pos.xCm, pos.yCm, draggingPlant);
  }

  const ghostPlantId = draggingPlant
    || (draggingKey ? cells[draggingKey]?.plantId : null)
    || touchGhost?.plantId;
  const ghostPlant = ghostPos && ghostPlantId ? plantById(ghostPlantId) : null;

  const snapDots = [];
  if (!readOnly && canvasW > 0) {
    for (let i = 0; i <= Math.floor(bw / SNAP_CM); i++)
      for (let j = 0; j <= Math.floor(bh / SNAP_CM); j++)
        snapDots.push(<circle key={`${i}-${j}`} cx={i*SNAP_CM*scale} cy={j*SNAP_CM*scale} r={1} fill="rgba(31,42,27,0.45)" />);
  }

  return (
    <div style={{ position:'relative', display:'block', width:'100%', userSelect:'none', boxSizing:'border-box' }}>
      {!readOnly && (
        <div style={{ textAlign:'center', marginBottom:8, fontFamily:'JetBrains Mono,monospace', fontSize:10, color:T.inkMute, textTransform:'uppercase', letterSpacing:'0.08em' }}>
          {bw} × {bh} cm
        </div>
      )}
      <div
        ref={containerRef}
        id="bed-canvas"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={() => setGhostPos(null)}
        onClick={handleClick}
        style={{
          position:'relative', width:'100%',
          height: canvasW > 0 ? canvasH : undefined,
          aspectRatio: canvasW === 0 ? `${bw} / ${bh}` : undefined,
          background:`radial-gradient(ellipse at 50% 120%, rgba(62,52,28,0.22), rgba(120,95,60,0.12) 55%, transparent),
            linear-gradient(175deg, rgba(180,148,95,0.25) 0%, rgba(145,112,72,0.2) 100%)`,
          borderRadius: readOnly ? 10 : 14,
          overflow:'hidden',
          cursor: readOnly ? 'default' : draggingPlant ? 'crosshair' : 'default',
          border:'1px solid rgba(139,108,70,0.32)',
          boxShadow: readOnly ? 'none' : 'inset 0 1px 0 rgba(255,255,255,0.15)',
        }}
      >
        {snapDots.length > 0 && (
          <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none' }}>
            {snapDots}
          </svg>
        )}

        {canvasW > 0 && Object.entries(cells).map(([key, item]) => {
          if (typeof item !== 'object') return null;
          const { plantId, x, y, count=1 } = item;
          const p = plantById(plantId);
          if (!p) return null;
          const d = Math.max(MIN_D, p.spacing_cm * scale);
          const cx = (x / bw) * canvasW;
          const cy = (y / bh) * canvasH;
          const status = showConflict ? plantStatus?.[key] : null;
          const ring = status?.status === 'bad' ? T.bad : status?.status === 'good' ? T.good : null;
          const isBeingDragged = draggingKey === key;
          return (
            <div
              key={key}
              draggable={!readOnly}
              onDragStart={readOnly ? undefined : (e) => {
                e.stopPropagation();
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('sourceKey', key);
                setDraggingKey(key);
              }}
              onDragEnd={() => { setDraggingKey(null); setGhostPos(null); }}
              onTouchStart={readOnly ? undefined : (e) => {
                e.stopPropagation();
                const t = e.touches[0];
                touchMoveRef.current = { active:true, key, plantId, startX:t.clientX, startY:t.clientY, dragging:false };
              }}
              onClick={readOnly ? undefined : (e) => {
                e.stopPropagation();
                if (tapHandledRef.current) return;
                onCellRemove(key);
              }}
              style={{
                position:'absolute',
                width:d, height:d,
                left:cx - d/2, top:cy - d/2,
                borderRadius:'50%',
                background:`radial-gradient(circle at 35% 30%, oklch(0.80 0.10 ${p.hue}), oklch(0.50 0.15 ${p.hue}))`,
                boxShadow: ring
                  ? `0 0 0 3px ${ring}, 0 3px 10px -2px rgba(0,0,0,0.35)`
                  : '0 3px 10px -2px rgba(0,0,0,0.25)',
                display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                cursor: readOnly ? 'default' : 'grab',
                pointerEvents: readOnly ? 'none' : 'auto',
                transition:'box-shadow 0.2s, opacity 0.15s',
                userSelect:'none',
                opacity: isBeingDragged ? 0.3 : 1,
              }}
            >
              {d > 22 && (
                <span style={{ fontSize:Math.min(d*0.38, 22), fontFamily:'Fraunces,serif', color:'rgba(255,255,255,0.95)', fontStyle:'italic', lineHeight:1, pointerEvents:'none' }}>
                  {p.glyph[0]}
                </span>
              )}
              {d > 46 && (
                <span style={{ fontSize:Math.min(d*0.13, 11), color:'rgba(255,255,255,0.85)', fontWeight:600, letterSpacing:'0.02em', pointerEvents:'none' }}>
                  {p.de}
                </span>
              )}
              {count > 1 && (
                <span style={{
                  position:'absolute', bottom:2, right:2,
                  background:'rgba(0,0,0,0.5)', color:'#fff',
                  fontFamily:'JetBrains Mono,monospace',
                  fontSize:Math.max(8, Math.min(11, d * 0.22)),
                  borderRadius:3, padding:'0 3px', lineHeight:1.5,
                  pointerEvents:'none',
                }}>
                  ×{count}
                </span>
              )}
            </div>
          );
        })}

        {ghostPlant && canvasW > 0 && (() => {
          const d = Math.max(MIN_D, ghostPlant.spacing_cm * scale);
          const cx = (ghostPos.xCm / bw) * canvasW;
          const cy = (ghostPos.yCm / bh) * canvasH;
          return (
            <div style={{
              position:'absolute', pointerEvents:'none',
              width:d, height:d,
              left:cx - d/2, top:cy - d/2,
              borderRadius:'50%',
              background:`oklch(0.80 0.10 ${ghostPlant.hue} / 0.45)`,
              border:`2px dashed oklch(0.55 0.15 ${ghostPlant.hue})`,
            }} />
          );
        })()}
      </div>

      {/* Touch drag ghost — floats above the finger while repositioning */}
      {touchGhost && (() => {
        const p = plantById(touchGhost.plantId);
        if (!p) return null;
        const size = Math.max(44, p.spacing_cm * scale);
        return (
          <div style={{
            position:'fixed', pointerEvents:'none', zIndex:1000,
            left: touchGhost.x - size/2, top: touchGhost.y - size - 12,
            width:size, height:size, borderRadius:'50%',
            background:`radial-gradient(circle at 35% 30%, oklch(0.80 0.10 ${p.hue}), oklch(0.50 0.15 ${p.hue}))`,
            display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:'0 6px 20px rgba(0,0,0,0.35)', opacity:0.9,
          }}>
            <span style={{ fontFamily:'Fraunces,serif', fontSize:Math.min(size*0.38,22), color:'rgba(255,255,255,0.95)', fontStyle:'italic' }}>
              {p.glyph[0]}
            </span>
          </div>
        );
      })()}
    </div>
  );
}
