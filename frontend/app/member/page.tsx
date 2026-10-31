'use client';
import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiSend } from '../../lib/api';
import { createVideoProject, splitCsv, videoProjectSuccessMessage } from '../../lib/videoProject';
import { uploadDirectFile } from '../../lib/upload';
import type { Member, Project, Achievement, MediaItem } from '../../lib/types';
import { Loading, ErrorBox } from '../shared';
import { Toasts, useToasts, Modal, CopyButton, ConfirmDialog } from '../../components/ui';
import { MemberForm, ProjectForm, AchievementForm } from '../../components/adminForms';

// Member-only page. A member never sees the admin dashboard: no accounts,
// no messages inbox, no settings, no history. Only their own profile,
// projects they are assigned to, and their own achievements.
// The backend already filters all three lists to the signed-in member.
export default function MemberPage() {
  const { toasts, push, dismiss } = useToasts();
  const [token, setToken] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]); const [projects, setProjects] = useState<Project[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]); const [media, setMedia] = useState<MediaItem[]>([]); const [editingMedia, setEditingMedia] = useState<MediaItem | null>(null); const [editMediaTitle, setEditMediaTitle] = useState(''); const [editMediaDescription, setEditMediaDescription] = useState(''); const [editMediaBusy, setEditMediaBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sectionErrors, setSectionErrors] = useState<Record<string, string>>({});
  const [gateError, setGateError] = useState('');
  const [editingMember, setEditingMember] = useState<Partial<Member> | null | undefined>(undefined);
  const [selfCreate, setSelfCreate] = useState(false);
  const [editingProject, setEditingProject] = useState<Partial<Project> | null | undefined>(undefined);
  const [editingAchievement, setEditingAchievement] = useState<Partial<Achievement> | null | undefined>(undefined);
  const [uploadFile, setUploadFile] = useState<File | null>(null); const [uploadType, setUploadType] = useState<'image' | 'pdf' | 'video'>('image'); const [uploadTitle, setUploadTitle] = useState(''); const [uploadDescription, setUploadDescription] = useState(''); const [uploadStoryline, setUploadStoryline] = useState(''); const [uploadCharacters, setUploadCharacters] = useState(''); const [uploadTechnology, setUploadTechnology] = useState(''); const [uploadThumbFile, setUploadThumbFile] = useState<File | null>(null); const [uploadCategory, setUploadCategory] = useState('AI Video'); const [uploadVideoFormat, setUploadVideoFormat] = useState('full'); const [uploadVisibility, setUploadVisibility] = useState('public'); const [uploadTags, setUploadTags] = useState(''); const [uploadYear, setUploadYear] = useState('');
  const [uploadBusy, setUploadBusy] = useState(false); const [uploadUrl, setUploadUrl] = useState(''); const [uploadProgress, setUploadProgress] = useState(0); const [uploadKey, setUploadKey] = useState(0); const [showAllMedia, setShowAllMedia] = useState(false); const [deleting, setDeleting] = useState<{ kind: string; id: string; label: string } | null>(null); const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => { setToken(window.localStorage.getItem('aict_admin_token')); }, []);
  const reload = useCallback(async () => {
    setGateError(''); setSectionErrors({});
    const me = await apiGet<{ role: string }>('/admin/me', true);
    if (me.data?.role === 'admin') { window.location.href = '/admin'; return; }
    if (me.error) {
      if (me.error.code === 'unauthenticated') { window.location.href = '/login'; return; }
      setGateError(me.error.message); setLoading(false); return;
    }
    if (!me.data) { window.location.href = '/login'; return; }
    const [m, p, a, med] = await Promise.all([
      apiGet<Member[]>('/admin/members', true), apiGet<Project[]>('/admin/projects', true),
      apiGet<Achievement[]>('/admin/achievements', true), apiGet<MediaItem[]>('/admin/media', true),
    ]);
    const errs: Record<string, string> = {};
    if (m.error) errs.members = m.error.message; else setMembers(m.data || []);
    if (p.error) errs.projects = p.error.message; else setProjects(p.data || []);
    if (a.error) errs.achievements = a.error.message; else setAchievements(a.data || []);
    if (med.error) errs.media = med.error.message; else setMedia(med.data || []);
    setSectionErrors(errs);
    setLoading(false);
  }, []);
  useEffect(() => { if (token) reload(); else setLoading(false); }, [token, reload]);

  async function upload(e: React.FormEvent) {
    e.preventDefault(); if (!uploadFile) { push('error', 'Choose a file first.'); return; }
    if (uploadType === 'video' && !myProfile?.is_leader) { push('error', 'Video uploads are limited to the Group Leader and admins.'); return; }
    if (uploadType === 'pdf' && uploadFile.name.split('.').pop()?.toLowerCase() !== 'pdf') { push('error', 'Resumes must be PDF files.'); return; }
    if (uploadType === 'image' && !['jpg', 'jpeg', 'png', 'webp', 'avif'].includes(uploadFile.name.split('.').pop()?.toLowerCase() || '')) { push('error', 'Images must be jpg, png, webp or avif.'); return; }
    if (uploadType === 'video' && !['mp4', 'webm'].includes(uploadFile.name.split('.').pop()?.toLowerCase() || '')) { push('error', 'Videos must be MP4 or WebM.'); return; }
    if (uploadFile.size > (uploadType === 'video' ? 50 * 1024 * 1024 : 5 * 1024 * 1024)) { push('error', uploadType === 'video' ? 'Video must be 50 MB or smaller.' : 'File must be 5 MB or smaller.'); return; }
    if (uploadType === 'video' && uploadYear.trim() !== '') { const y = Number(uploadYear); if (!Number.isInteger(y) || y < 2000 || y > 2100) { push('error', 'Year must be between 2000 and 2100.'); return; } }
    setUploadBusy(true); setUploadUrl('');
    const sign = await apiSend('/admin/upload/sign', 'POST', { file_type: uploadType, file_size: uploadFile.size, file_name: uploadFile.name }, true);
    if (sign.error || !sign.data) { push('error', sign.error?.message || 'Upload signing is unavailable.'); setUploadBusy(false); return; }
    const d = sign.data as Record<string, unknown>;
    const form = new FormData();
    form.append('file', uploadFile); form.append('api_key', String(d.api_key)); form.append('timestamp', String(d.timestamp)); form.append('public_id', String(d.public_id)); form.append('signature', String(d.signature));
    const endpoint = `https://api.cloudinary.com/v1_1/${String(d.cloud_name)}/${uploadType === 'video' ? 'video' : uploadType === 'pdf' ? 'raw' : 'image'}/upload`;
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (ev) => { if (ev.lengthComputable) setUploadProgress(Math.round((ev.loaded / ev.total) * 100)); };
    xhr.onload = async () => { setUploadBusy(false); try { const j = JSON.parse(xhr.responseText); if (xhr.status >= 200 && xhr.status < 300 && j.secure_url) { const uploadedPublicId = String(j.public_id || d.public_id); const v = await apiSend('/admin/upload/verify', 'POST', { public_id: uploadedPublicId, file_type: uploadType }, true); if (v.error || !v.data) { push('error', v.error?.message || 'Upload was checked by the server and rejected.'); return; } const meta = await apiSend('/admin/media/meta', 'POST', { public_id: uploadedPublicId, title: uploadTitle, description: uploadDescription }, true); if (meta.error) push('error', 'Upload verified, but its title could not be saved.'); const videoUrl = String((v.data as Record<string, unknown>).secure_url || j.secure_url); setUploadUrl(videoUrl); if (uploadType === 'video') { let coverUrl: string | undefined; if (uploadThumbFile) { try { coverUrl = await uploadDirectFile(uploadThumbFile, 'image', () => {}); } catch (err) { push('error', err instanceof Error ? err.message : 'Thumbnail upload failed.'); return; } } const created = await createVideoProject({ title: uploadTitle, description: uploadDescription, videoUrl, fileName: uploadFile.name, caseStudy: uploadStoryline, characters: splitCsv(uploadCharacters), techStack: splitCsv(uploadTechnology), memberIds: members[0]?.id ? [members[0].id] : [], category: uploadCategory, videoFormat: uploadVideoFormat, visibility: uploadVisibility, tags: splitCsv(uploadTags), year: uploadYear.trim() === '' ? undefined : Number(uploadYear), coverUrl }); if (created.data) push('success', videoProjectSuccessMessage(created.data)); else push('error', `Video uploaded, but its project card could not be created: ${created.error} You can still create it by hand with this URL.`); } else push('success', 'Upload complete and verified by the server.'); setUploadFile(null); setUploadTitle(''); setUploadDescription(''); setUploadStoryline(''); setUploadCharacters(''); setUploadTechnology(''); setUploadThumbFile(null); setUploadCategory('AI Video'); setUploadVideoFormat('full'); setUploadVisibility('public'); setUploadTags(''); setUploadYear(''); setUploadKey((k) => k + 1); reload(); } else push('error', j.error?.message || 'Upload failed.'); } catch { push('error', 'Upload failed.'); } };
    xhr.onerror = () => { setUploadBusy(false); push('error', 'Upload failed (network).'); };
    xhr.open('POST', endpoint); xhr.send(form);
  }

  if (loading) return <Loading />;
  if (!token) return (<div><h1>My page</h1><p className="error">Sign-in required. <a href="/login">Go to login</a></p></div>);
  if (gateError) return (<div><h1>My page</h1><ErrorBox message={gateError} /><p><button className="btn" onClick={reload}>Try again</button>{' '}<button className="btn secondary" onClick={() => { window.localStorage.removeItem('aict_admin_token'); window.location.href = '/login'; }}>Sign out</button></p><p className="muted">The backend could not be reached or your account could not be checked. This does not mean you were signed out.</p></div>);
  const myProfile = members[0];
  const needsProfile = members.length === 0;
  return (<div><h1>My page</h1>
    {Object.keys(sectionErrors).length > 0 && (<div><ErrorBox message={`Some sections could not be loaded: ${Object.entries(sectionErrors).map(([k, v]) => `${k === 'members' ? 'My profile' : k === 'projects' ? 'My projects' : k === 'achievements' ? 'My achievements' : k === 'media' ? 'My uploads' : k} — ${v}`).join('; ')}`} /><p><button className="btn secondary" onClick={reload}>Try loading again</button></p><p className="muted">Sections that failed are not empty — their data simply did not arrive.</p></div>)}
    <p className="muted">This is your own page only. You cannot see other members' accounts, messages, or site settings.</p>
    <p><button className="btn secondary small" onClick={() => { window.localStorage.removeItem('aict_admin_token'); window.location.href = '/login'; }}>Sign out</button></p>

    <section className="form-section"><h2>My profile</h2>
      {needsProfile && (<div><p>You don't have a profile yet. Create it here — it will be saved as a draft, and an admin will review and publish it.</p><p><button className="btn" onClick={() => { setSelfCreate(true); setEditingMember({}); }}>Create my profile</button></p></div>)}
      {myProfile && (<div><p><strong>{myProfile.full_name}</strong> · {myProfile.role_title} · <span className={`status-chip ${myProfile.status}`}>{myProfile.status === 'published' ? 'Published' : 'Draft — waiting for admin to publish'}</span>{myProfile.is_leader && <span className="chip">Group Leader</span>}</p><p><button className="btn" onClick={() => { setSelfCreate(false); setEditingMember(myProfile); }}>Edit my profile</button>{myProfile.status === 'published' ? <>{' '}<a className="btn secondary small" href={`/team/${myProfile.slug}`}>View public profile</a></> : <span className="muted"> Not published yet — no public page until an admin publishes it.</span>}</p></div>)}
      {editingMember !== undefined && (<Modal title={selfCreate ? 'Create my profile' : 'Edit my profile'} onClose={() => { setEditingMember(undefined); setSelfCreate(false); }}><MemberForm initial={editingMember} selfCreate={selfCreate} onSaved={() => { setEditingMember(undefined); setSelfCreate(false); reload(); }} onCancel={() => { setEditingMember(undefined); setSelfCreate(false); }} push={push} /></Modal>)}
    </section>

    <section className="form-section"><h2>My projects</h2><p className="muted">Only projects you are assigned to. A new project you create will include you automatically.</p>
      <p><button className="btn" onClick={() => setEditingProject({})}>+ New project</button></p>
      <div className="grid">{projects.map((p) => (<div className="card" key={p.id}><h3>{p.title}</h3><p className="muted">{p.category} · <span className={`status-chip ${p.status}`}>{p.status === 'published' ? 'Published' : 'Draft'}</span></p><p><button className="btn secondary small" onClick={() => setEditingProject(p)}>Edit</button>{p.status === 'draft' && <>{' '}<button className="btn secondary small" onClick={() => setDeleting({ kind: 'project', id: p.id, label: p.title })}>Delete</button></>}</p></div>))}</div>
      {!projects.length && !sectionErrors.projects && <p className="muted">No projects yet.</p>}
      {editingProject !== undefined && (<Modal title={editingProject?.id ? 'Edit project' : 'New project'} onClose={() => setEditingProject(undefined)}><ProjectForm initial={editingProject} members={members} isAdmin={false} onSaved={() => { setEditingProject(undefined); reload(); }} onCancel={() => setEditingProject(undefined)} push={push} /></Modal>)}
    </section>

    <section className="form-section"><h2>My achievements</h2>
      <p className="muted">New achievements are saved as drafts and are not public until an admin publishes them. Drafts below are visible only to you and admins.</p>
      <p><button className="btn" onClick={() => setEditingAchievement({})}>+ New achievement</button></p>
      <div className="grid">{achievements.map((a) => (<div className="card" key={a.id}><h3>{a.title}</h3><p className="muted">{a.issuer} · {a.type} · {a.date} · <span className={`status-chip ${a.status || 'draft'}`}>{a.status === 'published' ? 'Published' : 'Draft'}</span></p><p>{a.description}</p><p><button className="btn secondary small" onClick={() => setEditingAchievement(a)}>Edit</button>{(a.status || 'draft') === 'draft' && <>{' '}<button className="btn secondary small" onClick={() => setDeleting({ kind: 'achievement', id: a.id, label: a.title })}>Delete</button></>}</p></div>))}</div>
      {!achievements.length && !sectionErrors.achievements && <p className="muted">No achievements yet.</p>}
      {editingAchievement !== undefined && (<Modal title={editingAchievement?.id ? 'Edit achievement' : 'New achievement'} onClose={() => setEditingAchievement(undefined)}><AchievementForm initial={editingAchievement} members={members} isAdmin={false} onSaved={() => { setEditingAchievement(undefined); reload(); }} onCancel={() => setEditingAchievement(undefined)} push={push} /></Modal>)}
    </section>

    <section className="form-section"><h2>My photos, files & videos</h2>
      <form onSubmit={upload}>
        <label>File type<select value={uploadType} onChange={(e) => setUploadType(e.target.value as 'image' | 'pdf' | 'video')}><option value="image">Photo / image</option><option value="pdf">PDF resume (max 5 MB)</option>{myProfile?.is_leader ? <option value="video">Video (MP4/WebM, max 50 MB)</option> : null}</select></label>
        {!myProfile?.is_leader && <p className="muted">Video uploads are limited to the Group Leader and admins — photos and resumes are still open to you.</p>}
        <label>File<input key={uploadKey} type="file" accept={uploadType === 'video' ? 'video/mp4,video/webm' : uploadType === 'pdf' ? 'application/pdf' : 'image/jpeg,image/png,image/webp,image/avif'} onChange={(e) => setUploadFile(e.target.files?.[0] || null)} /></label>
        <label>Title<input value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} placeholder="e.g. Team at the tech fest" maxLength={120} /></label>
        <label>Description<textarea value={uploadDescription} onChange={(e) => setUploadDescription(e.target.value)} placeholder="A short description (optional)" maxLength={500} rows={3} /></label>
        {uploadType === 'video' && (<>
        <h3>Details</h3>
        <label>Custom thumbnail<input key={uploadKey} type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(e) => setUploadThumbFile(e.target.files?.[0] || null)} /></label>
        <p className="muted">Optional — if you skip this, the video's first frame is used as the thumbnail.{uploadThumbFile ? ` Selected: ${uploadThumbFile.name}` : ''}</p>
        <label>Category<select value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)}><option>AI Video</option><option>AI Tool</option><option>Website</option><option>Other</option></select></label>
        <p className="muted">The site groups projects by category instead of separate playlists.</p>
        <h3>Format</h3>
        <fieldset><legend>Shorts or full-length video</legend>
        <p><label><input type="radio" name="member-upload-format" value="full" checked={uploadVideoFormat === 'full'} onChange={() => setUploadVideoFormat('full')} /> <strong>Full-length video</strong> <span className="muted">— A regular video, like a normal YouTube upload.</span></label></p>
        <p><label><input type="radio" name="member-upload-format" value="short" checked={uploadVideoFormat === 'short'} onChange={() => setUploadVideoFormat('short')} /> <strong>Shorts</strong> <span className="muted">— A short vertical video, like a YouTube Short.</span></label></p>
        </fieldset>
        <h3>More details</h3>
        <label>Storyline & plot<textarea value={uploadStoryline} onChange={(e) => setUploadStoryline(e.target.value)} placeholder="What happens in the video? (optional)" maxLength={20000} rows={4} /></label>
        <label>Characters involved<input value={uploadCharacters} onChange={(e) => setUploadCharacters(e.target.value)} placeholder="Comma-separated names (optional)" /></label>
        <label>Technology<input value={uploadTechnology} onChange={(e) => setUploadTechnology(e.target.value)} placeholder="Comma-separated, e.g. AI Video Tools, Premiere Pro (optional)" /></label>
        <label>Tags<input value={uploadTags} onChange={(e) => setUploadTags(e.target.value)} placeholder="Comma-separated, e.g. showreel, ai-video (optional)" /></label>
        <label>Year<input type="number" value={uploadYear} onChange={(e) => setUploadYear(e.target.value)} placeholder="e.g. 2026 (optional)" /></label>
        <p className="muted">These details appear on the project's details page.</p>
        <h3>Visibility</h3>
        <fieldset><legend>Who can watch it</legend>
        <p><label><input type="radio" name="member-upload-visibility" value="public" checked={uploadVisibility === 'public'} onChange={() => setUploadVisibility('public')} /> <strong>Public</strong> <span className="muted">— Everyone can find it on Projects and open it.</span></label></p>
        <p><label><input type="radio" name="member-upload-visibility" value="unlisted" checked={uploadVisibility === 'unlisted'} onChange={() => setUploadVisibility('unlisted')} /> <strong>Unlisted</strong> <span className="muted">— Hidden from Projects lists; only people with the direct link can open it.</span></label></p>
        <p><label><input type="radio" name="member-upload-visibility" value="private" checked={uploadVisibility === 'private'} onChange={() => setUploadVisibility('private')} /> <strong>Private</strong> <span className="muted">— Hidden from everyone except admins; saved as a draft.</span></label></p>
        </fieldset>
        <p className="muted">Group Leader videos go live at once; other members' videos are saved as drafts for an admin to review, and your visibility choice applies once published.</p></>)}
        {uploadBusy && <p>Uploading… {uploadProgress}%</p>}
        {uploadUrl && <p className="success">Uploaded: {uploadUrl} <CopyButton text={uploadUrl} label="Copy URL" /></p>}
        <p><button className="btn" disabled={uploadBusy}>{uploadBusy ? 'Uploading…' : 'Upload'}</button></p>
        <p className="muted">A video upload also creates its project card automatically (the Group Leader's card goes live at once; other members' cards stay drafts until an admin publishes them). For photos and resumes, copy the URL into your profile or project form.</p></form>
      <div className="grid">{(showAllMedia ? media : media.slice(0, 12)).map((f) => (<div className="card" key={f.public_id}>{f.resource_type === 'video' ? <video controls src={f.secure_url} style={{ maxWidth: '100%', borderRadius: 12 }} /> : f.resource_type === 'image' ? <img src={f.secure_url} alt={f.title || f.public_id} style={{ maxWidth: '100%', borderRadius: 12 }} /> : <p>{f.public_id}</p>}{f.title ? <h3>{f.title}</h3> : null}{f.description ? <p>{f.description}</p> : null}<p><CopyButton text={f.secure_url} label="Copy URL" />{' '}<button className="btn secondary small" onClick={() => { setEditingMedia(f); setEditMediaTitle(f.title || ''); setEditMediaDescription(f.description || ''); }}>Edit</button>{' '}<button className="btn secondary small" onClick={() => setDeleting({ kind: 'media', id: f.public_id, label: f.title || f.public_id })}>Delete</button></p></div>))}</div>
      {!showAllMedia && media.length > 12 && <p><button className="btn secondary small" onClick={() => setShowAllMedia(true)}>Show all uploads ({media.length})</button></p>}
    </section>

    <div className="card"><h2>How publishing works</h2><p>Saving stores your change right away, and visitors see published changes on their next page load — no rebuild needed. Drafts stay hidden until an admin publishes them. That includes achievements: creating one does not make it public immediately.</p></div>
    {deleting && <ConfirmDialog text={`Delete "${deleting.label}"? This cannot be undone.`} busy={deleteBusy} onCancel={() => setDeleting(null)} onConfirm={async () => { if (!deleting) return; setDeleteBusy(true); try { const r = await apiSend(deleting.kind === 'media' ? `/admin/media?public_id=${encodeURIComponent(deleting.id)}` : `/admin/${deleting.kind}s/${deleting.id}`, 'DELETE', {}, true); if (r.error) push('error', r.error.message); else { push('success', 'Deleted.'); reload(); } } finally { setDeleteBusy(false); setDeleting(null); } }} />}
    {editingMedia && (<Modal title="Edit upload details" onClose={() => setEditingMedia(null)}><form onSubmit={async (e) => { e.preventDefault(); if (!editingMedia) return; setEditMediaBusy(true); try { const r = await apiSend('/admin/media/meta', 'POST', { public_id: editingMedia.public_id, title: editMediaTitle, description: editMediaDescription }, true); if (r.error) push('error', r.error.message); else { push('success', 'Upload details saved.'); setEditingMedia(null); reload(); } } finally { setEditMediaBusy(false); } }}><p className="muted">{editingMedia.public_id}</p><label>Title<input value={editMediaTitle} onChange={(e) => setEditMediaTitle(e.target.value)} maxLength={120} /></label><label>Description<textarea value={editMediaDescription} onChange={(e) => setEditMediaDescription(e.target.value)} maxLength={500} rows={3} /></label><p className="muted">This changes the upload's title and description only — for a video, its project card keeps its own title and description (edit those in Projects).</p><p><button className="btn" disabled={editMediaBusy}>{editMediaBusy ? 'Saving…' : 'Save details'}</button>{' '}<button type="button" className="btn secondary" onClick={() => setEditingMedia(null)}>Cancel</button></p></form></Modal>)}
    <Toasts toasts={toasts} dismiss={dismiss} />
  </div>);
}
