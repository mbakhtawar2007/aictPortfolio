'use client';
import { useEffect, useMemo, useState } from 'react';
import { apiGet } from '../../lib/api';
import type { Project } from '../../lib/types';
import { Empty, ErrorBox, SampleBadge } from '../shared';
import { SkeletonGrid, Tabs } from '../../components/ui';
import { sampleProjects, orDemo } from '../../lib/sample';
const CATS = ['All', 'AI Video', 'AI Tool', 'Website', 'Other'];
export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState('All'); const [q, setQ] = useState('');
  const load = () => { setLoading(true); setError(''); apiGet<Project[]>('/projects').then((r) => { if (r.error) setError(r.error.message); else setProjects(orDemo(r.data, sampleProjects)); setLoading(false); }); };
  useEffect(load, []);
  const filtered = useMemo(() => projects.filter((p) => (cat === 'All' || p.category === cat) && (`${p.title} ${(p.tech_stack || []).join(' ')}`.toLowerCase().includes(q.toLowerCase()))), [projects, cat, q]);
  if (loading) return <SkeletonGrid />;
  return (<div><h1>Projects</h1>
    <Tabs id="projects" label="Project categories" tabs={CATS.map((c) => ({ id: c, label: c }))} value={cat} onChange={setCat} />
    <div role="tabpanel" id="projects-panel" aria-labelledby={`projects-tab-${cat.replace(/\s+/g, '-')}`}>
    {error ? (<div><ErrorBox message={error} /><p><button className="btn secondary" onClick={load}>Try again</button></p><p className="muted">The project list could not be loaded. This is not an empty list — the request failed.</p></div>) : (<>
    <label>Search by title or technology<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Next.js" /></label>
    <p className="muted">{filtered.length} of {projects.length} projects {(q || cat !== 'All') && <button className="btn secondary small" onClick={() => { setQ(''); setCat('All'); }}>Clear filters</button>}</p>
    <div className="grid">{filtered.map((p) => (<div className="card card-hover" key={p.id}>{p.video_url ? <video controls preload="metadata" src={p.video_url} style={{ width: '100%', borderRadius: 12, marginBottom: 8 }} /> : null}<h3><a href={`/projects/${p.slug}`}>{p.title}</a> <SampleBadge isSample={p.isSample} /></h3><p>{p.tagline}</p><span className="chip">{p.category}</span>{(p.tech_stack || []).map((t) => <span className="chip" key={t}>{t}</span>)}</div>))}</div>
    {!filtered.length && <Empty text="No projects match that filter." />}</>)}
    </div></div>);
}
