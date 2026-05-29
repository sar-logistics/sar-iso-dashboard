import { getDb } from "@/lib/mongodb";
import type {
  MonthlyTrendData,
  GroupBlock,
  MetricRow,
} from "@/app/dashboard/_components/MonthlyTrendTable";

const PRIMARY = "Revenue" as const;
const BUCKETS = ["Detention", "Export", "M&R"] as const;
type Bucket = (typeof BUCKETS)[number];

function bucketFor(revenueHead: string, revenueCategory: string): Bucket | "Revenue" | null {
  if (revenueCategory === "Credit Note") return null;
  if (revenueHead === "Detention") return "Detention";
  if (revenueHead === "Export") return "Export";
  if (revenueHead === "M&R") return "M&R";
  return "Revenue";
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

/**
 * Build the monthly trend pivot. Rows are grouped by either customer or trade lane.
 * Each group has metric rows: a primary "Revenue" row, then per-bucket subtotals
 * (Detention/Export/M&R) followed by charge-name detail rows.
 */
export async function buildMonthlyTrend(
  groupBy: GroupBy = "customer",
  topN = 10
): Promise<MonthlyTrendData> {
  const db = await getDb();
  const col = db.collection("salesRegister");

  // Date range
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

  // Aggregate: groupKey × month × chargeName × head × category
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
            head: "$revenueHead",
            category: "$revenueCategory",
          },
          total: { $sum: "$amountInChargeCurrency" },
        },
      },
    ])
    .toArray();

  // Reshape: groupKey -> bucket -> chargeName -> { total, monthly }
  type Cell = { total: number; monthly: Record<string, number> };
  type GroupData = {
    primary: Cell; // Revenue
    buckets: Record<Bucket, { subtotal: Cell; byCharge: Map<string, Cell> }>;
  };

  const newGroup = (): GroupData => ({
    primary: { total: 0, monthly: {} },
    buckets: {
      Detention: { subtotal: { total: 0, monthly: {} }, byCharge: new Map() },
      Export: { subtotal: { total: 0, monthly: {} }, byCharge: new Map() },
      "M&R": { subtotal: { total: 0, monthly: {} }, byCharge: new Map() },
    },
  });

  const byGroup = new Map<string, GroupData>();
  const groupTotals = new Map<string, number>();
  const grand = newGroup();

  const accumulateCell = (cell: Cell, mk: string, val: number) => {
    cell.total += val;
    cell.monthly[mk] = (cell.monthly[mk] || 0) + val;
  };

  for (const row of agg) {
    const id = row._id;
    const headBucket = bucketFor(id.head, id.category);
    if (!headBucket) continue;
    const mk = monthKey(id.year, id.month);
    if (!monthKeys.has(mk)) continue;

    const key = (id.groupKey as string) || "—";
    if (!byGroup.has(key)) byGroup.set(key, newGroup());
    const gd = byGroup.get(key)!;
    const val = row.total as number;

    if (headBucket === "Revenue") {
      accumulateCell(gd.primary, mk, val);
      accumulateCell(grand.primary, mk, val);
    } else {
      accumulateCell(gd.buckets[headBucket].subtotal, mk, val);
      accumulateCell(grand.buckets[headBucket].subtotal, mk, val);
      const chargeName = (id.chargeName as string) || "(Unspecified)";
      const m1 = gd.buckets[headBucket].byCharge;
      if (!m1.has(chargeName)) m1.set(chargeName, { total: 0, monthly: {} });
      accumulateCell(m1.get(chargeName)!, mk, val);
      const m2 = grand.buckets[headBucket].byCharge;
      if (!m2.has(chargeName)) m2.set(chargeName, { total: 0, monthly: {} });
      accumulateCell(m2.get(chargeName)!, mk, val);
    }

    groupTotals.set(key, (groupTotals.get(key) || 0) + val);
  }

  // Top N
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
    for (const b of BUCKETS) {
      const sub = gd.buckets[b].subtotal;
      if (sub.total === 0 && gd.buckets[b].byCharge.size === 0) continue;
      rows.push({
        label: b,
        total: sub.total,
        monthly: sub.monthly,
        level: "subtotal",
        bucket: b,
      });
      const sorted = [...gd.buckets[b].byCharge.entries()].sort(
        (a, c) => c[1].total - a[1].total
      );
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

// ─── Chart Data Builders (Phase 2D) ──────────────────────────────────────

export interface ChartData {
  tradeLaneTop10: { label: string; value: number }[];
  topCustomers: { label: string; value: number }[];
  revenueMix: { name: string; value: number }[];
  monthlyTrend: {
    month: string;
    Revenue: number;
    Detention: number;
    Export: number;
    "M&R": number;
  }[];
}

export async function buildChartData(): Promise<ChartData> {
  const db = await getDb();
  const col = db.collection("salesRegister");

  // Trade lanes top 10
  const tlAgg = await col
    .aggregate([
      { $match: { revenueCategory: { $ne: "Credit Note" } } },
      {
        $group: {
          _id: {
            $concat: [
              { $ifNull: ["$pol", "—"] },
              " → ",
              { $ifNull: ["$pod", "—"] },
            ],
          },
          total: { $sum: "$amountInChargeCurrency" },
        },
      },
      { $sort: { total: -1 } },
      { $limit: 10 },
    ])
    .toArray();

  // Top customers
  const custAgg = await col
    .aggregate([
      { $match: { revenueCategory: { $ne: "Credit Note" }, partyName: { $ne: "" } } },
      { $group: { _id: "$partyName", total: { $sum: "$amountInChargeCurrency" } } },
      { $sort: { total: -1 } },
      { $limit: 10 },
    ])
    .toArray();

  // Revenue Mix by category (Principal / Sub-Lease / M&R / Other) + by head (Detention / Export)
  const catAgg = await col
    .aggregate([
      { $match: { revenueCategory: { $ne: "Credit Note" } } },
      {
        $group: {
          _id: "$revenueCategory",
          total: { $sum: "$amountInChargeCurrency" },
        },
      },
    ])
    .toArray();

  const headAgg = await col
    .aggregate([
      { $match: { revenueCategory: { $ne: "Credit Note" } } },
      {
        $group: {
          _id: "$revenueHead",
          total: { $sum: "$amountInChargeCurrency" },
        },
      },
    ])
    .toArray();
  const headMap: Record<string, number> = {};
  for (const r of headAgg) headMap[r._id || "Other"] = r.total || 0;

  const revenueMix = [
    { name: "Principal", value: catAgg.find((c) => c._id === "Principal Revenue")?.total || 0 },
    { name: "Sub-Lease", value: catAgg.find((c) => c._id === "Sub-Lease Revenue")?.total || 0 },
    { name: "M&R", value: catAgg.find((c) => c._id === "M&R Revenue")?.total || 0 },
    { name: "Detention", value: headMap["Detention"] || 0 },
    { name: "Export", value: headMap["Export"] || 0 },
    { name: "Other", value: catAgg.find((c) => c._id === "Other Revenue")?.total || 0 },
  ];

  // Monthly trend (12 months)
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

  let monthlyTrend: ChartData["monthlyTrend"] = [];
  if (dr.length) {
    const maxYM = dr[0].maxYM as number;
    const months = buildMonthList(Math.floor(maxYM / 100), maxYM % 100);
    const monthMap = new Map<string, ChartData["monthlyTrend"][number]>();
    for (const m of months) {
      monthMap.set(m.key, {
        month: m.label,
        Revenue: 0,
        Detention: 0,
        Export: 0,
        "M&R": 0,
      });
    }

    const mAgg = await col
      .aggregate([
        {
          $match: {
            year: { $ne: null },
            month: { $ne: null },
            revenueCategory: { $ne: "Credit Note" },
          },
        },
        {
          $group: {
            _id: { y: "$year", m: "$month", head: "$revenueHead" },
            total: { $sum: "$amountInChargeCurrency" },
          },
        },
      ])
      .toArray();

    for (const row of mAgg) {
      const mk = `${row._id.y}-${String(row._id.m).padStart(2, "0")}`;
      const slot = monthMap.get(mk);
      if (!slot) continue;
      const head = row._id.head as string;
      if (head === "Detention") slot.Detention += row.total;
      else if (head === "Export") slot.Export += row.total;
      else if (head === "M&R") slot["M&R"] += row.total;
      else slot.Revenue += row.total;
    }

    monthlyTrend = months.map((m) => monthMap.get(m.key)!).filter(Boolean);
  }

  return {
    tradeLaneTop10: tlAgg.map((r) => ({ label: r._id as string, value: r.total })),
    topCustomers: custAgg.map((r) => ({ label: r._id as string, value: r.total })),
    revenueMix,
    monthlyTrend,
  };
}
