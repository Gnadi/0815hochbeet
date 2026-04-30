import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { T } from '../theme';
export function AuthModal({ onClose }) {
  const { login, register } = useAuth();
  const [tab, setTab] = useState('login');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault(); setErr(''); setLoading(true);
    try {
      if (tab==='login') await login(email,pw);
      else await register(email,pw,name);
      onClose();
    } catch(ex) {
      setErr(ex.code==='auth/wrong-password'?'Falsches Passwort':ex.code==='auth/user-not-found'?'Kein Konto gefunden':ex.code==='auth/email-already-in-use'?'E-Mail bereits registriert':ex.message);
    } finally { setLoading(false); }
  }

  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(31,42,27,0.5)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(8px)'}}>
      <div onClick={e=>e.stopPropagation()} style={{width:400,background:T.paper,borderRadius:24,padding:36,boxShadow:'0 24px 80px rgba(0,0,0,0.25)',position:'relative'}}>
        <button onClick={onClose} style={{position:'absolute',top:16,right:16,width:28,height:28,border:'none',background:'transparent',fontSize:18,cursor:'pointer',color:T.inkMute}}>×</button>
        <div style={{display:'flex',gap:4,marginBottom:24,padding:4,background:T.bg,borderRadius:12,border:`1px solid ${T.border}`}}>
          {['login','register'].map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:'8px 4px',border:'none',borderRadius:8,background:tab===t?'#fff':'transparent',boxShadow:tab===t?'0 1px 3px rgba(0,0,0,0.06)':'none',color:tab===t?T.ink:T.inkMute,cursor:'pointer',fontWeight:600,fontSize:13}}>
              {t==='login'?'Anmelden':'Registrieren'}
            </button>
          ))}
        </div>
        <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:14}}>
          {tab==='register'&&<input placeholder="Name" value={name} onChange={e=>setName(e.target.value)} required style={{padding:12,background:'#fff',border:`1px solid ${T.border}`,borderRadius:10,fontSize:14,color:T.ink}}/>}
          <input type="email" placeholder="E-Mail" value={email} onChange={e=>setEmail(e.target.value)} required style={{padding:12,background:'#fff',border:`1px solid ${T.border}`,borderRadius:10,fontSize:14,color:T.ink}}/>
          <input type="password" placeholder="Passwort" value={pw} onChange={e=>setPw(e.target.value)} required style={{padding:12,background:'#fff',border:`1px solid ${T.border}`,borderRadius:10,fontSize:14,color:T.ink}}/>
          {err&&<div style={{fontSize:12,color:T.bad,padding:'8px 12px',background:'rgba(201,84,58,0.08)',borderRadius:8}}>{err}</div>}
          <button type="submit" disabled={loading} style={{padding:14,background:T.green,color:'#fff',border:'none',borderRadius:12,fontSize:14,fontWeight:600,cursor:'pointer',opacity:loading?0.6:1}}>
            {loading?'…':tab==='login'?'Anmelden →':'Konto erstellen ✦'}
          </button>
        </form>
      </div>
    </div>
  );
}
