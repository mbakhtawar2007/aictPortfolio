// Shared sign-out. The old buttons only removed the localStorage
// token, but Firebase Auth persistence survived and TokenRefresher
// re-minted the token on the next page, so "sign out" did not sign
// out. This signs out of Firebase first, then clears the stored
// token, then navigates to /login.
import { signOut } from 'firebase/auth';
import { getFirebaseAuth } from './firebaseClient';
export async function signOutSession(): Promise<void> {
  try {
    const auth = getFirebaseAuth();
    if (auth) await signOut(auth);
  } catch {
    /* clearing the local token below is still required */
  }
  if (typeof window !== 'undefined') window.localStorage.removeItem('aict_admin_token');
  if (typeof window !== 'undefined') window.location.href = '/login';
}
