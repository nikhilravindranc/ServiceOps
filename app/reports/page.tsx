import { Suspense } from "react";
import ServiceReports from "@/components/reports/ServiceReports";

export default function ReportsPage() {
  return (
    <Suspense>
      <ServiceReports />
    </Suspense>
  );
}
