# AICT Group Portfolio

A long-term team portfolio for the AICT group: homepage, team profiles,
projects, achievements, contact, skills matrix, and a dashboard for
admins and team members — all editable without a code change.

Current state (2026-10-31, live): video uploads use a YouTube-style form
(custom thumbnail, category, Public/Unlisted/Private visibility, tags,
year); video uploads are limited to admins and the Group Leader, and the
Leader's videos go live at once while other members' stay drafts; signed-in
sessions refresh their Firebase token silently before the 1-hour expiry;
public resumes open in a new tab instead of an embedded modal viewer.

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

Login is `/login` ("Member login"; `/admin/login` is an alias titled
"Admin login"), then a role gate (`/dashboard`) sends each person to
the right place. The backend
endpoint `GET /api/admin/me` returns the signed-in actor's role, so
routing never guesses from which admin calls happen to fail.

### Admin — `/admin`

Visible admin navigation (2026-10-31): **Start here, Team members,
Team accounts, Uploads**. The other sections (Projects, Achievements,
Messages, History, Site settings) are code-intact but hidden from the
admin nav; admins still reach project/achievement editing through the
public-page-linked forms where applicable.

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
- **My photos & files (Uploads)** — upload a photo or resume PDF, copy
  its URL, edit an upload's title/description. Video uploads are limited
  to the Group Leader and admins: the Video option is hidden for other
  members. A Group Leader's video project goes live at once; any other
  member's video project is a draft until an admin publishes it.

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

### Adding a team member — one path only: invitation links

There is exactly one way to create an account: an admin opens
Team accounts → **Invite a team member** and creates an invitation
link (32 random bytes; only its SHA-256 hash is stored; 7-day expiry;
single use; email, role and profile link locked at creation).
The plaintext link is shown **only once** at creation. The recipient
opens `/invite?token=…`, sees the fixed email and role, chooses their
own password, and the account is created active. A lost link is
revoked (`POST /api/admin/users/invite-links/:id/revoke`) and a new
one created. The old "Invite an account" form and
`POST /api/admin/users/invite` are gone (the endpoint returns 404);
an admin also cannot change their own role or status, but **can**
link their own account to their own profile.

When the link is created, the backend tries to email it automatically:
Gmail SMTP first (`GMAIL_USER` + `GMAIL_APP_PASSWORD` in Vercel),
then Resend, otherwise link-only — and the page note says which one
happened. A failed send never blocks the link itself. Gmail delivery
was configured by the site owner on 2026-10-31; a live send (invite
created → note says "sent via Gmail" → email lands) is still to be
confirmed with a real test invite.

**Member fills their own profile.**
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
Firebase off): `demo-admin-token` (admin), `demo-member-token`
(member, linked to sample-member-1) and `demo-unlinked-token`
(member with no linked profile, for the profile-less-member tests).
Example:
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
`GET /api/admin/users`, `POST /api/admin/users/invite-link`,
`GET /api/admin/users/invite-links`,
`POST /api/admin/users/invite-links/:id/revoke`,
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
- Only an authenticated admin may invite accounts, via invitation
  links (`POST /api/admin/users/invite-link`, audit-logged; only the
  SHA-256 hash of the token is stored). Roles live in Firestore `user_roles`
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
- File uploads: PDF resumes max 5 MB, images max 5 MB, videos
  (MP4/WebM) max 50 MB; server-generated Cloudinary paths, signed
  upload only after auth + role check, and only when Cloudinary env
  vars are present (otherwise 503, fail closed). Video uploads are
  additionally gated to admins and the Group Leader at sign, verify,
  and project create/patch (a pasted video URL cannot bypass it).
  Public resumes are served through a signed backend proxy
  (`GET /api/members/:slug/resume`, published + public resumes only)
  and open in a new tab; the site CSP allows the Vercel proxy origin
  in `object-src`/`frame-src`, which the embedded viewer required.
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
(no trailing slash). Invite emails: `GMAIL_USER` +
`GMAIL_APP_PASSWORD` (Gmail SMTP first; a Gmail App Password, not the
account password, pasted without spaces). Optional: `RESEND_API_KEY` +
`CONTACT_NOTIFY_EMAIL` (fallback if Gmail is not configured).
Never set `DEMO_MODE=true` in production. Never commit a `.env` file.

