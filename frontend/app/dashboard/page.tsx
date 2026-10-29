'use client';
import { useEffect } from 'react';
import { apiGet } from '../../lib/api';
import { Loading } from '../shared';

// Role gate after login: admins go to /admin, members go to their own
// page (/member) and never see the admin dashboard.
export default function DashboardGate() {
  useEffect(() => {
    (async () => {
      const token = window.localStorage.getItem('aict_admin_token');
      if (!token) { window.location.href = '/admin/login'; return; }
      const me = await apiGet<{ role: string }>('/admin/me', true);
      if (me.data?.role === 'admin') window.location.href = '/admin';
      else if (me.data?.role === 'member') window.location.href = '/member';
      else window.location.href = '/admin/login';
    })();
  }, []);
  return <Loading />;
}
