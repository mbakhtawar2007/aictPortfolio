'use client';
import { useEffect, useState } from 'react';
import { apiGet } from '../../../lib/api';
import type { Member, Project, Achievement } from '../../../lib/types';
import { ErrorBox, SampleBadge, fmtDate } from '../../shared';
import { sampleMembers, sampleProjects, sampleAchievements, orDemo } from '../../../lib/sample';
import { Modal, CopyButton, SkeletonGrid, Lightbox } from '../../../components/ui';
export default function MemberDetail({ slug }: { slug: string }) {
  const [m, setM] = useState<Member | null>(null); const [projects, setProjects] = useState<Project[]>([]);
  const [allMembers, setAllMembers] = useState<Member[]>([]); const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [resumeOpen, setResumeOpen] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      // Read the slug from the actual URL, not only from the baked-in
      // build-time prop. Netlify rewrites an unknown /team/<slug> to a
      // pre-rendered detail file, so the prop would otherwise be the
      // sample slug while the visitor asked for a new member. This is
      // what makes a newly published profile work with no rebuild.
      const actualSlug = typeof window !== 'undefined'
        ? decodeURIComponent(window.location.pathname.split('/').filter(Boolean).pop() || slug)
        : slug;
      const [r, p, ms, a] = await Promise.all([apiGet<Member>(`/members/${actualSlug}`), apiGet<Project[]>('/projects'), apiGet<Member[]>('/members'), apiGet<Achievement[]>('/achievements')]);
      const member = (!r.error && r.data) ? r.data : sampleMembers.find((x) => x.slug === actualSlug) || null;
      if (!member) setError(r.error ? r.error.message : 'Member not found.'); else setM(member);
      const effProjects = orDemo(p.data, sampleProjects);
      const effMembers = orDemo(ms.data, sampleMembers);
      const effAchievements = orDemo(a.data, sampleAchievements);
      setProjects(effProjects.filter((x) => (x.member_ids || []).includes(member?.id || '')));
      setAllMembers(effMembers); setAchievements(effAchievements.filter((x) => x.member_id === member?.id));
      setLoading(false);
    })();
  }, [slug]);
  if (loading) return <SkeletonGrid />;
  if (error || !m) return (<div><ErrorBox message={error || 'Member not found.'} /><p><a href="/team">← Back to team</a></p></div>);
  const idx = allMembers.findIndex((x) => x.id === m.id);
  const prev = idx > 0 ? allMembers[idx - 1] : null; const next = idx >= 0 && idx < allMembers.length - 1 ? allMembers[idx + 1] : null;
  const friendlyCv = `${m.full_name.replace(/[^a-zA-Z]+/g, '-')}-CV.pdf`;
  return (<div>
    {m.cover_url ? <img className="blur-up" src={m.cover_url} alt="" style={{ width: '100%', maxHeight: 280, objectFit: 'cover', borderRadius: 20 }} /> : null}
    <h1>{m.full_name} <SampleBadge isSample={m.isSample} />{m.is_leader && <span className="chip">Group Leader</span>}</h1>
    <p className="muted">{m.role_title} {m.location ? `· ${m.location}` : ''} {m.availability ? `· ${m.availability}` : ''}</p>
    {m.photo_url ? <img className="blur-up" src={m.photo_url} alt={`${m.full_name} photo`} tabIndex={0} role="button" aria-label={`Open ${m.full_name} photo`} style={{ maxWidth: 'min(320px, 100%)', borderRadius: 20, cursor: 'pointer' }} onClick={() => setLightbox(m.photo_url || null)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setLightbox(m.photo_url || null); } }} /> : <span className="avatar" aria-hidden="true" style={{ width: 96, height: 96, fontSize: 28 }}>{m.full_name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>}
    <h2>About</h2><p>{m.bio || m.short_intro || 'No biography published yet.'}</p>
    <h2>Skills &amp; Expertise</h2>{(m.skills || []).length ? (m.skills || []).map((s) => (<div key={s.name}><p>{s.name} <span className="muted">({s.category}) — {s.level}%</span></p><div className="skill-bar" role="img" aria-label={`${s.name} ${s.level} percent`}><div style={{ width: `${s.level || 0}%` }} /></div></div>)) : <p className="muted">No skills listed yet.</p>}
    <h2>Education &amp; Experience</h2><div className="timeline">
      {(m.education || []).map((e, i) => <div className="card" key={`e${i}`}><strong>{e.institution}</strong><p className="muted">{e.degree} {e.field} · {fmtDate(e.start_date)} – {e.end_date ? fmtDate(e.end_date) : 'Present'}</p><p>{e.description}</p></div>)}
      {(m.experience || []).map((e, i) => <div className="card" key={`x${i}`}><strong>{e.organization}</strong><p className="muted">{e.role} · {fmtDate(e.start_date)} – {e.end_date ? fmtDate(e.end_date) : 'Present'}</p><p>{e.description}</p></div>)}
      {!(m.education || []).length && !(m.experience || []).length && <p className="muted">No education or experience published yet.</p>}
    </div>
    <h2>Projects</h2><div className="grid">{projects.map((p) => <div className="card card-hover" key={p.id}><h3><a href={`/projects/${p.slug}`}>{p.title}</a></h3><p>{p.tagline}</p></div>)}{!projects.length && <p className="muted">No projects linked yet.</p>}</div>
    <h2>Achievements &amp; Certifications</h2><div className="grid">{achievements.map((a) => <div className="card card-hover" key={a.id}><h3>{a.title} <SampleBadge isSample={a.isSample} /></h3><p className="muted">{a.issuer} · {a.date}</p><p>{a.description}</p>{a.credential_url && <p><a href={a.credential_url} target="_blank" rel="noreferrer">Verify credential</a></p>}</div>)}{!achievements.length && <p className="muted">No achievements published for this member.</p>}</div>
    <h2>Resume / CV</h2>
    {m.resume_path ? (<div><p><button className="btn" onClick={() => setResumeOpen(true)}>View resume</button>{' '}<a className="btn secondary" href={m.resume_path} download={friendlyCv}>Download {friendlyCv}</a></p><p className="muted">The resume is public only when the member has marked it public.</p></div>) : <p className="muted">No public resume for this member.</p>}
    <h2>Contact</h2><p>{(m.links || []).map((l) => <a key={l.url} href={l.url} target="_blank" rel="noreferrer" style={{ marginRight: 12 }}>{l.label || l.type}</a>)}{(m.links || []).length === 0 && <span className="muted">No public links yet.</span>}</p>
    {m.contact_email ? <p><span>{m.contact_email}</span> <CopyButton text={m.contact_email} label="Copy email" /></p> : null}
    <nav aria-label="Member navigation"><p>{prev ? <a href={`/team/${prev.slug}`}>← Previous: {prev.full_name}</a> : ''} {next ? <a href={`/team/${next.slug}`}>Next: {next.full_name} →</a> : ''}</p></nav>
    <p><a href="/team">← Back to team</a></p>
    {resumeOpen && m.resume_path && (<Modal title={`${m.full_name} — Resume`} onClose={() => setResumeOpen(false)}>
      <embed src={m.resume_path} type="application/pdf" style={{ width: '100%', height: '60vh' }} />
      <p><a href={m.resume_path} target="_blank" rel="noreferrer">Open in new tab</a> (fallback if the embedded viewer does not load) · <a href={m.resume_path} download={friendlyCv}>Download</a></p>
    </Modal>)}
    {lightbox && (<Lightbox label="Photo preview" src={lightbox} alt={`${m.full_name} photo`} onClose={() => setLightbox(null)} />)}
  </div>);
}
