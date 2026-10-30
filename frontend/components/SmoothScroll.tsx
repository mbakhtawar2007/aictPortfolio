'use client';
import { useEffect } from 'react';
import { initSmoothScroll } from '../lib/scroll3d';

/** Mounts Lenis smooth scrolling + the GSAP scroll-progress tween once. Renders nothing. */
export default function SmoothScroll() {
  useEffect(() => initSmoothScroll(), []);
  return null;
}
