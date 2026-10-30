'use client';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';

// Three.js loads only on the client, never during the static prerender.
const CosmicBackground = dynamic(() => import('./CosmicBackground'), { ssr: false, loading: () => null });

// Signed-in workspaces stay clean and fast: the cosmic scene runs on
// public pages only, never on admin/member/login/invite routes. It
// renders in both themes — deep-space nebula in dark mode, a soft pastel
// nebula in light mode (the canvas itself re-tints on theme change).
const HIDDEN_PREFIXES = ['/admin', '/member', '/dashboard', '/login', '/invite'];

export default function CosmicBackgroundLoader() {
  const pathname = usePathname() || '/';
  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))) return null;
  return <CosmicBackground />;
}
