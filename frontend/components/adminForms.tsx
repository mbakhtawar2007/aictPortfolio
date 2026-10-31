'use client';
import { useState } from 'react';
import { apiSend } from '../lib/api';
import { uploadDirectFile } from '../lib/upload';
import type { Member, Project, Achievement, SiteSettings } from '../lib/types';
import { Field, Modal } from './ui';

type AnyObj = Record<string, unknown>;
function errText(v: unknown): string { return typeof v === 'string' ? v : ''; }
function slugify(v: string): string { return v.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
function Text({ label, value, onChange, type = 'text', error, placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; error?: string; placeholder?: string }) {
  return (<Field label={label} error={error}><input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} /></Field>);
}
function Area({ label, value, onChange, rows = 4, error }: { label: string; value: string; onChange: (v: string) => void; rows?: number; error?: string }) {
  return (<Field label={label} error={error}><textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} /></Field>);
}
function Check({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (<label className="field"><input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} /> {label}</label>);
}
function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (<Field label={label}><select value={value} onChange={(e) => onChange(e.target.value)}>{options.map((o) => <option key={o} value={o}>{o}</option>)}</select></Field>);
}
function ListEditor({ title, items, onChange, render }: { title: string; items: AnyObj[]; onChange: (items: AnyObj[]) => void; render: (item: AnyObj, set: (patch: AnyObj) => void, index: number) => React.ReactNode }) {
  const setItem = (i: number, patch: AnyObj) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  return (<div><h3>{title}</h3>
    {items.map((it, i) => (<div className="card" key={i}>{render(it, (patch) => setItem(i, patch), i)}<button type="button" className="btn secondary small" onClick={() => onChange(items.filter((_, j) => j !== i))}>Remove</button></div>))}
    <p><button type="button" className="btn secondary small" onClick={() => onChange([...items, {}])}>+ Add</button></p></div>);
}
async function saveForm(path: string, method: string, body: unknown, push: (k: 'success' | 'error', t: string) => void, onSaved: () => void, setBusy: (b: boolean) => void) {
  setBusy(true);
  const r = await apiSend(path, method, body, true);
  setBusy(false);
  if (r.error) { push('error', r.error.message); return false; }
  push('success', 'Saved. Visitors will see it on their next page load — no rebuild needed.');
  onSaved(); return true;
}

