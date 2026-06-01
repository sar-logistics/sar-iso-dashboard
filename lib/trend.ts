import { getDb } from "@/lib/mongodb";
import type {
  MonthlyTrendData,
  GroupBlock,
  MetricRow,
} from "@/app/dashboard/_components/MonthlyTrendTable";

const PRIMARY = "Revenue" as const;
const BUCKETS = ["Lease", "Detention", "EXIM", "M&R"] as const;
type Bucket = (typeof BUCKETS)[number];

export type ViewMode = "monthly" | "quarterly" | "yearly" | "weekly";
export type GroupBy = "customer" | "tradeLane";

function bucketFor(
  chargeCategory: string,
  invoiceCategory: string
): Bucket | "Other" | null {
  // Credit notes are INCLUDED so they net against their matching revenue bucket.
  const c = (chargeCategory || "").trim();
  if (c === "Detention") return "Detention";
  if (c === "EXIM") return "EXIM";
  if (c === "M&R") return "M&R";
  if (c === "Lease") return "Lease";
  return "Other";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ISO week computation (week starts Monday, week 1 contains first Thursday of year)
function getISOWeek(d: Date): { week: number; year: number } {
  const date = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const isoYear = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return { week, year: isoYear };
}

function periodKey(view: ViewMode, year: number, month: number): string {
  switch (view) {
    case "weekly":
      return `${year}-W${String(month).padStart(2, "0")}`; // here "month" is actually week number
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
    case "weekly":
      return `W${month} ${yy}`;
    case "monthly":
      return `${MONTHS[month - 1]} ${yy}`;
    case "quarterly":
      return `Q${Math.ceil(month / 3)} ${yy}`;
    case "yearly":
      return `FY ${year}`;
  }
}

/** Build week columns going backward from `toDate`. Returns oldest-first. */
function buildWeeklyColumns(toDate: Date, numWeeks: number) {
  const cols: { key: string; label: string; year: number; month: number }[] = [];
  // Move cursor to Monday of the week containing toDate
  const cursor = new Date(
    Date.UTC(toDate.getUTCFullYear(), toDate.getUTCMonth(), toDate.getUTCDate())
  );
  const dow = cursor.getUTCDay() || 7;
  cursor.setUTCDate(cursor.getUTCDate() - dow + 1);
  for (let i = 0; i < numWeeks; i++) {
    const { week, year } = getISOWeek(cursor);
    cols.unshift({
      key: `${year}-W${String(week).padStart(2, "0")}`,
      label: `W${week} ${String(year).slice(-2)}`,
      year,
      month: week, // store week number in `month` slot — used by drill (period start range)
    });
    cursor.setUTCDate(cursor.getUTCDate() - 7);
  }
  return cols;
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

  // Determine date range AND build the column list.
  // For monthly/quarterly/yearly we work in year+month integers.
  // For weekly we work with actual Date objects (Monday-Sunday ISO weeks).

  let actualFromDate: Date;
  let actualToDate: Date;
  let periodCols: { key: string; label: string; year: number; month: number }[];

  if (view === "weekly") {
    // 5 most recent ISO weeks ending at toDate (or latest data)
    if (toDate) {
      actualToDate = toDate;
    } else {
      const latest = await col
        .aggregate([
          { $match: { invoiceDate: { $ne: null } } },
          { $group: { _id: null, max: { $max: "$invoiceDate" } } },
        ])
        .toArray();
      if (!latest.length) {
        return {
          months: [],
          rows: [],
          grandTotal: emptyGroup(
            groupBy === "customer" ? "ALL AGENTS" : "ALL TRADE LANES"
          ),
        };
      }
      actualToDate = new Date(latest[0].max);
    }
    const numWeeks = 5;
    periodCols = buildWeeklyColumns(actualToDate, numWeeks);
    // From-date = Monday of the earliest column
    const first = periodCols[0];
    // Find the Monday of that ISO week by stepping back from toDate
    actualFromDate = new Date(actualToDate);
    const dow = actualFromDate.getUTCDay() || 7;
    actualFromDate.setUTCDate(actualFromDate.getUTCDate() - dow + 1);
    actualFromDate.setUTCDate(actualFromDate.getUTCDate() - 7 * (numWeeks - 1));
    actualFromDate.setUTCHours(0, 0, 0, 0);
  } else if (fromDate && toDate) {
    actualFromDate = fromDate;
    actualToDate = toDate;
    const fromY = fromDate.getUTCFullYear();
    const fromM = fromDate.getUTCMonth() + 1;
    const toY = toDate.getUTCFullYear();
    const toM = toDate.getUTCMonth() + 1;
    periodCols = buildPeriodColumns(view, fromY, fromM, toY, toM);
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
          groupBy === "customer" ? "ALL AGENTS" : "ALL TRADE LANES"
        ),
      };
    }
    const maxYM = dr[0].maxYM as number;
    const toY = Math.floor(maxYM / 100);
    const toM = maxYM % 100;

    let monthsBack: number;
    switch (view) {
      case "monthly": monthsBack = 11; break;     // 12 months
      case "quarterly": monthsBack = 23; break;   // 8 quarters
      case "yearly": monthsBack = 35; break;      // 3 years
      default: monthsBack = 11;
    }
    let fromY = toY;
    let fromM = toM - monthsBack;
    while (fromM <= 0) { fromM += 12; fromY -= 1; }
    periodCols = buildPeriodColumns(view, fromY, fromM, toY, toM);
    actualFromDate = new Date(Date.UTC(fromY, fromM - 1, 1));
    actualToDate = new Date(Date.UTC(toY, toM, 0, 23, 59, 59, 999));
  }

  const periodKeySet = new Set(periodCols.map((c) => c.key));

  const groupKeyExpr =
    groupBy === "tradeLane"
      ? {
          $let: {
            vars: {
              p: {
                $trim: { input: { $ifNull: ["$pol", ""] } },
              },
              d: {
                $trim: { input: { $ifNull: ["$pod", ""] } },
              },
            },
            in: {
              $cond: {
                if: {
                  $and: [
                    { $eq: ["$$p", ""] },
                    { $eq: ["$$d", ""] },
                  ],
                },
                then: "No Trade Lane / Sundry",
                else: {
                  $concat: [
                    { $cond: [{ $eq: ["$$p", ""] }, "—", "$$p"] },
                    " → ",
                    { $cond: [{ $eq: ["$$d", ""] }, "—", "$$d"] },
                  ],
                },
              },
            },
          },
        }
      : "$partyName";

  // Always filter by actual invoiceDate range — works for both day-level (custom)
  // and month-level filtering, and naturally restricts the data for weekly view.
  const agg = await col
    .aggregate([
      {
        $match: {
          invoiceDate: { $gte: actualFromDate, $lte: actualToDate },
          ...(groupBy === "customer" ? { partyName: { $ne: "" } } : {}),
        },
      },
      {
        $addFields: {
          isoWeek: { $isoWeek: "$invoiceDate" },
          isoWeekYear: { $isoWeekYear: "$invoiceDate" },
        },
      },
      {
        $group: {
          _id: {
            groupKey: groupKeyExpr,
            year: "$year",
            month: "$month",
            isoWeek: "$isoWeek",
            isoWeekYear: "$isoWeekYear",
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
    const mk =
      view === "weekly"
        ? `${id.isoWeekYear}-W${String(id.isoWeek).padStart(2, "0")}`
        : periodKey(view, id.year, id.month);
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
      group: groupBy === "customer" ? "ALL AGENTS" : "ALL TRADE LANES",
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

/** Convert URL params → ViewMode + dates */
export function parseViewParams(sp: {
  view?: string;
  from?: string;
  to?: string;
}): { view: ViewMode; fromDate: Date | null; toDate: Date | null } {
  const v = (sp.view || "monthly").toLowerCase();
  let view: ViewMode = "monthly";
  if (v === "quarterly") view = "quarterly";
  else if (v === "yearly") view = "yearly";
  else if (v === "weekly") view = "weekly";
  // "custom" → "monthly" grouping with explicit date range

  let fromDate: Date | null = null;
  let toDate: Date | null = null;

  if (sp.from) {
    const raw = sp.from.trim();
    // Accept "YYYY-MM" (round to 1st) or "YYYY-MM-DD" (exact)
    const isMonthOnly = /^\d{4}-\d{2}$/.test(raw);
    const d = new Date(isMonthOnly ? raw + "-01" : raw);
    if (!isNaN(d.getTime())) {
      d.setUTCHours(0, 0, 0, 0);
      fromDate = d;
    }
  }
  if (sp.to) {
    const raw = sp.to.trim();
    const isMonthOnly = /^\d{4}-\d{2}$/.test(raw);
    const d = new Date(isMonthOnly ? raw + "-01" : raw);
    if (!isNaN(d.getTime())) {
      if (isMonthOnly) {
        // Round up to last day of month
        d.setUTCMonth(d.getUTCMonth() + 1, 0);
      }
      d.setUTCHours(23, 59, 59, 999);
      toDate = d;
    }
  }
  return { view, fromDate, toDate };
}

const MS_PER_DAY = 86_400_000;
const MAX_WEEKLY_DAYS = 5 * 7 - 1; // 5 ISO weeks span 34 days inclusive

/**
 * Determine the effective FROM/TO range used for KPIs and charts.
 * - If the user gave explicit dates, use them (clamped for weekly).
 * - Otherwise compute a sensible default based on the latest invoice date.
 */
export async function getEffectiveDateRange(
  view: ViewMode,
  fromDate: Date | null,
  toDate: Date | null
): Promise<{ fromDate: Date; toDate: Date }> {
  const db = await getDb();
  const r = await db
    .collection("salesRegister")
    .aggregate([
      { $match: { invoiceDate: { $ne: null } } },
      { $group: { _id: null, max: { $max: "$invoiceDate" } } },
    ])
    .toArray();
  const maxDate: Date = r[0]?.max ? new Date(r[0].max) : new Date();

  // Effective TO: explicit toDate, else end of month containing max invoice
  let effTo: Date;
  if (toDate) {
    effTo = toDate;
  } else {
    effTo = new Date(
      Date.UTC(
        maxDate.getUTCFullYear(),
        maxDate.getUTCMonth() + 1,
        0,
        23,
        59,
        59,
        999
      )
    );
  }

  // Effective FROM
  let effFrom: Date;
  if (fromDate) {
    effFrom = fromDate;
  } else if (view === "weekly") {
    effFrom = new Date(effTo);
    effFrom.setUTCDate(effFrom.getUTCDate() - MAX_WEEKLY_DAYS);
    effFrom.setUTCHours(0, 0, 0, 0);
  } else {
    let monthsBack: number;
    switch (view) {
      case "quarterly":
        monthsBack = 23;
        break;
      case "yearly":
        monthsBack = 35;
        break;
      default:
        monthsBack = 11;
    }
    effFrom = new Date(
      Date.UTC(effTo.getUTCFullYear(), effTo.getUTCMonth() - monthsBack, 1, 0, 0, 0)
    );
  }

  // Enforce 5-week cap on weekly view — trim from the start so most recent is shown
  if (view === "weekly") {
    const spanDays = (effTo.getTime() - effFrom.getTime()) / MS_PER_DAY;
    if (spanDays > MAX_WEEKLY_DAYS) {
      effFrom = new Date(effTo);
      effFrom.setUTCDate(effFrom.getUTCDate() - MAX_WEEKLY_DAYS);
      effFrom.setUTCHours(0, 0, 0, 0);
    }
  }

  return { fromDate: effFrom, toDate: effTo };
}
