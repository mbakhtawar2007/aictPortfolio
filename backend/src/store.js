import { db, firebaseEnabled, fieldDelete } from './firebase.js';
import { demoSite, demoMembers, demoProjects, demoAchievements } from './demoData.js';
// Data layer: Firestore when enabled, otherwise an in-memory demo copy.
// Public getters ALWAYS filter to published and strip private fields.
const clone = (v) => JSON.parse(JSON.stringify(v));
let demo = null;
function demoStore() {
  if (!demo) demo = { site: clone(demoSite), members: clone(demoMembers), projects: clone(demoProjects), achievements: clone(demoAchievements), messages: [], roles: [], audit: [], revisions: [], invites: [] };
  return demo;
}
export function isFirebase() { return firebaseEnabled(); }
function publicMember(m) {
  const out = { ...m };
  if (!out.contact_email_is_public) delete out.contact_email;
  if (!out.resume_is_public) delete out.resume_path;
  return out;
}
function publicProject(p) { return { ...p }; }
export const store = {
  async site() { if (isFirebase()) { const s = await db().collection('site_settings').doc('main').get(); return s.exists ? s.data() : null; } return demoStore().site; },
  async saveSite(v) { if (isFirebase()) { await db().collection('site_settings').doc('main').set(v, { merge: true }); return v; } demoStore().site = { ...demoStore().site, ...v }; return demoStore().site; },
  async membersAll() { if (isFirebase()) { const s = await db().collection('members').get(); return s.docs.map((d) => ({ id: d.id, ...d.data() })); } return demoStore().members; },
  async membersPublished() { const all = await this.membersAll(); return all.filter((m) => m.status === 'published').map(publicMember).sort((a, b) => ((b.is_leader ? 1 : 0) - (a.is_leader ? 1 : 0)) || ((a.sort_order || 0) - (b.sort_order || 0))); },
  async memberBySlug(slug) { const all = await this.membersPublished(); return all.find((m) => m.slug === slug) || null; },
  async memberById(id) { const all = await this.membersAll(); return all.find((m) => m.id === id) || null; },
  async replaceMember(id, v) { if (isFirebase()) { const ref = db().collection('members').doc(id); await ref.set({ ...v, id: ref.id }); return { id: ref.id, ...v }; } const d = demoStore(); const ex = d.members.find((m) => m.id === id); if (ex) { const idx = d.members.indexOf(ex); d.members[idx] = { id, ...v }; return d.members[idx]; } const row = { id, ...v }; d.members.push(row); return row; },
  async replaceProject(id, v) { if (isFirebase()) { const ref = db().collection('projects').doc(id); await ref.set({ ...v, id: ref.id }); return { id: ref.id, ...v }; } const d = demoStore(); const ex = d.projects.find((p) => p.id === id); if (ex) { const idx = d.projects.indexOf(ex); d.projects[idx] = { id, ...v }; return d.projects[idx]; } const row = { id, ...v }; d.projects.push(row); return row; },
  async replaceAchievement(id, v) { if (isFirebase()) { const ref = db().collection('achievements').doc(id); await ref.set({ ...v, id: ref.id }); return { id: ref.id, ...v }; } const d = demoStore(); const ex = d.achievements.find((a) => a.id === id); if (ex) { const idx = d.achievements.indexOf(ex); d.achievements[idx] = { id, ...v }; return d.achievements[idx]; } const row = { id, ...v }; d.achievements.push(row); return row; },
  async replaceSite(v) { if (isFirebase()) { await db().collection('site_settings').doc('main').set(v); return v; } demoStore().site = { ...v }; return demoStore().site; },
  async saveMember(id, v) { const now = new Date().toISOString(); v = { ...v, updated_at: now, ...(id ? {} : { created_at: now }) }; if (isFirebase()) { const ref = id ? db().collection('members').doc(id) : db().collection('members').doc(); await ref.set({ ...v, id: ref.id }, { merge: true }); return { id: ref.id, ...v }; } const d = demoStore(); const ex = d.members.find((m) => m.id === id); if (ex) Object.assign(ex, v); else { const row = { id: id || `member-${Date.now()}`, ...v }; d.members.push(row); return row; } return ex; },
  async deleteMember(id) {
    // Section 5A integrity policy: deleting a team profile must NOT delete
    // the Firebase Auth user or its user_roles row (those are separate,
    // intentional operations). Instead: unlink the account (member_id ''),
    // remove the member from every project's member_ids/project_members,
    // and delete achievements owned by the member (they cannot stay public
    // without an owner profile under the BUG-11 policy). Audit history is
    // untouched. Callers snapshot before calling this.
    if (isFirebase()) {
      const batch = db().batch();
      batch.delete(db().collection('members').doc(id));
      const roles = await db().collection('user_roles').where('member_id', '==', id).get();
      roles.forEach((doc) => batch.set(doc.ref, { member_id: '' }, { merge: true }));
      const projects = await db().collection('projects').get();
      projects.forEach((doc) => {
        const data = doc.data();
        const ids = (data.member_ids || []).filter((x) => x !== id);
        const pm = (data.project_members || []).filter((x) => x.member_id !== id);
        if (ids.length !== (data.member_ids || []).length || pm.length !== (data.project_members || []).length) batch.set(doc.ref, { member_ids: ids, project_members: pm }, { merge: true });
      });
      const achs = await db().collection('achievements').where('member_id', '==', id).get();
      achs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit(); return;
    }
    const d = demoStore();
    d.members = d.members.filter((m) => m.id !== id);
    d.roles.forEach((r) => { if (r.member_id === id) r.member_id = ''; });
    d.projects.forEach((pr) => { pr.member_ids = (pr.member_ids || []).filter((x) => x !== id); pr.project_members = (pr.project_members || []).filter((x) => x.member_id !== id); });
    d.achievements = d.achievements.filter((a) => a.member_id !== id);
  },
  async projectsAll() { if (isFirebase()) { const s = await db().collection('projects').get(); return s.docs.map((d) => ({ id: d.id, ...d.data() })); } return demoStore().projects; },
  async projectsPublished() {
    const all = await this.projectsAll();
    const publishedIds = new Set((await this.membersAll()).filter((m) => m.status === 'published').map((m) => m.id));
    // BUG-11 visibility policy: a published project stays public, but its
    // contributor list shows only published members, so a draft member's
    // profile is never exposed through a project.
    return all.filter((p) => p.status === 'published').map((p) => {
      const out = publicProject(p);
      out.member_ids = (p.member_ids || []).filter((id) => publishedIds.has(id));
      out.project_members = (p.project_members || []).filter((x) => publishedIds.has(x.member_id));
      return out;
    }).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  },
  async projectBySlug(slug) { const all = await this.projectsPublished(); return all.find((p) => p.slug === slug) || null; },
  async saveProject(id, v) { const now = new Date().toISOString(); v = { ...v, updated_at: now, ...(id ? {} : { created_at: now }) }; if (isFirebase()) { const ref = id ? db().collection('projects').doc(id) : db().collection('projects').doc(); await ref.set({ ...v, id: ref.id }, { merge: true }); return { id: ref.id, ...v }; } const d = demoStore(); const ex = d.projects.find((p) => p.id === id); if (ex) Object.assign(ex, v); else { const row = { id: id || `project-${Date.now()}`, ...v }; d.projects.push(row); return row; } return ex; },
  async reserveSlug(kind, slug, recordId) {
    // Section 5F atomic slug reservation: a dedicated document whose id is
    // kind:slug. In Firebase this runs in a transaction, so two concurrent
    // creations cannot both claim the same slug; in demo mode the check
    // is synchronous in a single process, which is equally atomic there.
    // Returns true when claimed, false when another record owns the slug.
    if (isFirebase()) {
      const ref = db().collection('slug_reservations').doc(`${kind}:${slug}`);
      return db().runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (snap.exists && snap.data().owner !== recordId) return false;
        tx.set(ref, { kind, slug, owner: recordId, updated_at: new Date().toISOString() });
        return true;
      });
    }
    const d = demoStore(); d.slugReservations = d.slugReservations || {};
    const key = `${kind}:${slug}`; const owner = d.slugReservations[key];
    if (owner && owner !== recordId) return false;
    d.slugReservations[key] = recordId; return true;
  },
  async releaseSlug(kind, slug, recordId) {
    if (isFirebase()) {
      const ref = db().collection('slug_reservations').doc(`${kind}:${slug}`);
      const snap = await ref.get();
      if (snap.exists && snap.data().owner === recordId) await ref.delete();
      return;
    }
    const d = demoStore(); d.slugReservations = d.slugReservations || {};
    if (d.slugReservations[`${kind}:${slug}`] === recordId) delete d.slugReservations[`${kind}:${slug}`];
  },
  async deleteProjectField(id, field) {
    if (isFirebase()) { await db().collection('projects').doc(id).update({ [field]: fieldDelete() }); return; }
    const d = demoStore(); const ex = d.projects.find((p) => p.id === id); if (ex) delete ex[field];
  },
  async deleteProject(id) { if (isFirebase()) { await db().collection('projects').doc(id).delete(); return; } const d = demoStore(); d.projects = d.projects.filter((p) => p.id !== id); },
  async achievementsAll() { if (isFirebase()) { const s = await db().collection('achievements').get(); return s.docs.map((d) => ({ id: d.id, ...d.data() })); } return demoStore().achievements; },
  async achievementsPublished() {
    const all = await this.achievementsAll();
    const members = await this.membersAll();
    const publishedIds = new Set(members.filter((m) => m.status === 'published').map((m) => m.id));
    const knownIds = new Set(members.map((m) => m.id));
    // BUG-10/11: legacy records without a status count as published (so this
    // change hides nothing that was previously public). A member-owned
    // achievement is public only when it is published AND its owner profile
    // is published; unassigned achievements (member_id '') follow status only.
    return all.filter((a) => (a.status === 'published' || a.status === undefined)
      && (!a.member_id || (knownIds.has(a.member_id) && publishedIds.has(a.member_id))))
      .map((a) => { const out = { ...a }; delete out.file_path; return out; });
  },
  async saveAchievement(id, v) { const now = new Date().toISOString(); v = { ...v, updated_at: now, ...(id ? {} : { created_at: now }) }; if (isFirebase()) { const ref = id ? db().collection('achievements').doc(id) : db().collection('achievements').doc(); await ref.set({ ...v, id: ref.id }, { merge: true }); return { id: ref.id, ...v }; } const d = demoStore(); const ex = d.achievements.find((a) => a.id === id); if (ex) Object.assign(ex, v); else { const row = { id: id || `ach-${Date.now()}`, ...v }; d.achievements.push(row); return row; } return ex; },
  async deleteAchievement(id) { if (isFirebase()) { await db().collection('achievements').doc(id).delete(); return; } const d = demoStore(); d.achievements = d.achievements.filter((a) => a.id !== id); },
  async messagesAll() { if (isFirebase()) { const s = await db().collection('contact_messages').orderBy('created_at', 'desc').get(); return s.docs.map((d) => ({ id: d.id, ...d.data() })); } return demoStore().messages; },
  async addMessage(v) { if (isFirebase()) { const ref = await db().collection('contact_messages').add(v); return { id: ref.id, ...v }; } const row = { id: `msg-${Date.now()}`, ...v }; demoStore().messages.push(row); return row; },
  async rolesAll() { if (isFirebase()) { const s = await db().collection('user_roles').get(); return s.docs.map((d) => ({ id: d.id, ...d.data() })); } return demoStore().roles; },
  async roleByUid(uid) { if (isFirebase()) { const s = await db().collection('user_roles').doc(uid).get(); return s.exists ? { id: s.id, ...s.data() } : null; } return demoStore().roles.find((r) => r.id === uid || r.uid === uid) || null; },
  async roleByEmail(email) { const all = await this.rolesAll(); return all.find((r) => r.email === email) || null; },
  async saveRole(uid, v) { if (isFirebase()) { await db().collection('user_roles').doc(uid).set({ ...v, uid }, { merge: true }); return { id: uid, ...v }; } const d = demoStore(); const ex = d.roles.find((r) => r.id === uid); if (ex) Object.assign(ex, v); else { const row = { id: uid, uid, ...v }; d.roles.push(row); return row; } return ex; },
  async addAudit(row) { if (isFirebase()) { await db().collection('audit_log').add(row); return; } demoStore().audit.push(row); },
  // Invite-link tokens (2026-10-29): the plaintext token is NEVER stored
  // — only its SHA-256 hash. The token is returned to the admin once, at
  // creation, and is single-use with a 7-day expiry. Role, member link and
  // email are locked into the invite record, so the accept step cannot
  // escalate them (the accept endpoint takes no role/email fields).
  async saveInvite(v) {
    if (isFirebase()) { const ref = db().collection('invites').doc(); await ref.set({ ...v, id: ref.id }); return { id: ref.id, ...v }; }
    const d = demoStore(); const row = { id: `invite-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ...v }; d.invites.push(row); return row;
  },
  async inviteByHash(tokenHash) {
    if (isFirebase()) { const s = await db().collection('invites').where('token_hash', '==', tokenHash).limit(1).get(); if (s.empty) return null; const doc = s.docs[0]; return { id: doc.id, ...doc.data() }; }
    return demoStore().invites.find((i) => i.token_hash === tokenHash) || null;
  },
  async invitesAll() {
    if (isFirebase()) { const s = await db().collection('invites').get(); return s.docs.map((d) => ({ id: d.id, ...d.data() })); }
    return demoStore().invites;
  },
  async markInviteUsed(id) {
    if (isFirebase()) { await db().collection('invites').doc(id).set({ used: true, used_at: new Date().toISOString() }, { merge: true }); return; }
    const ex = demoStore().invites.find((i) => i.id === id); if (ex) { ex.used = true; ex.used_at = new Date().toISOString(); }
  },
  async markInviteRevoked(id) {
    if (isFirebase()) { await db().collection('invites').doc(id).set({ revoked: true, revoked_at: new Date().toISOString() }, { merge: true }); return; }
    const ex = demoStore().invites.find((i) => i.id === id); if (ex) { ex.revoked = true; ex.revoked_at = new Date().toISOString(); }
  },
  async auditAll(limit = 50, offset = 0) {
    if (isFirebase()) { const s = await db().collection('audit_log').orderBy('created_at', 'desc').limit(limit + offset).get(); return s.docs.map((d) => ({ id: d.id, ...d.data() })).slice(offset, offset + limit); }
    return [...demoStore().audit].reverse().slice(offset, offset + limit);
  },
  async addRevision(row) {
    // Deep-clone: the demo store mutates records in place, so a snapshot
    // stored by reference would silently become the post-edit state.
    const cloned = JSON.parse(JSON.stringify(row));
    if (isFirebase()) { const ref = await db().collection('content_revisions').add(cloned); return { id: ref.id, ...cloned }; }
    const r = { id: `rev-${Date.now()}-${demoStore().revisions.length}`, ...cloned }; demoStore().revisions.push(r); return r;
  },
  async revisionsAll(entity, entity_id) {
    if (isFirebase()) {
      let q = db().collection('content_revisions').orderBy('created_at', 'desc');
      if (entity) q = q.where('entity', '==', entity);
      if (entity_id) q = q.where('entity_id', '==', entity_id);
      const s = await q.limit(100).get(); return s.docs.map((d) => ({ id: d.id, ...d.data() }));
    }
    return [...demoStore().revisions].reverse().filter((r) => (!entity || r.entity === entity) && (!entity_id || r.entity_id === entity_id));
  },
  async revisionById(id) {
    if (isFirebase()) { const s = await db().collection('content_revisions').doc(id).get(); return s.exists ? { id: s.id, ...s.data() } : null; }
    return demoStore().revisions.find((r) => r.id === id) || null;
  },
  async markMessage(id, read) {
    if (isFirebase()) { await db().collection('contact_messages').doc(id).set({ read }, { merge: true }); return; }
    const m = demoStore().messages.find((x) => x.id === id); if (m) m.read = read;
  },
  async deleteMessage(id) {
    if (isFirebase()) { await db().collection('contact_messages').doc(id).delete(); return; }
    demoStore().messages = demoStore().messages.filter((x) => x.id !== id);
  },
};
