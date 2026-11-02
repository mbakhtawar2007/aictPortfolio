'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { apiGet } from '../lib/api';
import { applySmoothScrollPreference } from '../lib/scroll3d';
import { focusables } from './ui';
import type { SiteSettings } from '../lib/types';
import { safeHref, safeSrc } from '../lib/safeUrl';

// Hydration rule (2026-10-31, React error #418): the first render must be
// identical on server and client. Reading localStorage during render
// broke this — the server always rendered 'light'/false while the client
// rendered the stored 'dark'/true, so every page failed hydration.
// Initial state is therefore the server value; stored preferences are
// applied in useEffect, after hydration. The inline theme script in the
// root layout already paints the right colours before hydration, so the
// toggle icon is the only thing that syncs a beat later.
export function ThemeToggle() {
  const [theme, setTheme] = useState<string>('light');
  useEffect(() => { const stored = window.localStorage.getItem('aict_theme') || 'dark'; setTheme(stored); document.documentElement.setAttribute('data-theme', stored); }, []);
  const toggle = () => { const next = theme === 'dark' ? 'light' : 'dark'; document.documentElement.setAttribute('data-theme', next); window.localStorage.setItem('aict_theme', next); setTheme(next); };
  return (<button className="icon-btn" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} title="Toggle theme" onClick={toggle}>{theme === 'dark' ? '☀' : '☾'}</button>);
}
export function ReduceToggle() {
  const [reduce, setReduce] = useState<boolean>(false);
  useEffect(() => { const stored = window.localStorage.getItem('aict_reduce') === 'true'; setReduce(stored); if (stored) document.documentElement.setAttribute('data-reduce', 'true'); }, []);
  const toggle = () => { const next = !reduce; document.documentElement.setAttribute('data-reduce', next ? 'true' : 'false'); window.localStorage.setItem('aict_reduce', next ? 'true' : 'false'); setReduce(next); applySmoothScrollPreference(); };
  return (<button className="btn secondary small" aria-pressed={reduce} onClick={toggle}>{reduce ? '✓ Effects reduced' : 'Reduce effects'}</button>);
}
const PAGE_TITLES: [RegExp, string][] = [
  [/^\/$/, 'TechHive'],
  [/^\/team\/[^/]+$/, 'Team member | TechHive'],
  [/^\/team$/, 'Team | TechHive'],
  [/^\/projects\/[^/]+$/, 'Project | TechHive'],
  [/^\/projects$/, 'Projects | TechHive'],
  [/^\/skills$/, 'Skills | TechHive'],
  [/^\/contact$/, 'Contact | TechHive'],
  [/^\/admin\/login$/, 'Admin login | TechHive'],
  [/^\/admin$/, 'Admin | TechHive'],
  [/^\/login$/, 'Member login | TechHive'],
  [/^\/member$/, 'My profile | TechHive'],
  [/^\/dashboard$/, 'Dashboard | TechHive'],
  [/^\/invite$/, 'Invitation | TechHive'],
];
/** Per-page browser titles (the static export has one root title for every page). Detail pages override this after their data loads. */
export function PageTitle() {
  const pathname = usePathname() || '/';
  useEffect(() => {
    const hit = PAGE_TITLES.find(([re]) => re.test(pathname));
    document.title = hit ? hit[1] : 'TechHive';
  }, [pathname]);
  return null;
}
export function Navbar() {
  const [site, setSite] = useState<SiteSettings | null>(null);
  useEffect(() => { apiGet<SiteSettings>('/site').then((r) => { if (!r.error) setSite(r.data || null); }); }, []);
  const [open, setOpen] = useState(false);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); burgerRef.current?.focus(); return; }
      // Trap Tab inside the menu: it is a modal dialog, so focus must not escape to the page behind it.
      if (e.key !== 'Tab' || !menuRef.current) return;
      const items = focusables(menuRef.current); if (!items.length) { e.preventDefault(); return; }
      const firstEl = items[0]; const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const onScroll = () => { const h = document.documentElement; const max = h.scrollHeight - h.clientHeight; setProgress(max > 0 ? (h.scrollTop / max) * 100 : 0); };
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll(); return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const links = [['/', 'Home'], ['/team', 'Team'], ['/projects', 'Projects'], ['/skills', 'Skills'], ['/contact', 'Contact']];
  return (<header className="site-header">
    <div className="progress-bar" style={{ width: `${progress}%` }} aria-hidden="true" />
    <nav className="nav" aria-label="Main navigation">
      {safeSrc(site?.logo_url) ? <a href="/"><img src={safeSrc(site?.logo_url)} alt={site?.group_name || 'TechHive'} style={{ height: 32, borderRadius: 8, verticalAlign: 'middle' }} /></a> : <a className="brand" href="/">{site?.group_name || 'TechHive'}</a>}
      <span className="nav-links">{links.map(([href, label]) => (<a key={href} href={href}>{label}</a>))}</span>
      <span className="nav-actions"><a className="btn secondary small nav-login" href="/admin/login">Admin login</a><a className="btn secondary small nav-login" href="/login">Member login</a><ThemeToggle />
        <button ref={burgerRef} className="icon-btn nav-burger" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen(true)}>☰</button></span>
    </nav>
    {open && (<div className="mobile-menu" id="mobile-menu" ref={menuRef} role="dialog" aria-modal="true" aria-label="Menu">
      <button ref={closeRef} className="icon-btn mobile-close" aria-label="Close menu" onClick={() => { setOpen(false); burgerRef.current?.focus(); }}>×</button>
      {links.map(([href, label]) => (<a key={href} href={href} onClick={() => setOpen(false)}>{label}</a>))}
      <a className="btn" href="/contact" onClick={() => setOpen(false)}>Contact</a>
      <a className="btn secondary" href="/admin/login" onClick={() => setOpen(false)}>Admin login</a>
      <a className="btn secondary" href="/login" onClick={() => setOpen(false)}>Member login</a>
    </div>)}
  </header>);
}
export function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => { const onScroll = () => setShow(window.scrollY > 600); window.addEventListener('scroll', onScroll, { passive: true }); return () => window.removeEventListener('scroll', onScroll); }, []);
  if (!show) return null;
  return (<button className="back-to-top" aria-label="Back to top" onClick={() => { const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.getAttribute('data-reduce') === 'true'; window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }); }}>↑ Top</button>);
}
export function Footer() {
  // Admin pages are a workspace, not a public page: no public footer with
  // site links and the Reduce effects toggle (2026-10-31). This covers
  // /admin and /admin/login; /member is left unchanged.
  const pathname = usePathname() || '/';
  // Hooks first, early return after: the layout stays mounted while
  // navigating, so a return before these hooks would change hook order
  // when moving between /admin and a public page.
  const [siteName, setSiteName] = useState('TechHive');
  useEffect(() => { apiGet<SiteSettings>('/site').then((r) => { if (!r.error && r.data?.group_name) setSiteName(r.data.group_name); }); }, []);
  const year = new Date().getFullYear();
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return null;
  return (<footer>
    <p><strong>{siteName}</strong> — homepage, team profiles, projects and achievements.</p>
    <p><a href="/">Home</a> · <a href="/team">Team</a> · <a href="/projects">Projects</a> · <a href="/skills">Skills</a> · <a href="/contact">Contact</a></p>
    <p><a href={safeHref('https://github.com/mbakhtawar2007')} target="_blank" rel="noreferrer" aria-label="GitHub profile"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" /></svg></a>{' '}<a href={safeHref('https://www.linkedin.com/in/muhammad-bakhtawar-50502b2a8')} target="_blank" rel="noreferrer" aria-label="LinkedIn profile"><svg width="22" height="22" viewBox="0 0 24 24" fill="#0A66C2" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg></a></p>
    <p className="muted">© {year} {siteName}</p>
    <p><ReduceToggle /></p>
  </footer>);
}
