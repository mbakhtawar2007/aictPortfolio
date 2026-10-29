'use client';
import { useEffect, useRef, useState } from 'react';
import { apiGet } from '../lib/api';
import type { Member, Project, Achievement, SiteSettings } from '../lib/types';
import { Loading, Empty, ErrorBox, SampleBadge, Section } from './shared';
import { SkeletonGrid } from '../components/ui';

function Counter({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null); const [n, setN] = useState(0); const started = useRef(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver((entries) => { if (entries[0].isIntersecting && !started.current) { started.current = true; const t0 = performance.now(); const tick = (t: number) => { const p = Math.min(1, (t - t0) / 800); setN(Math.round(value * p)); if (p < 1) requestAnimationFrame(tick); }; requestAnimationFrame(tick); } }, { threshold: 0.4 });
    obs.observe(el); return () => obs.disconnect();
  }, [value]);
  return <span ref={ref} className="stat">{n}</span>;
}
export default function Home() {
  const [site, setSite] = useState<SiteSettings | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const [s, m, p, a] = await Promise.all([apiGet<SiteSettings>('/site'), apiGet<Member[]>('/members'), apiGet<Project[]>('/projects'), apiGet<Achievement[]>('/achievements')]);
      if (s.error) setError(s.error.message); else setSite(s.data);
      setMembers(m.data || []); setProjects(p.data || []); setAchievements(a.data || []);
      setLoading(false);
    })();
  }, []);
  if (loading) return <SkeletonGrid count={4} />;
  const featured = projects.filter((p) => p.featured);
  const videoCount = projects.filter((p) => p.category === 'AI Video').length;
  return (<div>
    <div className="hero reveal">
      <h1>{site?.group_name || 'AICT Group'} <SampleBadge isSample={site?.isSample} /></h1>
      <h2>We create <span className="hero-words" aria-label="AI videos, AI tools, websites, stories"><span>AI videos</span><span>AI tools</span><span>websites</span><span>stories</span></span></h2>
      <p>{site?.tagline || 'Who we are, what we build, and what we have achieved.'}</p>
      <p><a className="btn" href="/team">Meet the Team</a> <a className="btn secondary" href="/projects">View Projects</a></p>
    </div>
    {error && <ErrorBox message={error} />}
    <Section title="About / Mission"><p>{site?.mission || 'Mission content is managed in the admin dashboard.'}</p><p className="muted">{site?.about || ''}</p></Section>
    <Section title="What We Do"><div className="grid">
      {['AI Video Creation', 'AI Projects', 'Web Development', 'Creative Storytelling'].map((t) => (<div className="card card-hover" key={t}><h3>{t}</h3><p className="muted">AI videos, AI tools and websites, presented as a team portfolio.</p></div>))}
    </div></Section>
    <Section title="Meet the Team"><div className="team-strip">
      {members.length ? members.map((m) => (<div className="card card-hover" key={m.id}><span className="avatar" aria-hidden="true">{m.full_name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span><h3><a href={`/team/${m.slug}`}>{m.full_name}</a> <SampleBadge isSample={m.isSample} /></h3><p className="muted">{m.role_title}</p><p>{m.short_intro}</p><p>{(m.skills || []).slice(0, 3).map((s) => <span className="chip" key={s.name}>{s.name}</span>)}</p></div>)) : <Empty text="No published team members yet." />}
    </div><p><a href="/team">See the full team →</a></p></Section>
    <Section title="Featured Projects"><div className="grid">
      {featured.length ? featured.map((p) => (<div className="card card-hover" key={p.id}><h3><a href={`/projects/${p.slug}`}>{p.title}</a> <SampleBadge isSample={p.isSample} /></h3><p>{p.tagline}</p><span className="chip">{p.category}</span></div>)) : <Empty text="No featured projects yet." />}
    </div></Section>
    <Section title="Stats"><div className="grid">
      <div className="card"><Counter value={members.length} /><p className="muted">Members</p></div>
      <div className="card"><Counter value={projects.length} /><p className="muted">Projects</p></div>
      <div className="card"><Counter value={achievements.length} /><p className="muted">Certificates &amp; achievements</p></div>
      <div className="card"><Counter value={videoCount} /><p className="muted">AI videos</p></div>
    </div></Section>
    <Section title="Achievements highlights"><div className="grid">
      {achievements.filter((a) => a.featured).map((a) => (<div className="card card-hover" key={a.id}><h3>{a.title} <SampleBadge isSample={a.isSample} /></h3><p className="muted">{a.issuer} · {a.date}</p><p>{a.description}</p></div>))}
      {!achievements.filter((a) => a.featured).length && <Empty text="No featured achievements yet." />}
    </div></Section>
    <Section title="Contact"><p><a className="btn" href="/contact">Send a message</a> <a className="btn secondary" href="/team">Meet the team first</a></p><p className="muted">No public sign-up: accounts are created by an admin only.</p></Section>
  </div>);
}
