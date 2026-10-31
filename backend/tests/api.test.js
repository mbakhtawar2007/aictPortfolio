// AICT Group Portfolio — backend API regression suite (demo mode only).
// Run: npm test  (from backend/). Starts the Express app on an ephemeral
// port with DEMO_MODE=true and Firebase disabled, so no production data,
// account or email is ever touched. Demo tokens are test identities that
// only work in this mode; live /api/health reports demo:false.
process.env.DEMO_MODE = 'true';
process.env.FIREBASE_ENABLED = 'false';
process.env.CORS_ORIGIN = 'http://localhost:3000';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../src/app.js';
import { checkVerifyAsset } from '../src/verifyAsset.js';
import { store } from '../src/store.js';
import { resumePublicIdFromUrl, signedResumeUrl } from '../src/resumeUrl.js';

let server; let base;
before(async () => {
  server = http.createServer(createApp());
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise((r) => server.close(r)));

async function call(method, path, token, body) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}
const ADMIN = 'demo-admin-token'; const MEMBER = 'demo-member-token'; const UNLINKED = 'demo-unlinked-token';
const uid = (p) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

test('public: health, published-only lists, missing detail 404', async () => {
  const h = await call('GET', '/api/health'); assert.equal(h.status, 200); assert.equal(h.json.data.demo, true);
  const m = await call('GET', '/api/members'); assert.equal(m.status, 200);
  assert.ok(m.json.data.every((x) => x.status === 'published'));
  const miss = await call('GET', '/api/members/no-such-slug'); assert.equal(miss.status, 404);
});
test('no public signup: register 404, unauthenticated admin 401, bogus token 401', async () => {
  assert.equal((await call('POST', '/api/auth/register', null, { email: 'x@y.com' })).status, 404);
  assert.equal((await call('GET', '/api/admin/me')).status, 401);
  assert.equal((await call('GET', '/api/admin/users', 'bogus')).status, 401);
});
test('auth matrix: admin vs member scoping', async () => {
  const me = await call('GET', '/api/admin/me', MEMBER); assert.equal(me.json.data.role, 'member');
  assert.equal((await call('GET', '/api/admin/users', MEMBER)).status, 403);
  assert.equal((await call('GET', '/api/admin/settings', MEMBER)).status, 403);
  assert.equal((await call('GET', '/api/admin/audit', MEMBER)).status, 403);
  const list = await call('GET', '/api/admin/members', MEMBER);
  assert.equal(list.json.data.length, 1); assert.equal(list.json.data[0].id, 'sample-member-1');
});
test('member cannot self-publish profile or project', async () => {
  await call('PATCH', '/api/admin/members/sample-member-1', ADMIN, { status: 'draft' });
  const p = await call('PATCH', '/api/admin/members/sample-member-1', MEMBER, { status: 'published' });
  assert.equal(p.json.data.status, 'draft');
  const pub = await call('GET', '/api/members/sample-ayesha-khan'); assert.equal(pub.status, 404);
  await call('PATCH', '/api/admin/members/sample-member-1', ADMIN, { status: 'published' });
  const proj = await call('POST', '/api/admin/projects', MEMBER, { slug: uid('mem-proj'), title: 'Member Proj', status: 'published' });
  assert.equal(proj.json.data.status, 'draft');
  assert.equal((await call('GET', `/api/projects/${proj.json.data.slug}`)).status, 404);
});
test('duplicate slugs rejected with 409, own slug retained on edit', async () => {
  assert.equal((await call('POST', '/api/admin/members', ADMIN, { slug: 'sample-ayesha-khan', full_name: 'Dup' })).status, 409);
  assert.equal((await call('PATCH', '/api/admin/members/sample-member-1', ADMIN, { slug: 'sample-ali-raza' })).status, 409);
  assert.equal((await call('PATCH', '/api/admin/members/sample-member-1', ADMIN, { slug: 'sample-ayesha-khan' })).status, 200);
});
test('PATCH unknown member 404; member PATCH other profile 404 (no enumeration)', async () => {
  assert.equal((await call('PATCH', '/api/admin/members/nope-123', ADMIN, { full_name: 'Ghost' })).status, 404);
  assert.equal((await call('PATCH', '/api/admin/members/sample-member-2', MEMBER, { full_name: 'X' })).status, 404);
});
test('member PATCH project/achievement: status, membership and ownership stripped', async () => {
  const proj = await call('POST', '/api/admin/projects', MEMBER, { slug: uid('mem-proj2'), title: 'P2' });
  const pid = proj.json.data.id;
  const edited = await call('PATCH', `/api/admin/projects/${pid}`, MEMBER, { status: 'published', member_ids: ['sample-member-2'], title: 'Renamed' });
  assert.equal(edited.json.data.status, 'draft');
  assert.deepEqual(edited.json.data.member_ids, ['sample-member-1']);
  assert.equal(edited.json.data.title, 'Renamed');
  const ach = await call('POST', '/api/admin/achievements', MEMBER, { title: 'Ach' });
  const editedAch = await call('PATCH', `/api/admin/achievements/${ach.json.data.id}`, MEMBER, { member_id: 'sample-member-2', status: 'published' });
  assert.equal(editedAch.json.data.member_id, 'sample-member-1');
  assert.equal(editedAch.json.data.status, 'draft');
});
test('achievements: draft hidden, admin publish works, draft owner hides published achievement, legacy stays public', async () => {
  const ach = await call('POST', '/api/admin/achievements', MEMBER, { title: 'Draft Ach' });
  assert.equal(ach.json.data.status, 'draft');
  let pub = await call('GET', '/api/achievements');
  assert.ok(!pub.json.data.some((a) => a.id === ach.json.data.id));
  await call('PATCH', `/api/admin/achievements/${ach.json.data.id}`, ADMIN, { status: 'published' });
  pub = await call('GET', '/api/achievements');
  assert.ok(pub.json.data.some((a) => a.id === ach.json.data.id));
  const owner = await call('POST', '/api/admin/members', ADMIN, { slug: uid('draft-owner'), full_name: 'Draft Owner', status: 'draft' });
  const owned = await call('POST', '/api/admin/achievements', ADMIN, { title: 'Owned', member_id: owner.json.data.id, status: 'published' });
  pub = await call('GET', '/api/achievements');
  assert.ok(!pub.json.data.some((a) => a.id === owned.json.data.id));
  await call('PATCH', `/api/admin/members/${owner.json.data.id}`, ADMIN, { status: 'published' });
  pub = await call('GET', '/api/achievements');
  assert.ok(pub.json.data.some((a) => a.id === owned.json.data.id));
  assert.ok(pub.json.data.some((a) => a.id === 'sample-ach-1')); // legacy, no status field
});
test('project year: set, clear via null, other fields preserved, no resurrection', async () => {
  const proj = await call('POST', '/api/admin/projects', ADMIN, { slug: uid('year'), title: 'Year', year: 2024, tagline: 'keep' });
  assert.equal(proj.json.data.year, 2024);
  const cleared = await call('PATCH', `/api/admin/projects/${proj.json.data.id}`, ADMIN, { year: null });
  assert.ok(!('year' in cleared.json.data)); assert.equal(cleared.json.data.tagline, 'keep');
  const again = await call('PATCH', `/api/admin/projects/${proj.json.data.id}`, ADMIN, { title: 'Year 2' });
  assert.ok(!('year' in again.json.data));
});
test('contact: validation, honeypot silent accept, rate limit 429', async () => {
  assert.equal((await call('POST', '/api/contact', null, { name: 'T', email: 'bad', message: 'hi' })).status, 400);
  const honey = await call('POST', '/api/contact', null, { name: 'Bot', email: 'bot@x.com', message: 'spam', website: 'http://spam' });
  assert.equal(honey.status, 200); // intentional: silently accepted, never stored
  for (let i = 0; i < 5; i++) await call('POST', '/api/contact', null, { name: 'R', email: 'rate-limit-test@x.com', message: `m${i}` });
  const sixth = await call('POST', '/api/contact', null, { name: 'R', email: 'rate-limit-test@x.com', message: 'm5' });
  assert.equal(sixth.status, 429);
});
test('upload sign: validation, unconfigured 503; verify: ownership and unconfigured 503', async () => {
  assert.equal((await call('POST', '/api/admin/upload/sign', ADMIN, { file_type: 'exe', file_size: 10, file_name: 'x.exe' })).status, 400);
  assert.equal((await call('POST', '/api/admin/upload/sign', ADMIN, { file_type: 'image', file_size: 10, file_name: 'x.jpg' })).status, 503);
  assert.equal((await call('POST', '/api/admin/upload/verify', ADMIN, { public_id: 'aict-portfolio/images/demo-admin-1', file_type: 'image' })).status, 503);
  assert.equal((await call('POST', '/api/admin/upload/verify', MEMBER, { public_id: 'aict-portfolio/images/other-1', file_type: 'image' })).status, 403);
  assert.equal((await call('POST', '/api/admin/upload/verify', ADMIN, { public_id: 'elsewhere/x', file_type: 'image' })).status, 400);
});
test('delete member: unlinks projects, removes owned achievements, keeps roles concept (demo roles empty)', async () => {
  const mem = await call('POST', '/api/admin/members', ADMIN, { slug: uid('del'), full_name: 'Del', status: 'published' });
  const proj = await call('POST', '/api/admin/projects', ADMIN, { slug: uid('del-proj'), title: 'Del Proj', member_ids: [mem.json.data.id], project_members: [{ member_id: mem.json.data.id, role_in_project: 'Lead' }] });
  await call('POST', '/api/admin/achievements', ADMIN, { title: 'Del Ach', member_id: mem.json.data.id, status: 'published' });
  assert.equal((await call('DELETE', `/api/admin/members/${mem.json.data.id}`, ADMIN)).status, 200);
  const projects = await call('GET', '/api/admin/projects', ADMIN);
  const after = projects.json.data.find((p) => p.id === proj.json.data.id);
  assert.deepEqual(after.member_ids, []); assert.deepEqual(after.project_members, []);
  const achs = await call('GET', '/api/admin/achievements', ADMIN);
  assert.ok(!achs.json.data.some((a) => a.member_id === mem.json.data.id));
  assert.equal((await call('GET', `/api/members/${mem.json.data.slug}`)).status, 404);
});
test('revisions: true restore removes post-snapshot fields; deleted record cannot be restored', async () => {
  const mem = await call('POST', '/api/admin/members', ADMIN, { slug: uid('rest'), full_name: 'Rest' });
  await call('PATCH', `/api/admin/members/${mem.json.data.id}`, ADMIN, { location: 'New City' });
  const revs = await call('GET', '/api/admin/revisions', ADMIN);
  const rev = revs.json.data.find((r) => r.entity === 'members' && r.entity_id === mem.json.data.id);
  const restored = await call('POST', `/api/admin/revisions/${rev.id}/restore`, ADMIN);
  assert.equal(restored.status, 200);
  const list = await call('GET', '/api/admin/members', ADMIN);
  const rec = list.json.data.find((m) => m.id === mem.json.data.id);
  assert.equal(rec.location, ''); // snapshot default, not 'New City'
  await call('DELETE', `/api/admin/members/${mem.json.data.id}`, ADMIN);
  const revs2 = await call('GET', '/api/admin/revisions', ADMIN);
  const delRev = revs2.json.data.find((r) => r.entity === 'members' && r.entity_id === mem.json.data.id);
  assert.equal((await call('POST', `/api/admin/revisions/${delRev.id}/restore`, ADMIN)).status, 404);
});
test('security headers present on API responses', async () => {
  const res = await fetch(base + '/api/health');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
  assert.ok((res.headers.get('content-security-policy') || '').includes("frame-ancestors 'none'"));
});
test('javascript: URLs rejected, https accepted', async () => {
  assert.equal((await call('POST', '/api/admin/members', ADMIN, { slug: uid('js'), full_name: 'JS', links: [{ type: 'github', label: 'x', url: 'javascript:alert(1)' }] })).status, 400);
  assert.equal((await call('POST', '/api/admin/members', ADMIN, { slug: uid('js'), full_name: 'JS', links: [{ type: 'github', label: 'x', url: 'https://github.com/x' }] })).status, 201);
});
test('slug format and whitespace validation', async () => {
  assert.equal((await call('POST', '/api/admin/members', ADMIN, { slug: 'Bad Slug!', full_name: 'X' })).status, 400);
  assert.equal((await call('POST', '/api/admin/members', ADMIN, { slug: uid('ws'), full_name: '   ' })).status, 400);
});
test('profile-less member cannot create projects/achievements', async () => {
  const me = await call('GET', '/api/admin/me', UNLINKED);
  assert.equal(me.json.data.role, 'member'); assert.equal(me.json.data.member_id, '');
  assert.equal((await call('POST', '/api/admin/projects', UNLINKED, { slug: uid('unlinked-proj'), title: 'Nope' })).status, 403);
  assert.equal((await call('POST', '/api/admin/achievements', UNLINKED, { title: 'Nope' })).status, 403);
  // The linked demo member still can (as a draft).
  const okProj = await call('POST', '/api/admin/projects', MEMBER, { slug: uid('linked-proj'), title: 'Linked' });
  assert.equal(okProj.status, 201); assert.equal(okProj.json.data.status, 'draft');
  await call('DELETE', `/api/admin/projects/${okProj.json.data.id}`, ADMIN);
});

