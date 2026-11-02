import { useEffect, useRef } from 'react';

// Auto-refresh for public pages (2026-11-02): public pages used to fetch
// once on mount and never again, so after an admin change the visitor had
// to refresh manually. This hook re-runs the page's load when the visitor
// returns to the tab (focus / tab visible again) and when another tab
// broadcasts a content change (an admin/member save). Refetches are
// throttled to one per 10s: focus and visibilitychange usually fire
// together on a tab switch, and rapid switching must not hammer the API.
// Callers pass a silent load: it must not flash the skeleton and must not
// replace good data with an error on a transient failure.
export const CONTENT_UPDATED_KEY = 'aict_content_updated';
export function broadcastContentUpdate() {
  try { window.localStorage.setItem(CONTENT_UPDATED_KEY, String(Date.now())); } catch { /* storage unavailable: focus/visibility still refreshes */ }
}
export function useAutoRefresh(refresh: () => void) {
  const refreshRef = useRef(refresh);
  useEffect(() => { refreshRef.current = refresh; });
  const lastRef = useRef(0);
  useEffect(() => {
    const run = () => {
      const now = Date.now();
      if (now - lastRef.current < 10000) return;
      lastRef.current = now;
      refreshRef.current();
    };
    const onVisible = () => { if (document.visibilityState === 'visible') run(); };
    const onStorage = (e: StorageEvent) => { if (e.key === CONTENT_UPDATED_KEY) run(); };
    window.addEventListener('focus', run);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('focus', run);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
}
