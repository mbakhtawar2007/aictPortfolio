// Demo profiles shown on PUBLIC pages only, and only while the live
// database has no real content yet. This is display fallback, not stored
// data: nothing here is written to Firestore, the admin dashboard still
// shows the true (empty) database, and the moment a real member, project
// or achievement exists, the matching demo list is replaced by the real
// one in full. Admin pages never use this module.
import type { Member, Project, Achievement, SiteSettings } from './types';

export const sampleSite: SiteSettings = {
  group_name: 'AICT Group',
  tagline: 'We build AI videos, websites and creative projects.',
  mission: 'AICT is a student team that turns ideas into working products: short AI videos, useful web apps and creative projects, built and documented in the open.',
  about: 'The team works across AI video creation, web development and design. Every member has a public profile, every project has a page, and every achievement is listed with its issuer.',
  email: '',
  logo_url: '',
  hero_video_url: '',
};

export const sampleMembers: Member[] = [
  {
    id: 'demo-member-1', slug: 'ayesha-khan', full_name: 'Ayesha Khan', role_title: 'AI Video Creator',
    short_intro: 'Creates short AI videos and visual stories for the team.',
    bio: 'Ayesha leads the team’s AI video work, from script and storyboard to the final cut. She has produced showreels, event highlights and explainer videos, and she documents each project so new members can learn the workflow.',
    photo_url: '', cover_url: '', location: 'Karachi, Pakistan', availability: 'Open to projects',
    resume_path: '', resume_is_public: false, contact_email: '', contact_email_is_public: false,
    status: 'published', sort_order: 1, is_leader: true,
    skills: [
      { name: 'Video Editing', category: 'Creative', level: 85 },
      { name: 'AI Video Tools', category: 'Technical', level: 80 },
      { name: 'Storyboarding', category: 'Creative', level: 75 },
    ],
    education: [{ institution: 'Dawood University of Engineering & Technology', degree: 'BS', field: 'Computer Science', start_date: '2022-01-01', end_date: '2026-01-01', description: 'Focused on multimedia, graphics and applied AI.' }],
    experience: [{ organization: 'Independent', role: 'Video Creator', start_date: '2024-01-01', end_date: '', description: 'Produces short videos for student events and societies.' }],
    links: [{ type: 'github', label: 'GitHub', url: 'https://github.com' }],
  },
  {
    id: 'demo-member-2', slug: 'ali-raza', full_name: 'Ali Raza', role_title: 'Web Developer',
    short_intro: 'Builds fast, clean websites and web apps.',
    bio: 'Ali builds the team’s websites, from the first layout to deployment. He works mainly with React and Next.js and cares about pages that load fast and work well on phones.',
    photo_url: '', cover_url: '', location: 'Karachi, Pakistan', availability: 'Open to projects',
    resume_path: '', resume_is_public: false, contact_email: '', contact_email_is_public: false,
    status: 'published', sort_order: 2,
    skills: [
      { name: 'Next.js', category: 'Technical', level: 85 },
      { name: 'React', category: 'Technical', level: 88 },
      { name: 'TypeScript', category: 'Technical', level: 80 },
    ],
    education: [{ institution: 'Dawood University of Engineering & Technology', degree: 'BS', field: 'Software Engineering', start_date: '2021-01-01', end_date: '2025-01-01', description: 'Focused on web engineering and databases.' }],
    experience: [{ organization: 'Tech Studio', role: 'Junior Web Developer', start_date: '2025-01-01', end_date: '', description: 'Builds marketing sites and dashboards for small clients.' }],
    links: [{ type: 'github', label: 'GitHub', url: 'https://github.com' }],
  },
  {
    id: 'demo-member-3', slug: 'fatima-noor', full_name: 'Fatima Noor', role_title: 'UI/UX Designer',
    short_intro: 'Designs clear, friendly interfaces for web and mobile.',
    bio: 'Fatima designs the interfaces behind the team’s projects, from wireframes to finished screens. She runs small usability checks with real users before a design is approved.',
    photo_url: '', cover_url: '', location: 'Karachi, Pakistan', availability: 'Open to projects',
    resume_path: '', resume_is_public: false, contact_email: '', contact_email_is_public: false,
    status: 'published', sort_order: 3,
    skills: [
      { name: 'Figma', category: 'Design', level: 90 },
      { name: 'UI Design', category: 'Design', level: 88 },
      { name: 'Prototyping', category: 'Design', level: 80 },
    ],
    education: [{ institution: 'Dawood University of Engineering & Technology', degree: 'BS', field: 'Computer Science', start_date: '2021-01-01', end_date: '2025-01-01', description: 'Focused on human-computer interaction and visual design.' }],
    experience: [{ organization: 'Creative Agency', role: 'Design Intern', start_date: '2024-01-01', end_date: '2025-01-01', description: 'Designed landing pages and social media kits.' }],
    links: [{ type: 'linkedin', label: 'LinkedIn', url: 'https://linkedin.com' }],
  },
  {
    id: 'demo-member-4', slug: 'hassan-ahmed', full_name: 'Hassan Ahmed', role_title: 'AI Developer',
    short_intro: 'Builds practical AI tools and chatbots.',
    bio: 'Hassan builds the team’s AI features: chat assistants, summarizers and small automation tools. He works in Python and ships each tool with a simple API and clear documentation.',
    photo_url: '', cover_url: '', location: 'Karachi, Pakistan', availability: 'Open to projects',
    resume_path: '', resume_is_public: false, contact_email: '', contact_email_is_public: false,
    status: 'published', sort_order: 4,
    skills: [
      { name: 'Python', category: 'Technical', level: 90 },
      { name: 'Machine Learning', category: 'Technical', level: 82 },
      { name: 'FastAPI', category: 'Technical', level: 78 },
    ],
    education: [{ institution: 'Dawood University of Engineering & Technology', degree: 'BS', field: 'Artificial Intelligence', start_date: '2022-01-01', end_date: '2026-01-01', description: 'Focused on applied machine learning and APIs.' }],
    experience: [{ organization: 'AI Lab', role: 'AI Intern', start_date: '2025-01-01', end_date: '', description: 'Builds and evaluates small language-model tools.' }],
    links: [{ type: 'github', label: 'GitHub', url: 'https://github.com' }],
  },
];

