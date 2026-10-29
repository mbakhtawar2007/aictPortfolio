'use client';
import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiSend } from '../../lib/api';
import type { Member, Project, Achievement, MediaItem } from '../../lib/types';
import { Loading, ErrorBox } from '../shared';
import { Toasts, useToasts, Modal, CopyButton } from '../../components/ui';
import { MemberForm, ProjectForm, AchievementForm } from '../../components/adminForms';

// Member-only page. A member never sees the admin dashboard: no accounts,
// no messages inbox, no settings, no history. Only their own profile,
// projects they are assigned to, and their own achievements.
// The backend already filters all three lists to the signed-in member.
export default function MemberPage() {
  const { toasts, push, dismiss } = useToasts();
  const [token, setToken] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]); const [projects, setProjects] = useState<Project[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]); const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sectionErrors, setSectionErrors] = useState<Record<string, string>>({});
  const [gateError, setGateError] = useState('');
  const [editingMember, setEditingMember] = useState<Partial<Member> | null | undefined>(undefined);
  const [selfCreate, setSelfCreate] = useState(false);
  const [editingProject, setEditingProject] = useState<Partial<Project> | null | undefined>(undefined);
  const [editingAchievement, setEditingAchievement] = useState<Partial<Achievement> | null | undefined>(undefined);
  const [uploadFile, setUploadFile] = useState<File | null>(null); const [uploadType, setUploadType] = useState<'image' | 'pdf' | 'video'>('image');
  const [uploadBusy, setUploadBusy] = useState(false); const [uploadUrl, setUploadUrl] = useState('');

  useEffect(() => { setToken(window.localStorage.getItem('aict_admin_token')); }, []);
  const reload = useCallback(async () => {
    setGateError(''); setSectionErrors({});
    const me = await apiGet<{ role: string }>('/admin/me', true);
    if (me.data?.role === 'admin') { window.location.href = '/admin'; return; }
    if (me.error) {
      if (me.error.code === 'unauthenticated') { window.location.href = '/admin/login'; return; }
      setGateError(me.error.message); setLoading(false); return;
    }
    if (!me.data) { window.location.href = '/admin/login'; return; }
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
    if (uploadType === 'video' && !['mp4', 'webm'].includes(uploadFile.name.split('.').pop()?.toLowerCase() || '')) { push('error', 'Videos must be MP4 or WebM.'); return; }
    if (uploadFile.size > (uploadType === 'video' ? 50 * 1024 * 1024 : 5 * 1024 * 1024)) { push('error', uploadType === 'video' ? 'Video must be 50 MB or smaller.' : 'File must be 5 MB or smaller.'); return; }
    setUploadBusy(true); setUploadUrl('');
    const sign = await apiSend('/admin/upload/sign', 'POST', { file_type: uploadType, file_size: uploadFile.size, file_name: uploadFile.name }, true);
    if (sign.error || !sign.data) { push('error', sign.error?.message || 'Upload signing is unavailable.'); setUploadBusy(false); return; }
    const d = sign.data as Record<string, unknown>;
    const form = new FormData();
    form.append('file', uploadFile); form.append('api_key', String(d.api_key)); form.append('timestamp', String(d.timestamp)); form.append('folder', String(d.folder)); form.append('public_id', String(d.public_id)); form.append('signature', String(d.signature));
    const endpoint = `https://api.cloudinary.com/v1_1/${String(d.cloud_name)}/${uploadType === 'video' ? 'video' : uploadType === 'pdf' ? 'raw' : 'image'}/upload`;
    const xhr = new XMLHttpRequest();
    xhr.onload = async () => { setUploadBusy(false); try { const j = JSON.parse(xhr.responseText); if (xhr.status >= 200 && xhr.status < 300 && j.secure_url) { const v = await apiSend('/admin/upload/verify', 'POST', { public_id: String(d.public_id), file_type: uploadType }, true); if (v.error || !v.data) { push('error', v.error?.message || 'Upload was checked by the server and rejected.'); return; } setUploadUrl(String((v.data as Record<string, unknown>).secure_url || j.secure_url)); push('success', 'Upload complete and verified by the server. Copy the URL into your profile or project form.'); reload(); } else push('error', j.error?.message || 'Upload failed.'); } catch { push('error', 'Upload failed.'); } };
    xhr.onerror = () => { setUploadBusy(false); push('error', 'Upload failed (network).'); };
    xhr.open('POST', endpoint); xhr.send(form);
  }

  if (loading) return <Loading />;
  if (!token) return (<div><h1>My page</h1><p className="error">Sign-in required. <a href="/admin/login">Go to login</a></p></div>);
  if (gateError) return (<div><h1>My page</h1><ErrorBox message={gateError} /><p><button className="btn" onClick={reload}>Try again</button>{' '}<button className="btn secondary" onClick={() => { window.localStorage.removeItem('aict_admin_token'); window.location.href = '/admin/login'; }}>Sign out</button></p><p className="muted">The backend could not be reached or your account could not be checked. This does not mean you were signed out.</p></div>);
  const myProfile = members[0];
  const needsProfile = members.length === 0;
  return (<div><h1>My page</h1>
    {Object.keys(sectionErrors).length > 0 && (<div><ErrorBox message={`Some sections could not be loaded: ${Object.entries(sectionErrors).map(([k, v]) => `${k} — ${v}`).join('; ')}`} /><p><button className="btn secondary" onClick={reload}>Try loading again</button></p><p className="muted">Sections that failed are not empty — their data simply did not arrive.</p></div>)}
    <p className="muted">This is your own page only. You cannot see other members' accounts, messages, or site settings.</p>
    <p><button className="btn secondary small" onClick={() => { window.localStorage.removeItem('aict_admin_token'); window.location.href = '/admin/login'; }}>Sign out</button></p>

    <section className="form-section"><h2>My profile</h2>
      {needsProfile && (<div><p>You don't have a profile yet. Create it here — it will be saved as a draft, and an admin will review and publish it.</p><p><button className="btn" onClick={() => { setSelfCreate(true); setEditingMember({}); }}>Create my profile</button></p></div>)}
      {myProfile && (<div><p><strong>{myProfile.full_name}</strong> · {myProfile.role_title} · <span className={`status-chip ${myProfile.status}`}>{myProfile.status === 'published' ? 'Published' : 'Draft — waiting for admin to publish'}</span>{myProfile.is_leader && <span className="chip">Group Leader</span>}</p><p><button className="btn" onClick={() => { setSelfCreate(false); setEditingMember(myProfile); }}>Edit my profile</button></p></div>)}
      {editingMember !== undefined && (<Modal title={selfCreate ? 'Create my profile' : 'Edit my profile'} onClose={() => { setEditingMember(undefined); setSelfCreate(false); }}><MemberForm initial={editingMember} selfCreate={selfCreate} onSaved={() => { setEditingMember(undefined); setSelfCreate(false); reload(); }} onCancel={() => { setEditingMember(undefined); setSelfCreate(false); }} push={push} /></Modal>)}
    </section>

    <section className="form-section"><h2>My projects</h2><p className="muted">Only projects you are assigned to. A new project you create will include you automatically.</p>
      <p><button className="btn" onClick={() => setEditingProject({})}>+ New project</button></p>
      <div className="grid">{projects.map((p) => (<div className="card" key={p.id}><h3>{p.title}</h3><p className="muted">{p.category} · <span className={`status-chip ${p.status}`}>{p.status === 'published' ? 'Published' : 'Draft'}</span></p><p><button className="btn secondary small" onClick={() => setEditingProject(p)}>Edit</button></p></div>))}</div>
      {!projects.length && !sectionErrors.projects && <p className="muted">No projects yet.</p>}
      {editingProject !== undefined && (<Modal title={editingProject?.id ? 'Edit project' : 'New project'} onClose={() => setEditingProject(undefined)}><ProjectForm initial={editingProject} members={members} onSaved={() => { setEditingProject(undefined); reload(); }} onCancel={() => setEditingProject(undefined)} push={push} /></Modal>)}
    </section>

    <section className="form-section"><h2>My achievements</h2>
      <p className="muted">New achievements are saved as drafts and are not public until an admin publishes them. Drafts below are visible only to you and admins.</p>
      <p><button className="btn" onClick={() => setEditingAchievement({})}>+ New achievement</button></p>
      <div className="grid">{achievements.map((a) => (<div className="card" key={a.id}><h3>{a.title}</h3><p className="muted">{a.issuer} · {a.type} · {a.date} · <span className={`status-chip ${a.status || 'draft'}`}>{a.status === 'published' ? 'Published' : 'Draft'}</span></p><p>{a.description}</p><p><button className="btn secondary small" onClick={() => setEditingAchievement(a)}>Edit</button></p></div>))}</div>
      {!achievements.length && !sectionErrors.achievements && <p className="muted">No achievements yet.</p>}
      {editingAchievement !== undefined && (<Modal title={editingAchievement?.id ? 'Edit achievement' : 'New achievement'} onClose={() => setEditingAchievement(undefined)}><AchievementForm initial={editingAchievement} members={members} isAdmin={false} onSaved={() => { setEditingAchievement(undefined); reload(); }} onCancel={() => setEditingAchievement(undefined)} push={push} /></Modal>)}
    </section>

    <section className="form-section"><h2>My photos, files & videos</h2>
      <form onSubmit={upload}>
        <label>File type<select value={uploadType} onChange={(e) => setUploadType(e.target.value as 'image' | 'pdf' | 'video')}><option value="image">Photo / image</option><option value="pdf">PDF resume (max 5 MB)</option><option value="video">Video (MP4/WebM, max 50 MB)</option></select></label>
        <label>File<input type="file" accept={uploadType === 'video' ? 'video/mp4,video/webm' : uploadType === 'pdf' ? 'application/pdf' : 'image/jpeg,image/png,image/webp,image/avif'} onChange={(e) => setUploadFile(e.target.files?.[0] || null)} /></label>
        {uploadUrl && <p className="success">Uploaded: {uploadUrl} <CopyButton text={uploadUrl} label="Copy URL" /></p>}
        <p><button className="btn" disabled={uploadBusy}>{uploadBusy ? 'Uploading…' : 'Upload'}</button></p>
        <p className="muted">After uploading, copy the URL into your profile or project form.</p></form>
      <div className="grid">{media.slice(0, 12).map((f) => (<div className="card" key={f.public_id}>{f.resource_type === 'video' ? <video controls src={f.secure_url} style={{ maxWidth: '100%', borderRadius: 12 }} /> : f.resource_type === 'image' ? <img src={f.secure_url} alt={f.public_id} style={{ maxWidth: '100%', borderRadius: 12 }} /> : <p>{f.public_id}</p>}<CopyButton text={f.secure_url} label="Copy URL" /></div>))}</div>
    </section>

    <div className="card"><h2>How publishing works</h2><p>Saving stores your change right away, and visitors see published changes on their next page load — no rebuild needed. Drafts stay hidden until an admin publishes them. That includes achievements: creating one does not make it public immediately.</p></div>
    <Toasts toasts={toasts} dismiss={dismiss} />
  </div>);
}
