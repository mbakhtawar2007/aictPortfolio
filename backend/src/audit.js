// Audit log: Firestore when enabled, in-memory demo list otherwise.
// Audit failures must never leak secrets and must not crash the request.
export const demoAudit = [];
export async function audit(store, entry) {
  const row = { ...entry, created_at: new Date().toISOString() };
  try { await store.addAudit(row); } catch { /* log locally only, no secret */ console.warn('audit write failed'); }
  return row;
}
