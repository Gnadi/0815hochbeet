import { useState, useEffect } from 'react';
import { T } from '../theme';
import { PlantTile } from './PlantTile';
import { plantById } from '../data/plants';

export function BedCanvas({ bed, cellSize=64, showSun=false, showConflict=true, draggingPlant, onCellPlace, onCellRemove, mobile=false }) {
  const { shape, cells, cellStatus, sunMap, shapeEditing, setMaskCell, customMask, isFreeform } = bed;
  const w=shape.w, h=shape.h;
  const editing = shapeEditing && isFreeform;
  const [paintMode, setPaintMode] = useState(null);

  useEffect(() => {
    const up = () => setPaintMode(null);
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  const dim = (() => {
    if (!isFreeform) return {w:w*25,h:h*25};
    let minX=w,maxX=-1,minY=h,maxY=-1;
    Object.keys(customMask||{}).forEach(k=>{
      const [cx,cy]=k.split(',').map(Number);
      if(cx<minX)minX=cx;if(cx>maxX)maxX=cx;
      if(cy<minY)minY=cy;if(cy>maxY)maxY=cy;
    });
    if(maxX<0)return{w:0,h:0};
    return{w:(maxX-minX+1)*25,h:(maxY-minY+1)*25};
  })();

  return (
    <div style={{
      display:'inline-block', padding:mobile?16:28,
      background:T.paper, borderRadius:mobile?16:20,
      border:editing?`2px dashed ${T.terra}`:`1px solid ${T.border}`,
      boxShadow:'0 12px 32px -16px rgba(31,42,27,0.18),inset 0 0 0 6px rgba(255,255,255,0.4)',
      position:'relative', userSelect:'none',
      backgroundImage:'radial-gradient(circle at 20% 30%,rgba(31,42,27,0.025) 1px,transparent 1px),radial-gradient(circle at 70% 60%,rgba(31,42,27,0.02) 1px,transparent 1px)',
      backgroundSize:'6px 6px,9px 9px',
    }}>
      <div style={{position:'absolute',top:-14,left:'50%',transform:'translateX(-50%)',padding:'4px 14px',background:editing?T.terra:T.green,color:'#fff',borderRadius:999,fontFamily:'JetBrains Mono,monospace',fontSize:10,letterSpacing:'0.1em',textTransform:'uppercase',whiteSpace:'nowrap'}}>
        {editing?'Form bearbeiten':`${shape.de} · ${dim.w}×${dim.h} cm`}
      </div>
      <div style={{display:'grid',gridTemplateColumns:`repeat(${w},${cellSize}px)`,gridTemplateRows:`repeat(${h},${cellSize}px)`,gap:3}}>
        {Array.from({length:h}).map((_,y)=>
          Array.from({length:w}).map((_,x)=>{
            const valid=shape.mask(x,y);
            const key=`${x},${y}`;
            const pid=cells[key];
            const status=cellStatus[key];
            const sun=sunMap[key];
            const sunBg=!valid?'transparent':sun==='full'?'rgba(217,164,65,0.18)':sun==='part'?'rgba(217,164,65,0.07)':'rgba(62,92,48,0.10)';

            if (editing) return (
              <div key={key}
                onMouseDown={e=>{e.preventDefault();const wasOn=!!customMask[key];const mode=wasOn?'remove':'add';setPaintMode(mode);setMaskCell(x,y,mode==='add');}}
                onMouseEnter={()=>{if(!paintMode)return;setMaskCell(x,y,paintMode==='add');}}
                onTouchStart={e=>{e.preventDefault();const wasOn=!!customMask[key];setMaskCell(x,y,!wasOn);}}
                style={{background:valid?'rgba(62,92,48,0.22)':'rgba(31,42,27,0.04)',border:valid?`1.5px solid ${T.green}`:`1.5px dashed rgba(31,42,27,0.18)`,borderRadius:6,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'background 0.1s'}}>
                <div style={{fontSize:14,color:valid?T.green:'rgba(31,42,27,0.3)',fontWeight:700}}>{valid?'−':'+'}</div>
              </div>
            );

            return (
              <div key={key}
                onClick={()=>{if(editing)return;if(!valid)return;if(pid)onCellRemove(x,y);else if(draggingPlant)onCellPlace(x,y,draggingPlant);}}
                onDragOver={e=>valid&&e.preventDefault()}
                onDrop={e=>{e.preventDefault();if(editing)return;const p=e.dataTransfer.getData('plant');if(p&&valid)onCellPlace(x,y,p);}}
                style={{position:'relative',background:valid?(showSun?sunBg:'rgba(31,42,27,0.04)'):'transparent',border:valid?`1px solid rgba(31,42,27,0.08)`:'none',borderRadius:6,cursor:valid?'pointer':'default',display:'flex',alignItems:'center',justifyContent:'center'}}>
                {valid&&!pid&&<div style={{width:3,height:3,borderRadius:2,background:'rgba(31,42,27,0.18)'}}/>}
                {pid&&<div className="pop-in" style={{width:cellSize-8,height:cellSize-8}}><PlantTile plant={plantById(pid)} size={cellSize-8} showLabel={false} status={showConflict?status?.status:undefined} draggable={false} glow={showConflict&&status?.status!=='neutral'}/></div>}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
