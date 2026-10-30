import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '../styles/globals.css';
import { Navbar, Footer, BackToTop } from '../components/layout';
import SmoothScroll from '../components/SmoothScroll';
import AmbientCanvasLoader from '../components/Scene/AmbientCanvasLoader';
export const metadata: Metadata = { title: 'AICT Group Portfolio', description: 'The AICT group: who we are, what we build, and what we have achieved.' };
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('aict_theme')||'light';document.documentElement.setAttribute('data-theme',t);if(localStorage.getItem('aict_reduce')==='true'){document.documentElement.setAttribute('data-reduce','true');}}catch(e){}})();`;
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en"><body>
      <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      <SmoothScroll />
      <AmbientCanvasLoader />
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <Navbar />
      <main id="main-content">{children}</main>
      <Footer />
      <BackToTop />
      <a className="mobile-contact-fab" href="/contact" aria-label="Contact the group">Contact</a>
    </body></html>
  );
}
