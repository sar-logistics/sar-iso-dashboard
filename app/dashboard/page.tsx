import { getDb } from "@/lib/mongodb";
import { fmtUSD, titleCase } from "@/lib/utils";
import SyncButton from "./SyncButton";

async function loadKpis() {
  const db = await getDb();
  const col = db.collection("salesRegister");

  // Total Revenue = sum of amountInLocalCurrency excluding credit notes
  // (Credit notes are already negative in the sheet so we still sum all,
  //  but we surface them separately too for clarity.)
  const agg = await col
    .aggregate([
      {
        $group: {
          _id: "$revenueCategory",
          total: { $sum: "$amountInLocalCurrency" },
          count: { $sum: 1 },
        },
      },
    ])
    .toArray();

  const byCategory: Record<string, number> = {};
  let totalRevenue = 0;
  let totalRows = 0;
  for (const r of agg) {
    byCategory[r._id || "Unknown"] = r.total || 0;
    totalRevenue += r.total || 0;
    totalRows += r.count || 0;
  }

  const detentionAgg = await col
    .aggregate([
      { $match: { revenueHead: "Detention" } },
      { $group: { _id: null, total: { $sum: "$amountInLocalCurrency" } } },
    ])
    .toArray();
  const detentionRevenue = detentionAgg[0]?.total || 0;

  const exportAgg = await col
    .aggregate([
      { $match: { revenueHead: "Export" } },
      { $group: { _id: null, total: { $sum: "$amountInLocalCurrency" } } },
    ])
    .toArray();
  const exportRevenue = exportAgg[0]?.total || 0;

  const lastSync = await db
    .collection("syncLogs")
    .find({ sheetName: "Sales Register" })
    .sort({ syncedAt: -1 })
    .limit(1)
    .toArray();

  // Top 5 customers by revenue
  const topCustomers = await col
    .aggregate([
      { $match: { revenueCategory: { $ne: "Credit Note" } } },
      { $group: { _id: "$partyName", total: { $sum: "$amountInLocalCurrency" } } },
      { $sort: { total: -1 } },
      { $limit: 5 },
    ])
    .toArray();

  return {
    totalRevenue,
    detentionRevenue,
    exportRevenue,
    byCategory,
    totalRows,
    lastSync: lastSync[0] || null,
    topCustomers,
  };
}

export default async function DashboardHome() {
  const k = await loadKpis();

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-ink-primary">Business Summary</h1>
          <p className="text-sm text-ink-secondary mt-1">
            One view of ISO tank Sales, M&amp;R and Finance.
          </p>
        </div>
        <div className="flex items-center gap-4">
          {k.lastSync && (
            <span className="text-xs text-ink-tertiary">
              Last synced{" "}
              {new Date(k.lastSync.syncedAt).toLocaleString("en-IN", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
          )}
          <SyncButton />
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="card border-l-4 border-l-sales-dark">
          <div className="kpi-label">Total Revenue</div>
          <div className="kpi-value">{fmtUSD(k.totalRevenue)}</div>
          <div className="text-xs text-ink-tertiary mt-2">
            Across {k.totalRows.toLocaleString("en-IN")} invoice lines
          </div>
        </div>
        <div className="card border-l-4 border-l-mr-dark">
          <div className="kpi-label">Detention Revenue</div>
          <div className="kpi-value">{fmtUSD(k.detentionRevenue)}</div>
          <div className="text-xs text-ink-tertiary mt-2">
            From all detention-related charge heads
          </div>
        </div>
        <div className="card border-l-4 border-l-info-dark">
          <div className="kpi-label">Export Revenue</div>
          <div className="kpi-value">{fmtUSD(k.exportRevenue)}</div>
          <div className="text-xs text-ink-tertiary mt-2">
            Ocean freight + freight-related charges
          </div>
        </div>
      </div>

      {/* Revenue by Category */}
      <div className="card mb-8">
        <h2 className="text-sm font-semibold text-ink-primary mb-4">
          Revenue by Category
        </h2>
        {Object.keys(k.byCategory).length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-3">
            {Object.entries(k.byCategory).map(([cat, val]) => (
              <div key={cat} className="flex items-center justify-between text-sm">
                <span className="text-ink-secondary">{cat}</span>
                <span className="font-medium text-ink-primary">{fmtUSD(val)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top Customers */}
      <div className="card">
        <h2 className="text-sm font-semibold text-ink-primary mb-4">
          Top 5 Customers by Revenue
        </h2>
        {k.topCustomers.length === 0 ? (
          <EmptyState />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-ink-tertiary border-b border-surface-border">
                <th className="py-2 font-medium">Customer</th>
                <th className="py-2 font-medium text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {k.topCustomers.map((c) => (
                <tr key={c._id} className="border-b border-surface-border last:border-0">
                  <td className="py-3 text-ink-primary">{titleCase(c._id)}</td>
                  <td className="py-3 text-right font-medium">
                    {fmtUSD(c.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-sm text-ink-tertiary py-4">
      No data yet. Click <span className="font-medium text-ink-primary">Sync Now</span>{" "}
      to pull the latest Sales Register from the Google Sheet.
    </div>
  );
}
