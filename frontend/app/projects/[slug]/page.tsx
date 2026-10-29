import ProjectDetail from './detail';
export function generateStaticParams() { return [{ slug: 'sample-ai-showreel' }, { slug: 'sample-portfolio-site' }]; }
export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ProjectDetail slug={slug} />;
}
