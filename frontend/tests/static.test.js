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
    assert.ok(page.includes("m.photo_url?.startsWith('http')") || page.includes('safeSrc(m.photo_url)'), f + ' checks photo_url (direct http check or the audit safe-URL guard)');
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
  assert.match(admin, /Your own role, status and password cannot be changed here/, 'users tab note must match the self-change rule');
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
  assert.match(detail, /API_URL\}\/members\/\$\{encodeURIComponent\(m\.slug\)\}\/resume/, 'detail page must build the proxy resume URL with an encoded slug');
  assert.ok(!/src=\{m\.resume_path\}/.test(detail), 'embed must not point at the raw Cloudinary URL (CSP frame block + 401)');
  assert.ok(!/href=\{m\.resume_path\}/.test(detail), 'resume links must not point at the raw Cloudinary URL');
  assert.ok(!/<embed/.test(detail), 'resume must not be embedded in a modal viewer (opens in a new tab instead)');
  assert.match(detail, /href=\{resumeUrl\} target="_blank"/, 'View resume must open the PDF in a new full tab');
  // Audit hardening: the resume modal embed is gone (new-tab view
  // since 2026-10-31), so frame/object-src no longer need Cloudinary
  // or Vercel origins. frame-src now allows ONLY the YouTube embed
  // origins (2026-10-31 player fix); anything else framed from
  // elsewhere is still blocked by default.
  const toml = read('netlify.toml');
  assert.ok(!/res\.cloudinary\.com/.test(toml.split('frame-src')[1].split(';')[0]), 'stale Cloudinary frame origin must be gone');
  assert.ok(!/aict-portfolio\.vercel\.app/.test(toml.split('frame-src')[1].split(';')[0]), 'stale Vercel frame origin must be gone');
  assert.match(toml, /object-src 'self'/, 'CSP object-src must be self-only now that no resume embed exists');
  assert.ok(!/object-src 'self' https/.test(toml), 'stale Cloudinary/Vercel object origins must be gone');
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
  assert.match(read('app/admin/page.tsx'), /<option value="video">Video \(MP4\/WebM, max 100 MB\)<\/option>/);
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
  assert.match(admin, /u\.id !== meUid && \(<label>Role<select/, 'account cards must offer a Role select for other accounts (backend PATCH already supports role)');
  assert.ok(!/u\.id === meUid && \(<label>Role/.test(admin), 'your own card must not offer a role change (server refuses self role changes)');
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

test('audit: sign-out signs out of Firebase, not just localStorage (FE-01)', () => {
  const session = read('lib/session.ts');
  assert.match(session, /signOut\(auth\)/, 'sign-out must call Firebase signOut');
  assert.match(session, /removeItem\('aict_admin_token'\)/, 'sign-out must still clear the stored token');
  for (const f of ['app/admin/page.tsx', 'app/member/page.tsx']) {
    const src = read(f);
    assert.match(src, /signOutSession/, f + ' must use the shared sign-out');
    assert.ok(!/localStorage\.removeItem\('aict_admin_token'\)/.test(src), f + ' must not sign out by localStorage removal alone');
  }
  const refresher = read('components/TokenRefresher.tsx');
  assert.match(refresher, /if \(!user\) \{ window\.localStorage\.removeItem\('aict_admin_token'\)/, 'refresher must clear the token when Firebase reports no user');
});
test('audit: stored URLs are scheme-checked before rendering (FE-02)', () => {
  const guard = read('lib/safeUrl.ts');
  assert.match(guard, /javascript/, 'guard must name the javascript scheme it refuses');
  assert.ok(/isSafeHttpUrl/.test(guard));
  for (const f of ['app/team/[slug]/detail.tsx', 'app/projects/[slug]/detail.tsx', 'app/page.tsx', 'app/team/page.tsx', 'app/projects/page.tsx', 'components/layout.tsx']) {
    assert.match(read(f), /safeSrc|safeHref/, f + ' must scheme-check stored URLs');
  }
  assert.ok(!/href=\{p\.video_url\}/.test(read('app/projects/[slug]/detail.tsx')), 'project video link must not render an unchecked URL');
});
test('audit: detail slugs are encoded and malformed slugs become not-found (FE-04)', () => {
  for (const f of ['app/team/[slug]/detail.tsx', 'app/projects/[slug]/detail.tsx']) {
    const src = read(f);
    assert.match(src, /encodeURIComponent\(actualSlug\)/, f + ' must encode the slug in the API call');
    assert.match(src, /try \{ actualSlug = decodeURIComponent/, f + ' must catch a malformed slug instead of hanging');
  }
});
test('audit: apiGet distinguishes an upstream HTML error from a network failure (FE-05)', () => {
  const api = read('lib/api.ts');
  assert.match(api, /upstream_error/, 'non-JSON responses must surface as upstream_error, not network_error');
  assert.match(api, /content-type/, 'the parser must check the content type before parsing JSON');
});
test('audit: uploads have a timeout and a cancel control (FE-10)', () => {
  for (const f of ['app/admin/page.tsx', 'app/member/page.tsx']) {
    const src = read(f);
    assert.match(src, /xhr\.timeout = uploadType === 'video' \? 0 : 120000/, f + ' upload XHR must time out for small files but not for large videos');
    assert.match(src, /Cancel upload/, f + ' upload must offer a cancel button');
  }
  assert.match(read('lib/upload.ts'), /ontimeout/, 'direct upload helper must time out too');
});
test('audit: ConfirmDialog labels match the action (FE-09) and own card hides password controls (FE-07)', () => {
  const admin = read('app/admin/page.tsx');
  assert.match(admin, /confirmLabel=\{confirmUserAction\.kind/, 'user-action confirm dialog must label itself by action');
  assert.match(admin, /u\.id === meUid \? <p className="muted">This is your account\.<\/p> : \(<><label>Set \/ reset password/, 'your own card must not show password fields');
  assert.match(admin, /u\.id !== meUid && u\.account_status === 'active'/, 'your own card must not show Deactivate');
});
test('audit: forms strip privilege fields and clamp skill levels (FE-06)', () => {
  const forms = read('components/adminForms.tsx');
  assert.match(forms, /delete \(body as AnyObj\)\.id/, 'forms must not send the record id in PATCH bodies');
  assert.match(forms, /delete \(body as AnyObj\)\.is_leader/, 'forms must not send is_leader except through the admin leader checkbox');
  assert.match(forms, /Math\.max\(1, Math\.min\(100/, 'skill levels must be clamped to 1-100');
});

test('login redesign (2026-10-31): centred card, in-field show-password, role switch link, logic unchanged', () => {
  const form = read('components/loginForm.tsx');
  assert.match(form, /className="login-shell"/, 'login must render in the centred shell');
  assert.match(form, /className="login-card"/, 'login must render as a card, not loose fields');
  assert.match(form, /TechHive/, 'login card must name the site (renamed from AICT Group, 2026-10-31)');
  assert.match(form, /login-show-btn/, 'show-password must be an in-field button, not a checkbox below the form');
  assert.ok(!/type="checkbox"/.test(form), 'the old show-password checkbox must be gone');
  assert.match(form, /switchHref/, 'login must link to the other login route (member <-> admin)');
  assert.match(form, /Forgot password\?/, 'forgot password must stay');
  assert.match(form, /There is no sign-up|no sign-up/, 'invite-only note must stay');
  assert.match(form, /signInExisting/, 'sign-in logic must be unchanged');
  assert.match(form, /friendlyAuthError/, 'safe error mapping must be unchanged');
  assert.match(form, /role="alert"/, 'sign-in errors must be announced');
  const css = read('styles/globals.css');
  assert.match(css, /\.login-card/, 'login card styles must exist');
  assert.match(css, /\.login-submit/, 'full-width submit styles must exist');
  assert.ok(/\.login-shell \{[^}]*animation: none/.test(css) || /prefers-reduced-motion: reduce[\s\S]*\.login-shell \{ animation: none/.test(css), 'login entrance must respect reduced motion');
});

test('site rename to TechHive (2026-10-31): displayed name is TechHive, not AICT Group', () => {
  assert.match(read('app/layout.tsx'), /title: 'TechHive'/, 'browser title must be TechHive');
  assert.match(read('app/page.tsx'), /group_name \|\| 'TechHive'/, 'home heading fallback must be TechHive');
  assert.match(read('components/layout.tsx'), /group_name \|\| 'TechHive'/, 'header brand fallback must be TechHive');
  assert.match(read('components/loginForm.tsx'), /TechHive/, 'login card must say TechHive');
  for (const f of ['app/page.tsx', 'components/layout.tsx', 'components/loginForm.tsx', 'app/layout.tsx']) {
    assert.ok(!/AICT Group/.test(read(f)), f + ' must not fall back to the old site name');
  }
});

test('UI/UX audit (2026-10-31): reduced-motion, mobile menu trap, page titles, invite show/hide', () => {
  const scroll = read('lib/scroll3d.ts');
  assert.match(scroll, /export function reducedMotion/, 'reducedMotion helper must exist');
  assert.match(scroll, /data-reduce/, 'reduced check must include the site Reduce toggle, not only the OS setting');
  assert.match(scroll, /export function applySmoothScrollPreference/, 'live preference re-apply must exist');
  const layout = read('components/layout.tsx');
  assert.match(layout, /applySmoothScrollPreference\(\)/, 'Reduce toggle must re-apply the scroll preference');
  assert.match(layout, /menuRef/, 'mobile menu must carry a ref for focus trapping');
  assert.match(layout, /e.key !== 'Tab'/, 'mobile menu key handler must trap Tab, not only Escape');
  assert.match(layout, /export function PageTitle/, 'per-page titles component must exist');
  assert.match(layout, /Team \| TechHive/, 'team page title must be mapped');
  assert.match(read('app/layout.tsx'), /<PageTitle \/>/, 'PageTitle must be mounted in the root layout');
  const ui = read('components/ui.tsx');
  assert.match(ui, /export function focusables/, 'focus helper must be shared with the mobile menu');
  const home = read('app/page.tsx');
  assert.match(home, /aria-hidden="true">AI videos<\/span>/, 'rotating hero words must be hidden from screen readers (wrapper aria-label reads once)');
  const invite = read('app/invite/page.tsx');
  assert.match(invite, /showPw/, 'invite password field must offer show/hide');
  assert.match(invite, /aria-pressed=\{showPw\}/, 'invite show/hide must expose pressed state');
  assert.match(read('styles/globals.css'), /footer a \{ display: inline-block; padding: 11px 6px; \}/, 'footer links must reach ~44px targets');
  assert.match(read('styles/globals.css'), /\.nav \{ display: flex; flex-wrap: wrap;/, 'nav must wrap instead of overflowing at ~800px');
  assert.match(read('app/team/[slug]/detail.tsx'), /document\.title = `\$\{member\.full_name\} \| TechHive`/, 'member detail must set a specific title');
  assert.match(read('app/projects/[slug]/detail.tsx'), /document\.title = `\$\{project\.title\} \| TechHive`/, 'project detail must set a specific title');
});

test('video upload cap (2026-10-31): 100 MB free-plan ceiling, not 50 MB, with no 2-minute video timeout', () => {
  const sign = read('../backend/src/routes/admin.js');
  assert.match(sign, /file_type === 'video' \? 100 \* 1024 \* 1024/, 'sign cap must be 100 MB for video');
  const verify = read('../backend/src/verifyAsset.js');
  assert.match(verify, /expected === 'video' \? 100 \* 1024 \* 1024/, 'verify cap must be 100 MB for video');
  for (const f of ['app/admin/page.tsx', 'app/member/page.tsx']) {
    const src = read(f);
    assert.match(src, /100 \* 1024 \* 1024/, f + ' must allow 100 MB videos');
    assert.match(src, /xhr\.timeout = uploadType === 'video' \? 0 : 120000/, f + ' must not time out a large video after 2 minutes');
    assert.ok(!src.includes('max 50 MB'), f + ' must not still advertise the old 50 MB video cap');
  }
});

test('Team accounts simplification + admin lazy-load (2026-10-31)', () => {
  const admin = read('app/admin/page.tsx');
  assert.match(admin, /expandedUser/, 'account cards must collapse details behind a Manage toggle');
  assert.match(admin, /aria-expanded=\{expanded\}/, 'Manage toggle must expose expanded state');
  assert.match(admin, /onChange=\{\(e\) => \{ const value = e\.target\.value; setLinkDraft/, 'profile-link dropdown must auto-save on change (no separate Save link button)');
  assert.ok(!/Save link/.test(admin), 'the old Save link button must be gone');
  assert.match(admin, /pendingLinks\.filter\(\(l\) => !l\.used && !l\.revoked\)\.length > 0 \|\| linksError/, 'pending invitation links section must hide when empty');
  assert.match(admin, /Send setup email again/, 'resend action must use a plain label');
  assert.match(admin, /Yes, cancel invitation/, 'revoke confirm must use a plain label');
  assert.match(admin, /autoComplete="off"/, 'invite name/email must carry autofill guards');
  assert.match(admin, /autoComplete="new-password"/, 'account password fields must carry autofill guards');
  assert.match(admin, /reload\(true\)/, 'first admin load must fetch only the visible tabs');
  assert.match(admin, /loadSection/, 'hidden-tab data must load on demand when its tab opens');
  assert.ok(!/apiGet<ContactMessage\[\]>\('\/admin\/messages', true\)/.test(admin.split('if (!coreOnly)')[0]), 'first load must not fetch messages');
});

test('admin nav (2026-10-31): Projects tab brought back so admins can link YouTube videos', () => {
  const admin = read('app/admin/page.tsx');
  assert.match(admin, /VISIBLE_TAB_IDS: Tab\[\] = \['overview', 'members', 'users', 'media', 'projects'\]/, 'Projects must be a visible admin tab');
  assert.match(admin, /tab === 'projects'/, 'Projects panel must exist for the tab');
});

test('YouTube project thumbnails (2026-10-31): youtu.be / watch / shorts links get an i.ytimg.com still, not the grey placeholder', () => {
  const vt = read('lib/videoThumb.ts');
  assert.match(vt, /export function youtubeThumbnailUrl/, 'a YouTube thumbnail helper must exist');
  assert.match(vt, /i\.ytimg\.com\/vi\//, 'thumbnails must come from i.ytimg.com');
  assert.match(vt, /hqdefault\.jpg/, 'hqdefault must be used (maxres does not exist for every video)');
  assert.match(vt, /projectThumbnail.*youtubeThumbnailUrl/s, 'projectThumbnail must fall back to the YouTube still when there is no cover or Cloudinary thumb');
  const detail = read('app/projects/[slug]/detail.tsx');
  assert.match(detail, /youtubeEmbedUrl\(p\.video_url\)/, 'detail page must embed YouTube videos in-site instead of linking out only');
  assert.match(detail, /<iframe src=\{ytEmbed\}/, 'detail page must render an iframe player for YouTube links');
  assert.match(detail, /aspectRatio: p\.video_format === 'short' \? '9 \/ 16' : '16 \/ 9'/, 'Shorts must play in a tall frame, full-length in 16:9');
});

test('video cards attractive (2026-10-31): thumbnail zoom, gradient, play button grows on hover', () => {
  const css = read('styles/globals.css');
  assert.match(css, /\.project-card:hover \.project-thumb \{ transform: scale\(1\.05\)/, 'card thumbnail must zoom on hover');
  assert.match(css, /\.project-card:hover \.project-play \{ transform: translate\(-50%, -50%\) scale\(1\.18\)/, 'play button must grow on hover');
  assert.match(css, /\.project-thumb-wrap::after/, 'thumbnail must carry a bottom gradient so the play button reads on bright frames');
  const vt = read('lib/videoThumb.ts');
  assert.match(vt, /export function youtubeEmbedUrl/, 'an embed-URL helper must exist');
  assert.match(vt, /youtube\.com\/embed\//, 'embed URL must use the youtube-nocookie-free embed host path');
});

test('project detail storyline (2026-10-31): pasted \\n / \\. escapes render as paragraphs, not a literal wall', () => {
  const detail = read('app/projects/[slug]/detail.tsx');
  assert.match(detail, /cleanText/, 'detail page must clean pasted text before rendering');
  assert.match(detail, /storyParas/, 'storyline must split into paragraphs');
  assert.match(detail, /whiteSpace: 'pre-line'/, 'paragraphs must preserve single line breaks');
  assert.ok(!/\{p\.case_study\}/.test(detail.replace(/storyParas/g, '')), 'case_study must not render raw anymore');
});

test('CSP allows YouTube embeds (2026-10-31): a frame-src without youtube renders the player as a blank white box', () => {
  const toml = read('netlify.toml');
  assert.match(toml, /frame-src 'self' https:\/\/www\.youtube\.com https:\/\/www\.youtube-nocookie\.com/, 'frame-src must allow both YouTube embed origins');
  assert.match(toml, /object-src 'self'/, 'object-src must stay self-only (resumes open in a new tab)');
});

test('hydration (2026-10-31): theme/reduce toggles must not read localStorage during first render (React #418)', () => {
  const layout = read('components/layout.tsx');
  assert.ok(!/useState<string>\(\(\) => readTheme\(\)\)/.test(layout), 'ThemeToggle must not initialise from localStorage during render');
  assert.ok(!/useState<boolean>\(\(\) => readReduce\(\)\)/.test(layout), 'ReduceToggle must not initialise from localStorage during render');
  assert.match(layout, /useState<string>\('light'\)/, 'ThemeToggle must start from the server value');
  assert.match(layout, /useEffect\(\(\) => \{ const stored = window\.localStorage\.getItem\('aict_theme'\)/, 'stored theme must sync in useEffect after hydration');
});
test('shorts player height (2026-10-31): tall 9:16 frame must be capped so it does not fill the screen', () => {
  const detail = read('app/projects/[slug]/detail.tsx');
  assert.match(detail, /maxWidth: p\.video_format === 'short' \? 'min\(100%, 300px, 35vh\)'/, 'shorts frame width must cap height at ~533px and ~62vh');
});
