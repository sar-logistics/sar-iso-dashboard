import { buildInventoryTree } from "@/lib/inventoryTree";
import { getDb } from "@/lib/mongodb";
import { InventoryPageClient } from "../_components/InventoryPageClient";

async function getLastSync() {
  const db = await getDb();
  const arr = await db
    .collection("syncLogs")
    .find({ sheetName: "Current Inventory Report" })
    .sort({ syncedAt: -1 })
    .limit(1)
    .toArray();
  return arr[0] || null;
}

export default async function InventoryPage() {
  const [tree, lastSync] = await Promise.all([buildInventoryTree(), getLastSync()]);

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-ink-primary">
          Current Inventory
        </h1>
        <p className="text-xs text-ink-tertiary mt-0.5">
          All ISO tanks · Principal › Activity › From › To › Agent · click any number for tank-level detail
        </p>
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
            <span className="text-ink-tertiary">Total tanks: </span>
            <span className="text-ink-primary font-medium">
              {tree.totalCount.toLocaleString("en-IN")}
            </span>
          </div>
        </div>
      )}

      <InventoryPageClient
        kpis={tree.kpis}
        byActivity={tree.byActivity}
        byPrincipal={tree.byPrincipal}
        byAgent={tree.byAgent}
        rows={tree.rows}
      />
    </div>
  );
}
