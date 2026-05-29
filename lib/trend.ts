import { getDb } from "@/lib/mongodb";
import type {
  MonthlyTrendData,
  GroupBlock,
  MetricRow,
} from "@/app/dashboard/_components/MonthlyTrendTable";

const PRIMARY = "Revenue" as const;
const BUCKETS = ["Lease", "Detention", "EXIM", "M&R"] as const;
type Bucket = (typeof BUCKETS)[number];

/**
 * Bucket a row using its charge-revenue-category (from sheet mapping).
 * Excludes credit notes.
 */
function bucketFor(
  chargeCategory: string,
  invoiceCategory: string
): Bucket | "Other" | null {
  if (invoiceCategory === "Credit Note") return null;
  const c = (chargeCategory || "").trim();
  if (c === "Detention") return "Detention";
  if (c === "EXIM") return "EXIM";
  if (c === "M&R") return "M&R";
  if (c === "Lease") return "Lease";
  return "Other"; // unmapped charges
}

function monthKey(y: number, m: number) {
  return `${y}-${String(m).padStart(2, "0")}`;
}
function monthLabel(y: number, m: number) {
  const M = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return `${M[m - 1]} '${String(y).slice(-2)}`;
}
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

export type GroupBy = "customer" | "tradeLane";

export async function buildMonthlyTrend(
  groupBy: GroupBy = "customer",
  topN = 10
): Promise<MonthlyTrendData> {
  const db = await getDb();
  const col = db.collection("salesRegister");

  const dr = await col
    .aggregate([
      { $match: { year: { $ne: null }, month: { $ne: null } } },
      {
        $group: {
          _id: null,
          maxYM: { $max: { $add: [{ $multiply: ["$year", 100] }, "$month"] } },
        },
      },
    ])
    .toArray();

  if (!dr.length) {
    return { months: [], rows: [], grandTotal: emptyGroup("ALL") };
  }
  const maxYM = dr[0].maxYM as number;
  const months = buildMonthList(Math.floor(maxYM / 100), maxYM % 100);
  const monthKeys = new Set(months.map((m) => m.key));

  const groupKeyExpr =
    groupBy === "tradeLane"
      ? {
          $concat: [
            { $ifNull: ["$pol", "—"] },
            " → ",
            { $ifNull: ["$pod", "—"] },
          ],
        }
      : "$partyName";

  const agg = await col
    .aggregate([
      {
        $match: {
          year: { $ne: null },
          month: { $ne: null },
          ...(groupBy === "customer" ? { partyName: { $ne: "" } } : {}),
        },
      },
      {
        $group: {
          _id: {
            groupKey: groupKeyExpr,
            year: "$year",
            month: "$month",
            chargeName: "$chargeName",
            chargeCategory: "$chargeRevenueCategory",
            invoiceCategory: "$revenueCategory",
          },
          total: { $sum: "$amountInChargeCurrency" },
        },
      },
    ])
    .toArray();

  type Cell = { total: number; monthly: Record<string, number> };
  type GroupData = {
    primary: Cell;
    buckets: Record<string, { subtotal: Cell; byCharge: Map<string, Cell> }>;
  };

  const newGroup = (): GroupData => ({
    primary: { total: 0, monthly: {} },
    buckets: {
      Lease: { subtotal: { total: 0, monthly: {} }, byCharge: new Map() },
      Detention: { subtotal: { total: 0, monthly: {} }, byCharge: new Map() },
      EXIM: { subtotal: { total: 0, monthly: {} }, byCharge: new Map() },
      "M&R": { subtotal: { total: 0, monthly: {} }, byCharge: new Map() },
      Other: { subtotal: { total: 0, monthly: {} }, byCharge: new Map() },
    },
  });

  const byGroup = new Map<string, GroupData>();
  const groupTotals = new Map<string, number>();
  const grand = newGroup();

  const acc = (cell: Cell, mk: string, v: number) => {
    cell.total += v;
    cell.monthly[mk] = (cell.monthly[mk] || 0) + v;
  };

  for (const row of agg) {
    const id = row._id;
    const headBucket = bucketFor(id.chargeCategory, id.invoiceCategory);
    if (!headBucket) continue;
    const mk = monthKey(id.year, id.month);
    if (!monthKeys.has(mk)) continue;

    const key = (id.groupKey as string) || "—";
    if (!byGroup.has(key)) byGroup.set(key, newGroup());
    const gd = byGroup.get(key)!;
    const val = row.total as number;

    // Always add to primary (Revenue) of the group
    acc(gd.primary, mk, val);
    acc(grand.primary, mk, val);

    // Add to bucket subtotal + chargewise
    acc(gd.buckets[headBucket].subtotal, mk, val);
    acc(grand.buckets[headBucket].subtotal, mk, val);

    const chargeName = (id.chargeName as string) || "(Unspecified)";
    const m1 = gd.buckets[headBucket].byCharge;
    if (!m1.has(chargeName)) m1.set(chargeName, { total: 0, monthly: {} });
    acc(m1.get(chargeName)!, mk, val);
    const m2 = grand.buckets[headBucket].byCharge;
    if (!m2.has(chargeName)) m2.set(chargeName, { total: 0, monthly: {} });
    acc(m2.get(chargeName)!, mk, val);

    groupTotals.set(key, (groupTotals.get(key) || 0) + val);
  }

  const topGroups = [...groupTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([k]) => k);

  const toMetrics = (gd: GroupData): MetricRow[] => {
    const rows: MetricRow[] = [];
    rows.push({
      label: PRIMARY,
      total: gd.primary.total,
      monthly: gd.primary.monthly,
      level: "primary",
    });
    const orderedBuckets: (Bucket | "Other")[] = ["Lease", "Detention", "EXIM", "M&R", "Other"];
    for (const b of orderedBuckets) {
      const node = gd.buckets[b];
      if (!node) continue;
      const sub = node.subtotal;
      if (sub.total === 0 && node.byCharge.size === 0) continue;
      rows.push({
        label: b,
        total: sub.total,
        monthly: sub.monthly,
        level: "subtotal",
        bucket: b,
      });
      const sorted = [...node.byCharge.entries()].sort((a, c) => c[1].total - a[1].total);
      for (const [chargeName, cell] of sorted) {
        if (cell.total === 0) continue;
        rows.push({
          label: chargeName,
          total: cell.total,
          monthly: cell.monthly,
          level: "detail",
          bucket: b,
          chargeName,
        });
      }
    }
    return rows;
  };

  return {
    months,
    rows: topGroups.map((k) => ({
      group: k,
      total: groupTotals.get(k) || 0,
      metrics: toMetrics(byGroup.get(k)!),
    })),
    grandTotal: {
      group: groupBy === "customer" ? "ALL CUSTOMERS" : "ALL TRADE LANES",
      total: [...groupTotals.values()].reduce((a, b) => a + b, 0),
      metrics: toMetrics(grand),
    },
  };
}

function emptyGroup(label: string): GroupBlock {
  return {
    group: label,
    total: 0,
    metrics: [{ label: PRIMARY, total: 0, monthly: {}, level: "primary" }],
  };
}

export function monthRangeLabel(months: { label: string }[]): { from: string; to: string } {
  if (months.length === 0) return { from: "—", to: "—" };
  return { from: months[0].label, to: months[months.length - 1].label };
}
