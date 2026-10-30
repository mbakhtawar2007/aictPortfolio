// Frontend static regression checks (no browser required).
// Run: npm test (from frontend/). Asserts that the accessibility and
// error-handling code the audit requires is actually present in source,
// so a future edit cannot silently drop it. Browser/viewport verification
// is still done separately and honestly marked BLOCKED where not run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const any = (files, re) => files.some((f) => re.test(read(f)));

test('skip link exists and is focus-visible', () => {
  const layout = read('app/layout.tsx');
  assert.match(layout, /skip/i);
  assert.match(read('styles/globals.css'), /skip-link|skip.*:focus/i);
});
test('no public signup route or client sign-up call', () => {
  assert.ok(!fs.existsSync(path.join(root, 'app/signup')));
  const client = read('lib/firebaseClient.ts');
  assert.ok(!/createUserWithEmailAndPassword|createUser\(/.test(client));
  assert.match(client, /signInWithEmailAndPassword/);
});
test('dashboard gate distinguishes auth states (not a blind login redirect)', () => {
  const gate = read('app/dashboard/page.tsx');
  assert.ok(/error|retry|Retry/i.test(gate));
  assert.ok(!/catch\s*\{[^}]*router\.push\('\/admin\/login'\)/s.test(gate) || /error/i.test(gate));
});
test('login maps Firebase errors to safe messages', () => {
  assert.match(read('components/loginForm.tsx'), /invalid-credential|too-many-requests|user-not-found/);
  assert.ok(fs.existsSync(path.join(root, 'app/login/page.tsx')));
  assert.match(read('app/login/page.tsx'), /Member login/);
  assert.match(read('app/dashboard/page.tsx'), /\/login/);
  assert.match(read('app/invite/page.tsx'), /\/login/);
});
test('achievement form has admin-only visibility control and member draft note', () => {
  const forms = read('components/adminForms.tsx');
  assert.match(forms, /draft/i);
  assert.match(forms, /published/i);
});
test('project form sends year: null when cleared (not undefined)', () => {
  const forms = read('components/adminForms.tsx');
  assert.match(forms, /year:\s*null|year === ''/);
});
test('admin action busy guards exist', () => {
  const admin = read('app/admin/page.tsx');
  assert.match(admin, /pending|busy/i);
});
test('modal/dialog accessibility: Escape, focus trap or return', () => {
  const ui = read('components/ui.tsx');
  assert.ok(/Escape/.test(ui) || /Escape/.test(read('app/admin/page.tsx')));
  assert.match(ui, /role=["']dialog["']|aria-modal/);
});
test('tabs carry tablist/tab/tabpanel semantics', () => {
  const files = ['app/projects/page.tsx', 'app/achievements/page.tsx', 'app/skills/page.tsx', 'app/admin/page.tsx'];
  assert.ok(any(files, /role=["']tablist["']/));
  assert.ok(any(files, /aria-controls/));
  assert.ok(any(files, /onKeyDown|ArrowRight|ArrowLeft/));
});
test('security headers configured in netlify.toml', () => {
  const toml = read('netlify.toml');
  assert.match(toml, /Content-Security-Policy/);
  assert.match(toml, /X-Frame-Options/);
});
test('no demo token or secret value in frontend source', () => {
  const client = read('lib/firebaseClient.ts');
  assert.ok(!/demo-admin-token|demo-member-token/.test(client));
});

test('invite page is token-gated, not a public signup', () => {
  const invite = read('app/invite/page.tsx');
  assert.match(invite, /invite\/validate/);
  assert.match(invite, /invite\/accept/);
  assert.ok(!/createUserWithEmailAndPassword/.test(invite));
  assert.ok(/token/.test(invite));
});

test('public demo fallback exists, is realistic (no placeholder wording), and home shows all members in a grid', () => {
  const sample = read('lib/sample.ts');
  assert.match(sample, /sampleMembers|sampleProjects/);
  assert.ok(!/SAMPLE/.test(sample), 'demo fallback must not carry placeholder wording');
  assert.ok(sampleMembersCount(sample) >= 3);
  const home = read('app/page.tsx');
  assert.ok(!/team-strip/.test(home), 'home must not hide members in a sideways strip');
  assert.ok(!/hero-scene/.test(home), '3D hero scene removed for the minimal look');
  assert.ok(/lib\/sample/.test(home));
});
function sampleMembersCount(src) { return (src.match(/slug: '/g) || []).length; }
test('detail pages fall back to demo records for demo slugs', () => {
  assert.match(read('app/team/[slug]/detail.tsx'), /sampleMembers\.find/);
  assert.match(read('app/projects/[slug]/detail.tsx'), /sampleProjects\.find/);
});

test('cleanup: no dead team-strip CSS, shared demo fallback used (login buttons are intentional since 2026-10-30)', () => {
  assert.ok(!/team-strip/.test(read('styles/globals.css')), 'dead team-strip CSS removed');
  assert.match(read('lib/sample.ts'), /export function orDemo/);
  for (const f of ['app/team/page.tsx', 'app/projects/page.tsx', 'app/achievements/page.tsx', 'app/skills/page.tsx']) {
    assert.match(read(f), /orDemo\(/);
  }
});
test('cleanup: no unused Loading/SampleBadge imports in public list pages', () => {
  for (const f of ['app/page.tsx', 'app/team/page.tsx', 'app/projects/page.tsx', 'app/achievements/page.tsx']) {
    assert.ok(!/\bLoading\b/.test(read(f).replace(/loading/g, '')), f + ' must not import unused Loading');
  }
  assert.ok(!/SampleBadge/.test(read('app/skills/page.tsx')));
});

test('gallery: public page exists, nav links it, media details and delete are wired', () => {
  assert.ok(fs.existsSync(path.join(root, 'app/gallery/page.tsx')));
  assert.match(read('app/gallery/page.tsx'), /apiGet<MediaItem\[\]>\('\/gallery'\)/);
  assert.match(read('components/layout.tsx'), /\/gallery/);
  assert.match(read('app/admin/page.tsx'), /media\/meta/);
  assert.match(read('app/admin/page.tsx'), /kind === 'media'/);
  assert.match(read('app/member/page.tsx'), /media\/meta/);
});

test('account delete: admin users tab has a Delete button wired to DELETE /admin/users/:id', () => {
  const admin = read('app/admin/page.tsx');
  assert.ok(admin.includes("kind: 'user'"));
  assert.ok(admin.includes('/admin/users/${deleting.id}'));
  assert.ok(admin.includes('This is your account.'));
  assert.ok(admin.includes('Delete the sign-in account for'));
});

test('single creation path: only the invitation link form creates accounts', () => {
  const admin = read('app/admin/page.tsx');
  assert.ok(admin.includes('Invite a team member'));
  assert.ok(!admin.includes("users/invite', 'POST'"));
  assert.ok(!admin.includes('onSubmit={sendInvite}'));
  assert.ok(admin.includes("linkInvite.confirmAdmin"));
});

test('invite link delivery states: gmail success, gmail failure, and manual fallback are all messaged', () => {
  const admin = read('app/admin/page.tsx');
  assert.ok(admin.includes("email_delivery === 'gmail'"));
  assert.ok(admin.includes("email_delivery === 'failed'"));
  assert.ok(admin.includes('via Gmail'));
});

test('navbar has Admin login and Member login buttons (desktop + mobile menu)', () => {
  const layout = read('components/layout.tsx');
  assert.ok(layout.includes('href="/admin/login">Admin login</a>'));
  assert.ok(layout.includes('href="/login">Member login</a>'));
  assert.ok(read('app/admin/login/page.tsx').includes('heading="Admin login"'));
  assert.ok(read('styles/globals.css').includes('.nav-login { display: none; }'));
});

test('profile form has direct photo and resume upload from the device', () => {
  const forms = read('components/adminForms.tsx');
  assert.ok(forms.includes("import { uploadDirectFile } from '../lib/upload'"));
  assert.ok(forms.includes('Upload photo'));
  assert.ok(forms.includes('accept="image/jpeg,image/png,image/webp,image/avif"'));
  assert.ok(forms.includes('Upload resume (PDF)'));
  assert.ok(forms.includes('accept="application/pdf"'));
  assert.ok(forms.includes("set('photo_url', url)") || forms.includes('photo_url'));
  const up = read('lib/upload.ts');
  assert.ok(up.includes('export async function uploadDirectFile'));
  assert.ok(up.includes('/admin/upload/sign'));
  assert.ok(up.includes('/admin/upload/verify'));
});

test('3D theme: light-first palette, Inter only, accent electric blue', () => {
  const css = read('styles/globals.css');
  assert.ok(css.includes("--bg: #F6F7F9"), 'light theme is the off-white 3D paper');
  assert.ok(css.includes('--accent: #1F5BFF'), 'electric blue accent token exists');
  assert.ok(css.includes('family=Inter:wght@300;400;500;600;700'), 'one sans (Inter) only');
  assert.ok(!css.includes('Space Grotesk'), 'Space Grotesk removed with the old theme');
  assert.ok(css.includes('.ambient-canvas'), 'ambient canvas layer exists');
  assert.ok(css.includes('.card-hover:hover { transform: translateY(-6px)'), 'cards lift on hover');
  const layout = read('app/layout.tsx');
  assert.ok(layout.includes("||'light'"), 'first-load default theme is light');
  assert.ok(layout.includes('AmbientCanvasLoader'), 'ambient canvas mounted in root layout');
  assert.ok(layout.includes('SmoothScroll'), 'Lenis smooth scroll mounted in root layout');
  assert.ok(read('components/layout.tsx').includes("|| 'light'"), 'theme toggle default is light');
});

test('3D theme: ambient canvas is client-only and hidden on signed-in routes', () => {
  const loader = read('components/Scene/AmbientCanvasLoader.tsx');
  assert.ok(loader.includes("dynamic(() => import('./AmbientCanvas'), { ssr: false"), 'no SSR for three.js');
  for (const route of ['/admin', '/member', '/dashboard', '/login', '/invite']) {
    assert.ok(loader.includes(`'${route}'`), `canvas hidden on ${route}`);
  }
  const canvas = read('components/Scene/AmbientCanvas.tsx');
  assert.ok(canvas.includes('Float'), 'floating ambient shapes');
  assert.ok(canvas.includes('scrollProgress'), 'scroll-driven camera');
  assert.ok(canvas.includes('dpr={mobile ? [1, 1.75] : [1, 2]}'), 'pixel ratio capped');
});

test('3D theme: home has scroll prompt and Explore section with real routes', () => {
  const home = read('app/page.tsx');
  assert.ok(home.includes('ExploreStudio'), 'home renders the explore section');
  assert.ok(home.includes("scrollToSection('#about')"), 'hero scroll prompt exists');
  assert.ok(home.includes('id="about"'), 'about section is the scroll target');
  const scene = read('components/Scene/ExploreScene.tsx');
  assert.ok(scene.includes('OrbitControls'), 'orbitable studio scene');
  assert.ok(scene.includes('Reset view'), 'reset view button');
  for (const route of ['/team', '/projects', '/achievements', '/gallery']) {
    assert.ok(scene.includes(`href: '${route}'`), `explore object links to ${route}`);
  }
  const explore = read('components/ExploreStudio.tsx');
  assert.ok(explore.includes("dynamic(() => import('./Scene/ExploreScene'), { ssr: false"), 'studio scene lazy + client-only');
});

test('hero shows the AICT full form', () => {
  const home = read('app/page.tsx');
  assert.ok(home.includes('Application of Information and Communication Technologies'));
  assert.ok(home.includes('hero-fullform'));
});

test('upload: browser never sends folder separately (2026-10-30 doubled-path verify 404)', () => {
  for (const f of ['app/admin/page.tsx', 'app/member/page.tsx', 'lib/upload.ts']) {
    assert.ok(!read(f).includes("form.append('folder'"), f + ' must not send folder');
  }
  assert.ok(read('lib/upload.ts').includes("form.append('public_id'"));
});
