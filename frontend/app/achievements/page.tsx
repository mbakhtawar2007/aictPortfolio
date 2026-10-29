'use client';
import { useEffect, useState } from 'react';
import { apiGet } from '../../lib/api';
import type { Achievement } from '../../lib/types';
import { Loading, Empty, ErrorBox, SampleBadge } from '../shared';
const TYPES = ['All', 'certificate', 'award', 'competition', 'academic'];
export default function AchievementsPage() {
  const [items, setItems] = useState<Achievement[]>([]); const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [type, setType] = useState('All');
  useEffect(() => { apiGet<Achievement[]>('/achievements').then((r) => { if (r.error) setError(r.error.message); else setItems(r.data || []); setLoading(false); }); }, []);
  const filtered = items.filter((a) => type === 'All' || a.type === type);
  if (loading) return <Loading />;
  return (<div><h1>Achievements &amp; Certificates</h1>{error && <ErrorBox message={error} />}
    <p>{TYPES.map((t) => <button key={t} className="chip" onClick={() => setType(t)} style={{ cursor: 'pointer', background: type === t ? 'rgba(139,92,246,0.3)' : undefined, color: 'inherit' }}>{t}</button>)}</p>
    <div className="grid">{filtered.map((a) => (<div className="card" key={a.id}><h3>{a.title} <SampleBadge isSample={a.isSample} /></h3><p className="muted">{a.issuer} · {a.date} · {a.type}</p><p>{a.description}</p>{a.credential_url && <p><a href={a.credential_url} target="_blank" rel="noreferrer">Verify credential</a></p>}</div>))}</div>
    {!filtered.length && <Empty text="No achievements match that filter." />}</div>);
}
