'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

// Three.js loads only on the client, never during the static prerender.
const CosmicBackground = dynamic(() => import('./CosmicBackground'), { ssr: false, loading: () => null });

// Signed-in workspaces stay clean and fast: the cosmic scene runs on
// public pages only, never on admin/member/login/invite routes. It
// renders in both themes — deep-space nebula in dark mode, a soft pastel
// nebula in light mode (the canvas itself re-tints on theme change).
const HIDDEN_PREFIXES = ['/admin', '/member', '/dashboard', '/login', '/invite'];

export default function CosmicBackgroundLoader() {
  // Performance (2026-11-02): the nebula is purely decorative, so its
  // Three.js chunk must not compete with first paint and hydration.
  // Wait for window load (2.5s fallback so a stalled load event never
  // blocks it forever), then mount. Hooks stay before the early return.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (typeof document !== 'undefined' && document.readyState === 'complete') { setReady(true); return; }
    const t = window.setTimeout(() => setReady(true), 2500);
    const onLoad = () => setReady(true);
    window.addEventListener('load', onLoad);
    return () => { window.clearTimeout(t); window.removeEventListener('load', onLoad); };
  }, []);
  const pathname = usePathname() || '/';
  if (!ready) return null;
  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))) return null;
  return <CosmicBackground />;
}
