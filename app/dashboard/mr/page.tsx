import { buildInventoryTree } from "@/lib/inventoryTree";
import { buildDepotData } from "@/lib/depotData";
import { getDb } from "@/lib/mongodb";
import { MRTabs } from "../_components/MRTabs";

async function getLastSync(sheetName: string) {
  const db = await getDb();
  const arr = await db
    .collection("syncLogs")
    .find({ sheetName })
    .sort({ syncedAt: -1 })
    .limit(1)
    .toArray();
  return arr[0] || null;
}

export default async function MROperationsPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const [tree, depotData, invLastSync, depotLastSync] = await Promise.all([
    buildInventoryTree(),
    buildDepotData(),
    getLastSync("Current Inventory Report"),
    getLastSync("Depot Report"),
  ]);

  const initialTab =
    searchParams.tab === "depot" ? "depot" : "inventory";

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-ink-primary">
          M&amp;R Operations
        </h1>
        <p className="text-xs text-ink-tertiary mt-0.5">
          Inventory and depot stock · click any number for tank-level detail
        </p>
      </div>

      <MRTabs
        inventoryTree={tree}
        depotData={depotData}
        invLastSync={invLastSync as any}
        depotLastSync={depotLastSync as any}
        initialTab={initialTab as "inventory" | "depot"}
      />
    </div>
  );
}