test('invite link: create (admin only), validate, accept creates account, token single-use', async () => {
  assert.equal((await call('POST', '/api/admin/users/invite-link', MEMBER, { email: 'new@x.com', name: 'New' })).status, 403);
  const created = await call('POST', '/api/admin/users/invite-link', ADMIN, { email: 'linkuser@example.local', name: 'Link User', role: 'member' });
  assert.equal(created.status, 201);
  assert.ok(created.json.data.invite_link.includes('/invite?token='));
  assert.ok(!created.json.data.token_hash, 'token hash must never be returned');
  const token = created.json.data.invite_link.split('token=')[1];
  const valid = await call('GET', `/api/invite/validate?token=${token}`);
  assert.equal(valid.status, 200); assert.equal(valid.json.data.email, 'linkuser@example.local'); assert.equal(valid.json.data.role, 'member');
  assert.equal((await call('GET', '/api/invite/validate?token=deadbeefdeadbeefdeadbeefdeadbeef')).status, 404);
  assert.equal((await call('POST', '/api/invite/accept', null, { token, password: 'short' })).status, 400);
  const accepted = await call('POST', '/api/invite/accept', null, { token, password: 'linkpass123' });
  assert.equal(accepted.status, 200); assert.equal(accepted.json.data.created, true);
  assert.equal((await call('POST', '/api/invite/accept', null, { token, password: 'linkpass123' })).status, 404, 'token must be single-use');
  assert.equal((await call('GET', `/api/invite/validate?token=${token}`)).status, 404);
  // The accepted account exists in roles and cannot be re-invited by link.
  assert.equal((await call('POST', '/api/admin/users/invite-link', ADMIN, { email: 'linkuser@example.local', name: 'Again' })).status, 409);
});
test('invite link: revoke kills the link, accept takes no role/email (no escalation)', async () => {
  const created = await call('POST', '/api/admin/users/invite-link', ADMIN, { email: 'revoke@example.local', name: 'Rev' });
  const token = created.json.data.invite_link.split('token=')[1];
  const list = await call('GET', '/api/admin/users/invite-links', ADMIN);
  const row = list.json.data.find((i) => i.email === 'revoke@example.local');
  assert.ok(row && !('token_hash' in row), 'list must not leak token hashes');
  assert.equal((await call('POST', `/api/admin/users/invite-links/${row.id}/revoke`, ADMIN)).status, 200);
  assert.equal((await call('GET', `/api/invite/validate?token=${token}`)).status, 404);
  const created2 = await call('POST', '/api/admin/users/invite-link', ADMIN, { email: 'escalate@example.local', name: 'Esc', role: 'member' });
  const token2 = created2.json.data.invite_link.split('token=')[1];
  // An accept payload that tries to smuggle a role/email is now
  // rejected outright (strict schema, audit hardening): the role comes
  // from the invite record only, and a rejected accept does not claim
  // the token, so a clean accept still works afterwards.
  const smuggled = await call('POST', '/api/invite/accept', null, { token: token2, password: 'escpass123', role: 'admin', email: 'victim@x.com' });
  assert.equal(smuggled.status, 400);
  const accepted = await call('POST', '/api/invite/accept', null, { token: token2, password: 'escpass123' });
  assert.equal(accepted.status, 200);
  const users = await call('GET', '/api/admin/users', ADMIN);
  const me = users.json.data.find((u) => u.email === 'escalate@example.local');
  assert.equal(me.role, 'member');
});

