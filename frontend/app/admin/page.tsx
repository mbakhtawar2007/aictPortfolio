'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGet, apiSend } from '../../lib/api';
import { createVideoProject, splitCsv } from '../../lib/videoProject';
import type { Member, Project, Achievement, ContactMessage, SiteSettings, UserRole, AuditEntry, Revision, MediaItem } from '../../lib/types';
import { Loading, ErrorBox } from '../shared';
import { Toasts, useToasts, Modal, ConfirmDialog, CopyButton } from '../../components/ui';
import { MemberForm, ProjectForm, AchievementForm, SettingsForm } from '../../components/adminForms';
import { sendPasswordSetupEmail } from '../../lib/firebaseClient';

type Tab = 'overview' | 'members' | 'projects' | 'achievements' | 'users' | 'messages' | 'media' | 'audit' | 'settings';
const NAV_GROUPS: { label: string; tabs: { id: Tab; label: string }[] }[] = [
  { label: 'Content', tabs: [{ id: 'overview', label: 'Start here' }, { id: 'members', label: 'Team members' }, { id: 'media', label: 'Uploads' }, { id: 'projects', label: 'Projects' }, { id: 'achievements', label: 'Achievements' }] },
  { label: 'People', tabs: [{ id: 'users', label: 'Team accounts' }, { id: 'messages', label: 'Messages' }] },
  { label: 'Advanced', tabs: [{ id: 'audit', label: 'History' }, { id: 'settings', label: 'Site settings' }] },
];
const TAB_LABEL: Record<Tab, string> = { overview: 'Start here', members: 'Team members', projects: 'Projects', achievements: 'Achievements', users: 'Team accounts', messages: 'Messages', media: 'Uploads', audit: 'History', settings: 'Site settings' };

