// Build-time sitemap (2026-11-02, same pattern as generate-og-image.mjs).
// Lists the public routes plus every published team/project slug fetched
// from the public API. Admin/member/login/invite routes are deliberately
// excluded: they are gated workspaces, not public content. If the API
// cannot be reached (cold start, network blip), the build still succeeds
// with the static routes only — a missing slug list must never break a
// deploy. The file is gitignored and regenerated on every build.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE_URL = (process.env.PUBLIC_SITE_URL || 'https://aictportfollio.netlify.app').replace(/\/$/, '');
const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://aict-portfolio.vercel.app/api').replace(/\/$/, '');
const STATIC_ROUTES = ['', '/team', '/projects', '/skills', '/contact'];
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function slugs(path, key) {
  try {
    const res = await fetch(`${API_URL}${path}`, { signal: AbortSignal.timeout(8000) });
    const json = await res.json();
    const items = Array.isArray(json?.data) ? json.data : [];
    return items.map((x) => x?.slug).filter((s) => typeof s === 'string' && s.length > 0);
  } catch {
    return [];
  }
}

const [memberSlugs, projectSlugs] = await Promise.all([slugs('/members'), slugs('/projects')]);
const urls = [
  ...STATIC_ROUTES,
  ...memberSlugs.map((s) => `/team/${s}`),
  ...projectSlugs.map((s) => `/projects/${s}`),
];
const today = new Date().toISOString().slice(0, 10);
const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...urls.map((u) => `  <url><loc>${esc(SITE_URL + (u || '/'))}</loc><lastmod>${today}</lastmod></url>`),
  '</urlset>',
  '',
].join('\n');
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sitemap.xml');
writeFileSync(out, xml);
console.log(`sitemap: ${urls.length} urls (${memberSlugs.length} members, ${projectSlugs.length} projects) -> public/sitemap.xml`);
