import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowUpRight, ArrowLeft, Eye, EyeOff, Mail, LockKeyhole, ShieldCheck, QrCode, RefreshCw, LoaderCircle, Monitor, ArrowRight } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import gsap from 'gsap';
import { api } from '../../admin/api';
interface Challenge{id:string;url:string;expires:number}
interface GoogleCredential{credential:string}
declare global{interface Window{google?:{accounts:{id:{initialize:(options:{client_id:string;nonce:string;callback:(result:GoogleCredential)=>void})=>void;renderButton:(target:HTMLElement,options:Record<string,unknown>)=>void}}}}}
function GoogleIcon(){return <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>;}
export default function AuthSwitch({onAuthenticated,approval=false}:{onAuthenticated:()=>void;approval?:boolean}){
 const [mode,setMode]=useState<'password'|'qr'>('password');
 const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [show,setShow]=useState(false);
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');
 const [challenge,setChallenge]=useState<Challenge|null>(null);const [remaining,setRemaining]=useState(0);const [qrBusy,setQrBusy]=useState(false);
 const [googleClient,setGoogleClient]=useState<string|null>(null);const [googleOpen,setGoogleOpen]=useState(false);
 const googleTarget=useRef<HTMLDivElement>(null);const root=useRef<HTMLDivElement>(null);const generation=useRef(0);
 useEffect(()=>{document.title='Yönetici girişi · İstanbul Spesial';const ctx=gsap.context(()=>{if(!matchMedia('(prefers-reduced-motion: reduce)').matches)gsap.from('.as-enter',{y:24,opacity:0,duration:.8,stagger:.09,ease:'power3.out'});},root);const controller=new AbortController();api<{googleClientId:string|null}>('/api/auth/config',undefined,controller.signal).then(c=>setGoogleClient(c.googleClientId)).catch(()=>{});return()=>{ctx.revert();controller.abort();};},[]);
 async function submit(event:FormEvent){event.preventDefault();if(busy)return;setBusy(true);setError('');setNotice('');try{await api('/api/auth/login',{email,password});setPassword('');onAuthenticated();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function newQr(){const current=++generation.current;setChallenge(null);setQrBusy(true);setError('');try{const next=await api<Challenge>('/api/auth/qr',{});if(current===generation.current){setChallenge(next);setRemaining(Math.max(0,Math.ceil((next.expires-Date.now())/1000)));}}catch(e){if(current===generation.current)setError((e as Error).message);}finally{if(current===generation.current)setQrBusy(false);}}
 function changeMode(next:'password'|'qr'){setError('');setNotice('');setGoogleOpen(false);setMode(next);if(next==='qr')void newQr();else{generation.current++;setChallenge(null);}}
 useEffect(()=>{
  if(mode!=='qr'||!challenge)return;const controller=new AbortController();let stopped=false;let timer:ReturnType<typeof setTimeout>;
  const countdown=setInterval(()=>setRemaining(Math.max(0,Math.ceil((challenge.expires-Date.now())/1000))),1000);
  async function poll(){if(stopped)return;if(Date.now()>=challenge!.expires){setRemaining(0);return;}try{const result=await api<{status:string}>(`/api/auth/qr/${challenge!.id}`,undefined,controller.signal);if(stopped)return;if(result.status==='approved'){onAuthenticated();return;}}catch(e){if(controller.signal.aborted)return;setError((e as Error).message);return;}timer=setTimeout(poll,2000);}
  timer=setTimeout(poll,2000);return()=>{stopped=true;controller.abort();clearTimeout(timer);clearInterval(countdown);};
 },[mode,challenge,onAuthenticated]);
 async function startGoogle(){setError('');setNotice('');if(!googleClient){setNotice('Google girişi henüz etkinleştirilmedi. E-posta ve şifrenizle devam edebilirsiniz.');return;}setBusy(true);try{
  const {nonce}=await api<{nonce:string}>('/api/auth/google/nonce',{});setGoogleOpen(true);
  if(!window.google)await new Promise<void>((resolve,reject)=>{const existing=document.getElementById('google-identity');if(existing)existing.remove();const script=document.createElement('script');script.id='google-identity';script.src='https://accounts.google.com/gsi/client';script.async=true;script.onload=()=>resolve();script.onerror=()=>{script.remove();reject(new Error('Google bağlantısı kurulamadı.'));};document.head.appendChild(script);});
  window.google?.accounts.id.initialize({client_id:googleClient,nonce,callback:async(result)=>{setBusy(true);try{await api('/api/auth/google',{credential:result.credential});onAuthenticated();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}});
  requestAnimationFrame(()=>{if(googleTarget.current)window.google?.accounts.id.renderButton(googleTarget.current,{theme:'outline',size:'large',width:300,text:'signin_with',locale:'tr'});});
 }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <div className="auth-switch" ref={root}>
  <a className="as-back as-enter" href="/"><ArrowLeft size={15}/> Web sitesine dön</a>
  <div className={`as-container as-enter ${mode==='qr'?'qr-mode':''}`}>
    <a href="/" className="as-brand"><img src="/images/brand-mark.png" alt=""/><span>İSTANBUL SPESİAL<small>YÖNETİM MERKEZİ</small></span></a>
    <section className="as-form-area">
      <div className="as-form-inner"><h2>{mode==='qr'?'Karekod ile giriş':'Giriş yap'}</h2>
      {approval&&<p className="as-caption">Devam etmek için yönetici hesabınızla giriş yapın.</p>}
      {mode==='password'?<form onSubmit={submit} className="as-form">
        <label className="as-input"><Mail size={17}/><input aria-label="E-posta adresi" name="email" type="email" placeholder="E-posta adresi" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" required maxLength={200} disabled={busy}/></label>
        <label className="as-input"><LockKeyhole size={17}/><input aria-label="Şifre" name="password" type={show?'text':'password'} placeholder="Şifre" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required maxLength={256} disabled={busy}/><button type="button" onClick={()=>setShow(!show)} aria-label={show?'Şifreyi gizle':'Şifreyi göster'}>{show?<EyeOff size={16}/>:<Eye size={16}/>}</button></label>
        <button type="submit" className="as-submit" disabled={busy}>{busy?<LoaderCircle size={17} className="admin-spin"/>:'GİRİŞ YAP'}</button>
      </form>:<div className="as-qr"><div className="auth-qr-frame">{qrBusy?<LoaderCircle size={26} className="admin-spin"/>:challenge&&remaining>0?<><QRCodeSVG value={challenge.url} size={170} marginSize={2} level="M" title="Kayıtlı cihazınızla okutun"/><span className="auth-qr-scan" aria-hidden="true"/></>:<button onClick={()=>void newQr()}><RefreshCw size={23}/><span>Kodu yenile</span></button>}</div><p className="qr-status">{qrBusy?'Hazırlanıyor':remaining>0?`Onay bekleniyor · ${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`:'Kodun süresi doldu'}</p>{challenge&&remaining>0&&<button className="qr-renew" onClick={()=>void newQr()}><RefreshCw size={12}/> Kodu yenile</button>}</div>}
      {error&&<p className="as-feedback error" role="alert">{error}</p>}{notice&&<p className="as-feedback" role="status">{notice}</p>}
      <p className="as-social-label">{mode==='qr'?'Diğer giriş seçenekleri':'veya diğer yöntemlerle giriş yapın'}</p>
      <div className="as-socials"><button type="button" onClick={()=>void startGoogle()} disabled={busy} aria-label="Google ile giriş"><GoogleIcon/></button><button type="button" onClick={()=>changeMode(mode==='qr'?'password':'qr')} disabled={busy||qrBusy} aria-label={mode==='qr'?'E-posta ile giriş':'Karekod ile giriş'}>{mode==='qr'?<Mail size={19}/>:<QrCode size={20}/>}</button></div>
      {googleOpen&&<div className="google-login-target" ref={googleTarget}/>}
      </div>
    </section>
    <div className="as-panels"><div className="as-panel as-left"><div className="as-content"><h3>Yeniden merhaba.</h3><p>İstanbul Spesial yönetim merkezine<br/>hoş geldiniz. Her detay, sizin kontrolünüzde.</p><button type="button" className="as-transparent" onClick={()=>changeMode('qr')} disabled={qrBusy}>KAREKOD İLE GİRİŞ</button></div></div><div className="as-panel as-right"><div className="as-content"><h3>Telefonunuz yanınızda mı?</h3><p>Kayıtlı cihazınızla karekodu okutun.<br/>Giriş isteğini kontrol edip onaylayın.</p><button type="button" className="as-transparent" onClick={()=>changeMode('password')}>ŞİFRE İLE GİRİŞ</button></div></div></div>
  </div><p className="as-page-note">© {new Date().getFullYear()} İstanbul Spesial · Yalnızca yetkili kullanıcılar için.</p>
 </div>;
}
