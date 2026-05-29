import { getDb } from "@/lib/mongodb";
import { FilterBar } from "./_components/FilterBar";
import { buildMonthlyTrend, monthRangeLabel } from "@/lib/trend";
import { DashboardTabs } from "./_components/DashboardTabs";
import SyncButton from "./SyncButton";

async function loadKpis() {
  const db = await getDb();
  const col = db.collection("salesRegister");

  // Total across everything (including credit notes)
  const totalAgg = await col
    .aggregate([
      { $group: { _id: null, total: { $sum: "$amountInChargeCurrency" }, count: { $sum: 1 } } },
    ])
    .toArray();
  const totalRevenue = totalAgg[0]?.total || 0;
  const totalRows = totalAgg[0]?.count || 0;

  // By Charge Revenue Category (excluding credit notes)
  const catAgg = await col
    .aggregate([
      { $match: { revenueCategory: { $ne: "Credit Note" } } },
      {
        $group: {
          _id: "$chargeRevenueCategory",
          total: { $sum: "$amountInChargeCurrency" },
        },
      },
    ])
    .toArray();
  const byCharge: Record<string, number> = {};
  for (const r of catAgg) byCharge[r._id || "Unmapped"] = r.total || 0;

  // Credit notes (separate)
  const creditAgg = await col
    .aggregate([
      { $match: { revenueCategory: "Credit Note" } },
      { $group: { _id: null, total: { $sum: "$amountInChargeCurrency" } } },
    ])
    .toArray();
  const creditNotes = creditAgg[0]?.total || 0;

  const lastSync = await db
    .collection("syncLogs")
    .find({ sheetName: "Sales Register" })
    .sort({ syncedAt: -1 })
    .limit(1)
    .toArray();

  return {
    totalRevenue,
    totalRows,
    lease: byCharge["Lease"] || 0,
    detention: byCharge["Detention"] || 0,
    exim: byCharge["EXIM"] || 0,
    mr: byCharge["M&R"] || 0,
    unmapped: byCharge["Unmapped"] || 0,
    creditNotes,
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
        kpis={{
          totalRevenue: k.totalRevenue,
          totalRows: k.totalRows,
          lease: k.lease,
          detention: k.detention,
          exim: k.exim,
          mr: k.mr,
          unmapped: k.unmapped,
          creditNotes: k.creditNotes,
        }}
        customerTrend={customerTrend}
        tradeLaneTrend={tradeLaneTrend}
      />

      {k.unmapped > 0 && (
        <div className="mt-4 text-xs text-warning-text bg-warning/40 rounded-md px-3 py-2 inline-block">
          ⚠️ ${(k.unmapped / 1000).toFixed(1)}K of charges are not mapped in your
          &ldquo;Charge to Revenue Type Mapping&rdquo; sheet. Add them there and click Sync Now.
        </div>
      )}
    </div>
  );
}