export function MemberForm({ initial, onSaved, onCancel, push, selfCreate, canSetLeader }: { initial: Partial<Member> | null; onSaved: () => void; onCancel: () => void; push: (k: 'success' | 'error', t: string) => void; selfCreate?: boolean; canSetLeader?: boolean }) {
  const [f, setF] = useState<AnyObj>({ slug: '', full_name: '', role_title: '', short_intro: '', bio: '', photo_url: '', cover_url: '', location: '', availability: '', resume_path: '', resume_is_public: false, contact_email: '', contact_email_is_public: false, status: 'draft', is_leader: false, sort_order: 0, skills: [], education: [], experience: [], links: [], ...(initial || {}) });
  const [errors, setErrors] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false); const [photoProgress, setPhotoProgress] = useState(0); const [photoError, setPhotoError] = useState(''); const [photoKey, setPhotoKey] = useState(0);
  const [resumeBusy, setResumeBusy] = useState(false); const [resumeProgress, setResumeProgress] = useState(0); const [resumeError, setResumeError] = useState(''); const [resumeKey, setResumeKey] = useState(0);
  const directUpload = async (file: File, kind: 'photo' | 'resume') => {
    const isPhoto = kind === 'photo';
    const setBusy = isPhoto ? setPhotoBusy : setResumeBusy;
    const setProgress = isPhoto ? setPhotoProgress : setResumeProgress;
    const setErr = isPhoto ? setPhotoError : setResumeError;
    const bumpKey = isPhoto ? () => setPhotoKey((k) => k + 1) : () => setResumeKey((k) => k + 1);
    setErr(''); setProgress(0); setBusy(true);
    try {
      const name = errText(f.full_name) || 'Member';
      const url = await uploadDirectFile(file, isPhoto ? 'image' : 'pdf', setProgress, `${name} — ${isPhoto ? 'profile photo' : 'resume'}`);
      set(isPhoto ? 'photo_url' : 'resume_path', url);
      push('success', isPhoto ? 'Photo uploaded and added to your profile.' : 'Resume uploaded and added to your profile.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Upload failed.';
      setErr(msg); push('error', msg);
    } finally { setBusy(false); bumpKey(); }
  };
  const isCreate = !initial?.id;
  // Minimal-create (2026-10-29): creating a member used to show the whole
  // profile form (photo, skills, education, experience, links). On create
  // only name, role and email are asked; everything else is added later
  // via Edit. Editing an existing member still shows the full form.
  const [showAll, setShowAll] = useState(!isCreate);
  const set = (k: string, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); const errs: Record<string, string> = {};
    const slug = errText(f.slug).trim() || slugify(errText(f.full_name));
    if (!slug) errs.slug = 'Slug is required.';
    if (!errText(f.full_name).trim()) errs.full_name = 'Full name is required.';
    if (f.contact_email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(errText(f.contact_email))) errs.contact_email = 'Enter a valid email, or leave it blank.';
    setErrors(errs); if (Object.keys(errs).length) return;
    const body = { ...f, slug, sort_order: Number(f.sort_order) || 0, skills: (f.skills as AnyObj[]).filter((s) => s.name), education: (f.education as AnyObj[]).filter((s) => s.institution), experience: (f.experience as AnyObj[]).filter((s) => s.organization), links: (f.links as AnyObj[]).filter((s) => s.url) };
    if (!canSetLeader) delete (body as AnyObj).status;
    await saveForm(initial?.id ? `/admin/members/${initial.id}` : '/admin/members', initial?.id ? 'PATCH' : 'POST', body, push, onSaved, setBusy);
  };
  if (isCreate && !showAll) return (<form onSubmit={submit}>
    <p className="muted">{selfCreate ? 'You are creating your own profile. It will be saved as a draft, and an admin will review and publish it.' : 'Only these three things are needed to create a member. Everything else — photo, bio, skills, education, experience, links — can be added later by editing this member.'}</p>
    <Text label="Full name *" value={errText(f.full_name)} onChange={(v) => set('full_name', v)} error={errors.full_name} />
    <Text label="Role title" value={errText(f.role_title)} onChange={(v) => set('role_title', v)} placeholder="e.g. AI Developer" />
    <Text label="Email" type="email" value={errText(f.contact_email)} onChange={(v) => set('contact_email', v)} error={errors.contact_email} />
    <p className="muted">Email stays private unless 'Contact email is public' is ticked when editing.</p>
    {canSetLeader && <><Check label="Publish immediately" value={errText(f.status) === 'published'} onChange={(v) => set('status', v ? 'published' : 'draft')} /><p className="muted">Without this, the member is saved as a draft for later.</p></>}
    {errors.slug && <p className="error">{errors.slug}</p>}
    <p><button className="btn" disabled={busy}>{busy ? <><span className="spinner" /> Saving…</> : selfCreate ? 'Create my profile' : 'Create member'}</button>{' '}<button type="button" className="btn secondary" onClick={onCancel}>Cancel</button></p>
    <p><button type="button" className="btn secondary small" onClick={() => setShowAll(true)}>Add all details now instead</button></p>
    <p className="muted">The web address is made automatically from the name (e.g. /team/member-name). The member is saved as a draft until an admin publishes it.</p>
  </form>);
  return (<form onSubmit={submit}>
    {selfCreate && <p className="muted">You are creating your own profile. It will be saved as a draft, and an admin will review and publish it. You do not need to fill everything — name and web address are enough to start.</p>}
    <section className="form-section"><h3>Basics</h3><p className="muted">Only name and web address are required. Everything else can be added later.</p>
    <Text label="Full name *" value={errText(f.full_name)} onChange={(v) => { set('full_name', v); if (!errText(f.slug)) set('slug', slugify(v)); }} error={errors.full_name} />
    <Text label="Web address (slug) *" value={errText(f.slug)} onChange={(v) => set('slug', v)} error={errors.slug} placeholder="e.g. member-name — this becomes /team/member-name" />
    <p className="muted">Changing this breaks previously shared links to this profile.</p>
    <Text label="Role title" value={errText(f.role_title)} onChange={(v) => set('role_title', v)} placeholder="e.g. AI Developer" />
    <Text label="Short intro" value={errText(f.short_intro)} onChange={(v) => set('short_intro', v)} />
    <Area label="Bio" value={errText(f.bio)} onChange={(v) => set('bio', v)} rows={6} />
    {canSetLeader && <><Select label="Visibility" value={errText(f.status) || 'draft'} options={['draft', 'published']} onChange={(v) => set('status', v)} /><p className="muted">Draft means hidden from visitors. Published means visible on the public site.</p></>}
    {!selfCreate && !canSetLeader && <p className="muted">Only an admin can publish — this stays a draft until an admin publishes it.</p>}
    {canSetLeader && <><Check label="Group leader" value={Boolean(f.is_leader)} onChange={(v) => set('is_leader', v)} /><p className="muted">Only one member can be the group leader. Choosing this removes it from anyone else.</p></>}
    <Text label="Sort order" type="number" value={String(f.sort_order ?? 0)} onChange={(v) => set('sort_order', v)} placeholder="Lower numbers appear first" /></section>
    <section className="form-section"><h3>Photo & resume</h3><p className="muted">Pick a file from your device and it fills the URL automatically — or paste a URL by hand.</p>
    <Text label="Photo URL" value={errText(f.photo_url)} onChange={(v) => set('photo_url', v)} placeholder="Paste a URL, or upload a photo below" />
    <label className="field">Upload photo<input key={photoKey} type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={photoBusy} onChange={(e) => { const file = e.target.files?.[0]; if (file) void directUpload(file, 'photo'); }} /></label>
    {photoBusy && <p>Uploading… {photoProgress}%</p>}
    {photoError && <p className="error">{photoError}</p>}
    {errText(f.photo_url).startsWith('http') && <p><img src={errText(f.photo_url)} alt="Profile photo preview" style={{ height: 64, borderRadius: 8 }} /></p>}
    <Text label="Cover URL" value={errText(f.cover_url)} onChange={(v) => set('cover_url', v)} />
    <Text label="Resume URL (PDF)" value={errText(f.resume_path)} onChange={(v) => set('resume_path', v)} placeholder="Paste a URL, or upload a resume below" />
    <label className="field">Upload resume (PDF)<input key={resumeKey} type="file" accept="application/pdf" disabled={resumeBusy} onChange={(e) => { const file = e.target.files?.[0]; if (file) void directUpload(file, 'resume'); }} /></label>
    {resumeBusy && <p>Uploading… {resumeProgress}%</p>}
    {resumeError && <p className="error">{resumeError}</p>}
    {errText(f.resume_path).startsWith('http') && <p><a href={errText(f.resume_path)} target="_blank" rel="noreferrer">View uploaded resume</a></p>}
    <Check label="Resume is public" value={Boolean(f.resume_is_public)} onChange={(v) => set('resume_is_public', v)} /></section>
    <section className="form-section"><h3>Contact</h3>
    <Text label="Contact email" type="email" value={errText(f.contact_email)} onChange={(v) => set('contact_email', v)} error={errors.contact_email} />
    <Check label="Contact email is public" value={Boolean(f.contact_email_is_public)} onChange={(v) => set('contact_email_is_public', v)} />
    <Text label="Location" value={errText(f.location)} onChange={(v) => set('location', v)} />
    <Text label="Availability" value={errText(f.availability)} onChange={(v) => set('availability', v)} placeholder="e.g. Open to internships" /></section>
    <section className="form-section"><h3>Skills, education, experience & links</h3><p className="muted">Add as many as you like. Empty rows are ignored when you save.</p>
    <ListEditor title="Skills" items={(f.skills as AnyObj[]) || []} onChange={(v) => set('skills', v)} render={(it, setIt) => (<>
      <Text label="Skill name" value={errText(it.name)} onChange={(v) => setIt({ name: v })} />
      <Text label="Category" value={errText(it.category) || 'Technical'} onChange={(v) => setIt({ category: v })} />
      <Text label="Level 1–100" type="number" value={String(it.level ?? 50)} onChange={(v) => setIt({ level: Number(v) || 50 })} /></>)} />
    <ListEditor title="Education" items={(f.education as AnyObj[]) || []} onChange={(v) => set('education', v)} render={(it, setIt) => (<>
      <Text label="Institution" value={errText(it.institution)} onChange={(v) => setIt({ institution: v })} />
      <Text label="Degree" value={errText(it.degree)} onChange={(v) => setIt({ degree: v })} />
      <Text label="Field" value={errText(it.field)} onChange={(v) => setIt({ field: v })} />
      <Text label="Start date" type="date" value={errText(it.start_date)} onChange={(v) => setIt({ start_date: v })} />
      <Text label="End date (blank = present)" type="date" value={errText(it.end_date)} onChange={(v) => setIt({ end_date: v })} />
      <Area label="Description" value={errText(it.description)} onChange={(v) => setIt({ description: v })} /></>)} />
    <ListEditor title="Experience" items={(f.experience as AnyObj[]) || []} onChange={(v) => set('experience', v)} render={(it, setIt) => (<>
      <Text label="Organization" value={errText(it.organization)} onChange={(v) => setIt({ organization: v })} />
      <Text label="Role" value={errText(it.role)} onChange={(v) => setIt({ role: v })} />
      <Text label="Start date" type="date" value={errText(it.start_date)} onChange={(v) => setIt({ start_date: v })} />
      <Text label="End date (blank = present)" type="date" value={errText(it.end_date)} onChange={(v) => setIt({ end_date: v })} />
      <Area label="Description" value={errText(it.description)} onChange={(v) => setIt({ description: v })} /></>)} />
    <ListEditor title="Links" items={(f.links as AnyObj[]) || []} onChange={(v) => set('links', v)} render={(it, setIt) => (<>
      <Text label="Type (github, linkedin, email, portfolio…)" value={errText(it.type)} onChange={(v) => setIt({ type: v })} />
      <Text label="Label" value={errText(it.label)} onChange={(v) => setIt({ label: v })} />
      <Text label="URL" value={errText(it.url)} onChange={(v) => setIt({ url: v })} /></>)} />
    </section>
    <p><button className="btn" disabled={busy}>{busy ? <><span className="spinner" /> Saving…</> : selfCreate ? 'Create my profile' : 'Save member'}</button>{' '}<button type="button" className="btn secondary" onClick={onCancel}>Cancel</button></p>
    <p className="muted">Saving stores this in the database. Visitors will see published changes on their next page load — no rebuild needed.</p>
  </form>);
}

