import RequestDetail from "@/components/requests/RequestDetail";

export default async function RequestDetailPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  return <RequestDetail number={number} />;
}
