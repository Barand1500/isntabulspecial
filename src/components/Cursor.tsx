import { useEffect, useRef } from 'react';
import gsap from 'gsap';
export function Cursor() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const media = gsap.matchMedia();
    media.add('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)', () => {
      const el = ref.current!;
      let visible = false;
      const x = gsap.quickTo(el, 'x', { duration: .13, ease: 'power3' });
      const y = gsap.quickTo(el, 'y', { duration: .13, ease: 'power3' });
      const leave = () => {
        visible = false;
        el.style.opacity = '0';
        document.documentElement.classList.remove('custom-cursor-ready');
      };
      const move = (e: PointerEvent) => {
        if (e.pointerType !== 'mouse') { leave(); return; }
        if (!visible) { gsap.set(el, { x: e.clientX, y: e.clientY }); visible = true; }
        x(e.clientX); y(e.clientY);
        el.style.opacity = '1';
        document.documentElement.classList.add('custom-cursor-ready');
        el.classList.toggle('is-active', !!(e.target as HTMLElement).closest('a,button'));
        const view = (e.target as HTMLElement).closest<HTMLElement>('[data-cursor]');
        el.classList.toggle('is-view', !!view);
        const label = el.querySelector('span');
        if (label) label.textContent = view?.dataset.cursor || 'Keşfet ↗';
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('blur', leave);
      document.addEventListener('pointerleave', leave);
      return () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('blur', leave);
        document.removeEventListener('pointerleave', leave);
        leave(); gsap.killTweensOf(el);
      };
    });
    return () => media.revert();
  }, []);
  return <div className="cursor" ref={ref} aria-hidden="true"><span>Keşfet ↗</span></div>;
}
