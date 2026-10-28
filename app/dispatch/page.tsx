import { Suspense } from "react";
import DispatchConsole from "@/components/dispatch/DispatchConsole";

export default function DispatchPage() {
  return (
    <Suspense>
      <DispatchConsole />
    </Suspense>
  );
}
