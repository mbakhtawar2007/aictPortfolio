'use client';
import { useEffect, useState } from 'react';
import { apiGet } from '../../lib/api';
import type { Achievement } from '../../lib/types';
import { fmtDate } from '../shared';
import { Loading, Empty, ErrorBox, SampleBadge } from '../shared';
import { SkeletonGrid, Tabs } from '../../components/ui';
import { sampleAchievements } from '../../lib/sample';
const TYPES = ['All', 'certificate', 'award', 'competition', 'academic'];
export default function AchievementsPage() {
  const [items, setItems] = useState<Achievement[]>([]); const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [type, setType] = useState('All');
  const load = () => { setLoading(true); setError(''); apiGet<Achievement[]>('/achievements').then((r) => { if (r.error) setError(r.error.message); else setItems(r.data && r.data.length ? r.data : sampleAchievements); setLoading(false); }); };
  useEffect(load, []);
  const filtered = items.filter((a) => type === 'All' || a.type === type);
  if (loading) return <SkeletonGrid />;
  return (<div><h1>Achievements &amp; Certificates</h1>
    <Tabs id="achievements" label="Achievement types" tabs={TYPES.map((x) => ({ id: x, label: x === 'All' ? 'All' : x.charAt(0).toUpperCase() + x.slice(1) }))} value={type} onChange={setType} />
    <div role="tabpanel" id="achievements-panel" aria-labelledby={`achievements-tab-${type}`}>
    {error ? (<div><ErrorBox message={error} /><p><button className="btn secondary" onClick={load}>Try again</button></p><p className="muted">The achievement list could not be loaded. This is not an empty list — the request failed.</p></div>) : (<>
    <p className="muted">{filtered.length} of {items.length} achievements</p>
    <div className="grid">{filtered.map((a) => (<div className="card card-hover" key={a.id}><h3>{a.title} <SampleBadge isSample={a.isSample} /></h3><p className="muted">{a.issuer} · {fmtDate(a.date)} · {a.type ? a.type.charAt(0).toUpperCase() + a.type.slice(1) : ''}</p><p>{a.description}</p>{a.image_path && <p><img src={a.image_path} alt={`${a.title} certificate`} style={{ maxWidth: '100%', borderRadius: 12 }} /></p>}{a.credential_url && <p><a href={a.credential_url} target="_blank" rel="noreferrer">Verify credential</a></p>}</div>))}</div>
    {!filtered.length && <Empty text="No achievements match that filter." />}</>)}
    </div></div>);
}
