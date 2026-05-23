import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { readSheet } from "@/lib/google-sheets";
import { mapRevenueCategory, mapRevenueHead, isTotalsRow } from "@/lib/mappings";
import { parseSheetDate, toNumber } from "@/lib/utils";
import type { SalesRow, SyncLog } from "@/types";

const SHEET_NAME = "Sales Register";
const HEADER_ROW_INDEX = 1; // row 2 in sheet (zero-indexed)

/**
 * Sync Sales Register sheet to MongoDB.
 * Auth: either user session OR cron secret in header.
 */
async function authorize(req: NextRequest): Promise<boolean> {
  const cronHeader = req.headers.get("authorization");
  if (cronHeader === `Bearer ${process.env.CRON_SECRET}`) return true;
  const session = await auth();
  return !!session?.user?.email;
}

export async function POST(req: NextRequest) {
  return handleSync(req);
}

export async function GET(req: NextRequest) {
  // Allow GET for Vercel Cron (sends bearer token)
  return handleSync(req);
}

async function handleSync(req: NextRequest) {
  const t0 = Date.now();

  if (!(await authorize(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const log: SyncLog = {
    sheetName: SHEET_NAME,
    syncedAt: new Date(),
    rowsRead: 0,
    rowsInserted: 0,
    status: "success",
    durationMs: 0,
  };

  try {
    const rows = await readSheet(SHEET_NAME);
    log.rowsRead = Math.max(0, rows.length - (HEADER_ROW_INDEX + 1));

    if (rows.length <= HEADER_ROW_INDEX + 1) {
      throw new Error("No data rows found");
    }

    const headers = rows[HEADER_ROW_INDEX].map((h) =>
      String(h || "").trim()
    );
    const idx = (label: string) => headers.indexOf(label);

    const cols = {
      invoiceType: idx("Invoice Type"),
      invoiceNo: idx("Invoice No"),
      invoiceDate: idx("Invoice Data"), // sheet has typo "Data"
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
      invoiceExchRate: idx("Invoice Exchage Rate"), // sheet has typo "Exchage"
      amountInLocalCurrency: idx("Amount in Local Currency"),
    };

    const docs: SalesRow[] = [];
    for (let r = HEADER_ROW_INDEX + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      if (isTotalsRow(row[cols.invoiceType])) continue;
      if (!row[cols.invoiceNo]) continue; // skip empty rows

      const invoiceType = String(row[cols.invoiceType] || "").trim();
      const chargeName = String(row[cols.chargeName] || "").trim();
      const invoiceDate = parseSheetDate(row[cols.invoiceDate]);

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
        revenueHead: mapRevenueHead(chargeName),
        year: invoiceDate ? invoiceDate.getUTCFullYear() : null,
        month: invoiceDate ? invoiceDate.getUTCMonth() + 1 : null,
        syncedAt: new Date(),
      });
    }

    const db = await getDb();
    // Full replace strategy: simpler and safe for hourly sync
    await db.collection("salesRegister").deleteMany({});
    if (docs.length) await db.collection("salesRegister").insertMany(docs);

    // Helpful indexes
    await db.collection("salesRegister").createIndex({ invoiceDate: -1 });
    await db.collection("salesRegister").createIndex({ partyName: 1 });
    await db.collection("salesRegister").createIndex({ revenueCategory: 1 });
    await db.collection("salesRegister").createIndex({ revenueHead: 1 });
    await db.collection("salesRegister").createIndex({ year: 1, month: 1 });

    log.rowsInserted = docs.length;
  } catch (err: any) {
    log.status = "error";
    log.errorMsg = err?.message || String(err);
  } finally {
    log.durationMs = Date.now() - t0;
    try {
      const db = await getDb();
      await db.collection("syncLogs").insertOne(log);
    } catch {
      /* swallow */
    }
  }

  return NextResponse.json(log, { status: log.status === "success" ? 200 : 500 });
}
