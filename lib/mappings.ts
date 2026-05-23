import type { RevenueCategory, RevenueHead, TankStatus } from "@/types";

/** Sales Invoice Type → Revenue Category bucket */
export function mapRevenueCategory(invoiceType: string): RevenueCategory {
  const t = (invoiceType || "").trim().toLowerCase();
  if (t.includes("principal") && t.includes("credit")) return "Credit Note";
  if (t.includes("principle") && t.includes("credit")) return "Credit Note";
  if (t.includes("principal")) return "Principal Revenue";
  if (t.includes("sub lease")) return "Sub-Lease Revenue";
  if (t.includes("m&r")) return "M&R Revenue";
  return "Other Revenue";
}

/** Sales Charge Name → Revenue Head bucket */
export function mapRevenueHead(chargeName: string): RevenueHead {
  const c = (chargeName || "").toUpperCase();
  if (c.includes("LEASE")) return "Lease";
  if (c.includes("DETENTION") || c.includes("DEM-")) return "Detention";
  if (c.includes("OCEAN FREIGHT") || c.includes("FREIGHT")) return "Export";
  if (c.includes("REPAIR") || c.includes("CLEANING") || c.includes("MAINTENANCE"))
    return "M&R";
  return "Other";
}

/** Current Inventory Activity Name → Tank Status (M&R module) */
export function mapTankStatus(activityName: string): TankStatus {
  const a = (activityName || "").toUpperCase().trim();
  if (a === "EMPTY AVAILABLE") return "Available";
  if (a === "UNDER REPAIR") return "Under M&R";
  if (a.includes("CLEANING") || a.includes("WASHING")) return "Under Cleaning";
  if (a === "SURVEY") return "Under Inspection";
  if (a.includes("SUB LEASE")) return "On Lease";
  if (
    a.includes("LOADED") ||
    a.includes("OUT TO SHIPPER") ||
    a.includes("SENT TO CONSIGNEE") ||
    a.includes("ALLOCATED")
  )
    return "In Transit / Deployed";
  if (a.includes("TRANSFER")) return "Repositioning";
  return "Unknown";
}

/** Detect filler/total rows in any sheet so we drop them at sync */
export function isTotalsRow(firstCell: any): boolean {
  if (!firstCell) return false;
  const s = String(firstCell).trim().toLowerCase();
  return s === "grand total" || s === "total" || s === "subtotal";
}
