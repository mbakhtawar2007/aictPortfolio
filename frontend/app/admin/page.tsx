'use client';
import { useEffect, useState } from 'react';
import { apiGet } from '../../lib/api';
import type { Member, Project, ContactMessage } from '../../lib/types';
import { Loading, ErrorBox } from '../shared';
export default function AdminDashboard() {
  const [token, setToken] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]); const [projects, setProjects] = useState<Project[]>([]); const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [tab, setTab] = useState('overview');
  useEffect(() => { setToken(window.localStorage.getItem('aict_admin_token')); }, []);
  useEffect(() => {
    if (!token) { setLoading(false); return; }
    (async () => {
      const [m, p, msg] = await Promise.all([apiGet<Member[]>('/admin/members', true), apiGet<Project[]>('/admin/projects', true), apiGet<ContactMessage[]>('/admin/messages', true)]);
      if (m.error) setError(m.error.message); else setMembers(m.data || []);
      if (p.data) setProjects(p.data);
      if (msg.data) setMessages(msg.data);
      if (msg.error) setError((e) => e || 'Messages are admin-only; your account may be a member account.');
      setLoading(false);
    })();
  }, [token]);
  if (loading) return <Loading />;
  if (!token) return (<div><h1>Admin dashboard</h1><p className="error">Sign-in required. <a href="/admin/login">Go to admin login</a></p><p className="muted">Members see only their own records; admins see all. Drafts and messages never appear on public pages.</p></div>);
  return (<div><h1>Admin dashboard</h1>{error && <ErrorBox message={error} />}
    <p>{['overview', 'members', 'projects', 'messages', 'users', 'settings'].map((t) => <button key={t} className="chip" onClick={() => setTab(t)} style={{ cursor: 'pointer', color: 'inherit', background: tab === t ? 'rgba(139,92,246,0.3)' : undefined }}>{t}</button>)}
    <button className="chip" style={{ cursor: 'pointer', color: 'inherit' }} onClick={() => { window.localStorage.removeItem('aict_admin_token'); window.location.href = '/admin/login'; }}>Sign out</button></p>
    {tab === 'overview' && <div><p>Members (admin view): <strong>{members.length}</strong> · Projects: <strong>{projects.length}</strong> · Messages: <strong>{messages.length}</strong></p><p className="muted">Full create/edit forms, media library, revisions and user-invite UI are the next pass; this foundation wires the API, auth and permission-denied states. To invite an account, an admin calls POST /api/admin/users/invite from the backend API (see DEPLOYMENT.md) — there is no public sign-up.</p></div>}
    {tab === 'members' && <div className="grid">{members.map((m) => <div className="card" key={m.id}><h3>{m.full_name}</h3><p className="muted">{m.role_title} · {m.status}</p></div>)}{!members.length && <p className="muted">No members visible to this account.</p>}</div>}
    {tab === 'projects' && <div className="grid">{projects.map((p) => <div className="card" key={p.id}><h3>{p.title}</h3><p className="muted">{p.category} · {p.status}</p></div>)}{!projects.length && <p className="muted">No projects visible to this account.</p>}</div>}
    {tab === 'messages' && <div>{messages.map((m) => <div className="card" key={m.id}><strong>{m.name} ({m.email})</strong><p>{m.subject}</p><p>{m.message}</p></div>)}{!messages.length && <p className="muted">No messages, or your account is not an admin.</p>}</div>}
    {tab === 'users' && <p className="muted">User invitations are admin-only via POST /api/admin/users/invite. A member calling that endpoint gets 403. The invite UI form is a next pass; the API, idempotency and audit logging are already implemented.</p>}
    {tab === 'settings' && <p className="muted">Site settings editing is via PATCH /api/admin/settings (admin only). A settings form is a next pass.</p>}
  </div>);
}
