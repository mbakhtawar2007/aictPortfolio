'use client';
import { useEffect, useMemo, useState } from 'react';
import { apiGet } from '../../lib/api';
import type { Project } from '../../lib/types';
import { Loading, Empty, ErrorBox, SampleBadge } from '../shared';
import { SkeletonGrid } from '../../components/ui';
const CATS = ['All', 'AI Video', 'AI Tool', 'Website', 'Other'];
export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState('All'); const [q, setQ] = useState('');
  useEffect(() => { apiGet<Project[]>('/projects').then((r) => { if (r.error) setError(r.error.message); else setProjects(r.data || []); setLoading(false); }); }, []);
  const filtered = useMemo(() => projects.filter((p) => (cat === 'All' || p.category === cat) && (`${p.title} ${(p.tech_stack || []).join(' ')}`.toLowerCase().includes(q.toLowerCase()))), [projects, cat, q]);
  if (loading) return <SkeletonGrid />;
  return (<div><h1>Projects</h1>{error && <ErrorBox message={error} />}
    <div className="tabs" role="tablist" aria-label="Project categories">{CATS.map((c) => <button key={c} role="tab" aria-selected={cat === c} className={`tab-btn${cat === c ? ' active' : ''}`} onClick={() => setCat(c)}>{c}</button>)}</div>
    <label>Search by title or technology<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Next.js" /></label>
    <p className="muted">{filtered.length} of {projects.length} projects {(q || cat !== 'All') && <button className="btn secondary small" onClick={() => { setQ(''); setCat('All'); }}>Clear filters</button>}</p>
    <div className="grid">{filtered.map((p) => (<div className="card card-hover" key={p.id}><h3><a href={`/projects/${p.slug}`}>{p.title}</a> <SampleBadge isSample={p.isSample} /></h3><p>{p.tagline}</p><span className="chip">{p.category}</span>{(p.tech_stack || []).map((t) => <span className="chip" key={t}>{t}</span>)}</div>))}</div>
    {!filtered.length && <Empty text="No projects match that filter." />}</div>);
}
