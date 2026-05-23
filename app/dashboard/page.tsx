import { getDb } from "@/lib/mongodb";
import { KPICard } from "./_components/KPICard";
import { FilterBar } from "./_components/FilterBar";
import { MonthlyTrendTable } from "./_components/MonthlyTrendTable";
import { buildMonthlyTrend, monthRangeLabel } from "@/lib/trend";
import SyncButton from "./SyncButton";

async function loadKpis() {
  const db = await getDb();
  const col = db.collection("salesRegister");

  const agg = await col
    .aggregate([
      {
        $group: {
          _id: "$revenueCategory",
          total: { $sum: "$amountInChargeCurrency" },
          count: { $sum: 1 },
        },
      },
    ])
    .toArray();

  const byCat: Record<string, number> = {};
  let totalRevenue = 0;
  let totalRows = 0;
  for (const r of agg) {
    byCat[r._id || "Unknown"] = r.total || 0;
    totalRevenue += r.total || 0;
    totalRows += r.count || 0;
  }

  const headAgg = await col
    .aggregate([
      { $group: { _id: "$revenueHead", total: { $sum: "$amountInChargeCurrency" } } },
    ])
    .toArray();
  const byHead: Record<string, number> = {};
  for (const r of headAgg) byHead[r._id || "Other"] = r.total || 0;

  const lastSync = await db
    .collection("syncLogs")
    .find({ sheetName: "Sales Register" })
    .sort({ syncedAt: -1 })
    .limit(1)
    .toArray();

  return {
    totalRevenue,
    principal: byCat["Principal Revenue"] || 0,
    subLease: byCat["Sub-Lease Revenue"] || 0,
    mrRevenue: byCat["M&R Revenue"] || 0,
    creditNotes: byCat["Credit Note"] || 0,
    detention: byHead["Detention"] || 0,
    exportRev: byHead["Export"] || 0,
    totalRows,
    lastSync: lastSync[0] || null,
  };
}

export default async function DashboardHome() {
  const k = await loadKpis();
  const trend = await buildMonthlyTrend(10);
  const range = monthRangeLabel(trend.months);

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="flex items-end justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-ink-primary">Business Summary</h1>
          <p className="text-xs text-ink-tertiary mt-0.5">
            ISO Tank · Sales · M&amp;R · Finance overview
          </p>
        </div>
        <SyncButton />
      </div>

      <FilterBar
        fromLabel={range.from}
        toLabel={range.to}
        lastSyncedAt={k.lastSync?.syncedAt}
        rowsSynced={k.lastSync?.rowsInserted}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <KPICard
          label="Total Revenue"
          value={k.totalRevenue}
          subtitle={`Across ${k.totalRows.toLocaleString("en-IN")} invoice lines`}
          accent="bg-accent-green"
        />
        <KPICard
          label="Principal Revenue"
          value={k.principal}
          subtitle="Owner-side lease & freight"
          accent="bg-accent-blue"
        />
        <KPICard
          label="Sub-Lease Revenue"
          value={k.subLease}
          subtitle="Sub-leased tank income"
          accent="bg-accent-purple"
        />
        <KPICard
          label="Detention Revenue"
          value={k.detention}
          subtitle="POD + Loading detention"
          accent="bg-accent-orange"
        />
        <KPICard
          label="Export Revenue"
          value={k.exportRev}
          subtitle="Ocean freight charges"
          accent="bg-accent-yellow"
        />
        <KPICard
          label="M&R Revenue"
          value={k.mrRevenue}
          subtitle="Repair & cleaning recovery"
          accent="bg-accent-pink"
        />
      </div>

      <MonthlyTrendTable data={trend} />

      {k.creditNotes !== 0 && (
        <div className="mt-4 text-xs text-ink-tertiary">
          Note: Credit Notes of {fmtSign(k.creditNotes)} are excluded from the trend table but included in Total Revenue.
        </div>
      )}
    </div>
  );
}

function fmtSign(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "+";
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}
