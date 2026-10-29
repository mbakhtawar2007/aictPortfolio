import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '../styles/globals.css';
export const metadata: Metadata = { title: 'AICT Group Portfolio', description: 'The AICT group: who we are, what we build, and what we have achieved.' };
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en"><body>
      <nav className="nav">
        <a className="brand" href="/">AICT</a>
        <a href="/">Home</a><a href="/team">Team</a><a href="/projects">Projects</a>
        <a href="/achievements">Achievements</a><a href="/contact">Contact</a>
        <span style={{ marginLeft: 'auto' }}><a href="/admin/login">Admin</a></span>
      </nav>
      <main>{children}</main>
      <footer>AICT Group Portfolio — content is managed through the admin dashboard. No public sign-up: accounts are created by an admin only.</footer>
    </body></html>
  );
}
