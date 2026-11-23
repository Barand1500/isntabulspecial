import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
const Lanyard=lazy(()=>import('./Lanyard'));
function StaticCard(){return <div className="static-badge"><span className="static-badge-strap"/><img src="/images/spesial-card-front.svg" alt="İstanbul Spesial marka kartı: Her öğünde, aynı özen."/></div>;}
class BadgeBoundary extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<StaticCard/>:this.props.children;}
}
export function ContactBadge(){
 const root=useRef<HTMLDivElement>(null);
 const [near,setNear]=useState(false);
 const [reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
 useEffect(()=>{const query=matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setReduced(query.matches);query.addEventListener('change',update);const observer=new IntersectionObserver(([entry])=>{if(entry.isIntersecting){setNear(true);observer.disconnect();}},{rootMargin:'450px'});if(root.current)observer.observe(root.current);return()=>{query.removeEventListener('change',update);observer.disconnect();};},[]);
 return <div className="contact-badge" ref={root} data-reveal>
  <div className="badge-stage" data-cursor="Sürükle ↔"><div className="badge-stage-label"><span>İSTANBUL SPESİAL</span><span>BİR TANIŞMA KARTI.</span></div><div className="badge-stage-rings" aria-hidden="true"/>
   {near&&!reduced?<BadgeBoundary><Suspense fallback={<StaticCard/>}><div className="lanyard-slot"><div className="lanyard-static-fallback"><StaticCard/></div><Lanyard frontImage="/images/spesial-card-front.svg" backImage="/images/spesial-card-back.svg" strapImage="/images/spesial-card-strap.svg" cardColor="#f5f3ec" strapColor="#20201d" metal="gold" finish="matte" size={.57} strapLength={.28} strapWidth={.7} damping={.65} breeze={.14} elasticity={.35}/></div></Suspense></BadgeBoundary>:<StaticCard/>}
   <div className="badge-stage-caption"><span className="badge-hint">{reduced?'Her öğünde, aynı özen.':'Kartı sürükleyin. Dokunup çevirin.'}</span><span>✳</span></div>
  </div>
 </div>;
}
