import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { readSheet } from "@/lib/google-sheets";
import { mapRevenueCategory, isTotalsRow } from "@/lib/mappings";
import { parseSheetDate, toNumber } from "@/lib/utils";
import type { SyncLog } from "@/types";

const SALES_SHEET = "Sales Register";
const MAPPING_SHEET = "Charge to Revenue Type Mapping";
const SALES_HEADER_ROW = 1; // 0-indexed; data starts at row 2

async function authorize(req: NextRequest): Promise<boolean> {
  const cronHeader = req.headers.get("authorization");
  if (cronHeader === `Bearer ${process.env.CRON_SECRET}`) return true;
  const session = await auth();
  return !!session?.user?.email;
}

export async function POST(req: NextRequest) { return handleSync(req); }
export async function GET(req: NextRequest) { return handleSync(req); }

/**
 * Build the Charge Name → Revenue Category map by reading the
 * "Charge to Revenue Type Mapping" sheet and upserting into chargeMappings.
 */
async function syncChargeMappings(): Promise<Map<string, string>> {
  const rows = await readSheet(MAPPING_SHEET);
  if (rows.length < 2) throw new Error("Charge mapping sheet is empty");

  const headers = rows[0].map((h: any) => String(h || "").trim().toLowerCase());
  const chargeIdx = headers.findIndex((h: string) => h.includes("charge name"));
  const catIdx = headers.findIndex(
    (h: string) => h.includes("revenue category") || h.includes("category")
  );
  if (chargeIdx < 0 || catIdx < 0) {
    throw new Error(
      `Mapping sheet missing 'Charge Name' or 'Revenue Category' column`
    );
  }

  const map = new Map<string, string>();
  const docs: any[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const charge = String(row[chargeIdx] || "").trim();
    const cat = String(row[catIdx] || "").trim();
    if (!charge || !cat) continue;
    map.set(charge.toUpperCase(), cat);
    docs.push({ chargeName: charge, revenueCategory: cat, syncedAt: new Date() });
  }

  const db = await getDb();
  await db.collection("chargeMappings").deleteMany({});
  if (docs.length) await db.collection("chargeMappings").insertMany(docs);
  await db.collection("chargeMappings").createIndex({ chargeName: 1 });

  return map;
}

