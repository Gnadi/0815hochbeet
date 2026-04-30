import { T } from '../theme';
import { useNavigate } from 'react-router-dom';
const tabs = [
  { id:'home',   label:'Heute',   icon:'◐', path:'/dashboard' },
  { id:'beds',   label:'Beete',   icon:'▦', path:'/beds' },
  { id:'plants', label:'Pflanzen',icon:'◉', path:'/plants' },
  { id:'more',   label:'Mehr',    icon:'≡', path:'/more' },
];
export function TabBar({ active }) {
  const navigate = useNavigate();
  return (
    <div style={{position:'fixed',bottom:20,left:12,right:12,background:'rgba(255,252,242,0.88)',backdropFilter:'blur(20px)',WebkitBackdropFilter:'blur(20px)',borderRadius:26,padding:'8px 6px',border:`1px solid ${T.border}`,boxShadow:'0 8px 24px -8px rgba(31,42,27,0.18)',display:'flex',justifyContent:'space-around',zIndex:30}}>
      {tabs.map(t=>(
        <button key={t.id} onClick={()=>navigate(t.path)} style={{flex:1,padding:'8px 4px',border:'none',background:'transparent',display:'flex',flexDirection:'column',alignItems:'center',gap:2,cursor:'pointer',fontFamily:'inherit',color:active===t.id?T.green:T.inkMute}}>
          <div style={{fontSize:18,lineHeight:1}}>{t.icon}</div>
          <div style={{fontSize:10,fontWeight:600}}>{t.label}</div>
        </button>
      ))}
    </div>
  );
}
