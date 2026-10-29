'use client';
import { useState } from 'react';
import { signInExisting, firebaseConfigured } from '../../../lib/firebaseClient';
export default function AdminLogin() {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      const token = await signInExisting(email, password);
      window.localStorage.setItem('aict_admin_token', token);
      window.location.href = '/admin';
    } catch (err) { setError(err instanceof Error ? err.message : 'Sign-in failed.'); setBusy(false); }
  }
  return (<div><h1>Admin login</h1>
    <p className="muted">Existing accounts only. There is no sign-up link, and no account can be created from this page. An admin must invite you first.</p>
    {!firebaseConfigured() && <p className="error">Firebase is not configured for this build (NEXT_PUBLIC_FIREBASE_* missing). Sign-in will fail until the site owner sets those public config values at Netlify build time. This is not a broken password — it is a missing configuration.</p>}
    <form onSubmit={submit}>
      <label>Email<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label>Password<input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      {error && <p className="error">{error}</p>}
      <button className="btn" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
    </form>
    <p className="muted">Deactivated accounts are denied by the backend on every protected request, even with a token.</p></div>);
}
