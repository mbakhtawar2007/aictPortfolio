import express from 'express';
import { ok, fail, parseBody, contactSchema } from '../validate.js';
import { store, isFirebase } from '../store.js';
import { contactAllowedForRequest } from '../rateLimit.js';
import crypto from 'crypto';
import { inviteAcceptSchema } from '../validate.js';
import { authAdmin, firebaseEnabled } from '../firebase.js';
import { audit } from '../audit.js';
import { demoMode } from '../firebase.js';
export const publicRouter = express.Router();
publicRouter.get('/health', (req, res) => ok(res, { status: 'ok', mode: isFirebase() ? 'firebase' : 'demo', demo: demoMode() }));
publicRouter.get('/site', async (req, res) => { try { const s = await store.site(); return ok(res, s); } catch { return fail(res, 503, 'unavailable', 'Site settings are temporarily unavailable.'); } });
publicRouter.get('/members', async (req, res) => { try { return ok(res, await store.membersPublished()); } catch { return fail(res, 503, 'unavailable', 'Members are temporarily unavailable.'); } });
publicRouter.get('/members/:slug', async (req, res) => { try { const m = await store.memberBySlug(req.params.slug); if (!m) return fail(res, 404, 'not_found', 'Member not found.'); return ok(res, m); } catch { return fail(res, 503, 'unavailable', 'Member is temporarily unavailable.'); } });
publicRouter.get('/projects', async (req, res) => { try { return ok(res, await store.projectsPublished()); } catch { return fail(res, 503, 'unavailable', 'Projects are temporarily unavailable.'); } });
publicRouter.get('/projects/:slug', async (req, res) => { try { const p = await store.projectBySlug(req.params.slug); if (!p) return fail(res, 404, 'not_found', 'Project not found.'); return ok(res, p); } catch { return fail(res, 503, 'unavailable', 'Project is temporarily unavailable.'); } });
publicRouter.get('/achievements', async (req, res) => { try { return ok(res, await store.achievementsPublished()); } catch { return fail(res, 503, 'unavailable', 'Achievements are temporarily unavailable.'); } });
publicRouter.post('/contact', async (req, res) => {
  const parsed = parseBody(contactSchema, req.body);
  if (!parsed.ok) return fail(res, 400, 'validation_error', parsed.message);
  const body = parsed.data;
  // Honeypot: bots fill it. Silently "accept" without storing or emailing.
  if (body.website) return ok(res, { received: true });
  if (!(await contactAllowedForRequest(req))) return fail(res, 429, 'rate_limited', 'Too many messages. Please try again later.');
  try {
    const msg = await store.addMessage({ name: body.name, email: body.email, subject: body.subject, message: body.message, created_at: new Date().toISOString(), read: false });
    // Resend is optional. A mail failure must not expose the key or fail the stored message.
    try {
      if (process.env.RESEND_API_KEY && process.env.CONTACT_NOTIFY_EMAIL) {
        const { Resend } = await import('resend');
        await new Resend(process.env.RESEND_API_KEY).emails.send({ from: 'AICT Portfolio <onboarding@resend.dev>', to: process.env.CONTACT_NOTIFY_EMAIL, subject: `Portfolio contact: ${body.subject || 'New message'}`, text: `From ${body.name} <${body.email}>\n\n${body.message}` });
      }
    } catch { /* notification failed; message is still stored */ }
    return ok(res, { received: true, id: msg.id });
  } catch { return fail(res, 503, 'unavailable', 'Your message could not be saved right now.'); }
});
// Explicitly no other auth creation routes. /auth/register is 404 in app.js.

// ---- Invite link (public, but token-gated: without a valid admin-issued
// token this reveals nothing and creates nothing — it is NOT a signup) ----
function hashToken(token) { return crypto.createHash('sha256').update(token).digest('hex'); }
function inviteUsable(inv) {
  if (!inv || inv.used || inv.revoked) return false;
  if (inv.expires_at && new Date(inv.expires_at).getTime() < Date.now()) return false;
  return true;
}
publicRouter.get('/invite/validate', async (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  if (!token) return fail(res, 400, 'validation_error', 'An invitation link is required.');
  const inv = await store.inviteByHash(hashToken(token));
  if (!inviteUsable(inv)) return fail(res, 404, 'not_found', 'This invitation link is invalid, expired, or already used. Ask an admin for a new one.');
  // Never return the token hash or any account data — just what the form needs.
  return ok(res, { email: inv.email, name: inv.name || '', role: inv.role, expires_at: inv.expires_at });
});
publicRouter.post('/invite/accept', async (req, res) => {
  const p = parseBody(inviteAcceptSchema, req.body); if (!p.ok) return fail(res, 400, 'validation_error', p.message);
  const inv = await store.inviteByHash(hashToken(p.data.token));
  if (!inviteUsable(inv)) return fail(res, 404, 'not_found', 'This invitation link is invalid, expired, or already used. Ask an admin for a new one.');
  try {
    let uid;
    if (firebaseEnabled()) {
      const auth = authAdmin();
      try { const u = await auth.getUserByEmail(inv.email); uid = u.uid; await auth.updateUser(uid, { password: p.data.password, displayName: inv.name || undefined }); }
      catch { const u = await auth.createUser({ email: inv.email, displayName: inv.name || undefined, password: p.data.password, disabled: false }); uid = u.uid; }
    } else {
      uid = `demo-user-${inv.email.replace(/[^a-z0-9]/gi, '-')}`;
    }
    await store.saveRole(uid, { email: inv.email, name: inv.name || '', role: inv.role, account_status: 'active', member_id: inv.member_id || '' });
    await store.markInviteUsed(inv.id);
    await audit(store, { user_id: uid, action: 'user.invite_accepted', entity: 'invites', entity_id: inv.id });
    return ok(res, { created: true, email: inv.email });
  } catch { return fail(res, 503, 'unavailable', 'Your account could not be created. Try again, or ask an admin for a new invitation.'); }
});
