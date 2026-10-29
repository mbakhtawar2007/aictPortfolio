'use client';
import { useEffect, useMemo, useState } from 'react';
import { apiGet } from '../../lib/api';
import type { Project } from '../../lib/types';
import { Loading, Empty, ErrorBox, SampleBadge } from '../shared';
const CATS = ['All', 'AI Video', 'AI Tool', 'Website', 'Other'];
export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState('All'); const [q, setQ] = useState('');
  useEffect(() => { apiGet<Project[]>('/projects').then((r) => { if (r.error) setError(r.error.message); else setProjects(r.data || []); setLoading(false); }); }, []);
  const filtered = useMemo(() => projects.filter((p) => (cat === 'All' || p.category === cat) && (`${p.title} ${(p.tech_stack || []).join(' ')}`.toLowerCase().includes(q.toLowerCase()))), [projects, cat, q]);
  if (loading) return <Loading />;
  return (<div><h1>Projects</h1>{error && <ErrorBox message={error} />}
    <p>{CATS.map((c) => <button key={c} className="chip" onClick={() => setCat(c)} style={{ cursor: 'pointer', background: cat === c ? 'rgba(139,92,246,0.3)' : undefined, color: 'inherit' }}>{c}</button>)}</p>
    <label>Search by title or technology<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Next.js" /></label>
    <div className="grid">{filtered.map((p) => (<div className="card" key={p.id}><h3><a href={`/projects/${p.slug}`}>{p.title}</a> <SampleBadge isSample={p.isSample} /></h3><p>{p.tagline}</p><span className="chip">{p.category}</span>{(p.tech_stack || []).map((t) => <span className="chip" key={t}>{t}</span>)}</div>))}</div>
    {!filtered.length && <Empty text="No projects match that filter." />}</div>);
}
