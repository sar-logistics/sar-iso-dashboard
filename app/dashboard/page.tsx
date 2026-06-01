import { Suspense } from "react";
import { getDb } from "@/lib/mongodb";
import { FilterBar } from "./_components/FilterBar";
import {
  buildPeriodTrend,
  monthRangeLabel,
  parseViewParams,
  getEffectiveDateRange,
} from "@/lib/trend";
import { DashboardTabs } from "./_components/DashboardTabs";

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10); // yyyy-mm-dd
}

async function loadKpis(fromDate: Date, toDate: Date) {
  const db = await getDb();
  const col = db.collection("salesRegister");

  const dateFilter = { invoiceDate: { $gte: fromDate, $lte: toDate } };

  const [totalAgg, catAgg, lastSyncArr] = await Promise.all([
    // Total Revenue is NET of credit notes — include all rows
    col
      .aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: null,
            total: { $sum: "$amountInChargeCurrency" },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray(),

    // Bucket totals — credit notes are now INCLUDED so they net against
    // their matching bucket (e.g. Lease credit reduces Lease revenue).
    col
      .aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: "$chargeRevenueCategory",
            total: { $sum: "$amountInChargeCurrency" },
          },
        },
      ])
      .toArray(),

    db
      .collection("syncLogs")
      .find({ sheetName: "Sales Register" })
      .sort({ syncedAt: -1 })
      .limit(1)
      .toArray(),
  ]);

  const byCharge: Record<string, number> = {};
  for (const r of catAgg) byCharge[r._id || "Unmapped"] = r.total || 0;

  return {
    totalRevenue: totalAgg[0]?.total || 0,
    totalRows: totalAgg[0]?.count || 0,
    lease: byCharge["Lease"] || 0,
    detention: byCharge["Detention"] || 0,
    exim: byCharge["EXIM"] || 0,
    mr: byCharge["M&R"] || 0,
    unmapped: byCharge["Unmapped"] || 0,
    lastSync: lastSyncArr[0] || null,
  };
}

export default async function DashboardHome({
  searchParams,
}: {
  searchParams: { view?: string; from?: string; to?: string };
}) {
  const { view, fromDate: paramFrom, toDate: paramTo } =
    parseViewParams(searchParams);
  const { fromDate, toDate } = await getEffectiveDateRange(
    view,
    paramFrom,
    paramTo
  );

  const [k, customerTrend, tradeLaneTrend] = await Promise.all([
    loadKpis(fromDate, toDate),
    buildPeriodTrend("customer", { view, fromDate, toDate, topN: 10 }),
    buildPeriodTrend("tradeLane", { view, fromDate, toDate, topN: 10 }),
  ]);

  const range = monthRangeLabel(customerTrend.months);

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-ink-primary">
          Sales Performance
        </h1>
        <p className="text-xs text-ink-tertiary mt-0.5">
          ISO Tank · Charts and detailed breakdowns by agent and trade lane
        </p>
      </div>

      <Suspense
        fallback={
          <div className="card h-12 mb-5 animate-pulse bg-surface-muted" />
        }
      >
        <FilterBar
          currentView={searchParams.view === "custom" ? "custom" : view}
          currentFrom={searchParams.from || toIsoDate(fromDate)}
          currentTo={searchParams.to || toIsoDate(toDate)}
          fromLabel={range.from}
          toLabel={range.to}
          lastSyncedAt={k.lastSync?.syncedAt}
          rowsSynced={k.lastSync?.rowsInserted}
        />
      </Suspense>

      <DashboardTabs
        kpis={{
          totalRevenue: k.totalRevenue,
          totalRows: k.totalRows,
          lease: k.lease,
          detention: k.detention,
          exim: k.exim,
          mr: k.mr,
          unmapped: k.unmapped,
        }}
        customerTrend={customerTrend}
        tradeLaneTrend={tradeLaneTrend}
      />

      {k.unmapped > 0 && (
        <div className="mt-4 text-xs text-warning-text bg-warning/40 rounded-md px-3 py-2 inline-block">
          ⚠️ ${(k.unmapped / 1000).toFixed(1)}K of charges are not in your
          &ldquo;Charge to Revenue Type Mapping&rdquo; sheet. Add them — the
          next hourly sync will pick them up.
        </div>
      )}
    </div>
  );
}