export function ProjectForm({ initial, members, onSaved, onCancel, push, isAdmin }: { initial: Partial<Project> | null; members: Member[]; onSaved: () => void; onCancel: () => void; push: (k: 'success' | 'error', t: string) => void; isAdmin?: boolean }) {
  // Audit fix (data-integrity review): legacy/demo projects may carry only
  // member_ids with no project_members. Without this, opening such a project
  // and saving would send member_ids: [] and silently drop all assignments.
  const initialMembers = (initial as AnyObj)?.project_members as AnyObj[] | undefined;
  const initialIds = (initial as AnyObj)?.member_ids as string[] | undefined;
  const seededMembers = (initialMembers && initialMembers.length) ? initialMembers
    : (initialIds || []).map((member_id) => ({ member_id, role_in_project: '' }));
  const [f, setF] = useState<AnyObj>({ slug: '', title: '', tagline: '', description: '', case_study: '', category: 'Other', tech_stack: [], tools_used: [], characters: [], cover_url: '', video_url: '', repo_url: '', live_url: '', year: '', featured: false, status: 'draft', is_leader: false, sort_order: 0, project_members: [], ...(initial || {}), ...(initial ? { project_members: seededMembers } : {}) });
  const [errors, setErrors] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false);
  const set = (k: string, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  const csv = (v: unknown) => Array.isArray(v) ? v.join(', ') : '';
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); const errs: Record<string, string> = {};
    if (!errText(f.slug).trim()) errs.slug = 'Slug is required.';
    if (!errText(f.title).trim()) errs.title = 'Title is required.';
    setErrors(errs); if (Object.keys(errs).length) return;
    const pm = (f.project_members as AnyObj[]).filter((x) => x.member_id);
    // Blank year must be sent as null (not undefined, which JSON drops)
    // so the backend can delete the field instead of keeping the old year.
    const body = { ...f, year: (f.year === '' || f.year === null || f.year === undefined) ? null : Number(f.year), sort_order: Number(f.sort_order) || 0, member_ids: pm.map((x) => x.member_id), project_members: pm };
    if (!isAdmin) delete (body as AnyObj).status;
    await saveForm(initial?.id ? `/admin/projects/${initial.id}` : '/admin/projects', initial?.id ? 'PATCH' : 'POST', body, push, onSaved, setBusy);
  };
  const assignments = (f.project_members as AnyObj[]) || [];
  return (<form onSubmit={submit}>
    <section className="form-section"><h3>Basics</h3>
    <Text label="Title *" value={errText(f.title)} onChange={(v) => { set('title', v); if (!errText(f.slug)) set('slug', slugify(v)); }} error={errors.title} />
    <Text label="Web address (slug) *" value={errText(f.slug)} onChange={(v) => set('slug', v)} error={errors.slug} placeholder="e.g. ai-showreel — this becomes /projects/ai-showreel" />
    <Text label="Tagline" value={errText(f.tagline)} onChange={(v) => set('tagline', v)} />
    <Area label="Description" value={errText(f.description)} onChange={(v) => set('description', v)} />
    <Area label="Case study" value={errText(f.case_study)} onChange={(v) => set('case_study', v)} rows={6} />
    <Text label="Characters involved (comma-separated)" value={csv(f.characters)} onChange={(v) => set('characters', v.split(',').map((s) => s.trim()).filter(Boolean))} /><p className="muted">For video projects: names of characters appearing in the video, if any. Shown on the project details page.</p>
    <Select label="Category" value={errText(f.category) || 'Other'} options={['AI Video', 'AI Tool', 'Website', 'Other']} onChange={(v) => set('category', v)} />
    <Text label="Tech stack (comma-separated)" value={csv(f.tech_stack)} onChange={(v) => set('tech_stack', v.split(',').map((s) => s.trim()).filter(Boolean))} />
    <Text label="Tools used (comma-separated)" value={csv(f.tools_used)} onChange={(v) => set('tools_used', v.split(',').map((s) => s.trim()).filter(Boolean))} />
    <Text label="Cover URL" value={errText(f.cover_url)} onChange={(v) => set('cover_url', v)} />
    <Text label="Video URL" value={errText(f.video_url)} onChange={(v) => set('video_url', v)} />
    <Text label="Repo URL" value={errText(f.repo_url)} onChange={(v) => set('repo_url', v)} />
    <Text label="Live URL" value={errText(f.live_url)} onChange={(v) => set('live_url', v)} />
    <Text label="Year (leave blank to clear)" type="number" value={f.year === null || f.year === undefined ? '' : String(f.year)} onChange={(v) => set('year', v)} />
    <Check label="Featured" value={Boolean(f.featured)} onChange={(v) => set('featured', v)} /><p className="muted">Featured projects are highlighted on the homepage.</p>
    {isAdmin && <><Select label="Status" value={errText(f.status) || 'draft'} options={['draft', 'published']} onChange={(v) => set('status', v)} /><p className="muted">Draft means hidden from visitors. Published means visible on the public site.</p></>}
    {!isAdmin && <p className="muted">As a member, this project is saved as a draft for an admin to review. It will not be public until an admin publishes it.</p>}
    <Text label="Sort order" type="number" value={String(f.sort_order ?? 0)} onChange={(v) => set('sort_order', v)} /><p className="muted">Lower numbers appear first in lists.</p>
    </section>
    <section className="form-section"><h3>Team</h3><p className="muted">Choose who worked on this project, and what each person did.</p>
    <h3>Assigned members</h3>
    {assignments.map((a, i) => (<div className="card" key={i}><p><strong>{members.find((m) => m.id === a.member_id)?.full_name || errText(a.member_id)}</strong></p>
      <Text label="Role in project" value={errText(a.role_in_project)} onChange={(v) => set('project_members', assignments.map((x, j) => (j === i ? { ...x, role_in_project: v } : x)))} />
      <button type="button" className="btn secondary small" onClick={() => set('project_members', assignments.filter((_, j) => j !== i))}>Remove</button></div>))}
    <Field label="Add member"><select value="" onChange={(e) => { if (e.target.value) set('project_members', [...assignments, { member_id: e.target.value, role_in_project: '' }]); }}><option value="">— Choose a member —</option>{members.filter((m) => !assignments.some((a) => a.member_id === m.id)).map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}</select></Field>
    </section>
    <p><button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save project'}</button>{' '}<button type="button" className="btn secondary" onClick={onCancel}>Cancel</button></p>
  </form>);
}