test('media details: admin saves details, member cannot save details for another upload, delete and gallery fail closed without Cloudinary', async () => {
  const own = 'aict-portfolio/images/demo-member-111';
  const saved = await call('POST', '/api/admin/media/meta', ADMIN, { public_id: own, title: 'Test photo', description: 'A test caption.' });
  assert.equal(saved.status, 200); assert.equal(saved.json.data.title, 'Test photo');
  const bad = await call('POST', '/api/admin/media/meta', ADMIN, { public_id: 'elsewhere/x', title: 'Nope' });
  assert.equal(bad.status, 400);
  const foreign = await call('POST', '/api/admin/media/meta', MEMBER, { public_id: 'aict-portfolio/images/someone-else-111', title: 'Nope' });
  assert.equal(foreign.status, 403);
  const del = await call('DELETE', '/api/admin/media?public_id=' + encodeURIComponent(own), ADMIN);
  assert.equal(del.status, 503);
  const gal = await call('GET', '/api/gallery');
  assert.equal(gal.status, 503);
});

test('account delete: self 403, unknown 404, member 403, full delete removes the role row', async () => {
  assert.equal((await call('DELETE', '/api/admin/users/demo-admin', ADMIN)).status, 403);
  assert.equal((await call('DELETE', '/api/admin/users/no-such-user', ADMIN)).status, 404);
  assert.equal((await call('DELETE', '/api/admin/users/no-such-user', MEMBER)).status, 403);
  const created = await call('POST', '/api/admin/users/invite-link', ADMIN, { email: 'delme@example.local', name: 'Del Me', role: 'member' });
  assert.equal(created.status, 201);
  const token = created.json.data.invite_link.split('token=')[1];
  const accepted = await call('POST', '/api/invite/accept', null, { token, password: 'delpass123' });
  assert.equal(accepted.status, 200);
  const uid = 'demo-user-delme-example-local';
  const before = await call('GET', '/api/admin/users', ADMIN);
  assert.ok(before.json.data.some((u) => u.id === uid));
  const del = await call('DELETE', `/api/admin/users/${uid}`, ADMIN);
  assert.equal(del.status, 200); assert.equal(del.json.data.deleted, true);
  const after = await call('GET', '/api/admin/users', ADMIN);
  assert.ok(!after.json.data.some((u) => u.id === uid));
});

