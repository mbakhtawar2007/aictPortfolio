# AICT Group Portfolio

A long-term team portfolio for the AICT group: homepage, team profiles,
projects, achievements, contact, skills matrix, and a dashboard for
admins and team members — all editable without a code change.

## Live sites

- **Public site (Netlify):** https://aictportfollio.netlify.app
  (exact spelling: `aictportfollio`, not `aictportfollo`)
- **Backend API (Vercel):** https://aict-portfolio.vercel.app
  (`/api/health`, `/api/site`, `/api/members`, `/api/projects`,
  `/api/achievements`, `/api/contact`, `/api/admin/*`)
- **Code (GitHub):** https://github.com/mbakhtawar2007/aictPortfolio
  (`main`; last pushed commit in this repo's history is the current
  state — see the commit log, not a SHA quoted here, which goes stale)
- **Data:** Firebase project `aict-group-portfolio` — Firestore
  `(default)` in Production mode, Authentication Email/Password.
  **Files:** Cloudinary free (photos / resume PDFs).
  No Supabase is used by this project. Do not confuse it with the
  separate AICT AI Video Showcase & Voting site, which does use Supabase.

## Approved architecture (supersedes spec v2's Supabase + Vercel-only plan)

```
Browser (Netlify CDN, Next.js static export)
  │  fetches live data in the browser, NEXT_PUBLIC_API_URL
  ▼
Vercel backend (Express, backend/, Root Directory = backend)
  │  Firebase Admin SDK (server-only)  ·  Cloudinary signed uploads
  │  Resend (optional, see "Accounts" below)
  ▼
Firestore (data + Auth)  ·  Cloudinary (photos / resume PDFs)
```

Why this split: Supabase free projects pause after 7 days of inactivity,
which is wrong for a portfolio that may sit untouched for months.
Firestore Spark never pauses. Firebase Cloud Storage, however, now
requires Blaze (a card) since February 2026, so files use Cloudinary
free (no card) instead.

## How publishing works — no manual redeploy for content

Public pages fetch live data from the Vercel API in the browser on
every page load. **Saving in the dashboard is live on the visitor's
next page load. No Netlify rebuild, no build hook, and no manual
deploy step is needed for content changes** — not for an edit, not
for a new member, and not for a new project.

The one gap used to be a brand-new detail page (`/team/<new-slug>` or
`/projects/<new-slug>`), which has no pre-rendered HTML file in the
static export and would 404. That is fixed two ways, both in this repo:

1. `frontend/netlify.toml` rewrites an unknown `/team/*` or
   `/projects/*` (status 200, not a redirect) to a pre-rendered
   detail file. A rewrite without `force=true` does not override an
   existing pre-rendered slug.
2. The detail components (`app/team/[slug]/detail.tsx`,
   `app/projects/[slug]/detail.tsx`) read the slug from the actual
   URL, not only from the build-time prop, so the rewritten page
   fetches the correct record.

A Netlify rebuild is still needed for **code** changes, and Netlify
auto-builds on every push to `main` (site `aictportfollio`, base
`frontend`, build `npm run build`, publish `out`). The same is true
for the Vercel backend: it auto-deploys on a push to `main`.
`POST /api/admin/revalidate` no longer claims a rebuild is pending;
it returns `live_on_next_load`.

## Two dashboards, by role

Login is the same page for everyone (`/admin/login`), then a role
gate (`/dashboard`) sends each person to the right place. The backend
endpoint `GET /api/admin/me` returns the signed-in actor's role, so
routing never guesses from which admin calls happen to fail.

### Admin — `/admin`

Grouped, plain-language navigation: **Content** (Start here, Team
members, Projects, Achievements), **People** (Team accounts, Messages,
Photos & files), **Advanced** (History, Site settings).

- **Start here:** what to do next, site-at-a-glance counts, a
  first-steps checklist, and publishing explained in plain words.
