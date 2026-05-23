// Shared types for the dashboard

export type RevenueCategory =
  | "Principal Revenue"
  | "Sub-Lease Revenue"
  | "M&R Revenue"
  | "Other Revenue"
  | "Credit Note";

export type RevenueHead = "Lease" | "Detention" | "Export" | "M&R" | "Other";

export type TankStatus =
  | "Available"
  | "Under M&R"
  | "Under Cleaning"
  | "Under Inspection"
  | "On Lease"
  | "In Transit / Deployed"
  | "Repositioning"
  | "Unknown";

export interface SalesRow {
  invoiceType: string;
  invoiceNo: string;
  invoiceDate: Date | null;
  partyName: string;
  gstinNo: string;
  shipperName: string;
  consigneeName: string;
  vessel: string;
  voyage: string;
  chargeName: string;
  blNo: string;
  pol: string;
  pod: string;
  qty: number;
  rate: number;
  chargeCurrency: string;
  chargeExchRate: number;
  amountInChargeCurrency: number;
  invoiceCurrency: string;
  amountInInvoiceCurrency: number;
  invoiceExchRate: number;
  amountInLocalCurrency: number;
  // derived
  revenueCategory: RevenueCategory;
  revenueHead: RevenueHead;
  year: number | null;
  month: number | null;
  syncedAt: Date;
}

export interface SyncLog {
  sheetName: string;
  syncedAt: Date;
  rowsRead: number;
  rowsInserted: number;
  status: "success" | "error";
  errorMsg?: string;
  durationMs: number;
}