test('single creation path: the old admin-set-password invite endpoint is gone', async () => {
  assert.equal((await call('POST', '/api/admin/users/invite', ADMIN, { email: 'oldway@example.local', name: 'Old Way' })).status, 404);
});

test('invite link without mail configured returns the link with link_only delivery', async () => {
  const created = await call('POST', '/api/admin/users/invite-link', ADMIN, { email: 'nolinkmail@example.local', name: 'No Mail', role: 'member' });
  assert.equal(created.status, 201);
  assert.equal(created.json.data.email_delivery, 'link_only');
  assert.ok(created.json.data.invite_link.includes('/invite?token='));
});

test('upload sign: signed params exclude folder so Cloudinary cannot double the path (2026-10-30 verify 404)', async () => {
  process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
  process.env.CLOUDINARY_API_KEY = 'test-key';
  process.env.CLOUDINARY_API_SECRET = 'test-secret';
  try {
    const r = await call('POST', '/api/admin/upload/sign', ADMIN, { file_type: 'image', file_size: 10, file_name: 'x.jpg' });
    assert.equal(r.status, 200);
    const d = r.json.data;
    assert.ok(d.public_id.startsWith('aict-portfolio/images/demo-admin-'));
    assert.ok(!('folder' in d), 'sign must not return a folder for the browser to send');
    const { v2 } = await import('cloudinary');
    const expected = v2.utils.api_sign_request({ timestamp: d.timestamp, public_id: d.public_id }, 'test-secret');
    assert.equal(d.signature, expected);
  } finally {
    delete process.env.CLOUDINARY_CLOUD_NAME; delete process.env.CLOUDINARY_API_KEY; delete process.env.CLOUDINARY_API_SECRET;
  }
});

