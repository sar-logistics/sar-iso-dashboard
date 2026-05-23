import { getDb } from "@/lib/mongodb";
import type { MonthlyTrendData, CustomerBlock, MetricRow } from "@/app/dashboard/_components/MonthlyTrendTable";

const HEADS = ["Revenue", "Detention", "Export", "M&R"] as const;
type Head = (typeof HEADS)[number];

/** Buckets a charge's revenueHead into one of the table's metric rows. */
function bucket(revenueHead: string, revenueCategory: string): Head | null {
  // Skip credit notes from the trend (they're surfaced separately in KPIs)
  if (revenueCategory === "Credit Note") return null;
  if (revenueHead === "Detention") return "Detention";
  if (revenueHead === "Export") return "Export";
  if (revenueHead === "M&R") return "M&R";
  return "Revenue"; // Lease + Other go into the primary Revenue line
}

function monthKey(y: number, m: number) {
  return `${y}-${String(m).padStart(2, "0")}`;
}

function monthLabel(y: number, m: number) {
  const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const yy = String(y).slice(-2);
  return `${MONTHS[m - 1]} '${yy}`;
}

/** Build the past-12-months window ending at the latest month in the data. */
function buildMonthList(maxYear: number, maxMonth: number) {
  const list: { key: string; label: string; year: number; month: number }[] = [];
  let y = maxYear, m = maxMonth - 11;
  while (m <= 0) { m += 12; y -= 1; }
  for (let i = 0; i < 12; i++) {
    list.push({ key: monthKey(y, m), label: monthLabel(y, m), year: y, month: m });
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return list;
}

export async function buildMonthlyTrend(topN = 10): Promise<MonthlyTrendData> {
  const db = await getDb();
  const col = db.collection("salesRegister");

  // 1. Find date range
  const dr = await col
    .aggregate([
      { $match: { year: { $ne: null }, month: { $ne: null } } },
      {
        $group: {
          _id: null,
          maxYM: {
            $max: {
              $add: [{ $multiply: ["$year", 100] }, "$month"],
            },
          },
        },
      },
    ])
    .toArray();

  if (!dr.length) {
    const empty: MonthlyTrendData = {
      months: [],
      rows: [],
      grandTotal: { customer: "ALL", metrics: emptyMetrics([]) },
    };
    return empty;
  }

  const maxYM = dr[0].maxYM as number;
  const maxYear = Math.floor(maxYM / 100);
  const maxMonth = maxYM % 100;
  const months = buildMonthList(maxYear, maxMonth);
  const monthKeys = new Set(months.map((m) => m.key));

  // 2. Aggregate: customer × month × head
  const agg = await col
    .aggregate([
      {
        $match: {
          year: { $ne: null },
          month: { $ne: null },
          partyName: { $ne: "" },
        },
      },
      {
        $group: {
          _id: {
            customer: "$partyName",
            year: "$year",
            month: "$month",
            head: "$revenueHead",
            category: "$revenueCategory",
          },
          total: { $sum: "$amountInChargeCurrency" },
        },
      },
    ])
    .toArray();

  // 3. Reshape: customer -> Head -> monthKey -> sum
  type CustomerData = Record<Head, { total: number; monthly: Record<string, number> }>;
  const byCustomer = new Map<string, CustomerData>();
  const customerTotals = new Map<string, number>();
  const grand: CustomerData = emptyCustomerData();

  for (const row of agg) {
    const id = row._id;
    const head = bucket(id.head, id.category);
    if (!head) continue;
    const mk = monthKey(id.year, id.month);
    if (!monthKeys.has(mk)) continue;

    const cust = id.customer as string;
    if (!byCustomer.has(cust)) byCustomer.set(cust, emptyCustomerData());
    const cd = byCustomer.get(cust)!;
    cd[head].total += row.total;
    cd[head].monthly[mk] = (cd[head].monthly[mk] || 0) + row.total;

    grand[head].total += row.total;
    grand[head].monthly[mk] = (grand[head].monthly[mk] || 0) + row.total;

    customerTotals.set(cust, (customerTotals.get(cust) || 0) + row.total);
  }

  // 4. Pick top N customers
  const topCustomers = [...customerTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([name]) => name);

  // 5. Convert to MetricRow structure
  const toMetrics = (cd: CustomerData): MetricRow[] =>
    HEADS.map((h) => ({
      label: h,
      total: cd[h].total,
      monthly: cd[h].monthly,
      isPrimary: h === "Revenue",
    }));

  return {
    months,
    rows: topCustomers.map((c) => ({
      customer: c,
      metrics: toMetrics(byCustomer.get(c)!),
    })),
    grandTotal: { customer: "ALL CUSTOMERS", metrics: toMetrics(grand) },
  };
}

function emptyCustomerData(): Record<Head, { total: number; monthly: Record<string, number> }> {
  return {
    Revenue: { total: 0, monthly: {} },
    Detention: { total: 0, monthly: {} },
    Export: { total: 0, monthly: {} },
    "M&R": { total: 0, monthly: {} },
  };
}

function emptyMetrics(months: { key: string }[]): MetricRow[] {
  return HEADS.map((h) => ({
    label: h,
    total: 0,
    monthly: Object.fromEntries(months.map((m) => [m.key, 0])),
    isPrimary: h === "Revenue",
  }));
}

export function monthRangeLabel(months: { label: string }[]): { from: string; to: string } {
  if (months.length === 0) return { from: "—", to: "—" };
  return { from: months[0].label, to: months[months.length - 1].label };
}
