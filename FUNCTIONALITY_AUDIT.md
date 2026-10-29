# AICT Group Portfolio — Functionality Audit Matrix (2026-10-29)

Statuses: PASS requires evidence; PARTIAL = partly verified; BLOCKED = dependency unavailable; NOT TESTED = no valid verification performed.
Demo = local demo-mode backend (in-memory, Firebase off). Live = read-only checks only; no live writes were made in this audit.

| ID | Feature or Control | Expected Behavior | Actual Behavior | Test Method | Result | Evidence / Note |
|---|---|---|---|---|---|---|
| F01 | Public home / | Renders hero, team strip, featured projects/achievements, contact CTA | Renders (code + live 200); content empty on live because DB is empty | Live status + code | PASS |  |
| F02 | Public team list /team | Search by name/skill, role filter, count, clear filters | Implemented (code); live 200, empty list on live DB | Live status + code | PARTIAL | Live content test blocked by empty DB |
| F03 | Public member detail /team/[slug] | Correct record, skills/education/experience, linked projects/achievements, resume, links | Demo: correct record by slug, 404 for missing; live: sample slug shows Member not found (demo data not on live, by design) | Demo API + live status | PASS |  |
| F04 | Public projects list /projects | Category tabs, search, count, clear filters | Implemented (code); live 200 | Live status + code | PARTIAL | Content test blocked by empty live DB |
| F05 | Public project detail /projects/[slug] | Correct record, case study, tech/tools, contributors, related | Demo: correct record, 404 missing; rewrite serves new slugs (live status 200) | Demo API + live status | PASS |  |
| F06 | Public achievements /achievements | Type tabs, grid | Implemented (code); live 200, empty on live DB | Live status + code | PARTIAL | Empty live DB |
| F07 | Public skills /skills | Matrix computed from members, search + category tabs | Implemented (code) | Code | PARTIAL | No aggregate endpoint; client-side only, untested with real data |
| F08 | Public contact form | Validation, honeypot, rate limit, stored message, success state | Demo: bad email 400, honeypot silently accepted (not stored), valid 201 stored; live submission NOT sent | Demo API | PASS | Live submission deliberately not sent |
| F09 | Public site settings /api/site | Returns saved settings or null | Live: null (not yet saved); demo: sample site | Live + demo API | PASS |  |
| F10 | Admin dashboard /admin | Grouped nav, stats, Start here, CRUD modals | Implemented (code); live 200; admin use demo-tested via API | Code + demo API | PARTIAL | Admin UI clicks not browser-tested |
| F11 | Admin create member | Draft by default, validation, audit | Demo: 201 draft, audit recorded; duplicate slug now 409 | Demo API | PASS |  |
| F12 | Admin publish/unpublish member | Public API hides draft, shows published | Demo: draft 404 public, published 200, unpublish 404 again | Demo API | PASS |  |
| F13 | Admin edit member | Partial PATCH preserves omitted fields | Demo: name edited, other fields preserved; unknown id now 404 | Demo API | PASS |  |
| F14 | Admin delete member | Removes record, audit | Admin-only (403 for member, code + route); live delete NOT run | Demo/code | PARTIAL | Destructive, not run against live; orphans not cleaned (BUG, P3) |
| F15 | Admin projects CRUD | Create/edit/delete, member assignment, publish | Demo: create 201, publish flow, assignment; member assignment changes now admin-only | Demo API | PASS |  |
| F16 | Admin achievements CRUD | Create/edit/delete, member link | Demo: create/edit work; no status/draft field (BUG-10) | Demo API | PARTIAL | No draft state for achievements |
| F17 | Admin site settings | PATCH saves, public site reflects | Admin-only 403 for member (demo); live save NOT run | Demo API | PARTIAL | Live save not run (production write) |
| F18 | Admin accounts / users | List, invite, link/unlink, deactivate/reactivate, revoke, resend | Admin-only; invite idempotent for existing email; invite to nonexistent profile now 404 | Demo API + code | PARTIAL | Live invite/email not tested (blocked) |
| F19 | Admin set password | Admin sets/resets a member password, never stored/returned | Validation 400 short, 503 demo (Firebase off), 403 own account (demo) | Demo API | PARTIAL | Live Firebase password set not tested |
| F20 | Admin messages | List, mark read/unread, delete | Admin-only (403 member, demo); messages stored via contact (demo) | Demo API | PARTIAL | Live inbox not tested |
| F21 | Admin media | Cloudinary list, upload-sign, copy URL | Upload-sign: 503 without env, 400 bad type (demo); live Cloudinary list/upload blocked | Demo API | BLOCKED | Live Cloudinary not tested |
| F22 | Admin audit + revisions | List, filter, restore (members/projects/achievements), site-settings restore unsupported | Admin-only (403 member, demo); restore code inspected; live restore not run | Demo API + code | PARTIAL | Live restore not run |
| F23 | Admin revalidate | Returns live_on_next_load, no rebuild needed | Demo: 200 with live_on_next_load note | Demo API | PASS |  |
| F24 | Member page /member | Own profile, projects, achievements, photos/files, no admin UI | Implemented (code); member API scoping demo-tested; live login blocked | Code + demo API | PARTIAL | Live member login not tested |
| F25 | Member self-create profile | Exactly one profile, forced draft, linked to account | Demo: linked member second profile 403; self-create draft logic in code | Demo API + code | PASS |  |
| F26 | Member edit own profile | Own record only, cannot publish, cannot change status | Demo: own edit 200, status preserved draft (fixed); other profile 403 | Demo API | PASS |  |
| F27 | Member projects | Create (forced draft), edit assigned only, cannot change membership/status | Demo: create forced draft, PATCH status+membership stripped, public 404 | Demo API | PASS |  |
| F28 | Member achievements | Create own, edit own, cannot reassign | Demo: member_id preserved on PATCH (fixed); create auto-fills own id | Demo API | PASS |  |
| F29 | Member uploads | Signed upload, copy URL, first 12 media items | Code: member form checks size only (backend is the control); live upload blocked | Code | BLOCKED | Live upload not tested |
| F30 | Login /admin/login | Email/password sign-in, redirect to /dashboard, forgot password | Code: signInWithEmailAndPassword, forgot sends reset email; raw Firebase error shown verbatim (P3) | Code | PARTIAL | Live login not tested in this audit (first admin login was verified in a prior session) |
| F31 | Role gate /dashboard | Admin -> /admin, member -> /member, no token -> login | Code + live 200; gate logic verified by /admin/me endpoint (401 unauth, 200 admin/member demo) | Code + demo API | PARTIAL | Browser gate flow not run |
| F32 | Direct /admin for member | Member redirected to /member, never sees admin UI | Code: reload() checks /admin/me and redirects; backend also 403s admin routes | Code + demo API | PASS |  |
| F33 | Direct /member for admin | Admin sees member page? (admin can open /member; it shows admin's own linked profile or create prompt) | Code: /member is member-or-admin via requireMemberOrAdmin; admin with no profile sees create prompt — acceptable, not a leak | Code | PASS |  |
| F34 | Logout | Clears session, protected APIs then 401 | Code: signOut in header/member page; token removal via Firebase signOut; live logout flow not browser-tested | Code | PARTIAL | Browser flow not run |
| F35 | No public signup | No page, no button, no client call, backend 404 | Live + demo: register 404; grep: no createUser | Live + demo + grep | PASS |  |
| F36 | Unauthenticated API access | All protected routes 401 | Demo: /admin/me, /admin/users 401; bogus token 401 | Demo API | PASS |  |
| F37 | Member admin-route denial | Users/settings/messages/audit/revisions 403 | Demo: all 403 for member token | Demo API | PASS |  |
| F38 | Role escalation attempt | Member cannot become admin via body | Demo: role stayed member after PATCH with role:'admin'; PATCH /users 403 | Demo API | PASS |  |
| F39 | Deactivated account | 403 account_not_active, never auto-activated | Code (auth.js); live deactivation test blocked | Code | BLOCKED | Needs a real test account |
| F40 | Invited account activation | Auto-activates on first login with a valid token | Code (auth.js); live first-login blocked | Code | BLOCKED | Needs a real invited account |
| F41 | Public API published-only | Members/projects filtered to published; private fields stripped | Demo: draft 404 public; publicMember strips private email/resume unless marked public | Demo API | PASS |  |
| F42 | Contact abuse protection | Validation, honeypot, 5/IP/hour, 1 MB body limit | Demo: 400/201 as expected; rate limit code path, not load-tested; XFF spoof P3 | Demo API + code | PARTIAL | Rate limit not load-tested |
| F43 | Upload signing security | Auth+role, server path, type/size validation, fail-closed 503 | Demo: unauth 401, bad type 400, no env 503 | Demo API | PASS | Live upload blocked |
| F44 | Detail rewrites (Netlify) | New slugs work without rebuild; existing files not shadowed; other routes 404 | Live: unknown /team/* and /projects/* 200, unknown top-level 404; client slug-from-URL verified in code | Live status + code | PASS | Live new-slug content test still pending (needs real published record) |
| F45 | Error/loading/empty states | Loading skeletons, error boxes, empty states, toasts | Code: present, but some errors swallowed and no Retry (BUG-19, P3) | Code | PARTIAL | Not browser-tested |
| F46 | Responsive layouts | 320-1920px, mobile nav, modals, tables, touch targets | Code risks only: overflow-wrap missing, small buttons <44px; NOT visually verified | Code | NOT TESTED | No browser/viewport run |
| F47 | Accessibility | Labels, focus, semantics, contrast, reduced motion | Code: good labels/focus-visible/reduced-motion toggle, but no skip link, incomplete tabs, no focus trap (P3) | Code | PARTIAL | Not measured (no contrast tool, no screen reader) |
| F48 | Performance | Build size, bundle, API volume, Lighthouse | Build passes (16 pages); no measurements taken | Build only | NOT TESTED | No Lighthouse/browser run |
| F49 | Demo mode separation | Demo tokens only with DEMO_MODE=true + Firebase off; live demo:false | Live health demo:false; demo server mode:demo | Live + demo | PASS |  |
| F50 | Secrets in repo | No service-account keys, Cloudinary secrets, Resend keys, passwords in source | Name grep found only references; values never inspected or recorded | Grep | PASS | Full git-history scan not done |
| F51 | Member media filtering | Members see only their own uploads in /admin/media | Fixed: non-admins filtered by UID prefix; live Cloudinary list still blocked | Demo code + route | PASS | Live list not tested |
| F52 | Revoke self-block | Admin cannot revoke their own account | Fixed: own id -> 403 (demo) | Demo API | PASS | |
| F53 | Resend-invite honesty | Resend reports sent vs not_configured truthfully | Fixed: demo -> resent False, not_configured | Demo API | PASS | Live Resend send not tested (Resend not configured) |
| F54 | Re-invite with password | Existing account password either applied or honestly reported | Fixed: Firebase mode applies via updateUser; demo honestly reports False | Demo API + code | PASS | Live Firebase apply not tested |
| F55 | Member project create membership | New member project includes only the creator | Fixed: member_ids forced to [own], others dropped | Demo API | PASS | |
| F56 | javascript: URL rejection | href fields accept only http(s) | Fixed: javascript: link/repo_url -> 400; https/empty accepted | Demo API | PASS | |
| F57 | Stuck member recovery | Member whose linked profile was deleted can self-create again | Fixed: self-create allowed when linked profile missing | Code | PASS | Live stuck-state test blocked |
| F58 | PATCH /users upsert guard | Unknown UID returns 404, no orphan role row | Fixed and demo-tested | Demo API | PASS | |
| F59 | Unlinked member list leak | Unlinked member sees no unassigned achievements | Fixed: empty member_id -> [] | Demo API | PASS | |
| F60 | Legacy project assignments | Editing a member_ids-only project preserves assignments | Fixed: form seeds project_members from member_ids | Code + build | PASS | UI flow with a legacy record not browser-tested |
| F61 | Slug format | Slugs are lowercase/hyphen only | Fixed: bad format 400 | Demo API | PASS | |
| F62 | Timestamps + full PATCH response | Records carry created_at/updated_at; PATCH returns full record | Fixed and demo-tested | Demo API | PASS | |
| F63 | Delete/settings revisions + restore guards | Deletes snapshot; restore cannot resurrect or bypass validation | Fixed and demo-tested | Demo API | PASS | |
| F64 | Whitespace validation | Whitespace-only names rejected | Fixed: 400 | Demo API | PASS | |
| F65 | Achievement draft workflow | Member achievements draft by default, admin publishes | Fixed and demo-tested | Demo API | PASS | |
| F66 | Visibility policy | Draft-owner achievements hidden; project contributors filtered to published | Fixed and demo-tested | Demo API | PASS | |
| F67 | Project year clearing | year: null deletes the field, others preserved | Fixed and demo-tested | Demo API | PASS | |
| F68 | Contact rate limit | Last-XFF hashed key, Firestore-backed when enabled, 429 on 6th | Fixed and demo-tested (in-memory path) | Demo API | PASS | Firestore path code-only |
| F69 | Existence enumeration | Member missing/unassigned both 404 | Fixed and demo-tested | Demo API | PASS | |
| F70 | Admin busy guards | Per-action pending, disable only that control | Fixed, code + build | Code + build | PARTIAL | Real double-click not browser-tested |
| F71 | Modal/lightbox accessibility | Escape, trap, focus return, labelled close | Fixed, code + build | Code + build | PARTIAL | Real keypress not browser-tested |
| F72 | Accessible tabs | tablist/tab/tabpanel, roving tabindex, arrow keys | Fixed, code + build + static test | Code + build | PARTIAL | Real keypress not browser-tested |
| F73 | Skip link, overflow, touch targets | Skip link, overflow-wrap, 44px targets | Fixed, code + build | Code + build | PARTIAL | No viewport render |
| F74 | Error/retry + dashboard gate | Per-section errors + Retry; gate distinguishes outage from logout | Fixed, code + build + static test | Code + build | PARTIAL | Live outage not tested |
| F75 | Login error mapping | Firebase codes mapped to safe messages, no raw error shown | Fixed, static test | Static test | PASS | |
| F76 | Profile-less guards | Backend 403 on create without profile | Fixed, code only | Code | PARTIAL | Demo has no unlinked token (suite SKIPPED) |
| F77 | Delete integrity | Unlink + project cleanup + owned achievements removed, Auth untouched | Fixed and demo-tested | Demo API | PASS | |
| F78 | True restore + settings restore | Replace restore, pre-restore snapshot, settings restorable | Fixed and demo-tested | Demo API | PASS | |
| F79 | Upload verification | /upload/verify checks real asset, deletes invalid | Fixed, demo-tested for auth/config paths | Demo API | PARTIAL | Live Cloudinary verify not tested |
| F80 | Audit reliability | Retry + audit_failed flag on critical ops | Fixed, code | Code | PARTIAL | Audit-store failure not simulated |
| F81 | Security headers | API + Netlify headers, least-permissive CSP | Fixed, demo headers verified | Demo API | PASS | Frontend CSP browser check pending |

## Totals (81 items)

- PASS: 48
- PARTIAL: 27
- BLOCKED: 4
- NOT TESTED: 2

Failed items: none in this matrix (failed checks were fixed and retested; see BUG_REPORT.md for the before/after record). Items marked PARTIAL or BLOCKED are not passed and must not be read as passed.