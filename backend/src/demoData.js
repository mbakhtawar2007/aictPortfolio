// SAMPLE / DEMO DATA ONLY. Used only when FIREBASE_ENABLED !== 'true'.
// Every record is labelled SAMPLE and must never be presented as real
// group content. Production (Firebase) records never come from here.
export const demoSite = {
  group_name: 'SAMPLE AICT Group (Demo)', tagline: 'A sample team portfolio — demo data only',
  mission: 'SAMPLE: This mission text is placeholder demo content for local testing.',
  about: 'SAMPLE: Replace this with the real group story before launch.',
  email: '', logo_url: '', hero_video_url: '', isSample: true,
};
export const demoMembers = [
  { id: 'sample-member-1', slug: 'sample-ayesha-khan', full_name: 'SAMPLE Ayesha Khan', role_title: 'Sample AI Video Creator',
    short_intro: 'SAMPLE: Creates short AI videos.', bio: 'SAMPLE bio — not a real person record.',
    photo_url: '', cover_url: '', location: 'Sample City', availability: 'Open to projects',
    resume_path: '', resume_is_public: false, contact_email: '', contact_email_is_public: false,
    status: 'published', sort_order: 1, isSample: true,
    skills: [{ name: 'Video Editing', category: 'Creative', level: 80 }, { name: 'React', category: 'Technical', level: 70 }],
    education: [{ institution: 'Sample University', degree: 'BSc', field: 'Computer Science', start_date: '2023-01-01', end_date: '', description: 'SAMPLE' }],
    experience: [{ organization: 'Sample Studio', role: 'Creator', start_date: '2024-01-01', end_date: '', description: 'SAMPLE' }],
    links: [{ type: 'github', label: 'GitHub', url: 'https://github.com' }] },
  { id: 'sample-member-2', slug: 'sample-ali-raza', full_name: 'SAMPLE Ali Raza', role_title: 'Sample Web Developer',
    short_intro: 'SAMPLE: Builds portfolio websites.', bio: 'SAMPLE bio — not a real person record.',
    photo_url: '', cover_url: '', location: 'Sample City', availability: 'Open to projects',
    resume_path: '', resume_is_public: false, contact_email: '', contact_email_is_public: false,
    status: 'published', sort_order: 2, isSample: true,
    skills: [{ name: 'Next.js', category: 'Technical', level: 85 }],
    education: [], experience: [], links: [] },
  { id: 'sample-member-draft', slug: 'sample-draft-member', full_name: 'SAMPLE Draft Member', role_title: 'Draft (must not appear publicly)',
    short_intro: '', bio: '', photo_url: '', cover_url: '', location: '', availability: '',
    resume_path: '', resume_is_public: false, contact_email: '', contact_email_is_public: false,
    status: 'draft', sort_order: 3, isSample: true, skills: [], education: [], experience: [], links: [] },
];
export const demoProjects = [
  { id: 'sample-project-1', slug: 'sample-ai-showreel', title: 'SAMPLE AI Showreel', tagline: 'SAMPLE: A demo AI video project.',
    description: 'SAMPLE description only.', case_study: '', category: 'AI Video', tech_stack: ['React'], tools_used: ['Sample Tool'],
    cover_url: '', video_url: '', repo_url: '', live_url: '', year: 2026, featured: true, status: 'published', sort_order: 1, isSample: true, member_ids: ['sample-member-1'] },
  { id: 'sample-project-2', slug: 'sample-portfolio-site', title: 'SAMPLE Portfolio Site', tagline: 'SAMPLE: A demo website project.',
    description: 'SAMPLE description only.', case_study: '', category: 'Website', tech_stack: ['Next.js'], tools_used: [],
    cover_url: '', video_url: '', repo_url: '', live_url: '', year: 2026, featured: false, status: 'published', sort_order: 2, isSample: true, member_ids: ['sample-member-2'] },
];
export const demoAchievements = [
  { id: 'sample-ach-1', title: 'SAMPLE Certificate', issuer: 'Sample Issuer', type: 'certificate', date: '2026-01-01',
    description: 'SAMPLE achievement — not a real credential.', credential_url: '', image_path: '', featured: true, member_id: 'sample-member-1', isSample: true },
];
