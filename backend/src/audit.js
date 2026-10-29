// Audit log: Firestore when enabled, in-memory demo list otherwise.
// Section 5D policy: audit writes are retried once. A failure is NOT
// silently swallowed any more: audit() returns { row, ok } and callers for
// critical account operations surface audit_failed in their response, so
// an admin can see that an action succeeded but its audit record did not
// land. No secrets are ever logged (entries carry only ids/actions).
export const demoAudit = [];
export async function audit(store, entry) {
  const row = { ...entry, created_at: new Date().toISOString() };
  for (let attempt = 0; attempt < 2; attempt++) {
    try { await store.addAudit(row); return { row, ok: true }; }
    catch { if (attempt === 1) console.warn('audit write failed', entry.action, entry.entity, entry.entity_id); }
  }
  return { row, ok: false };
}
