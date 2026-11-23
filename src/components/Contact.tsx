import { useState } from 'react';
import { ContactBadge } from './ContactBadge';
import { ArrowUpRight, ArrowRight, Phone, MapPin, Check } from 'lucide-react';
const options = [
 {name:'Toplu yemek',caption:'Günlük öğünlerinizi, kurumunuzun ritmine göre birlikte planlayalım.'},
 {name:'İhale çözümleri',caption:'Kurumunuzun gereksinimlerini ve hizmet kapsamını birlikte değerlendirelim.'},
 {name:'Kantin işletmeciliği',caption:'Hastane kampüsünüzün ihtiyaçlarına uygun hizmeti birlikte düşünelim.'},
 {name:'Catering & etkinlik',caption:'Bir sonraki buluşmanıza yakışan ikramları birlikte planlayalım.'},
];
export function Contact() {
 const [selected,setSelected]=useState(0);
 return <section className="contact-v2 section-pad" id="iletisim">
  <div className="section-label" data-reveal><span>06 / BİRLİKTE ÇALIŞALIM</span><span>İYİ BİR BAŞLANGIÇ YAPALIM.</span></div>
  <div className="contact-v2-layout">
    <div className="contact-v2-story" data-reveal><div><p className="eyebrow"><span className="status-dot"/> TANIŞMAK GÜZEL BİR BAŞLANGIÇ.</p><h2>Bir merhaba,<br/><span className="serif contact-shimmer">pek çok güzel sofra.</span></h2></div><p>İhtiyacınızı dinleyelim.<br/>Gerisini birlikte, özenle düşünelim.</p></div>
    <ContactBadge/>
    <div className="contact-planner" data-reveal>
      <div className="planner-top"><span>SOFRANIZI BİRLİKTE DÜŞÜNELİM.</span><span>01 — 04</span></div>
      <h3>Ne planlıyoruz?</h3><div className="planner-options" role="group" aria-label="İlgilendiğiniz hizmet">{options.map((o,i)=><button key={o.name} aria-pressed={selected===i} onClick={()=>setSelected(i)}><span>{o.name}</span>{selected===i?<Check size={15}/>:<PlusMark/>}</button>)}</div>
      <div className="planner-description" key={selected}><span>0{selected+1} / {options[selected].name.toLocaleUpperCase('tr')}</span><p>{options[selected].caption}</p></div>
      <a href="tel:+905065092946" className="planner-call" data-magnetic aria-label={`${options[selected].name} için bizi arayın`}><span><Phone size={15}/><span>Bir merhaba deyin<small>0 506 509 29 46</small></span></span><span className="planner-call-arrow"><ArrowUpRight size={24}/></span></a><p className="planner-note">Doğrudan konuşalım, size uygun çözümü bulalım.</p>
    </div>
  </div>
  <a className="office-card" href="https://www.google.com/maps/search/?api=1&query=Etiler+Evliya+Celebi+Remel+Plaza+23+Muratpasa+Antalya" target="_blank" rel="noreferrer" data-reveal>
    <span className="office-icon"><MapPin size={22} strokeWidth={1}/></span><span className="office-heading"><small>MERKEZ OFİSİMİZ</small><strong>Antalya<span className="gold-period">●</span></strong></span><span className="office-address">Etiler Mah. Evliya Çelebi Cad. Remel Plaza<br/>No: 23/603, Muratpaşa / Antalya</span><span className="office-link">Haritada görün <ArrowUpRight size={20}/></span><ArrowRight className="office-mobile-arrow" size={20}/>
  </a>
 </section>;
}
function PlusMark(){return <span className="planner-plus" aria-hidden="true">+</span>;}
