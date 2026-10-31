import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '../styles/globals.css';
import { Navbar, Footer, BackToTop, PageTitle } from '../components/layout';
import SmoothScroll from '../components/SmoothScroll';
import CosmicBackgroundLoader from '../components/Scene/CosmicBackgroundLoader';
import TokenRefresher from '../components/TokenRefresher';
export const metadata: Metadata = {
  title: 'TechHive',
  description: 'TechHive: who we are, what we build, and what we have achieved.',
  icons: {
    // SVG only: the repo snapshot push cannot carry binary files, and the
    // file API stores base64 text literally, so no binary ICO/PNG is
    // shipped. Modern browsers use this SVG tab icon.
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    shortcut: '/favicon.svg',
  },
};
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('aict_theme')||'dark';document.documentElement.setAttribute('data-theme',t);if(localStorage.getItem('aict_reduce')==='true'){document.documentElement.setAttribute('data-reduce','true');}}catch(e){}})();`;
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en"><body>
      <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      <SmoothScroll />
      <PageTitle />
      <CosmicBackgroundLoader />
      <TokenRefresher />
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <Navbar />
      <main id="main-content">{children}</main>
      <Footer />
      <BackToTop />
      <a className="mobile-contact-fab" href="/contact" aria-label="Contact the group">Contact</a>
    </body></html>
  );
}