test('upload sign: raw PDF public_id carries the .pdf extension, image public_id carries none (2026-10-30 resume verify 404)', async () => {
  process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
  process.env.CLOUDINARY_API_KEY = 'test-key';
  process.env.CLOUDINARY_API_SECRET = 'test-secret';
  try {
    const pdf = await call('POST', '/api/admin/upload/sign', ADMIN, { file_type: 'pdf', file_size: 10, file_name: 'resume.pdf' });
    assert.equal(pdf.status, 200);
    assert.ok(pdf.json.data.public_id.startsWith('aict-portfolio/resumes/demo-admin-'));
    assert.ok(pdf.json.data.public_id.endsWith('.pdf'), 'raw public IDs must include the extension');
    const img = await call('POST', '/api/admin/upload/sign', ADMIN, { file_type: 'image', file_size: 10, file_name: 'x.jpg' });
    assert.equal(img.status, 200);
    assert.ok(img.json.data.public_id.startsWith('aict-portfolio/images/demo-admin-'));
    assert.ok(!img.json.data.public_id.endsWith('.jpg'), 'image public IDs must not include an extension');
  } finally {
    delete process.env.CLOUDINARY_CLOUD_NAME; delete process.env.CLOUDINARY_API_KEY; delete process.env.CLOUDINARY_API_SECRET;
  }
});

test('upload verify: raw PDF with no reported format passes when id/URL ends .pdf (2026-10-30 resume 400)', () => {
  const pdfId = 'aict-portfolio/resumes/demo-admin-123.pdf';
  // The normal case still passes.
  assert.equal(checkVerifyAsset('pdf', { format: 'pdf', bytes: 1000, resource_type: 'raw', secure_url: 'https://x/' + pdfId }, pdfId).ok, true);
  // The live failure: asset found, size fine, but no usable format reported.
  assert.equal(checkVerifyAsset('pdf', { format: '', bytes: 1000, resource_type: 'raw', secure_url: 'https://x/' + pdfId }, pdfId).ok, true);
  assert.equal(checkVerifyAsset('pdf', { format: '', bytes: 1000, resource_type: 'raw', secure_url: 'https://x/aict-portfolio/resumes/demo-admin-123.pdf' }, 'aict-portfolio/resumes/demo-admin-123').ok, true);
  // A present non-PDF format is still rejected, even with a .pdf id.
  assert.equal(checkVerifyAsset('pdf', { format: 'docx', bytes: 1000, resource_type: 'raw', secure_url: 'https://x/' + pdfId }, pdfId).ok, false);
  // A missing format on a non-raw asset is still rejected.
  assert.equal(checkVerifyAsset('pdf', { format: '', bytes: 1000, resource_type: 'image', secure_url: 'https://x/' + pdfId }, pdfId).ok, false);
  // Size still enforced for PDFs, and other types are unchanged.
  assert.equal(checkVerifyAsset('pdf', { format: 'pdf', bytes: 6 * 1024 * 1024, resource_type: 'raw', secure_url: 'https://x/' + pdfId }, pdfId).ok, false);
  assert.equal(checkVerifyAsset('image', { format: 'jpg', bytes: 1000, resource_type: 'image' }, 'aict-portfolio/images/x').ok, true);
  assert.equal(checkVerifyAsset('image', { format: 'pdf', bytes: 1000, resource_type: 'image' }, 'aict-portfolio/images/x').ok, false);
  assert.equal(checkVerifyAsset('video', { format: 'mp4', bytes: 1000, resource_type: 'video' }, 'aict-portfolio/videos/x').ok, true);
  assert.equal(checkVerifyAsset('video', { format: 'mp4', bytes: 75 * 1024 * 1024, resource_type: 'video' }, 'aict-portfolio/videos/x').ok, true, 'a 75 MB video must pass verify after the 100 MB raise');
  assert.equal(checkVerifyAsset('video', { format: 'mp4', bytes: 101 * 1024 * 1024, resource_type: 'video' }, 'aict-portfolio/videos/x').ok, false, 'a 101 MB video must still fail verify (Cloudinary free ceiling)');
});

test('project characters: created and returned on the public project (2026-10-31)', async () => {
  const slug = uid('char-proj');
  const created = await call('POST', '/api/admin/projects', ADMIN, { slug, title: 'Char Proj', status: 'published', characters: ['Narrator', 'Host'] });
  assert.equal(created.status, 201);
  assert.deepEqual(created.json.data.characters, ['Narrator', 'Host']);
  const pub = await call('GET', `/api/projects/${slug}`);
  assert.equal(pub.status, 200);
  assert.deepEqual(pub.json.data.characters, ['Narrator', 'Host']);
});

