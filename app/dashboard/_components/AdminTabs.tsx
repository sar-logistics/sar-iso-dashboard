"use client";
import { useState } from "react";
import { SyncHistoryTab } from "./admin/SyncHistoryTab";
import { ChargeMappingsTab } from "./admin/ChargeMappingsTab";
import { UsersTab } from "./admin/UsersTab";
import { SystemStatusTab } from "./admin/SystemStatusTab";

type TabId = "history" | "mappings" | "users" | "status";

const TABS: { id: TabId; label: string }[] = [
  { id: "history", label: "Sync History" },
  { id: "mappings", label: "Charge Mappings" },
  { id: "users", label: "Users" },
  { id: "status", label: "System Status" },
];

export function AdminTabs({
  initialTab,
  currentUserEmail,
}: {
  initialTab: TabId;
  currentUserEmail: string;
}) {
  const [tab, setTab] = useState<TabId>(initialTab);

  return (
    <>
      <div className="border-b border-surface-border mb-6 flex gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
              tab === t.id
                ? "border-accent-purple text-ink-primary"
                : "border-transparent text-ink-tertiary hover:text-ink-primary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "history" && <SyncHistoryTab />}
      {tab === "mappings" && <ChargeMappingsTab />}
      {tab === "users" && <UsersTab currentUserEmail={currentUserEmail} />}
      {tab === "status" && <SystemStatusTab />}
    </>
  );
}
