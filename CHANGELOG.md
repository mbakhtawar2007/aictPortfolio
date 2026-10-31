# Changelog

All notable changes to the AICT Group Portfolio. Dates are when the
change landed on `main` (or, for the audit branch, when it was
prepared for review).

## Unreleased — audit / hardening (branch `audit/muse-hardening`, 2026-10-31)

Security and logic fixes, with regression tests. No architecture
change, no API surface change, no live data touched.

### Fixed (security)

- Invite accept race: acceptance is now claimed atomically
  (Firestore transaction) before the account is created; a failed
  creation releases the claim so the link can be retried.
- `DEMO_MODE` can no longer be accepted in a deployed environment:
  the backend refuses demo tokens when `VERCEL=1`,
  `VERCEL_ENV=production`, or `NODE_ENV=production`.
- Public gallery no longer lists every Cloudinary photo/video:
  only assets referenced by published members/projects.
- Sign-out now signs out of Firebase Auth, not just localStorage;
  the token refresher clears the stored token when Firebase reports
  no user.
- Stored URLs accept only http(s) or root-relative paths on the
  backend, and the frontend scheme-checks them again before
  rendering, so a stored `javascript:` link cannot execute.
- Resume proxy no longer redirects to an arbitrary stored `https:`
  URL: non-portfolio resume URLs are 404 (the stored-URL fallback
  survives only locally, without Cloudinary credentials).
- Deactivation now disables the Firebase Auth user and revokes its
  refresh tokens; reactivation re-enables it; set-password refuses
  deactivated accounts.
- Member writes strip privilege fields (`featured`, `sort_order`,
  project `visibility`) in addition to the previously stripped
  `status`, `is_leader` and `membership` fields.
- Revision restore now checks slug uniqueness, reserves/releases
  slugs correctly, and clears other leaders when restoring a leader
  snapshot; member/project PATCH releases the old slug only after a
  successful save.
- Profile-link collisions now return 409, on invite-link creation
  and on account PATCH.
- Deletes of missing member/project/achievement/message records now
  return 404 instead of `{ deleted: true }`.
- Upload ownership is now an exact owner parse, not a
  `public_id.includes('/<uid>-')` substring check; on verify-lookup
  failure the asset is destroyed under the other resource types
  before 404, and a failed destroy is reported honestly.
- Resend-invite now returns 404 when the Auth user does not exist,
  instead of the misleading `not_configured`.
- Audit failures are now surfaced as `audit_failed: true` on every
  mutating response, without failing the request.

### Fixed (robustness / UX)

- Rate limits added to invite validate (100/hr/IP), invite accept
  (20/hr/IP), upload sign (100/hr/actor) and invite-link creation
  (50/hr/actor), in addition to the existing contact limit (5/hr,
  now transactional in Firestore).
- Contact limiter now increments in a Firestore transaction; client
  identity uses the last X-Forwarded-For entry (hashed).
- `X-Powered-By` disabled; `Cache-Control: no-store` on API
  responses; malformed JSON returns 400, oversized bodies 413.
- CORS origins are normalised (trailing slash stripped, `*`
  dropped) instead of being used verbatim.
- Invite emails are normalised to lowercase; `roleByEmail` is
  case-insensitive; CR/LF is stripped from contact/invite mail
  subjects and names.
- Zod schemas are strict where the frontend already sends exact
  fields (invite accept/link, user patch, set-password, upload sign,
  media meta, message patch, contact); member/project/achievement/
  site schemas keep stripping unknown fields, because the forms
  legitimately send extra display fields.
- Frontend: `apiGet`/`apiSend` distinguish an upstream HTML error
  (`upstream_error`, no retry) from a network failure; detail-page
  slugs are encoded and malformed slugs become not-found instead of
  hanging on a skeleton; secondary-fetch failures on detail pages
  are shown as a note, not as an empty list; ConfirmDialog labels
  match the action; own account card hides role, status and
  password controls; uploads time out after 2 minutes and can be
  cancelled; thumbnail uploads get a media title; skill levels are
  clamped to 1–100; project year must be 2000–2100; login email is
  trimmed; dashboard shows a specific deactivated message.
- CSP `frame-src`/`object-src` tightened to `'self'` (the resume
  embed they covered was removed on 2026-10-31).

### Tooling and docs

- ESLint added (backend: `@eslint/js`; frontend: typescript-eslint
  + react-hooks, with two documented rule-offs in
  `frontend/eslint.config.mjs`) and Prettier configs added for both
  apps. A full-repo Prettier reformat was deliberately NOT done in
  this pass, so the security diff stays reviewable; see
  CONTRIBUTING.md.
- Backend lint now syntax-checks every source file (previously it
  omitted `demoData.js`, `server.js`, `scripts/bootstrap-admin.js`
  and the new `ownership.js`).
- README corrected (invitations de-duplicated and the garbled
  sentence fixed, API summary, admin-nav claims, file map, env
  section, test counts) and DEPLOYMENT.md reconciled with the live
  stack (real domains, Cloudinary PDF-delivery prerequisite).
- Six stale 2026-10-29 audit documents archived to
  `docs/archive/2026-10-29-audit/`; `SECURITY.md` and
  `CONTRIBUTING.md` added.
- Dead code removed: `TAB_LABEL` (admin page) and `FormModal`
  (admin forms), both proven unused by grep.

### Not changed, deliberately

- Architecture (Netlify static frontend → Vercel Express backend →
  Firestore + Cloudinary), account model (invitation links only),
  hidden admin tabs, `/gallery` and `/achievements` backend
  endpoints, and the Team accounts simplification (awaiting owner
  approval) are all untouched.
- The admin/member upload handlers were NOT unified onto
  `lib/upload.ts` in this pass: it is the most safety-critical
  flow, proven live, and guarded only by static tests. That
  unification is a follow-up, not a silent refactor.

## 2026-10-31 — earlier releases

See the git history on `main` for the full sequence (cosmic theme,
silent token refresh, leader instant-live, role control on account
cards, video format, resume new-tab view, no-frontend-errors, and
the Cloudinary PDF-delivery fix). Head before this audit:
`22d698c5`.
