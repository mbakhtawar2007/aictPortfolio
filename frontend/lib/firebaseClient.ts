// Firebase client SDK, Auth ONLY, for EXISTING accounts.
// No sign-up / createUser call exists anywhere in this frontend.
// Config comes from NEXT_PUBLIC_FIREBASE_* env vars, never hardcoded.
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, type Auth } from 'firebase/auth';
let app: FirebaseApp | null = null;
export function firebaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY && process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID && process.env.NEXT_PUBLIC_FIREBASE_APP_ID);
}
export function getFirebaseAuth(): Auth | null {
  if (!firebaseConfigured()) return null;
  if (!app) {
    if (!getApps().length) {
      app = initializeApp({
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      });
    }
  }
  return getAuth(app ?? undefined);
}
export async function signInExisting(email: string, password: string): Promise<string> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase is not configured. Set the NEXT_PUBLIC_FIREBASE_* variables at build time.');
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user.getIdToken();
}
