import { useLayoutEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
gsap.registerPlugin(ScrollTrigger);
export function useMotion(onIntroComplete: () => void) {
  useLayoutEffect(() => {
    const media = gsap.matchMedia();
    let lenis: Lenis | undefined;
    let tick: ((time: number) => void) | undefined;
    media.add('(prefers-reduced-motion: no-preference)', () => {
      lenis = new Lenis({ duration: 1.15, anchors: false });
      lenis.on('scroll', ScrollTrigger.update);
      tick = (time) => lenis?.raf(time * 1000);
      gsap.ticker.add(tick);
      const intro = document.querySelector('.brand-intro');
      const revealHero = gsap.from('.hero-enter', { y: 36, opacity: 0, duration: 1.15, stagger: .13, ease: 'power3.out', delay: intro ? 1.95 : .12 });
      const finishIntro = () => {
        document.documentElement.classList.remove('intro-active');
        lenis?.start();
        onIntroComplete();
        ScrollTrigger.refresh();
      };
      const opening = gsap.timeline({ onComplete: finishIntro, paused: true });
      if (intro) {
        document.documentElement.classList.add('intro-active');
        lenis.stop();
        opening.fromTo('.intro-emblem', { opacity: 0, scale: .8 }, { opacity: 1, scale: 1, duration: .65, ease: 'power2.out' }, 0)
          .fromTo('.intro-letter', { rotateX: -90, yPercent: 65, opacity: 0, filter: 'blur(6px)' }, { rotateX: 0, yPercent: 0, opacity: 1, filter: 'blur(0px)', duration: .75, stagger: .035, ease: 'power3.out' }, .2)
          .fromTo('.intro-tagline', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .6 }, .65)
          .fromTo('.intro-rule', { scaleX: 0 }, { scaleX: 1, duration: 1.1, ease: 'power2.inOut' }, .3)
          .to('.intro-signature', { y: -25, opacity: 0, duration: .5, ease: 'power2.in' }, 1.6)
          .to(intro, { yPercent: -100, duration: .8, ease: 'power3.inOut' }, 1.75)
          .play();
      } else { finishIntro(); }
      const skip = () => { opening.progress(1); revealHero.progress(1); finishIntro(); };
      const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && document.querySelector('.brand-intro')) skip(); };
      window.addEventListener('spesial:skip-intro', skip);
      window.addEventListener('keydown', escape);
      const safety = window.setTimeout(() => { if (document.querySelector('.brand-intro')) skip(); }, 4000);
      const countEls = gsap.utils.toArray<HTMLElement>('[data-count]');
      countEls.forEach(el => {
        const value = { number: 0 };
        gsap.to(value, { number: Number(el.dataset.count), duration: 1.25, ease: 'power2.out', onUpdate: () => { el.textContent = Math.round(value.number).toString().padStart(2, '0'); }, scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
      });
      gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) => {
        gsap.from(el, { y: 40, opacity: 0, duration: .9, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 91%', once: true } });
      });
      gsap.to('.hero-photo', { yPercent: 13, scale: 1.08, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1 } });
      gsap.fromTo('.philosophy-photo img', { yPercent: -8, scale: 1.15 }, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: '.philosophy', start: 'top bottom', end: 'bottom top', scrub: 1 } });
      gsap.utils.toArray<HTMLElement>('.journey-step').forEach((step) => {
        gsap.fromTo(step.querySelector('.step-fill'), { scaleY: 0 }, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: step, start: 'top 65%', end: 'bottom 45%', scrub: .4 } });
        ScrollTrigger.create({ trigger: step, start: 'top 70%', end: 'bottom 30%', toggleClass: 'is-current' });
      });
      gsap.to('.orbit-ring:not(.orbit-ring-inner)', { rotation: 340, ease: 'none', scrollTrigger: { trigger: '.journey', start: 'top bottom', end: 'bottom top', scrub: 1 } });
      gsap.to('.orbit-ring-inner', { rotation: -290, ease: 'none', scrollTrigger: { trigger: '.journey', start: 'top bottom', end: 'bottom top', scrub: 1 } });
      gsap.to('.orbit-spark', { rotation: 300, ease: 'none', scrollTrigger: { trigger: '.journey', start: 'top bottom', end: 'bottom top', scrub: .8 } });
      gsap.fromTo('.manifesto-word', { opacity: .14 }, { opacity: 1, stagger: .18, ease: 'none', scrollTrigger: { trigger: '.manifesto', start: 'top 65%', end: 'center 40%', scrub: .6 } });
      gsap.utils.toArray<HTMLElement>('.audience-card').forEach((card, i) => {
        gsap.from(card, { y: 45, opacity: 0, duration: .8, delay: Math.min(i * .1, .3), ease: 'power3.out', scrollTrigger: { trigger: card, start: 'top 94%', once: true } });
      });
      gsap.to('.scroll-progress', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: .2 } });
      return () => {
        clearTimeout(safety);
        window.removeEventListener('spesial:skip-intro', skip);
        window.removeEventListener('keydown', escape);
        document.documentElement.classList.remove('intro-active');
        countEls.forEach(el => { el.textContent = (el.dataset.count ?? '0').padStart(2, '0'); });
        if (tick) gsap.ticker.remove(tick);
        lenis?.destroy();
      };
    });
    media.add('(prefers-reduced-motion: reduce)', () => {
      document.documentElement.classList.remove('intro-active');
      onIntroComplete();
    });
    media.add('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)', () => {
      const cleanups = gsap.utils.toArray<HTMLElement>('[data-magnetic]').map(el => {
        const x = gsap.quickTo(el, 'x', { duration: .55, ease: 'power3.out' });
        const y = gsap.quickTo(el, 'y', { duration: .55, ease: 'power3.out' });
        const inner = el.querySelector('svg');
        const ix = inner ? gsap.quickTo(inner, 'x', { duration: .4, ease: 'power3.out' }) : undefined;
        const iy = inner ? gsap.quickTo(inner, 'y', { duration: .4, ease: 'power3.out' }) : undefined;
        const move = (event: PointerEvent) => {
          if (event.pointerType !== 'mouse') return;
          const rect = el.getBoundingClientRect();
          const dx = event.clientX - rect.left - rect.width / 2;
          const dy = event.clientY - rect.top - rect.height / 2;
          x(Math.max(-14, Math.min(14, dx * .17))); y(Math.max(-12, Math.min(12, dy * .17)));
          ix?.(dx * .09); iy?.(dy * .09);
        };
        const reset = () => { x(0); y(0); ix?.(0); iy?.(0); };
        el.addEventListener('pointermove', move); el.addEventListener('pointerleave', reset); el.addEventListener('blur', reset);
        return () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', reset); el.removeEventListener('blur', reset); };
      });
      return () => cleanups.forEach(cleanup => cleanup());
    });
    const navigate = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
      if (!link) return;
      const hash = link.getAttribute('href')!;
      const target = hash === '#' ? document.body : document.getElementById(decodeURIComponent(hash.slice(1)));
      if (!target) return;
      event.preventDefault();
      requestAnimationFrame(() => {
        const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (lenis && !reduced) lenis.scrollTo(target, { duration: 1.35, offset: -24, easing: t => 1 - Math.pow(1 - t, 4) });
        else target.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'start' });
        history.replaceState(null, '', hash === '#' ? location.pathname + location.search : hash);
      });
    };
    const menuState = (event: Event) => { if ((event as CustomEvent<boolean>).detail) lenis?.stop(); else lenis?.start(); };
    window.addEventListener('spesial:menu-state', menuState);
    document.addEventListener('click', navigate);
    return () => { document.removeEventListener('click', navigate); window.removeEventListener('spesial:menu-state', menuState); media.revert(); };
  }, [onIntroComplete]);
}
