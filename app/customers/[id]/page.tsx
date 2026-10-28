import { Suspense } from "react";
import CustomerDetail from "@/components/customers/CustomerDetail";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <CustomerDetail customerId={decodeURIComponent(id)} />
    </Suspense>
  );
}
