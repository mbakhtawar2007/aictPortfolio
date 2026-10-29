// ONE-TIME first-admin bootstrap. Run locally ONLY, then delete/disable it.
// Usage: BOOTSTRAP_TOKEN=... FIREBASE_ENABLED=true node scripts/bootstrap-admin.js
// Refuses unless: BOOTSTRAP_TOKEN matches, Firebase is enabled, and no admin
// already exists. Never create this as a public HTTP endpoint.
import { firebaseEnabled, authAdmin } from '../src/firebase.js';
import { store } from '../src/store.js';
const token = process.env.BOOTSTRAP_TOKEN;
const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
const name = process.env.BOOTSTRAP_ADMIN_NAME || 'First Admin';
if (!token || !email) { console.error('Set BOOTSTRAP_TOKEN and BOOTSTRAP_ADMIN_EMAIL.'); process.exit(1); }
if (!firebaseEnabled()) { console.error('Refused: FIREBASE_ENABLED is not true. Bootstrap is for a real Firebase project only.'); process.exit(1); }
try {
  const roles = await store.rolesAll();
  if (roles.some((r) => r.role === 'admin' && r.account_status !== 'deactivated')) { console.error('Refused: an admin already exists.'); process.exit(1); }
  let user; try { user = await authAdmin().getUserByEmail(email); } catch { user = await authAdmin().createUser({ email, displayName: name }); }
  await store.saveRole(user.uid, { email, name, role: 'admin', account_status: 'invited', invited_by: 'bootstrap', invited_at: new Date().toISOString(), member_id: '' });
  console.log('Bootstrap complete for', email, '— complete first-login via the Firebase password-reset link, then remove this script’s access (unset BOOTSTRAP_TOKEN). The link itself is not printed here.');
} catch { console.error('Bootstrap failed. Check Firebase configuration (no details printed).'); process.exit(1); }
