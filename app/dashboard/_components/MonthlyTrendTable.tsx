"use client";
import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { titleCase } from "@/lib/utils";
import { useCurrency, fmtMoneyCompact, convert } from "@/lib/currency";
import { CustomerAvatar } from "./CustomerAvatar";
import { DrillDownModal, DrillContext } from "./DrillDownModal";

export interface MonthlyTrendData {
  months: { key: string; label: string; year: number; month: number }[];
  rows: GroupBlock[];
  grandTotal: GroupBlock;
}

export interface GroupBlock {
  group: string;
  total: number;
  metrics: MetricRow[];
}

export interface MetricRow {
  label: string;
  total: number;
  monthly: Record<string, number>;
  level: "primary" | "subtotal" | "detail";
  bucket?: string;
  chargeName?: string;
}

interface Props {
  data: MonthlyTrendData;
  groupBy: "customer" | "tradeLane";
  title: string;
}

function cellClass(n: number): string {
  if (n === 0) return "text-ink-tertiary";
  return n < 0 ? "num-neg" : "";
}

export function MonthlyTrendTable({ data, groupBy, title }: Props) {
  const { months, rows, grandTotal } = data;
  const [drill, setDrill] = useState<DrillContext | null>(null);
  const cur = useCurrency();
  const fmt = (n: number) =>
    n === 0 ? "—" : fmtMoneyCompact(n, cur);

  // Track expanded customer blocks (default: all expanded)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  // Track expanded subtotal-buckets (default: all collapsed — only show subtotals)
  const [expandedBuckets, setExpandedBuckets] = useState<Set<string>>(new Set());

  const toggleGroup = (g: string) => {
    setCollapsedGroups((p) => {
      const n = new Set(p);
      n.has(g) ? n.delete(g) : n.add(g);
      return n;
    });
  };
  const toggleBucket = (g: string, b: string) => {
    const key = `${g}|${b}`;
    setExpandedBuckets((p) => {
      const n = new Set(p);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  };
  const expandAll = () => {
    setCollapsedGroups(new Set());
    const all = new Set<string>();
    [grandTotal, ...rows].forEach((blk) => {
      blk.metrics.forEach((m) => {
        if (m.level === "subtotal" && m.bucket) all.add(`${blk.group}|${m.bucket}`);
      });
    });
    setExpandedBuckets(all);
  };
  const collapseAll = () => {
    const all = new Set<string>();
    [grandTotal, ...rows].forEach((blk) => all.add(blk.group));
    setCollapsedGroups(all);
    setExpandedBuckets(new Set());
  };

  const openDrill = (
    group: string,
    isGrand: boolean,
    metric: MetricRow,
    mo: typeof months[number]
  ) => {
    let customer: string | null = null;
    let pol: string | null = null;
    let pod: string | null = null;
    let groupLabel: string;
    let polEmpty = false;
    let podEmpty = false;

    if (groupBy === "customer") {
      customer = isGrand ? null : group;
      groupLabel = isGrand ? "All Agents" : titleCase(group);
    } else {
      if (!isGrand) {
        if (group === "No Trade Lane / Sundry") {
          // Both POL and POD must be empty/missing
          polEmpty = true;
          podEmpty = true;
        } else {
          const [p, q] = group.split(" → ");
          pol = p === "—" ? null : p;
          pod = q === "—" ? null : q;
          if (p === "—") polEmpty = true;
          if (q === "—") podEmpty = true;
        }
      }
      groupLabel = isGrand ? "All Trade Lanes" : group;
    }

    setDrill({
      customer,
      pol,
      pod,
      polEmpty,
      podEmpty,
      customerLabel: groupLabel,
      year: mo.year,
      month: mo.month,
      monthLabel: mo.label,
      head: metric.label,
      bucket: (metric.bucket as any) || null,
      chargeName: metric.chargeName || null,
      level: metric.level,
      cellTotal: metric.monthly[mo.key] || 0,
    });
  };

  return (
    <>
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between flex-wrap gap-3">
          <div className="text-[11px] uppercase tracking-wider text-ink-tertiary">
            {title}
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
              Click any number for details · Monthly · USD
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="trend-table">
            <thead>
              <tr>
                <th className="left min-w-[220px]">
                  {groupBy === "customer" ? "Agent" : "Trade Lane (POL → POD)"}
                </th>
                <th className="left min-w-[180px]">Metric / Charge Name</th>
                <th className="min-w-[110px] bg-surface-subtle/80">Grand Total</th>
                {months.map((m) => (
                  <th key={m.key} className="min-w-[80px]">{m.label}</th>
                ))}
              </tr>
            </thead>

            <tbody>
              <BlockRows
                block={grandTotal}
                months={months}
                isGrand
                groupBy={groupBy}
                collapsed={collapsedGroups.has(grandTotal.group)}
                expandedBuckets={expandedBuckets}
                onToggleGroup={() => toggleGroup(grandTotal.group)}
                onToggleBucket={(b) => toggleBucket(grandTotal.group, b)}
                onDrill={(m, mo) => openDrill(grandTotal.group, true, m, mo)}
                fmt={fmt}
              />
              {rows.map((block) => (
                <BlockRows
                  key={block.group}
                  block={block}
                  months={months}
                  groupBy={groupBy}
                  collapsed={collapsedGroups.has(block.group)}
                  expandedBuckets={expandedBuckets}
                  onToggleGroup={() => toggleGroup(block.group)}
                  onToggleBucket={(b) => toggleBucket(block.group, b)}
                  onDrill={(m, mo) => openDrill(block.group, false, m, mo)}
                  fmt={fmt}
                />
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={3 + months.length} className="left text-ink-tertiary py-6">
                    No data in the selected range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <DrillDownModal ctx={drill} onClose={() => setDrill(null)} />
    </>
  );
}

function BlockRows({
  block,
  months,
  isGrand = false,
  groupBy,
  collapsed,
  expandedBuckets,
  onToggleGroup,
  onToggleBucket,
  onDrill,
  fmt,
}: {
  block: GroupBlock;
  months: { key: string; label: string; year: number; month: number }[];
  isGrand?: boolean;
  groupBy: "customer" | "tradeLane";
  collapsed: boolean;
  expandedBuckets: Set<string>;
  onToggleGroup: () => void;
  onToggleBucket: (bucket: string) => void;
  onDrill: (m: MetricRow, mo: typeof months[number]) => void;
  fmt: (n: number) => string;
}) {
  const groupLabel = isGrand
    ? block.group
    : groupBy === "customer"
    ? titleCase(block.group)
    : block.group;

  const avatarSource = isGrand
    ? "TT"
    : groupBy === "customer"
    ? block.group
    : block.group.replace(" → ", " ");

  // Filter metrics by collapse/expand state
  let visibleMetrics: MetricRow[];
  if (collapsed) {
    // Show only the primary "Revenue" row
    visibleMetrics = block.metrics.filter((m) => m.level === "primary");
  } else {
    // Show all subtotals + details (only if their bucket is expanded)
    visibleMetrics = block.metrics.filter((m) => {
      if (m.level === "primary" || m.level === "subtotal") return true;
      if (m.level === "detail") {
        return expandedBuckets.has(`${block.group}|${m.bucket}`);
      }
      return false;
    });
  }

  return (
    <>
      {visibleMetrics.map((m, i) => {
        const rowClass =
          m.level === "primary"
            ? isGrand
              ? "total-row"
              : "subtotal-row"
            : m.level === "subtotal"
            ? "bucket-row"
            : "detail-row";

        const labelIndent =
          m.level === "detail" ? "pl-6" : m.level === "subtotal" ? "pl-2" : "";
        const labelStyle =
          m.level === "primary"
            ? "font-semibold"
            : m.level === "subtotal"
            ? "font-medium text-ink-secondary"
            : "italic text-ink-tertiary text-[12px]";

        // Decide if subtotal row should show expand chevron (has details available)
        const subtotalKey = m.bucket ? `${block.group}|${m.bucket}` : "";
        const isBucketExpanded = m.bucket && expandedBuckets.has(subtotalKey);
        const hasDetails =
          m.level === "subtotal" &&
          block.metrics.some(
            (x) => x.level === "detail" && x.bucket === m.bucket
          );

        return (
          <tr key={`${m.label}-${i}`} className={rowClass}>
            {i === 0 ? (
              <td className="left align-top" rowSpan={visibleMetrics.length}>
                <div className="flex items-center gap-1.5 pt-1">
                  <button
                    onClick={onToggleGroup}
                    className="p-0.5 hover:bg-surface-muted rounded text-ink-tertiary hover:text-ink-primary transition"
                    title={collapsed ? "Expand" : "Collapse"}
                  >
                    {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  </button>
                  <CustomerAvatar name={avatarSource} />
                  <span className={isGrand ? "font-semibold" : "font-medium"}>
                    {groupLabel}
                  </span>
                </div>
              </td>
            ) : null}
            <td className={`left ${labelIndent}`}>
              <span className={`inline-flex items-center gap-1 ${labelStyle}`}>
                {hasDetails && m.bucket && (
                  <button
                    onClick={() => onToggleBucket(m.bucket!)}
                    className="text-ink-tertiary hover:text-ink-primary p-0"
                    title={isBucketExpanded ? "Hide charges" : "Show charges"}
                  >
                    {isBucketExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                  </button>
                )}
                {m.level === "detail" ? `↳ ${titleCase(m.label)}` : m.label}
              </span>
            </td>
            <td className={`bg-surface-subtle/40 ${cellClass(m.total)}`}>
              <span className={m.level === "primary" ? "font-semibold" : ""}>
                {fmt(m.total)}
              </span>
            </td>
            {months.map((mo) => {
              const v = m.monthly[mo.key] || 0;
              return (
                <td key={mo.key} className={cellClass(v)}>
                  {v !== 0 ? (
                    <button
                      onClick={() => onDrill(m, mo)}
                      className="hover:underline hover:text-info-text transition-colors cursor-pointer"
                      title={`Click for details — ${mo.label}`}
                    >
                      {fmt(v)}
                    </button>
                  ) : (
                    <span>{fmt(v)}</span>
                  )}
                </td>
              );
            })}
          </tr>
        );
      })}
    </>
  );
}
