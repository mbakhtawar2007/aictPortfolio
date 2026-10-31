'use client';
import { useEffect, useState } from 'react';
import { apiGet, API_URL } from '../../../lib/api';
import type { Member, Project, Achievement } from '../../../lib/types';
import { fmtDate } from '../../shared';
import { safeHref, safeSrc } from '../../../lib/safeUrl';
import { CopyButton, SkeletonGrid, Lightbox } from '../../../components/ui';
export default function MemberDetail({ slug }: { slug: string }) {
  const [m, setM] = useState<Member | null>(null); const [projects, setProjects] = useState<Project[]>([]);
  const [allMembers, setAllMembers] = useState<Member[]>([]); const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [secondaryError, setSecondaryError] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      // Read the slug from the actual URL, not only from the baked-in
      // build-time prop. Netlify rewrites an unknown /team/<slug> to a
      // pre-rendered detail file, so the prop would otherwise be the
      // sample slug while the visitor asked for a new member. This is
      // what makes a newly published profile work with no rebuild.
      // A malformed percent-encoding used to throw inside this effect
      // and leave the skeleton up forever; it is now a not-found.
      let actualSlug = slug;
      if (typeof window !== 'undefined') {
        try { actualSlug = decodeURIComponent(window.location.pathname.split('/').filter(Boolean).pop() || slug); }
        catch { setError('Member not found.'); setLoading(false); return; }
      }
      const [r, p, ms, a] = await Promise.all([apiGet<Member>(`/members/${encodeURIComponent(actualSlug)}`), apiGet<Project[]>('/projects'), apiGet<Member[]>('/members'), apiGet<Achievement[]>('/achievements')]);
      const member = (!r.error && r.data) ? r.data : null;
      if (!member) setError(r.error ? r.error.message : 'Member not found.'); else setM(member);
      // Secondary fetches are tracked separately: a failed projects or
      // achievements fetch must not masquerade as an empty list.
      setSecondaryError(Boolean(p.error || ms.error || a.error));
      const effProjects = p.data || [];
      const effMembers = ms.data || [];
      const effAchievements = a.data || [];
      setProjects(effProjects.filter((x) => (x.member_ids || []).includes(member?.id || '')));
      setAllMembers(effMembers); setAchievements(effAchievements.filter((x) => x.member_id === member?.id));
      setLoading(false);
    })();
  }, [slug]);
  if (loading) return <SkeletonGrid />;
  if (error || !m) return (<div><p className="muted">{/not found/i.test(error) || !error ? 'Member not found.' : 'This profile could not be loaded right now.'}</p><p><a href="/team">← Back to team</a></p></div>);
  const idx = allMembers.findIndex((x) => x.id === m.id);
  const prev = idx > 0 ? allMembers[idx - 1] : null; const next = idx >= 0 && idx < allMembers.length - 1 ? allMembers[idx + 1] : null;
  const friendlyCv = `${m.full_name.replace(/[^a-zA-Z]+/g, '-').replace(/^-+|-+$/g, '') || 'Resume'}-CV.pdf`;
  const resumeUrl = `${API_URL}/members/${encodeURIComponent(m.slug)}/resume`;
  const resumeDownloadUrl = `${resumeUrl}?download=1`;
  return (<div>
    {safeSrc(m.cover_url) ? <img className="blur-up" src={safeSrc(m.cover_url)} alt="" style={{ width: '100%', maxHeight: 280, objectFit: 'cover', borderRadius: 20 }} /> : null}
    <h1>{m.full_name}{m.is_leader && <span className="chip">Group Leader</span>}</h1>
    <p className="muted">{m.role_title} {m.location ? `· ${m.location}` : ''} {m.availability ? `· ${m.availability}` : ''}</p>
    {safeSrc(m.photo_url) ? <img className="blur-up" src={safeSrc(m.photo_url)} alt={`${m.full_name} photo`} tabIndex={0} role="button" aria-label={`Open ${m.full_name} photo`} style={{ maxWidth: 'min(320px, 100%)', borderRadius: 20, cursor: 'pointer' }} onClick={() => setLightbox(safeSrc(m.photo_url) || null)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setLightbox(safeSrc(m.photo_url) || null); } }} /> : <span className="avatar" aria-hidden="true" style={{ width: 96, height: 96, fontSize: 28 }}>{m.full_name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>}
    <h2>About</h2><p>{m.bio || m.short_intro || 'No biography published yet.'}</p>
    <h2>Skills &amp; Expertise</h2>{(m.skills || []).length ? (m.skills || []).map((s) => { const lvl = typeof s.level === 'number' ? Math.max(1, Math.min(100, s.level)) : null; return (<div key={s.name}><p>{s.name} <span className="muted">({s.category}){lvl !== null ? ` — ${lvl}%` : ''}</span></p><div className="skill-bar" role="img" aria-label={lvl !== null ? `${s.name} ${lvl} percent` : s.name}><div style={{ width: `${lvl || 0}%` }} /></div></div>); }) : <p className="muted">No skills listed yet.</p>}
    <h2>Education &amp; Experience</h2><div className="timeline">
      {(m.education || []).map((e, i) => <div className="card" key={`e${i}`}><strong>{e.institution}</strong><p className="muted">{e.degree} {e.field} · {fmtDate(e.start_date)} – {e.end_date ? fmtDate(e.end_date) : 'Present'}</p><p>{e.description}</p></div>)}
      {(m.experience || []).map((e, i) => <div className="card" key={`x${i}`}><strong>{e.organization}</strong><p className="muted">{e.role} · {fmtDate(e.start_date)} – {e.end_date ? fmtDate(e.end_date) : 'Present'}</p><p>{e.description}</p></div>)}
      {!(m.education || []).length && !(m.experience || []).length && <p className="muted">No education or experience published yet.</p>}
    </div>
    <h2>Projects</h2><div className="grid">{projects.map((p) => <div className="card card-hover" key={p.id}><h3><a href={`/projects/${p.slug}`}>{p.title}</a></h3><p>{p.tagline}</p></div>)}{!projects.length && !secondaryError && <p className="muted">No projects linked yet.</p>}{secondaryError && <p className="muted">Some linked content could not be loaded right now — this is not an empty list.</p>}</div>
    <h2>Achievements &amp; Certifications</h2><div className="grid">{achievements.map((a) => <div className="card card-hover" key={a.id}><h3>{a.title}</h3><p className="muted">{a.issuer} · {a.date}</p><p>{a.description}</p>{safeHref(a.credential_url) && <p><a href={safeHref(a.credential_url)} target="_blank" rel="noreferrer">Verify credential</a></p>}</div>)}{!achievements.length && !secondaryError && <p className="muted">No achievements published for this member.</p>}{secondaryError && <p className="muted">Some linked content could not be loaded right now — this is not an empty list.</p>}</div>
    <h2>Resume / CV</h2>
    {/* resume_path reaches here only when the backend kept it: publicMember strips it for non-public resumes, so its presence here already means public. */}
    {m.resume_path ? (<div><p><a className="btn" href={resumeUrl} target="_blank" rel="noreferrer">View resume</a>{' '}<a className="btn secondary" href={resumeDownloadUrl}>Download {friendlyCv}</a></p><p className="muted">The resume is public only when the member has marked it public.</p></div>) : <p className="muted">No public resume for this member.</p>}
    <h2>Contact</h2><p>{(m.links || []).filter((l) => safeHref(l.url)).map((l) => <a key={l.url} href={safeHref(l.url)} target="_blank" rel="noreferrer" style={{ marginRight: 12 }}>{l.label || l.type}</a>)}{(m.links || []).length === 0 && <span className="muted">No public links yet.</span>}</p>
    {m.contact_email ? <p><span>{m.contact_email}</span> <CopyButton text={m.contact_email} label="Copy email" /></p> : null}
    <nav aria-label="Member navigation"><p>{prev ? <a href={`/team/${prev.slug}`}>← Previous: {prev.full_name}</a> : ''} {next ? <a href={`/team/${next.slug}`}>Next: {next.full_name} →</a> : ''}</p></nav>
    <p><a href="/team">← Back to team</a></p>
    {lightbox && (<Lightbox label="Photo preview" src={lightbox} alt={`${m.full_name} photo`} onClose={() => setLightbox(null)} />)}
  </div>);
}
