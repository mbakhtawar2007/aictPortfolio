import { db, firebaseEnabled } from './firebase.js';
import { demoSite, demoMembers, demoProjects, demoAchievements } from './demoData.js';
// Data layer: Firestore when enabled, otherwise an in-memory demo copy.
// Public getters ALWAYS filter to published and strip private fields.
const clone = (v) => JSON.parse(JSON.stringify(v));
let demo = null;
function demoStore() {
  if (!demo) demo = { site: clone(demoSite), members: clone(demoMembers), projects: clone(demoProjects), achievements: clone(demoAchievements), messages: [], roles: [], audit: [] };
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
  async membersPublished() { const all = await this.membersAll(); return all.filter((m) => m.status === 'published').map(publicMember).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)); },
  async memberBySlug(slug) { const all = await this.membersPublished(); return all.find((m) => m.slug === slug) || null; },
  async memberById(id) { const all = await this.membersAll(); return all.find((m) => m.id === id) || null; },
  async saveMember(id, v) { if (isFirebase()) { const ref = id ? db().collection('members').doc(id) : db().collection('members').doc(); await ref.set({ ...v, id: ref.id }, { merge: true }); return { id: ref.id, ...v }; } const d = demoStore(); const ex = d.members.find((m) => m.id === id); if (ex) Object.assign(ex, v); else { const row = { id: id || `member-${Date.now()}`, ...v }; d.members.push(row); return row; } return ex; },
  async deleteMember(id) { if (isFirebase()) { await db().collection('members').doc(id).delete(); return; } const d = demoStore(); d.members = d.members.filter((m) => m.id !== id); },
  async projectsAll() { if (isFirebase()) { const s = await db().collection('projects').get(); return s.docs.map((d) => ({ id: d.id, ...d.data() })); } return demoStore().projects; },
  async projectsPublished() { const all = await this.projectsAll(); return all.filter((p) => p.status === 'published').map(publicProject).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)); },
  async projectBySlug(slug) { const all = await this.projectsPublished(); return all.find((p) => p.slug === slug) || null; },
  async saveProject(id, v) { if (isFirebase()) { const ref = id ? db().collection('projects').doc(id) : db().collection('projects').doc(); await ref.set({ ...v, id: ref.id }, { merge: true }); return { id: ref.id, ...v }; } const d = demoStore(); const ex = d.projects.find((p) => p.id === id); if (ex) Object.assign(ex, v); else { const row = { id: id || `project-${Date.now()}`, ...v }; d.projects.push(row); return row; } return ex; },
  async deleteProject(id) { if (isFirebase()) { await db().collection('projects').doc(id).delete(); return; } const d = demoStore(); d.projects = d.projects.filter((p) => p.id !== id); },
  async achievementsAll() { if (isFirebase()) { const s = await db().collection('achievements').get(); return s.docs.map((d) => ({ id: d.id, ...d.data() })); } return demoStore().achievements; },
  async achievementsPublished() { const all = await this.achievementsAll(); return all.map((a) => { const out = { ...a }; delete out.file_path; return out; }); },
  async saveAchievement(id, v) { if (isFirebase()) { const ref = id ? db().collection('achievements').doc(id) : db().collection('achievements').doc(); await ref.set({ ...v, id: ref.id }, { merge: true }); return { id: ref.id, ...v }; } const d = demoStore(); const ex = d.achievements.find((a) => a.id === id); if (ex) Object.assign(ex, v); else { const row = { id: id || `ach-${Date.now()}`, ...v }; d.achievements.push(row); return row; } return ex; },
  async deleteAchievement(id) { if (isFirebase()) { await db().collection('achievements').doc(id).delete(); return; } const d = demoStore(); d.achievements = d.achievements.filter((a) => a.id !== id); },
  async messagesAll() { if (isFirebase()) { const s = await db().collection('contact_messages').orderBy('created_at', 'desc').get(); return s.docs.map((d) => ({ id: d.id, ...d.data() })); } return demoStore().messages; },
  async addMessage(v) { if (isFirebase()) { const ref = await db().collection('contact_messages').add(v); return { id: ref.id, ...v }; } const row = { id: `msg-${Date.now()}`, ...v }; demoStore().messages.push(row); return row; },
  async rolesAll() { if (isFirebase()) { const s = await db().collection('user_roles').get(); return s.docs.map((d) => ({ id: d.id, ...d.data() })); } return demoStore().roles; },
  async roleByUid(uid) { if (isFirebase()) { const s = await db().collection('user_roles').doc(uid).get(); return s.exists ? { id: s.id, ...s.data() } : null; } return demoStore().roles.find((r) => r.id === uid || r.uid === uid) || null; },
  async roleByEmail(email) { const all = await this.rolesAll(); return all.find((r) => r.email === email) || null; },
  async saveRole(uid, v) { if (isFirebase()) { await db().collection('user_roles').doc(uid).set({ ...v, uid }, { merge: true }); return { id: uid, ...v }; } const d = demoStore(); const ex = d.roles.find((r) => r.id === uid); if (ex) Object.assign(ex, v); else { const row = { id: uid, uid, ...v }; d.roles.push(row); return row; } return ex; },
  async addAudit(row) { if (isFirebase()) { await db().collection('audit_log').add(row); return; } demoStore().audit.push(row); },
};
