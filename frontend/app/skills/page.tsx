'use client';
import { useEffect, useMemo, useState } from 'react';
import { apiGet } from '../../lib/api';
import type { Member } from '../../lib/types';
import { Empty, ErrorBox } from '../shared';
import { SkeletonGrid, Tabs } from '../../components/ui';
export default function SkillsPage() {
  const [members, setMembers] = useState<Member[]>([]); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(''); const [cat, setCat] = useState('All');
  const load = () => { setLoading(true); setError(''); apiGet<Member[]>('/members').then((r) => { if (r.error) setError(r.error.message); else setMembers(r.data || []); setLoading(false); }); };
  useEffect(load, []);
  const cats = useMemo(() => ['All', ...Array.from(new Set(members.flatMap((m) => (m.skills || []).map((s) => s.category || 'Technical'))))], [members]);
  const rows = useMemo(() => {
    const map = new Map<string, { name: string; category: string; members: { name: string; slug: string; level?: number }[] }>();
    for (const m of members) for (const s of (m.skills || [])) {
      const key = s.name.toLowerCase();
      if (!map.has(key)) map.set(key, { name: s.name, category: s.category || 'Technical', members: [] });
      map.get(key)!.members.push({ name: m.full_name, slug: m.slug, level: s.level });
    }
    return [...map.values()].filter((r) => (cat === 'All' || r.category === cat) && r.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => b.members.length - a.members.length);
  }, [members, q, cat]);
  if (loading) return <SkeletonGrid />;
  return (<div><h1>Team Skills Matrix</h1><p className="muted">Click a member to open their profile.</p>
    <Tabs id="skills" label="Skill categories" tabs={cats.map((c) => ({ id: c, label: c }))} value={cat} onChange={setCat} />
    <div role="tabpanel" id="skills-panel" aria-labelledby={`skills-tab-${cat.replace(/\s+/g, '-')}`}>
    {error ? (<div><ErrorBox message={error} /><p><button className="btn secondary" onClick={load}>Try again</button></p><p className="muted">The member list could not be loaded, so no skills can be shown. This is not an empty list — the request failed.</p></div>) : (<>
    <label>Find a skill<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. React" /></label>
    <p className="muted">{rows.length} skills {(q || cat !== 'All') && <button className="btn secondary small" onClick={() => { setQ(''); setCat('All'); }}>Clear filters</button>}</p>
    <div className="heatmap">{rows.map((r) => (<div className="heat-cell" key={r.name}><strong>{r.name}</strong><span className="muted">{r.category} · {r.members.length} member{r.members.length === 1 ? '' : 's'}</span>
      <p>{r.members.map((m) => <span key={m.slug}><a href={`/team/${m.slug}`}>{m.name}</a>{m.level ? ` (${m.level}%)` : ''} </span>)}</p></div>))}</div>
    {!rows.length && <Empty text="No skills match that filter." />}</>)}
    </div></div>);
}
