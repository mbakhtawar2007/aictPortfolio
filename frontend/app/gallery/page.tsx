'use client';
import { useEffect, useState } from 'react';
import { apiGet } from '../../lib/api';
import type { MediaItem } from '../../lib/types';
import { Empty, ErrorBox } from '../shared';
import { SkeletonGrid } from '../../components/ui';
export default function GalleryPage() {
  const [items, setItems] = useState<MediaItem[]>([]); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  const load = () => { setLoading(true); setError(''); apiGet<MediaItem[]>('/gallery').then((r) => { if (r.error) setError(r.error.message); else setItems(r.data || []); setLoading(false); }); };
  useEffect(load, []);
  if (loading) return <SkeletonGrid />;
  return (<div><h1>Gallery</h1><p className="muted">Photos and videos uploaded by the team.</p>
    {error ? (<div><ErrorBox message={error} /><p><button className="btn secondary" onClick={load}>Try again</button></p><p className="muted">The gallery could not be loaded. This is not an empty gallery — the request failed.</p></div>) : (<>
    <div className="grid">{items.map((f) => (<div className="card" key={f.public_id}>{f.resource_type === 'video' ? <video controls src={f.secure_url} style={{ maxWidth: '100%', borderRadius: 12 }} /> : <img src={f.secure_url} alt={f.title || f.public_id} style={{ maxWidth: '100%', borderRadius: 12 }} />}<h3>{f.title || 'Untitled'}</h3>{f.description ? <p>{f.description}</p> : null}</div>))}</div>
    {!items.length && <Empty text="No gallery items yet. The team has not uploaded any photos or videos." />}</>)}
  </div>);
}
