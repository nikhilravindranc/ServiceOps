import { Suspense } from "react";
import ServiceSettings from "@/components/settings/ServiceSettings";

export default function SettingsPage() {
  return (
    <Suspense>
      <ServiceSettings />
    </Suspense>
  );
}