export function AchievementForm({ initial, members, isAdmin, onSaved, onCancel, push }: { initial: Partial<Achievement> | null; members: Member[]; isAdmin: boolean; onSaved: () => void; onCancel: () => void; push: (k: 'success' | 'error', t: string) => void }) {
  const [f, setF] = useState<AnyObj>({ title: '', issuer: '', type: 'certificate', date: '', description: '', credential_url: '', image_path: '', featured: false, member_id: '', status: 'draft', ...(initial || {}) });
  const [errors, setErrors] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false);
  const set = (k: string, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!errText(f.title).trim()) { setErrors({ title: 'Title is required.' }); return; }
    // Members never send status: the backend defaults new achievements to
    // draft and strips status on member PATCH, so a member cannot publish
    // their own achievement even with a crafted request body.
    const body = isAdmin ? f : { ...f, status: undefined, member_id: '' };
    await saveForm(initial?.id ? `/admin/achievements/${initial.id}` : '/admin/achievements', initial?.id ? 'PATCH' : 'POST', body, push, onSaved, setBusy);
  };
  return (<form onSubmit={submit}>
    <Text label="Title *" value={errText(f.title)} onChange={(v) => set('title', v)} error={errors.title} />
    <Text label="Issuer" value={errText(f.issuer)} onChange={(v) => set('issuer', v)} />
    <Select label="Type" value={errText(f.type) || 'certificate'} options={['certificate', 'award', 'competition', 'academic']} onChange={(v) => set('type', v)} />
    <Text label="Date" type="date" value={errText(f.date)} onChange={(v) => set('date', v)} />
    <Area label="Description" value={errText(f.description)} onChange={(v) => set('description', v)} />
    <Text label="Credential URL" value={errText(f.credential_url)} onChange={(v) => set('credential_url', v)} />
    <Text label="Image URL" value={errText(f.image_path)} onChange={(v) => set('image_path', v)} />
    <Check label="Featured" value={Boolean(f.featured)} onChange={(v) => set('featured', v)} />
    {isAdmin && <><Select label="Visibility" value={errText(f.status) || 'draft'} options={['draft', 'published']} onChange={(v) => set('status', v)} /><p className="muted">Draft means hidden from visitors. Published means visible on the public site.</p></>}
    {isAdmin && (<Field label="Member"><select value={errText(f.member_id)} onChange={(e) => set('member_id', e.target.value)}><option value="">— No member —</option>{members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}</select></Field>)}
    {!isAdmin && <p className="muted">As a member, this achievement is saved to your own profile (the backend fills in your member record) as a <strong>draft</strong> for an admin to review. It will not be public until an admin publishes it.</p>}
    <p><button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save achievement'}</button>{' '}<button type="button" className="btn secondary" onClick={onCancel}>Cancel</button></p>
  </form>);
}

