# Contributing

This repo is a small team site, not a public open-source project.
The notes below are for anyone the owner asks to work on it — they
exist so a change does not silently break the security model.

## Non-negotiables

- **Architecture stays:** static Next.js on Netlify → Express on
  Vercel → Firestore + Cloudinary. No Supabase, no Firebase Cloud
  Storage, no Tailwind, no second data store, no new framework.
- **Account model stays:** invitation links only. Never add a
  public sign-up, a `/signup` page, a client `createUser` call, or
  `POST /api/admin/users/invite`. `POST /api/auth/register` stays 404.
- **Roles come from Firestore on every request.** Never trust a
  token claim, a request body or client state for a role.
- **Fail closed.** Missing Firebase or Cloudinary credentials must
  produce 503, never sample data, never a demo account, never a
  redirect to an arbitrary URL.
- **No live data changes from a PR.** Verify locally in demo mode
  (`DEMO_MODE=true`, backend `PORT=4001`). Never run destructive
  operations against production Firestore or Cloudinary.
- **No secrets in the repo.** `.env.example` files hold placeholders
  only. See `SECURITY.md` for the rotation checklist.
- **Do not weaken** CSP, CORS, rate limits or role gates to make
  something work. If a feature cannot work within them, that is a
  design discussion with the owner, not a config edit.
- **Hidden admin tabs stay code-intact.** Do not delete Projects,
  Achievements, Messages, History or Site settings admin code, the
  `/gallery` or `/achievements` backend endpoints, or any code
  with live references. Delete only what is provably unused (grep
  first, tests second).
- **Merges need the owner's approval.** A merge to `main`
  deploys to production on Netlify and Vercel. Open a PR, wait for
  all checks, and wait for the owner — never force-push `main` or
  rewrite shared history.

## Working locally

Backend (from `backend/`):

```sh
DEMO_MODE=true PORT=4001 npm run dev   # local demo backend
npm test                                 # API regression suite
npm run lint                             # node --check + ESLint
```

Frontend (from `frontend/`):

```sh
npm run dev
npm test                                 # static regression checks
npm run lint                             # ESLint
npm run typecheck                        # tsc --noEmit
npm run build                            # Next.js production build (17 pages)
```

Before any push, all of the above must pass, and no secret may be
staged. `npm audit` is blocked in some environments (registry 403);
when it is blocked, say so in the PR instead of claiming a clean
audit, and re-run it from an unblocked network.

## Style

- Plain CSS, no Tailwind. Frontend is TypeScript, backend is
  plain Node (ES modules, no build step).
- Prettier configs (`.prettierrc`, print width 120, single quotes)
  exist in both apps, and `npm run format` applies them. The repo
  is **not** fully Prettier-formatted: a whole-repo reformat was
  deliberately left out of the 2026-10-31 audit so the security
  diff stayed reviewable. New files should be Prettier-clean;
  reformatting an old file is welcome only as its own commit, with
  tests re-run after.
- ESLint configs: backend uses `@eslint/js` recommended; frontend
  uses typescript-eslint + react-hooks. The frontend config has
  two documented rule-offs — mount-effect data loading (the
  established fetch-on-mount pattern) and three.js scene
  imperativity — read its header before adding a third.
- Keep the "why" comments. This codebase records its hard-won
  lessons inline (the Cloudinary doubled-path bug, the PDF
  delivery checkbox, the resume-proxy CSP rule). When you fix a
  bug, leave the one-paragraph explanation where the next person
  will trip over the same thing.

## Commits and PRs

- Small, conventional commits by logical group (backend security,
  public routes + tests, frontend security, frontend UX, tooling,
  docs). One concern per commit; no drive-by reformats inside a
  security commit.
- A PR description should list: what was found, what was fixed,
  what was verified (with actual test/lint/typecheck/build
  output), what is blocked or untested, and what still needs the
  owner (the "Awaiting owner" list). Do not claim a live test that
  was only a local demo run.
- The local working copy in this project is not a git checkout:
  pushes go through the snapshot procedure documented in the
  owner's workflow (paths manifest, then push, then verify the
  head). Do not invent a different push method without asking.
