import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";

/**
 * GET /api/sales/detail?customer=X&year=2025&month=4&head=Detention
 * Returns invoice lines making up a single cell of the Monthly Trend table.
 * If `customer` is omitted, returns rows across all customers (used by the
 * ALL CUSTOMERS row in the table).
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const customer = searchParams.get("customer") || null;
  const year = parseInt(searchParams.get("year") || "0", 10);
  const month = parseInt(searchParams.get("month") || "0", 10);
  const head = searchParams.get("head") || "";

  if (!year || !month || !head) {
    return NextResponse.json(
      { error: "Missing year, month, or head" },
      { status: 400 }
    );
  }

  const filter: any = {
    year,
    month,
    revenueCategory: { $ne: "Credit Note" },
  };
  if (customer) filter.partyName = customer;

  // Bucket logic mirrors lib/trend.ts so cell totals match drill-down sums
  if (head === "Detention") filter.revenueHead = "Detention";
  else if (head === "Export") filter.revenueHead = "Export";
  else if (head === "M&R") filter.revenueHead = "M&R";
  else if (head === "Revenue") filter.revenueHead = { $in: ["Lease", "Other"] };
  else {
    return NextResponse.json({ error: "Invalid head" }, { status: 400 });
  }

  const db = await getDb();
  const rows = await db
    .collection("salesRegister")
    .find(filter, {
      projection: {
        invoiceDate: 1,
        invoiceNo: 1,
        invoiceType: 1,
        partyName: 1,
        chargeName: 1,
        pol: 1,
        pod: 1,
        qty: 1,
        rate: 1,
        chargeCurrency: 1,
        amountInChargeCurrency: 1,
        shipperName: 1,
        consigneeName: 1,
      },
    })
    .sort({ invoiceDate: -1 })
    .limit(500)
    .toArray();

  const totalAgg = await db
    .collection("salesRegister")
    .aggregate([
      { $match: filter },
      { $group: { _id: null, sum: { $sum: "$amountInChargeCurrency" }, n: { $sum: 1 } } },
    ])
    .toArray();

  return NextResponse.json({
    rows,
    total: totalAgg[0]?.sum || 0,
    count: totalAgg[0]?.n || 0,
    truncated: (totalAgg[0]?.n || 0) > 500,
  });
}
