import { Suspense } from "react";
import WorkOrderDetail from "@/components/workorders/WorkOrderDetail";

export default async function WorkOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <WorkOrderDetail woId={Number(id)} />
    </Suspense>
  );
}
