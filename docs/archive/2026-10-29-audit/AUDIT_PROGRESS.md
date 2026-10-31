# AICT Group Portfolio — Audit Progress Log (2026-10-29)

Local audit only. Nothing in this log was pushed or deployed. Production writes were never made.

## Phases completed
- Phase 1 Discovery + baseline: repo map, live safe reads (backend + frontend), secret/signup greps, frontend build (16 pages).
- Phase 2 Button/link/form audit: code inspection of every page/form (frontend subagent) + demo-mode API tracing. No orphan buttons found; gaps listed in BUG_REPORT.md.
- Phase 3 Business logic: publish/unpublish, slug, linking, revision, achievement/project/member rules — verified in demo mode.
- Phase 4 Auth/authorization: permission matrix tested in demo mode (public, unauthenticated, admin, member) + live 401/404 checks.
- Phase 5 API contract: 42 demo-mode API checks + 17 live safe-read checks.
- Phase 6 Database integrity: demo in-memory CRUD; production Firestore never written.
- Phase 7 Security: code audit + live CORS/401/404 checks; secret scan by name (no values recorded).
- Phase 8 Uploads: upload-sign validated with correct schema (503 without Cloudinary env, 400 for bad type); live Cloudinary upload NOT tested (needs real credentials + a real file, blocked).
- Phase 9 UI/UX: code audit only; no browser viewport rendering was run in this pass.
- Phase 10 Responsiveness/accessibility: code audit only — NOT visually verified at 320–1920px, no Lighthouse, no cross-browser run.
- Phase 11 Routing: live status checks confirm Netlify rewrites for /team/* and /projects/* (200 for unknown slugs, 404 for unknown top-level paths).
- Phase 12 Failure handling: 401/403/404/400/503 paths tested in demo mode; public pages swallow some fetch errors (see BUG_REPORT.md).
- Phase 13 Performance: build output inspected; no Lighthouse scores measured (none claimed).
- Phase 14 Automated tests: no test framework exists in the repo (no test script in either package.json). Demo-mode API scripts were run ad hoc (see TESTING_REPORT.md) and are not committed as a test suite.
- Phase 15 User journeys: A (public, read-only, live + demo), B (admin, demo only), C/D (member, demo only), E (unauthorized, demo + live reads), F (publish/unpublish, demo), G (deactivation, code only — BLOCKED for live), H (failure, demo), I (responsive, code only).
- Phase 16 Demo/production separation: demo tokens only work with DEMO_MODE=true + Firebase off; live /api/health reports demo:false.
- Phase 17 Code quality: see AUDIT_REPORT.md.
- Phase 18 Bug tracking + fixes: 6 fixes implemented locally, 11/11 regression checks pass (demo mode).
- Phase 19/20 Reports + regression: this file set; frontend build passes after fixes.

## Files modified (local only, NOT pushed)
- backend/src/routes/admin.js — duplicate-slug 409, member publish/membership/ownership stripping, PATCH unknown member 404, invite profile-existence check.
- frontend/app/admin/page.tsx — aria-labels on the three admin search inputs.
- frontend/app/team/[slug]/detail.tsx, frontend/app/projects/[slug]/detail.tsx — Back link on the error branch.

## Commands executed
- Live curl reads (backend health/site/members/projects/achievements/me/register; frontend routes incl. unknown slugs).
- Demo backend on localhost:4002 (DEMO_MODE=true, FIREBASE_ENABLED=false) + Python API harnesses (42 checks, then 11 regression checks).
- `node --check backend/src/routes/admin.js` — pass.
- `npm run build` (frontend) — pass, 16 pages.
- No `npm audit`, no lint script exists, no test script exists.

## Current blockers
- Live Firebase auth (real member login, activation, deactivation) — needs a real invited test account; not created without user approval.
- Live Cloudinary upload — needs real Cloudinary env (already on Vercel) + a test file; not run against production.
- Live email delivery (Resend / Firebase setup email) — not tested; Resend is not configured on the backend in practice.
- Browser/viewport/Lighthouse/cross-browser verification — not run.
- Production writes of any kind — deliberately not done.

## Second pass (security review follow-up)
- Fixed BUG-21..BUG-26 (media filtering, member project membership on create, javascript: URLs, resend honesty, re-invite password honesty, revoke self-block); 6/6 demo regression checks pass + invite/resend flow check.
- Files additionally modified: backend/src/validate.js, backend/src/routes/admin.js (second pass).

## Third pass (data-integrity review follow-up)
- Fixed BUG-27..BUG-34 (stuck member, users upsert, unlinked leak, legacy assignments, slug format, timestamps/full PATCH, delete/settings revisions + restore guards, whitespace trim); 9/9 demo checks pass, frontend build passes.
- Files additionally modified: backend/src/validate.js, backend/src/store.js, backend/src/routes/admin.js (third pass), frontend/components/adminForms.tsx.

## Remaining actions
1. User decision: push this audit's code fixes + reports to GitHub (explicit approval required — do NOT auto-push).
2. After deploy: live-test invite with admin-set password, member landing on /member, and a new-slug detail page via the Netlify rewrite.
3. Optional: add a real automated test suite (the ad hoc demo scripts are not a suite).
4. Optional P3 fixes: focus management/Escape in modals, tab-widget semantics, skip link, overflow-wrap, per-action busy guards.

## Final upgrade (2026-10-29, user-authorized push)
- Backend: BUG-10..BUG-14, BUG-20, 5A (delete integrity), 5B (true restore + settings restore), 5C (upload verify endpoint), 5D (audit retry + audit_failed), 5E (API security headers), 5F (slug reservations).
- Frontend: BUG-15..BUG-19, achievement status UI, year-null, upload-verify call in admin/member upload flows, Netlify security headers.
- Tests committed: backend/tests/api.test.js (16 pass, 1 skipped), frontend/tests/static.test.js (11 pass); package.json scripts: backend test/test:integration/lint, frontend test/typecheck.
- Docs updated: BUG_REPORT, FUNCTIONALITY_AUDIT (81 items), TESTING_REPORT, AUDIT_REPORT, SECURITY_AUDIT, README (testing section).
- Push: authorized by the user in the final-upgrade message; see GitHub section in the final report for the commit hash and deployment checks.

## Invite-link flow (2026-10-29, local only, NOT pushed yet)
- Backend: token invites (SHA-256 hash stored only, 7-day expiry, single use, role/member link locked in the invite), public GET /invite/validate + POST /invite/accept, admin POST /users/invite-link, GET /users/invite-links (no hashes), POST /users/invite-links/:id/revoke. Resend auto-send only when configured with a verified domain; otherwise the admin sends the link (Copy + Gmail compose button).
- Frontend: public /invite page (validates token first, then password form, creates account, links to login); admin "Invite via link" form + pending links + revoke.
- Tests: backend suite now 18 pass + 1 skipped (2 new invite-link tests); frontend static suite +1 invite-page test. Existing Firebase-email invite flow unchanged.
- Honest limit: fully automatic email delivery to any Gmail address needs a verified sending domain in Resend; the free Resend sender only delivers to the Resend account owner's own email. Until then, delivery is admin-sent via Gmail compose (one click, from the admin's Gmail).
