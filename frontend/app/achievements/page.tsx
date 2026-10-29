'use client';
import { useEffect, useState } from 'react';
import { apiGet } from '../../lib/api';
import type { Achievement } from '../../lib/types';
import { Loading, Empty, ErrorBox, SampleBadge } from '../shared';
import { SkeletonGrid } from '../../components/ui';
const TYPES = ['All', 'certificate', 'award', 'competition', 'academic'];
export default function AchievementsPage() {
  const [items, setItems] = useState<Achievement[]>([]); const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [type, setType] = useState('All');
  useEffect(() => { apiGet<Achievement[]>('/achievements').then((r) => { if (r.error) setError(r.error.message); else setItems(r.data || []); setLoading(false); }); }, []);
  const filtered = items.filter((a) => type === 'All' || a.type === type);
  if (loading) return <SkeletonGrid />;
  return (<div><h1>Achievements &amp; Certificates</h1>{error && <ErrorBox message={error} />}
    <div className="tabs" role="tablist" aria-label="Achievement types">{TYPES.map((t) => <button key={t} role="tab" aria-selected={type === t} className={`tab-btn${type === t ? ' active' : ''}`} onClick={() => setType(t)}>{t}</button>)}</div>
    <p className="muted">{filtered.length} of {items.length} achievements</p>
    <div className="grid">{filtered.map((a) => (<div className="card card-hover" key={a.id}><h3>{a.title} <SampleBadge isSample={a.isSample} /></h3><p className="muted">{a.issuer} · {a.date} · {a.type}</p><p>{a.description}</p>{a.image_path && <p><img src={a.image_path} alt={`${a.title} certificate`} style={{ maxWidth: '100%', borderRadius: 12 }} /></p>}{a.credential_url && <p><a href={a.credential_url} target="_blank" rel="noreferrer">Verify credential</a></p>}</div>))}</div>
    {!filtered.length && <Empty text="No achievements match that filter." />}</div>);
}
