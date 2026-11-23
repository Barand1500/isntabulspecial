export function BrandIntro() {
  const skip = () => window.dispatchEvent(new Event('spesial:skip-intro'));
  return <div className="brand-intro" role="dialog" aria-modal="true" aria-label="İstanbul Spesial açılışı">
    <div className="intro-topline"><span>İSTANBUL SPESİAL</span><span>HER ÖĞÜNDE AYNI ÖZEN.</span></div>
    <div className="intro-signature"><img className="intro-emblem" src="/images/brand-mark.png" alt=""/><div className="intro-name" aria-label="İstanbul Spesial">{['İSTANBUL', 'SPESİAL'].map((word,i)=><span className="intro-word" key={word} aria-hidden="true">{Array.from(word).map((letter,j)=><span className="intro-letter-slot" key={j}><span className="intro-letter" style={{'--letter-index':i*8+j} as React.CSSProperties}>{letter}</span></span>)}</span>)}</div><span className="intro-tagline">İYİ YEMEK. İYİ HİSSETTİRİR.</span><span className="intro-rule"/></div>
    <div className="intro-bottomline"><span>SOFRADA BULUŞURUZ.</span><button type="button" onClick={skip}>Açılışı geç ↗</button></div>
  </div>;
}
