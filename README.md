# AICT Group Portfolio — Foundation (local only)

A long-term team portfolio for the AICT group: homepage, team profiles,
projects, achievements, contact, and an admin dashboard. **No build in this
repo has been pushed, deployed, or connected to a live account.**

## Approved architecture (supersedes spec v2's Supabase + Vercel-only plan)

```
Browser (Netlify CDN, static export)
  │  fetch, client-side, NEXT_PUBLIC_API_URL
  ▼
Vercel backend (Express, backend/, Root Directory = backend)
  │  Firebase Admin SDK (server-only)  ·  Cloudinary signed uploads  ·  Resend (optional)
  ▼
Firestore (data + Auth)  ·  Cloudinary (photos / resume PDFs)
```

Why this split: Supabase free projects pause after 7 days of inactivity,
which is wrong for a portfolio that may sit untouched for months. Firestore
Spark never pauses. Firebase Cloud Storage, however, now requires Blaze (a
card) since February 2026, so files use Cloudinary free (no card) instead.

## What is NOT done yet

- No Firebase, Cloudinary, Netlify, Vercel or Resend account has been created.
- No real member, project or achievement content exists. The backend demo
  data is labelled SAMPLE everywhere and must never be presented as real.
- No full admin create/edit forms, media library, revision-restore UI, or
  invite form UI yet — the APIs for those are implemented; the forms are a
  next pass.
- No live sign-in has been tested (that needs the user's Firebase project).

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

Demo auth tokens (local verification only, DEMO_MODE=true, Firebase off):
`demo-admin-token` (admin) and `demo-member-token` (member, linked to
sample-member-1). Example: `curl -H "Authorization: Bearer demo-member-token"
http://localhost:4001/api/admin/members`. These tokens are rejected unless
DEMO_MODE=true. **Never set DEMO_MODE=true in Vercel/production.**

## Security summary (spec v2 §§1, 15, 16)

- No public sign-up: no `/signup` page, no client `signUp`/`createUser`
  call, and `POST /api/auth/register` returns 404.
- Only an authenticated admin may invite accounts
  (`POST /api/admin/users/invite`, idempotent on retry, audit-logged).
  Roles live in Firestore `user_roles` (admin/member,
  invited/active/deactivated) and are checked server-side on every
  protected request. Roles are never trusted from the request body,
  user metadata, or client state. Deactivated accounts get 403.
- A member may edit only their own member record and assigned projects /
  own achievements; editing another member returns 403.
- Public endpoints return published content only. Drafts, private resumes,
  contact messages, `user_roles` and audit data are never public.
- All writes validate with Zod, return `{ data, error: {code,message},
  meta }`, and never expose stack traces, secrets or invitation tokens.
- File uploads: PDF resumes max 5 MB, images only, server-generated
  Cloudinary paths, signed upload only after auth + role check, and
  only when Cloudinary env vars are present (otherwise 503, fail closed).
- Backend fails closed when Firebase credentials are missing: privileged
  endpoints return 503 with a safe message.
- `firestore.rules` denies everything by default; production reads/writes
  go through the Vercel backend with the Admin SDK. The browser client
  SDK is used only for Auth sign-in, never for direct Firestore access.

## Publish / revalidate note (important)

The frontend is a static export, so it cannot be revalidated on demand.
`POST /api/admin/revalidate` truthfully returns `saved_refresh_pending`.
A publish updates the live site only after a Netlify rebuild, triggered by
a Netlify build hook that the site owner configures (see DEPLOYMENT.md).

## Styling choice

Plain CSS with the spec's Neural Studio tokens (background #070B16,
blue #3B82F6 → violet #8B5CF6 → cyan #06B6D4) is used in this foundation
instead of Tailwind, to keep the static-export build reliable. Tailwind
can be added later without changing the API or data model. No GSAP,
Three.js or Lottie in this pass; reduced-motion is honoured via CSS.

## File map

- `frontend/` — Next.js 16 App Router, TypeScript, `output: 'export'`.
- `backend/` — Express app factory (`src/app.js`, no listener on import),
  Vercel adapter (`api/index.js`), local-only server (`src/server.js`).
- `firestore.rules` — deny-all by default.
- `DEPLOYMENT.md` — the steps the user must do by hand.
