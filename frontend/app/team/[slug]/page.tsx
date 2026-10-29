import MemberDetail from './detail';
export function generateStaticParams() { return [{ slug: 'sample-ayesha-khan' }, { slug: 'sample-ali-raza' }]; }
export default async function MemberPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <MemberDetail slug={slug} />;
}
