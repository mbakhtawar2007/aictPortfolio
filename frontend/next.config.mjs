// Static export for Netlify CDN. No API routes, no server secrets here.
// The backend lives separately on Vercel; the browser calls it via
// NEXT_PUBLIC_API_URL (set at Netlify build time).
/** @type {import('next').NextConfig} */
const nextConfig = { output: 'export', images: { unoptimized: true } };
export default nextConfig;
