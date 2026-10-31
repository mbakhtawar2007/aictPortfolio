import express from 'express';
import { ok, fail, parseBody, memberSchema, projectSchema, achievementSchema, siteSchema, userPatchSchema, uploadSignSchema, mediaMetaSchema, messagePatchSchema, setPasswordSchema, inviteLinkSchema } from '../validate.js';
import { store, isFirebase } from '../store.js';
import { authAdmin, firebaseEnabled, demoMode } from '../firebase.js';
import { requireAdmin, requireMemberOrAdmin, canEditMember, canEditProject } from '../auth.js';
import { audit } from '../audit.js';
import { checkVerifyAsset } from '../verifyAsset.js';
import crypto from 'crypto';
export const adminRouter = express.Router();
// NOTE: this router is mounted at /api/admin, so paths below are relative.
// Who am I: lets the frontend route admins to /admin and members to
// /member without guessing from which admin-only calls happen to fail.
adminRouter.get('/me', requireMemberOrAdmin(async (req, res) => {
  return ok(res, { uid: req.actor.uid, email: req.actor.email, role: req.actor.role, account_status: req.actor.account_status, member_id: req.actor.member_id || '' });
}));
adminRouter.get('/messages', requireAdmin(async (req, res) => { try { return ok(res, await store.messagesAll()); } catch { return fail(res, 503, 'unavailable', 'Messages are temporarily unavailable.'); } }));
// Audit fix 2026-10-29: slugs are the public URL key, so they must be unique.
// Without this check two published records could share a slug and the public
// detail route would silently serve only the first match.
async function slugTaken(kind, slug, excludeId) {
  const all = kind === 'members' ? await store.membersAll() : await store.projectsAll();
  return all.some((r) => r.slug === slug && r.id !== excludeId);
}
adminRouter.get('/members', requireMemberOrAdmin(async (req, res) => {
  try { const all = await store.membersAll(); const list = req.actor.role === 'admin' ? all : all.filter((m) => m.id === req.actor.member_id); return ok(res, list); } catch { return fail(res, 503, 'unavailable', 'Members are temporarily unavailable.'); }
}));
// Video uploads (2026-10-31): only admins and the current Group Leader may
// upload videos. The leader is a profile flag, not an account role, so the
// actor's linked member record decides. Other members keep photo/resume uploads.
async function canUploadVideo(actor) {
  if (actor.role === 'admin') return true;
  if (actor.role !== 'member' || !actor.member_id) return false;
  try { const m = await store.memberById(actor.member_id); return m?.is_leader === true; } catch { return false; }
}
// Group leader (2026-10-29): exactly one member profile may be the group
// leader. Setting it on one profile clears it from every other profile.
// Only admins reach this helper with is_leader=true — member requests
// have the flag stripped before saving, in both POST and PATCH below.
async function clearOtherLeaders(exceptId) { const all = await store.membersAll(); for (const m of all) { if (m.id !== exceptId && m.is_leader) { try { await store.saveMember(m.id, { is_leader: false }); } catch { /* best effort */ } } } }
adminRouter.post('/members', requireMemberOrAdmin(async (req, res) => {
  const p = parseBody(memberSchema, req.body); if (!p.ok) return fail(res, 400, 'validation_error', p.message);
  // Member self-service: an invited/active member with no linked profile yet
  // may create exactly one profile for themselves. It is always saved as a
  // draft so an admin publishes it, and the account is linked to it.
  // Members may never create profiles for other people, and this is not a
  // public sign-up: only an admin-invited account reaches this route.
  const isSelfCreate = req.actor.role === 'member';
  if (isSelfCreate && req.actor.member_id) {
    // Audit fix (data-integrity review): if the linked profile was deleted,
    // the member would otherwise be stuck — the list shows 'Create my
    // profile' but self-create rejected with 403. Allow creation and re-link.
    const linked = await store.memberById(req.actor.member_id);
    if (linked) return fail(res, 403, 'forbidden', 'You already have a profile. Edit it instead of creating a new one.');
  }
  const data = isSelfCreate ? { ...p.data, status: 'draft', is_leader: false } : p.data;
  if (await slugTaken('members', data.slug, '')) return fail(res, 409, 'slug_taken', 'Another member already uses this web address (slug). Choose a different one.');
  try {
    const row = await store.saveMember('', data);
    // Section 5F: claim the slug atomically; on a concurrent collision,
    // roll the just-created record back instead of leaving a duplicate.
    if (!(await store.reserveSlug('members', data.slug, row.id))) { await store.deleteMember(row.id); return fail(res, 409, 'slug_taken', 'Another member already uses this web address (slug). Choose a different one.'); }
    if (data.is_leader) await clearOtherLeaders(row.id);
    await audit(store, { user_id: req.actor.uid, action: 'member.create', entity: 'members', entity_id: row.id });
    if (isSelfCreate) {
      await store.saveRole(req.actor.uid, { member_id: row.id });
      await audit(store, { user_id: req.actor.uid, action: 'user.link_profile', entity: 'user_roles', entity_id: req.actor.uid });
    }
    return ok(res, row, 201);
  } catch { return fail(res, 503, 'unavailable', 'Member could not be saved.'); }
}));
adminRouter.patch('/members/:id', requireMemberOrAdmin(async (req, res) => {
  // BUG-14: members get 404 for both missing and other-owned profiles.
  if (req.actor.role === 'member' && !canEditMember(req.actor, req.params.id)) return fail(res, 404, 'not_found', 'Member not found.');
  if (!canEditMember(req.actor, req.params.id)) return fail(res, 403, 'forbidden', 'You can edit only your own profile.');
  const p = parseBody(memberSchema.partial(), req.body); if (!p.ok) return fail(res, 400, 'validation_error', p.message);
  // Audit fix 2026-10-29: members must never publish themselves. POST already
  // forces self-created profiles to draft, but PATCH let a member flip an
  // existing draft to published and bypass admin review. Preserve the
  // existing status for member edits; only admins change it.
  if (req.actor.role === 'member') delete p.data.status;
  if (req.actor.role === 'member') delete p.data.is_leader;
  if (p.data.slug && await slugTaken('members', p.data.slug, req.params.id)) return fail(res, 409, 'slug_taken', 'Another member already uses this web address (slug). Choose a different one.');
  const existing = await store.memberById(req.params.id);
  if (!existing) return fail(res, 404, 'not_found', 'Member not found.');
  if (p.data.slug && p.data.slug !== existing.slug) {
    if (!(await store.reserveSlug('members', p.data.slug, req.params.id))) return fail(res, 409, 'slug_taken', 'Another member already uses this web address (slug). Choose a different one.');
    await store.releaseSlug('members', existing.slug, req.params.id);
  }
  try { const ex = await store.memberById(req.params.id); if (ex) await store.addRevision({ entity: 'members', entity_id: req.params.id, snapshot: ex, created_at: new Date().toISOString(), user_id: req.actor.uid }); } catch { /* revision failure must not block the save */ }
  try { await store.saveMember(req.params.id, p.data); if (p.data.is_leader) await clearOtherLeaders(req.params.id); const row = await store.memberById(req.params.id); await audit(store, { user_id: req.actor.uid, action: 'member.update', entity: 'members', entity_id: req.params.id }); return ok(res, row); } catch { return fail(res, 503, 'unavailable', 'Member could not be saved.'); }
}));
adminRouter.delete('/members/:id', requireAdmin(async (req, res) => { try { const ex = await store.memberById(req.params.id); if (ex) await store.addRevision({ entity: 'members', entity_id: req.params.id, snapshot: ex, created_at: new Date().toISOString(), user_id: req.actor.uid }); await store.deleteMember(req.params.id); if (ex.slug) await store.releaseSlug('members', ex.slug, req.params.id); await audit(store, { user_id: req.actor.uid, action: 'member.delete', entity: 'members', entity_id: req.params.id }); return ok(res, { deleted: true }); } catch { return fail(res, 503, 'unavailable', 'Member could not be deleted.'); } }));
adminRouter.get('/projects', requireMemberOrAdmin(async (req, res) => {
  try { const all = await store.projectsAll(); const list = req.actor.role === 'admin' ? all : (req.actor.member_id ? all.filter((p) => (p.member_ids || []).includes(req.actor.member_id)) : []); return ok(res, list); } catch { return fail(res, 503, 'unavailable', 'Projects are temporarily unavailable.'); }
}));
adminRouter.post('/projects', requireMemberOrAdmin(async (req, res) => {
  const p = parseBody(projectSchema, req.body); if (!p.ok) return fail(res, 400, 'validation_error', p.message);
  // BUG-20: a profile-less member must not create ambiguously owned content.
  if (req.actor.role === 'member' && !req.actor.member_id) return fail(res, 403, 'forbidden', 'Create your team profile first, then add projects.');
  if (req.actor.role === 'member' && (p.data.video_url || p.data.category === 'AI Video') && !(await canUploadVideo(req.actor))) return fail(res, 403, 'forbidden', 'Only the Group Leader and admins can upload videos.');
  // Audit fix 2026-10-29: member-created projects are drafts until an admin
  // publishes them (previously a member could POST status: 'published').
  if (req.actor.role === 'member') p.data.status = 'draft';
  // Audit fix 2026-10-29 (security review): a member must not attach other
  // members to a project on create — that would grant them edit rights.
  if (req.actor.role === 'member') { p.data.member_ids = req.actor.member_id ? [req.actor.member_id] : []; p.data.project_members = (p.data.project_members || []).filter((x) => x.member_id === req.actor.member_id); }
  if (p.data.year === null) delete p.data.year;
  if (await slugTaken('projects', p.data.slug, '')) return fail(res, 409, 'slug_taken', 'Another project already uses this web address (slug). Choose a different one.');
  try { const row = await store.saveProject('', p.data); if (!(await store.reserveSlug('projects', p.data.slug, row.id))) { await store.deleteProject(row.id); return fail(res, 409, 'slug_taken', 'Another project already uses this web address (slug). Choose a different one.'); } await audit(store, { user_id: req.actor.uid, action: 'project.create', entity: 'projects', entity_id: row.id }); return ok(res, row, 201); } catch { return fail(res, 503, 'unavailable', 'Project could not be saved.'); }
}));
adminRouter.patch('/projects/:id', requireMemberOrAdmin(async (req, res) => {
  try {
    const all = await store.projectsAll(); const ex = all.find((p) => p.id === req.params.id);
    // BUG-14: for members, a missing project and an unassigned project must
    // be indistinguishable (both 404), so membership cannot be probed.
    // Admins keep the precise 404/403 distinction.
    if (!ex) return fail(res, 404, 'not_found', 'Project not found.');
    if (req.actor.role === 'member' && !canEditProject(req.actor, ex)) return fail(res, 404, 'not_found', 'Project not found.');
    if (!canEditProject(req.actor, ex)) return fail(res, 403, 'forbidden', 'You can edit only projects you are assigned to.');
    const p = parseBody(projectSchema.partial(), req.body); if (!p.ok) return fail(res, 400, 'validation_error', p.message);
    // Audit fix 2026-10-29: members keep the existing status and membership
    // list when editing an assigned project; only admins publish/unpublish
    // or change who is assigned.
    if (req.actor.role === 'member') { delete p.data.status; delete p.data.member_ids; delete p.data.project_members; }
    if (req.actor.role === 'member' && (p.data.video_url || p.data.category === 'AI Video') && !(await canUploadVideo(req.actor))) return fail(res, 403, 'forbidden', 'Only the Group Leader and admins can upload videos.');
    if (p.data.slug && await slugTaken('projects', p.data.slug, req.params.id)) return fail(res, 409, 'slug_taken', 'Another project already uses this web address (slug). Choose a different one.');
    // BUG-12: year: null on PATCH deletes the field; other omitted fields
    // are untouched (partial schema + merge), so clearing year cannot
    // accidentally clear anything else.
    const clearYear = p.data.year === null; if (clearYear) delete p.data.year;
    if (p.data.slug && p.data.slug !== ex.slug) {
      if (!(await store.reserveSlug('projects', p.data.slug, req.params.id))) return fail(res, 409, 'slug_taken', 'Another project already uses this web address (slug). Choose a different one.');
      await store.releaseSlug('projects', ex.slug, req.params.id);
    }
    try { await store.addRevision({ entity: 'projects', entity_id: req.params.id, snapshot: ex, created_at: new Date().toISOString(), user_id: req.actor.uid }); } catch { /* revision failure must not block the save */ }
    await store.saveProject(req.params.id, p.data); if (clearYear) await store.deleteProjectField(req.params.id, 'year'); const row = (await store.projectsAll()).find((x) => x.id === req.params.id); await audit(store, { user_id: req.actor.uid, action: 'project.update', entity: 'projects', entity_id: req.params.id }); return ok(res, row);
  } catch { return fail(res, 503, 'unavailable', 'Project could not be saved.'); }
}));
adminRouter.delete('/projects/:id', requireMemberOrAdmin(async (req, res) => { try { const all = await store.projectsAll(); const ex = all.find((p) => p.id === req.params.id); if (req.actor.role === 'member' && (!ex || !canEditProject(req.actor, ex))) return fail(res, 404, 'not_found', 'Project not found.'); if (req.actor.role === 'member' && ex.status !== 'draft') return fail(res, 403, 'forbidden', 'Only your own draft projects can be deleted by you. Ask an admin about published ones.'); if (ex) await store.addRevision({ entity: 'projects', entity_id: req.params.id, snapshot: ex, created_at: new Date().toISOString(), user_id: req.actor.uid }); await store.deleteProject(req.params.id); if (ex.slug) await store.releaseSlug('projects', ex.slug, req.params.id); await audit(store, { user_id: req.actor.uid, action: 'project.delete', entity: 'projects', entity_id: req.params.id }); return ok(res, { deleted: true }); } catch { return fail(res, 503, 'unavailable', 'Project could not be deleted.'); } }));
adminRouter.post('/achievements', requireMemberOrAdmin(async (req, res) => {
  const p = parseBody(achievementSchema, req.body); if (!p.ok) return fail(res, 400, 'validation_error', p.message);
  if (req.actor.role === 'member' && p.data.member_id && !canEditMember(req.actor, p.data.member_id)) return fail(res, 403, 'forbidden', 'You can add achievements only to your own profile.');
  if (req.actor.role === 'member' && !p.data.member_id) p.data.member_id = req.actor.member_id;
  // BUG-10: member-created achievements are drafts until an admin publishes.
  if (req.actor.role === 'member') p.data.status = 'draft';
  // BUG-20: a profile-less member must not create ambiguously owned content.
  if (req.actor.role === 'member' && !req.actor.member_id) return fail(res, 403, 'forbidden', 'Create your team profile first, then add achievements.');
  try { const row = await store.saveAchievement('', p.data); await audit(store, { user_id: req.actor.uid, action: 'achievement.create', entity: 'achievements', entity_id: row.id }); return ok(res, row, 201); } catch { return fail(res, 503, 'unavailable', 'Achievement could not be saved.'); }
}));
adminRouter.patch('/achievements/:id', requireMemberOrAdmin(async (req, res) => {
  try {
    const all = await store.achievementsAll(); const ex = all.find((a) => a.id === req.params.id); if (!ex) return fail(res, 404, 'not_found', 'Achievement not found.');
    // BUG-14: same indistinguishability rule as projects, for members.
    if (req.actor.role === 'member' && !canEditMember(req.actor, ex.member_id)) return fail(res, 404, 'not_found', 'Achievement not found.');
    const p = parseBody(achievementSchema.partial(), req.body); if (!p.ok) return fail(res, 400, 'validation_error', p.message);
    // Audit fix 2026-10-29: members must not reassign an achievement to
    // another member's profile by PATCHing member_id.
    if (req.actor.role === 'member') delete p.data.member_id;
    // BUG-10: members cannot change achievement status on PATCH either.
    if (req.actor.role === 'member') delete p.data.status;
    try { await store.addRevision({ entity: 'achievements', entity_id: req.params.id, snapshot: ex, created_at: new Date().toISOString(), user_id: req.actor.uid }); } catch { /* revision failure must not block the save */ }
    const row = await store.saveAchievement(req.params.id, p.data); await audit(store, { user_id: req.actor.uid, action: 'achievement.update', entity: 'achievements', entity_id: req.params.id }); return ok(res, row);
  } catch { return fail(res, 503, 'unavailable', 'Achievement could not be saved.'); }
}));
adminRouter.delete('/achievements/:id', requireMemberOrAdmin(async (req, res) => { try { const all = await store.achievementsAll(); const ex = all.find((a) => a.id === req.params.id); if (req.actor.role === 'member' && (!ex || ex.member_id !== req.actor.member_id)) return fail(res, 404, 'not_found', 'Achievement not found.'); if (req.actor.role === 'member' && ex.status !== 'draft') return fail(res, 403, 'forbidden', 'Only your own draft achievements can be deleted by you. Ask an admin about published ones.'); if (ex) await store.addRevision({ entity: 'achievements', entity_id: req.params.id, snapshot: ex, created_at: new Date().toISOString(), user_id: req.actor.uid }); await store.deleteAchievement(req.params.id); await audit(store, { user_id: req.actor.uid, action: 'achievement.delete', entity: 'achievements', entity_id: req.params.id }); return ok(res, { deleted: true }); } catch { return fail(res, 503, 'unavailable', 'Achievement could not be deleted.'); } }));
adminRouter.get('/settings', requireAdmin(async (req, res) => { try { return ok(res, await store.site()); } catch { return fail(res, 503, 'unavailable', 'Settings are temporarily unavailable.'); } }));
adminRouter.patch('/settings', requireAdmin(async (req, res) => {
  const p = parseBody(siteSchema.partial(), req.body); if (!p.ok) return fail(res, 400, 'validation_error', p.message);
  try { const before = await store.site(); if (before) await store.addRevision({ entity: 'site_settings', entity_id: 'main', snapshot: before, created_at: new Date().toISOString(), user_id: req.actor.uid }); const row = await store.saveSite(p.data); await audit(store, { user_id: req.actor.uid, action: 'settings.update', entity: 'site_settings', entity_id: 'main' }); return ok(res, row); } catch { return fail(res, 503, 'unavailable', 'Settings could not be saved.'); }
}));
adminRouter.post('/upload/sign', requireMemberOrAdmin(async (req, res) => {
  const p = parseBody(uploadSignSchema, req.body); if (!p.ok) return fail(res, 400, 'validation_error', p.message);
  if (p.data.file_type === 'video' && !(await canUploadVideo(req.actor))) return fail(res, 403, 'forbidden', 'Only the Group Leader and admins can upload videos.');
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) return fail(res, 503, 'upload_unavailable', 'File uploads are not configured.');
  const ext = p.data.file_name.split('.').pop()?.toLowerCase() || '';
  if (p.data.file_type === 'pdf' && ext !== 'pdf') return fail(res, 400, 'validation_error', 'Resumes must be PDF files.');
  if (p.data.file_type === 'image' && !['jpg', 'jpeg', 'png', 'webp', 'avif'].includes(ext)) return fail(res, 400, 'validation_error', 'Images must be jpg, png, webp or avif.');
  if (p.data.file_type === 'video' && !['mp4', 'webm'].includes(ext)) return fail(res, 400, 'validation_error', 'Videos must be MP4 or WebM.');
  const maxSignBytes = p.data.file_type === 'video' ? 50 * 1024 * 1024 : 5 * 1024 * 1024;
  if (p.data.file_size > maxSignBytes) return fail(res, 400, 'validation_error', `File is larger than ${p.data.file_type === 'video' ? '50 MB' : '5 MB'}.`);
  try {
    const cloudinary = (await import('cloudinary')).v2;
    cloudinary.config({ cloud_name: CLOUDINARY_CLOUD_NAME, api_key: CLOUDINARY_API_KEY, api_secret: CLOUDINARY_API_SECRET, secure: true });
    const timestamp = Math.round(Date.now() / 1000);
    // Full storage path, folder included, server-generated only; the browser
    // never supplies a storage path. The browser must NOT also send a
    // `folder` param: Cloudinary prepends it to public_id, which stored
    // assets at a doubled path (aict-portfolio/images/aict-portfolio/...)
    // and made verify 404 on every upload (2026-10-30). The signature
    // therefore covers only timestamp + public_id.
    // Cloudinary rule: public IDs of image/video files must NOT include
    // an extension, but public IDs of raw files MUST include the original
    // extension. A PDF signed without '.pdf' was stored by Cloudinary
    // under the extended id, so verify (which looked up the unextended
    // id) 404d on every resume upload (2026-10-30) while photos worked.
    const public_id = `aict-portfolio/${p.data.file_type === 'video' ? 'videos' : p.data.file_type === 'pdf' ? 'resumes' : 'images'}/${req.actor.uid}-${Date.now()}${p.data.file_type === 'pdf' ? '.pdf' : ''}`;
    const signature = cloudinary.utils.api_sign_request({ timestamp, public_id }, CLOUDINARY_API_SECRET);
    return ok(res, { cloud_name: CLOUDINARY_CLOUD_NAME, api_key: CLOUDINARY_API_KEY, timestamp, public_id, signature });
  } catch { return fail(res, 503, 'upload_unavailable', 'File uploads are temporarily unavailable.'); }
}));
// Section 5C upload verification: after the browser uploads directly to
// Cloudinary, the admin/member page calls this to verify the REAL asset
// (not the claimed file) before its URL is accepted into a form. Invalid
// assets are deleted from Cloudinary so they cannot be linked later.
// Members may verify only their own UID-prefixed assets; admins any asset
// under the portfolio folder. Returns 503 when Cloudinary is unconfigured.
adminRouter.post('/upload/verify', requireMemberOrAdmin(async (req, res) => {
  const body = req.body || {};
  const publicId = typeof body.public_id === 'string' ? body.public_id : '';
  const expected = body.file_type === 'video' ? 'video' : body.file_type === 'pdf' ? 'pdf' : 'image';
  if (expected === 'video' && !(await canUploadVideo(req.actor))) return fail(res, 403, 'forbidden', 'Only the Group Leader and admins can upload videos.');
  if (!publicId.startsWith('aict-portfolio/')) return fail(res, 400, 'validation_error', 'Only portfolio uploads can be verified.');
  if (req.actor.role !== 'admin' && !publicId.includes(`/${req.actor.uid}-`)) return fail(res, 403, 'forbidden', 'You can verify only your own uploads.');
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) return fail(res, 503, 'upload_unavailable', 'File uploads are not configured.');
  try {
    const cloudinary = (await import('cloudinary')).v2;
    cloudinary.config({ cloud_name: CLOUDINARY_CLOUD_NAME, api_key: CLOUDINARY_API_KEY, api_secret: CLOUDINARY_API_SECRET, secure: true });
    const resourceType = expected === 'video' ? 'video' : expected === 'pdf' ? 'raw' : 'image';
    let asset;
    try { asset = await cloudinary.api.resource(publicId, { resource_type: resourceType }); }
    catch { return fail(res, 404, 'not_found', 'No such uploaded asset was found.'); }
    // Format rule lives in verifyAsset.js (unit-tested): for PDFs a missing
    // format no longer blocks a raw asset whose id/URL ends in .pdf — that
    // was the 2026-10-30 admin resume failure. The rejection message now
    // reports what Cloudinary actually returned, so a future failure is
    // diagnosable instead of another blind guess.
    const check = checkVerifyAsset(expected, asset, publicId);
    if (!check.ok) {
      try { await cloudinary.uploader.destroy(publicId, { resource_type: resourceType }); } catch { /* removal best effort */ }
      const why = check.reason === 'size'
        ? `file is larger than ${expected === 'video' ? '50 MB' : '5 MB'}`
        : `file format is not allowed (Cloudinary reported format '${check.format || 'none'}', type '${check.resourceType || 'unknown'}')`;
      return fail(res, 400, 'validation_error', `Upload rejected: ${why} (asset removed).`);
    }
    return ok(res, { verified: true, secure_url: asset.secure_url, format: asset.format, bytes: asset.bytes, resource_type: asset.resource_type });
  } catch { return fail(res, 503, 'upload_unavailable', 'Upload verification is temporarily unavailable.'); }
}));
adminRouter.post('/media/meta', requireMemberOrAdmin(async (req, res) => {
  const p = parseBody(mediaMetaSchema, req.body); if (!p.ok) return fail(res, 400, 'validation_error', p.message);
  const { public_id, title, description } = p.data;
  if (!public_id.startsWith('aict-portfolio/')) return fail(res, 400, 'validation_error', 'Only portfolio uploads can have details.');
  if (req.actor.role !== 'admin' && !public_id.includes(`/${req.actor.uid}-`)) return fail(res, 403, 'forbidden', 'You can add details only to your own uploads.');
  try {
    const row = await store.saveMediaMeta(public_id, { title: (title || '').trim(), description: (description || '').trim(), updated_by: req.actor.uid });
    await audit(store, { user_id: req.actor.uid, action: 'media.meta_saved', entity: 'media', entity_id: public_id });
    return ok(res, row);
  } catch { return fail(res, 503, 'unavailable', 'Details could not be saved.'); }
}));
adminRouter.delete('/media', requireMemberOrAdmin(async (req, res) => {
  const publicId = typeof req.query.public_id === 'string' ? req.query.public_id : '';
  if (!publicId.startsWith('aict-portfolio/')) return fail(res, 400, 'validation_error', 'Only portfolio uploads can be deleted.');
  if (req.actor.role !== 'admin' && !publicId.includes(`/${req.actor.uid}-`)) return fail(res, 403, 'forbidden', 'You can delete only your own uploads.');
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) return fail(res, 503, 'upload_unavailable', 'File uploads are not configured.');
  try {
    const cloudinary = (await import('cloudinary')).v2;
    cloudinary.config({ cloud_name: CLOUDINARY_CLOUD_NAME, api_key: CLOUDINARY_API_KEY, api_secret: CLOUDINARY_API_SECRET, secure: true });
    const resourceType = publicId.includes('/videos/') ? 'video' : publicId.includes('/resumes/') ? 'raw' : 'image';
    const destroyed = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    if (destroyed && destroyed.result && destroyed.result !== 'ok' && destroyed.result !== 'not found') return fail(res, 503, 'unavailable', 'The file could not be deleted from storage.');
    try { await store.deleteMediaMeta(publicId); } catch { /* meta cleanup best effort */ }
    await audit(store, { user_id: req.actor.uid, action: 'media.delete', entity: 'media', entity_id: publicId });
    return ok(res, { deleted: true });
  } catch { return fail(res, 503, 'unavailable', 'The file could not be deleted.'); }
}));
adminRouter.post('/revalidate', requireAdmin(async (req, res) => ok(res, { status: 'live_on_next_load', note: 'Public pages fetch live data from this API in the browser, so saved content is live on the next page load with no rebuild. A Netlify rebuild is only needed for code changes, and Netlify auto-builds on a push to main.' })));
// ---- Achievements (admin list; members see only their own) ----
adminRouter.get('/achievements', requireMemberOrAdmin(async (req, res) => {
  try { const all = await store.achievementsAll(); const list = req.actor.role === 'admin' ? all : (req.actor.member_id ? all.filter((a) => a.member_id === req.actor.member_id) : []); return ok(res, list); } catch { return fail(res, 503, 'unavailable', 'Achievements are temporarily unavailable.'); }
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
    if (rev.entity === 'site_settings') {
      const siteSchemaFull = siteSchema;
      const siteParsed = parseBody(siteSchemaFull.partial(), (({ id, ...rest }) => rest)(rev.snapshot || {}));
      if (!siteParsed.ok) return fail(res, 400, 'validation_error', 'This settings revision no longer passes validation and cannot be restored.');
      const beforeSite = await store.site();
      if (beforeSite) await store.addRevision({ entity: 'site_settings', entity_id: 'main', snapshot: beforeSite, created_at: new Date().toISOString(), user_id: req.actor.uid });
      await store.replaceSite(siteParsed.data);
      await audit(store, { user_id: req.actor.uid, action: 'revision.restore', entity: 'site_settings', entity_id: 'main' });
      return ok(res, { restored: true, entity: 'site_settings', entity_id: 'main' });
    }
    // Audit fix (data-integrity review): restoring a revision of a deleted
    // record must not silently recreate it, and a raw snapshot must pass
    // the same validation as a normal save (stray fields stripped).
    const stillExists = rev.entity === 'members' ? await store.memberById(rev.entity_id)
      : rev.entity === 'projects' ? (await store.projectsAll()).some((p) => p.id === rev.entity_id)
      : rev.entity === 'achievements' ? (await store.achievementsAll()).some((a) => a.id === rev.entity_id) : false;
    if (!stillExists) return fail(res, 404, 'not_found', 'That record no longer exists, so its revision cannot be restored.');
    const { id, ...rawFields } = rev.snapshot || {};
    const schema = rev.entity === 'members' ? memberSchema.partial() : rev.entity === 'projects' ? projectSchema.partial() : achievementSchema.partial();
    const parsed = parseBody(schema, rawFields); if (!parsed.ok) return fail(res, 400, 'validation_error', 'This revision no longer passes validation and cannot be restored.');
    const fields = parsed.data;
    // Section 5B true restore: replace the document (fields added after the
    // snapshot are removed), preserving only id + timestamps semantics.
    // The pre-restore state is snapshotted first so a restore can be undone.
    const current = rev.entity === 'members' ? await store.memberById(rev.entity_id)
      : rev.entity === 'projects' ? (await store.projectsAll()).find((p) => p.id === rev.entity_id)
      : (await store.achievementsAll()).find((a) => a.id === rev.entity_id);
    if (current) await store.addRevision({ entity: rev.entity, entity_id: rev.entity_id, snapshot: current, created_at: new Date().toISOString(), user_id: req.actor.uid });
    if (rev.entity === 'members') await store.replaceMember(rev.entity_id, fields);
    else if (rev.entity === 'projects') await store.replaceProject(rev.entity_id, fields);
    else if (rev.entity === 'achievements') await store.replaceAchievement(rev.entity_id, fields);
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
    let items = (result.resources || []).map((r) => ({ public_id: r.public_id, secure_url: r.secure_url, format: r.format, resource_type: r.resource_type, bytes: r.bytes, created_at: r.created_at, width: r.width, height: r.height, original_filename: r.original_filename || '' }));
    let videoItems = [];
    try { const vids = await cloudinary.api.resources({ type: 'upload', resource_type: 'video', prefix: 'aict-portfolio/', max_results: 50 }); videoItems = (vids.resources || []).map((r) => ({ public_id: r.public_id, secure_url: r.secure_url, format: r.format, resource_type: r.resource_type, bytes: r.bytes, created_at: r.created_at, width: r.width, height: r.height, original_filename: r.original_filename || '' })); } catch { /* videos simply absent from the list */ }
    items = [...new Map([...items, ...videoItems].map((r) => [r.public_id, r])).values()].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    // Audit fix 2026-10-29 (security review): members previously saw every
    // member's files. Non-admins see only uploads signed under their own UID
    // (public_id is aict-portfolio/<type>/<uid>-<timestamp>).
    if (req.actor.role !== 'admin') items = items.filter((r) => r.public_id.includes(`/${req.actor.uid}-`));
    // Gallery details: overlay saved titles/descriptions when present.
    try { const meta = await store.mediaMetaAll(); const byId = new Map(meta.map((m) => [m.public_id, m])); items = items.map((r) => { const m = byId.get(r.public_id); return m ? { ...r, title: m.title || '', description: m.description || '' } : r; }); } catch { /* meta overlay is best effort */ }
    return ok(res, items);
  } catch { return fail(res, 503, 'media_unavailable', 'Media library is temporarily unavailable.'); }
}));
// ---- Users / invitations (admin only) ----
// ---- Invite links (admin only): create, list (no token hashes), revoke ----
adminRouter.post('/users/invite-link', requireAdmin(async (req, res) => {
  const p = parseBody(inviteLinkSchema, req.body); if (!p.ok) return fail(res, 400, 'validation_error', p.message);
  if (p.data.member_id) { const profile = await store.memberById(p.data.member_id); if (!profile) return fail(res, 404, 'not_found', 'The linked team profile does not exist.'); }
  const existing = await store.roleByEmail(p.data.email);
  if (existing) return fail(res, 409, 'already_exists', 'An account already exists for this email. Use Set password on that account instead of a new invitation link.');
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const row = await store.saveInvite({ email: p.data.email, name: p.data.name, role: p.data.role, member_id: p.data.member_id || '', token_hash: tokenHash, used: false, revoked: false, invited_by: req.actor.uid, invited_at: new Date().toISOString(), expires_at: expiresAt });
  await audit(store, { user_id: req.actor.uid, action: 'user.invite_link_created', entity: 'invites', entity_id: row.id });
  // The plaintext token is returned ONLY here, at creation. It is never
  // stored and never returned again (list/revoke responses omit it).
  const base = process.env.PUBLIC_SITE_URL || 'https://aictportfollio.netlify.app';
  const inviteLink = `${base.replace(/\/$/, '')}/invite?token=${token}`;
  let emailDelivery = 'link_only';
  // Automatic Gmail send (preferred): when the admin's Gmail App Password
  // is configured, the invitation goes out from their own Gmail account —
  // no third-party email service. Sending never blocks the link: on any
  // failure the link is still returned and the admin can send it manually.
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    try {
      const nodemailer = (await import('nodemailer')).default;
      const transporter = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000 });
      await transporter.sendMail({ from: `"AICT Group Portfolio" <${process.env.GMAIL_USER}>`, to: p.data.email, subject: 'Your AICT portfolio invitation', text: `Hi${p.data.name ? ` ${p.data.name}` : ''},\n\nYou have been invited to the AICT group portfolio. Create your account here (link expires in 7 days):\n${inviteLink}\n` });
      emailDelivery = 'gmail';
    } catch { emailDelivery = 'failed'; }
  } else if (isFirebase() && process.env.RESEND_API_KEY && process.env.CONTACT_NOTIFY_EMAIL) {
    try {
      const { Resend } = await import('resend');
      await new Resend(process.env.RESEND_API_KEY).emails.send({ from: 'AICT Portfolio <onboarding@resend.dev>', to: p.data.email, subject: 'Your AICT portfolio invitation', text: `You have been invited to the AICT group portfolio. Create your account here (link expires in 7 days): ${inviteLink}` });
      emailDelivery = 'attempted';
    } catch { emailDelivery = 'link_only'; }
  }
  return ok(res, { invite_id: row.id, email: row.email, role: row.role, expires_at: expiresAt, invite_link: inviteLink, email_delivery: emailDelivery }, 201);
}));
adminRouter.get('/users/invite-links', requireAdmin(async (req, res) => {
  try {
    const all = await store.invitesAll();
    const safe = all.map(({ token_hash, ...rest }) => rest).sort((a, b) => String(b.invited_at || '').localeCompare(String(a.invited_at || '')));
    return ok(res, safe);
  } catch { return fail(res, 503, 'unavailable', 'Invitations are temporarily unavailable.'); }
}));
adminRouter.post('/users/invite-links/:id/revoke', requireAdmin(async (req, res) => {
  try { const all = await store.invitesAll(); if (!all.some((i) => i.id === req.params.id)) return fail(res, 404, 'not_found', 'Invitation not found.'); await store.markInviteRevoked(req.params.id); await audit(store, { user_id: req.actor.uid, action: 'user.invite_link_revoked', entity: 'invites', entity_id: req.params.id }); return ok(res, { revoked: true }); }
  catch { return fail(res, 503, 'unavailable', 'Invitation could not be revoked.'); }
}));
adminRouter.get('/users', requireAdmin(async (req, res) => { try { return ok(res, await store.rolesAll()); } catch { return fail(res, 503, 'unavailable', 'Accounts are temporarily unavailable.'); } }));
// Set or reset another account's password (admin only, never your own).
// The password is used once via the Firebase Admin SDK and is never
// stored in Firestore, logged, or returned. Share it privately, and ask
// the person to change it after first login (login page → Forgot password).
adminRouter.post('/users/:id/set-password', requireAdmin(async (req, res) => {
  if (req.params.id === req.actor.uid) return fail(res, 403, 'forbidden', 'You cannot change your own password this way.');
  const p = parseBody(setPasswordSchema, req.body); if (!p.ok) return fail(res, 400, 'validation_error', p.message);
  if (!isFirebase()) return fail(res, 503, 'unavailable', 'Password setting is only available with Firebase enabled.');
  try {
    const row = await store.roleByUid(req.params.id); if (!row) return fail(res, 404, 'not_found', 'Account not found.');
    await authAdmin().updateUser(req.params.id, { password: p.data.password });
    const pwAudit = await audit(store, { user_id: req.actor.uid, action: 'user.password_set', entity: 'user_roles', entity_id: req.params.id });
    return ok(res, { password_set: true, ...(pwAudit.ok ? {} : { audit_failed: true }) });
  } catch { return fail(res, 503, 'unavailable', 'Password could not be set.'); }
}));
adminRouter.patch('/users/:id', requireAdmin(async (req, res) => {
  // Self-link fix (2026-10-31): an admin must be able to link their OWN
  // account to a team profile (e.g. so their published profile shows on
  // /team like other members) — previously the blanket self-change ban
  // refused Save link for their own account, so the dropdown reset on
  // every refresh and the link could never persist. Only member_id is
  // allowed for self: changing your own role or status (self-demotion,
  // self-deactivation lockout) is still refused.
  const p0 = parseBody(userPatchSchema, req.body);
  if (req.params.id === req.actor.uid && p0.ok && (p0.data.role !== undefined || p0.data.account_status !== undefined)) return fail(res, 403, 'forbidden', 'You cannot change your own role or status, but you can link your own profile.');
  // Audit fix (data-integrity review): previously a typo'd UID created an
  // orphan role row with no Firebase Auth user behind it.
  const existingUser = await store.roleByUid(req.params.id);
  if (!existingUser) return fail(res, 404, 'not_found', 'Account not found.');
  const p = parseBody(userPatchSchema, req.body); if (!p.ok) return fail(res, 400, 'validation_error', p.message);
  // If a profile link is requested, it must point at a real team profile.
  // Empty string is allowed and means "unlink this account from any profile".
  if (p.data.member_id) {
    try { const prof = await store.memberById(p.data.member_id); if (!prof) return fail(res, 404, 'not_found', 'Team profile not found.'); } catch { return fail(res, 503, 'unavailable', 'Account could not be updated.'); }
  }
  try { const row = await store.saveRole(req.params.id, p.data); const upAudit = await audit(store, { user_id: req.actor.uid, action: 'user.update', entity: 'user_roles', entity_id: req.params.id }); return ok(res, upAudit.ok ? row : { ...row, audit_failed: true }); } catch { return fail(res, 503, 'unavailable', 'Account could not be updated.'); }
}));
adminRouter.delete('/users/:id', requireAdmin(async (req, res) => {
  // Account deletion: removes the sign-in account permanently. A linked
  // team profile is NOT deleted — deleting the role row unlinks it, so
  // the profile stays on the site without an owner account. Pending
  // invitation links for the same email are revoked first, so a stale
  // link cannot resurrect the account. The order is retry-safe: the
  // Firebase delete tolerates an already-missing user, so a partway
  // failure can simply be retried.
  if (req.params.id === req.actor.uid) return fail(res, 403, 'forbidden', 'You cannot delete your own account.');
  const row = await store.roleByUid(req.params.id);
  if (!row) return fail(res, 404, 'not_found', 'Account not found.');
  try {
    if (isFirebase()) {
      try { await authAdmin().deleteUser(req.params.id); }
      catch (e) { const code = e && e.code ? e.code : ''; if (code !== 'auth/user-not-found') throw e; }
    }
    const links = await store.invitesAll();
    for (const l of links) { if (l.email === row.email && !l.used && !l.revoked) { try { await store.markInviteRevoked(l.id); } catch { /* revoked on retry */ } } }
    await store.deleteRole(req.params.id);
    await audit(store, { user_id: req.actor.uid, action: 'user.deleted', entity: 'user_roles', entity_id: req.params.id });
    return ok(res, { deleted: true });
  } catch { return fail(res, 503, 'unavailable', 'Account could not be deleted.'); }
}));
adminRouter.post('/users/:id/resend-invite', requireAdmin(async (req, res) => {
  try {
    const row = await store.roleByUid(req.params.id); if (!row) return fail(res, 404, 'not_found', 'Account not found.');
    if (row.account_status !== 'invited') return fail(res, 400, 'validation_error', 'Only pending invitations can be resent.');
    // Audit fix 2026-10-29 (security review): the old code generated a
    // reset link and discarded it, yet returned resent:true. Now it sends
    // via Resend when configured, and honestly reports not_configured when
    // it is not (the admin UI separately sends a Firebase reset email).
    let sent = false;
    if (isFirebase()) {
      try {
        const link = await authAdmin().generatePasswordResetLink(row.email);
        if (process.env.RESEND_API_KEY && process.env.CONTACT_NOTIFY_EMAIL) {
          const { Resend } = await import('resend');
          await new Resend(process.env.RESEND_API_KEY).emails.send({ from: 'AICT Portfolio <onboarding@resend.dev>', to: row.email, subject: 'Your AICT portfolio account', text: `Set your password here: ${link}` });
          sent = true;
        }
      } catch { /* recorded, not exposed */ }
    }
    await audit(store, { user_id: req.actor.uid, action: 'user.invite_resend', entity: 'user_roles', entity_id: req.params.id });
    return ok(res, { ...row, resent: sent, email_delivery: sent ? 'sent' : 'not_configured' });
  } catch { return fail(res, 503, 'unavailable', 'Invitation could not be resent.'); }
}));
adminRouter.post('/users/:id/revoke-invite', requireAdmin(async (req, res) => {
  // Audit fix 2026-10-29 (security review): revoking your own account would
  // lock you out (and lock the whole admin plane if you are the sole admin).
  if (req.params.id === req.actor.uid) return fail(res, 403, 'forbidden', 'You cannot revoke your own account.');
  try {
    const row = await store.roleByUid(req.params.id); if (!row) return fail(res, 404, 'not_found', 'Account not found.');
    if (isFirebase()) { try { await authAdmin().updateUser(req.params.id, { disabled: true }); } catch { /* best effort */ } }
    const updated = await store.saveRole(req.params.id, { account_status: 'deactivated' });
    const revAudit = await audit(store, { user_id: req.actor.uid, action: 'user.invite_revoke', entity: 'user_roles', entity_id: req.params.id });
    return ok(res, { ...updated, revoked: true, ...(revAudit.ok ? {} : { audit_failed: true }) });
  } catch { return fail(res, 503, 'unavailable', 'Invitation could not be revoked.'); }
}));
