import { useState, useEffect, useRef } from 'react';
import { T } from '../theme';
import { plantById, SNAP_CM } from '../data/plants';

function snap(v) { return Math.round(v / SNAP_CM) * SNAP_CM; }

export function BedCanvas({ bed, showConflict=true, draggingPlant, onCellPlace, onCellRemove, onCellMove, readOnly=false }) {
  const { cells, plantStatus, bedWidth, bedDepth } = bed;
  const bw = bedWidth || 120;
  const bh = bedDepth || 80;
  const containerRef = useRef(null);
  const [canvasW, setCanvasW] = useState(0);
  const [ghostPos, setGhostPos] = useState(null);
  const [draggingKey, setDraggingKey] = useState(null);
  const dragDidMoveRef = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width > 0) setCanvasW(rect.width);
    const obs = new ResizeObserver(([e]) => setCanvasW(e.contentRect.width));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

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

  // Ghost shows when dragging from sidebar OR when repositioning a placed plant
  const ghostPlantId = draggingPlant || (draggingKey ? cells[draggingKey]?.plantId : null);
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
          const {plantId, x, y} = item;
          const p = plantById(plantId);
          if (!p) return null;
          const d = p.spacing_cm * scale;
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
                dragDidMoveRef.current = false;
                setDraggingKey(key);
              }}
              onDragEnd={() => {
                setDraggingKey(null);
                setGhostPos(null);
              }}
              onClick={readOnly ? undefined : (e) => {
                e.stopPropagation();
                // dragDidMoveRef guards against spurious click-after-drag on some browsers
                if (!dragDidMoveRef.current) onCellRemove(key);
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
            </div>
          );
        })}

        {ghostPlant && canvasW > 0 && (() => {
          const d = ghostPlant.spacing_cm * scale;
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
    </div>
  );
}
