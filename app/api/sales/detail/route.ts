import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = new URL(req.url).searchParams;
  const customer = sp.get("customer") || null;
  const pol = sp.get("pol") || null;
  const pod = sp.get("pod") || null;
  const year = parseInt(sp.get("year") || "0", 10);
  const month = parseInt(sp.get("month") || "0", 10);
  const head = sp.get("head") || "";
  const bucket = sp.get("bucket") || null;
  const chargeName = sp.get("chargeName") || null;
  const level = sp.get("level") || "primary";

  if (!year || !month) {
    return NextResponse.json({ error: "Missing year or month" }, { status: 400 });
  }

  const filter: any = {
    year,
    month,
    revenueCategory: { $ne: "Credit Note" },
  };
  if (customer) filter.partyName = customer;
  if (pol) filter.pol = pol;
  if (pod) filter.pod = pod;

  // Apply head/bucket/charge filtering matching the row that was clicked
  if (level === "detail" && chargeName) {
    filter.chargeName = chargeName;
    if (bucket) filter.revenueHead = bucket;
  } else if (level === "subtotal" && bucket) {
    filter.revenueHead = bucket;
  } else if (head === "Revenue") {
    filter.revenueHead = { $in: ["Lease", "Other"] };
  } else if (head === "Detention" || head === "Export" || head === "M&R") {
    filter.revenueHead = head;
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
