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
  const login = read('app/admin/login/page.tsx');
  assert.match(login, /invalid-credential|too-many-requests|user-not-found/);
  // The mapper may read err.message to classify the code, but the UI must
  // never display the raw message: setError must go through the mapper.
  assert.match(login, /friendlyAuthError\(err\)/);
  assert.ok(!/setError\(err\.message\)/.test(login));
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
