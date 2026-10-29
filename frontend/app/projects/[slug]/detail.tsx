'use client';
import { useEffect, useState } from 'react';
import { apiGet } from '../../../lib/api';
import type { Project, Member } from '../../../lib/types';
import { Loading, ErrorBox, SampleBadge } from '../../shared';
export default function ProjectDetail({ slug }: { slug: string }) {
  const [p, setP] = useState<Project | null>(null); const [members, setMembers] = useState<Member[]>([]); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const [r, m] = await Promise.all([apiGet<Project>(`/projects/${slug}`), apiGet<Member[]>('/members')]);
      if (r.error) setError(r.error.message); else setP(r.data);
      setMembers((m.data || []).filter((x) => (r.data?.member_ids || []).includes(x.id)));
      setLoading(false);
    })();
  }, [slug]);
  if (loading) return <Loading />;
  if (error || !p) return <ErrorBox message={error || 'Project not found.'} />;
  return (<div>
    <h1>{p.title} <SampleBadge isSample={p.isSample} /></h1>
    <p className="muted">{p.category} {p.year ? `· ${p.year}` : ''}</p>
    <p>{p.tagline}</p><p>{p.description}</p>
    {p.case_study && <><h2>Case study</h2><p>{p.case_study}</p></>}
    {p.video_url && <p><a className="btn" href={p.video_url} target="_blank" rel="noreferrer">Watch video</a></p>}
    <h2>Technology</h2><p>{(p.tech_stack || []).map((t) => <span className="chip" key={t}>{t}</span>)}{(p.tools_used || []).map((t) => <span className="chip" key={t}>{t}</span>)}</p>
    <h2>Contributors</h2><p>{members.map((m) => <a key={m.id} href={`/team/${m.slug}`} style={{ marginRight: 12 }}>{m.full_name}</a>)}{!members.length && <span className="muted">No contributors listed.</span>}</p>
    <p>{p.repo_url && <a className="btn secondary" href={p.repo_url} target="_blank" rel="noreferrer">Repository</a>} {p.live_url && <a className="btn secondary" href={p.live_url} target="_blank" rel="noreferrer">Live demo</a>}</p>
    <p><a href="/projects">← Back to projects</a></p>
  </div>);
}
