import { useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { partnerBrands } from '../data/partners';
import { ArrowUpRight, ArrowLeft, ArrowRight, Plus, X, Sprout, ClipboardList, CookingPot, HandPlatter } from 'lucide-react';
const steps = [
  { title: 'İhtiyacı dinleriz.', short: 'Planlama', text: 'Her kurumun ritmi farklı. Önce sofranızın ihtiyaçlarını anlar, hizmeti buna göre planlarız.', Icon: ClipboardList },
  { title: 'İyi olanı seçeriz.', short: 'Tedarik', text: 'Güçlü tedarik ağımızla, iyi bir öğünün temelini oluşturan malzemeleri özenle seçeriz.', Icon: Sprout },
  { title: 'Özenle hazırlarız.', short: 'Üretim', text: 'Dengeli menüleri, hijyeni merkeze alan üretim anlayışımızla hazırlarız.', Icon: CookingPot },
  { title: 'Sofrada buluşuruz.', short: 'Sunum', text: 'Üretimden dağıtıma uzanan süreci bir bütün olarak ele alır, lezzeti sofranıza ulaştırırız.', Icon: HandPlatter },
];
const journeyScenes = [
  { image: 'service-food', line: 'Önce sizi dinleriz.', accent: 'Birlikte planlarız.', note: '01 / İHTİYACINIZA GÖRE DÜŞÜNÜLDÜ.' },
  { image: 'ingredients', line: 'Doğru malzeme.', accent: 'İyi bir başlangıç.', note: '02 / HER ŞEY İYİ BİR SEÇİMLE BAŞLAR.' },
  { image: 'hero-food', line: 'Görünmeyen emek.', accent: 'Hissedilen özen.', note: '03 / TİTİZLİKLE HAZIRLANDI.' },
  { image: 'service-food', line: 'Aynı sofrada.', accent: 'Aynı özenle.', note: '04 / SOFRADA BULUŞURUZ.' },
];
export function Journey() {
  const [scene,setScene]=useState(0);
  const root=useRef<HTMLElement>(null);
  useLayoutEffect(()=>{
    const triggers=Array.from(root.current!.querySelectorAll('.journey-step')).map((step,i)=>ScrollTrigger.create({
      trigger:step,start:'top 63%',end:'bottom 63%',onEnter:()=>setScene(i),onEnterBack:()=>setScene(i),
    }));
    return ()=>triggers.forEach(t=>t.kill());
  },[]);
  return <section className="journey section-pad" id="surec" ref={root}>
    <div className="section-label" data-reveal><span>04 / MALZEMEDEN SOFRAYA</span><span>HER ADIMIN BİR NEDENİ VAR.</span></div>
    <div className="journey-layout"><div className="journey-sticky">
      <div className="journey-title"><p className="eyebrow">BİR ÖĞÜNÜN YOLCULUĞU</p><h2>Görünenden<br/><span className="serif">çok daha fazlası.</span></h2></div>
      <div className="orbit-dish" aria-hidden="true"><div className="orbit-ring"/><div className="orbit-ring orbit-ring-inner"/>
        {journeyScenes.map((s,i)=><div className={`journey-scene ${scene===i?'active':''}`} key={i}><img src={`/images/${s.image}.webp`} alt="" loading="lazy"/><span className="orbit-center">{s.line}<em>{s.accent}</em></span></div>)}
        <span className="orbit-spark">✳</span><span className="orbit-index">0{scene+1}</span>
      </div><span className="journey-note" key={scene}>{journeyScenes[scene].note}</span>
    </div><div className="journey-steps">{steps.map(({title,short,text,Icon},i)=><article className={`journey-step ${scene===i?'scene-current':''}`} key={short} data-scene={i}><div className="step-track"><span className="step-dot"/><span className="step-fill"/></div><span className="step-number">0{i+1} / {short.toLocaleUpperCase('tr')}</span><Icon size={34} strokeWidth={1} className="step-icon"/><h3>{title}</h3><p>{text}</p></article>)}</div></div>
  </section>;
}
const audiences = [
  { title: 'Geleceğin sofraları.', label: 'ÖĞRENCİ YURTLARI', text: 'Gençlerin günlük beslenme ihtiyacına uygun, sağlıklı ve dengeli menüler.', image: 'hero-food', position: '45% center', detail: 'Yurt yaşamının günlük düzenine uyum sağlayan yemek üretimi ve dağıtımı. Her öğünde hijyene, dengeye ve lezzete odaklanıyoruz.' },
  { title: 'İş gününe iyi bir mola.', label: 'KAMU & ÖZEL KURUMLAR', text: 'İş yaşamının temposuna eşlik eden, düzenli ve güvenilir yemek hizmeti.', image: 'service-food', position: 'center', detail: 'Kurumların ihtiyaçlarına uygun toplu yemek ve ihale çözümleri. Tedarik, üretim ve dağıtımı profesyonel bir yaklaşımla yönetiyoruz.' },
  { title: 'Özenin en gerekli hâli.', label: 'SAĞLIK KURULUŞLARI', text: 'Sağlık çalışanları ve ziyaretçiler için günün içinde özenli bir durak.', image: 'hero-food', position: '15% center', detail: 'Hastane kampüslerindeki kantin işletmeciliğimizle çalışanların, hasta yakınlarının ve ziyaretçilerin günlük ihtiyaçlarını karşılıyoruz.' },
  { title: 'Bir araya gelmenin tadı.', label: 'ETKİNLİK & ORGANİZASYON', text: 'Toplantılardan özel buluşmalara, anınıza eşlik eden ikramlar.', image: 'service-food', position: '50% 75%', detail: 'Kurumsal etkinlik ve özel organizasyonlar için ikram ve catering çözümleri. Sunumu ve planlamayı buluşmanızın ihtiyaçlarına göre düşünüyoruz.' },
];
export function AudienceGallery() {
  const [open,setOpen]=useState<number|null>(null);
  const [current,setCurrent]=useState(0);
  const gallery=useRef<HTMLDivElement>(null);
  const go=(direction:number)=>{const next=(current+direction+audiences.length)%audiences.length;setCurrent(next);const el=gallery.current;const card=el?.children[next] as HTMLElement|undefined;if(el&&card)el.scrollTo({left:Math.min(card.offsetLeft,el.scrollWidth-el.clientWidth),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});};
  return <section className="audiences section-pad"><div className="section-label" data-reveal><span>05 / AYNI SOFRANIN ETRAFINDA</span><span>FARKLI HAYATLARA DOKUNUYORUZ.</span></div><div className="audience-heading"><h2 data-reveal>Her sofranın<br/><span className="serif">bir hikâyesi var.</span></h2><div className="gallery-controls"><button onClick={()=>go(-1)} aria-label="Önceki hizmet alanı"><ArrowLeft size={18}/></button><span>0{current+1} / 04</span><button onClick={()=>go(1)} aria-label="Sonraki hizmet alanı"><ArrowRight size={18}/></button></div></div><div className="audience-gallery" ref={gallery} onScroll={e=>{const el=e.currentTarget;const card=el.firstElementChild as HTMLElement; if(card){const spacing=(el.children[1] as HTMLElement).offsetLeft-card.offsetLeft;setCurrent(Math.max(0,Math.min(3,el.scrollLeft>=el.scrollWidth-el.clientWidth-2?3:Math.round(el.scrollLeft/spacing))));}}}>{audiences.map((a,i)=><article id={`audience-${i}`} key={a.label} className={`audience-card ${open===i?'expanded':''}`}><img src={`/images/${a.image}.webp`} alt="" loading="lazy" style={{objectPosition:a.position}}/><div className="audience-card-shade"/><span className="audience-label">{a.label}</span><div className="audience-card-content"><h3>{a.title}</h3><p>{a.text}</p><button onClick={()=>setOpen(open===i?null:i)} aria-expanded={open===i} aria-controls={`audience-detail-${i}`} aria-label={`${a.label} ${open===i?'detaylarını kapat':'detaylarını aç'}`}><span>{open===i?'Kapat':'Yakından bak'}</span>{open===i?<X size={18}/>:<Plus size={18}/>}</button><div className="audience-detail" id={`audience-detail-${i}`} inert={open!==i}><div><p>{a.detail}</p><a href="#iletisim">Birlikte düşünelim <ArrowUpRight size={16}/></a></div></div></div></article>)}</div><p className="gallery-note">HER İHTİYACA ÖZEL BİR YAKLAŞIM. HER ÖĞÜNDE AYNI SORUMLULUK.</p></section>;
}
export function ValueMarquee() {
  return <section className="partner-strip" aria-label="Örnek marka seçkisi"><div className="partner-strip-heading"><span>MARKA SEÇKİSİ</span><span>Temsili logolar · İş ortaklığı belirtmez.</span></div><div className="value-marquee partner-marquee"><div className="marquee-track">{[0,1].map(copy=><div className="marquee-group partner-group" key={copy} aria-hidden={copy===1?true:undefined}>{partnerBrands.map(brand=><div className={`partner-logo partner-${brand.name.toLowerCase().replaceAll(' ','')}`} key={brand.name}><img src={brand.logo} alt={copy===0?brand.name:''} loading="lazy"/></div>)}</div>)}</div><div className="marquee-edge left"/><div className="marquee-edge right"/></div></section>;
}
export function Manifesto() {
 const words='Çünkü iyi bir öğün, bütün bir günü değiştirebilir.'.split(' ');
 return <section className="manifesto section-pad"><span className="manifesto-star" aria-hidden="true">✳</span><p className="eyebrow" data-reveal>İNANDIĞIMIZ ŞEY ÇOK SADE.</p><h2 aria-label={words.join(' ')}>{words.map((w,i)=><span className="manifesto-word" aria-hidden="true" key={i}>{w} </span>)}</h2><p className="manifesto-note" data-reveal>Bu yüzden işimizi yalnızca yemek üretmek olarak görmüyoruz. <br/>Her güne biraz daha iyi başlamak için çalışıyoruz.</p><a href="#iletisim" className="text-link">Sizin sofranızda da buluşalım <ArrowUpRight size={18}/></a></section>;
}
