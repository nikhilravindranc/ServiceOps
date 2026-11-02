import TechJob from "@/components/tech/TechJob";

export default async function TechJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TechJob id={Number(id)} />;
}