export const sampleProjects: Project[] = [
  {
    id: 'demo-project-1', slug: 'ai-showreel-2026', title: 'AI Showreel 2026', tagline: 'A 60-second showreel of the team’s AI video work.',
    description: 'A fast-paced showreel cut from the team’s AI-generated clips, assembled to show range: portraits, landscapes, product shots and motion graphics.',
    case_study: 'The team generated clips with AI video tools, selected the strongest twelve, and edited them to music with a consistent grade. The final video is used at events and in the team’s introduction.',
    category: 'AI Video', tech_stack: ['AI Video Tools', 'After Effects'], tools_used: ['Premiere Pro'],
    cover_url: '', video_url: '', repo_url: '', live_url: '', year: 2026, featured: true, status: 'published', sort_order: 1, member_ids: ['demo-member-1'],
  },
  {
    id: 'demo-project-2', slug: 'team-portfolio-website', title: 'Team Portfolio Website', tagline: 'This portfolio site: team profiles, projects and achievements.',
    description: 'The public portfolio for the team, with member profiles, project pages, an achievements list and a contact form, plus an admin dashboard for managing it all.',
    case_study: 'Built with Next.js as a static site and an Express API backed by Firestore. Content updates go live on the next page load, with no rebuild step.',
    category: 'Website', tech_stack: ['Next.js', 'TypeScript'], tools_used: ['Vercel', 'Netlify'],
    cover_url: '', video_url: '', repo_url: '', live_url: '', year: 2026, featured: true, status: 'published', sort_order: 2, member_ids: ['demo-member-2'],
  },
  {
    id: 'demo-project-3', slug: 'campus-ai-assistant', title: 'Campus AI Assistant', tagline: 'A chatbot that answers common campus questions.',
    description: 'A small assistant that answers questions about schedules, societies and campus services, with sources for every answer.',
    case_study: 'Built as a FastAPI service with a curated campus knowledge base. Answers stay short and cite their source, and unknown questions are handed to a human.',
    category: 'AI Tool', tech_stack: ['Python', 'FastAPI'], tools_used: ['OpenAI API'],
    cover_url: '', video_url: '', repo_url: '', live_url: '', year: 2025, featured: false, status: 'published', sort_order: 3, member_ids: ['demo-member-4'],
  },
  {
    id: 'demo-project-4', slug: 'event-brand-kit', title: 'Event Brand Kit', tagline: 'Posters, tickets and social graphics for a tech fest.',
    description: 'A complete visual kit for a two-day tech festival: posters, tickets, stage screens and a social media set, all in one consistent style.',
    case_study: 'Designed in Figma from a single type and colour system, then exported for print and screens. The kit was reused by the next year’s organizing team.',
    category: 'Other', tech_stack: ['Figma'], tools_used: ['Illustrator'],
    cover_url: '', video_url: '', repo_url: '', live_url: '', year: 2025, featured: false, status: 'published', sort_order: 4, member_ids: ['demo-member-3'],
  },
];

export const sampleAchievements: Achievement[] = [
  {
    id: 'demo-ach-1', title: 'Best AI Video Award', issuer: 'University Tech Fest', type: 'award', date: '2025-11-15',
    description: 'First place for the team showreel in the AI video category, judged on originality, editing and sound.',
    credential_url: '', image_path: '', featured: true, member_id: 'demo-member-1',
  },
  {
    id: 'demo-ach-2', title: 'Front-End Developer Certificate', issuer: 'Coursera', type: 'certificate', date: '2025-06-01',
    description: 'Completed the front-end developer professional track, covering React, responsive design and testing.',
    credential_url: '', image_path: '', featured: false, member_id: 'demo-member-2',
  },
  {
    id: 'demo-ach-3', title: 'UI/UX Design Competition Winner', issuer: 'Design Society', type: 'competition', date: '2025-03-20',
    description: 'Won the inter-university UI design challenge with a campus transport app concept.',
    credential_url: '', image_path: '', featured: false, member_id: 'demo-member-3',
  },
];