test('admin can link their OWN account to a profile, but cannot change own role/status (2026-10-31)', async () => {
  // Demo mode has no role rows by default, so PATCH would 404 before the
  // self-link rule is even reached — seed the row the route looks up.
  await store.saveRole('demo-admin', { role: 'admin', account_status: 'active', email: 'demo-admin@example.local', member_id: '' });
  const linked = await call('PATCH', '/api/admin/users/demo-admin', ADMIN, { member_id: 'sample-member-2' });
  assert.equal(linked.status, 200);
  assert.equal(linked.json.data.member_id, 'sample-member-2');
  assert.equal((await call('PATCH', '/api/admin/users/demo-admin', ADMIN, { role: 'member' })).status, 403);
  assert.equal((await call('PATCH', '/api/admin/users/demo-admin', ADMIN, { account_status: 'deactivated' })).status, 403);
  const unlinked = await call('PATCH', '/api/admin/users/demo-admin', ADMIN, { member_id: '' });
  assert.equal(unlinked.status, 200);
  assert.equal(unlinked.json.data.member_id, '');
  await store.deleteRole('demo-admin');
});

test('resume proxy: public-id parsing and signed URL shape (2026-10-31)', async () => {
  assert.equal(resumePublicIdFromUrl('https://res.cloudinary.com/ddbi7moq/raw/upload/v1793442487/aict-portfolio/resumes/uid-123.pdf'), 'aict-portfolio/resumes/uid-123.pdf');
  assert.equal(resumePublicIdFromUrl('https://res.cloudinary.com/ddbi7moq/raw/upload/aict-portfolio/resumes/uid-123.pdf'), 'aict-portfolio/resumes/uid-123.pdf');
  assert.equal(resumePublicIdFromUrl('https://example.com/not-cloudinary.pdf'), null);
  assert.equal(resumePublicIdFromUrl('not a url'), null);
  const { v2: cloudinary } = await import('cloudinary');
  cloudinary.config({ cloud_name: 'testcloud', api_key: 'testkey', api_secret: 'testsecret', secure: true });
  const signed = signedResumeUrl(cloudinary, 'aict-portfolio/resumes/uid-123.pdf', 'authenticated', false, 'Muhammad Bakhtawar', 1793442487);
  assert.match(signed, /^https:\/\/res\.cloudinary\.com\/testcloud\/raw\/authenticated\/s--[^/]+\/v1793442487\/aict-portfolio\/resumes\/uid-123\.pdf(\?.*)?$/);
  const dl = signedResumeUrl(cloudinary, 'aict-portfolio/resumes/uid-123.pdf', 'upload', true, 'Muhammad Bakhtawar');
  assert.match(dl, /fl_attachment:Muhammad-Bakhtawar-CV(?!\.)/);
});
test('resume proxy: unknown member 404s; demo member without Cloudinary env falls back to stored URL (2026-10-31)', async () => {
  assert.equal((await call('GET', '/api/members/no-such-member/resume')).status, 404);
  await store.saveMember('test-resume-member', { slug: 'test-resume-member', full_name: 'Test Resume', status: 'published', resume_path: 'https://res.cloudinary.com/test/raw/upload/v1/aict-portfolio/resumes/test-1.pdf', resume_is_public: true });
  const r = await fetch(base + '/api/members/test-resume-member/resume', { redirect: 'manual' });
  assert.equal(r.status, 302);
  assert.equal(r.headers.get('location'), 'https://res.cloudinary.com/test/raw/upload/v1/aict-portfolio/resumes/test-1.pdf');
  await store.deleteMember('test-resume-member');
});

test('video uploads: only Group Leader and admins (2026-10-31)', async () => {
  // Demo member (sample-member-1) is not the leader by default.
  assert.equal((await call('POST', '/api/admin/upload/sign', MEMBER, { file_type: 'video', file_size: 10, file_name: 'x.mp4' })).status, 403);
  assert.equal((await call('POST', '/api/admin/upload/sign', ADMIN, { file_type: 'video', file_size: 10, file_name: 'x.mp4' })).status, 503); // passes the gate, no Cloudinary env in this suite
  assert.equal((await call('POST', '/api/admin/projects', MEMBER, { slug: uid('vid'), title: 'Vid', category: 'AI Video', video_url: 'https://example.com/v.mp4' })).status, 403);
  // Promote the demo member to leader: the same calls must now pass the gate.
  await call('PATCH', '/api/admin/members/sample-member-1', ADMIN, { is_leader: true });
  assert.equal((await call('POST', '/api/admin/upload/sign', MEMBER, { file_type: 'video', file_size: 10, file_name: 'x.mp4' })).status, 503);
  const created = await call('POST', '/api/admin/projects', MEMBER, { slug: uid('leader-vid'), title: 'Leader Vid', category: 'AI Video', video_url: 'https://example.com/v.mp4' });
  assert.equal(created.status, 201); assert.equal(created.json.data.status, 'draft'); // leader still needs admin publish (unchanged rule)
  await call('DELETE', `/api/admin/projects/${created.json.data.id}`, ADMIN);
  await call('PATCH', '/api/admin/members/sample-member-1', ADMIN, { is_leader: false });
  // Photos/resumes stay open to ordinary members.
  assert.equal((await call('POST', '/api/admin/upload/sign', MEMBER, { file_type: 'image', file_size: 10, file_name: 'x.jpg' })).status, 503);
});

