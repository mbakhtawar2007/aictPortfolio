'use client';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';

// Three.js loads only on the client, never during the static prerender.
const AmbientCanvas = dynamic(() => import('./AmbientCanvas'), { ssr: false, loading: () => null });

// Signed-in workspaces stay clean and fast: the ambient scene runs on
// public pages only, never on admin/member/login/invite routes.
const HIDDEN_PREFIXES = ['/admin', '/member', '/dashboard', '/login', '/invite'];

export default function AmbientCanvasLoader() {
  const pathname = usePathname() || '/';
  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))) return null;
  return <AmbientCanvas />;
}
