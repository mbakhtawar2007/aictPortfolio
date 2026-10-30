import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

/**
 * Shared scroll progress (0 at the top of the page, 1 at the bottom).
 * The ambient 3D canvas reads this every frame and eases the camera toward
 * it, so the camera "travels" as the user scrolls. GSAP's scrub smooths it.
 */
export const scrollProgress = { value: 0 };

let lenis: Lenis | null = null;

/** Start Lenis smooth scrolling + the ScrollTrigger progress tween. No-op with reduced motion. */
export function initSmoothScroll(): () => void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return () => undefined;
  }
  lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  const tick = (time: number) => lenis?.raf(time * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);
  const tween = gsap.to(scrollProgress, {
    value: 1,
    ease: 'none',
    scrollTrigger: {
      trigger: document.body,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.5,
    },
  });
  const refresh = () => ScrollTrigger.refresh();
  window.addEventListener('load', refresh);
  return () => {
    window.removeEventListener('load', refresh);
    gsap.ticker.remove(tick);
    tween.scrollTrigger?.kill();
    tween.kill();
    lenis?.destroy();
    lenis = null;
  };
}

/** Smooth-scroll to an in-page anchor (via Lenis when active, native otherwise). */
export function scrollToSection(hash: string) {
  const el = document.querySelector(hash);
  if (!el) return;
  if (lenis) {
    lenis.scrollTo(el as HTMLElement, { offset: -72 });
  } else {
    (el as HTMLElement).scrollIntoView({ behavior: 'smooth' });
  }
}