test('project visibility: public listed, unlisted link-only, private forced draft; tags persist', async () => {
  const pub = await call('POST', '/api/admin/projects', ADMIN, { slug: uid('vis-pub'), title: 'Vis Pub', category: 'AI Video', video_url: 'https://example.com/v.mp4', visibility: 'public', status: 'published', tags: ['alpha', 'beta'] });
  assert.equal(pub.status, 201);
  const unl = await call('POST', '/api/admin/projects', ADMIN, { slug: uid('vis-unl'), title: 'Vis Unl', category: 'AI Video', video_url: 'https://example.com/v.mp4', visibility: 'unlisted', status: 'published', tags: ['gamma'] });
  assert.equal(unl.status, 201);
  const priv = await call('POST', '/api/admin/projects', ADMIN, { slug: uid('vis-priv'), title: 'Vis Priv', category: 'AI Video', video_url: 'https://example.com/v.mp4', visibility: 'private', status: 'published' });
  assert.equal(priv.status, 201); assert.equal(priv.json.data.status, 'draft');
  const list = await call('GET', '/api/projects');
  assert.ok(list.json.data.some((x) => x.slug === pub.json.data.slug));
  assert.ok(!list.json.data.some((x) => x.slug === unl.json.data.slug));
  assert.ok(!list.json.data.some((x) => x.slug === priv.json.data.slug));
  const unlDetail = await call('GET', `/api/projects/${unl.json.data.slug}`);
  assert.equal(unlDetail.status, 200); assert.deepEqual(unlDetail.json.data.tags, ['gamma']);
  const privDetail = await call('GET', `/api/projects/${priv.json.data.slug}`);
  assert.equal(privDetail.status, 404);
  await call('DELETE', `/api/admin/projects/${pub.json.data.id}`, ADMIN);
  await call('DELETE', `/api/admin/projects/${unl.json.data.id}`, ADMIN);
  await call('DELETE', `/api/admin/projects/${priv.json.data.id}`, ADMIN);
});

test('leader member project goes live at once; non-leader member stays draft; leader private still draft (2026-10-31)', async () => {
  const before = await store.memberById('sample-member-1');
  const wasLeader = before?.is_leader;
  try {
    await store.saveMember('sample-member-1', { ...before, is_leader: true });
    const live = await call('POST', '/api/admin/projects', MEMBER, { slug: uid('leader-live'), title: 'Leader Live', category: 'AI Video', video_url: 'https://example.com/v.mp4', status: 'published' });
    assert.equal(live.status, 201); assert.equal(live.json.data.status, 'published');
    const priv = await call('POST', '/api/admin/projects', MEMBER, { slug: uid('leader-priv'), title: 'Leader Private', category: 'AI Video', video_url: 'https://example.com/v.mp4', status: 'published', visibility: 'private' });
    assert.equal(priv.json.data.status, 'draft');
  } finally {
    await store.saveMember('sample-member-1', { ...before, is_leader: wasLeader ?? false });
  }
  const draft = await call('POST', '/api/admin/projects', MEMBER, { slug: uid('member-draft'), title: 'Member Draft', status: 'published' });
  assert.equal(draft.json.data.status, 'draft');
});

test('project video_format: short persists, full is the default, bogus value 400s (2026-10-31)', async () => {
  const short = await call('POST', '/api/admin/projects', ADMIN, { slug: uid('short-vid'), title: 'Short Vid', category: 'AI Video', video_url: 'https://example.com/s.mp4', video_format: 'short', status: 'published' });
  assert.equal(short.status, 201); assert.equal(short.json.data.video_format, 'short');
  const def = await call('POST', '/api/admin/projects', ADMIN, { slug: uid('full-vid'), title: 'Full Vid', category: 'AI Video', video_url: 'https://example.com/f.mp4', status: 'published' });
  assert.equal(def.json.data.video_format, 'full');
  const bad = await call('POST', '/api/admin/projects', ADMIN, { slug: uid('bad-fmt'), title: 'Bad Fmt', video_format: 'vertical', status: 'published' });
  assert.equal(bad.status, 400);
});

// ---- Audit hardening regressions (2026-10-31) ----

test('audit: concurrent invite accepts — exactly one succeeds', async () => {
  const created = await call('POST', '/api/admin/users/invite-link', ADMIN, { email: 'race@example.local', name: 'Race', role: 'member' });
  assert.equal(created.status, 201);
  const token = created.json.data.invite_link.split('token=')[1];
  const [a, b] = await Promise.all([
    call('POST', '/api/invite/accept', null, { token, password: 'racepass123' }),
    call('POST', '/api/invite/accept', null, { token, password: 'racepass123' }),
  ]);
  const okCount = [a, b].filter((r) => r.status === 200).length;
  assert.equal(okCount, 1);
  assert.ok([a, b].some((r) => r.status === 404));
});

test('audit: demo tokens rejected and public content fails closed in deployed env', async () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    assert.equal((await call('GET', '/api/admin/me', ADMIN)).status, 401);
    assert.equal((await call('GET', '/api/members')).status, 503);
  } finally {
    if (prev === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = prev;
  }
  // Restored: demo mode works again locally.
  assert.equal((await call('GET', '/api/admin/me', ADMIN)).status, 200);
});

