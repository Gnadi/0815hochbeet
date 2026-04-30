import { T } from '../theme';
export function PlantTile({ plant, size=56, showLabel=true, status, draggable=true, glow, onClick, popIn }) {
  const ring = status==='bad'?T.bad:status==='good'?T.good:'transparent';
  return (
    <div onClick={onClick} style={{
      width:size, height:size, borderRadius:Math.max(8,size*0.18),
      background:`radial-gradient(circle at 30% 25%, oklch(0.78 0.11 ${plant.hue}), oklch(0.55 0.13 ${plant.hue}))`,
      border:`2px solid ${ring==='transparent'?'rgba(255,255,255,0.4)':ring}`,
      boxShadow:glow
        ?`0 0 0 3px ${ring},0 4px 12px -4px oklch(0.5 0.1 ${plant.hue}/0.6)`
        :`0 4px 12px -6px oklch(0.5 0.1 ${plant.hue}/0.5),inset 0 -3px 6px rgba(0,0,0,0.12),inset 0 2px 3px rgba(255,255,255,0.3)`,
      display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',
      cursor:draggable?'grab':'default',
      userSelect:'none',
      animation:popIn?'pop-in 0.28s cubic-bezier(0.34,1.56,0.64,1)':status==='bad'?'beet-pulse 1.6s ease-out infinite':undefined,
    }}>
      <div style={{fontFamily:"'Fraunces',serif",fontStyle:'italic',fontSize:size*0.42,color:'#fff',lineHeight:1,textShadow:'0 1px 2px rgba(0,0,0,0.2)'}}>{plant.glyph}</div>
      {showLabel&&<div style={{fontSize:Math.max(7,size*0.14),color:'rgba(255,255,255,0.92)',marginTop:2,fontWeight:600,letterSpacing:'0.05em'}}>{plant.de.toUpperCase()}</div>}
    </div>
  );
}
