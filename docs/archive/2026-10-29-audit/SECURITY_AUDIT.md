# AICT Group Portfolio — Security Audit (2026-10-29)

No secrets, tokens, passwords or private personal data are included in this report. Checks are code inspection + demo-mode execution + live read-only requests unless stated otherwise.

## Threat areas examined
Authentication, authorization, role/account states, IDOR, mass assignment, XSS, CSRF, NoSQL/operator injection, open redirects, CORS, Firestore rules, upload signing, rate limiting, secret handling, error leakage.

## Authentication — PASS (with blocked live items)
- Firebase ID tokens are verified server-side (auth.js loadActor); demo tokens are accepted ONLY when DEMO_MODE=true and Firebase is off. Live /api/health reports demo:false, so demo tokens cannot be used against production.
- Unauthenticated protected requests return 401; bogus tokens return 401 (demo-tested).
- No public signup: no /signup page, no client createUser call (only signInWithEmailAndPassword + sendPasswordResetEmail), POST /api/auth/register returns 404 (live + demo).
- Login is email/password only; Google provider is not enabled.
- Invited accounts auto-activate on first login (valid token only exists after a password is set); deactivated accounts are never auto-activated and get 403 account_not_active.
- BLOCKED (not verified live): real invited-member first login, deactivated-account live denial, expired-token behaviour against Firebase (code path exists, live token not exercised).

## Authorization — PASS after fixes, FAIL before (see BUG_REPORT.md)
- Admin-only routes (users, settings, messages, audit, revisions, media list, invite, set-password, revoke, revalidate) return 403 for members (demo-tested).
- Member scoping: GET /admin/members returns only the linked profile; GET /admin/projects only assigned projects; GET /admin/achievements only own achievements; cross-member PATCH returns 403 (demo-tested).
- Role escalation via body is blocked: member PATCH on their own profile with role:'admin' left the role unchanged (role is not in memberSchema, and user roles are only changed via admin-only PATCH /users/:id, which returns 403 for members).
- Fixed in this audit: member self-publish (members + projects), duplicate slugs, project membership changes, achievement reassignment, PATCH-creates-member, invite to nonexistent profile (BUG-01..BUG-07).
- Remaining: achievements have no draft state (BUG-10); public content does not check owner publish state (BUG-11); profile-less member '' edge (BUG-20).

## API security
- Zod validation on every mutating route; unknown fields are stripped by default, so id/isSample/role cannot be smuggled through member/project payloads.
- Body limit 1 MB (express.json); no urlencoded parser.
- Error responses are generic ({data, error:{code,message}, meta}) with no stack traces, SQL or provider details. Validation errors reveal only the first field issue.
- No CSRF token: the API uses Bearer tokens, not cookies, and CORS credentials are false, so classic cookie CSRF does not apply. Credentialed cross-origin reads are not permitted.
- Rate limiting: contact endpoint only, 5/IP/hour in-memory, plus honeypot. It trusts the first X-Forwarded-For entry (BUG-13, P3). No rate limit on auth-adjacent admin endpoints (they require a valid admin token, so abuse needs a compromised admin account).
- NoSQL/operator injection: Firestore access goes through the Admin SDK with explicit document ids and field sets; no query string is built from user input except equality filters in revisionsAll (entity/entity_id, server-side where ==). No evidence of injection vectors found.

## CORS and HTTP security
- CORS origin is env-driven (CORS_ORIGIN, comma-split, exact match, no trailing slash). Live value is the correct Netlify origin (verified by working live frontend calls and by the earlier misspelling incident, which proved a wrong origin blocks calls).
- Credentials: false. If CORS_ORIGIN were ever set to '*', public reads would be cross-origin readable but protected routes still require a Bearer token, so '*' alone is not an auth bypass — do not set it anyway.
- No Content-Security-Policy header was observed in code (Express does not set security headers by default). P3 hardening opportunity; not claimed as a vulnerability on its own.
- HTTPS is provided by the hosts (Netlify/Vercel); no HTTP downgrade path is configured in code.