async function handleSync(req: NextRequest) {
  const t0 = Date.now();
  if (!(await authorize(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const log: SyncLog = {
    sheetName: SALES_SHEET,
    syncedAt: new Date(),
    rowsRead: 0,
    rowsInserted: 0,
    status: "success",
    durationMs: 0,
  };

  let mappingsCount = 0;

  try {
    // Step 0: sync charge mappings sheet
    const chargeMap = await syncChargeMappings();
    mappingsCount = chargeMap.size;

    // Step 1: read sales register
    const rows = await readSheet(SALES_SHEET);
    log.rowsRead = Math.max(0, rows.length - (SALES_HEADER_ROW + 1));
    if (rows.length <= SALES_HEADER_ROW + 1) throw new Error("No data rows in Sales Register");

    const headers = rows[SALES_HEADER_ROW].map((h: any) => String(h || "").trim());
    const idx = (label: string) => headers.indexOf(label);

    const cols = {
      invoiceType: idx("Invoice Type"),
      invoiceNo: idx("Invoice No"),
      invoiceDate: idx("Invoice Data"),
      partyName: idx("Party Name"),
      gstinNo: idx("GSTIN NO"),
      shipperName: idx("Shipper Name"),
      consigneeName: idx("Consignee Name"),
      vessel: idx("Vessel"),
      voyage: idx("Voyage"),
      chargeName: idx("Charge Name"),
      blNo: idx("BL No"),
      pol: idx("POL"),
      pod: idx("POD"),
      qty: idx("Qty"),
      rate: idx("Rate"),
      chargeCurrency: idx("Charge Currency"),
      chargeExchRate: idx("Charge Exch Rate"),
      amountInChargeCurrency: idx("Amount in Charge Currency"),
      invoiceCurrency: idx("Invoice Currency"),
      amountInInvoiceCurrency: idx("Amount in Invoice Currency"),
      invoiceExchRate: idx("Invoice Exchage Rate"),
      amountInLocalCurrency: idx("Amount in Local Currency"),
    };

    const docs: any[] = [];
    const unmappedSet = new Set<string>();

    for (let r = SALES_HEADER_ROW + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      if (isTotalsRow(row[cols.invoiceType])) continue;
      if (!row[cols.invoiceNo]) continue;

      const invoiceType = String(row[cols.invoiceType] || "").trim();
      const chargeName = String(row[cols.chargeName] || "").trim();
      const invoiceDate = parseSheetDate(row[cols.invoiceDate]);

      // Charge → Revenue Category lookup from mapping sheet
      const chargeRevenueCategory =
        chargeMap.get(chargeName.toUpperCase()) || "Unmapped";
      if (chargeRevenueCategory === "Unmapped" && chargeName) {
        unmappedSet.add(chargeName);
      }

      docs.push({
        invoiceType,
        invoiceNo: String(row[cols.invoiceNo] || "").trim(),
        invoiceDate,
        partyName: String(row[cols.partyName] || "").trim(),
        gstinNo: String(row[cols.gstinNo] || "").trim(),
        shipperName: String(row[cols.shipperName] || "").trim(),
        consigneeName: String(row[cols.consigneeName] || "").trim(),
        vessel: String(row[cols.vessel] || "").trim(),
        voyage: String(row[cols.voyage] || "").trim(),
        chargeName,
        blNo: String(row[cols.blNo] || "").trim(),
        pol: String(row[cols.pol] || "").trim(),
        pod: String(row[cols.pod] || "").trim(),
        qty: toNumber(row[cols.qty]),
        rate: toNumber(row[cols.rate]),
        chargeCurrency: String(row[cols.chargeCurrency] || "").trim(),
        chargeExchRate: toNumber(row[cols.chargeExchRate]),
        amountInChargeCurrency: toNumber(row[cols.amountInChargeCurrency]),
        invoiceCurrency: String(row[cols.invoiceCurrency] || "").trim(),
        amountInInvoiceCurrency: toNumber(row[cols.amountInInvoiceCurrency]),
        invoiceExchRate: toNumber(row[cols.invoiceExchRate]),
        amountInLocalCurrency: toNumber(row[cols.amountInLocalCurrency]),
        revenueCategory: mapRevenueCategory(invoiceType),
        chargeRevenueCategory,
        year: invoiceDate ? invoiceDate.getUTCFullYear() : null,
        month: invoiceDate ? invoiceDate.getUTCMonth() + 1 : null,
        syncedAt: new Date(),
      });
    }

    const db = await getDb();
    await db.collection("salesRegister").deleteMany({});
    if (docs.length) await db.collection("salesRegister").insertMany(docs);

    await db.collection("salesRegister").createIndex({ invoiceDate: -1 });
    await db.collection("salesRegister").createIndex({ partyName: 1 });
    await db.collection("salesRegister").createIndex({ revenueCategory: 1 });
    await db.collection("salesRegister").createIndex({ chargeRevenueCategory: 1 });
    await db.collection("salesRegister").createIndex({ year: 1, month: 1 });

    log.rowsInserted = docs.length;
    (log as any).mappingsLoaded = mappingsCount;
    if (unmappedSet.size > 0) {
      (log as any).unmappedCharges = [...unmappedSet];
    }
  } catch (err: any) {
    log.status = "error";
    log.errorMsg = err?.message || String(err);
  } finally {
    log.durationMs = Date.now() - t0;
    try {
      const db = await getDb();
      await db.collection("syncLogs").insertOne(log);
    } catch {}
  }

  return NextResponse.json(log, { status: log.status === "success" ? 200 : 500 });
}
