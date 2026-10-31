'use client';
import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { getFirebaseAuth } from '../lib/firebaseClient';
// Silent token refresh (2026-10-31, user request): Firebase ID tokens last
// about an hour, and the backend rejects an expired token, so a long
// dashboard session used to die with 401s until the user signed in again.
// Firebase Auth keeps a persisted session, so getIdToken(true) mints a
// fresh token silently — no password, no redirect. Refresh once when a
// signed-in session is detected, then every 50 minutes (inside the 1-hour
// lifetime). A failed refresh keeps the old token and retries next tick.
// No-ops entirely when Firebase is not configured (demo mode).
export default function TokenRefresher() {
  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const unsub = onAuthStateChanged(auth, (user) => {
      if (timer) clearInterval(timer);
      // Signed out (including via signOutSession): clear the stored
      // token instead of leaving a stale one that could be reused.
      if (!user) { window.localStorage.removeItem('aict_admin_token'); return; }
      const refresh = async () => {
        try {
          const token = await user.getIdToken(true);
          window.localStorage.setItem('aict_admin_token', token);
        } catch { /* keep the old token; the next tick retries */ }
      };
      refresh();
      timer = setInterval(refresh, 50 * 60 * 1000);
    });
    return () => { unsub(); if (timer) clearInterval(timer); };
  }, []);
  return null;
}
