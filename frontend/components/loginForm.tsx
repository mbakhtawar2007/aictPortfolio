'use client';
import { useState } from 'react';
import { signInExisting, sendPasswordSetupEmail, firebaseConfigured } from '../lib/firebaseClient';
// Map raw Firebase error codes to safe, clear messages. Never show the
// raw Firebase string (it leaks implementation detail and reads like a
// crash), and never reveal whether the email or the password was wrong.
export function friendlyAuthError(err: unknown): string {
  const raw = err instanceof Error ? err.message : '';
  const m = raw.match(/auth\/([a-z0-9-]+)/);
  const code = m ? m[1] : '';
  switch (code) {
    case 'invalid-credential': case 'user-not-found': case 'wrong-password': case 'invalid-email':
      return 'Email or password is incorrect. Check both and try again.';
    case 'too-many-requests':
      return 'Too many sign-in attempts. Wait a few minutes and try again.';
    case 'network-request-failed':
      return 'Could not reach the sign-in service. Check your connection and try again.';
    case 'operation-not-allowed': case 'user-disabled':
      return 'Sign-in is not available for this account. Contact the site owner.';
    default:
      if (/not configured/i.test(raw)) return 'Sign-in is not configured for this site. Contact the site owner.';
      return 'Sign-in failed. Try again.';
  }
}
export default function LoginForm({ heading }: { heading: string }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [resetNote, setResetNote] = useState(''); const [forgotBusy, setForgotBusy] = useState(false);
  async function forgotPassword() {
    if (!email.trim()) { setError('Enter your email first, then use Forgot password.'); return; }
    setError(''); setResetNote(''); setForgotBusy(true);
    try { await sendPasswordSetupEmail(email.trim()); setResetNote('If an account exists for this email, a password reset link has been sent to it.'); }
    catch (err) {
      // Do not reveal whether the email exists: treat unknown-email the
      // same as success, and map other failures to a safe message.
      const raw = err instanceof Error ? err.message : '';
      if (/auth\/(user-not-found|invalid-email)/.test(raw)) setResetNote('If an account exists for this email, a password reset link has been sent to it.');
      else setError(friendlyAuthError(err));
    } finally { setForgotBusy(false); }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      const token = await signInExisting(email, password);
      window.localStorage.setItem('aict_admin_token', token);
      // Role gate: admins go to /admin, members go to their own page.
      window.location.href = '/dashboard';
    } catch (err) { setError(friendlyAuthError(err)); setBusy(false); }
  }
  const [showPw, setShowPw] = useState(false);
  return (<div><h1>{heading}</h1>
    <p className="muted">Existing accounts only. There is no sign-up link, and no account can be created from this page. An admin must invite you first.</p>
    {!firebaseConfigured() && <p className="error">Firebase is not configured for this build (NEXT_PUBLIC_FIREBASE_* missing). Sign-in will fail until the site owner sets those public config values at Netlify build time. This is not a broken password — it is a missing configuration.</p>}
    <form onSubmit={submit}>
      <label>Email<input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label>Password<input required type={showPw ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      <p><label><input type="checkbox" checked={showPw} onChange={(e) => setShowPw(e.target.checked)} /> Show password</label></p>
      {error && <p className="error">{error}</p>}
      <button className="btn" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      <p><button type="button" className="btn secondary small" disabled={forgotBusy} onClick={forgotPassword}>{forgotBusy ? 'Sending…' : 'Forgot password?'}</button></p>
      {resetNote && <p className="success">{resetNote}</p>}
    </form>
    <p className="muted">If your account was deactivated, sign-in will not work — contact the admin.</p></div>);
}