test('audit: javascript/data URLs rejected in photo, cover, logo and social fields', async () => {
  assert.equal((await call('POST', '/api/admin/members', ADMIN, { slug: uid('badurl'), full_name: 'Bad', photo_url: 'javascript:alert(1)' })).status, 400);
  assert.equal((await call('POST', '/api/admin/members', ADMIN, { slug: uid('badurl2'), full_name: 'Bad', cover_url: 'data:text/html,<script>' })).status, 400);
  assert.equal((await call('PATCH', '/api/admin/settings', ADMIN, { group_name: 'AICT Group', logo_url: 'javascript:alert(1)' })).status, 400);
  assert.equal((await call('PATCH', '/api/admin/settings', ADMIN, { group_name: 'AICT Group', social_links: { github: 'javascript:alert(1)' } })).status, 400);
  const good = await call('POST', '/api/admin/members', ADMIN, { slug: uid('goodurl'), full_name: 'Good', photo_url: 'https://example.com/p.jpg', cover_url: '/logo.svg' });
  assert.equal(good.status, 201);
  await call('DELETE', `/api/admin/members/${good.json.data.id}`, ADMIN);
});

test('audit: member cannot set featured, sort_order or visibility on project PATCH', async () => {
  const proj = await call('POST', '/api/admin/projects', MEMBER, { slug: uid('priv'), title: 'Priv' });
  const edited = await call('PATCH', `/api/admin/projects/${proj.json.data.id}`, MEMBER, { featured: true, sort_order: 99, visibility: 'unlisted', title: 'Priv2' });
  assert.equal(edited.json.data.featured, false);
  assert.equal(edited.json.data.sort_order, 0);
  assert.equal(edited.json.data.visibility, 'public');
  assert.equal(edited.json.data.title, 'Priv2');
  await call('DELETE', `/api/admin/projects/${proj.json.data.id}`, ADMIN);
});

test('audit: profile link collision returns 409 for the second account', async () => {
  await store.saveRole('audit-user-a', { role: 'member', account_status: 'active', email: 'a@example.local', member_id: '' });
  await store.saveRole('audit-user-b', { role: 'member', account_status: 'active', email: 'b@example.local', member_id: '' });
  try {
    assert.equal((await call('PATCH', '/api/admin/users/audit-user-a', ADMIN, { member_id: 'sample-member-2' })).status, 200);
    assert.equal((await call('PATCH', '/api/admin/users/audit-user-b', ADMIN, { member_id: 'sample-member-2' })).status, 409);
  } finally {
    await store.deleteRole('audit-user-a'); await store.deleteRole('audit-user-b');
  }
});

test('audit: deletes of missing records return 404', async () => {
  assert.equal((await call('DELETE', '/api/admin/members/nope-123', ADMIN)).status, 404);
  assert.equal((await call('DELETE', '/api/admin/projects/nope-123', ADMIN)).status, 404);
  assert.equal((await call('DELETE', '/api/admin/achievements/nope-123', ADMIN)).status, 404);
  assert.equal((await call('DELETE', '/api/admin/messages/nope-123', ADMIN)).status, 404);
});

test('audit: upload owner parsing is exact, not a substring match', async () => {
  const { assetOwnerUid, isOwnAsset } = await import('../src/ownership.js');
  assert.equal(assetOwnerUid('aict-portfolio/images/demo-admin-1234567890'), 'demo-admin');
  assert.equal(assetOwnerUid('aict-portfolio/resumes/demo-admin-1234567890.pdf'), 'demo-admin');
  assert.equal(assetOwnerUid('aict-portfolio/images/demo-1234567890'), 'demo');
  assert.equal(isOwnAsset({ role: 'member', uid: 'demo' }, 'aict-portfolio/images/demo-admin-123'), false);
  assert.equal(isOwnAsset({ role: 'member', uid: 'demo-admin' }, 'aict-portfolio/images/demo-admin-123'), true);
});

test('audit: resume proxy never redirects to an external URL', async () => {
  await store.saveMember('test-ext-resume', { slug: 'test-ext-resume', full_name: 'Ext Resume', status: 'published', resume_path: 'https://example.com/evil.pdf', resume_is_public: true });
  try {
    const r = await fetch(base + '/api/members/test-ext-resume/resume', { redirect: 'manual' });
    assert.equal(r.status, 404);
  } finally { await store.deleteMember('test-ext-resume'); }
});

test('audit: CORS origins are normalised (no trailing slash, no wildcard) and bad JSON is 400', async () => {
  const { corsOrigins } = await import('../src/app.js');
  const prev = process.env.CORS_ORIGIN;
  process.env.CORS_ORIGIN = 'https://aictportfollio.netlify.app/,*,,';
  try { assert.deepEqual(corsOrigins(), ['https://aictportfollio.netlify.app']); }
  finally { if (prev === undefined) delete process.env.CORS_ORIGIN; else process.env.CORS_ORIGIN = prev; }
  const res = await fetch(base + '/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{not json' });
  assert.equal(res.status, 400);
});