- **Team members / Projects / Achievements:** search, Published /
  Draft status chips, helpful empty states, confirm-before-delete.
  Forms are split into labelled sections with help text; typing a
  name/title auto-fills the web address (slug) if it is still empty.
- **Team accounts:** the sign-in accounts. See "Accounts" below.
- **Messages:** admin-only inbox — mark read/unread, delete,
  reply by `mailto:` link.
- **Photos & files:** Cloudinary media library; uploads are signed
  by the backend after auth + role checks (503 fail-closed when
  Cloudinary is not configured). Copy a URL into a member/project
  form.
- **History:** audit log (who changed what, when) and earlier
  versions (snapshots taken on every member/project/achievement
  update, restorable from the UI). Site-settings changes are not
  snapshotted yet, so they cannot be restored from here.
- **Site settings:** group name, tagline, mission, about, logo URL,
  hero video URL, contact email, accent colour, social links, and
  SEO fields (`seo_title`, `seo_description`, `og_image_url`).

A member who opens `/admin` directly is redirected to `/member`.

### Member — `/member`

A member **never sees the admin page**. Their own page only shows:

- **My profile** — create it (if they have none) or edit it. A
  self-created profile is saved as a draft for an admin to publish.
- **My projects** — only projects they are assigned to; a new
  project they create includes them automatically.
- **My achievements** — only their own.
- **My photos & files** — upload a photo or resume PDF, copy its URL.

Members cannot see other members' accounts, the messages inbox,
site settings, or history. The backend already filters the members,
projects and achievements lists to the signed-in member, so the
page does not rely on the UI to hide things.

## Accounts — the part people get confused by

Two different things, kept separate:

1. **A sign-in account** (Firestore `user_roles` + Firebase Auth):
   email, password, role (`admin` / `member`), status
   (`invited` / `active` / `deactivated`), and an optional link to
   a team profile (`member_id`).
2. **A team profile** (Firestore `members`): what visitors see —
   name, slug, bio, skills, education, experience, links, photo,
   resume.

### Adding a team member — three ways, pick one per person

**A. Admin sets the password (simplest, no email needed).**
In Team accounts → Invite an account, fill name, email, role, and
the optional password (at least 6 characters). Or, for an existing
account, use **Set password** on its card. Share the password
privately with that person — it is **never shown again, never
stored in Firestore, never logged, and never returned by the API**.
It is used once through the Firebase Admin SDK
(`POST /api/admin/users/invite`, `POST /api/admin/users/:id/set-password`).
Ask the person to change it after first login (login page →
Forgot password). An admin cannot set their own password this way.

**B. Leave the password blank — a setup email is sent automatically.**
The admin page sends Firebase's own password-setup email from the
browser (`sendPasswordResetEmail`) when Resend is not configured,
so nobody has to open Firebase Console. The person clicks the link
and sets their own password. If Resend **is** configured in Vercel,
the backend sends the setup link through Resend instead, and the
browser does not send a second one.

**C. Member fills their own profile.**
Invite the account with no profile linked. After the member sets
their password and logs in, they see **Create my profile** on
`/member`. It is saved as a draft, linked to their account, and an
admin publishes it. A member may create exactly one profile this
way; a second attempt returns 403. This is **not** a public
sign-up: only an admin-invited account can reach it, and there is
no `/signup` page and no client `createUser` call anywhere.

### Activation — automatic

An invited account becomes `active` automatically on its first
valid login: a valid Firebase token only exists after a password
was set, so that first token safely activates the account
(`user.activated_first_login` in the audit log). Deactivated
accounts are never auto-activated. As a fallback, an admin can
click **Activate** on an invited account's card in Team accounts.

### Linking an account to a profile

