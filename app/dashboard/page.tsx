import { getDb } from "@/lib/mongodb";
import { FilterBar } from "./_components/FilterBar";
import { buildMonthlyTrend, monthRangeLabel } from "@/lib/trend";
import { DashboardTabs } from "./_components/DashboardTabs";
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
  const [customerTrend, tradeLaneTrend] = await Promise.all([
    buildMonthlyTrend("customer", 10),
    buildMonthlyTrend("tradeLane", 10),
  ]);
  const range = monthRangeLabel(customerTrend.months);

  const kpisForClient = {
    totalRevenue: k.totalRevenue,
    principal: k.principal,
    subLease: k.subLease,
    mrRevenue: k.mrRevenue,
    creditNotes: k.creditNotes,
    detention: k.detention,
    exportRev: k.exportRev,
    totalRows: k.totalRows,
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="flex items-end justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-ink-primary">Sales Performance</h1>
          <p className="text-xs text-ink-tertiary mt-0.5">
            ISO Tank · Charts and detailed breakdowns by customer and trade lane
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

      <DashboardTabs
        kpis={kpisForClient}
        customerTrend={customerTrend}
        tradeLaneTrend={tradeLaneTrend}
      />

      {k.creditNotes !== 0 && (
        <div className="mt-4 text-xs text-ink-tertiary">
          Note: Credit Notes of {fmtSign(k.creditNotes)} are excluded from
          charts and trend tables but included in Total Revenue.
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
