"use client";
import { useLayout } from "@/components/LayoutContext";
import HomeClassic from "@/components/dashboard/HomeClassic";
import HomeCompact from "@/components/dashboard/HomeCompact";

/** Home. The two layouts show the same live data; Settings, Appearance chooses between them. */
export default function HomePage() {
  const { layout } = useLayout();
  return layout === "compact" ? <HomeCompact /> : <HomeClassic />;
}
