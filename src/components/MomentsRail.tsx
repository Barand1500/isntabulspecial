import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import gsap from 'gsap';
const moments = [
 {image:'ingredients',label:'HER ŞEY MALZEMEYLE BAŞLAR.',title:'Mevsiminden ilham.',position:'center'},
 {image:'service-food',label:'DOĞRU MALZEME, DOĞRU DENGE.',title:'Renkli. Dengeli. Özenli.',position:'center 30%'},
 {image:'hero-food',label:'SOFRAYA UZANAN EMEK.',title:'Her tabağın bir hikâyesi.',position:'70% center'},
 {image:'ingredients',label:'KÜÇÜK DETAYLAR, BÜYÜK FARKLAR.',title:'Doğasında iyilik var.',position:'10% center'},
];
export function MomentsRail() {
 const track=useRef<HTMLDivElement>(null);
 const root=useRef<HTMLElement>(null);
 const paused=useRef(false);
 const [isPaused,setPaused]=useState(false);
 const animation=useRef<gsap.core.Tween|null>(null);
 useEffect(()=>{
  const media=gsap.matchMedia();
  media.add('(prefers-reduced-motion: no-preference)',()=>{
   const tween=gsap.to(track.current,{xPercent:-50,duration:42,ease:'none',repeat:-1});animation.current=tween;
   if(paused.current)tween.pause();
   return ()=>{gsap.killTweensOf(tween);tween.kill();animation.current=null;};
  });
  const observer=new IntersectionObserver(([entry])=>{if(entry.isIntersecting&&!paused.current)animation.current?.resume();else animation.current?.pause();});
  if(root.current)observer.observe(root.current);
  return ()=>{observer.disconnect();media.revert();};
 },[]);
 const speed=(slow:boolean)=>{const tween=animation.current;if(tween)gsap.to(tween,{timeScale:slow?.22:1,duration:.65,overwrite:true});};
 const toggle=()=>{paused.current=!paused.current;setPaused(paused.current);if(paused.current)animation.current?.pause();else animation.current?.resume();};
 return <section className="moments section-pad" ref={root} aria-label="Lezzetin detayları"><div className="moments-heading"><div><p className="eyebrow" data-reveal>LEZZET, DETAYLARDA SAKLI.</p><h2 data-reveal>Biraz yakından <span className="serif">bakın.</span></h2></div><button className="rail-pause" onClick={toggle} aria-label={isPaused?'Görsel akışını oynat':'Görsel akışını duraklat'} aria-pressed={isPaused}>{isPaused?<Play size={15}/>:<Pause size={15}/>}</button></div><div className="moments-window" onMouseEnter={()=>speed(true)} onMouseLeave={()=>speed(false)} onFocusCapture={()=>speed(true)} onBlurCapture={()=>speed(false)}><div className="moments-track" ref={track}>{[0,1].map(copy=><div className="moments-group" key={copy} aria-hidden={copy===1?true:undefined}>{moments.map((m,i)=><figure className={`moment-card moment-${i}`} key={m.title}><div><img src={`/images/${m.image}.webp`} alt="" loading="lazy" style={{objectPosition:m.position}}/><span>0{i+1}</span></div><figcaption><span>{m.label}</span><h3>{m.title}</h3></figcaption></figure>)}</div>)}</div><div className="moments-fade left"/><div className="moments-fade right"/></div><div className="moments-footnote"><span>ÖZENİ YAKINDAN HİSSEDİN.</span><span>✳</span><span>İYİ MALZEME. İYİ BİR BAŞLANGIÇ.</span></div></section>;
}
