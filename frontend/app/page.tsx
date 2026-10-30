'use client';
import { useEffect, useRef, useState } from 'react';
import { apiGet } from '../lib/api';
import type { Member, Project, Achievement, SiteSettings } from '../lib/types';
import { Empty, ErrorBox, SampleBadge, Section } from './shared';
import { sampleMembers, sampleProjects, sampleAchievements, sampleSite, orDemo } from '../lib/sample';
import { SkeletonGrid } from '../components/ui';
import ExploreStudio from '../components/ExploreStudio';
import { scrollToSection } from '../lib/scroll3d';

function Counter({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null); const [n, setN] = useState(0); const started = useRef(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver((entries) => { if (entries[0].isIntersecting && !started.current) { started.current = true; if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.getAttribute('data-reduce') === 'true') { setN(value); return; } const t0 = performance.now(); const tick = (t: number) => { const p = Math.min(1, (t - t0) / 800); setN(Math.round(value * p)); if (p < 1) requestAnimationFrame(tick); }; requestAnimationFrame(tick); } }, { threshold: 0.4 });
    obs.observe(el); return () => obs.disconnect();
  }, [value]);
  return <span ref={ref} className="stat">{n}</span>;
}
export default function Home() {
  const [site, setSite] = useState<SiteSettings | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [siteError, setSiteError] = useState(''); const [membersError, setMembersError] = useState('');
  const [projectsError, setProjectsError] = useState(''); const [achievementsError, setAchievementsError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true); setSiteError(''); setMembersError(''); setProjectsError(''); setAchievementsError('');
    const [s, m, p, a] = await Promise.all([apiGet<SiteSettings>('/site'), apiGet<Member[]>('/members'), apiGet<Project[]>('/projects'), apiGet<Achievement[]>('/achievements')]);
    if (s.error) setSiteError(s.error.message); else setSite(s.data || sampleSite);
    if (m.error) setMembersError(m.error.message); else setMembers(orDemo(m.data, sampleMembers));
    if (p.error) setProjectsError(p.error.message); else setProjects(orDemo(p.data, sampleProjects));
    if (a.error) setAchievementsError(a.error.message); else setAchievements(orDemo(a.data, sampleAchievements));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  if (loading) return <SkeletonGrid count={4} />;
  const featured = projects.filter((p) => p.featured);
  const videoCount = projects.filter((p) => p.category === 'AI Video').length;
  return (<div>
    <div className="hero reveal">
      <h1>{site?.group_name || 'AICT Group'} <SampleBadge isSample={site?.isSample} /></h1>
      <p className="hero-fullform">Application of Information and Communication Technologies</p>
      <h2>We create <span className="hero-words" aria-label="AI videos, AI tools, websites, stories"><span>AI videos</span><span>AI tools</span><span>websites</span><span>stories</span></span></h2>
      <p>{site?.tagline || 'Who we are, what we build, and what we have achieved.'}</p>
      <p><a className="btn" href="/team">Meet the Team</a> <a className="btn secondary" href="/projects">View Projects</a></p>
      <p><button type="button" className="btn secondary hero-scroll-prompt" onClick={() => scrollToSection('#about')} aria-label="Scroll down to the about section">↓ Scroll to explore</button></p>
    </div>
    {site?.hero_video_url && (<div style={{ marginTop: 24 }}><video controls src={site.hero_video_url} style={{ width: '100%', maxHeight: 420, objectFit: 'cover', borderRadius: 20 }} /></div>)}
    {siteError && (<div><ErrorBox message={siteError} /><p><button className="btn secondary" onClick={load}>Try again</button></p><p className="muted">Site settings could not be loaded, so generic headings are shown. This is a failed request, not an empty site.</p></div>)}
    <div id="about"><Section title="About"><p>{site?.mission || 'The group has not published a mission yet.'}</p><p className="muted">{site?.about || ''}</p></Section></div>
    <Section title="What We Do"><div className="grid">
      {[['AI Video Creation', 'Short AI videos, showreels and visual stories made by the team.'], ['AI Projects', 'Practical AI tools and experiments, built and documented by members.'], ['Web Development', 'Websites and web apps, from design to a live, working product.'], ['Creative Storytelling', 'Ideas turned into stories told through video, visuals and words.']].map(([t, d]) => (<div className="card card-hover" key={t}><h3>{t}</h3><p className="muted">{d}</p></div>))}
    </div></Section>
    <Section title="Meet the Team">{membersError ? (<div><ErrorBox message={membersError} /><p><button className="btn secondary" onClick={load}>Try again</button></p><p className="muted">The team list could not be loaded. This is not an empty team.</p></div>) : (<><div className="grid">
      {members.length ? members.map((m) => (<div className="card card-hover" key={m.id}><span className="avatar" aria-hidden="true">{m.full_name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span><h3><a href={`/team/${m.slug}`}>{m.full_name}</a> <SampleBadge isSample={m.isSample} /></h3><p className="muted">{m.role_title}</p><p>{m.short_intro}</p><p>{(m.skills || []).slice(0, 3).map((s) => <span className="chip" key={s.name}>{s.name}</span>)}</p></div>)) : <Empty text="No published team members yet." />}
    </div><p><a href="/team">See the full team →</a></p></>)}</Section>
    <Section title="Featured Projects">{projectsError ? (<div><ErrorBox message={projectsError} /><p><button className="btn secondary" onClick={load}>Try again</button></p><p className="muted">The project list could not be loaded. This is not an empty list.</p></div>) : (<div className="grid">
      {featured.length ? featured.map((p) => (<div className="card card-hover" key={p.id}><h3><a href={`/projects/${p.slug}`}>{p.title}</a> <SampleBadge isSample={p.isSample} /></h3><p>{p.tagline}</p><span className="chip">{p.category}</span></div>)) : <Empty text="No featured projects yet." />}<p><a href="/projects">See all projects →</a></p>
    </div>)}</Section>
    <ExploreStudio />
    <Section title="Stats"><div className="grid">
      <div className="card">{membersError ? <span className="stat">—</span> : <Counter value={members.length} />}<p className="muted">Members{membersError ? ' (unavailable)' : ''}</p></div>
      <div className="card">{projectsError ? <span className="stat">—</span> : <Counter value={projects.length} />}<p className="muted">Projects{projectsError ? ' (unavailable)' : ''}</p></div>
      <div className="card">{achievementsError ? <span className="stat">—</span> : <Counter value={achievements.length} />}<p className="muted">Certificates &amp; achievements{achievementsError ? ' (unavailable)' : ''}</p></div>
      <div className="card">{projectsError ? <span className="stat">—</span> : <Counter value={videoCount} />}<p className="muted">AI videos{projectsError ? ' (unavailable)' : ''}</p></div>
    </div></Section>
    <Section title="Achievements highlights">{achievementsError ? (<div><ErrorBox message={achievementsError} /><p><button className="btn secondary" onClick={load}>Try again</button></p><p className="muted">The achievement list could not be loaded. This is not an empty list.</p></div>) : (<div className="grid">
      {achievements.filter((a) => a.featured).map((a) => (<div className="card card-hover" key={a.id}><h3>{a.title} <SampleBadge isSample={a.isSample} /></h3><p className="muted">{a.issuer} · {a.date}</p><p>{a.description}</p></div>))}
      {!achievements.filter((a) => a.featured).length && <Empty text="No featured achievements yet." />}
    </div>)}</Section>
    <Section title="Contact"><p><a className="btn" href="/contact">Send a message</a> <a className="btn secondary" href="/team">Meet the team first</a></p></Section>
  </div>);
}
