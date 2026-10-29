# AICT Group Portfolio — Testing Report (audit 2026-10-29)

## Commands executed
- Live safe reads (curl, read-only): backend /api/health, /api/site, /api/members, /api/projects, /api/achievements, /api/admin/me, /api/auth/register; frontend /, /team, /projects, /admin/login, /member, /dashboard, /team/sample-ayesha-khan, /team/does-not-exist-xyz, /projects/does-not-exist-xyz, /nonexistent-page-xyz.
- Demo backend: DEMO_MODE=true FIREBASE_ENABLED=false PORT=4002 node src/server.js (localhost only, in-memory, no production contact).
- Demo API harness (Python, ad hoc, not committed): 42 checks, then an 11-check regression harness after fixes.
- node --check backend/src/routes/admin.js — pass.
- npm run build (frontend) — pass, 16 pages (14 + /dashboard + /member), before and after fixes.

## Results
- Demo API, first run: 39/42 raw passes. Two apparent failures were test bugs, not app bugs: (a) contact honeypot returning 200 is the intentional silent-accept design; (b) upload-sign with the wrong field name (kind instead of file_type) returns 400, while the correct schema returns 503 upload_unavailable as designed. Corrected first-run score: 41/42. The one real failure was duplicate slugs (BUG-03), plus the self-publish bypasses found by targeted follow-up tests (BUG-01, BUG-02, BUG-04, BUG-05, BUG-06).
- Demo API, regression after fixes: 11/11 pass (duplicate slugs 409 x2, member cannot publish draft, draft hidden publicly, member POST project forced draft, member project not public, member PATCH project status+membership stripped, PATCH unknown member 404, PATCH to another slug 409, PATCH to own slug 200, achievement member_id preserved).
- Live safe reads: 17/17 as expected (health 200 firebase/demo:false, public lists [], site null, /admin/me 401, register 404, frontend routes 200, unknown detail slugs 200 via rewrite, unknown top-level path 404).
- Frontend build: pass, 16 pages.
- Third-pass regression (data-integrity fixes): 9/9 demo checks pass (bad slug 400, whitespace name 400, timestamps present, PATCH full record, PATCH unknown user 404, unlinked achievements excluded, restore deleted 404, delete revision snapshot, plus frontend build).
- Second-pass regression (after security-review fixes): 6/6 demo checks pass (javascript: link 400, https link 201, member POST membership forced, revoke own 403, resend honest not_configured, javascript: repo_url 400) + 1 invite/resend flow check (invite 201, resend 200 resent False not_configured, re-invite honest flag).
- Unit tests: NONE — no test script exists in either package.json, and no test framework is installed. No unit/integration/E2E suite was run because none exists.
- Lint: NONE — no lint script exists.
- TypeScript: covered implicitly by `next build` (type checking runs during build); no standalone tsc run was recorded.
- Lighthouse: NOT measured (no browser run in this pass). No scores are claimed.
- Browser coverage: NONE in this pass (Chromium/Firefox/WebKit not run). Responsive/accessibility findings are code risks only.
- npm audit: NOT run (registry-blocked in this environment in prior sessions; do not treat as pass).

## Tests NOT performed (blocked)
- Real Firebase invite -> first login -> activation, deactivation live denial, password reset email delivery (needs a real test account + email; not created without approval).
- Live Cloudinary upload (valid, renamed, oversized, corrupt files) — needs a real file + live media; not run against production.
- Live contact form submission — deliberately not submitted to production (would create a real message + optional email).
- Live CRUD against production Firestore — deliberately not done (production data must not be destroyed or overwritten).
- Viewport rendering at 320/360/375/390/430/768/1024/1280/1440/1920px, keyboard-only flows, screen-reader flows, cross-browser runs.
- Firestore rules live test (browser SDK direct read attempt) — code says deny-all and no client Firestore code exists; a live attempt would need a signed-in browser session and was not run.

## Failures and blockers summary
- Failures found and fixed: BUG-01..BUG-07 (see BUG_REPORT.md), retested 11/11.
- Failures documented, not fixed: BUG-10..BUG-20 (design decisions or P3 items; see BUG_REPORT.md for rationale).
- Blockers: live auth, live upload, live email, browser/viewport/Lighthouse, production writes — all listed above with the reason.

## Final upgrade test evidence (2026-10-29)
- Backend suite `backend/tests/api.test.js` via `npm test`: **16 pass, 1 skipped** (profile-less guard, no unlinked demo identity), 0 fail. Covers: public lists, no-signup, auth matrix, self-publish blocks, slug 409, enumeration 404, achievement draft/publish + visibility, year clearing, contact validation/honeypot/429, upload sign/verify config paths, delete integrity, true restore, security headers, javascript: URLs, slug format/whitespace.
- Frontend static suite `frontend/tests/static.test.js` via `npm test`: **11 pass, 0 fail**. Covers: skip link, no-signup, dashboard gate, login error mapping, achievement visibility UI, year null, busy guards, modal semantics, tabs semantics, Netlify headers, no demo tokens in frontend source.
- Backend lint (`npm run lint`, node --check on all backend sources): pass. Frontend typecheck (`tsc --noEmit`): pass. Frontend production build: pass, 16 pages.
- Ad-hoc demo harness (ports 4002–4005, earlier in this audit): 42-check first run (41/42 corrected), 11/11 first-pass regression, 6/6 second-pass, 9/9 third-pass, plus the final-upgrade manual demo checks for BUG-10..14, delete, restore and contact limiting (all pass except the two noted code-only items).
- NOT run (blocked, honestly): browser/viewport testing at 320–1920px, keyboard/screen-reader flows, cross-browser, Lighthouse, live Firebase first-login, live Cloudinary upload/verify, live contact submission, live destructive CRUD, npm audit (registry-blocked in this environment in prior sessions).
