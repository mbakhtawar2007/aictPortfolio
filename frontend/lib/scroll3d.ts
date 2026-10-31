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
let stopSmooth: (() => void) | null = null;

/** Reduced motion means the OS setting OR the site's own Reduce-effects toggle. */
export function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    document.documentElement.getAttribute('data-reduce') === 'true';
}

/** Start Lenis smooth scrolling + the ScrollTrigger progress tween. No-op with reduced motion. */
export function initSmoothScroll(): () => void {
  if (reducedMotion()) {
    return () => undefined;
  }
  if (stopSmooth) return stopSmooth;
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
  const stop = () => {
    window.removeEventListener('load', refresh);
    gsap.ticker.remove(tick);
    tween.scrollTrigger?.kill();
    tween.kill();
    lenis?.destroy();
    lenis = null;
    stopSmooth = null;
  };
  stopSmooth = stop;
  return stop;
}

/** Re-apply the reduced-motion preference live: stop Lenis when reduced, start it when not. */
export function applySmoothScrollPreference(): void {
  if (reducedMotion()) {
    stopSmooth?.();
    stopSmooth = null;
  } else {
    initSmoothScroll();
  }
}

/** Smooth-scroll to an in-page anchor (via Lenis when active, native otherwise). */
export function scrollToSection(hash: string) {
  const el = document.querySelector(hash);
  if (!el) return;
  if (reducedMotion()) {
    (el as HTMLElement).scrollIntoView({ behavior: 'auto' });
    return;
  }
  if (lenis) {
    lenis.scrollTo(el as HTMLElement, { offset: -72 });
  } else {
    (el as HTMLElement).scrollIntoView({ behavior: 'smooth' });
  }
}
