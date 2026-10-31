'use client';
import { useEffect, useState } from 'react';
import { apiGet } from '../../../lib/api';
import { safeHref, safeSrc } from '../../../lib/safeUrl';
import type { Project, Member } from '../../../lib/types';
import { SkeletonGrid, Lightbox } from '../../../components/ui';
import { projectThumbnail, youtubeEmbedUrl } from '../../../lib/videoThumb';
export default function ProjectDetail({ slug }: { slug: string }) {
  const [p, setP] = useState<Project | null>(null); const [members, setMembers] = useState<Member[]>([]);
  const [all, setAll] = useState<Project[]>([]); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  const [lb, setLb] = useState<number | null>(null);
  const gallery = [safeSrc(p?.cover_url)].filter(Boolean) as string[];
  useEffect(() => {
    (async () => {
      // Same URL-slug rule as the member detail page: a Netlify rewrite
      // may serve a pre-rendered file for a new slug, so read the slug
      // from the actual URL. This makes a newly published project work
      // with no rebuild.
      let actualSlug = slug;
      if (typeof window !== 'undefined') {
        try { actualSlug = decodeURIComponent(window.location.pathname.split('/').filter(Boolean).pop() || slug); }
        catch { setError('Project not found.'); setLoading(false); return; }
      }
      const [r, m, a] = await Promise.all([apiGet<Project>(`/projects/${encodeURIComponent(actualSlug)}`), apiGet<Member[]>('/members'), apiGet<Project[]>('/projects')]);
      const project = (!r.error && r.data) ? r.data : null;
      if (!project) setError(r.error ? r.error.message : 'Project not found.'); else { setP(project); document.title = `${project.title} | TechHive`; }
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
  if (error || !p) return (<div><p className="muted">{/not found/i.test(error) || !error ? 'Project not found.' : 'This project could not be loaded right now.'}</p><p><a href="/projects">← Back to projects</a></p></div>);
  const contributors = members.filter((x) => (p.member_ids || []).includes(x.id));
  const roleOf = (id: string) => (p.project_members || []).find((x) => x.member_id === id)?.role_in_project || '';
  const related = all.filter((x) => x.id !== p.id && x.category === p.category).slice(0, 3);
  const thumb = projectThumbnail(p);
  const ytEmbed = youtubeEmbedUrl(p.video_url);
  // Pasted case studies sometimes arrive double-escaped (literal \n and \.
  // sequences instead of line breaks, e.g. when text is copied through a
  // JSON-shaped paste). Unescape at render time so old records read as
  // paragraphs without touching stored data.
  const cleanText = (t?: string) => (t || '').replace(/\\\r?\n/g, '\n').replace(/\\n/g, '\n').replace(/\\([\s\S])/g, '$1');
  const storyParas = cleanText(p.case_study).split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
  return (<div>
    {safeSrc(p.video_url) ? (/\.(mp4|webm)([?#]|$)/i.test(safeSrc(p.video_url)!.split(/[?#]/)[0]) ? (<video controls preload="metadata" aria-label={`${p.title} video`} poster={thumb || undefined} src={safeSrc(p.video_url)} style={{ width: '100%', maxHeight: 420, borderRadius: 20 }} />) : (ytEmbed ? (<div><div style={{ position: 'relative', width: '100%', maxWidth: p.video_format === 'short' ? 400 : '100%', margin: p.video_format === 'short' ? '0 auto' : undefined, aspectRatio: p.video_format === 'short' ? '9 / 16' : '16 / 9' }}><iframe src={ytEmbed} title={`${p.title} video`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, borderRadius: 20 }} /></div><p><a href={safeHref(p.video_url)} target="_blank" rel="noreferrer">Watch on YouTube</a></p></div>) : (<div>{thumb && <a href={safeHref(p.video_url)} target="_blank" rel="noreferrer"><img className="blur-up" src={thumb} alt={`${p.title} thumbnail`} style={{ width: '100%', maxHeight: 320, objectFit: 'cover', borderRadius: 20 }} /></a>}<p><a className="btn" href={safeHref(p.video_url)} target="_blank" rel="noreferrer">Watch video</a></p></div>))) : (safeSrc(p.cover_url) ? <img className="blur-up" src={safeSrc(p.cover_url)} alt={`${p.title} cover`} tabIndex={0} role="button" aria-label={`Open ${p.title} cover`} style={{ width: '100%', maxHeight: 320, objectFit: 'cover', borderRadius: 20, cursor: 'pointer' }} onClick={() => setLb(0)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setLb(0); } }} /> : null)}
    <h1>{p.title}</h1>
    <p className="muted">{p.category} {p.year ? `· ${p.year}` : ''} {p.featured ? '· Featured' : ''}{p.video_format === 'short' ? ' · Shorts' : p.video_format === 'full' ? ' · Full-length video' : ''}{p.visibility && p.visibility !== 'public' ? ` · ${p.visibility === 'unlisted' ? 'Unlisted' : 'Private'}` : ''}</p>
    <p>{p.tagline}</p><p style={{ whiteSpace: 'pre-line' }}>{cleanText(p.description)}</p>
    {p.video_url && thumb && !p.cover_url && !ytEmbed && <p className="muted">Thumbnail: first frame of the uploaded video.</p>}
    {p.category === 'AI Video' ? (<><h2>Storyline &amp; plot</h2>{storyParas.length ? storyParas.map((para, i) => (<p key={i} style={{ whiteSpace: 'pre-line' }}>{para}</p>)) : <p className="muted">No storyline published yet.</p>}</>) : (storyParas.length ? <><h2>Case study</h2>{storyParas.map((para, i) => (<p key={i} style={{ whiteSpace: 'pre-line' }}>{para}</p>))}</> : null)}
    <h2>Characters involved</h2><p>{(p.characters || []).map((c) => <span className="chip" key={c}>{c}</span>)}{!(p.characters || []).length && <span className="muted">No characters listed yet.</span>}</p>
    <h2>Technology</h2><p>{(p.tech_stack || []).map((t) => <span className="chip" key={t}>{t}</span>)}{(p.tools_used || []).map((t) => <span className="chip" key={t}>{t}</span>)}{!(p.tech_stack || []).length && !(p.tools_used || []).length && <span className="muted">No technologies listed.</span>}</p>
    {(p.tags || []).length ? (<><h2>Tags</h2><p>{(p.tags || []).map((t) => <span className="chip" key={t}>{t}</span>)}</p></>) : null}
    <h2>Team &amp; group members</h2><p>{contributors.map((m) => <a key={m.id} href={`/team/${m.slug}`} style={{ marginRight: 12 }}>{m.full_name}{roleOf(m.id) ? ` (${roleOf(m.id)})` : ''}</a>)}{!contributors.length && <span className="muted">No contributors listed.</span>}</p>
    <p>{safeHref(p.repo_url) && <a className="btn secondary" href={safeHref(p.repo_url)} target="_blank" rel="noreferrer">Repository</a>} {safeHref(p.live_url) && <a className="btn secondary" href={safeHref(p.live_url)} target="_blank" rel="noreferrer">Live demo</a>}</p>
    {related.length ? (<><h2>Related projects</h2><div className="grid">{related.map((r) => { const rt = projectThumbnail(r); return (<a className="card card-hover project-card" key={r.id} href={`/projects/${r.slug}`}>{safeSrc(rt) && <img className="project-thumb" src={safeSrc(rt)} alt="" loading="lazy" style={{ marginBottom: 12 }} />}<h3>{r.title}</h3><p>{r.tagline}</p></a>); })}</div></>) : null}
    <p><a href="/projects">← Back to projects</a></p>
    {lb !== null && gallery[lb] && (<Lightbox label="Project gallery" src={gallery[lb]} alt={`${p.title} media ${lb + 1}`} onClose={() => setLb(null)} onPrev={gallery.length > 1 ? () => setLb((lb - 1 + gallery.length) % gallery.length) : undefined} onNext={gallery.length > 1 ? () => setLb((lb + 1) % gallery.length) : undefined} />)}
  </div>);
}
