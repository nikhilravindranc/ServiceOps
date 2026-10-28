import { Suspense } from "react";
import AssetDetail from "@/components/assets/AssetDetail";

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <AssetDetail assetId={Number(id)} />
    </Suspense>
  );
}
