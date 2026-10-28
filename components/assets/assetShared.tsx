"use client";
import type { PillTone } from "@/components/ui/ServiceOpsUI";
import type { AssetStatus, WarrantyState, StockState } from "@/lib/serviceData";

export const ASSET_STATUS_TONE: Record<AssetStatus, PillTone> = {
  "Operational": "green",
  "Under service": "blue",
  "Needs attention": "amber",
  "Out of service": "red",
};

export const WARRANTY_TONE: Record<WarrantyState, PillTone> = { "In warranty": "green", "Expiring soon": "amber", "Expired": "gray" };

export const STOCK_TONE: Record<StockState, PillTone> = { "In stock": "green", "Low stock": "amber", "Short for jobs": "red", "Out of stock": "red" };
