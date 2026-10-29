'use client';
import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiSend } from '../../lib/api';
import type { Member, Project, Achievement, ContactMessage, SiteSettings, UserRole, AuditEntry, Revision, MediaItem } from '../../lib/types';
import { Loading, ErrorBox, SampleBadge } from '../shared';
import { Toasts, useToasts, Modal, ConfirmDialog, CopyButton } from '../../components/ui';
import { MemberForm, ProjectForm, AchievementForm, SettingsForm } from '../../components/adminForms';

type Tab = 'overview' | 'members' | 'projects' | 'achievements' | 'users' | 'messages' | 'media' | 'audit' | 'settings';
const NAV_GROUPS: { label: string; tabs: { id: Tab; label: string }[] }[] = [
  { label: 'Content', tabs: [{ id: 'overview', label: 'Start here' }, { id: 'members', label: 'Team members' }, { id: 'projects', label: 'Projects' }, { id: 'achievements', label: 'Achievements' }] },
  { label: 'People', tabs: [{ id: 'users', label: 'Team accounts' }, { id: 'messages', label: 'Messages' }, { id: 'media', label: 'Photos & files' }] },
  { label: 'Advanced', tabs: [{ id: 'audit', label: 'History' }, { id: 'settings', label: 'Site settings' }] },
];
const TAB_LABEL: Record<Tab, string> = { overview: 'Start here', members: 'Team members', projects: 'Projects', achievements: 'Achievements', users: 'Team accounts', messages: 'Messages', media: 'Photos & files', audit: 'History', settings: 'Site settings' };

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
  const [selfCreate, setSelfCreate] = useState(false);
  const [editingProject, setEditingProject] = useState<Partial<Project> | null | undefined>(undefined);
  const [editingAchievement, setEditingAchievement] = useState<Partial<Achievement> | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<{ kind: string; id: string; label: string } | null>(null); const [deleteBusy, setDeleteBusy] = useState(false);
  const [invite, setInvite] = useState({ name: '', email: '', role: 'member', member_id: '', confirmAdmin: false }); const [inviteBusy, setInviteBusy] = useState(false); const [inviteNote, setInviteNote] = useState('');
  const [linkDraft, setLinkDraft] = useState<Record<string, string>>({});
  const [revEntity, setRevEntity] = useState(''); const [revId, setRevId] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null); const [uploadType, setUploadType] = useState<'image' | 'pdf'>('image');
  const [uploadProgress, setUploadProgress] = useState(0); const [uploadBusy, setUploadBusy] = useState(false); const [uploadUrl, setUploadUrl] = useState('');
  const [memberQuery, setMemberQuery] = useState(''); const [projectQuery, setProjectQuery] = useState(''); const [achievementQuery, setAchievementQuery] = useState('');

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
  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (invite.role === 'admin' && !invite.confirmAdmin) { push('error', 'Tick the confirmation before inviting an admin.'); return; }
    if (!invite.name.trim() || !invite.email.trim()) { push('error', 'Name and email are required.'); return; }
    setInviteBusy(true); setInviteNote('');
    const r = await apiSend('/admin/users/invite', 'POST', { name: invite.name, email: invite.email, role: invite.role, member_id: invite.member_id }, true);
    setInviteBusy(false);
    if (r.error) { push('error', r.error.message); return; }
    const delivery = (r.data as Record<string, unknown> | undefined)?.email_delivery;
    if (delivery === 'not_configured') setInviteNote('Account created, but no invitation email was sent automatically. Send this person a password link from Firebase Console → Authentication → that user → Reset password. They set their own password — you never see it.');
    else setInviteNote('Account created. The person will receive a link to set their own password.');
    push('success', 'Invitation created. Sending the same invitation again does not create a duplicate.');
    setInvite({ name: '', email: '', role: 'member', member_id: '', confirmAdmin: false }); reload();
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
    if (r.error) push('error', r.error.message); else { push('success', 'Revision restored. Reload the record to see it. To make it live, rebuild the site in Netlify.'); reload(); }
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
    xhr.onload = () => { setUploadBusy(false); try { const j = JSON.parse(xhr.responseText); if (xhr.status >= 200 && xhr.status < 300 && j.secure_url) { setUploadUrl(j.secure_url); push('success', 'Upload complete. Copy the URL into a member or project form.'); reload(); } else push('error', j.error?.message || 'Upload failed.'); } catch { push('error', 'Upload failed.'); } };
    xhr.onerror = () => { setUploadBusy(false); push('error', 'Upload failed (network).'); };
    xhr.open('POST', endpoint); xhr.send(form);
  }

  if (loading) return <Loading />;
  if (!token) return (<div><h1>Admin dashboard</h1><p className="error">Sign-in required. <a href="/admin/login">Go to admin login</a></p><p className="muted">There is no sign-up on this site. An admin must invite you first.</p></div>);
  const unread = messages.filter((m) => !m.read).length;
  const filteredMembers = members.filter((m) => (m.full_name + ' ' + (m.role_title || '')).toLowerCase().includes(memberQuery.toLowerCase()));
  const filteredProjects = projects.filter((p) => (p.title + ' ' + (p.category || '')).toLowerCase().includes(projectQuery.toLowerCase()));
  const filteredAchievements = achievements.filter((a) => (a.title + ' ' + (a.issuer || '')).toLowerCase().includes(achievementQuery.toLowerCase()));
  const needsProfile = !isAdmin && members.length === 0;
  const openSelfCreate = () => { setSelfCreate(true); setEditingMember({}); };
  return (<div><h1>Admin dashboard</h1>
    {error && <ErrorBox message={error} />}
    <p className="muted">Signed in as {isAdmin ? 'admin' : 'team member'}. Admins can edit everything. Team members can only edit their own profile and projects they are assigned to.</p>
    <nav className="admin-nav" aria-label="Admin sections">{NAV_GROUPS.map((g) => (<div className="admin-nav-group" key={g.label}><span className="admin-nav-label">{g.label}</span><div className="tabs admin-tabs">{g.tabs.map((t) => (<button key={t.id} role="tab" aria-selected={tab === t.id} className={`tab-btn${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>{t.label}{t.id === 'messages' && unread > 0 ? ` (${unread})` : ''}</button>))}</div></div>))}
      <button className="btn secondary small" onClick={() => { window.localStorage.removeItem('aict_admin_token'); window.location.href = '/admin/login'; }}>Sign out</button></nav>

    {tab === 'overview' && (<div>
      {needsProfile && (<div className="card"><h2>You don't have a profile yet</h2><p>Create your team profile here. It will be saved as a draft, and an admin will review and publish it.</p><p><button className="btn" onClick={openSelfCreate}>Create my profile</button></p></div>)}
      <h2>What would you like to do?</h2>
      <div className="action-grid">
        {isAdmin && <button className="action-card" onClick={() => { setTab('members'); setEditingMember({}); }}><strong>+ Add a team member</strong><span>Create the public profile visitors will see.</span></button>}
        {!isAdmin && !needsProfile && <button className="action-card" onClick={() => setTab('members')}><strong>Edit my profile</strong><span>Update your bio, skills and links.</span></button>}
        <button className="action-card" onClick={() => { setTab('projects'); setEditingProject({}); }}><strong>+ Add a project</strong><span>Show work the group has done.</span></button>
        {isAdmin && <button className="action-card" onClick={() => setTab('users')}><strong>Invite an account</strong><span>Let someone log in. They set their own password.</span></button>}
        {isAdmin && <button className="action-card" onClick={() => setTab('settings')}><strong>Edit site settings</strong><span>Group name, tagline, contact and social links.</span></button>}
      </div>
      <h2>Your site at a glance</h2>
      <div className="stat-grid">
        <div className="stat-card"><strong>{members.length}</strong><span>Team members</span></div>
        <div className="stat-card"><strong>{projects.length}</strong><span>Projects</span></div>
        <div className="stat-card"><strong>{achievements.length}</strong><span>Achievements</span></div>
        <div className="stat-card"><strong>{unread}</strong><span>Unread messages</span></div>
        <div className="stat-card"><strong>{users.length}</strong><span>Sign-in accounts</span></div>
      </div>
      <div className="card"><h2>How publishing works — in plain words</h2><p>1. Save here — your change is stored in the database right away.<br />2. Rebuild the site in Netlify (Deploys → Trigger deploy).<br />3. About a minute later, visitors see the new version.</p><p className="muted">Saving alone does not update the public site instantly, because the public site is a static export. Drafts, private resumes, messages and history never appear on public pages.</p></div>
      {isAdmin && (<div className="card"><h2>First steps checklist</h2><p>{settings?.group_name ? '✓' : '○'} Site settings filled in<br />{members.length > 0 ? '✓' : '○'} At least one team member<br />{projects.length > 0 ? '✓' : '○'} At least one project<br />{members.some((m) => m.status === 'published') ? '✓' : '○'} At least one member published (not just draft)</p></div>)}
    </div>)}

    {tab === 'members' && (<div>
      <p className="muted">A team profile is what visitors see. A sign-in account is separate — link the two in Team accounts so a member can edit their own profile.</p>
      {needsProfile && (<div className="card"><h2>You don't have a profile yet</h2><p>Create your team profile here. It will be saved as a draft, and an admin will review and publish it.</p><p><button className="btn" onClick={openSelfCreate}>Create my profile</button></p></div>)}
      {isAdmin && <p><button className="btn" onClick={() => { setSelfCreate(false); setEditingMember({}); }}>+ New member</button></p>}
      <p><input className="search-input" placeholder="Search team members…" value={memberQuery} onChange={(e) => setMemberQuery(e.target.value)} /></p>
      <div className="grid">{filteredMembers.map((m) => (<div className="card" key={m.id}><h3>{m.full_name} <SampleBadge isSample={m.isSample} /></h3><p className="muted">{m.role_title} · <span className={`status-chip ${m.status}`}>{m.status === 'published' ? 'Published' : 'Draft'}</span></p><p><button className="btn secondary small" onClick={() => { setSelfCreate(false); setEditingMember(m); }}>Edit</button>{' '}{isAdmin && <button className="btn secondary small" onClick={() => setDeleting({ kind: 'member', id: m.id, label: m.full_name })}>Delete</button>}</p></div>))}</div>
      {!filteredMembers.length && <p className="muted">{memberQuery ? 'No team members match that search.' : 'No team members yet.'} {isAdmin && <button className="btn secondary small" onClick={() => { setSelfCreate(false); setEditingMember({}); }}>Add the first member</button>}</p>}
      {editingMember !== undefined && (<Modal title={selfCreate ? 'Create my profile' : editingMember?.id ? 'Edit member' : 'New member'} onClose={() => { setEditingMember(undefined); setSelfCreate(false); }}><MemberForm initial={editingMember} selfCreate={selfCreate} onSaved={() => { setEditingMember(undefined); setSelfCreate(false); reload(); }} onCancel={() => { setEditingMember(undefined); setSelfCreate(false); }} push={push} /></Modal>)}</div>)}

    {tab === 'projects' && (<div><p>{isAdmin && <button className="btn" onClick={() => setEditingProject({})}>+ New project</button>} {!isAdmin && <button className="btn" onClick={() => setEditingProject({})}>+ New project</button>}</p>
      <p><input className="search-input" placeholder="Search projects…" value={projectQuery} onChange={(e) => setProjectQuery(e.target.value)} /></p>
      <div className="grid">{filteredProjects.map((p) => (<div className="card" key={p.id}><h3>{p.title} <SampleBadge isSample={p.isSample} /></h3><p className="muted">{p.category} · <span className={`status-chip ${p.status}`}>{p.status === 'published' ? 'Published' : 'Draft'}</span></p><p><button className="btn secondary small" onClick={() => setEditingProject(p)}>Edit</button>{' '}{isAdmin && <button className="btn secondary small" onClick={() => setDeleting({ kind: 'project', id: p.id, label: p.title })}>Delete</button>}</p></div>))}</div>
      {!filteredProjects.length && <p className="muted">{projectQuery ? 'No projects match that search.' : 'No projects yet.'} <button className="btn secondary small" onClick={() => setEditingProject({})}>Add the first project</button></p>}
      {editingProject !== undefined && (<Modal title={editingProject?.id ? 'Edit project' : 'New project'} onClose={() => setEditingProject(undefined)}><ProjectForm initial={editingProject} members={members} onSaved={() => { setEditingProject(undefined); reload(); }} onCancel={() => setEditingProject(undefined)} push={push} /></Modal>)}</div>)}

    {tab === 'achievements' && (<div><p><button className="btn" onClick={() => setEditingAchievement({})}>+ New achievement</button></p>
      <p><input className="search-input" placeholder="Search achievements…" value={achievementQuery} onChange={(e) => setAchievementQuery(e.target.value)} /></p>
      <div className="grid">{filteredAchievements.map((a) => (<div className="card" key={a.id}><h3>{a.title} <SampleBadge isSample={a.isSample} /></h3><p className="muted">{a.issuer} · {a.type} · {a.date}</p><p>{a.description}</p><p><button className="btn secondary small" onClick={() => setEditingAchievement(a)}>Edit</button>{' '}{isAdmin && <button className="btn secondary small" onClick={() => setDeleting({ kind: 'achievement', id: a.id, label: a.title })}>Delete</button>}</p></div>))}</div>
      {!filteredAchievements.length && <p className="muted">{achievementQuery ? 'No achievements match that search.' : 'No achievements yet.'} <button className="btn secondary small" onClick={() => setEditingAchievement({})}>Add the first achievement</button></p>}
      {editingAchievement !== undefined && (<Modal title={editingAchievement?.id ? 'Edit achievement' : 'New achievement'} onClose={() => setEditingAchievement(undefined)}><AchievementForm initial={editingAchievement} members={members} isAdmin={isAdmin} onSaved={() => { setEditingAchievement(undefined); reload(); }} onCancel={() => setEditingAchievement(undefined)} push={push} /></Modal>)}</div>)}

    {tab === 'users' && (!isAdmin ? <p className="error">Only admins can see this. If you are a team member, ask an admin.</p> : (<div>
      <p className="muted">Two things, kept separate: <strong>a sign-in account</strong> lets a person log in, and <strong>a team profile</strong> is what visitors see. Link them here so a member can edit their own profile. You cannot change your own account from this page — the server will refuse it.</p>
      <form onSubmit={sendInvite}><h2>Invite an account</h2><p className="muted">Only an admin can create accounts. There is no public sign-up. The person sets their own password — you do not set it, and you never see it.</p>
        <label>Name<input required value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} /></label>
        <label>Email<input required type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} /></label>
        <label>Role<select value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })}><option value="member">Team member</option><option value="admin">Admin</option></select></label>
        <label>Link to a team profile (optional)<select value={invite.member_id} onChange={(e) => setInvite({ ...invite, member_id: e.target.value })}><option value="">No profile yet — they can create their own later</option>{members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}</select></label>
        <p className="muted">If you leave the profile unlinked, the member will see “Create my profile” after logging in, and their profile will be saved as a draft for you to publish.</p>
        {invite.role === 'admin' && <label><input type="checkbox" checked={invite.confirmAdmin} onChange={(e) => setInvite({ ...invite, confirmAdmin: e.target.checked })} /> I deliberately confirm granting admin — this is not the default.</label>}
        <p><button className="btn" disabled={inviteBusy}>{inviteBusy ? 'Sending…' : 'Send invitation'}</button></p>
        {inviteNote && <p className="success">{inviteNote}</p>}</form>
      <h2>Accounts</h2>
      <div className="grid">{users.map((u) => { const linked = members.find((m) => m.id === u.member_id); return (<div className="card" key={u.id}><h3>{u.name || u.email}</h3><p className="muted">{u.email} · {u.role} · {u.account_status}</p><p className="muted">Profile: {linked ? linked.full_name : 'Not linked yet'}</p>
        <label>Link profile<select value={linkDraft[u.id] ?? u.member_id ?? ''} onChange={(e) => setLinkDraft({ ...linkDraft, [u.id]: e.target.value })}><option value="">No profile</option>{members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}</select></label>
        <p><button className="btn secondary small" onClick={() => userAction(u.id, 'patch', { member_id: linkDraft[u.id] ?? u.member_id ?? '' })}>Save link</button>{' '}
        {u.account_status === 'invited' && <><button className="btn secondary small" onClick={() => userAction(u.id, 'resend')}>Resend</button>{' '}<button className="btn secondary small" onClick={() => userAction(u.id, 'revoke')}>Revoke</button>{' '}</>}
        {u.account_status === 'active' && <button className="btn secondary small" onClick={() => userAction(u.id, 'patch', { account_status: 'deactivated' })}>Deactivate</button>}
        {u.account_status === 'deactivated' && <button className="btn secondary small" onClick={() => userAction(u.id, 'patch', { account_status: 'active' })}>Reactivate</button>}</p></div>); })}</div>
      {!users.length && <p className="muted">No accounts yet, or the backend could not list them.</p>}</div>))}

    {tab === 'messages' && (!isAdmin ? <p className="error">Only admins can see this. If you are a team member, ask an admin.</p> : (<div>{messages.map((m) => (<div className="card" key={m.id}><strong>{m.name} ({m.email})</strong> <span className="muted">{m.read ? 'Read' : 'Unread'} · {m.created_at}</span><p>{m.subject}</p><p>{m.message}</p>
        <p><a className="btn secondary small" href={`mailto:${m.email}?subject=${encodeURIComponent('Re: ' + (m.subject || ''))}`}>Reply by email</a>{' '}<button className="btn secondary small" onClick={() => messageAction(m.id, !m.read)}>{m.read ? 'Mark unread' : 'Mark read'}</button>{' '}<button className="btn secondary small" onClick={() => setDeleting({ kind: 'message', id: m.id, label: m.subject || m.name })}>Delete</button></p></div>))}
      {!messages.length && <p className="muted">No messages yet.</p>}</div>))}

    {tab === 'media' && (<div><h2>Photos & files</h2>
      {mediaError && <p className="error">{mediaError} — uploads will not work until Cloudinary is set up in Vercel.</p>}
      <form onSubmit={upload}><h3>Upload</h3>
        <label>File type<select value={uploadType} onChange={(e) => setUploadType(e.target.value as 'image' | 'pdf')}><option value="image">Photo / image</option><option value="pdf">PDF resume (max 5 MB)</option></select></label>
        <label>File<input type="file" accept={uploadType === 'pdf' ? 'application/pdf' : 'image/jpeg,image/png,image/webp,image/avif'} onChange={(e) => setUploadFile(e.target.files?.[0] || null)} /></label>
        {uploadBusy && <p>Uploading… {uploadProgress}%</p>}
        {uploadUrl && <p className="success">Uploaded: {uploadUrl} <CopyButton text={uploadUrl} label="Copy URL" /></p>}
        <p><button className="btn" disabled={uploadBusy}>{uploadBusy ? 'Uploading…' : 'Upload'}</button></p>
        <p className="muted">Uploads are checked by the server first. Your Cloudinary secret keys never reach the browser. After uploading, copy the URL into a member or project form.</p></form>
      <div className="grid">{media.map((f) => (<div className="card" key={f.public_id}>{f.resource_type === 'image' ? <img src={f.secure_url} alt={f.public_id} style={{ maxWidth: '100%', borderRadius: 12 }} /> : <p>{f.public_id} ({f.format})</p>}<p className="muted">{f.public_id} · {f.format} · {f.bytes ? `${Math.round(f.bytes / 1024)} KB` : ''} · {f.created_at}</p><CopyButton text={f.secure_url} label="Copy URL" /></div>))}</div>
      {!media.length && !mediaError && <p className="muted">No files yet. Upload a photo or resume above, then paste its URL into a form.</p>}</div>)}

    {tab === 'audit' && (!isAdmin ? <p className="error">Only admins can see this. If you are a team member, ask an admin.</p> : (<div><h2>History</h2><p className="muted">Who changed what, and when. This is a record — it cannot be edited from here.</p>
      {audit.map((a) => (<div className="card" key={a.id}><p><strong>{a.action}</strong> · {a.entity} / {a.entity_id}</p><p className="muted">{a.user_id} · {a.created_at}</p></div>))}
      {!audit.length && <p className="muted">No history yet.</p>}
      <h2>Earlier versions</h2><p className="muted">A snapshot is saved every time a member, project or achievement is edited, so you can go back to it. Site settings changes are not saved as snapshots yet, so they cannot be restored from here.</p>
      <label>Filter by type<input value={revEntity} onChange={(e) => setRevEntity(e.target.value)} placeholder="members, projects, achievements" /></label>
      <label>Filter by record ID<input value={revId} onChange={(e) => setRevId(e.target.value)} placeholder="Record ID" /></label>
      <p><button className="btn secondary" onClick={async () => { const r = await apiGet<Revision[]>(`/admin/revisions?entity=${encodeURIComponent(revEntity)}&entity_id=${encodeURIComponent(revId)}`, true); if (r.error) push('error', r.error.message); else setRevisions(r.data || []); }}>Load earlier versions</button></p>
      {revisions.map((r) => (<div className="card" key={r.id}><p><strong>{r.entity} / {r.entity_id}</strong></p><p className="muted">{r.user_id} · {r.created_at}</p><p><button className="btn secondary small" onClick={() => restoreRevision(r.id)}>Restore this version</button></p></div>))}
      {!revisions.length && <p className="muted">No earlier versions yet — edit a member, project or achievement first, and a snapshot will be saved before the change.</p>}</div>))}

    {tab === 'settings' && (!isAdmin ? <p className="error">Only admins can see this. If you are a team member, ask an admin.</p> : (settings ? <SettingsForm initial={settings} onSaved={reload} push={push} /> : <p className="muted">Settings could not be loaded.</p>))}

    {deleting && <ConfirmDialog text={`Delete "${deleting.label}"? This cannot be undone from this dialog.`} busy={deleteBusy} onCancel={() => setDeleting(null)} onConfirm={doDelete} />}
    <Toasts toasts={toasts} dismiss={dismiss} />
  </div>);
}
