"use client";
import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { CustomerAvatar } from "./CustomerAvatar";
import { InventoryDrillModal, InventoryDrillContext } from "./InventoryDrillModal";
import type { InventoryNode } from "@/lib/inventoryTree";
import { titleCase } from "@/lib/utils";

interface Props {
  rows: InventoryNode[];
  totalCount: number;
}

export function InventoryPivotTable({ rows, totalCount }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(
    // Default: all principals expanded so users see activities at first glance
    new Set(rows.map((r) => r.principal || ""))
  );
  const [drill, setDrill] = useState<InventoryDrillContext | null>(null);

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const expandAll = () =>
    setExpanded(new Set(rows.map((r) => r.principal || "")));
  const collapseAll = () => setExpanded(new Set());

  const openDrill = (n: InventoryNode) => {
    const titleParts: string[] = [];
    if (n.principal) titleParts.push(titleCase(n.principal));
    if (n.activity) titleParts.push(n.activity);
    setDrill({
      title: titleParts.join(" · ") || "All Tanks",
      subtitle: `${n.count.toLocaleString("en-IN")} tank${n.count === 1 ? "" : "s"}`,
      cellCount: n.count,
      principal: n.principal,
      activity: n.activity,
    });
  };

  const k = (n: InventoryNode) => `${n.principal || ""}|${n.activity || ""}|${n.level}`;
  const fmtPct = (n: number) => {
    if (totalCount === 0) return "—";
    const p = (n / totalCount) * 100;
    if (p < 0.1) return "<0.1%";
    return `${p.toFixed(1)}%`;
  };

  return (
    <>
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between flex-wrap gap-2">
          <div className="text-[11px] text-ink-tertiary uppercase tracking-wider font-medium">
            Inventory · Principal › Activity
          </div>
          <div className="text-[11px] flex items-center gap-3">
            <button
              onClick={expandAll}
              className="text-ink-secondary hover:text-ink-primary transition"
            >
              Expand all
            </button>
            <span className="text-surface-border">·</span>
            <button
              onClick={collapseAll}
              className="text-ink-secondary hover:text-ink-primary transition"
            >
              Collapse all
            </button>
            <span className="text-ink-tertiary">
              · Click any number to see the tanks
            </span>
          </div>
        </div>

        <table className="trend-table w-full">
          <thead>
            <tr className="bg-surface-subtle border-b border-surface-border text-[10px] uppercase tracking-wider text-ink-tertiary">
              <th className="left px-4 py-2 font-medium">Group</th>
              <th className="text-right px-4 py-2 font-medium w-32">
                Tank Count
              </th>
              <th className="text-right px-4 py-2 font-medium w-24">
                % of Total
              </th>
            </tr>
          </thead>
          <tbody>
            {/* All-tanks grand total row */}
            <tr className="border-b border-surface-border bg-surface-subtle font-semibold">
              <td className="left px-4 py-2.5">
                <div className="inline-flex items-center gap-2 pl-1">
                  <CustomerAvatar name="AL" />
                  <span>ALL TANKS</span>
                </div>
              </td>
              <td className="text-right px-4 py-2.5 tabular-nums">
                <button
                  onClick={() =>
                    setDrill({
                      title: "All Tanks",
                      subtitle: `${totalCount.toLocaleString("en-IN")} tanks total`,
                      cellCount: totalCount,
                    })
                  }
                  className="hover:underline hover:text-info-text transition-colors"
                >
                  {totalCount.toLocaleString("en-IN")}
                </button>
              </td>
              <td className="text-right px-4 py-2.5 tabular-nums text-ink-tertiary">
                100%
              </td>
            </tr>

            {rows.map((principal) => {
              const principalKey = principal.principal || "";
              const isExpanded = expanded.has(principalKey);
              return (
                <>
                  {/* Principal row */}
                  <tr
                    key={k(principal)}
                    className="border-b border-surface-border hover:bg-surface-subtle/50"
                  >
                    <td className="left px-4 py-2">
                      <div className="inline-flex items-center gap-2 pl-2">
                        <button
                          onClick={() => toggle(principalKey)}
                          className="text-ink-tertiary hover:text-ink-primary transition"
                          aria-label={
                            isExpanded ? "Collapse" : "Expand"
                          }
                        >
                          {isExpanded ? (
                            <ChevronDown size={14} />
                          ) : (
                            <ChevronRight size={14} />
                          )}
                        </button>
                        <CustomerAvatar name={principal.label} />
                        <span className="text-ink-primary font-medium">
                          {titleCase(principal.label)}
                        </span>
                      </div>
                    </td>
                    <td className="text-right px-4 py-2 tabular-nums font-medium">
                      <button
                        onClick={() => openDrill(principal)}
                        className="hover:underline hover:text-info-text transition-colors"
                      >
                        {principal.count.toLocaleString("en-IN")}
                      </button>
                    </td>
                    <td className="text-right px-4 py-2 tabular-nums text-ink-tertiary">
                      {fmtPct(principal.count)}
                    </td>
                  </tr>

                  {/* Activity rows (children) */}
                  {isExpanded &&
                    principal.children?.map((activity) => (
                      <tr
                        key={k(activity)}
                        className="border-b border-surface-border hover:bg-surface-subtle/50"
                      >
                        <td className="left px-4 py-1.5">
                          <div className="pl-14 text-ink-secondary text-[12px] uppercase tracking-wide">
                            {activity.label}
                          </div>
                        </td>
                        <td className="text-right px-4 py-1.5 tabular-nums">
                          <button
                            onClick={() => openDrill(activity)}
                            className="hover:underline hover:text-info-text transition-colors text-ink-secondary"
                          >
                            {activity.count.toLocaleString("en-IN")}
                          </button>
                        </td>
                        <td className="text-right px-4 py-1.5 tabular-nums text-ink-tertiary text-[12px]">
                          {fmtPct(activity.count)}
                        </td>
                      </tr>
                    ))}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      <InventoryDrillModal ctx={drill} onClose={() => setDrill(null)} />
    </>
  );
}
