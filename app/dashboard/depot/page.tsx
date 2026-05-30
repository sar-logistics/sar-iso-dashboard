import { buildDepotData } from "@/lib/depotData";
import { getDb } from "@/lib/mongodb";
import { DepotPageClient } from "../_components/DepotPageClient";
import SyncButton from "../SyncButton";

async function getLastSync() {
  const db = await getDb();
  const arr = await db
    .collection("syncLogs")
    .find({ sheetName: "Depot Report" })
    .sort({ syncedAt: -1 })
    .limit(1)
    .toArray();
  return arr[0] || null;
}

export default async function DepotPage() {
  const [data, lastSync] = await Promise.all([buildDepotData(), getLastSync()]);

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="flex items-end justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-ink-primary">
            Depot Report
          </h1>
          <p className="text-xs text-ink-tertiary mt-0.5">
            Tank stock by depot · ageing buckets · click any number for tank details
          </p>
        </div>
        <SyncButton />
      </div>

      {lastSync && (
        <div className="card bg-white px-4 py-3 mb-5 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-ink-secondary">
          <div>
            <span className="text-ink-tertiary">Last sync: </span>
            <span className="text-ink-primary font-medium">
              {new Date(lastSync.syncedAt).toLocaleString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Asia/Kolkata",
              })}
            </span>
          </div>
          <div>
            <span className="text-ink-tertiary">Depots: </span>
            <span className="text-ink-primary font-medium">{data.rows.length}</span>
          </div>
          <div>
            <span className="text-ink-tertiary">Total tanks: </span>
            <span className="text-ink-primary font-medium">
              {data.kpis.total.toLocaleString("en-IN")}
            </span>
          </div>
        </div>
      )}

      <DepotPageClient data={data} />
    </div>
  );
}
