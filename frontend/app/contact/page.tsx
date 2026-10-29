'use client';
import { useState } from 'react';
import { apiSend } from '../../lib/api';
export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '', website: '' });
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle'); const [error, setError] = useState('');
  const set = (k: string) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setState('sending'); setError('');
    const r = await apiSend('/contact', 'POST', form);
    if (r.error) { setError(r.error.message); setState('error'); } else setState('done');
  }
  if (state === 'done') return <div><h1>Message sent</h1><p className="success">Thanks — your message was received.</p><p><button className="btn secondary" onClick={() => { setForm({ name: '', email: '', subject: '', message: '', website: '' }); setState('idle'); }}>Send another message</button>{' '}<a href="/">Back home</a></p></div>;
  return (<div><h1>Contact</h1><p className="muted">Messages go to the group inbox. There is no public account creation on this site.</p>
    <form onSubmit={submit}>
      <div className="float-label"><input required maxLength={200} placeholder=" " aria-label="Name" value={form.name} onChange={set('name')} /><label>Name</label></div>
      <div className="float-label"><input required maxLength={200} type="email" placeholder=" " aria-label="Email" value={form.email} onChange={set('email')} /><label>Email</label></div>
      <div className="float-label"><input maxLength={200} placeholder=" " aria-label="Subject" value={form.subject} onChange={set('subject')} /><label>Subject</label></div>
      <div className="float-label"><textarea required maxLength={5000} rows={6} placeholder=" " aria-label="Message" value={form.message} onChange={set('message')} /><label>Message</label></div>
      {/* Honeypot: hidden from humans, filled by bots. Do not remove. */}
      <div style={{ display: 'none' }}><label>Website<input value={form.website} onChange={set('website')} tabIndex={-1} autoComplete="off" /></label></div>
      {state === 'error' && <p className="error">{error}</p>}
      <button className="btn" disabled={state === 'sending'}>{state === 'sending' ? <><span className="spinner" aria-hidden="true" /> Sending…</> : 'Send message'}</button>
    </form></div>);
}
