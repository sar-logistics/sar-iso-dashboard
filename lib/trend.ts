import { getDb } from "@/lib/mongodb";
import type {
  MonthlyTrendData,
  GroupBlock,
  MetricRow,
} from "@/app/dashboard/_components/MonthlyTrendTable";

const PRIMARY = "Revenue" as const;
const BUCKETS = ["Lease", "Detention", "EXIM", "M&R"] as const;
type Bucket = (typeof BUCKETS)[number];

export type ViewMode = "monthly" | "quarterly" | "yearly";
export type GroupBy = "customer" | "tradeLane";

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
  return "Other";
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function periodKey(view: ViewMode, year: number, month: number): string {
  switch (view) {
    case "monthly":
      return `${year}-${String(month).padStart(2, "0")}`;
    case "quarterly":
      return `${year}-Q${Math.ceil(month / 3)}`;
    case "yearly":
      return `${year}`;
  }
}
function periodLabel(view: ViewMode, year: number, month: number): string {
  const yy = String(year).slice(-2);
  switch (view) {
    case "monthly":
      return `${MONTHS[month - 1]} '${yy}`;
    case "quarterly":
      return `Q${Math.ceil(month / 3)} '${yy}`;
    case "yearly":
      return `FY ${year}`;
  }
}

function buildPeriodColumns(
  view: ViewMode,
  fromY: number,
  fromM: number,
  toY: number,
  toM: number
) {
  const cols: { key: string; label: string; year: number; month: number }[] = [];
  const seen = new Set<string>();
  let y = fromY, m = fromM;
  while (y < toY || (y === toY && m <= toM)) {
    const key = periodKey(view, y, m);
    if (!seen.has(key)) {
      seen.add(key);
      let labelY = y, labelM = m;
      if (view === "quarterly") labelM = (Math.ceil(m / 3) - 1) * 3 + 1;
      else if (view === "yearly") labelM = 1;
      cols.push({
        key,
        label: periodLabel(view, labelY, labelM),
        year: labelY,
        month: labelM,
      });
    }
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return cols;
}

interface BuildTrendOptions {
  view?: ViewMode;
  fromDate?: Date | null;
  toDate?: Date | null;
  topN?: number;
}

export async function buildMonthlyTrend(
  groupBy: GroupBy,
  topNOrOpts?: number | BuildTrendOptions
): Promise<MonthlyTrendData> {
  // Backwards-compatible signature
  let opts: BuildTrendOptions = {};
  if (typeof topNOrOpts === "number") {
    opts = { topN: topNOrOpts };
  } else if (topNOrOpts) {
    opts = topNOrOpts;
  }
  return buildPeriodTrend(groupBy, opts);
}

export async function buildPeriodTrend(
  groupBy: GroupBy,
  opts: BuildTrendOptions = {}
): Promise<MonthlyTrendData> {
  const { view = "monthly", fromDate, toDate, topN = 10 } = opts;
  const db = await getDb();
  const col = db.collection("salesRegister");

  // Determine date range
  let fromY: number, fromM: number, toY: number, toM: number;

  if (fromDate && toDate) {
    fromY = fromDate.getUTCFullYear();
    fromM = fromDate.getUTCMonth() + 1;
    toY = toDate.getUTCFullYear();
    toM = toDate.getUTCMonth() + 1;
  } else {
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
      return {
        months: [],
        rows: [],
        grandTotal: emptyGroup(
          groupBy === "customer" ? "ALL CUSTOMERS" : "ALL TRADE LANES"
        ),
      };
    }
    const maxYM = dr[0].maxYM as number;
    toY = Math.floor(maxYM / 100);
    toM = maxYM % 100;

    // Default range based on view
    let monthsBack: number;
    switch (view) {
      case "monthly": monthsBack = 11; break;    // 12 months
      case "quarterly": monthsBack = 23; break;  // 8 quarters
      case "yearly": monthsBack = 35; break;     // 3 years
    }
    fromY = toY;
    fromM = toM - monthsBack;
    while (fromM <= 0) { fromM += 12; fromY -= 1; }
  }

  const periodCols = buildPeriodColumns(view, fromY, fromM, toY, toM);
  const periodKeySet = new Set(periodCols.map((c) => c.key));

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

  const fromYM = fromY * 100 + fromM;
  const toYM = toY * 100 + toM;

  const agg = await col
    .aggregate([
      {
        $match: {
          year: { $ne: null },
          month: { $ne: null },
          ...(groupBy === "customer" ? { partyName: { $ne: "" } } : {}),
          $expr: {
            $and: [
              { $gte: [{ $add: [{ $multiply: ["$year", 100] }, "$month"] }, fromYM] },
              { $lte: [{ $add: [{ $multiply: ["$year", 100] }, "$month"] }, toYM] },
            ],
          },
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
    const mk = periodKey(view, id.year, id.month);
    if (!periodKeySet.has(mk)) continue;
    const key = (id.groupKey as string) || "—";
    if (!byGroup.has(key)) byGroup.set(key, newGroup());
    const gd = byGroup.get(key)!;
    const val = row.total as number;
    acc(gd.primary, mk, val);
    acc(grand.primary, mk, val);
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
    const order: (Bucket | "Other")[] = ["Lease", "Detention", "EXIM", "M&R", "Other"];
    for (const b of order) {
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
      const sorted = [...node.byCharge.entries()].sort(
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
    months: periodCols,
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

/** Convert ViewMode + dates to URL-safe params */
export function parseViewParams(sp: {
  view?: string;
  from?: string;
  to?: string;
}): { view: ViewMode; fromDate: Date | null; toDate: Date | null } {
  const v = (sp.view || "monthly").toLowerCase();
  let view: ViewMode = "monthly";
  if (v === "quarterly") view = "quarterly";
  else if (v === "yearly") view = "yearly";
  // "custom" also stays as "monthly" grouping with explicit date range

  // Normalise "YYYY-MM" → "YYYY-MM-01" so Date() parses reliably
  const normalise = (s: string) =>
    /^\d{4}-\d{2}$/.test(s.trim()) ? s.trim() + "-01" : s.trim();

  let fromDate: Date | null = null;
  let toDate: Date | null = null;

  if (sp.from) {
    const d = new Date(normalise(sp.from));
    if (!isNaN(d.getTime())) fromDate = d;
  }
  if (sp.to) {
    const d = new Date(normalise(sp.to));
    if (!isNaN(d.getTime())) {
      // Move to last day of the chosen month so the whole month is included
      d.setUTCMonth(d.getUTCMonth() + 1, 0);
      d.setUTCHours(23, 59, 59, 999);
      toDate = d;
    }
  }
  return { view, fromDate, toDate };
}
