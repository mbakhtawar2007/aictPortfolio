# Security policy

## Reporting a vulnerability

This is a small team site, not a public bug-bounty programme. If you
find a security problem, do not open a public issue with the details:
tell the site owner (the admin account holder) privately, with the
steps to reproduce and the impact you observed, and give them time
to fix it before disclosing anything. A report that only says "your
site is vulnerable" without steps is not actionable.

## What is protected, and how

- **No public sign-up, ever.** There is no `/signup` page, no
  client `createUser` call, and `POST /api/auth/register` returns
  404. Accounts are created only by an admin-issued invitation
  link (32 random bytes; only its SHA-256 hash is stored; 7-day
  expiry; single use; email, role and profile link locked at
  creation). The one exception is the one-time server-side
  bootstrap script (`backend/scripts/bootstrap-admin.js`), which
  refuses to run once an admin exists and is never an HTTP route.
- **Roles come from Firestore on every request.** The backend
  verifies the Firebase ID token, then loads `user_roles` by UID.
  Token claims, request bodies and client state are never trusted
  for roles. Deactivated accounts get 403 immediately, because
  there is no cached role anywhere.
- **Self-service limits.** An admin cannot change their own role,
  status or password through the API (403), but may link their own
  account to their own profile. Members edit only their own member
  record, assigned projects and own achievements; privilege fields
  (`status`, `is_leader`, `featured`, `sort_order`, project
  `visibility`) are stripped from member writes server-side, and
  the forms strip them too.
- **Uploads are signed by the backend** after auth + role checks,
  and verified against the real Cloudinary asset (format and bytes)
  before anything is saved; rejected assets are destroyed.
  Video uploads are gated to admins and the Group Leader at sign,
  verify and project create/patch. Cloudinary credentials are
  server-only; the browser never sees them.
- **Public data is published-only.** Drafts, private resumes,
  contact messages, `user_roles` and audit data are never public,
  and the gallery lists only assets referenced by published
  members/projects. Resumes go through a signed proxy
  (`GET /api/members/:slug/resume`) that serves published + public
  resumes only, and never redirects to an arbitrary stored URL.
- **Fail closed.** Without Firebase or Cloudinary credentials the
  backend returns 503 on privileged and upload routes, and a
  deployed backend without Firebase returns 503 on public content
  routes too, instead of serving sample data or minting demo
  accounts. `DEMO_MODE` and demo tokens are refused in any deployed
  environment (Vercel or `NODE_ENV=production`) and exist only for
  local verification.
- **Headers and limits.** `X-Powered-By` is off, API responses
  carry `Cache-Control: no-store`, bodies are capped at 1 MB,
  errors are generic (no stack traces, secrets, passwords or tokens
  in responses), and the contact, invite and upload routes are
  rate-limited. CORS origins are normalised; `*` is never accepted.
- **CSP.** Netlify serves a CSP that keeps `script-src 'unsafe-inline'`
  (see Residual risks below) and `frame-src`/`object-src 'self'`.

## Secrets: what to rotate, and when

No secret was found in the working tree during the 2026-10-31
audit (grep over app source, docs and configs; only `.env.example`
placeholders exist), and **no rotation was required on that basis**.
Rotate immediately if any of these happen:

- A Firebase service-account JSON, Cloudinary API secret, Gmail
  App Password or `BOOTSTRAP_TOKEN` is ever pasted into chat, a
  screenshot, a ticket, or a committed file. Rotate the credential
  at its provider first, then update Vercel — do not just delete
  the message.
- A contributor with Vercel/Firebase/Cloudinary access leaves the
  team: rotate the shared credentials they could have seen, and
  remove their access at each provider.
- An invitation link or password-reset link is suspected leaked:
  revoke the link (`Team accounts → Revoke`) and re-issue; for a
  password, set a new one from the account card and tell the owner
  through a private channel.

Never commit a `.env` file. `.gitignore` excludes `.env*` except
`.env.example`. Firebase web-config values (`NEXT_PUBLIC_FIREBASE_*`)
are public by design and are the only `NEXT_PUBLIC_` values that
may appear in build output (Netlify `SECRETS_SCAN_OMIT_KEYS` covers
exactly those two keys; never disable secrets scanning wholesale).

## Residual risks (by design, not oversights)

- **Bearer token in localStorage.** The Firebase ID token is stored
  as `aict_admin_token` in localStorage, so any script running in
  the site origin can read it. There is no httpOnly-cookie session
  (the frontend is a static export with no server to set one).
  Mitigation is the CSP and the absence of user-supplied script
  execution: all user content renders as React text, stored URLs
  are scheme-checked, and the only `dangerouslySetInnerHTML` is
  the constant theme script in `app/layout.tsx`. A stored-XSS
  would still be severe — treat any future rich-text feature as a
  security change, not a UI one.
- **CSP `unsafe-inline` for scripts and styles.** Next.js static
  export and the inline theme script require it, so a strict
  nonce/hash CSP is not achievable without re-architecting the
  theme bootstrap. `unsafe-eval` is absent.
- **PDF magic-byte check.** Upload sign checks file extension, and
  verify trusts Cloudinary's reported format — with one deliberate
  exception: genuine PDFs sometimes report an empty format from
  Cloudinary, and that fallback must stay, because removing it
  re-broke real resume uploads live on 2026-10-30. A forged PDF
  would still be served only through the signed proxy to a
  published + public resume, and only as a download/inline PDF.
- **Rate limits are per-instance in the fallback path.** The
  contact limit is transactional in Firestore when Firebase is
  available; the invite/upload limits are in-memory per serverless
  instance, so they are defence-in-depth on a cold fleet, not a
  hard guarantee. Do not rely on them as the only abuse control.
- **Serverless token lifetime.** Deactivation revokes refresh
  tokens, but a still-valid ID token (up to ~1 hour) is rejected
  anyway, because every request re-loads `user_roles` — the
  Firestore status, not the token, is authoritative.
- **No `npm audit` verdict from this environment.** The registry
  audit endpoint is blocked here (403), so dependency
  vulnerabilities could not be verified in the audit pass. Re-run
  `npm audit` from an unblocked network for both apps before
  merging, and again on a schedule — see the PR checklist.

## Deployment prerequisites (security-relevant)

- Cloudinary Console → Settings → Security → **"PDF and ZIP files
  delivery: Allow delivery of PDF and ZIP files" must be checked**,
  or signed PDF delivery returns 401 even with correct code.
- `firestore.rules` in this repo is deny-all; publish exactly that
  (all production access goes through the backend Admin SDK).
- Firebase Auth: Email/Password only. Do not enable Google or any
  other provider for this site, and do not add a public sign-up UI.
- Never set `DEMO_MODE=true` in Vercel or with
  `NODE_ENV=production`. The backend now refuses to boot demo mode
  there, but the setting itself must still never be used.