## Firestore security — PASS (rules as shipped)
- firestore.rules: deny-all (match /{document=**} allow read, write: if false). The browser SDK is used only for Auth sign-in; all data access goes through the Vercel backend with the Admin SDK, which bypasses rules.
- No direct client Firestore reads/writes were found in the frontend. If these rules are ever relaxed for a future feature, a negative test must be added (the rules file itself says this).

## File upload security — PARTIAL (code + demo only, live upload blocked)
- Signing requires auth + role; server generates folder and public_id (aict-portfolio/images|resumes/<uid>-<timestamp>); the browser never supplies a storage path.
- Validation: file_type enum (image|pdf), file_size <= 5 MB, extension check (pdf must be .pdf; images jpg/jpeg/png/webp/avif). Wrong type returns 400; unconfigured Cloudinary returns 503 fail-closed.
- NOT verified: an actual Cloudinary upload, a renamed non-PDF, an oversized file end-to-end, or signature expiry against live Cloudinary (blocked — needs real credentials + a test file, and must not run against production media without approval).
- Note: the member upload form checks size only (no extension check client-side); the backend signing check is the real control, so this is a UX inconsistency, not a bypass.

## Secret management — PASS (by name scan, no values inspected)
- Grep for api_key/secret/password across the repo found only code references (env var names, validation, audit comments, docs) — no secret values were found in source. Env vars are read from process.env on the server only; no server secret is in a NEXT_PUBLIC_* variable.
- Public Firebase web config (API key/app id) is public by design and is excluded from Netlify secrets scanning via SECRETS_SCAN_OMIT_KEYS; SECRETS_SCAN_ENABLED=false must NOT be set.
- Git history was not fully scanned for old committed secrets in this pass (limitation). If a secret was ever committed, rotation is required — deletion alone does not remove it from history.

## Second-pass fixes (security review follow-up, demo-retested)
- Media list is now filtered to the requesting member's own UID prefix for non-admins (BUG-21).
- Member project creation can no longer attach other members (BUG-22).
- javascript:/data: URLs are now rejected for all href-rendered fields (BUG-23).
- Resend-invite now sends via Resend when configured or honestly reports not_configured (BUG-24).
- Re-invite with a password now applies it in Firebase mode or reports honestly (BUG-25).
- Revoke-invite now blocks self-revocation (BUG-26).
- Still documented, not fixed: upload signatures do not bind claimed file size/type (the real upload goes directly to Cloudinary, so size/type guarantees are client-claimed until a post-upload verification step is added); audit writes are best-effort and failures are swallowed.

## Remaining risks
1. Live Firebase auth flows (invite -> first login -> activation -> deactivation) are code-verified + demo-verified only.
2. Live Cloudinary upload path is unverified.
3. Achievements are always public once created (BUG-10) — a content-governance risk, not an auth bypass.
4. No CSP/security headers; contact rate limit is XFF-spoofable (BUG-13).
5. No automated security test suite exists; the checks in this audit were ad hoc and are not committed as regression tests.

## Final upgrade security changes (2026-10-29)
- Achievement publication is now enforced server-side (draft default, member status strip, public filter + owner-published join) — the frontend select is presentation only.
- Existence enumeration closed for members (404 for missing and unassigned alike).
- Contact limiting no longer trusts first-XFF; keys are hashed, never stored raw; Firestore backing when enabled.
- Uploads: post-upload server verification endpoint (real asset bytes/format/ownership, invalid assets deleted) called by both upload pages before a URL is accepted.
- Audit failures now surface (retry + audit_failed flag) instead of being silently swallowed.
- Security headers on API and Netlify, with a documented least-permissive CSP (unsafe-inline retained only because Next.js static export requires it).
- Slug claims are transactional in Firestore, closing the concurrent-duplicate race.
- Remaining risks (honest): upload verification is post-upload, not pre-upload (a rejected asset briefly exists on Cloudinary before deletion); contact limiter has a small read-then-write race in Firestore mode; no CSP/browser verification yet; demo tokens remain in the public repo, gated by DEMO_MODE + Firebase-off (production must keep DEMO_MODE unset/false and FIREBASE_ENABLED=true — verified live: demo:false).
