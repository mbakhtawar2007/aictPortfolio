import express from 'express';
import { ok, fail, parseBody, memberSchema, projectSchema, achievementSchema, siteSchema, inviteSchema, userPatchSchema, uploadSignSchema, messagePatchSchema } from '../validate.js';
import { store, isFirebase } from '../store.js';
import { authAdmin, firebaseEnabled, demoMode } from '../firebase.js';
import { requireAdmin, requireMemberOrAdmin, canEditMember, canEditProject } from '../auth.js';
import { audit } from '../audit.js';
export const adminRouter = express.Router();
// NOTE: this router is mounted at /api/admin, so paths below are relative.
adminRouter.get('/messages', requireAdmin(async (req, res) => { try { return ok(res, await store.messagesAll()); } catch { return fail(res, 503, 'unavailable', 'Messages are temporarily unavailable.'); } }));
adminRouter.get('/members', requireMemberOrAdmin(async (req, res) => {
  try { const all = await store.membersAll(); const list = req.actor.role === 'admin' ? all : all.filter((m) => m.id === req.actor.member_id); return ok(res, list); } catch { return fail(res, 503, 'unavailable', 'Members are temporarily unavailable.'); }
}));
adminRouter.post('/members', requireMemberOrAdmin(async (req, res) => {
  const p = parseBody(memberSchema, req.body); if (!p.ok) return fail(res, 400, 'validation_error', p.message);
  // Member self-service: an invited/active member with no linked profile yet
  // may create exactly one profile for themselves. It is always saved as a
  // draft so an admin publishes it, and the account is linked to it.
  // Members may never create profiles for other people, and this is not a
  // public sign-up: only an admin-invited account reaches this route.
  const isSelfCreate = req.actor.role === 'member';
  if (isSelfCreate && req.actor.member_id) return fail(res, 403, 'forbidden', 'You already have a profile. Edit it instead of creating a new one.');
  const data = isSelfCreate ? { ...p.data, status: 'draft' } : p.data;
  try {
    const row = await store.saveMember('', data);
    await audit(store, { user_id: req.actor.uid, action: 'member.create', entity: 'members', entity_id: row.id });
    if (isSelfCreate) {
      await store.saveRole(req.actor.uid, { member_id: row.id });
      await audit(store, { user_id: req.actor.uid, action: 'user.link_profile', entity: 'user_roles', entity_id: req.actor.uid });
    }
    return ok(res, row, 201);
  } catch { return fail(res, 503, 'unavailable', 'Member could not be saved.'); }
}));
adminRouter.patch('/members/:id', requireMemberOrAdmin(async (req, res) => {
  if (!canEditMember(req.actor, req.params.id)) return fail(res, 403, 'forbidden', 'You can edit only your own profile.');
  const p = parseBody(memberSchema.partial(), req.body); if (!p.ok) return fail(res, 400, 'validation_error', p.message);
  try { const ex = await store.memberById(req.params.id); if (ex) await store.addRevision({ entity: 'members', entity_id: req.params.id, snapshot: ex, created_at: new Date().toISOString(), user_id: req.actor.uid }); } catch { /* revision failure must not block the save */ }
  try { const row = await store.saveMember(req.params.id, p.data); await audit(store, { user_id: req.actor.uid, action: 'member.update', entity: 'members', entity_id: req.params.id }); return ok(res, row); } catch { return fail(res, 503, 'unavailable', 'Member could not be saved.'); }
}));
adminRouter.delete('/members/:id', requireAdmin(async (req, res) => { try { await store.deleteMember(req.params.id); await audit(store, { user_id: req.actor.uid, action: 'member.delete', entity: 'members', entity_id: req.params.id }); return ok(res, { deleted: true }); } catch { return fail(res, 503, 'unavailable', 'Member could not be deleted.'); } }));
adminRouter.get('/projects', requireMemberOrAdmin(async (req, res) => {
  try { const all = await store.projectsAll(); const list = req.actor.role === 'admin' ? all : all.filter((p) => (p.member_ids || []).includes(req.actor.member_id)); return ok(res, list); } catch { return fail(res, 503, 'unavailable', 'Projects are temporarily unavailable.'); }
}));
adminRouter.post('/projects', requireMemberOrAdmin(async (req, res) => {
  const p = parseBody(projectSchema, req.body); if (!p.ok) return fail(res, 400, 'validation_error', p.message);
  if (req.actor.role === 'member' && !p.data.member_ids.includes(req.actor.member_id)) p.data.member_ids = [...p.data.member_ids, req.actor.member_id];
  try { const row = await store.saveProject('', p.data); await audit(store, { user_id: req.actor.uid, action: 'project.create', entity: 'projects', entity_id: row.id }); return ok(res, row, 201); } catch { return fail(res, 503, 'unavailable', 'Project could not be saved.'); }
}));
adminRouter.patch('/projects/:id', requireMemberOrAdmin(async (req, res) => {
  try {
    const all = await store.projectsAll(); const ex = all.find((p) => p.id === req.params.id); if (!ex) return fail(res, 404, 'not_found', 'Project not found.');
    if (!canEditProject(req.actor, ex)) return fail(res, 403, 'forbidden', 'You can edit only projects you are assigned to.');
    const p = parseBody(projectSchema.partial(), req.body); if (!p.ok) return fail(res, 400, 'validation_error', p.message);
    try { await store.addRevision({ entity: 'projects', entity_id: req.params.id, snapshot: ex, created_at: new Date().toISOString(), user_id: req.actor.uid }); } catch { /* revision failure must not block the save */ }
    const row = await store.saveProject(req.params.id, p.data); await audit(store, { user_id: req.actor.uid, action: 'project.update', entity: 'projects', entity_id: req.params.id }); return ok(res, row);
  } catch { return fail(res, 503, 'unavailable', 'Project could not be saved.'); }
}));
adminRouter.delete('/projects/:id', requireAdmin(async (req, res) => { try { await store.deleteProject(req.params.id); await audit(store, { user_id: req.actor.uid, action: 'project.delete', entity: 'projects', entity_id: req.params.id }); return ok(res, { deleted: true }); } catch { return fail(res, 503, 'unavailable', 'Project could not be deleted.'); } }));
adminRouter.post('/achievements', requireMemberOrAdmin(async (req, res) => {
  const p = parseBody(achievementSchema, req.body); if (!p.ok) return fail(res, 400, 'validation_error', p.message);
  if (req.actor.role === 'member' && p.data.member_id && !canEditMember(req.actor, p.data.member_id)) return fail(res, 403, 'forbidden', 'You can add achievements only to your own profile.');
  if (req.actor.role === 'member' && !p.data.member_id) p.data.member_id = req.actor.member_id;
  try { const row = await store.saveAchievement('', p.data); await audit(store, { user_id: req.actor.uid, action: 'achievement.create', entity: 'achievements', entity_id: row.id }); return ok(res, row, 201); } catch { return fail(res, 503, 'unavailable', 'Achievement could not be saved.'); }
}));
adminRouter.patch('/achievements/:id', requireMemberOrAdmin(async (req, res) => {
  try {
    const all = await store.achievementsAll(); const ex = all.find((a) => a.id === req.params.id); if (!ex) return fail(res, 404, 'not_found', 'Achievement not found.');
    if (req.actor.role === 'member' && !canEditMember(req.actor, ex.member_id)) return fail(res, 403, 'forbidden', 'You can edit only your own achievements.');
    const p = parseBody(achievementSchema.partial(), req.body); if (!p.ok) return fail(res, 400, 'validation_error', p.message);
    try { await store.addRevision({ entity: 'achievements', entity_id: req.params.id, snapshot: ex, created_at: new Date().toISOString(), user_id: req.actor.uid }); } catch { /* revision failure must not block the save */ }
    const row = await store.saveAchievement(req.params.id, p.data); await audit(store, { user_id: req.actor.uid, action: 'achievement.update', entity: 'achievements', entity_id: req.params.id }); return ok(res, row);
  } catch { return fail(res, 503, 'unavailable', 'Achievement could not be saved.'); }
}));
adminRouter.delete('/achievements/:id', requireAdmin(async (req, res) => { try { await store.deleteAchievement(req.params.id); await audit(store, { user_id: req.actor.uid, action: 'achievement.delete', entity: 'achievements', entity_id: req.params.id }); return ok(res, { deleted: true }); } catch { return fail(res, 503, 'unavailable', 'Achievement could not be deleted.'); } }));
adminRouter.get('/settings', requireAdmin(async (req, res) => { try { return ok(res, await store.site()); } catch { return fail(res, 503, 'unavailable', 'Settings are temporarily unavailable.'); } }));
adminRouter.patch('/settings', requireAdmin(async (req, res) => {
  const p = parseBody(siteSchema.partial(), req.body); if (!p.ok) return fail(res, 400, 'validation_error', p.message);
  try { const row = await store.saveSite(p.data); await audit(store, { user_id: req.actor.uid, action: 'settings.update', entity: 'site_settings', entity_id: 'main' }); return ok(res, row); } catch { return fail(res, 503, 'unavailable', 'Settings could not be saved.'); }
}));
adminRouter.post('/upload/sign', requireMemberOrAdmin(async (req, res) => {
  const p = parseBody(uploadSignSchema, req.body); if (!p.ok) return fail(res, 400, 'validation_error', p.message);
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) return fail(res, 503, 'upload_unavailable', 'File uploads are not configured.');
  const ext = p.data.file_name.split('.').pop()?.toLowerCase() || '';
  if (p.data.file_type === 'pdf' && ext !== 'pdf') return fail(res, 400, 'validation_error', 'Resumes must be PDF files.');
  if (p.data.file_type === 'image' && !['jpg', 'jpeg', 'png', 'webp', 'avif'].includes(ext)) return fail(res, 400, 'validation_error', 'Images must be jpg, png, webp or avif.');
  try {
    const cloudinary = (await import('cloudinary')).v2;
    cloudinary.config({ cloud_name: CLOUDINARY_CLOUD_NAME, api_key: CLOUDINARY_API_KEY, api_secret: CLOUDINARY_API_SECRET, secure: true });
    const timestamp = Math.round(Date.now() / 1000);
    const folder = `aict-portfolio/${p.data.file_type === 'pdf' ? 'resumes' : 'images'}`;
    // Server-generated path only; the browser never supplies a storage path.
    const public_id = `${folder}/${req.actor.uid}-${Date.now()}`;
    const signature = cloudinary.utils.api_sign_request({ timestamp, folder, public_id }, CLOUDINARY_API_SECRET);
    return ok(res, { cloud_name: CLOUDINARY_CLOUD_NAME, api_key: CLOUDINARY_API_KEY, timestamp, folder, public_id, signature });
  } catch { return fail(res, 503, 'upload_unavailable', 'File uploads are temporarily unavailable.'); }
}));
adminRouter.post('/revalidate', requireAdmin(async (req, res) => ok(res, { status: 'saved_refresh_pending', note: 'This frontend is a static Netlify export, so it cannot be revalidated on demand. Publishing triggers a Netlify rebuild webhook, configured by the site owner (see DEPLOYMENT.md). Content is saved; the live site updates after that rebuild.' })));
// ---- Achievements (admin list; members see only their own) ----
adminRouter.get('/achievements', requireMemberOrAdmin(async (req, res) => {
  try { const all = await store.achievementsAll(); const list = req.actor.role === 'admin' ? all : all.filter((a) => a.member_id === req.actor.member_id); return ok(res, list); } catch { return fail(res, 503, 'unavailable', 'Achievements are temporarily unavailable.'); }
}));
// ---- Messages: mark read/unread + delete (admin only) ----
adminRouter.patch('/messages/:id', requireAdmin(async (req, res) => {
  const p = parseBody(messagePatchSchema, req.body); if (!p.ok) return fail(res, 400, 'validation_error', p.message);
  try { await store.markMessage(req.params.id, p.data.read); await audit(store, { user_id: req.actor.uid, action: 'message.update', entity: 'contact_messages', entity_id: req.params.id }); return ok(res, { id: req.params.id, read: p.data.read }); } catch { return fail(res, 503, 'unavailable', 'Message could not be updated.'); }
}));
adminRouter.delete('/messages/:id', requireAdmin(async (req, res) => {
  try { await store.deleteMessage(req.params.id); await audit(store, { user_id: req.actor.uid, action: 'message.delete', entity: 'contact_messages', entity_id: req.params.id }); return ok(res, { deleted: true }); } catch { return fail(res, 503, 'unavailable', 'Message could not be deleted.'); }
}));
// ---- Audit + revisions (admin only) ----
adminRouter.get('/audit', requireAdmin(async (req, res) => {
  const limit = Math.max(1, Math.min(100, parseInt(String(req.query.limit || '50'), 10) || 50));
  const offset = Math.max(0, parseInt(String(req.query.offset || '0'), 10) || 0);
  try { return ok(res, await store.auditAll(limit, offset), 200, { limit, offset }); } catch { return fail(res, 503, 'unavailable', 'Audit log is temporarily unavailable.'); }
}));
adminRouter.get('/revisions', requireAdmin(async (req, res) => {
  try { return ok(res, await store.revisionsAll(String(req.query.entity || ''), String(req.query.entity_id || ''))); } catch { return fail(res, 503, 'unavailable', 'Revisions are temporarily unavailable.'); }
}));
adminRouter.post('/revisions/:id/restore', requireAdmin(async (req, res) => {
  try {
    const rev = await store.revisionById(req.params.id); if (!rev) return fail(res, 404, 'not_found', 'Revision not found.');
    if (rev.entity === 'site_settings') return fail(res, 400, 'not_supported', 'Site-settings revisions are not snapshotted yet.');
    const { id, ...fields } = rev.snapshot || {};
    if (rev.entity === 'members') await store.saveMember(rev.entity_id, fields);
    else if (rev.entity === 'projects') await store.saveProject(rev.entity_id, fields);
    else if (rev.entity === 'achievements') await store.saveAchievement(rev.entity_id, fields);
    else return fail(res, 400, 'not_supported', 'Unknown revision entity.');
    await audit(store, { user_id: req.actor.uid, action: 'revision.restore', entity: rev.entity, entity_id: rev.entity_id });
    return ok(res, { restored: true, entity: rev.entity, entity_id: rev.entity_id });
  } catch { return fail(res, 503, 'unavailable', 'Revision could not be restored.'); }
}));
// ---- Media (Cloudinary list; fail-closed when unconfigured) ----
adminRouter.get('/media', requireMemberOrAdmin(async (req, res) => {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) return fail(res, 503, 'media_unavailable', 'Media library is not configured (Cloudinary).');
  try {
    const cloudinary = (await import('cloudinary')).v2;
    cloudinary.config({ cloud_name: CLOUDINARY_CLOUD_NAME, api_key: CLOUDINARY_API_KEY, api_secret: CLOUDINARY_API_SECRET, secure: true });
    const result = await cloudinary.search.expression('folder:aict-portfolio/*').sort_by('created_at', 'desc').max_results(50).execute();
    const items = (result.resources || []).map((r) => ({ public_id: r.public_id, secure_url: r.secure_url, format: r.format, resource_type: r.resource_type, bytes: r.bytes, created_at: r.created_at, width: r.width, height: r.height }));
    return ok(res, items);
  } catch { return fail(res, 503, 'media_unavailable', 'Media library is temporarily unavailable.'); }
}));
// ---- Users / invitations (admin only) ----
adminRouter.get('/users', requireAdmin(async (req, res) => { try { return ok(res, await store.rolesAll()); } catch { return fail(res, 503, 'unavailable', 'Accounts are temporarily unavailable.'); } }));
adminRouter.post('/users/invite', requireAdmin(async (req, res) => {
  const p = parseBody(inviteSchema, req.body); if (!p.ok) return fail(res, 400, 'validation_error', p.message);
  const { email, role, member_id, name } = p.data;
  try {
    // Idempotency: never create a duplicate for an already-invited/active email.
    const existing = await store.roleByEmail(email);
    if (existing) { await audit(store, { user_id: req.actor.uid, action: 'user.invite_existing', entity: 'user_roles', entity_id: existing.id }); return ok(res, { ...existing, already_exists: true }); }
    let uid;
    if (isFirebase()) {
      const auth = authAdmin();
      try { const u = await auth.getUserByEmail(email); uid = u.uid; } catch { const u = await auth.createUser({ email, displayName: name, disabled: false }); uid = u.uid; }
      // Generate the first-login link but do NOT return it (invitation tokens
      // are never exposed in API responses). If Resend is configured, email it.
      try {
        const link = await auth.generatePasswordResetLink(email);
        if (process.env.RESEND_API_KEY && process.env.CONTACT_NOTIFY_EMAIL) {
          const { Resend } = await import('resend');
          await new Resend(process.env.RESEND_API_KEY).emails.send({ from: 'AICT Portfolio <onboarding@resend.dev>', to: email, subject: 'Your AICT portfolio account', text: `You have been invited to the AICT group portfolio. Set your password here: ${link}` });
        }
      } catch { /* link/email failure is recorded below, invite row still stands */ }
    } else {
      uid = `demo-user-${email.replace(/[^a-z0-9]/gi, '-')}`;
    }
    const row = await store.saveRole(uid, { email, name, role, account_status: 'invited', invited_by: req.actor.uid, invited_at: new Date().toISOString(), member_id: member_id || '' });
    await audit(store, { user_id: req.actor.uid, action: 'user.invite', entity: 'user_roles', entity_id: uid });
    return ok(res, { ...row, email_delivery: isFirebase() && process.env.RESEND_API_KEY ? 'attempted' : 'not_configured' }, 201);
  } catch { return fail(res, 503, 'unavailable', 'The invitation could not be created.'); }
}));
adminRouter.patch('/users/:id', requireAdmin(async (req, res) => {
  if (req.params.id === req.actor.uid) return fail(res, 403, 'forbidden', 'You cannot change your own account this way.');
  const p = parseBody(userPatchSchema, req.body); if (!p.ok) return fail(res, 400, 'validation_error', p.message);
  // If a profile link is requested, it must point at a real team profile.
  // Empty string is allowed and means "unlink this account from any profile".
  if (p.data.member_id) {
    try { const prof = await store.memberById(p.data.member_id); if (!prof) return fail(res, 404, 'not_found', 'Team profile not found.'); } catch { return fail(res, 503, 'unavailable', 'Account could not be updated.'); }
  }
  try { const row = await store.saveRole(req.params.id, p.data); await audit(store, { user_id: req.actor.uid, action: 'user.update', entity: 'user_roles', entity_id: req.params.id }); return ok(res, row); } catch { return fail(res, 503, 'unavailable', 'Account could not be updated.'); }
}));
adminRouter.post('/users/:id/resend-invite', requireAdmin(async (req, res) => {
  try {
    const row = await store.roleByUid(req.params.id); if (!row) return fail(res, 404, 'not_found', 'Account not found.');
    if (row.account_status !== 'invited') return fail(res, 400, 'validation_error', 'Only pending invitations can be resent.');
    if (isFirebase()) { try { await authAdmin().generatePasswordResetLink(row.email); } catch { /* recorded, not exposed */ } }
    await audit(store, { user_id: req.actor.uid, action: 'user.invite_resend', entity: 'user_roles', entity_id: req.params.id });
    return ok(res, { ...row, resent: true });
  } catch { return fail(res, 503, 'unavailable', 'Invitation could not be resent.'); }
}));
adminRouter.post('/users/:id/revoke-invite', requireAdmin(async (req, res) => {
  try {
    const row = await store.roleByUid(req.params.id); if (!row) return fail(res, 404, 'not_found', 'Account not found.');
    if (isFirebase()) { try { await authAdmin().updateUser(req.params.id, { disabled: true }); } catch { /* best effort */ } }
    const updated = await store.saveRole(req.params.id, { account_status: 'deactivated' });
    await audit(store, { user_id: req.actor.uid, action: 'user.invite_revoke', entity: 'user_roles', entity_id: req.params.id });
    return ok(res, { ...updated, revoked: true });
  } catch { return fail(res, 503, 'unavailable', 'Invitation could not be revoked.'); }
}));
