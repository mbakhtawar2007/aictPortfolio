'use client';
import { useEffect, useMemo, useState } from 'react';
import { apiGet } from '../../lib/api';
import type { Project } from '../../lib/types';
import { Empty, ErrorBox } from '../shared';
import { SkeletonGrid, Tabs } from '../../components/ui';
import { projectThumbnail } from '../../lib/videoThumb';
const CATS = ['All', 'AI Video', 'AI Tool', 'Website', 'Other'];
export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState('All'); const [q, setQ] = useState('');
  const load = () => { setLoading(true); setError(''); apiGet<Project[]>('/projects').then((r) => { if (r.error) setError(r.error.message); else setProjects(r.data || []); setLoading(false); }); };
  useEffect(load, []);
  const filtered = useMemo(() => projects.filter((p) => (cat === 'All' || p.category === cat) && (`${p.title} ${(p.tech_stack || []).join(' ')}`.toLowerCase().includes(q.toLowerCase()))), [projects, cat, q]);
  if (loading) return <SkeletonGrid />;
  return (<div><h1>Projects</h1>
    <Tabs id="projects" label="Project categories" tabs={CATS.map((c) => ({ id: c, label: c }))} value={cat} onChange={setCat} />
    <div role="tabpanel" id="projects-panel" aria-labelledby={`projects-tab-${cat.replace(/\s+/g, '-')}`}>
    {error ? (<div><ErrorBox message={error} /><p><button className="btn secondary" onClick={load}>Try again</button></p><p className="muted">The project list could not be loaded. This is not an empty list — the request failed.</p></div>) : (<>
    <label>Search by title or technology<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Next.js" /></label>
    <p className="muted">{filtered.length} of {projects.length} projects {(q || cat !== 'All') && <button className="btn secondary small" onClick={() => { setQ(''); setCat('All'); }}>Clear filters</button>}</p>
    <div className="grid">{filtered.map((p) => { const thumb = projectThumbnail(p); const short = p.tagline || (p.description ? (p.description.length > 140 ? `${p.description.slice(0, 140)}…` : p.description) : ''); return (<a className="card card-hover project-card" key={p.id} href={`/projects/${p.slug}`}><div className="project-thumb-wrap">{thumb ? <img className="project-thumb" src={thumb} alt="" loading="lazy" /> : <div className="project-thumb project-thumb-fallback" aria-hidden="true">▶</div>}{p.video_url && <span className="project-play" aria-hidden="true">▶</span>}</div><h3>{p.title}</h3>{short && <p>{short}</p>}<span className="chip">{p.category}</span>{(p.tech_stack || []).map((t) => <span className="chip" key={t}>{t}</span>)}</a>); })}</div>
    {!filtered.length && <Empty text="No projects match that filter." />}</>)}
    </div></div>);
}
