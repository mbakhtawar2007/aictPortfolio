'use client';
import { useEffect, useRef, useState } from 'react';

function readTheme(): string { if (typeof window === 'undefined') return 'dark'; return window.localStorage.getItem('aict_theme') || 'dark'; }
function readReduce(): boolean { if (typeof window === 'undefined') return false; return window.localStorage.getItem('aict_reduce') === 'true'; }

export function ThemeToggle() {
  const [theme, setTheme] = useState('dark');
  useEffect(() => { setTheme(readTheme()); }, []);
  const toggle = () => { const next = theme === 'dark' ? 'light' : 'dark'; document.documentElement.setAttribute('data-theme', next); window.localStorage.setItem('aict_theme', next); setTheme(next); };
  return (<button className="icon-btn" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} title="Toggle theme" onClick={toggle}>{theme === 'dark' ? '☀' : '☾'}</button>);
}
export function ReduceToggle() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => { setReduce(readReduce()); }, []);
  const toggle = () => { const next = !reduce; document.documentElement.setAttribute('data-reduce', next ? 'true' : 'false'); window.localStorage.setItem('aict_reduce', next ? 'true' : 'false'); setReduce(next); };
  return (<button className="btn secondary small" aria-pressed={reduce} onClick={toggle}>{reduce ? '✓ Effects reduced' : 'Reduce effects'}</button>);
}
export function Navbar() {
  const [open, setOpen] = useState(false);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); burgerRef.current?.focus(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const onScroll = () => { const h = document.documentElement; const max = h.scrollHeight - h.clientHeight; setProgress(max > 0 ? (h.scrollTop / max) * 100 : 0); };
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll(); return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const links = [['/', 'Home'], ['/team', 'Team'], ['/projects', 'Projects'], ['/achievements', 'Achievements'], ['/skills', 'Skills'], ['/contact', 'Contact']];
  return (<header className="site-header">
    <div className="progress-bar" style={{ width: `${progress}%` }} aria-hidden="true" />
    <nav className="nav" aria-label="Main navigation">
      <a className="brand" href="/">AICT</a>
      <span className="nav-links">{links.map(([href, label]) => (<a key={href} href={href}>{label}</a>))}</span>
      <span className="nav-actions"><ThemeToggle /><a href="/admin/login">Admin</a>
        <button ref={burgerRef} className="icon-btn nav-burger" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen(true)}>☰</button></span>
    </nav>
    {open && (<div className="mobile-menu" id="mobile-menu" role="dialog" aria-modal="true" aria-label="Menu">
      <button ref={closeRef} className="icon-btn mobile-close" aria-label="Close menu" onClick={() => { setOpen(false); burgerRef.current?.focus(); }}>×</button>
      {links.map(([href, label]) => (<a key={href} href={href} onClick={() => setOpen(false)}>{label}</a>))}
      <a href="/admin/login" onClick={() => setOpen(false)}>Admin</a>
      <a className="btn" href="/contact" onClick={() => setOpen(false)}>Contact</a>
    </div>)}
  </header>);
}
export function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => { const onScroll = () => setShow(window.scrollY > 600); window.addEventListener('scroll', onScroll, { passive: true }); return () => window.removeEventListener('scroll', onScroll); }, []);
  if (!show) return null;
  return (<button className="back-to-top" aria-label="Back to top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>↑ Top</button>);
}
export function Footer() {
  const year = new Date().getFullYear();
  const updated = new Date().toISOString().slice(0, 10);
  return (<footer>
    <p><strong>AICT Group</strong> — homepage, team profiles, projects and achievements, managed through the admin dashboard. Group name, logo and brand are still open decisions; this UI stays generic until the group supplies them.</p>
    <p><a href="/">Home</a> · <a href="/team">Team</a> · <a href="/projects">Projects</a> · <a href="/achievements">Achievements</a> · <a href="/skills">Skills</a> · <a href="/contact">Contact</a></p>
    <p className="muted">© {year} AICT Group · Last updated {updated} · No public sign-up: accounts are created by an admin only.</p>
    <p><ReduceToggle /></p>
  </footer>);
}
