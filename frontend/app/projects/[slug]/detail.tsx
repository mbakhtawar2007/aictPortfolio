'use client';
import { useEffect, useState } from 'react';
import { apiGet } from '../../../lib/api';
import type { Project, Member } from '../../../lib/types';
import { ErrorBox } from '../../shared';
import { SkeletonGrid, Lightbox } from '../../../components/ui';
export default function ProjectDetail({ slug }: { slug: string }) {
  const [p, setP] = useState<Project | null>(null); const [members, setMembers] = useState<Member[]>([]);
  const [all, setAll] = useState<Project[]>([]); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  const [lb, setLb] = useState<number | null>(null);
  const gallery = [p?.cover_url].filter(Boolean) as string[];
  useEffect(() => {
    (async () => {
      // Same URL-slug rule as the member detail page: a Netlify rewrite
      // may serve a pre-rendered file for a new slug, so read the slug
      // from the actual URL. This makes a newly published project work
      // with no rebuild.
      const actualSlug = typeof window !== 'undefined'
        ? decodeURIComponent(window.location.pathname.split('/').filter(Boolean).pop() || slug)
        : slug;
      const [r, m, a] = await Promise.all([apiGet<Project>(`/projects/${actualSlug}`), apiGet<Member[]>('/members'), apiGet<Project[]>('/projects')]);
      const project = (!r.error && r.data) ? r.data : null;
      if (!project) setError(r.error ? r.error.message : 'Project not found.'); else setP(project);
      setMembers(m.data || []); setAll(a.data || []);
      setLoading(false);
    })();
  }, [slug]);
  useEffect(() => {
    if (lb === null) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLb(null); if (e.key === 'ArrowRight' && gallery.length) setLb((v) => ((v ?? 0) + 1) % gallery.length); if (e.key === 'ArrowLeft' && gallery.length) setLb((v) => ((v ?? 0) - 1 + gallery.length) % gallery.length); };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  });
  if (loading) return <SkeletonGrid />;
  if (error || !p) return (<div><ErrorBox message={error || 'Project not found.'} /><p><a href="/projects">← Back to projects</a></p></div>);
  const contributors = members.filter((x) => (p.member_ids || []).includes(x.id));
  const roleOf = (id: string) => (p.project_members || []).find((x) => x.member_id === id)?.role_in_project || '';
  const related = all.filter((x) => x.id !== p.id && x.category === p.category).slice(0, 3);
  return (<div>
    {p.cover_url ? <img className="blur-up" src={p.cover_url} alt={`${p.title} cover`} tabIndex={0} role="button" aria-label={`Open ${p.title} cover`} style={{ width: '100%', maxHeight: 320, objectFit: 'cover', borderRadius: 20, cursor: 'pointer' }} onClick={() => setLb(0)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setLb(0); } }} /> : null}
    <h1>{p.title}</h1>
    <p className="muted">{p.category} {p.year ? `· ${p.year}` : ''} {p.featured ? '· Featured' : ''}</p>
    <p>{p.tagline}</p><p>{p.description}</p>
    {p.case_study && <><h2>Case study</h2><p>{p.case_study}</p></>}
    {p.video_url && (/\.(mp4|webm)(\?|$)/i.test(p.video_url) ? (<><h2>Video</h2><video controls src={p.video_url} style={{ width: '100%', maxHeight: 420, borderRadius: 20 }} /></>) : (<p><a className="btn" href={p.video_url} target="_blank" rel="noreferrer">Watch video</a></p>))}
    <h2>Technology</h2><p>{(p.tech_stack || []).map((t) => <span className="chip" key={t}>{t}</span>)}{(p.tools_used || []).map((t) => <span className="chip" key={t}>{t}</span>)}{!(p.tech_stack || []).length && !(p.tools_used || []).length && <span className="muted">No technologies listed.</span>}</p>
    <h2>Contributors</h2><p>{contributors.map((m) => <a key={m.id} href={`/team/${m.slug}`} style={{ marginRight: 12 }}>{m.full_name}{roleOf(m.id) ? ` (${roleOf(m.id)})` : ''}</a>)}{!contributors.length && <span className="muted">No contributors listed.</span>}</p>
    <p>{p.repo_url && <a className="btn secondary" href={p.repo_url} target="_blank" rel="noreferrer">Repository</a>} {p.live_url && <a className="btn secondary" href={p.live_url} target="_blank" rel="noreferrer">Live demo</a>}</p>
    {related.length ? (<><h2>Related projects</h2><div className="grid">{related.map((r) => <div className="card card-hover" key={r.id}><h3><a href={`/projects/${r.slug}`}>{r.title}</a></h3><p>{r.tagline}</p></div>)}</div></>) : null}
    <p><a href="/projects">← Back to projects</a></p>
    {lb !== null && gallery[lb] && (<Lightbox label="Project gallery" src={gallery[lb]} alt={`${p.title} media ${lb + 1}`} onClose={() => setLb(null)} onPrev={gallery.length > 1 ? () => setLb((lb - 1 + gallery.length) % gallery.length) : undefined} onNext={gallery.length > 1 ? () => setLb((lb + 1) % gallery.length) : undefined} />)}
  </div>);
}
