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
  // The two login routes share this form; the switch link points at the
  // other one. The account's role, not this link, decides where a
  // successful sign-in lands.
  const isAdminLogin = heading === 'Admin login';
  const switchHref = isAdminLogin ? '/login' : '/admin/login';
  const switchLabel = isAdminLogin ? 'Member login' : 'Admin login';
  return (<div className="login-shell">
    <div className="login-card">
      <p className="login-eyebrow">TechHive</p>
      <h1 className="login-title">{heading}</h1>
      <p className="login-subtitle">Welcome back. Sign in to your team workspace.</p>
      {!firebaseConfigured() && <p className="error" role="alert">Firebase is not configured for this build (NEXT_PUBLIC_FIREBASE_* missing). Sign-in will fail until the site owner sets those public config values at Netlify build time. This is not a broken password — it is a missing configuration.</p>}
      <form onSubmit={submit} className="login-form">
        <label className="login-label" htmlFor="login-email">Email</label>
        <input id="login-email" className="login-input" required type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <label className="login-label" htmlFor="login-password">Password</label>
        <div className="login-password-wrap">
          <input id="login-password" className="login-input login-password-input" required type={showPw ? 'text' : 'password'} autoComplete="current-password" placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="button" className="login-show-btn" aria-label={showPw ? 'Hide password' : 'Show password'} aria-pressed={showPw} onClick={() => setShowPw((v) => !v)}>{showPw ? 'Hide' : 'Show'}</button>
        </div>
        <p className="login-forgot"><button type="button" className="login-link-btn" disabled={forgotBusy} onClick={forgotPassword}>{forgotBusy ? 'Sending…' : 'Forgot password?'}</button></p>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn login-submit" disabled={busy}>{busy ? (<><span className="spinner" /> Signing in…</>) : 'Sign in'}</button>
        {resetNote && <p className="success" role="status">{resetNote}</p>}
      </form>
      <p className="login-note">🔒 Existing accounts only — there is no sign-up here. An admin must invite you first.</p>
      <p className="login-switch">Signing in as the other role? <a href={switchHref}>{switchLabel} →</a></p>
    </div>
    <p className="login-foot"><a href="/">← Back to home</a><span className="login-foot-sep"> · </span><span className="muted">Deactivated account? Contact the admin — sign-in will not work until it is reactivated.</span></p>
  </div>);
}
