'use client';
import { useEffect, useState } from 'react';
import { apiGet } from '../lib/api';
import type { Member, Project, Achievement, SiteSettings } from '../lib/types';
import { Loading, Empty, ErrorBox, SampleBadge, Section } from './shared';
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
  if (loading) return <Loading />;
  return (<div>
    <div className="hero">
      <h1>{site?.group_name || 'AICT Group'} <SampleBadge isSample={site?.isSample} /></h1>
      <p>{site?.tagline || 'Who we are, what we build, and what we have achieved.'}</p>
      <p><a className="btn" href="/team">Meet the Team</a> <a className="btn secondary" href="/projects">View Projects</a></p>
    </div>
    {error && <ErrorBox message={error} />}
    <Section title="About / Mission"><p>{site?.mission || 'Mission content is managed in the admin dashboard.'}</p><p className="muted">{site?.about || ''}</p></Section>
    <Section title="What We Do"><div className="grid">
      {['AI Video Creation', 'AI Projects', 'Web Development', 'Creative Storytelling'].map((t) => (<div className="card" key={t}><h3>{t}</h3><p className="muted">Managed content — edit the service cards from the admin dashboard in a later pass.</p></div>))}
    </div></Section>
    <Section title="Meet the Team"><div className="grid">
      {members.length ? members.map((m) => (<div className="card" key={m.id}><h3><a href={`/team/${m.slug}`}>{m.full_name}</a> <SampleBadge isSample={m.isSample} /></h3><p className="muted">{m.role_title}</p><p>{m.short_intro}</p><p>{(m.skills || []).slice(0, 3).map((s) => <span className="chip" key={s.name}>{s.name}</span>)}</p></div>)) : <Empty text="No published team members yet." />}
    </div></Section>
    <Section title="Featured Projects"><div className="grid">
      {projects.filter((p) => p.featured).length ? projects.filter((p) => p.featured).map((p) => (<div className="card" key={p.id}><h3><a href={`/projects/${p.slug}`}>{p.title}</a> <SampleBadge isSample={p.isSample} /></h3><p>{p.tagline}</p><span className="chip">{p.category}</span></div>)) : <Empty text="No featured projects yet." />}
    </div></Section>
    <Section title="Stats"><p><strong>{members.length}</strong> members · <strong>{projects.length}</strong> projects · <strong>{achievements.length}</strong> achievements</p></Section>
    <Section title="Achievements highlights"><div className="grid">
      {achievements.filter((a) => a.featured).map((a) => (<div className="card" key={a.id}><h3>{a.title} <SampleBadge isSample={a.isSample} /></h3><p className="muted">{a.issuer} · {a.date}</p><p>{a.description}</p></div>))}
      {!achievements.filter((a) => a.featured).length && <Empty text="No featured achievements yet." />}
    </div></Section>
    <Section title="Contact"><p><a className="btn" href="/contact">Send a message</a></p></Section>
  </div>);
}
