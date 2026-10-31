'use client';
import { useEffect, useState } from 'react';
import { apiGet, authToken } from '../../lib/api';
import { Loading, ErrorBox } from '../shared';

// Role gate after login: admins go to /admin, members go to their own
// page (/member) and never see the admin dashboard.
// Distinctions that matter: no token -> login; token rejected as
// unauthenticated -> login; network/backend failure -> a retryable error
// state here, NOT a silent redirect that looks like a logout.
export default function DashboardGate() {
  const [gateError, setGateError] = useState('');
  const check = async () => {
    setGateError('');
    const token = authToken();
    if (!token) { window.location.href = '/login'; return; }
    const me = await apiGet<{ role: string }>('/admin/me', true);
    if (me.data?.role === 'admin') window.location.href = '/admin';
    else if (me.data?.role === 'member') window.location.href = '/member';
    else if (me.error?.code === 'unauthenticated') window.location.href = '/login';
    else if (me.error?.code === 'account_not_active') setGateError('Your account has been deactivated. Contact an admin to reactivate it — signing in again will not help until then.');
    else setGateError(me.error?.message || 'Could not check your account. The backend may be temporarily unavailable — your sign-in has not been lost.');
  };
  useEffect(() => { check(); }, []);
  if (gateError) return (<div><h1>Checking your account</h1><ErrorBox message={gateError} />
    <p><button className="btn" onClick={check}>Try again</button>{' '}<a className="btn secondary" href="/login">Back to login</a></p>
    <p className="muted">If this keeps failing, the backend may be down. Signing in again will not help until it recovers.</p></div>);
  return (<div><h1>Checking your account</h1><Loading /></div>);
}
