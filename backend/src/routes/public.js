import express from 'express';
import { ok, fail, parseBody, contactSchema, oneLine } from '../validate.js';
import { store, isFirebase } from '../store.js';
import { contactAllowedForRequest, inviteValidateAllowed, inviteAcceptAllowed } from '../rateLimit.js';
import crypto from 'crypto';
import { inviteAcceptSchema } from '../validate.js';
import { authAdmin, firebaseEnabled, isDeployedEnv } from '../firebase.js';
import { audit } from '../audit.js';
import { demoMode } from '../firebase.js';
export const publicRouter = express.Router();
// Fail closed on a deployed backend without Firebase: the store would
// otherwise serve in-memory SAMPLE content on public routes, and invite
// accept would mint demo accounts. Local demo mode (not deployed) is
// unaffected.
function deployedWithoutFirebase(res) {
  if (isDeployedEnv() && !firebaseEnabled()) { fail(res, 503, 'unavailable', 'Service is temporarily unavailable.'); return true; }
  return false;
}
publicRouter.get('/health', (req, res) => ok(res, { status: 'ok', mode: isFirebase() ? 'firebase' : 'demo', demo: demoMode() }));
publicRouter.get('/site', async (req, res) => { if (deployedWithoutFirebase(res)) return; try { const s = await store.site(); return ok(res, s); } catch { return fail(res, 503, 'unavailable', 'Site settings are temporarily unavailable.'); } });
publicRouter.get('/members', async (req, res) => { if (deployedWithoutFirebase(res)) return; try { return ok(res, await store.membersPublished()); } catch { return fail(res, 503, 'unavailable', 'Members are temporarily unavailable.'); } });
publicRouter.get('/members/:slug', async (req, res) => { if (deployedWithoutFirebase(res)) return; try { const m = await store.memberBySlug(req.params.slug); if (!m) return fail(res, 404, 'not_found', 'Member not found.'); return ok(res, m); } catch { return fail(res, 503, 'unavailable', 'Member is temporarily unavailable.'); } });
publicRouter.get('/members/:slug/resume', async (req, res) => {
  if (deployedWithoutFirebase(res)) return;
  try {
    const m = await store.memberBySlug(req.params.slug);
    if (!m || !m.resume_path || !m.resume_is_public) return fail(res, 404, 'not_found', 'Resume not found.');
    const { resumePublicIdFromUrl, signedResumeUrl } = await import('../resumeUrl.js');
    const publicId = resumePublicIdFromUrl(m.resume_path);
    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
    // A resume URL that is not a portfolio Cloudinary asset is never
    // redirected to: that was a stored open redirect to any https URL
    // a member pasted. Only a portfolio asset may be signed; anything
    // else is a 404, even though the profile itself is published.
    if (!publicId || !publicId.startsWith('aict-portfolio/resumes/')) return fail(res, 404, 'not_found', 'Resume not found.');
    // No Cloudinary credentials (local/demo only): fall back to the
    // stored URL, exactly the old behaviour, rather than failing a
    // resume that might still deliver. On a deployed backend this is
    // a 503 instead, so a missing credential cannot become a redirect.
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
      if (isDeployedEnv()) return fail(res, 503, 'unavailable', 'Resume is temporarily unavailable.');
      return res.redirect(m.resume_path);
    }
    const cloudinary = (await import('cloudinary')).v2;
    cloudinary.config({ cloud_name: CLOUDINARY_CLOUD_NAME, api_key: CLOUDINARY_API_KEY, api_secret: CLOUDINARY_API_SECRET, secure: true });
    let asset;
    try { asset = await cloudinary.api.resource(publicId, { resource_type: 'raw' }); }
    catch { return fail(res, 404, 'not_found', 'Resume could not be found.'); }
    const signed = signedResumeUrl(cloudinary, publicId, asset.type, req.query.download === '1', m.full_name, asset.version);
    return res.redirect(signed);
  } catch { return fail(res, 503, 'unavailable', 'Resume is temporarily unavailable.'); }
});
publicRouter.get('/projects', async (req, res) => { if (deployedWithoutFirebase(res)) return; try { return ok(res, await store.projectsPublished()); } catch { return fail(res, 503, 'unavailable', 'Projects are temporarily unavailable.'); } });
publicRouter.get('/projects/:slug', async (req, res) => { if (deployedWithoutFirebase(res)) return; try { const p = await store.projectBySlug(req.params.slug); if (!p) return fail(res, 404, 'not_found', 'Project not found.'); return ok(res, p); } catch { return fail(res, 503, 'unavailable', 'Project is temporarily unavailable.'); } });
publicRouter.get('/achievements', async (req, res) => { if (deployedWithoutFirebase(res)) return; try { return ok(res, await store.achievementsPublished()); } catch { return fail(res, 503, 'unavailable', 'Achievements are temporarily unavailable.'); } });
function cleanGalleryTitle(name) {
  const base = String(name || '').replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return base ? base.slice(0, 80) : '';
}
publicRouter.get('/gallery', async (req, res) => {
  if (deployedWithoutFirebase(res)) return;
  // Public gallery: photos and videos only. Resumes are never listed here.
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) return fail(res, 503, 'gallery_unavailable', 'Gallery is temporarily unavailable.');
  try {
    const cloudinary = (await import('cloudinary')).v2;
    cloudinary.config({ cloud_name: CLOUDINARY_CLOUD_NAME, api_key: CLOUDINARY_API_KEY, api_secret: CLOUDINARY_API_SECRET, secure: true });
    const [imgs, vids] = await Promise.all([
      cloudinary.api.resources({ type: 'upload', resource_type: 'image', prefix: 'aict-portfolio/images', max_results: 50 }),
      cloudinary.api.resources({ type: 'upload', resource_type: 'video', prefix: 'aict-portfolio/videos', max_results: 50 }),
    ]);
    const itemsAll = [...(imgs.resources || []), ...(vids.resources || [])].map((r) => ({ public_id: r.public_id, secure_url: r.secure_url, format: r.format, resource_type: r.resource_type, bytes: r.bytes, created_at: r.created_at, original_filename: r.original_filename || '' }));
    // Gallery leak fix: previously every Cloudinary photo/video was
    // public, including drafts and uploads never attached to published
    // content. Keep only assets referenced by a published member
    // (photo/cover) or a published project (cover/video). The endpoint
    // itself is kept, per the project constraint, but its content is
    // now published-only.
    const publishedMembers = await store.membersPublished().catch(() => []);
    const publishedProjects = await store.projectsPublished().catch(() => []);
    const linkedUrls = new Set();
    for (const m of publishedMembers) { if (m.photo_url) linkedUrls.add(m.photo_url); if (m.cover_url) linkedUrls.add(m.cover_url); }
    for (const pr of publishedProjects) { if (pr.cover_url) linkedUrls.add(pr.cover_url); if (pr.video_url) linkedUrls.add(pr.video_url); }
    const items = itemsAll.filter((r) => linkedUrls.has(r.secure_url) || [...linkedUrls].some((u) => u.includes(r.public_id)));
    const meta = await store.mediaMetaAll().catch(() => []);
    const byId = new Map(meta.map((m) => [m.public_id, m]));
    const out = items.map((r) => {
      const m = byId.get(r.public_id);
      const titled = m && m.title ? m.title : cleanGalleryTitle(r.original_filename);
      return { ...r, title: titled || (r.resource_type === 'video' ? 'Untitled video' : 'Untitled photo'), description: (m && m.description) || '' };
    }).sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    return ok(res, out);
  } catch { return fail(res, 503, 'gallery_unavailable', 'Gallery is temporarily unavailable.'); }
});
publicRouter.post('/contact', async (req, res) => {
  if (deployedWithoutFirebase(res)) return;
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
        await new Resend(process.env.RESEND_API_KEY).emails.send({ from: 'AICT Portfolio <onboarding@resend.dev>', to: process.env.CONTACT_NOTIFY_EMAIL, subject: `Portfolio contact: ${oneLine(body.subject) || 'New message'}`, text: `From ${oneLine(body.name)} <${body.email}>\n\n${body.message}` });
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
  if (deployedWithoutFirebase(res)) return;
  if (!inviteValidateAllowed(req)) return fail(res, 429, 'rate_limited', 'Too many invitation checks. Please try again later.');
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  if (!token) return fail(res, 400, 'validation_error', 'An invitation link is required.');
  const inv = await store.inviteByHash(hashToken(token));
  if (!inviteUsable(inv)) return fail(res, 404, 'not_found', 'This invitation link is invalid, expired, or already used. Ask an admin for a new one.');
  // Never return the token hash or any account data — just what the form needs.
  return ok(res, { email: inv.email, name: inv.name || '', role: inv.role, expires_at: inv.expires_at });
});
publicRouter.post('/invite/accept', async (req, res) => {
  if (deployedWithoutFirebase(res)) return;
  if (!inviteAcceptAllowed(req)) return fail(res, 429, 'rate_limited', 'Too many invitation attempts. Please try again later.');
  const p = parseBody(inviteAcceptSchema, req.body); if (!p.ok) return fail(res, 400, 'validation_error', p.message);
  const inv = await store.inviteByHash(hashToken(p.data.token));
  if (!inviteUsable(inv)) return fail(res, 404, 'not_found', 'This invitation link is invalid, expired, or already used. Ask an admin for a new one.');
  // Atomic claim first: the transaction re-checks used/revoked/expired
  // and flips used=true in one step, so two concurrent accepts cannot
  // both succeed. If account creation then fails, the claim is
  // released so the same link can be retried.
  const claimed = await store.claimInvite(inv.id);
  if (!claimed.ok) return fail(res, 404, 'not_found', 'This invitation link is invalid, expired, or already used. Ask an admin for a new one.');
  const claimedInv = claimed.invite || inv;
  try {
    let uid;
    if (firebaseEnabled()) {
      const auth = authAdmin();
      try { const u = await auth.getUserByEmail(claimedInv.email); uid = u.uid; await auth.updateUser(uid, { password: p.data.password, displayName: claimedInv.name || undefined }); }
      catch { const u = await auth.createUser({ email: claimedInv.email, displayName: claimedInv.name || undefined, password: p.data.password, disabled: false }); uid = u.uid; }
    } else {
      uid = `demo-user-${claimedInv.email.replace(/[^a-z0-9]/gi, '-')}`;
    }
    await store.saveRole(uid, { email: claimedInv.email, name: claimedInv.name || '', role: claimedInv.role, account_status: 'active', member_id: claimedInv.member_id || '' });
    await audit(store, { user_id: uid, action: 'user.invite_accepted', entity: 'invites', entity_id: claimedInv.id });
    return ok(res, { created: true, email: claimedInv.email });
  } catch { try { await store.releaseInvite(claimedInv.id); } catch { /* claim release best effort */ } return fail(res, 503, 'unavailable', 'Your account could not be created. Try again, or ask an admin for a new invitation.'); }
});
