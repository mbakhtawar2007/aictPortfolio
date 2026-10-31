import { authAdmin, firebaseEnabled, demoMode } from './firebase.js';
import { store } from './store.js';
import { fail } from './validate.js';
import { audit } from './audit.js';
// Demo test identities — accepted ONLY when DEMO_MODE=true and Firebase
// is NOT enabled. This block must never run in production: set
// DEMO_MODE=false (or unset) in Vercel, and FIREBASE_ENABLED=true.
const DEMO_USERS = {
  'demo-admin-token': { uid: 'demo-admin', email: 'demo-admin@example.local', role: 'admin', account_status: 'active', member_id: '' },
  'demo-member-token': { uid: 'demo-member', email: 'demo-member@example.local', role: 'member', account_status: 'active', member_id: 'sample-member-1' },
  // Unlinked member (2026-10-31): a member account with no team profile yet.
  // Demo-only, like the other two tokens above; never accepted in production.
  'demo-unlinked-token': { uid: 'demo-unlinked', email: 'demo-unlinked@example.local', role: 'member', account_status: 'active', member_id: '' },
};
export async function loadActor(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return null;
  if (!firebaseEnabled()) {
    if (demoMode() && DEMO_USERS[token]) return DEMO_USERS[token];
    return null;
  }
  try {
    const decoded = await authAdmin().verifyIdToken(token);
    const roleRow = await store.roleByUid(decoded.uid);
    if (!roleRow) return null;
    return { uid: decoded.uid, email: decoded.email || roleRow.email || '', role: roleRow.role, account_status: roleRow.account_status, member_id: roleRow.member_id || '' };
  } catch { return null; }
}
export function requireAuth(handler) {
  return async (req, res, next) => {
    try {
      const actor = await loadActor(req);
      if (!actor) return fail(res, 401, 'unauthenticated', 'Sign in is required.');
      // First-login activation: an invited account has a valid Firebase
      // token only after its password was set (by the admin, or via a
      // setup link), so that first valid token safely activates it.
      // This removes the extra admin activation step for new members.
      // Deactivated accounts are never auto-activated.
      if (actor.account_status === 'invited') {
        try { await store.saveRole(actor.uid, { account_status: 'active' }); await audit(store, { user_id: actor.uid, action: 'user.activated_first_login', entity: 'user_roles', entity_id: actor.uid }); } catch { /* retry on the next request */ }
        actor.account_status = 'active';
      }
      if (actor.account_status !== 'active') return fail(res, 403, 'account_not_active', 'This account is not active.');
      req.actor = actor; return handler(req, res, next);
    } catch { return fail(res, 503, 'auth_unavailable', 'Authentication is temporarily unavailable.'); }
  };
}
export function requireAdmin(handler) {
  return requireAuth(async (req, res, next) => {
    if (req.actor.role !== 'admin') return fail(res, 403, 'forbidden', 'Admin access is required.');
    return handler(req, res, next);
  });
}
export function requireMemberOrAdmin(handler) {
  return requireAuth(async (req, res, next) => {
    if (!['admin', 'member'].includes(req.actor.role)) return fail(res, 403, 'forbidden', 'Member or admin access is required.');
    return handler(req, res, next);
  });
}
// Member ownership: a member may touch only their linked member record
// (and child records whose member_id matches it). Admins may touch all.
export function canEditMember(actor, memberId) { return actor.role === 'admin' || (actor.role === 'member' && actor.member_id && actor.member_id === memberId); }
export function canEditProject(actor, project) { if (actor.role === 'admin') return true; if (actor.role !== 'member' || !actor.member_id) return false; return (project.member_ids || []).includes(actor.member_id); }