Netlify (frontend, build time): `NEXT_PUBLIC_API_URL=https://aict-portfolio.vercel.app/api`,
`NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`,
`NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`,
plus `SECRETS_SCAN_OMIT_KEYS=NEXT_PUBLIC_FIREBASE_API_KEY,NEXT_PUBLIC_FIREBASE_APP_ID`
(the Firebase web-config values are public by design; do **not**
set `SECRETS_SCAN_ENABLED=false`).

## Styling choice

Plain CSS (no Tailwind) keeps the static-export build reliable.
Public routes use a cosmic dark theme (default) with a light variant:
a fixed WebGL nebula canvas (three.js via React Three Fiber/Drei)
behind the content, excluded from admin/member/login/invite pages.
Reduced-motion is honoured via CSS and a toggle; a skip link, visible
focus outlines, 44px touch targets, and `aria-label`/`role` attributes
on interactive images and tabs are in place (static audit 2026-10-31:
viewport meta, 640/768px breakpoints, no positive `tabIndex`, live
pages all 200 — a real Lighthouse run was not possible in that
environment, so no Lighthouse score is claimed here).

## File map

- `frontend/` — Next.js 16 App Router, TypeScript,
  `output: 'export'`. Pages: `/` (home), `/team`, `/team/[slug]`,
  `/projects`, `/projects/[slug]`, `/skills`, `/contact`,
  `/admin`, `/admin/login`, `/login`, `/invite`, `/member`,
  `/dashboard` (role gate). `/gallery` and `/achievements` pages
  were removed (2026-10-30); their backend data/endpoints remain.
  `frontend/netlify.toml` — build + detail-page rewrites (see
  "How publishing works") and the CSP (see "Security summary").
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

- Group logo and brand are still open decisions — no logo or real
  member photo has been invented. Real content now exists live
  (6 published members as of 2026-10-31); more real members/projects
  are added only from owner-supplied content.
- Live Gmail invite send: configured 2026-10-31, still to be
  confirmed with a real test invite (see "Accounts").
- Team accounts simplification: an example was requested by the
  owner (2026-10-31) and is pending their go-ahead; not built yet.
- Owner's live tests still unreported: a video upload through the
  YouTube-style form, and the new-tab resume view.
- Not run live (deliberately): contact-form submission, destructive
  CRUD, media-delete with a real asset, and a full invited-member
  invite-accept → login → deactivation end-to-end run.

## Testing

Run these from the project directories. All tests use local demo mode only
(DEMO_MODE=true, Firebase disabled) — no production data, account, email or
Cloudinary asset is touched.

Backend (from `backend/`):
- `npm test` — API regression suite (`tests/api.test.js`): 33 pass
  (2026-10-31, incl. leader-live, visibility, invite-link and
  resume-proxy tests).
- `npm run lint` — `node --check` over every backend source file.
- `npm run build` — there is no backend build step; the Vercel adapter is
  `api/index.js` (syntax-checked by lint).

Frontend (from `frontend/`):
- `npm test` — static regression checks (`tests/static.test.js`): 42 pass.
- `npm run typecheck` — `tsc --noEmit`.
- `npm run build` — Next.js production build (17 static pages).

Blocked (not run, do not claim): a real Lighthouse run (no Lighthouse /
Chrome binary in this environment), live contact submission
(deliberately not sent), live destructive CRUD, live media-delete with
a real asset, a full invited-member end-to-end run, and npm audit
(registry-blocked in this environment).

## Invitations

One admin-only way to add a person (there is no public sign-up):

**Invite via link:** Admin dashboard → Team accounts →
"Invite a team member". The admin gets a link (valid 7 days, single
use) and the page note says how it was delivered: automatic Gmail
SMTP send when `GMAIL_USER` + `GMAIL_APP_PASSWORD` are configured,
Resend fallback, otherwise link-only (copy it and send it yourself).
The recipient opens the link, sees the email and role fixed by the
admin, chooses their own password, and their account is created
active. The plaintext link is shown only once; if it is lost, revoke
it and create a new one. Creating an admin requires a deliberate
confirmation checkbox in the invite form. There is no second
"Invite an account" form is gone (setting a password on an
existing account from its card is a separate, existing action).
