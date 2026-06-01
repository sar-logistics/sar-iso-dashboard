"use client";
import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { titleCase } from "@/lib/utils";
import { CustomerAvatar } from "./CustomerAvatar";
import type { InventoryNode } from "@/lib/inventoryTree";
import {
  InventoryDrillModal,
  InventoryDrillContext,
} from "./InventoryDrillModal";

interface Props {
  rows: InventoryNode[];
  totalCount: number;
}

export function InventoryPivotTable({ rows, totalCount }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set()); // start collapsed
  const [drill, setDrill] = useState<InventoryDrillContext | null>(null);

  const key = (n: InventoryNode) =>
    `${n.principal || ""}|${n.activity || ""}|${n.fromLocation || ""}|${
      n.toLocation || ""
    }|${n.agent || ""}|${n.level}`;

  const toggle = (k: string) =>
    setExpanded((p) => {
      const n = new Set(p);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });

  const expandAll = () => {
    const all = new Set<string>();
    const walk = (n: InventoryNode) => {
      if (n.children?.length) {
        all.add(key(n));
        n.children.forEach(walk);
      }
    };
    rows.forEach(walk);
    setExpanded(all);
  };
  const collapseAll = () => setExpanded(new Set());

  const openDrill = (n: InventoryNode) => {
    const titleParts: string[] = [];
    if (n.principal) titleParts.push(titleCase(n.principal));
    if (n.activity) titleParts.push(n.activity);
    if (n.fromLocation) titleParts.push(`From ${n.fromLocation}`);
    if (n.toLocation) titleParts.push(`To ${n.toLocation}`);
    if (n.agent) titleParts.push(`Agent ${titleCase(n.agent)}`);
    setDrill({
      title: titleParts.join(" · ") || "All Tanks",
      subtitle: `${n.count.toLocaleString("en-IN")} tank${n.count === 1 ? "" : "s"}`,
      cellCount: n.count,
      principal: n.principal,
      activity: n.activity,
      fromLocation: n.fromLocation,
      toLocation: n.toLocation,
      agent: n.agent,
    });
  };

  return (
    <>
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between flex-wrap gap-3">
          <div className="text-[11px] uppercase tracking-wider text-ink-tertiary">
            Inventory · Principal › Activity › From › To › Agent
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={expandAll}
              className="text-[11px] text-info-text hover:underline"
            >
              Expand all
            </button>
            <span className="text-ink-tertiary text-[11px]">·</span>
            <button
              onClick={collapseAll}
              className="text-[11px] text-info-text hover:underline"
            >
              Collapse all
            </button>
            <span className="text-[11px] text-ink-tertiary">
              Click any number to see the tanks
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-ink-tertiary border-b border-surface-border bg-surface-subtle/70">
                <th className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wider min-w-[440px]">
                  Group
                </th>
                <th className="text-right px-4 py-2.5 text-[11px] uppercase tracking-wider min-w-[110px]">
                  Tank Count
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="total-row border-b border-surface-border">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <CustomerAvatar name="ALL" />
                    <span className="font-semibold">ALL TANKS</span>
                  </div>
                </td>
                <td className="text-right px-4 py-2.5">
                  <button
                    onClick={() =>
                      setDrill({
                        title: "All Tanks",
                        subtitle: `${totalCount.toLocaleString("en-IN")} tanks total`,
                        cellCount: totalCount,
                      })
                    }
                    className="font-semibold hover:underline hover:text-info-text transition-colors"
                  >
                    {totalCount.toLocaleString("en-IN")}
                  </button>
                </td>
              </tr>
              {rows.map((p) => (
                <PrincipalRow
                  key={key(p)}
                  node={p}
                  expanded={expanded}
                  toggle={toggle}
                  onDrill={openDrill}
                  k={key}
                />
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-8 text-center text-ink-tertiary">
                    No inventory data yet — data refreshes hourly from Google Sheets.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <InventoryDrillModal ctx={drill} onClose={() => setDrill(null)} />
    </>
  );
}

function NodeRow({
  node,
  expanded,
  toggle,
  onDrill,
  k,
  indent,
  rowClass,
  labelStyle,
}: {
  node: InventoryNode;
  expanded: Set<string>;
  toggle: (key: string) => void;
  onDrill: (n: InventoryNode) => void;
  k: (n: InventoryNode) => string;
  indent: string;
  rowClass: string;
  labelStyle: string;
}) {
  const myKey = k(node);
  const isOpen = expanded.has(myKey);
  const hasKids = !!node.children?.length;
  return (
    <>
      <tr className={`${rowClass} border-b border-surface-border/40`}>
        <td className={`px-4 py-2 ${indent}`}>
          <div className="inline-flex items-center gap-1.5">
            {hasKids ? (
              <button
                onClick={() => toggle(myKey)}
                className="p-0.5 hover:bg-surface-muted rounded text-ink-tertiary hover:text-ink-primary transition"
                title={isOpen ? "Collapse" : "Expand"}
              >
                {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </button>
            ) : (
              <span className="inline-block w-[18px]" />
            )}
            <span className={labelStyle}>
              {node.level === "agent" ? titleCase(node.label) : node.label}
            </span>
          </div>
        </td>
        <td className="text-right px-4 py-2 tabular-nums">
          <button
            onClick={() => onDrill(node)}
            className="hover:underline hover:text-info-text transition-colors cursor-pointer"
            title="Click for tank details"
          >
            {node.count.toLocaleString("en-IN")}
          </button>
        </td>
      </tr>
      {isOpen &&
        node.children?.map((child) => {
          if (child.level === "activity") {
            return (
              <NodeRow
                key={k(child)}
                node={child}
                expanded={expanded}
                toggle={toggle}
                onDrill={onDrill}
                k={k}
                indent="pl-12"
                rowClass="bg-surface-subtle/30"
                labelStyle="font-medium text-ink-secondary text-[13px]"
              />
            );
          } else if (child.level === "from") {
            return (
              <NodeRow
                key={k(child)}
                node={child}
                expanded={expanded}
                toggle={toggle}
                onDrill={onDrill}
                k={k}
                indent="pl-20"
                rowClass=""
                labelStyle="text-ink-secondary text-[12px]"
              />
            );
          } else if (child.level === "to") {
            return (
              <NodeRow
                key={k(child)}
                node={child}
                expanded={expanded}
                toggle={toggle}
                onDrill={onDrill}
                k={k}
                indent="pl-28"
                rowClass=""
                labelStyle="italic text-ink-tertiary text-[12px]"
              />
            );
          } else if (child.level === "agent") {
            return (
              <NodeRow
                key={k(child)}
                node={child}
                expanded={expanded}
                toggle={toggle}
                onDrill={onDrill}
                k={k}
                indent="pl-36"
                rowClass=""
                labelStyle="text-ink-tertiary text-[11px]"
              />
            );
          }
          return null;
        })}
    </>
  );
}

function PrincipalRow({
  node,
  expanded,
  toggle,
  onDrill,
  k,
}: {
  node: InventoryNode;
  expanded: Set<string>;
  toggle: (key: string) => void;
  onDrill: (n: InventoryNode) => void;
  k: (n: InventoryNode) => string;
}) {
  const myKey = k(node);
  const isOpen = expanded.has(myKey);
  return (
    <>
      <tr className="subtotal-row border-b border-surface-border/60">
        <td className="px-4 py-2.5">
          <div className="inline-flex items-center gap-2">
            <button
              onClick={() => toggle(myKey)}
              className="p-0.5 hover:bg-surface-muted rounded text-ink-tertiary hover:text-ink-primary transition"
              title={isOpen ? "Collapse" : "Expand"}
            >
              {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            <CustomerAvatar name={node.label} />
            <span className="font-semibold text-ink-primary">
              {titleCase(node.label)}
            </span>
          </div>
        </td>
        <td className="text-right px-4 py-2.5 tabular-nums">
          <button
            onClick={() => onDrill(node)}
            className="font-semibold hover:underline hover:text-info-text transition-colors cursor-pointer"
            title="Click for tank details"
          >
            {node.count.toLocaleString("en-IN")}
          </button>
        </td>
      </tr>
      {isOpen &&
        node.children?.map((child) => (
          <NodeRow
            key={k(child)}
            node={child}
            expanded={expanded}
            toggle={toggle}
            onDrill={onDrill}
            k={k}
            indent="pl-12"
            rowClass="bg-surface-subtle/30"
            labelStyle="font-medium text-ink-secondary text-[13px]"
          />
        ))}
    </>
  );
}
