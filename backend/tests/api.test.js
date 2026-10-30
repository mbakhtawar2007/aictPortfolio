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
const ADMIN = 'demo-admin-token'; const MEMBER = 'demo-member-token';
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
test.skip('profile-less member cannot create projects/achievements (needs an unlinked demo identity)', async () => {
  // Demo mode only ships two fixed tokens (linked admin/member); there is
  // no unlinked member token, so this guard is verified by code inspection
  // of the profile-less 403 in routes/admin.js, not by this suite.
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
  // Even if the accept payload tries to smuggle a role, it is ignored: the
  // endpoint schema has no role field, and the role comes from the invite.
  const accepted = await call('POST', '/api/invite/accept', null, { token: token2, password: 'escpass123', role: 'admin', email: 'victim@x.com' });
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
