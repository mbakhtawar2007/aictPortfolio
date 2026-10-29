'use client';
import { useEffect, useState } from 'react';
import { apiGet } from '../../../lib/api';
import type { Member, Project } from '../../../lib/types';
import { Loading, ErrorBox, SampleBadge } from '../../shared';
export default function MemberDetail({ slug }: { slug: string }) {
  const [m, setM] = useState<Member | null>(null); const [projects, setProjects] = useState<Project[]>([]); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const [r, p] = await Promise.all([apiGet<Member>(`/members/${slug}`), apiGet<Project[]>('/projects')]);
      if (r.error) setError(r.error.message); else setM(r.data);
      setProjects((p.data || []).filter((x) => (x.member_ids || []).includes(r.data?.id || '')));
      setLoading(false);
    })();
  }, [slug]);
  if (loading) return <Loading />;
  if (error || !m) return <ErrorBox message={error || 'Member not found.'} />;
  return (<div>
    <h1>{m.full_name} <SampleBadge isSample={m.isSample} /></h1>
    <p className="muted">{m.role_title} {m.location ? `· ${m.location}` : ''} {m.availability ? `· ${m.availability}` : ''}</p>
    {m.photo_url ? <img src={m.photo_url} alt={`${m.full_name} photo`} style={{ maxWidth: 320, borderRadius: 20 }} /> : null}
    <h2>About</h2><p>{m.bio || m.short_intro || 'No biography published yet.'}</p>
    <h2>Skills</h2>{(m.skills || []).length ? (m.skills || []).map((s) => <span className="chip" key={s.name}>{s.name} ({s.category}) — {s.level}%</span>) : <p className="muted">No skills listed yet.</p>}
    <h2>Education &amp; Experience</h2>
    {(m.education || []).map((e, i) => <div className="card" key={i}><strong>{e.institution}</strong><p className="muted">{e.degree} {e.field} · {e.start_date} – {e.end_date || 'Present'}</p><p>{e.description}</p></div>)}
    {(m.experience || []).map((e, i) => <div className="card" key={i}><strong>{e.organization}</strong><p className="muted">{e.role} · {e.start_date} – {e.end_date || 'Present'}</p><p>{e.description}</p></div>)}
    <h2>Projects</h2><div className="grid">{projects.map((p) => <div className="card" key={p.id}><h3><a href={`/projects/${p.slug}`}>{p.title}</a></h3><p>{p.tagline}</p></div>)}</div>
    <h2>Resume</h2>
    {m.resume_path ? <p><a className="btn" href={m.resume_path} target="_blank" rel="noreferrer">View resume</a> <a className="btn secondary" href={m.resume_path} download>Download resume</a></p> : <p className="muted">No public resume for this member.</p>}
    <h2>Contact links</h2><p>{(m.links || []).map((l) => <a key={l.url} href={l.url} target="_blank" rel="noreferrer" style={{ marginRight: 12 }}>{l.label || l.type}</a>)}{(m.links || []).length === 0 && <span className="muted">No public links yet.</span>}</p>
    <p><a href="/team">← Back to team</a></p>
  </div>);
}
