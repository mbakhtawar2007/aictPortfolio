import admin from 'firebase-admin';
let app = null; let initError = null; let tried = false;
export function firebaseEnabled() { return process.env.FIREBASE_ENABLED === 'true'; }
export function demoMode() { return process.env.DEMO_MODE === 'true'; }
// Lazy init. Never logs the service-account JSON or any credential.
export function getAdmin() {
  if (!firebaseEnabled()) return null;
  if (tried) { if (initError) throw initError; return app; }
  tried = true;
  try {
    if (admin.apps.length) { app = admin.app(); return app; }
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (raw) {
      let cred;
      try { cred = JSON.parse(raw); } catch { throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT_JSON'); }
      app = admin.initializeApp({ credential: admin.credential.cert(cred), projectId: process.env.FIREBASE_PROJECT_ID || cred.project_id });
    } else {
      app = admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: process.env.FIREBASE_PROJECT_ID });
    }
    return app;
  } catch (e) { initError = new Error('Firebase is not configured correctly'); throw initError; }
}
export function fieldDelete() { return admin.firestore.FieldValue.delete(); }
export function db() { const a = getAdmin(); return a ? a.firestore() : null; }
export function authAdmin() { const a = getAdmin(); return a ? a.auth() : null; }
