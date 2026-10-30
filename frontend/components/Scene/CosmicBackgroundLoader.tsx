'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

// Three.js loads only on the client, never during the static prerender.
const CosmicBackground = dynamic(() => import('./CosmicBackground'), { ssr: false, loading: () => null });

// Signed-in workspaces stay clean and fast: the cosmic scene runs on
// public pages only, never on admin/member/login/invite routes.
const HIDDEN_PREFIXES = ['/admin', '/member', '/dashboard', '/login', '/invite'];

export default function CosmicBackgroundLoader() {
  const pathname = usePathname() || '/';
  // The light theme keeps a plain background: the canvas unmounts as soon
  // as the theme is known to be light. CSS hides it even before that
  // (see [data-theme='light'] .cosmic-canvas in globals.css), so a light
  // user never sees a flash of nebula.
  const [dark, setDark] = useState(true);
  useEffect(() => {
    const read = () => setDark(document.documentElement.getAttribute('data-theme') !== 'light');
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))) return null;
  if (!dark) return null;
  return <CosmicBackground />;
}