export default function AdminDashboard() {
  const { toasts, push, dismiss } = useToasts();
  const [token, setToken] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false); const [meUid, setMeUid] = useState('');
  const [members, setMembers] = useState<Member[]>([]); const [projects, setProjects] = useState<Project[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]); const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [users, setUsers] = useState<UserRole[]>([]); const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]); const [revisions, setRevisions] = useState<Revision[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]); const [mediaError, setMediaError] = useState(''); const [editingMedia, setEditingMedia] = useState<MediaItem | null>(null); const [editMediaTitle, setEditMediaTitle] = useState(''); const [editMediaDescription, setEditMediaDescription] = useState(''); const [editMediaBusy, setEditMediaBusy] = useState(false);
  const [loading, setLoading] = useState(true); const [tab, setTab] = useState<Tab>('overview');
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [sectionErrors, setSectionErrors] = useState<Record<string, string>>({});
  const [gateError, setGateError] = useState('');
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  // Limited admin (2026-10-29, user request): for now only Start here,
  // Team members (profiles), Team accounts (member account creation) and
  // Uploads (photo / resume / video upload) are shown. The other tabs'
  // panels and forms below are untouched — re-add their ids to
  // VISIBLE_TAB_IDS to bring a tab back.
  const VISIBLE_TAB_IDS: Tab[] = ['overview', 'members', 'users', 'media'];
  const NAV_GROUPS_VISIBLE = NAV_GROUPS.map((g) => ({ ...g, tabs: g.tabs.filter((x) => VISIBLE_TAB_IDS.includes(x.id)) })).filter((g) => g.tabs.length);
  const allTabs = NAV_GROUPS_VISIBLE.flatMap((g) => g.tabs);
  const onTabKey = (e: React.KeyboardEvent, id: Tab) => {
    const idx = allTabs.findIndex((x) => x.id === id); let next: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % allTabs.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + allTabs.length) % allTabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = allTabs.length - 1;
    if (next !== null) { e.preventDefault(); tabRefs.current[allTabs[next].id]?.focus(); }
  };
  const [editingMember, setEditingMember] = useState<Partial<Member> | null | undefined>(undefined);
  const [selfCreate, setSelfCreate] = useState(false);
  const [editingProject, setEditingProject] = useState<Partial<Project> | null | undefined>(undefined);
  const [editingAchievement, setEditingAchievement] = useState<Partial<Achievement> | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<{ kind: string; id: string; label: string; text?: string } | null>(null); const [deleteBusy, setDeleteBusy] = useState(false);
  // Invite-link flow (2026-10-29): the recipient creates their own account
  // from a link, instead of the admin setting a password or sending a
  // Firebase setup email. The link is shown once, at creation.
  const [linkInvite, setLinkInvite] = useState({ name: '', email: '', role: 'member', member_id: '', confirmAdmin: false });
  const [linkBusy, setLinkBusy] = useState(false); const [linkNote, setLinkNote] = useState('');
  const [linkUrl, setLinkUrl] = useState(''); const [linkEmail, setLinkEmail] = useState('');
  const [pendingLinks, setPendingLinks] = useState<Array<Record<string, unknown>>>([]); const [linksError, setLinksError] = useState('');
  const [passwordDraft, setPasswordDraft] = useState<Record<string, string>>({}); const [passwordConfirmDraft, setPasswordConfirmDraft] = useState<Record<string, string>>({}); const [confirmUserAction, setConfirmUserAction] = useState<{ id: string; kind: string; body?: unknown; label: string } | null>(null);
  const [linkDraft, setLinkDraft] = useState<Record<string, string>>({});
  const [revEntity, setRevEntity] = useState(''); const [revId, setRevId] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null); const [uploadType, setUploadType] = useState<'image' | 'pdf' | 'video'>('image'); const [uploadKey, setUploadKey] = useState(0); const [uploadTitle, setUploadTitle] = useState(''); const [uploadDescription, setUploadDescription] = useState(''); const [uploadStoryline, setUploadStoryline] = useState(''); const [uploadCharacters, setUploadCharacters] = useState(''); const [uploadTechnology, setUploadTechnology] = useState(''); const [uploadTeam, setUploadTeam] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0); const [uploadBusy, setUploadBusy] = useState(false); const [uploadUrl, setUploadUrl] = useState('');
  const [memberQuery, setMemberQuery] = useState(''); const [projectQuery, setProjectQuery] = useState(''); const [achievementQuery, setAchievementQuery] = useState('');

  useEffect(() => { setToken(window.localStorage.getItem('aict_admin_token')); }, []);
  const reload = useCallback(async () => {
    setGateError(''); setSectionErrors({});
    // Members do not see this page at all — send them to their own page.
    // A network/backend failure on /admin/me is NOT a logout: show a
    // retryable gate error instead of redirecting or falsely gating tabs.
    const me = await apiGet<{ role: string }>('/admin/me', true);
    if (me.data?.role === 'member') { window.location.href = '/member'; return; }
    if (me.error) {
      if (me.error.code === 'unauthenticated') { window.location.href = '/login'; return; }
      setGateError(me.error.message); setLoading(false); return;
    }
    setIsAdmin(me.data?.role === 'admin'); setMeUid((me.data as { uid?: string } | undefined)?.uid || '');
    const [m, p, a, msg, u, s, au, rev, med] = await Promise.all([
      apiGet<Member[]>('/admin/members', true), apiGet<Project[]>('/admin/projects', true), apiGet<Achievement[]>('/admin/achievements', true),
      apiGet<ContactMessage[]>('/admin/messages', true), apiGet<UserRole[]>('/admin/users', true), apiGet<SiteSettings>('/admin/settings', true),
      apiGet<AuditEntry[]>('/admin/audit?limit=50', true), apiGet<Revision[]>('/admin/revisions', true), apiGet<MediaItem[]>('/admin/media', true),
    ]);
    const errs: Record<string, string> = {};
    if (m.error) errs.members = m.error.message; else setMembers(m.data || []);
    if (p.error) errs.projects = p.error.message; else setProjects(p.data || []);
    if (a.error) errs.achievements = a.error.message; else setAchievements(a.data || []);
    if (msg.error) errs.messages = msg.error.message; else setMessages(msg.data || []);
    if (u.error) errs.users = u.error.message; else setUsers(u.data || []);
    const links = await apiGet<Array<Record<string, unknown>>>('/admin/users/invite-links', true);
    if (links.data) { setPendingLinks(links.data); setLinksError(''); } else if (links.error) setLinksError(links.error.message);
    if (s.error) errs.settings = s.error.message; else setSettings(s.data);
    if (au.error) errs.audit = au.error.message; else setAudit(au.data || []);
    if (rev.error) errs.revisions = rev.error.message; else setRevisions(rev.data || []);
    if (med.data) { setMedia(med.data); setMediaError(''); } else if (med.error) { errs.media = med.error.message; setMediaError(med.error.message); }
    setSectionErrors(errs);
    setLoading(false);
  }, []);
  useEffect(() => { if (token) reload(); else setLoading(false); }, [token, reload]);

  async function doDelete() {
    if (!deleting) return; setDeleteBusy(true);
    const path = deleting.kind === 'member' ? `/admin/members/${deleting.id}` : deleting.kind === 'project' ? `/admin/projects/${deleting.id}` : deleting.kind === 'achievement' ? `/admin/achievements/${deleting.id}` : deleting.kind === 'media' ? `/admin/media?public_id=${encodeURIComponent(deleting.id)}` : deleting.kind === 'user' ? `/admin/users/${deleting.id}` : `/admin/messages/${deleting.id}`;
    const r = await apiSend(path, 'DELETE', {}, true); setDeleteBusy(false);
    if (r.error) { push('error', r.error.message); } else { push('success', 'Deleted.'); setDeleting(null); reload(); }
  }
  async function sendLinkInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!linkInvite.name.trim() || !linkInvite.email.trim()) { push('error', 'Name and email are required.'); return; }
    if (linkInvite.role === 'admin' && !linkInvite.confirmAdmin) { push('error', 'Tick the confirmation before inviting an admin.'); return; }
    setLinkBusy(true); setLinkNote(''); setLinkUrl('');
    const r = await apiSend('/admin/users/invite-link', 'POST', { name: linkInvite.name, email: linkInvite.email, role: linkInvite.role, member_id: linkInvite.member_id }, true);
    setLinkBusy(false);
    if (r.error) { push('error', r.error.message); return; }
    const d = r.data as Record<string, unknown>;
    setLinkUrl(String(d.invite_link || '')); setLinkEmail(linkInvite.email);
    setLinkNote(d.email_delivery === 'gmail' ? `Invitation link created and sent to ${linkInvite.email} via Gmail.` : d.email_delivery === 'attempted' ? 'Invitation link created and an email was sent. You can also copy the link below.' : d.email_delivery === 'failed' ? 'Invitation link created, but the automatic Gmail send failed — send it yourself with the buttons below.' : 'Invitation link created. No automatic email was sent (Gmail is not configured), so send this link to them yourself — the Gmail button opens a ready-to-send email with the link inside.');
    setLinkInvite({ name: '', email: '', role: 'member', member_id: '', confirmAdmin: false }); reload();
  }
  async function revokeLink(id: string) {
    const key = `link-${id}`; if (pending[key]) return; setPending((x) => ({ ...x, [key]: true }));
    try { const r = await apiSend(`/admin/users/invite-links/${id}/revoke`, 'POST', {}, true); if (r.error) push('error', r.error.message); else { push('success', 'Invitation link revoked.'); reload(); } }
    finally { setPending((x) => ({ ...x, [key]: false })); }
  }
  async function userAction(id: string, kind: string, body?: unknown, email?: string, successMsg?: string) {
    const key = `user-${id}-${kind}`;
    if (pending[key]) return; setPending((x) => ({ ...x, [key]: true }));
    try {
    const path = kind === 'resend' ? `/admin/users/${id}/resend-invite` : kind === 'revoke' ? `/admin/users/${id}/revoke-invite` : `/admin/users/${id}`;
    const r = await apiSend(path, kind === 'resend' || kind === 'revoke' ? 'POST' : 'PATCH', body || {}, true);
    if (r.error) { push('error', r.error.message); return; }
    // The backend resend endpoint only generates a link — it does not send
    // an email. Send Firebase's own password email here, so Resend actually
    // reaches the person without opening Firebase Console.
    if (kind === 'resend' && email) {
      try { await sendPasswordSetupEmail(email); push('success', 'Password setup email sent again.'); }
      catch (e) { push('error', `Invitation renewed, but the password email could not be sent: ${e instanceof Error ? e.message : 'unknown error'}`); }
    } else push('success', successMsg || 'Account updated.');
    reload();
    } finally { setPending((x) => ({ ...x, [key]: false })); }
  }
  async function setAccountPassword(id: string) {
    const pw = passwordDraft[id] || '';
    if (pw.length < 6) { push('error', 'Password must be at least 6 characters.'); return; }
    if (pw !== (passwordConfirmDraft[id] || '')) { push('error', 'Passwords do not match.'); return; }
    const key = `pw-${id}`; if (pending[key]) return; setPending((x) => ({ ...x, [key]: true }));
    try {
    const r = await apiSend(`/admin/users/${id}/set-password`, 'POST', { password: pw }, true);
    if (r.error) push('error', r.error.message); else { push('success', 'Password set. Share it privately with this person — it will not be shown again.'); setPasswordDraft({ ...passwordDraft, [id]: '' }); setPasswordConfirmDraft({ ...passwordConfirmDraft, [id]: '' }); reload(); }
    } finally { setPending((x) => ({ ...x, [key]: false })); }
  }
  async function messageAction(id: string, read: boolean) {
    const key = `msg-${id}`; if (pending[key]) return; setPending((x) => ({ ...x, [key]: true }));
    try {
    const r = await apiSend(`/admin/messages/${id}`, 'PATCH', { read }, true);
    if (r.error) push('error', r.error.message); else reload();
    } finally { setPending((x) => ({ ...x, [key]: false })); }
  }
  async function restoreRevision(id: string) {
    const key = `rev-${id}`; if (pending[key]) return; setPending((x) => ({ ...x, [key]: true }));
    try {
    const r = await apiSend(`/admin/revisions/${id}/restore`, 'POST', {}, true);
    if (r.error) push('error', r.error.message); else { push('success', 'Revision restored. Visitors will see it on their next page load — no rebuild needed.'); reload(); }
    } finally { setPending((x) => ({ ...x, [key]: false })); }
  }
  async function upload(e: React.FormEvent) {
    e.preventDefault(); if (!uploadFile) { push('error', 'Choose a file first.'); return; }
    const ext = uploadFile.name.split('.').pop()?.toLowerCase() || '';
    if (uploadType === 'pdf' && ext !== 'pdf') { push('error', 'Resumes must be PDF files.'); return; }
    if (uploadType === 'image' && !['jpg', 'jpeg', 'png', 'webp', 'avif'].includes(ext)) { push('error', 'Images must be jpg, png, webp or avif.'); return; }
    if (uploadType === 'video' && !['mp4', 'webm'].includes(ext)) { push('error', 'Videos must be MP4 or WebM.'); return; }
    if (uploadFile.size > (uploadType === 'video' ? 50 * 1024 * 1024 : 5 * 1024 * 1024)) { push('error', uploadType === 'video' ? 'Video must be 50 MB or smaller.' : 'File must be 5 MB or smaller.'); return; }
    setUploadBusy(true); setUploadProgress(0); setUploadUrl('');
    const sign = await apiSend('/admin/upload/sign', 'POST', { file_type: uploadType, file_size: uploadFile.size, file_name: uploadFile.name }, true);
    if (sign.error || !sign.data) { push('error', sign.error?.message || 'Upload signing is unavailable.'); setUploadBusy(false); return; }
    const d = sign.data as Record<string, unknown>;
    const form = new FormData();
    form.append('file', uploadFile); form.append('api_key', String(d.api_key)); form.append('timestamp', String(d.timestamp)); form.append('public_id', String(d.public_id)); form.append('signature', String(d.signature));
    const endpoint = `https://api.cloudinary.com/v1_1/${String(d.cloud_name)}/${uploadType === 'video' ? 'video' : uploadType === 'pdf' ? 'raw' : 'image'}/upload`;
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (ev) => { if (ev.lengthComputable) setUploadProgress(Math.round((ev.loaded / ev.total) * 100)); };
    xhr.onload = async () => { setUploadBusy(false); try { const j = JSON.parse(xhr.responseText); if (xhr.status >= 200 && xhr.status < 300 && j.secure_url) { const uploadedPublicId = String(j.public_id || d.public_id); const v = await apiSend('/admin/upload/verify', 'POST', { public_id: uploadedPublicId, file_type: uploadType }, true); if (v.error || !v.data) { push('error', v.error?.message || 'Upload was checked by the server and rejected.'); return; } const meta = await apiSend('/admin/media/meta', 'POST', { public_id: uploadedPublicId, title: uploadTitle, description: uploadDescription }, true); if (meta.error) push('error', 'Upload verified, but its title could not be saved.'); const videoUrl = String((v.data as Record<string, unknown>).secure_url || j.secure_url); setUploadUrl(videoUrl); if (uploadType === 'video') { const created = await createVideoProject({ title: uploadTitle, description: uploadDescription, videoUrl, fileName: uploadFile.name, caseStudy: uploadStoryline, characters: splitCsv(uploadCharacters), techStack: splitCsv(uploadTechnology), memberIds: uploadTeam }); if (created.data) push('success', created.data.status === 'published' ? `Video uploaded and its project card is now live on Projects: /projects/${created.data.slug}` : 'Video uploaded and its project card is saved as a draft — an admin will publish it before it appears on Projects.'); else push('error', `Video uploaded, but its project card could not be created: ${created.error} You can still create it by hand with this URL.`); } else push('success', 'Upload complete and verified by the server.'); setUploadFile(null); setUploadTitle(''); setUploadDescription(''); setUploadStoryline(''); setUploadCharacters(''); setUploadTechnology(''); setUploadTeam([]); setUploadKey((k) => k + 1); reload(); } else push('error', j.error?.message || 'Upload failed.'); } catch { push('error', 'Upload failed.'); } };
    xhr.onerror = () => { setUploadBusy(false); push('error', 'Upload failed (network).'); };
    xhr.open('POST', endpoint); xhr.send(form);
  }

  if (loading) return <Loading />;
  if (!token) return (<div><h1>Admin dashboard</h1><p className="error">Sign-in required. <a href="/login">Go to login</a></p><p className="muted">There is no sign-up on this site. An admin must invite you first.</p></div>);
  if (gateError) return (<div><h1>Admin dashboard</h1><ErrorBox message={gateError} /><p><button className="btn" onClick={reload}>Try again</button>{' '}<button className="btn secondary" onClick={() => { window.localStorage.removeItem('aict_admin_token'); window.location.href = '/login'; }}>Sign out</button></p><p className="muted">The backend could not be reached or your account could not be checked. This does not mean you were signed out — retry once the backend recovers.</p></div>);
  const unread = messages.filter((m) => !m.read).length;
  const filteredMembers = members.filter((m) => (m.full_name + ' ' + (m.role_title || '')).toLowerCase().includes(memberQuery.toLowerCase()));
  const filteredProjects = projects.filter((p) => (p.title + ' ' + (p.category || '')).toLowerCase().includes(projectQuery.toLowerCase()));
  const filteredAchievements = achievements.filter((a) => (a.title + ' ' + (a.issuer || '')).toLowerCase().includes(achievementQuery.toLowerCase()));
  const needsProfile = !isAdmin && members.length === 0;
  const plainSection = (k: string) => k === 'members' ? 'Team members' : k === 'users' ? 'Team accounts' : k === 'media' ? 'Uploads' : k;
  const visibleErrors = Object.entries(sectionErrors).filter(([k]) => ['members', 'users', 'media'].includes(k));
  const openSelfCreate = () => { setSelfCreate(true); setEditingMember({}); };
  return (<div className="admin-page"><h1 className="admin-title">Admin dashboard</h1>
    <p className="muted">Signed in as <span className="chip admin-role-chip">{isAdmin ? 'Admin' : 'Team member'}</span>. Admins can edit everything. Team members can only edit their own profile and projects they are assigned to.</p>
    <nav className="admin-nav" aria-label="Admin sections">{NAV_GROUPS_VISIBLE.map((g) => (<div className="admin-nav-group" key={g.label}><span className="admin-nav-label">{g.label}</span><div className="tabs admin-tabs" role="tablist" aria-label={`${g.label} sections`}>{g.tabs.map((t) => (<button key={t.id} ref={(el) => { tabRefs.current[t.id] = el; }} id={`admin-tab-${t.id}`} role="tab" aria-selected={tab === t.id} aria-controls="admin-panel" tabIndex={tab === t.id ? 0 : -1} className={`tab-btn${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)} onKeyDown={(e) => onTabKey(e, t.id)}>{t.label}{t.id === 'messages' && unread > 0 ? ` (${unread})` : ''}</button>))}</div></div>))}
      <button className="btn secondary small" onClick={() => { window.localStorage.removeItem('aict_admin_token'); window.location.href = '/login'; }}>Sign out</button></nav>
    {visibleErrors.length > 0 && (<div><ErrorBox message={`Some sections could not be loaded: ${visibleErrors.map(([k, v]) => `${plainSection(k)} — ${v}`).join('; ')}`} /><p><button className="btn secondary" onClick={reload}>Try loading again</button></p><p className="muted">Sections that failed are not empty — their data simply did not arrive. Other sections still show their data.</p></div>)}
    <div role="tabpanel" id="admin-panel" aria-labelledby={`admin-tab-${tab}`}>

    {tab === 'overview' && (<div>
      {needsProfile && (<div className="card"><h2>You don't have a profile yet</h2><p>Create your team profile here. It will be saved as a draft, and an admin will review and publish it.</p><p><button className="btn" onClick={openSelfCreate}>Create my profile</button></p></div>)}
      <div className="admin-hero"><h2>What would you like to do?</h2><p className="muted">Pick a task below — everything saves instantly, no rebuild needed.</p></div>
      <div className="action-grid">
        {isAdmin && <button className="action-card" onClick={() => { setTab('members'); setEditingMember({}); }}><strong>+ Add a team member</strong><span>Create the public profile visitors will see.</span></button>}
        {!isAdmin && !needsProfile && <button className="action-card" onClick={() => setTab('members')}><strong>Edit my profile</strong><span>Update your bio, skills and links.</span></button>}
        {isAdmin && <button className="action-card" onClick={() => setTab('users')}><strong>Invite an account</strong><span>Let someone log in, with a password you set or a setup email.</span></button>}
        <button className="action-card" onClick={() => setTab('media')}><strong>Upload a video</strong><span>Upload a video, photo or resume, then copy its URL into a form.</span></button>
      </div>
      <h2>Your site at a glance</h2>
      <div className="stat-grid">
        <div className="stat-card"><strong>{members.length}</strong><span>Team members</span></div>
        <div className="stat-card"><strong>{users.length}</strong><span>Sign-in accounts</span></div>
        <div className="stat-card"><strong>{media.length}</strong><span>Files uploaded</span></div>
      </div>
      <div className="card"><h2>How publishing works — in plain words</h2><p>Save here, and visitors see it on their next page load. No rebuild, no manual deploy — public pages fetch the latest data from the backend every time they load, including a brand-new profile page.</p><p className="muted">Drafts and private resumes never appear on public pages.</p></div>
      {isAdmin && (<div className="card"><h2>First steps checklist</h2><p>{members.length > 0 ? '✓' : '○'} At least one team member<br />{members.some((m) => m.status === 'published') ? '✓' : '○'} At least one member published (not just draft)<br />{users.length > 0 ? '✓' : '○'} At least one sign-in account</p></div>)}
    </div>)}

    {tab === 'members' && (<div>
      <p className="muted">A team profile is what visitors see. A sign-in account is separate — link the two in Team accounts so a member can edit their own profile.</p>
      {needsProfile && (<div className="card"><h2>You don't have a profile yet</h2><p>Create your team profile here. It will be saved as a draft, and an admin will review and publish it.</p><p><button className="btn" onClick={openSelfCreate}>Create my profile</button></p></div>)}
      {isAdmin && <p><button className="btn" onClick={() => { setSelfCreate(false); setEditingMember({}); }}>+ New member</button></p>}
      <p><input className="search-input" aria-label="Search team members" placeholder="Search team members…" value={memberQuery} onChange={(e) => setMemberQuery(e.target.value)} /></p>
      <div className="grid">{filteredMembers.map((m) => (<div className="card" key={m.id}><div className="admin-member-head">{m.photo_url?.startsWith('http') ? <img className="avatar-img" src={m.photo_url} alt="" /> : <span className="avatar" aria-hidden="true">{m.full_name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>}<h3>{m.full_name}</h3></div><p className="muted">{m.role_title} · <span className={`status-chip ${m.status}`}>{m.status === 'published' ? 'Published' : 'Draft'}</span>{m.is_leader ? ' ' : ''}{m.is_leader && <span className="chip">Group Leader</span>}</p><p><button className="btn secondary small" onClick={() => { setSelfCreate(false); setEditingMember(m); }}>Edit</button>{' '}{isAdmin && <button className="btn secondary small" onClick={() => setDeleting({ kind: 'member', id: m.id, label: m.full_name })}>Delete</button>}{m.status === 'published' ? <>{' '}<a className="btn secondary small" href={`/team/${m.slug}`}>View public profile</a></> : <span className="muted"> Not published yet.</span>}</p></div>))}</div>
      {!filteredMembers.length && !sectionErrors.members && <p className="muted">{memberQuery ? 'No team members match that search.' : 'No team members yet.'} {isAdmin && <button className="btn secondary small" onClick={() => { setSelfCreate(false); setEditingMember({}); }}>Add the first member</button>}</p>}
      {editingMember !== undefined && (<Modal title={selfCreate ? 'Create my profile' : editingMember?.id ? 'Edit member' : 'New member'} onClose={() => { setEditingMember(undefined); setSelfCreate(false); }}><MemberForm initial={editingMember} selfCreate={selfCreate} canSetLeader={isAdmin} onSaved={() => { setEditingMember(undefined); setSelfCreate(false); reload(); }} onCancel={() => { setEditingMember(undefined); setSelfCreate(false); }} push={push} /></Modal>)}</div>)}

    {tab === 'projects' && (<div><p>{isAdmin && <button className="btn" onClick={() => setEditingProject({})}>+ New project</button>} {!isAdmin && <button className="btn" onClick={() => setEditingProject({})}>+ New project</button>}</p>
      <p><input className="search-input" aria-label="Search projects" placeholder="Search projects…" value={projectQuery} onChange={(e) => setProjectQuery(e.target.value)} /></p>
      <div className="grid">{filteredProjects.map((p) => (<div className="card" key={p.id}><h3>{p.title}</h3><p className="muted">{p.category} · <span className={`status-chip ${p.status}`}>{p.status === 'published' ? 'Published' : 'Draft'}</span></p><p><button className="btn secondary small" onClick={() => setEditingProject(p)}>Edit</button>{' '}{isAdmin && <button className="btn secondary small" onClick={() => setDeleting({ kind: 'project', id: p.id, label: p.title })}>Delete</button>}</p></div>))}</div>
      {!filteredProjects.length && !sectionErrors.projects && <p className="muted">{projectQuery ? 'No projects match that search.' : 'No projects yet.'} <button className="btn secondary small" onClick={() => setEditingProject({})}>Add the first project</button></p>}
      {editingProject !== undefined && (<Modal title={editingProject?.id ? 'Edit project' : 'New project'} onClose={() => setEditingProject(undefined)}><ProjectForm initial={editingProject} members={members} isAdmin={isAdmin} onSaved={() => { setEditingProject(undefined); reload(); }} onCancel={() => setEditingProject(undefined)} push={push} /></Modal>)}</div>)}

    {tab === 'achievements' && (<div><p><button className="btn" onClick={() => setEditingAchievement({})}>+ New achievement</button></p>
      <p><input className="search-input" aria-label="Search achievements" placeholder="Search achievements…" value={achievementQuery} onChange={(e) => setAchievementQuery(e.target.value)} /></p>
      <div className="grid">{filteredAchievements.map((a) => (<div className="card" key={a.id}><h3>{a.title}</h3><p className="muted">{a.issuer} · {a.type} · {a.date} · <span className={`status-chip ${a.status || 'draft'}`}>{a.status === 'published' ? 'Published' : 'Draft'}</span></p><p>{a.description}</p><p><button className="btn secondary small" onClick={() => setEditingAchievement(a)}>Edit</button>{' '}{isAdmin && <button className="btn secondary small" onClick={() => setDeleting({ kind: 'achievement', id: a.id, label: a.title })}>Delete</button>}</p></div>))}</div>
      {!filteredAchievements.length && !sectionErrors.achievements && <p className="muted">{achievementQuery ? 'No achievements match that search.' : 'No achievements yet.'} <button className="btn secondary small" onClick={() => setEditingAchievement({})}>Add the first achievement</button></p>}
      {editingAchievement !== undefined && (<Modal title={editingAchievement?.id ? 'Edit achievement' : 'New achievement'} onClose={() => setEditingAchievement(undefined)}><AchievementForm initial={editingAchievement} members={members} isAdmin={isAdmin} onSaved={() => { setEditingAchievement(undefined); reload(); }} onCancel={() => setEditingAchievement(undefined)} push={push} /></Modal>)}</div>)}

    {tab === 'users' && (!isAdmin ? <p className="error">Only admins can see this. If you are a team member, ask an admin.</p> : (<div>
      <p className="muted">Two things, kept separate: <strong>a sign-in account</strong> lets a person log in, and <strong>a team profile</strong> is what visitors see. Link them here so a member can edit their own profile. You cannot change your own role or status from this page — the server will refuse that — but you can link your own profile.</p>
      <form onSubmit={sendLinkInvite}><h2>Invite a team member</h2><p className="muted">The person gets a link, opens it, and creates their own account with a password they choose. Their email and role are fixed by you and cannot be changed on that page. The link expires after 7 days and works only once.</p>
        <label>Name<input required value={linkInvite.name} onChange={(e) => setLinkInvite({ ...linkInvite, name: e.target.value })} /></label>
        <label>Email<input required type="email" value={linkInvite.email} onChange={(e) => setLinkInvite({ ...linkInvite, email: e.target.value })} /></label>
        <label>Role<select value={linkInvite.role} onChange={(e) => setLinkInvite({ ...linkInvite, role: e.target.value })}><option value="member">Team member</option><option value="admin">Admin</option></select></label>
        {linkInvite.role === 'admin' && <label><input type="checkbox" checked={linkInvite.confirmAdmin} onChange={(e) => setLinkInvite({ ...linkInvite, confirmAdmin: e.target.checked })} /> I deliberately confirm granting admin — this is not the default.</label>}
        <label>Link to a team profile (optional)<select value={linkInvite.member_id} onChange={(e) => setLinkInvite({ ...linkInvite, member_id: e.target.value })}><option value="">No profile yet — they can create their own later</option>{members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}</select></label>
        <p><button className="btn" disabled={linkBusy}>{linkBusy ? 'Creating…' : 'Create invitation link'}</button></p>
        {linkNote && <p className="success">{linkNote}</p>}
        {linkUrl && (<div><label>Invitation link<input readOnly value={linkUrl} onFocus={(e) => e.target.select()} /></label><p><button type="button" className="btn secondary small" onClick={() => { navigator.clipboard?.writeText(linkUrl); push('success', 'Link copied.'); }}>Copy link</button>{' '}<a className="btn secondary small" target="_blank" rel="noreferrer" href={`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(linkEmail)}&su=${encodeURIComponent('Your AICT portfolio invitation')}&body=${encodeURIComponent(`Hi,\n\nYou have been invited to the AICT group portfolio. Create your account here (link expires in 7 days):\n${linkUrl}\n`)}`}>Send via Gmail</a></p><p className="muted">Save this link now — it is shown only once and cannot be shown again. If it is lost, revoke it below and create a new one.</p></div>)}
      </form>
      <h2>Pending invitation links</h2>
      <div className="grid">{pendingLinks.filter((l) => !l.used && !l.revoked).map((l) => (<div className="card" key={String(l.id)}><h3>{String(l.name || l.email)}</h3><p className="muted">{String(l.email)} · {String(l.role) === 'admin' ? 'Admin' : 'Team member'} · expires {new Date(String(l.expires_at)).toLocaleDateString()}</p><p><button className="btn secondary small" disabled={!!pending[`link-${String(l.id)}`]} onClick={() => revokeLink(String(l.id))}>{pending[`link-${String(l.id)}`] ? 'Working…' : 'Revoke link'}</button></p></div>))}</div>
      {!pendingLinks.filter((l) => !l.used && !l.revoked).length && <p className="muted">{linksError ? 'Pending links could not be loaded — try again.' : 'No pending invitation links.'}</p>}
      <h2>Accounts</h2><p className="muted">Resend setup email sends the password email again. Activate marks an invited account active, but the person still needs a password — set one below or send the setup email. Revoke cancels an invitation and deactivates the account; Deactivate blocks sign-in until you Reactivate. Delete removes the sign-in account permanently; a linked team profile stays on the site but becomes unlinked.</p>
      <div className="grid">{users.map((u) => { const linked = members.find((m) => m.id === u.member_id); return (<div className="card" key={u.id}><div className="admin-member-head"><span className="avatar" aria-hidden="true">{(u.name || u.email || '?').trim().charAt(0).toUpperCase()}</span><h3>{u.name || u.email}</h3></div><p className="muted">{u.email} · {u.role === 'admin' ? 'Admin' : 'Team member'} · {u.account_status ? u.account_status.charAt(0).toUpperCase() + u.account_status.slice(1) : ''}</p><p className="muted">Profile: {linked ? linked.full_name : 'Not linked yet'}</p>
        <label>Link profile<select value={linkDraft[u.id] ?? u.member_id ?? ''} onChange={(e) => setLinkDraft({ ...linkDraft, [u.id]: e.target.value })}><option value="">No profile</option>{members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}</select></label>
        <p><button className="btn secondary small" disabled={!!pending[`user-${u.id}-link`]} onClick={() => { const next = members.find((m) => m.id === (linkDraft[u.id] ?? u.member_id ?? '')); userAction(u.id, 'link', { member_id: linkDraft[u.id] ?? u.member_id ?? '' }, undefined, next ? `Profile linked to ${next.full_name}.` : 'Profile unlinked.'); }}>{pending[`user-${u.id}-link`] ? 'Working…' : 'Save link'}</button>{' '}
        {u.account_status === 'invited' && <><button className="btn secondary small" disabled={!!pending[`user-${u.id}-resend`]} onClick={() => userAction(u.id, 'resend', undefined, u.email)}>{pending[`user-${u.id}-resend`] ? 'Working…' : 'Resend setup email'}</button>{' '}<button className="btn secondary small" disabled={!!pending[`user-${u.id}-activate`]} onClick={() => userAction(u.id, 'activate', { account_status: 'active' })}>{pending[`user-${u.id}-activate`] ? 'Working…' : 'Activate'}</button>{' '}<button className="btn secondary small" disabled={!!pending[`user-${u.id}-revoke`]} onClick={() => setConfirmUserAction({ id: u.id, kind: 'revoke', label: 'Revoke this invitation? The person will not be able to use it, and their account will be deactivated.' })}>{pending[`user-${u.id}-revoke`] ? 'Working…' : 'Revoke'}</button>{' '}</>}
        {u.account_status === 'active' && <button className="btn secondary small" disabled={!!pending[`user-${u.id}-deactivate`]} onClick={() => setConfirmUserAction({ id: u.id, kind: 'deactivate', body: { account_status: 'deactivated' }, label: 'Deactivate this account? They will not be able to sign in until you reactivate them.' })}>{pending[`user-${u.id}-deactivate`] ? 'Working…' : 'Deactivate'}</button>}
        {u.account_status === 'deactivated' && <button className="btn secondary small" disabled={!!pending[`user-${u.id}-reactivate`]} onClick={() => userAction(u.id, 'reactivate', { account_status: 'active' })}>{pending[`user-${u.id}-reactivate`] ? 'Working…' : 'Reactivate'}</button>}</p>
        <label>Set / reset password<input type="password" value={passwordDraft[u.id] || ''} onChange={(e) => setPasswordDraft({ ...passwordDraft, [u.id]: e.target.value })} placeholder="At least 6 characters" /></label>
        <label>Confirm password<input type="password" value={passwordConfirmDraft[u.id] || ''} onChange={(e) => setPasswordConfirmDraft({ ...passwordConfirmDraft, [u.id]: e.target.value })} placeholder="Repeat the password" /></label>
        <p><button className="btn secondary small" disabled={!!pending[`pw-${u.id}`]} onClick={() => setAccountPassword(u.id)}>{pending[`pw-${u.id}`] ? 'Setting…' : 'Set password'}</button><span className="muted"> Share it privately — it is not shown again.</span></p>{u.id === meUid ? <p className="muted">This is your account.</p> : <p><button className="btn secondary small" onClick={() => setDeleting({ kind: 'user', id: u.id, label: u.name || u.email || u.id, text: `Delete the sign-in account for "${u.name || u.email || u.id}" permanently? They will not be able to sign in again. Their team profile, if linked, stays on the site but becomes unlinked.` })}>Delete</button></p>}</div>); })}</div>
      {!users.length && !sectionErrors.users && <p className="muted">No accounts yet.</p>}</div>))}

    {tab === 'messages' && (!isAdmin ? <p className="error">Only admins can see this. If you are a team member, ask an admin.</p> : (<div>{messages.map((m) => (<div className="card" key={m.id}><strong>{m.name} ({m.email})</strong> <span className="muted">{m.read ? 'Read' : 'Unread'} · {m.created_at}</span><p>{m.subject}</p><p>{m.message}</p>
        <p><a className="btn secondary small" href={`mailto:${m.email}?subject=${encodeURIComponent('Re: ' + (m.subject || ''))}`}>Reply by email</a>{' '}<button className="btn secondary small" disabled={!!pending[`msg-${m.id}`]} onClick={() => messageAction(m.id, !m.read)}>{pending[`msg-${m.id}`] ? 'Working…' : (m.read ? 'Mark unread' : 'Mark read')}</button>{' '}<button className="btn secondary small" onClick={() => setDeleting({ kind: 'message', id: m.id, label: m.subject || m.name })}>Delete</button></p></div>))}
      {!messages.length && !sectionErrors.messages && <p className="muted">No messages yet.</p>}</div>))}

    {tab === 'media' && (<div><h2>Uploads</h2><p className="muted">Videos count more toward the free Cloudinary quota — keep them short. Photos and resumes stay at 5 MB, videos at 50 MB.</p>
      {mediaError && <p className="error">{mediaError} — uploads will not work until Cloudinary is set up in Vercel.</p>}
      <form onSubmit={upload}><h3>Upload</h3>
        <label>File type<select value={uploadType} onChange={(e) => setUploadType(e.target.value as 'image' | 'pdf' | 'video')}><option value="image">Photo / image</option><option value="pdf">PDF resume (max 5 MB)</option><option value="video">Video (MP4/WebM, max 50 MB)</option></select></label>
        <label>File<input key={uploadKey} type="file" accept={uploadType === 'video' ? 'video/mp4,video/webm' : uploadType === 'pdf' ? 'application/pdf' : 'image/jpeg,image/png,image/webp,image/avif'} onChange={(e) => setUploadFile(e.target.files?.[0] || null)} /></label>
        <label>Title<input value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} placeholder="e.g. Team at the tech fest" maxLength={120} /></label>
        <label>Description<textarea value={uploadDescription} onChange={(e) => setUploadDescription(e.target.value)} placeholder="A short description (optional)" maxLength={500} rows={3} /></label>
        {uploadType === 'video' && (<>
        <label>Storyline & plot<textarea value={uploadStoryline} onChange={(e) => setUploadStoryline(e.target.value)} placeholder="What happens in the video? (optional)" maxLength={20000} rows={4} /></label>
        <label>Characters involved<input value={uploadCharacters} onChange={(e) => setUploadCharacters(e.target.value)} placeholder="Comma-separated names (optional)" /></label>
        <label>Technology<input value={uploadTechnology} onChange={(e) => setUploadTechnology(e.target.value)} placeholder="Comma-separated, e.g. AI Video Tools, Premiere Pro (optional)" /></label>
        <p className="muted">Team & group members</p>{members.length ? members.map((m) => (<p key={m.id}><label><input type="checkbox" checked={uploadTeam.includes(m.id)} onChange={(e) => setUploadTeam((x) => e.target.checked ? [...x, m.id] : x.filter((id) => id !== m.id))} /> {m.full_name}</label></p>)) : <p className="muted">No team members yet.</p>}
        <p className="muted">These details appear on the project's details page.</p></>)}
        {uploadBusy && <p>Uploading… {uploadProgress}%</p>}
        {uploadUrl && <p className="success">Uploaded: {uploadUrl} <CopyButton text={uploadUrl} label="Copy URL" /></p>}
        <p><button className="btn" disabled={uploadBusy}>{uploadBusy ? 'Uploading…' : 'Upload'}</button></p>
        <p className="muted">Uploads are checked by the server first. Your Cloudinary secret keys never reach the browser. A video upload also creates its project card in Projects automatically — for photos and resumes, copy the URL into a member or project form.</p></form>
      <div className="grid">{media.map((f) => (<div className="card" key={f.public_id}>{f.resource_type === 'video' ? <video controls src={f.secure_url} style={{ maxWidth: '100%', borderRadius: 12 }} /> : f.resource_type === 'image' ? <img src={f.secure_url} alt={f.title || f.public_id} style={{ maxWidth: '100%', borderRadius: 12 }} /> : <p>{f.public_id} ({f.format})</p>}{f.title ? <h3>{f.title}</h3> : null}{f.description ? <p>{f.description}</p> : null}<p className="muted">{f.public_id} · {f.format} · {f.bytes ? `${Math.round(f.bytes / 1024)} KB` : ''} · {f.created_at}</p><p><CopyButton text={f.secure_url} label="Copy URL" />{' '}<button className="btn secondary small" onClick={() => { setEditingMedia(f); setEditMediaTitle(f.title || ''); setEditMediaDescription(f.description || ''); }}>Edit</button>{' '}<button className="btn secondary small" onClick={() => setDeleting({ kind: 'media', id: f.public_id, label: f.title || f.public_id })}>Delete</button></p></div>))}</div>
      {!media.length && !mediaError && <p className="muted">No files yet. Upload a photo, resume or video above, then paste its URL into a form.</p>}</div>)}

    {tab === 'audit' && (!isAdmin ? <p className="error">Only admins can see this. If you are a team member, ask an admin.</p> : (<div><h2>History</h2><p className="muted">Who changed what, and when. This is a record — it cannot be edited from here.</p>
      {audit.map((a) => (<div className="card" key={a.id}><p><strong>{a.action}</strong> · {a.entity} / {a.entity_id}</p><p className="muted">{a.user_id} · {a.created_at}</p></div>))}
      {!audit.length && <p className="muted">No history yet.</p>}
      <h2>Earlier versions</h2><p className="muted">A snapshot is saved every time a member, project or achievement is edited, so you can go back to it. Site settings changes are not saved as snapshots yet, so they cannot be restored from here.</p>
      <label>Filter by type<input value={revEntity} onChange={(e) => setRevEntity(e.target.value)} placeholder="members, projects, achievements" /></label>
      <label>Filter by record ID<input value={revId} onChange={(e) => setRevId(e.target.value)} placeholder="Record ID" /></label>
      <p><button className="btn secondary" disabled={!!pending['rev-load']} onClick={async () => { if (pending['rev-load']) return; setPending((x) => ({ ...x, ['rev-load']: true })); try { const r = await apiGet<Revision[]>(`/admin/revisions?entity=${encodeURIComponent(revEntity)}&entity_id=${encodeURIComponent(revId)}`, true); if (r.error) push('error', r.error.message); else setRevisions(r.data || []); } finally { setPending((x) => ({ ...x, ['rev-load']: false })); } }}>{pending['rev-load'] ? 'Loading…' : 'Load earlier versions'}</button></p>
      {revisions.map((r) => (<div className="card" key={r.id}><p><strong>{r.entity} / {r.entity_id}</strong></p><p className="muted">{r.user_id} · {r.created_at}</p><p><button className="btn secondary small" disabled={!!pending[`rev-${r.id}`]} onClick={() => restoreRevision(r.id)}>{pending[`rev-${r.id}`] ? 'Restoring…' : 'Restore this version'}</button></p></div>))}
      {!revisions.length && <p className="muted">No earlier versions yet — edit a member, project or achievement first, and a snapshot will be saved before the change.</p>}</div>))}

    {tab === 'settings' && (!isAdmin ? <p className="error">Only admins can see this. If you are a team member, ask an admin.</p> : (settings ? <SettingsForm initial={settings} onSaved={reload} push={push} /> : <p className="muted">Settings could not be loaded.</p>))}

    </div>
    {deleting && <ConfirmDialog text={deleting.text || `Delete "${deleting.label}"? This cannot be undone from this dialog.`} busy={deleteBusy} onCancel={() => setDeleting(null)} onConfirm={doDelete} />}
    {confirmUserAction && <ConfirmDialog text={confirmUserAction.label} busy={!!pending[`user-${confirmUserAction.id}-${confirmUserAction.kind}`]} onCancel={() => setConfirmUserAction(null)} onConfirm={() => { const c = confirmUserAction; setConfirmUserAction(null); if (c) userAction(c.id, c.kind, c.body); }} />}
    {editingMedia && (<Modal title="Edit upload details" onClose={() => setEditingMedia(null)}><form onSubmit={async (e) => { e.preventDefault(); if (!editingMedia) return; setEditMediaBusy(true); try { const r = await apiSend('/admin/media/meta', 'POST', { public_id: editingMedia.public_id, title: editMediaTitle, description: editMediaDescription }, true); if (r.error) push('error', r.error.message); else { push('success', 'Upload details saved.'); setEditingMedia(null); reload(); } } finally { setEditMediaBusy(false); } }}><p className="muted">{editingMedia.public_id}</p><label>Title<input value={editMediaTitle} onChange={(e) => setEditMediaTitle(e.target.value)} maxLength={120} /></label><label>Description<textarea value={editMediaDescription} onChange={(e) => setEditMediaDescription(e.target.value)} maxLength={500} rows={3} /></label><p className="muted">This changes the upload's title and description only — for a video, its project card keeps its own title and description (edit those in Projects).</p><p><button className="btn" disabled={editMediaBusy}>{editMediaBusy ? 'Saving…' : 'Save details'}</button>{' '}<button type="button" className="btn secondary" onClick={() => setEditingMedia(null)}>Cancel</button></p></form></Modal>)}
    <Toasts toasts={toasts} dismiss={dismiss} />
  </div>);
}