In Team accounts, each card shows the linked profile (or "Not
linked yet") and a **Link profile** dropdown with **Save link**.
The invite form also has an optional profile link. Linking is
checked server-side: the profile must exist
(`PATCH /api/admin/users/:id` with `member_id`, 404 otherwise).
Unlinking is setting the link to "No profile".

### Forgot password

The login page has a **Forgot password?** button: enter the email,
and Firebase sends a reset link to that address. This is also how
a member changes a password an admin set for them.

## Run locally

```bash
# Backend (demo mode: FIREBASE_ENABLED unset/false, DEMO_MODE=true)
cd backend && npm install
PORT=4001 DEMO_MODE=true node src/server.js
# Health: curl http://localhost:4001/api/health
# Members (published SAMPLE only): curl http://localhost:4001/api/members

# Frontend (static export)
cd frontend && npm install
NEXT_PUBLIC_API_URL=http://localhost:4001/api npm run build
# Output in frontend/out/ — serve it with any static server, or run
# `npx serve frontend/out` for a local preview. Do not use `next start`
# with a static export.
```

Demo auth tokens (local verification only, `DEMO_MODE=true`,
Firebase off): `demo-admin-token` (admin) and `demo-member-token`
(member, linked to sample-member-1). Example:
`curl -H "Authorization: Bearer demo-admin-token" http://localhost:4001/api/admin/me`.
These tokens are rejected unless `DEMO_MODE=true`.
**Never set `DEMO_MODE=true` in Vercel/production.**

## API summary

Public (no auth, published content only):
`GET /api/health`, `GET /api/site`, `GET /api/members`,
`GET /api/members/:slug`, `GET /api/projects`,
`GET /api/projects/:slug`, `GET /api/achievements`,
`POST /api/contact` (Zod-validated, rate-limited, honeypot).

Admin/member (Bearer Firebase ID token, every request):
`GET /api/admin/me`, `GET/PATCH /api/admin/members[/:id]`
(member: create once if unlinked, then edit own only),
`GET/POST/PATCH/DELETE /api/admin/projects[/:id]`
(member: assigned projects only),
`GET/POST/PATCH/DELETE /api/admin/achievements[/:id]`
(member: own only), `GET/PATCH /api/admin/settings` (admin only),
`POST /api/admin/upload/sign`, `GET /api/admin/media`,
`GET/PATCH/DELETE /api/admin/messages/:id` (admin only),
`GET /api/admin/audit`, `GET /api/admin/revisions`,
`POST /api/admin/revisions/:id/restore` (admin only),
`GET /api/admin/users`, `POST /api/admin/users/invite`,
`PATCH /api/admin/users/:id`,
`POST /api/admin/users/:id/set-password`,
`POST /api/admin/users/:id/resend-invite`,
`POST /api/admin/users/:id/revoke-invite`,
`POST /api/admin/revalidate`.

All writes validate with Zod and return
`{ data, error: { code, message }, meta }`, never exposing stack
traces, secrets, passwords, or invitation tokens.

## Security summary (spec v2 §§1, 15, 16)

- No public sign-up: no `/signup` page, no client `signUp` /
  `createUser` call, and `POST /api/auth/register` returns 404.
- Only an authenticated admin may invite accounts
  (`POST /api/admin/users/invite`, idempotent on retry,
  audit-logged). Roles live in Firestore `user_roles`
  (admin/member, invited/active/deactivated) and are checked
  server-side on every protected request. Roles are never trusted
  from the request body, user metadata, or client state.
  Deactivated accounts get 403.
- A member may edit only their own member record and assigned
  projects / own achievements; editing another member returns 403.
  Members never see admin-only data: the backend filters their
  lists, and `/admin` redirects them to `/member`.
- Public endpoints return published content only. Drafts, private
  resumes, contact messages, `user_roles` and audit data are never
  public.
- File uploads: PDF resumes max 5 MB, images only, server-generated
  Cloudinary paths, signed upload only after auth + role check,
  and only when Cloudinary env vars are present (otherwise 503,
  fail closed).
- Backend fails closed when Firebase credentials are missing:
  privileged endpoints return 503 with a safe message.
- `firestore.rules` denies everything by default; production
  reads/writes go through the Vercel backend with the Admin SDK.
  The browser client SDK is used only for Auth sign-in and
  password-reset emails, never for direct Firestore access.

## Environment variables

Vercel (backend, production): `FIREBASE_ENABLED=true`,
`FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT_JSON` (whole JSON,
one line), `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`,
`CLOUDINARY_API_SECRET`, `CORS_ORIGIN=https://aictportfollio.netlify.app`
(no trailing slash). Optional: `RESEND_API_KEY` +
`CONTACT_NOTIFY_EMAIL` (see "Accounts" — without them, setup
emails go through Firebase automatically). Never set
`DEMO_MODE=true` in production. Never commit a `.env` file.

Netlify (frontend, build time): `NEXT_PUBLIC_API_URL=https://aict-portfolio.vercel.app/api`,
`NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`,
`NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`,
plus `SECRETS_SCAN_OMIT_KEYS=NEXT_PUBLIC_FIREBASE_API_KEY,NEXT_PUBLIC_FIREBASE_APP_ID`
(the Firebase web-config values are public by design; do **not**
set `SECRETS_SCAN_ENABLED=false`).

## Styling choice

Plain CSS with the spec's Neural Studio tokens (background #070B16,
blue #3B82F6 → violet #8B5CF6 → cyan #06B6D4) is used instead of
Tailwind, to keep the static-export build reliable. Tailwind can be
added later without changing the API or data model. No GSAP,
Three.js or Lottie; reduced-motion is honoured via CSS.

## File map

- `frontend/` — Next.js 16 App Router, TypeScript,
  `output: 'export'`. Pages: `/` (home), `/team`, `/team/[slug]`,
  `/projects`, `/projects/[slug]`, `/achievements`, `/skills`,
  `/contact`, `/admin`, `/admin/login`, `/member`, `/dashboard`
  (role gate). `frontend/netlify.toml` — build + detail-page
  rewrites (see "How publishing works").
- `backend/` — Express app factory (`src/app.js`, no listener on
  import), Vercel adapter (`api/index.js`), local-only server
  (`src/server.js`). Routes in `src/routes/admin.js` and
  `src/routes/public.js`; validation in `src/validate.js`;
  role/activation logic in `src/auth.js`.
- `firestore.rules` — deny-all by default.
- `DEPLOYMENT.md` — the original hand-done setup steps. Where it
  disagrees with this README about publishing, this README is
  current: content no longer needs a manual rebuild.

## What is still open

- Group name, logo and brand are still open decisions — the UI
  stays generic ("AICT Group") and uses initials avatars / a
  placeholder SVG only. No logo or real member photo has been
  invented.
- No real member, project or achievement content exists yet in the
  live database (it is empty, not SAMPLE — demo SAMPLE data only
  appears in local demo mode and is labelled SAMPLE everywhere).
- No device / Lighthouse testing has been done on the new
  `/member` page or the detail-page rewrites; the rewrites should
  be confirmed live with a real new member/project slug after the
  next deploy.
- Resend is optional and not required for invites to work.

## Testing

Run these from the project directories. All tests use local demo mode only
(DEMO_MODE=true, Firebase disabled) — no production data, account, email or
Cloudinary asset is touched.

Backend (from `backend/`):
- `npm test` — API regression suite (`tests/api.test.js`): 16 pass, 1 skipped.
- `npm run lint` — `node --check` over every backend source file.
- `npm run build` — there is no backend build step; the Vercel adapter is
  `api/index.js` (syntax-checked by lint).

Frontend (from `frontend/`):
- `npm test` — static regression checks (`tests/static.test.js`): 11 pass.
- `npm run typecheck` — `tsc --noEmit`.
- `npm run build` — Next.js production build (16 static pages).

Blocked (not run, do not claim): browser/viewport/keyboard/Lighthouse
checks, live Firebase first-login, live Cloudinary upload/verify, live
contact submission, and npm audit (registry-blocked in this environment).
