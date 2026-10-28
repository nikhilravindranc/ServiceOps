import { Suspense } from "react";
import InventoryView from "@/components/inventory/InventoryView";

export default function InventoryPage() {
  return (
    <Suspense>
      <InventoryView />
    </Suspense>
  );
}
