'use client';
import { useEffect, useMemo, useState } from 'react';
import { apiGet } from '../../lib/api';
import type { Member } from '../../lib/types';
import { Empty } from '../shared';
import { SkeletonGrid } from '../../components/ui';
import { safeSrc } from '../../lib/safeUrl';
export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(''); const [role, setRole] = useState('All');
  const load = () => { setLoading(true); setError(''); apiGet<Member[]>('/members').then((r) => { if (r.error) setError(r.error.message); else setMembers(r.data || []); setLoading(false); }); };
  useEffect(load, []);
  const roles = useMemo(() => ['All', ...Array.from(new Set(members.map((m) => m.role_title || '').filter(Boolean)))], [members]);
  const filtered = members.filter((m) => (role === 'All' || m.role_title === role) && (`${m.full_name} ${(m.skills || []).map((s) => s.name).join(' ')}`.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => Number(b.is_leader || false) - Number(a.is_leader || false));
  if (loading) return <SkeletonGrid />;
  return (<div><h1>Team</h1>
    {error ? (<div><p><button className="btn secondary" onClick={load}>Try again</button></p><p className="muted">The team list could not be loaded. This is not an empty list — the request failed.</p></div>) : null}
    {!error && (<><label>Search by name or skill<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. React" /></label>
    <label>Filter by role<select value={role} onChange={(e) => setRole(e.target.value)}>{roles.map((r) => <option key={r}>{r}</option>)}</select></label>
    <p className="muted">{filtered.length} of {members.length} members {(q || role !== 'All') && <button className="btn secondary small" onClick={() => { setQ(''); setRole('All'); }}>Clear filters</button>}</p>
    <div className="grid">{filtered.map((m) => (<div className="card card-hover" key={m.id}>{safeSrc(m.photo_url) ? <img className="avatar-img" src={safeSrc(m.photo_url)} alt="" /> : <span className="avatar" aria-hidden="true">{m.full_name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>}<h3><a href={`/team/${m.slug}`}>{m.full_name}</a>{m.is_leader && <span className="chip">Group Leader</span>}</h3><p className="muted">{m.role_title}</p><p>{m.short_intro}</p><p>{(m.skills || []).slice(0, 3).map((s) => <span className="chip" key={s.name}>{s.name}</span>)}</p></div>))}</div>
    {!filtered.length && <Empty text={members.length ? 'No team members match that search. Try clearing the filters.' : 'No published team members yet.'} />}</>)}</div>);
}