export function SettingsForm({ initial, onSaved, push }: { initial: Partial<SiteSettings>; onSaved: () => void; push: (k: 'success' | 'error', t: string) => void }) {
  const [f, setF] = useState<AnyObj>({ group_name: '', tagline: '', mission: '', about: '', logo_url: '', hero_video_url: '', email: '', accent_color: '', seo_title: '', seo_description: '', og_image_url: '', social_links: {}, ...(initial || {}) });
  const [busy, setBusy] = useState(false); const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: string, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  const social = (f.social_links as Record<string, string>) || {};
  const setSocial = (k: string, v: string) => set('social_links', { ...social, [k]: v });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!errText(f.group_name).trim()) { setErrors({ group_name: 'Group name is required.' }); return; }
    await saveForm('/admin/settings', 'PATCH', f, push, onSaved, setBusy);
  };
  return (<form onSubmit={submit}>
    <section className="form-section"><h3>About the group</h3>
    <Text label="Group name *" value={errText(f.group_name)} onChange={(v) => set('group_name', v)} error={errors.group_name} />
    <Text label="Tagline" value={errText(f.tagline)} onChange={(v) => set('tagline', v)} />
    <Area label="Mission" value={errText(f.mission)} onChange={(v) => set('mission', v)} />
    <Area label="About" value={errText(f.about)} onChange={(v) => set('about', v)} rows={6} />
    <Text label="Logo URL" value={errText(f.logo_url)} onChange={(v) => set('logo_url', v)} />
    <Text label="Hero video URL" value={errText(f.hero_video_url)} onChange={(v) => set('hero_video_url', v)} />
    <Text label="Contact email" type="email" value={errText(f.email)} onChange={(v) => set('email', v)} />
    <Text label="Accent colour (hex, e.g. #8B5CF6)" value={errText(f.accent_color)} onChange={(v) => set('accent_color', v)} />
    <h3>Social links</h3>
    {(['github', 'linkedin', 'youtube', 'x', 'instagram'] as const).map((k) => (<Text key={k} label={k} value={social[k] || ''} onChange={(v) => setSocial(k, v)} />))}
    <h3>SEO</h3>
    <Text label="SEO title" value={errText(f.seo_title)} onChange={(v) => set('seo_title', v)} />
    <Text label="SEO description" value={errText(f.seo_description)} onChange={(v) => set('seo_description', v)} />
    <Text label="Open Graph image URL" value={errText(f.og_image_url)} onChange={(v) => set('og_image_url', v)} />
    </section>
    <p><button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button></p>
    <p className="muted">Saving stores this in the database. Visitors will see published changes on their next page load — no rebuild needed.</p>
  </form>);
}
export function FormModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (<Modal title={title} onClose={onClose}>{children}</Modal>);
}
