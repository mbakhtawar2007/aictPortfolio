// Frontend static regression checks (no browser required).
// Run: npm test (from frontend/). Asserts that the accessibility and
// error-handling code the audit requires is actually present in source,
// so a future edit cannot silently drop it. Browser/viewport verification
// is still done separately and honestly marked BLOCKED where not run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const any = (files, re) => files.some((f) => re.test(read(f)));

test('skip link exists and is focus-visible', () => {
  const layout = read('app/layout.tsx');
  assert.match(layout, /skip/i);
  assert.match(read('styles/globals.css'), /skip-link|skip.*:focus/i);
});
test('no public signup route or client sign-up call', () => {
  assert.ok(!fs.existsSync(path.join(root, 'app/signup')));
  const client = read('lib/firebaseClient.ts');
  assert.ok(!/createUserWithEmailAndPassword|createUser\(/.test(client));
  assert.match(client, /signInWithEmailAndPassword/);
});
test('dashboard gate distinguishes auth states (not a blind login redirect)', () => {
  const gate = read('app/dashboard/page.tsx');
  assert.ok(/error|retry|Retry/i.test(gate));
  assert.ok(!/catch\s*\{[^}]*router\.push\('\/admin\/login'\)/s.test(gate) || /error/i.test(gate));
});
test('login maps Firebase errors to safe messages', () => {
  assert.match(read('components/loginForm.tsx'), /invalid-credential|too-many-requests|user-not-found/);
  assert.ok(fs.existsSync(path.join(root, 'app/login/page.tsx')));
  assert.match(read('app/login/page.tsx'), /Member login/);
  assert.match(read('app/dashboard/page.tsx'), /\/login/);
  assert.match(read('app/invite/page.tsx'), /\/login/);
});
test('achievement form has admin-only visibility control and member draft note', () => {
  const forms = read('components/adminForms.tsx');
  assert.match(forms, /draft/i);
  assert.match(forms, /published/i);
});
test('project form sends year: null when cleared (not undefined)', () => {
  const forms = read('components/adminForms.tsx');
  assert.match(forms, /year:\s*null|year === ''/);
});
test('admin action busy guards exist', () => {
  const admin = read('app/admin/page.tsx');
  assert.match(admin, /pending|busy/i);
});
test('modal/dialog accessibility: Escape, focus trap or return', () => {
  const ui = read('components/ui.tsx');
  assert.ok(/Escape/.test(ui) || /Escape/.test(read('app/admin/page.tsx')));
  assert.match(ui, /role=["']dialog["']|aria-modal/);
});
test('tabs carry tablist/tab/tabpanel semantics', () => {
  const files = ['app/projects/page.tsx', 'app/skills/page.tsx', 'app/admin/page.tsx'];
  assert.ok(any(files, /role=["']tablist["']/));
  assert.ok(any(files, /aria-controls/));
  assert.ok(any(files, /onKeyDown|ArrowRight|ArrowLeft/));
});
test('security headers configured in netlify.toml', () => {
  const toml = read('netlify.toml');
  assert.match(toml, /Content-Security-Policy/);
  assert.match(toml, /X-Frame-Options/);
});
test('no demo token or secret value in frontend source', () => {
  const client = read('lib/firebaseClient.ts');
  assert.ok(!/demo-admin-token|demo-member-token/.test(client));
});

test('invite page is token-gated, not a public signup', () => {
  const invite = read('app/invite/page.tsx');
  assert.match(invite, /invite\/validate/);
  assert.match(invite, /invite\/accept/);
  assert.ok(!/createUserWithEmailAndPassword/.test(invite));
  assert.ok(/token/.test(invite));
});

test('no dummy/demo data anywhere on public pages (2026-10-30): empty lists stay empty', () => {
  assert.ok(!fs.existsSync(path.join(root, 'lib/sample.ts')), 'demo data file is gone');
  for (const f of ['app/page.tsx', 'app/team/page.tsx', 'app/projects/page.tsx', 'app/skills/page.tsx', 'app/team/[slug]/detail.tsx', 'app/projects/[slug]/detail.tsx', 'components/layout.tsx']) {
    assert.ok(!/lib\/sample|orDemo|sampleMembers|sampleProjects|sampleAchievements|sampleSite|SampleBadge/.test(read(f)), f + ' must not use demo data');
  }
  const home = read('app/page.tsx');
  assert.ok(!/team-strip/.test(home), 'home must not hide members in a sideways strip');
  assert.ok(!/hero-scene/.test(home), '3D hero scene removed for the minimal look');
  assert.ok(/No published team members yet/.test(home), 'home shows an empty state, not demo members');
  assert.ok(/No featured projects yet/.test(home), 'home shows an empty state, not demo projects');
});
test('detail pages show not-found for unknown slugs, no demo fallback', () => {
  assert.ok(!/sampleMembers\.find|sampleProjects\.find/.test(read('app/team/[slug]/detail.tsx')));
  assert.ok(!/sampleMembers\.find|sampleProjects\.find/.test(read('app/projects/[slug]/detail.tsx')));
  assert.match(read('app/team/[slug]/detail.tsx'), /Member not found/);
  assert.match(read('app/projects/[slug]/detail.tsx'), /Project not found/);
});

test('cleanup: no dead team-strip CSS, no demo fallback (login buttons are intentional since 2026-10-30)', () => {
  assert.ok(!/team-strip/.test(read('styles/globals.css')), 'dead team-strip CSS removed');
  assert.ok(!/\.sample\b/.test(read('styles/globals.css')), 'demo badge CSS removed');
  for (const f of ['app/team/page.tsx', 'app/projects/page.tsx', 'app/skills/page.tsx']) {
    assert.ok(!/orDemo\(/.test(read(f)), f + ' must not use the demo fallback');
  }
});
test('cleanup: no unused Loading/SampleBadge imports in public list pages', () => {
  for (const f of ['app/page.tsx', 'app/team/page.tsx', 'app/projects/page.tsx', 'app/skills/page.tsx']) {
    assert.ok(!/\bLoading\b/.test(read(f).replace(/loading/g, '')), f + ' must not import unused Loading');
    assert.ok(!/SampleBadge/.test(read(f)), f + ' must not use the demo badge');
  }
});

test('gallery and achievements pages removed (2026-10-30): no routes, no nav/footer/explore links', () => {
  assert.ok(!fs.existsSync(path.join(root, 'app/gallery/page.tsx')), 'gallery page is gone');
  assert.ok(!fs.existsSync(path.join(root, 'app/achievements/page.tsx')), 'achievements page is gone');
  assert.ok(!/\/gallery/.test(read('components/layout.tsx')), 'nav/footer must not link to /gallery');
  assert.ok(!/\/achievements/.test(read('components/layout.tsx')), 'nav/footer must not link to /achievements');
  assert.ok(!/\/gallery|\/achievements/.test(read('components/ExploreStudio.tsx')), 'explore fallback must not link to removed pages');
  assert.ok(!/\/gallery|\/achievements/.test(read('components/Scene/ExploreScene.tsx')), 'explore scene must not link to removed pages');
  // Uploads themselves stay: media details and delete are still wired.
  assert.match(read('app/admin/page.tsx'), /media\/meta/);
  assert.match(read('app/admin/page.tsx'), /kind === 'media'/);
  assert.match(read('app/member/page.tsx'), /media\/meta/);
});

test('account delete: admin users tab has a Delete button wired to DELETE /admin/users/:id', () => {
  const admin = read('app/admin/page.tsx');
  assert.ok(admin.includes("kind: 'user'"));
  assert.ok(admin.includes('/admin/users/${deleting.id}'));
  assert.ok(admin.includes('This is your account.'));
  assert.ok(admin.includes('Delete the sign-in account for'));
});

test('single creation path: only the invitation link form creates accounts', () => {
  const admin = read('app/admin/page.tsx');
  assert.ok(admin.includes('Invite a team member'));
  assert.ok(!admin.includes("users/invite', 'POST'"));
  assert.ok(!admin.includes('onSubmit={sendInvite}'));
  assert.ok(admin.includes("linkInvite.confirmAdmin"));
});

test('invite link delivery states: gmail success, gmail failure, and manual fallback are all messaged', () => {
  const admin = read('app/admin/page.tsx');
  assert.ok(admin.includes("email_delivery === 'gmail'"));
  assert.ok(admin.includes("email_delivery === 'failed'"));
  assert.ok(admin.includes('via Gmail'));
});

test('navbar has Admin login and Member login buttons (desktop + mobile menu)', () => {
  const layout = read('components/layout.tsx');
  assert.ok(layout.includes('href="/admin/login">Admin login</a>'));
  assert.ok(layout.includes('href="/login">Member login</a>'));
  assert.ok(read('app/admin/login/page.tsx').includes('heading="Admin login"'));
  assert.ok(read('styles/globals.css').includes('.nav-login { display: none; }'));
});

test('profile form has direct photo and resume upload from the device', () => {
  const forms = read('components/adminForms.tsx');
  assert.ok(forms.includes("import { uploadDirectFile } from '../lib/upload'"));
  assert.ok(forms.includes('Upload photo'));
  assert.ok(forms.includes('accept="image/jpeg,image/png,image/webp,image/avif"'));
  assert.ok(forms.includes('Upload resume (PDF)'));
  assert.ok(forms.includes('accept="application/pdf"'));
  assert.ok(forms.includes("set('photo_url', url)") || forms.includes('photo_url'));
  const up = read('lib/upload.ts');
  assert.ok(up.includes('export async function uploadDirectFile'));
  assert.ok(up.includes('/admin/upload/sign'));
  assert.ok(up.includes('/admin/upload/verify'));
});

test('cosmic theme: deep-space dark default, Inter only, cosmic palette', () => {
  const css = read('styles/globals.css');
  assert.ok(css.includes('--bg: #05060F'), 'cosmic deep-space background token');
  assert.ok(css.includes('#0B0B2B'), 'deep-space gradient end');
  assert.ok(css.includes('--text: #F4F6FF'), 'white cosmic text');
  assert.ok(css.includes('--muted: #A7ADC9'), 'soft grey secondary text');
  assert.ok(css.includes('--violet: #7B2FF7'), 'violet accent token');
  assert.ok(css.includes('--magenta: #FF3CAC'), 'magenta accent token');
  assert.ok(css.includes('--cyan: #22D3EE'), 'cyan accent token');
  assert.ok(css.includes('--accent: #1F5BFF'), 'electric blue accent token exists');
  assert.ok(css.includes('family=Inter:wght@300;400;500;600;700'), 'one sans (Inter) only');
  assert.ok(!css.includes('Space Grotesk'), 'Space Grotesk removed with the old theme');
  assert.ok(css.includes('.cosmic-canvas'), 'cosmic canvas layer exists');
  assert.ok(css.includes('.card-hover:hover { transform: translateY(-6px)'), 'cards lift on hover');
  const layout = read('app/layout.tsx');
  assert.ok(layout.includes("||'dark'"), 'first-load default theme is cosmic dark');
  assert.ok(layout.includes('CosmicBackgroundLoader'), 'cosmic background mounted in root layout');
  assert.ok(!layout.includes('AmbientCanvasLoader'), 'old ambient canvas removed from layout');
  assert.ok(layout.includes('SmoothScroll'), 'Lenis smooth scroll mounted in root layout');
  assert.ok(read('components/layout.tsx').includes("|| 'dark'"), 'theme toggle default is cosmic dark');
});

test('cosmic theme: background is client-only, hidden on signed-in routes, respects motion and visibility', () => {
  const loader = read('components/Scene/CosmicBackgroundLoader.tsx');
  assert.ok(loader.includes("dynamic(() => import('./CosmicBackground'), { ssr: false"), 'no SSR for three.js');
  assert.ok(!loader.includes('data-theme'), 'loader does not gate the canvas on theme');
  const css = read('styles/globals.css');
  assert.ok(css.includes("[data-theme='light'] .cosmic-fallback"), 'no-WebGL fallback has a light variant');
  assert.ok(!css.includes("[data-theme='light'] .cosmic-canvas"), 'canvas is not hidden in light mode');
  for (const route of ['/admin', '/member', '/dashboard', '/login', '/invite']) {
    assert.ok(loader.includes(`'${route}'`), `cosmic background hidden on ${route}`);
  }
  const bg = read('components/Scene/CosmicBackground.tsx');
  assert.ok(bg.includes('fbm'), 'nebula uses fractal noise');
  assert.ok(bg.includes('uScroll'), 'nebula palette shifts with scroll');
  assert.ok(bg.includes('prefers-reduced-motion'), 'reduced motion respected');
  assert.ok(bg.includes('document.hidden'), 'animation pauses when the tab is hidden');
  assert.ok(bg.includes('cosmic-fallback'), 'no-WebGL CSS fallback exists');
  assert.ok(bg.includes('dpr={[0.5, 0.75]}'), 'nebula renders at reduced resolution');
  assert.ok(bg.includes('uLight'), 'nebula and stars re-tint for light mode');
  assert.ok(bg.includes("getAttribute('data-theme')"), 'canvas follows the theme toggle live');
});

test('3D theme: home has scroll prompt and Explore section with real routes', () => {
  const home = read('app/page.tsx');
  assert.ok(home.includes('ExploreStudio'), 'home renders the explore section');
  assert.ok(home.includes("scrollToSection('#about')"), 'hero scroll prompt exists');
  assert.ok(home.includes('id="about"'), 'about section is the scroll target');
  const scene = read('components/Scene/ExploreScene.tsx');
  assert.ok(scene.includes('OrbitControls'), 'orbitable studio scene');
  assert.ok(scene.includes('alpha: true'), 'studio canvas is transparent so the nebula shows through');
  assert.ok(scene.includes('#7B2FF7') && scene.includes('#FF3CAC') && scene.includes('#22D3EE'), 'studio objects use the cosmic palette');
  assert.ok(scene.includes('Reset view'), 'reset view button');
  for (const route of ['/team', '/projects']) {
    assert.ok(scene.includes(`href: '${route}'`), `explore object links to ${route}`);
  }
  for (const route of ['/achievements', '/gallery']) {
    assert.ok(!scene.includes(`href: '${route}'`), `explore object must not link to removed ${route}`);
  }
  const explore = read('components/ExploreStudio.tsx');
  assert.ok(explore.includes("dynamic(() => import('./Scene/ExploreScene'), { ssr: false"), 'studio scene lazy + client-only');
});

test('hero shows the AICT full form', () => {
  const home = read('app/page.tsx');
  assert.ok(home.includes('Application of Information and Communication Technologies'));
  assert.ok(home.includes('hero-fullform'));
});

test('upload: browser never sends folder separately (2026-10-30 doubled-path verify 404)', () => {
  for (const f of ['app/admin/page.tsx', 'app/member/page.tsx', 'lib/upload.ts']) {
    assert.ok(!read(f).includes("form.append('folder'"), f + ' must not send folder');
  }
  assert.ok(read('lib/upload.ts').includes("form.append('public_id'"));
});

test('member cards show the photo when photo_url exists, initials otherwise', () => {
  for (const f of ['app/team/page.tsx', 'app/page.tsx', 'app/admin/page.tsx']) {
    const page = read(f);
    assert.ok(page.includes("m.photo_url?.startsWith('http')"), f + ' checks photo_url');
    assert.ok(page.includes('className="avatar-img"'), f + ' renders the photo in the card');
    assert.ok(page.includes('className="avatar"'), f + ' keeps the initials fallback');
  }
  const css = read('styles/globals.css');
  assert.ok(css.includes('.avatar-img'), 'avatar-img style exists');
  assert.ok(css.includes('object-fit: cover'), 'card photos crop to a circle');
});

test('upload verify uses Cloudinary\'s returned public_id, not just the signed one (2026-10-30 resume verify 404)', () => {
  const up = read('lib/upload.ts');
  assert.ok(up.includes('j.public_id'), 'direct upload reads the upload response public_id');
  for (const f of ['app/admin/page.tsx', 'app/member/page.tsx']) {
    assert.ok(read(f).includes('j.public_id || d.public_id'), f + ' verifies the stored public_id');
  }
});

test('video upload creates a project card shown in Projects (2026-10-30)', () => {
  const helper = read('lib/videoProject.ts');
  assert.match(helper, /export async function createVideoProject/);
  assert.match(helper, /\/admin\/projects/);
  assert.match(helper, /category: input.category \|\| 'AI Video'/);
  assert.match(helper, /video_url/);
  for (const f of ['app/admin/page.tsx', 'app/member/page.tsx']) {
    const page = read(f);
    assert.match(page, /createVideoProject/, f + ' calls the video-to-project helper');
    assert.match(page, /uploadType === 'video'/, f + ' only creates a card for videos');
  }
  const projects = read('app/projects/page.tsx');
  assert.match(projects, /projectThumbnail/, 'project cards use a thumbnail, not an inline player');
  assert.ok(!/<video/.test(projects), 'the list page must not embed a player per card');
  assert.match(projects, /project-card/, 'the whole card links to the details page');
});

test('video project cards and details: thumbnail, storyline, characters, team (2026-10-31)', () => {
  const thumb = read('lib/videoThumb.ts');
  assert.match(thumb, /res\.cloudinary\.com/, 'thumbnails derive from Cloudinary video URLs');
  assert.match(thumb, /so_0,f_jpg,w_800/, 'thumbnail is a first-frame jpg, 800px wide');
  assert.match(thumb, /cover_url \|\| videoThumbnailUrl/, 'an admin cover wins over a derived thumbnail');
  const helper = read('lib/videoProject.ts');
  assert.match(helper, /cover_url: input.coverUrl || videoThumbnailUrl/, 'a video upload stores its thumbnail as the project cover');
  const detail = read('app/projects/[slug]/detail.tsx');
  assert.match(detail, /poster=\{thumb/, 'the detail player uses the thumbnail as its poster');
  assert.match(detail, /Storyline &amp; plot/, 'video details show a storyline section');
  assert.match(detail, /Characters involved/, 'video details show a characters section');
  assert.match(detail, /Team &amp; group members/, 'video details show group/member info');
  assert.match(detail, /projectThumbnail\(r\)/, 'related cards also show thumbnails');
  const form = read('components/adminForms.tsx');
  assert.match(form, /Characters involved/, 'the project form lets an admin enter characters');
  const css = read('styles/globals.css');
  assert.match(css, /\.project-thumb/, 'thumbnail CSS exists');
  assert.match(css, /aspect-ratio: 16 \/ 9/, 'thumbnails keep a 16:9 ratio on any screen');
});

test('dropdown options are readable in dark theme (2026-10-31 Uploads screenshot)', () => {
  const css = read('styles/globals.css');
  assert.match(css, /color-scheme: dark/, 'dark theme must tell the browser to render native controls dark');
  assert.match(css, /color-scheme: light/, 'light theme must tell the browser to render native controls light');
  assert.match(css, /select option \{ background-color: var\(--bg\); color: var\(--text\); \}/, 'options must carry explicit background + text colours, not inherit translucent select colours');
});

test('video upload form asks for storyline, characters, technology and team (2026-10-31)', () => {
  const helper = read('lib/videoProject.ts');
  assert.match(helper, /export function splitCsv/, 'comma-separated values share one split rule');
  assert.match(helper, /case_study:/, 'upload storyline is sent as case_study');
  assert.match(helper, /characters:/, 'upload characters are sent as characters');
  assert.match(helper, /tech_stack:/, 'upload technology is sent as tech_stack');
  assert.match(helper, /member_ids:/, 'selected members are sent as member_ids');
  assert.match(helper, /project_members:/, 'selected members are sent as project_members');
  assert.ok(!/memberId\?:/.test(helper), 'the old single-memberId path is gone (both call sites use memberIds)');
  for (const f of ['app/admin/page.tsx', 'app/member/page.tsx']) {
    const page = read(f);
    assert.match(page, /Storyline & plot/, f + ' asks for storyline');
    assert.match(page, /Characters involved/, f + ' asks for characters');
    assert.match(page, /Technology/, f + ' asks for technology');
    assert.match(page, /setUploadStoryline\(''\)/, f + ' clears storyline on successful upload');
    assert.match(page, /setUploadCharacters\(''\)/, f + ' clears characters on successful upload');
    assert.match(page, /setUploadTechnology\(''\)/, f + ' clears technology on successful upload');
  }
  const admin = read('app/admin/page.tsx');
  assert.match(admin, /Team & group members/, 'admin upload form offers team selection');
  assert.match(admin, /uploadTeam/, 'admin upload form tracks selected members');
  assert.match(admin, /type="checkbox"/, 'admin team selection uses checkboxes');
  const member = read('app/member/page.tsx');
  assert.ok(!/uploadTeam/.test(member), 'member upload form must not offer other members (backend strips them anyway)');
  assert.ok(!/Team & group members/.test(member), 'member upload form has no team selection');
});

test('own account link: users tab says role/status are refused but own profile linking is allowed (2026-10-31)', () => {
  const admin = read('app/admin/page.tsx');
  assert.match(admin, /cannot change your own role or status/, 'users tab note must match the new backend rule');
  assert.ok(!/cannot change your own account from this page/.test(admin), 'old blanket self-change note must be gone');
  assert.match(admin, /Profile linked to \$\{next\.full_name\}/, 'Save link message must name the newly selected profile, not the old one');
});

test('upload cards have an Edit button that saves title/description via media/meta (2026-10-31)', () => {
  for (const f of ['app/admin/page.tsx', 'app/member/page.tsx']) {
    const src = read(f);
    assert.match(src, /setEditingMedia\(f\)/, f + ' media card must open the edit form');
    assert.match(src, /Edit upload details/, f + ' must render the edit modal');
    assert.match(src, /apiSend\('\/admin\/media\/meta', 'POST'/, f + ' must save through the existing media/meta endpoint');
    assert.match(src, /maxLength=\{120\}/, f + ' title must keep the 120-char limit');
    assert.match(src, /maxLength=\{500\}/, f + ' description must keep the 500-char limit');
  }
});

test('footer does not render on admin pages, still renders elsewhere (2026-10-31)', () => {
  const layout = read('components/layout.tsx');
  assert.match(layout, /usePathname/, 'Footer must read the current route');
  assert.match(layout, /pathname === '\/admin' \|\| pathname\.startsWith\('\/admin\/'\)/, 'Footer must hide on /admin and /admin/*');
  assert.match(layout, /return null;/, 'Footer must return nothing on admin routes');
  assert.match(layout, /© \{year\} \{siteName\}/, 'Footer content must still exist for public pages');
});

test('public resume viewer goes through the signed backend proxy, not the raw Cloudinary URL (2026-10-31)', () => {
  const detail = read('app/team/[slug]/detail.tsx');
  assert.match(detail, /API_URL\}\/members\/\$\{m\.slug\}\/resume/, 'detail page must build the proxy resume URL');
  assert.ok(!/src=\{m\.resume_path\}/.test(detail), 'embed must not point at the raw Cloudinary URL (CSP frame block + 401)');
  assert.ok(!/href=\{m\.resume_path\}/.test(detail), 'resume links must not point at the raw Cloudinary URL');
  assert.ok(!/<embed/.test(detail), 'resume must not be embedded in a modal viewer (opens in a new tab instead)');
  assert.match(detail, /href=\{resumeUrl\} target="_blank"/, 'View resume must open the PDF in a new full tab');
  const toml = read('netlify.toml');
  assert.match(toml, /frame-src 'self' https:\/\/res\.cloudinary\.com/, 'CSP must allow framing Cloudinary for the signed redirect');
  assert.match(toml, /object-src 'self' https:\/\/res\.cloudinary\.com https:\/\/aict-portfolio\.vercel\.app/, 'CSP object-src must allow the Vercel resume proxy origin or every <embed> is blocked');
  assert.match(toml, /frame-src 'self' https:\/\/res\.cloudinary\.com https:\/\/aict-portfolio\.vercel\.app/, 'CSP frame-src must allow the Vercel resume proxy origin too');
});

test('public pages never show a red error box or the technical server message (2026-10-31)', () => {
  for (const f of ['app/page.tsx', 'app/team/page.tsx', 'app/projects/page.tsx', 'app/skills/page.tsx', 'app/team/[slug]/detail.tsx', 'app/projects/[slug]/detail.tsx']) {
    const src = read(f);
    assert.ok(!/ErrorBox/.test(src), f + ' must not render ErrorBox');
    assert.ok(!/Could not reach/.test(src), f + ' must not show the technical server message');
  }
  // Detail pages still distinguish a genuinely unknown slug, as plain text.
  assert.match(read('app/team/[slug]/detail.tsx'), /Member not found/);
  assert.match(read('app/projects/[slug]/detail.tsx'), /Project not found/);
});
test('apiGet retries transient network failures silently', () => {
  const api = read('lib/api.ts');
  assert.match(api, /attempt/);
  assert.match(api, /setTimeout/);
});

test('member uploads: Video option only for the Group Leader (2026-10-31)', () => {
  const member = read('app/member/page.tsx');
  assert.match(member, /myProfile\?\.\is_leader \? <option value="video"/);
  assert.match(member, /Video uploads are limited to the Group Leader and admins/);
  // Admin uploads stay unrestricted.
  assert.match(read('app/admin/page.tsx'), /<option value="video">Video \(MP4\/WebM, max 50 MB\)<\/option>/);
});

test('YouTube-like video upload form (2026-10-31)', () => {
  for (const f of ['app/admin/page.tsx', 'app/member/page.tsx']) {
    const src = read(f);
    assert.match(src, /Custom thumbnail/);
    assert.match(src, /Category/);
    assert.match(src, /Tags/);
    assert.match(src, /Visibility/);
    assert.match(src, /value="unlisted"/);
    assert.match(src, /value="private"/);
    assert.match(src, /uploadDirectFile/);
  }
  const vp = read('lib/videoProject.ts');
  assert.match(vp, /coverUrl/);
  assert.match(vp, /visibility/);
  assert.match(vp, /tags/);
  assert.match(vp, /videoProjectSuccessMessage/);
  const form = read('components/adminForms.tsx');
  assert.match(form, /Tags \(comma-separated\)/);
  assert.match(form, /Select label="Visibility"/);
  assert.match(read('app/projects/[slug]/detail.tsx'), /Tags<\/h2>/);
});

test('silent token refresh: refresher mints a fresh Firebase token before the 1h expiry (2026-10-31)', () => {
  const refresher = read('components/TokenRefresher.tsx');
  assert.match(refresher, /getIdToken\(true\)/, 'must force-refresh the Firebase ID token');
  assert.match(refresher, /aict_admin_token/, 'refreshed token must replace the stored token');
  assert.match(refresher, /50 \* 60 \* 1000/, 'refresh interval must sit inside the ~1h token lifetime');
  const layout = read('app/layout.tsx');
  assert.match(layout, /TokenRefresher/, 'refresher must be mounted in the root layout');
  const member = read('app/member/page.tsx');
  assert.match(member, /Group Leader videos go live at once/, 'member upload note must state the leader live rule');
});

test('account cards expose a role control for other accounts, never for your own (2026-10-31)', () => {
  const admin = read('app/admin/page.tsx');
  assert.match(admin, /<label>Role<select/, 'account cards must offer a Role select (backend PATCH already supports role)');
  assert.match(admin, /u\.id === meUid \? null : \(<label>Role/, 'your own card must not offer a role change (server refuses self role changes)');
  assert.match(admin, /Grant admin to this account/, 'granting admin must ask for confirmation, like the invite form');
});

test('video format: upload forms offer Shorts vs full-length, helper sends it, card and detail show it (2026-10-31)', () => {
  const admin = read('app/admin/page.tsx');
  const member = read('app/member/page.tsx');
  assert.match(admin, /name="admin-upload-format"/, 'admin upload form must offer a format choice');
  assert.match(member, /name="member-upload-format"/, 'member upload form must offer a format choice');
  assert.match(admin, /uploadVideoFormat === 'short'/, 'admin form must track the Shorts choice');
  assert.match(member, /uploadVideoFormat === 'short'/, 'member form must track the Shorts choice');
  const helper = read('lib/videoProject.ts');
  assert.match(helper, /video_format: input\.videoFormat \|\| 'full'/, 'video project creation must send the chosen format');
  const card = read('app/projects/page.tsx');
  assert.match(card, /video_format === 'short' && <span className="chip">Shorts<\/span>/, 'project cards must badge Shorts videos');
  const detail = read('app/projects/[slug]/detail.tsx');
  assert.match(detail, /video_format === 'short' \? ' · Shorts'/, 'detail page must show the format');
  const forms = read('components/adminForms.tsx');
  assert.match(forms, /label="Format"/, 'project edit form must allow changing the format for video projects');
});
