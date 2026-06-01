"use client";
import { useState } from "react";
import { InventoryPageClient } from "./InventoryPageClient";
import { DepotPageClient } from "./DepotPageClient";
import type { InventoryTree } from "@/lib/inventoryTree";
import type { DepotData } from "@/lib/depotData";

interface SyncMeta {
  syncedAt: Date | string;
  rowsInserted?: number;
}

interface Props {
  inventoryTree: InventoryTree;
  depotData: DepotData;
  invLastSync: SyncMeta | null;
  depotLastSync: SyncMeta | null;
  initialTab?: "inventory" | "depot";
}

const TABS = [
  { id: "inventory", label: "Current Inventory" },
  { id: "depot", label: "Depot Report" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function fmtSync(d?: Date | string): string {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

export function MRTabs({
  inventoryTree,
  depotData,
  invLastSync,
  depotLastSync,
  initialTab = "inventory",
}: Props) {
  const [tab, setTab] = useState<TabId>(initialTab);
  const activeLastSync = tab === "inventory" ? invLastSync : depotLastSync;
  const activeCount =
    tab === "inventory"
      ? inventoryTree.totalCount
      : depotData.kpis.total;
  const activeCountLabel =
    tab === "inventory" ? "Total tanks tracked" : "Total tanks across depots";

  return (
    <>
      {activeLastSync && (
        <div className="card bg-white px-4 py-3 mb-5 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-ink-secondary">
          <div>
            <span className="text-ink-tertiary">Last sync: </span>
            <span className="text-ink-primary font-medium">
              {fmtSync(activeLastSync.syncedAt)}
            </span>
          </div>
          <div>
            <span className="text-ink-tertiary">{activeCountLabel}: </span>
            <span className="text-ink-primary font-medium">
              {activeCount.toLocaleString("en-IN")}
            </span>
          </div>
        </div>
      )}

      <div className="border-b border-surface-border mb-6 flex gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
              tab === t.id
                ? "border-accent-orange text-ink-primary"
                : "border-transparent text-ink-tertiary hover:text-ink-primary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "inventory" && (
        <InventoryPageClient
          kpis={inventoryTree.kpis}
          byActivity={inventoryTree.byActivity}
          byPrincipal={inventoryTree.byPrincipal}
          byAgent={inventoryTree.byAgent}
          rows={inventoryTree.rows}
        />
      )}

      {tab === "depot" && <DepotPageClient data={depotData} />}
    </>
  );
}
