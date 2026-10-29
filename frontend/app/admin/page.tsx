'use client';
import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiSend } from '../../lib/api';
import type { Member, Project, Achievement, ContactMessage, SiteSettings, UserRole, AuditEntry, Revision, MediaItem } from '../../lib/types';
import { Loading, ErrorBox, SampleBadge } from '../shared';
import { Toasts, useToasts, Modal, ConfirmDialog, CopyButton } from '../../components/ui';
import { MemberForm, ProjectForm, AchievementForm, SettingsForm } from '../../components/adminForms';

type Tab = 'overview' | 'members' | 'projects' | 'achievements' | 'users' | 'messages' | 'media' | 'audit' | 'settings';
const TABS: Tab[] = ['overview', 'members', 'projects', 'achievements', 'users', 'messages', 'media', 'audit', 'settings'];

export default function AdminDashboard() {
  const { toasts, push, dismiss } = useToasts();
  const [token, setToken] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [members, setMembers] = useState<Member[]>([]); const [projects, setProjects] = useState<Project[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]); const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [users, setUsers] = useState<UserRole[]>([]); const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]); const [revisions, setRevisions] = useState<Revision[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]); const [mediaError, setMediaError] = useState('');
  const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [tab, setTab] = useState<Tab>('overview');
  const [editingMember, setEditingMember] = useState<Partial<Member> | null | undefined>(undefined);
  const [editingProject, setEditingProject] = useState<Partial<Project> | null | undefined>(undefined);
  const [editingAchievement, setEditingAchievement] = useState<Partial<Achievement> | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<{ kind: string; id: string; label: string } | null>(null); const [deleteBusy, setDeleteBusy] = useState(false);
  const [invite, setInvite] = useState({ name: '', email: '', role: 'member', confirmAdmin: false }); const [inviteBusy, setInviteBusy] = useState(false);
  const [revEntity, setRevEntity] = useState(''); const [revId, setRevId] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null); const [uploadType, setUploadType] = useState<'image' | 'pdf'>('image');
  const [uploadProgress, setUploadProgress] = useState(0); const [uploadBusy, setUploadBusy] = useState(false); const [uploadUrl, setUploadUrl] = useState('');

  useEffect(() => { setToken(window.localStorage.getItem('aict_admin_token')); }, []);
  const reload = useCallback(async () => {
    const [m, p, a, msg, u, s, au, rev, med] = await Promise.all([
      apiGet<Member[]>('/admin/members', true), apiGet<Project[]>('/admin/projects', true), apiGet<Achievement[]>('/admin/achievements', true),
      apiGet<ContactMessage[]>('/admin/messages', true), apiGet<UserRole[]>('/admin/users', true), apiGet<SiteSettings>('/admin/settings', true),
      apiGet<AuditEntry[]>('/admin/audit?limit=50', true), apiGet<Revision[]>('/admin/revisions', true), apiGet<MediaItem[]>('/admin/media', true),
    ]);
    if (m.error) setError(m.error.message); else setMembers(m.data || []);
    if (p.data) setProjects(p.data);
    if (a.data) setAchievements(a.data);
    if (msg.data) setMessages(msg.data);
    if (u.data) setUsers(u.data);
    if (s.data) setSettings(s.data);
    if (au.data) setAudit(au.data);
    if (rev.data) setRevisions(rev.data);
    if (med.data) { setMedia(med.data); setMediaError(''); } else if (med.error) setMediaError(med.error.message);
    // Admin detection: settings + users are admin-only. A member gets 403 there.
    setIsAdmin(Boolean(s.data || u.data));
    setLoading(false);
  }, []);
  useEffect(() => { if (token) reload(); else setLoading(false); }, [token, reload]);

  async function doDelete() {
    if (!deleting) return; setDeleteBusy(true);
    const path = deleting.kind === 'member' ? `/admin/members/${deleting.id}` : deleting.kind === 'project' ? `/admin/projects/${deleting.id}` : deleting.kind === 'achievement' ? `/admin/achievements/${deleting.id}` : `/admin/messages/${deleting.id}`;
    const r = await apiSend(path, 'DELETE', {}, true); setDeleteBusy(false);
    if (r.error) { push('error', r.error.message); } else { push('success', 'Deleted.'); setDeleting(null); reload(); }
  }
  async function revalidate() {
    const r = await apiSend('/admin/revalidate', 'POST', {}, true);
    if (r.error) push('error', r.error.message); else push('success', 'Saved — live site updates only after a Netlify rebuild (saved_refresh_pending).');
  }
  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (invite.role === 'admin' && !invite.confirmAdmin) { push('error', 'Tick the deliberate admin confirmation before inviting an admin.'); return; }
    if (!invite.name.trim() || !invite.email.trim()) { push('error', 'Name and email are required.'); return; }
    setInviteBusy(true);
    const r = await apiSend('/admin/users/invite', 'POST', { name: invite.name, email: invite.email, role: invite.role }, true);
    setInviteBusy(false);
    if (r.error) push('error', r.error.message); else { push('success', 'Invitation created (idempotent — a retry for the same email does not create a duplicate).'); setInvite({ name: '', email: '', role: 'member', confirmAdmin: false }); reload(); }
  }
  async function userAction(id: string, kind: string, body?: unknown) {
    const path = kind === 'resend' ? `/admin/users/${id}/resend-invite` : kind === 'revoke' ? `/admin/users/${id}/revoke-invite` : `/admin/users/${id}`;
    const r = await apiSend(path, kind === 'resend' || kind === 'revoke' ? 'POST' : 'PATCH', body || {}, true);
    if (r.error) push('error', r.error.message); else { push('success', 'Account updated.'); reload(); }
  }
  async function messageAction(id: string, read: boolean) {
    const r = await apiSend(`/admin/messages/${id}`, 'PATCH', { read }, true);
    if (r.error) push('error', r.error.message); else reload();
  }
  async function restoreRevision(id: string) {
    const r = await apiSend(`/admin/revisions/${id}/restore`, 'POST', {}, true);
    if (r.error) push('error', r.error.message); else { push('success', 'Revision restored. Reload the record to see it, and remember the live site updates only after a Netlify rebuild.'); reload(); }
  }
  async function upload(e: React.FormEvent) {
    e.preventDefault(); if (!uploadFile) { push('error', 'Choose a file first.'); return; }
    const ext = uploadFile.name.split('.').pop()?.toLowerCase() || '';
    if (uploadType === 'pdf' && ext !== 'pdf') { push('error', 'Resumes must be PDF files.'); return; }
    if (uploadType === 'image' && !['jpg', 'jpeg', 'png', 'webp', 'avif'].includes(ext)) { push('error', 'Images must be jpg, png, webp or avif.'); return; }
    if (uploadFile.size > 5 * 1024 * 1024) { push('error', 'File must be 5 MB or smaller.'); return; }
    setUploadBusy(true); setUploadProgress(0); setUploadUrl('');
    const sign = await apiSend('/admin/upload/sign', 'POST', { file_type: uploadType, file_size: uploadFile.size, file_name: uploadFile.name }, true);
    if (sign.error || !sign.data) { push('error', sign.error?.message || 'Upload signing is unavailable.'); setUploadBusy(false); return; }
    const d = sign.data as Record<string, unknown>;
    const form = new FormData();
    form.append('file', uploadFile); form.append('api_key', String(d.api_key)); form.append('timestamp', String(d.timestamp)); form.append('folder', String(d.folder)); form.append('public_id', String(d.public_id)); form.append('signature', String(d.signature));
    const endpoint = `https://api.cloudinary.com/v1_1/${String(d.cloud_name)}/${uploadType === 'pdf' ? 'raw' : 'image'}/upload`;
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (ev) => { if (ev.lengthComputable) setUploadProgress(Math.round((ev.loaded / ev.total) * 100)); };
    xhr.onload = () => { setUploadBusy(false); try { const j = JSON.parse(xhr.responseText); if (xhr.status >= 200 && xhr.status < 300 && j.secure_url) { setUploadUrl(j.secure_url); push('success', 'Upload complete. Copy the URL into a member/project form.'); reload(); } else push('error', j.error?.message || 'Upload failed.'); } catch { push('error', 'Upload failed.'); } };
    xhr.onerror = () => { setUploadBusy(false); push('error', 'Upload failed (network).'); };
    xhr.open('POST', endpoint); xhr.send(form);
  }

  if (loading) return <Loading />;
  if (!token) return (<div><h1>Admin dashboard</h1><p className="error">Sign-in required. <a href="/admin/login">Go to admin login</a></p><p className="muted">There is no sign-up on this site. An admin must invite you first.</p></div>);
  return (<div><h1>Admin dashboard</h1>
    {error && <ErrorBox message={error} />}
    <p className="muted">Signed in as {isAdmin ? 'admin' : 'member'}. Members see and edit only their own records; admin-only tabs show a permission-denied state for members. <strong>Publish note:</strong> saving writes to the database; the live static site updates only after a Netlify rebuild.</p>
    <div className="tabs" role="tablist" aria-label="Admin sections">{TABS.map((t) => <button key={t} role="tab" aria-selected={tab === t} className={`tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{t}</button>)}
      <button className="btn secondary small" onClick={() => { window.localStorage.removeItem('aict_admin_token'); window.location.href = '/admin/login'; }}>Sign out</button></div>

    {tab === 'overview' && (<div><p>Members: <strong>{members.length}</strong> · Projects: <strong>{projects.length}</strong> · Achievements: <strong>{achievements.length}</strong> · Messages: <strong>{messages.length}</strong> · Accounts: <strong>{users.length}</strong></p>
      <p><button className="btn secondary" onClick={revalidate}>Trigger publish note (revalidate)</button> — this honestly returns saved_refresh_pending; it does not instantly update the live site.</p>
      <p className="muted">Drafts, private resumes, messages and audit data never appear on public pages.</p></div>)}

    {tab === 'members' && (<div><p><button className="btn" onClick={() => setEditingMember({})}>+ New member</button></p>
      <div className="grid">{members.map((m) => (<div className="card" key={m.id}><h3>{m.full_name} <SampleBadge isSample={m.isSample} /></h3><p className="muted">{m.role_title} · {m.status}</p><p><button className="btn secondary small" onClick={() => setEditingMember(m)}>Edit</button>{' '}{isAdmin && <button className="btn secondary small" onClick={() => setDeleting({ kind: 'member', id: m.id, label: m.full_name })}>Delete</button>}</p></div>))}</div>
      {!members.length && <p className="muted">No members visible to this account.</p>}
      {editingMember !== undefined && (<Modal title={editingMember?.id ? 'Edit member' : 'New member'} onClose={() => setEditingMember(undefined)}><MemberForm initial={editingMember} onSaved={() => { setEditingMember(undefined); reload(); }} onCancel={() => setEditingMember(undefined)} push={push} /></Modal>)}</div>)}

    {tab === 'projects' && (<div><p><button className="btn" onClick={() => setEditingProject({})}>+ New project</button></p>
      <div className="grid">{projects.map((p) => (<div className="card" key={p.id}><h3>{p.title} <SampleBadge isSample={p.isSample} /></h3><p className="muted">{p.category} · {p.status}</p><p><button className="btn secondary small" onClick={() => setEditingProject(p)}>Edit</button>{' '}{isAdmin && <button className="btn secondary small" onClick={() => setDeleting({ kind: 'project', id: p.id, label: p.title })}>Delete</button>}</p></div>))}</div>
      {!projects.length && <p className="muted">No projects visible to this account.</p>}
      {editingProject !== undefined && (<Modal title={editingProject?.id ? 'Edit project' : 'New project'} onClose={() => setEditingProject(undefined)}><ProjectForm initial={editingProject} members={members} onSaved={() => { setEditingProject(undefined); reload(); }} onCancel={() => setEditingProject(undefined)} push={push} /></Modal>)}</div>)}

    {tab === 'achievements' && (<div><p><button className="btn" onClick={() => setEditingAchievement({})}>+ New achievement</button></p>
      <div className="grid">{achievements.map((a) => (<div className="card" key={a.id}><h3>{a.title} <SampleBadge isSample={a.isSample} /></h3><p className="muted">{a.issuer} · {a.type} · {a.date}</p><p>{a.description}</p><p><button className="btn secondary small" onClick={() => setEditingAchievement(a)}>Edit</button>{' '}{isAdmin && <button className="btn secondary small" onClick={() => setDeleting({ kind: 'achievement', id: a.id, label: a.title })}>Delete</button>}</p></div>))}</div>
      {!achievements.length && <p className="muted">No achievements visible to this account.</p>}
      {editingAchievement !== undefined && (<Modal title={editingAchievement?.id ? 'Edit achievement' : 'New achievement'} onClose={() => setEditingAchievement(undefined)}><AchievementForm initial={editingAchievement} members={members} isAdmin={isAdmin} onSaved={() => { setEditingAchievement(undefined); reload(); }} onCancel={() => setEditingAchievement(undefined)} push={push} /></Modal>)}</div>)}

    {tab === 'users' && (!isAdmin ? <p className="error">Permission denied: user invitations are admin-only. A member calling this section gets 403 from the backend.</p> : (<div>
      <form onSubmit={sendInvite}><h2>Invite an account</h2><p className="muted">Only an authenticated admin may create accounts. There is no public sign-up.</p>
        <label>Name<input required value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} /></label>
        <label>Email<input required type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} /></label>
        <label>Role<select value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })}><option value="member">member</option><option value="admin">admin</option></select></label>
        {invite.role === 'admin' && <label><input type="checkbox" checked={invite.confirmAdmin} onChange={(e) => setInvite({ ...invite, confirmAdmin: e.target.checked })} /> I deliberately confirm granting admin — this is not the default.</label>}
        <p><button className="btn" disabled={inviteBusy}>{inviteBusy ? 'Sending…' : 'Send invitation'}</button></p></form>
      <div className="grid">{users.map((u) => (<div className="card" key={u.id}><h3>{u.name || u.email}</h3><p className="muted">{u.email} · {u.role} · {u.account_status}</p>
        <p>{u.account_status === 'invited' && <><button className="btn secondary small" onClick={() => userAction(u.id, 'resend')}>Resend</button>{' '}<button className="btn secondary small" onClick={() => userAction(u.id, 'revoke')}>Revoke</button>{' '}</>}
        {u.account_status === 'active' && <button className="btn secondary small" onClick={() => userAction(u.id, 'patch', { account_status: 'deactivated' })}>Deactivate</button>}
        {u.account_status === 'deactivated' && <button className="btn secondary small" onClick={() => userAction(u.id, 'patch', { account_status: 'active' })}>Reactivate</button>}</p></div>))}</div>
      {!users.length && <p className="muted">No accounts yet, or the backend could not list them.</p>}</div>))}

    {tab === 'messages' && (!isAdmin ? <p className="error">Permission denied: the messages inbox is admin-only.</p> : (<div>{messages.map((m) => (<div className="card" key={m.id}><strong>{m.name} ({m.email})</strong> <span className="muted">{m.read ? 'Read' : 'Unread'} · {m.created_at}</span><p>{m.subject}</p><p>{m.message}</p>
        <p><a className="btn secondary small" href={`mailto:${m.email}?subject=${encodeURIComponent('Re: ' + (m.subject || ''))}`}>Reply by email</a>{' '}<button className="btn secondary small" onClick={() => messageAction(m.id, !m.read)}>{m.read ? 'Mark unread' : 'Mark read'}</button>{' '}<button className="btn secondary small" onClick={() => setDeleting({ kind: 'message', id: m.id, label: m.subject || m.name })}>Delete</button></p></div>))}
      {!messages.length && <p className="muted">No messages yet.</p>}</div>))}

    {tab === 'media' && (<div><h2>Media library</h2>
      {mediaError && <p className="error">{mediaError} — uploads are fail-closed until Cloudinary is configured in Vercel.</p>}
      <form onSubmit={upload}><h3>Upload</h3>
        <label>File type<select value={uploadType} onChange={(e) => setUploadType(e.target.value as 'image' | 'pdf')}><option value="image">Photo / image</option><option value="pdf">PDF resume (max 5 MB)</option></select></label>
        <label>File<input type="file" accept={uploadType === 'pdf' ? 'application/pdf' : 'image/jpeg,image/png,image/webp,image/avif'} onChange={(e) => setUploadFile(e.target.files?.[0] || null)} /></label>
        {uploadBusy && <p>Uploading… {uploadProgress}%</p>}
        {uploadUrl && <p className="success">Uploaded: {uploadUrl} <CopyButton text={uploadUrl} label="Copy URL" /></p>}
        <p><button className="btn" disabled={uploadBusy}>{uploadBusy ? 'Uploading…' : 'Upload (signed)'}</button></p>
        <p className="muted">Uploads are signed by the backend after auth + role checks. No Cloudinary secret reaches the browser.</p></form>
      <div className="grid">{media.map((f) => (<div className="card" key={f.public_id}>{f.resource_type === 'image' ? <img src={f.secure_url} alt={f.public_id} style={{ maxWidth: '100%', borderRadius: 12 }} /> : <p>{f.public_id} ({f.format})</p>}<p className="muted">{f.public_id} · {f.format} · {f.bytes ? `${Math.round(f.bytes / 1024)} KB` : ''} · {f.created_at}</p><CopyButton text={f.secure_url} label="Copy URL" /></div>))}</div>
      {!media.length && !mediaError && <p className="muted">No media files yet.</p>}</div>)}

    {tab === 'audit' && (!isAdmin ? <p className="error">Permission denied: audit and revisions are admin-only.</p> : (<div><h2>Audit log</h2>
      {audit.map((a) => (<div className="card" key={a.id}><p><strong>{a.action}</strong> · {a.entity} / {a.entity_id}</p><p className="muted">{a.user_id} · {a.created_at}</p></div>))}
      {!audit.length && <p className="muted">No audit entries yet.</p>}
      <h2>Revisions</h2><p className="muted">Snapshots are taken on every member/project/achievement update. Site-settings revisions are not snapshotted — documented gap.</p>
      <label>Filter entity<input value={revEntity} onChange={(e) => setRevEntity(e.target.value)} placeholder="members, projects, achievements" /></label>
      <label>Filter entity ID<input value={revId} onChange={(e) => setRevId(e.target.value)} placeholder="Record ID" /></label>
      <p><button className="btn secondary" onClick={async () => { const r = await apiGet<Revision[]>(`/admin/revisions?entity=${encodeURIComponent(revEntity)}&entity_id=${encodeURIComponent(revId)}`, true); if (r.error) push('error', r.error.message); else setRevisions(r.data || []); }}>Load revisions</button></p>
      {revisions.map((r) => (<div className="card" key={r.id}><p><strong>{r.entity} / {r.entity_id}</strong></p><p className="muted">{r.user_id} · {r.created_at}</p><p><button className="btn secondary small" onClick={() => restoreRevision(r.id)}>Restore this snapshot</button></p></div>))}
      {!revisions.length && <p className="muted">No revisions yet — edit a member, project or achievement first, and a snapshot will be stored before the save.</p>}</div>))}

    {tab === 'settings' && (!isAdmin ? <p className="error">Permission denied: site settings are admin-only.</p> : (settings ? <SettingsForm initial={settings} onSaved={reload} push={push} /> : <p className="muted">Settings could not be loaded.</p>))}

    {deleting && <ConfirmDialog text={`Delete "${deleting.label}"? This cannot be undone from this dialog.`} busy={deleteBusy} onCancel={() => setDeleting(null)} onConfirm={doDelete} />}
    <Toasts toasts={toasts} dismiss={dismiss} />
  </div>);
}
