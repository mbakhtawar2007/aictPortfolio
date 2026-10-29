# AICT Group Portfolio — Audit Report (2026-10-29)

## 1. Executive summary
The application is **ready with limitations**. The core architecture is sound, the backend enforces roles and ownership, public signup is genuinely disabled, and publishing works without a frontend rebuild. The audit found and fixed one high-impact class of defect — members could publish their own profiles and projects, bypassing admin review — plus duplicate slugs and several ownership/creation edge cases. All fixes were retested in local demo mode (11/11). What remains unverified is live Firebase authentication, live Cloudinary upload, live email delivery, and any browser/viewport testing. Those items are blocked, not passed, and are listed honestly in section 20.

## 2. Final application status
Ready with limitations (see section 23). Do not describe it as fully verified until the live items in section 22 are tested after a user-approved deploy.

## 3. Architecture overview
- Frontend: Next.js 16.4.3, App Router, TypeScript, static export (output: 'export'), plain CSS (Neural Studio dark theme, #070B16 / #3B82F6 / #8B5CF6 / #06B6D4), Netlify (site aictportfollio, base frontend, build npm run build, publish out).
- Backend: Node.js + Express 4, Vercel (project aict-portfolio, root backend, serverless adapter), Firebase Admin SDK + Firestore, Cloudinary signed uploads, optional Resend.
- Auth: Firebase Email/Password only; roles in Firestore user_roles (admin/member, invited/active/deactivated); browser SDK used only for sign-in and password reset; Firestore rules deny-all.
- Content flow: public pages fetch live data from the Vercel API in the browser on every load, so content edits are live on the next page load. Netlify rewrites /team/* and /projects/* (status 200) to pre-rendered detail shells; detail components read the real slug from window.location.pathname. No Netlify rebuild is needed for content, including new slugs.
- No architecture change was made or is recommended by this audit. No Supabase, no Firebase Storage, no SSR migration, no UI framework replacement.

## 4. Repository structure findings
- Local source at ~/workspace/aict-group-portfolio (not a git checkout; GitHub snapshot procedure applies for pushes). 54 files at last push (99d080c1) + 6 audit report files + 3 modified code files in this pass (not yet pushed).
- Backend: src/app.js, auth.js, firebase.js, store.js, validate.js, audit.js, rateLimit.js, demoData.js, routes/public.js, routes/admin.js, api/index.js, vercel.json, scripts/bootstrap-admin.js, .env.example, firestore.rules, DEPLOYMENT.md, README.md.
- Frontend: app/ (16 routes incl. /dashboard role gate and /member), components/ (layout, ui, adminForms), lib/ (api, firebaseClient, types), styles/globals.css, netlify.toml, next.config.mjs.
- No test framework, no lint script, no test script in either package.json. No TODO/FIXME code markers of substance (only placeholder text in demo data and form placeholders).

## 5. Functional audit summary
See FUNCTIONALITY_AUDIT.md for the full matrix. Headlines: public reads pass; admin CRUD passes in demo; member scoping passes; publish/unpublish passes in demo; contact validation + honeypot + rate limit pass; upload-sign validation passes (live upload blocked); detail rewrites pass live (status level).

## 6. Security findings
See SECURITY_AUDIT.md. Headline: no P0 found. P1 class (member self-publish) found and fixed. Remaining items are P2 design gaps (achievements always public) and P3 hardening (CSP, XFF rate limit, enumeration via 404/403, focus management).

## 7. Authentication and authorization results
- Permission matrix (public / unauthenticated / admin / active member) tested in demo mode; invited/deactivated states tested by code + auto-activation logic (live blocked).
- No public signup verified three ways: no page, no client call, backend 404 (live + demo).
- Role escalation via member/project payloads blocked (fields stripped or not in schema); user roles only via admin-only endpoint.
- Deactivated accounts: requireAuth returns 403; live denial not exercised (blocked).

## 8. API test results
- Demo: 42 checks (41 pass after correcting two test bugs; 1 real failure, fixed) + 11/11 regression checks.
- Live: 17 safe-read checks, all as expected. No live writes were made.
- Status codes verified: 200/201, 400 validation, 401 unauthenticated, 403 forbidden, 404 not found (incl. register), 409 slug_taken (new), 429 contact rate limit (code path, not load-tested), 503 upload/media unavailable.

## 9. Database integrity findings
- Demo CRUD: create/publish/unpublish/delete flows work; partial PATCH preserves omitted fields (Zod partial + Firestore merge) — verified by code and by the Zod behaviour check in the data-integrity review.
- Duplicate slugs were the one integrity failure (fixed with 409).
- Revision snapshots are deep-cloned (demo store mutates in place; the clone prevents snapshots becoming post-edit state). Site-settings restore is explicitly unsupported (400), as documented.
- Orphan risks: deleteMember does not clean project_members/achievements referencing the deleted profile (P3, documented); invite to nonexistent profile fixed; profile-less member '' edge documented.
- No production Firestore writes were made, so live integrity could not be (and was not) tested by mutation.

## 10. UI/UX findings
- No orphan buttons or forms found; every form has a submit handler and every button an action or submit role.
- Good: guarded saves (forms, login, invite, upload), plain-language admin nav, status chips, empty states with actions, reduced-motion support, theme toggle.
- Gaps (P3): admin action buttons without busy guards, swallowed fetch errors, no Retry buttons, placeholder-only admin search labels (fixed), detail error branch without navigation (fixed), incomplete tab semantics, no skip link, no focus trap/Escape in modals (team lightbox text promises Esc it does not implement).

## 11. Responsive and accessibility findings
- Code audit only — NOT visually verified. Structure is sound (max-width caps, auto-fill grids collapsing to 1 column <=640px, modal as bottom sheet on mobile, 44px default buttons). Risks: no overflow-wrap (long strings at 320px), .btn.small (36px) and .tab-btn (~40px) below the 44px touch target, chips with cursor:pointer that are not interactive, hero rotating words with reduced motion showing only the first word, counter animation ignoring reduced motion, page errors not announced (no role=alert on ErrorBox). No Lighthouse, no contrast measurement, no cross-browser run — none claimed.

## 12. Performance measurements
- None measured. Frontend build succeeds (16 pages); bundle sizes were not recorded and no Lighthouse/Core Web Vitals scores are claimed. API payloads are small (public lists, no pagination on public endpoints — acceptable at current data volume, revisit if the team grows large). No N+1 evidence beyond parallel client fetches on the home page (site/members/projects/achievements in parallel, which is the correct pattern).

## 13. Deployment and configuration findings
- Vercel: project aict-portfolio, git-linked, auto-deploys on push to main; last verified deployment dpl_GdGh1xo1PRUZhCSgg9t2reA2nv7t READY for 99d080c1; /api/health 200 firebase/demo:false.
- Netlify: site aictportfollio, git-linked, auto-builds on push to main; /member and /dashboard return 200 after the last push; SECRETS_SCAN_OMIT_KEYS set for the two public Firebase values; SECRETS_SCAN_ENABLED=false must NOT be set.
- Env separation: server secrets only in Vercel production env; frontend uses only NEXT_PUBLIC_API_URL + public Firebase web config. DEMO_MODE is never set in production (verified via live health demo:false).
- CORS: exact-origin allowlist from CORS_ORIGIN; the earlier misspelling incident proved a wrong origin blocks calls, which is the fail-closed behaviour.

## 14. Bug register
See BUG_REPORT.md (BUG-01..BUG-34, BUG-10..BUG-20, 5A–5F). Final matrix: 81 items — 48 PASS, 27 PARTIAL, 4 BLOCKED, 2 NOT TESTED. PARTIAL items are code+build verified without a browser run, or live-dependent; they are not claimed as fully verified.

## 15. Fixes implemented
BUG-01..BUG-09 + second pass BUG-21..BUG-26 + third pass BUG-27..BUG-34 + final upgrade BUG-10..BUG-20 and sections 5A–5F (all closed, see BUG_REPORT.md) (media filtering, member project membership on create, javascript: URLs, resend honesty, re-invite password honesty, revoke self-block). Files changed (local only): backend/src/routes/admin.js; frontend/app/admin/page.tsx; frontend/app/team/[slug]/detail.tsx; frontend/app/projects/[slug]/detail.tsx. No API contract was changed except the addition of 409 slug_taken, which is a new rejection for previously-accepted invalid input, not a breaking change to valid clients.

## 16. Files changed
As in section 15, plus the six audit reports in this set (AUDIT_REPORT.md, FUNCTIONALITY_AUDIT.md, SECURITY_AUDIT.md, BUG_REPORT.md, TESTING_REPORT.md, AUDIT_PROGRESS.md). No other files were modified.

## 17. Tests executed
See TESTING_REPORT.md. Demo API 42 + 11 regression, live safe reads 17, frontend build x2, node --check. No unit/lint/Lighthouse/browser suite exists or was run.

## 18. Build and lint results
- Frontend build: pass (16 pages). Backend: node --check pass; no backend build step exists (serverless adapter). Lint: no script exists. TypeScript: via next build, pass.

## 19. Test coverage summary
Not measurable — there is no test suite to measure coverage against. The ad hoc demo harnesses covered the routes listed in FUNCTIONALITY_AUDIT.md but are not committed as a suite; adding one is recommended remaining work.

## 20. Known limitations
- Live auth, upload, email, browser/viewport, Lighthouse, cross-browser, production writes: all blocked/not tested (section 22).
- Achievements have no draft state; public content does not check owner publish state; project year cannot be cleared; contact rate limit is XFF-spoofable; orphans on member delete are not cleaned.

## 21. Blocked tests
See TESTING_REPORT.md "Tests NOT performed" — each with its reason (needs a real test account, a real file, a browser run, or production-write approval).

## 22. Remaining work
1. User approval to push this audit's fixes + reports to GitHub (explicit approval required; nothing was pushed in this audit).
2. After deploy: live-test (a) invite with admin-set password, (b) member lands on /member and /admin redirects to /member, (c) new-slug detail page via rewrite, (d) duplicate slug rejected live (409), (e) member cannot self-publish live.
3. Decide BUG-10 (achievement draft state) and BUG-11 (owner publish-state join) before changing the schema.
4. Optional: commit a real automated test suite (demo-mode API + frontend) and add lint.
5. Optional P3: focus/Escape/skip-link/tab semantics, overflow-wrap, per-action busy guards, CSP headers, XFF handling behind Vercel's trusted proxy headers.

## 23. Final readiness assessment
Ready with limitations. The site is safe to use for its current purpose (public portfolio + admin/member content management) once the audit fixes are deployed, with the understanding that live auth/upload/email flows still need their first real end-to-end test and that real team content has not yet been added (live DB is empty). Do not present it as fully verified until section 22 items 2 are done.
