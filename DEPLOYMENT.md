# Deployment — steps the USER must do by hand

Status update: the foundation (plus the full UI/UX pass) has been pushed
to GitHub (`mbakhtawar2007/aictPortfolio`). Nothing below has been
deployed yet — no Vercel or Netlify site is live, and no secret was
entered anywhere in this repo. Firebase and Cloudinary accounts were
created by the site owner (values kept by the owner, never in chat or
in this repo).

## 1. Firebase (data + Auth) — user creates the project

1. In the Firebase console, create a project (e.g. `aict-group-portfolio`).
   Spark (no card) is enough for Firestore + Auth.
2. Build → Firestore Database → Create database (production mode is fine;
   the deny-all `firestore.rules` in this repo is the intended rule set —
   publish it, because all production access goes through the backend).
3. Build → Authentication → Sign-in method → enable **Email/Password**.
   Do NOT enable any self-registration UI in the app — the app has none.
   Firebase's console "enable" only allows the provider; account creation
   in this app happens only via the backend Admin SDK invite endpoint.
4. Project Settings → Service accounts → Generate new private key.
   Paste that JSON **only** into Vercel as `FIREBASE_SERVICE_ACCOUNT_JSON`
   (or upload it via `GOOGLE_APPLICATION_CREDENTIALS` on a server you
   control). Never commit it, never paste it into chat, never put it in
   the frontend.
5. In Vercel, set: `FIREBASE_ENABLED=true`, `FIREBASE_PROJECT_ID`,
   `CORS_ORIGIN=https://YOUR-NETLIFY-SITE.netlify.app`,
   `DEMO_MODE` unset/false. Never set `DEMO_MODE=true` in production.

## 2. First admin bootstrap (one-time, then lock it down)

1. Locally only, with the real Firebase env vars set (not committed):
   `BOOTSTRAP_TOKEN=<one-time-token> BOOTSTRAP_ADMIN_EMAIL=<admin email>
   FIREBASE_ENABLED=true node backend/scripts/bootstrap-admin.js`
2. The script refuses if an admin already exists. It creates the Auth user
   and a `user_roles` row with `account_status: invited`.
3. Complete first login via a Firebase password-reset link for that email
   (Firebase console → Authentication → user → reset password, or the
   invite flow), then mark the row `active` via the admin API.
4. Unset `BOOTSTRAP_TOKEN` afterwards. Never expose this script as an
   HTTP endpoint. There is deliberately no public "create first admin" route.

## 3. Cloudinary (files, free, no card) — user creates the account

1. Create a free Cloudinary account. Note cloud name, API key, API secret.
2. Set them in Vercel only: `CLOUDINARY_CLOUD_NAME`,
   `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`. Uploads are signed by
   the backend (`POST /api/admin/upload/sign`) after auth + role checks.
   The secret never reaches the browser.

## 4. Vercel backend — user creates the project

1. Create a Vercel project from the repo (or deploy the `backend/`
   directory). Set **Root Directory = `backend`**.
2. The repo's `backend/vercel.json` uses build `npm install`, output
   `public`, and rewrites `/api/(.*)` to `/api/index.js`.
3. Set all env vars from `backend/.env.example` (real values in Vercel only).
4. Optional: set `RESEND_API_KEY` + `CONTACT_NOTIFY_EMAIL` for contact
   notifications. Without them, messages are still stored in Firestore.
5. Verify: `GET https://YOUR-VERCEL-PROJECT.vercel.app/api/health`
   returns 200, and `POST /api/auth/register` returns 404.

## 5. Netlify frontend — user creates the site

1. Create a Netlify site from the repo's `frontend/` directory (or deploy
   the `out/` build output manually, as with the Showcase site).
2. Build command `npm run build`, publish directory `out`.
   `frontend/netlify.toml` already records this.
3. Set at build time: `NEXT_PUBLIC_API_URL=https://YOUR-VERCEL-PROJECT.vercel.app/api`
   and the `NEXT_PUBLIC_FIREBASE_*` public web config from Firebase
   Project Settings → Your apps → Web app. These are public config, not
   secrets — but keep them in env vars, not hardcoded.
4. Publish flow (updated — supersedes the old rebuild note): content
   saved in the dashboard is live on the visitor's next page load,
   with no manual rebuild and no build hook. Public pages fetch live
   data from the Vercel API in the browser, and `frontend/netlify.toml`
   rewrites unknown /team/* and /projects/* slugs to a pre-rendered
   detail file whose component reads the slug from the URL. A Netlify
   rebuild is only needed for code changes, and Netlify auto-builds
   on a push to main.

## 6. Before launch checklist

- [ ] DEMO_MODE is off in Vercel; demo tokens are rejected in production.
- [ ] No `.env` file, service-account JSON, or Cloudinary secret is committed.
- [ ] Real member content replaces all SAMPLE demo records; no fabricated
      bios, certificates or project outcomes are published.
- [ ] An admin can invite, resend, revoke and deactivate accounts; a member
      calling the invite endpoint gets 403 (test this, don't assume it).
- [ ] Contact form rate limit (5/IP/hour) and honeypot are live.
- [ ] Custom domain, if any, is set on Netlify and added to CORS_ORIGIN.
