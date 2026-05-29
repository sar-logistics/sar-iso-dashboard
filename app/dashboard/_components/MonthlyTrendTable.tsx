"use client";
import { useState } from "react";
import { titleCase } from "@/lib/utils";
import { CustomerAvatar } from "./CustomerAvatar";
import { DrillDownModal, DrillContext } from "./DrillDownModal";

export interface MonthlyTrendData {
  months: { key: string; label: string; year: number; month: number }[];
  rows: GroupBlock[];
  grandTotal: GroupBlock;
}

export interface GroupBlock {
  group: string; // customer name OR "POL → POD"
  total: number;
  metrics: MetricRow[];
}

export interface MetricRow {
  label: string;
  total: number;
  monthly: Record<string, number>;
  level: "primary" | "subtotal" | "detail";
  bucket?: "Detention" | "Export" | "M&R";
  chargeName?: string;
}

interface Props {
  data: MonthlyTrendData;
  /** "customer" or "tradeLane" — affects how group labels & avatars render */
  groupBy: "customer" | "tradeLane";
  title: string;
}

function fmtCompact(n: number): string {
  if (n === 0) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}
function cellClass(n: number): string {
  if (n === 0) return "text-ink-tertiary";
  return n < 0 ? "num-neg" : "";
}

export function MonthlyTrendTable({ data, groupBy, title }: Props) {
  const { months, rows, grandTotal } = data;
  const [drill, setDrill] = useState<DrillContext | null>(null);

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

    if (groupBy === "customer") {
      customer = isGrand ? null : group;
      groupLabel = isGrand ? "All Customers" : titleCase(group);
    } else {
      if (!isGrand) {
        const [p, q] = group.split(" → ");
        pol = p === "—" ? null : p;
        pod = q === "—" ? null : q;
      }
      groupLabel = isGrand ? "All Trade Lanes" : group;
    }

    setDrill({
      customer,
      pol,
      pod,
      customerLabel: groupLabel,
      year: mo.year,
      month: mo.month,
      monthLabel: mo.label,
      head: metric.label,
      bucket: metric.bucket || null,
      chargeName: metric.chargeName || null,
      level: metric.level,
      cellTotal: metric.monthly[mo.key] || 0,
    });
  };

  return (
    <>
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-wider text-ink-tertiary">
            {title}
          </div>
          <div className="text-[11px] text-ink-tertiary">
            Click any number for details · Monthly · USD
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="trend-table">
            <thead>
              <tr>
                <th className="left min-w-[200px]">
                  {groupBy === "customer" ? "Customer" : "Trade Lane (POL → POD)"}
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
                onDrill={(m, mo) => openDrill(grandTotal.group, true, m, mo)}
              />
              {rows.map((block) => (
                <BlockRows
                  key={block.group}
                  block={block}
                  months={months}
                  groupBy={groupBy}
                  onDrill={(m, mo) => openDrill(block.group, false, m, mo)}
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
  onDrill,
}: {
  block: GroupBlock;
  months: { key: string; label: string; year: number; month: number }[];
  isGrand?: boolean;
  groupBy: "customer" | "tradeLane";
  onDrill: (m: MetricRow, mo: typeof months[number]) => void;
}) {
  const metrics = block.metrics;
  const groupLabel =
    isGrand
      ? block.group
      : groupBy === "customer"
      ? titleCase(block.group)
      : block.group; // trade lane displayed as-is

  const avatarSource =
    isGrand ? "TT" : groupBy === "customer" ? block.group : block.group.replace(" → ", " ");

  return (
    <>
      {metrics.map((m, i) => {
        const rowClass =
          m.level === "primary"
            ? isGrand ? "total-row" : "subtotal-row"
            : m.level === "subtotal"
            ? "bucket-row"
            : "detail-row";

        const labelIndent = m.level === "detail" ? "pl-6" : m.level === "subtotal" ? "pl-2" : "";
        const labelStyle =
          m.level === "primary"
            ? "font-semibold"
            : m.level === "subtotal"
            ? "font-medium text-ink-secondary"
            : "italic text-ink-tertiary text-[12px]";

        return (
          <tr key={`${m.label}-${i}`} className={rowClass}>
            {i === 0 ? (
              <td className="left align-top" rowSpan={metrics.length}>
                <div className="flex items-center gap-2 pt-1">
                  <CustomerAvatar name={avatarSource} />
                  <span className={isGrand ? "font-semibold" : "font-medium"}>
                    {groupLabel}
                  </span>
                </div>
              </td>
            ) : null}
            <td className={`left ${labelIndent}`}>
              <span className={labelStyle}>
                {m.level === "detail" ? `↳ ${titleCase(m.label)}` : m.label}
              </span>
            </td>
            <td className={`bg-surface-subtle/40 ${cellClass(m.total)}`}>
              <span className={m.level === "primary" ? "font-semibold" : ""}>
                {fmtCompact(m.total)}
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
                      {fmtCompact(v)}
                    </button>
                  ) : (
                    <span>{fmtCompact(v)}</span>
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
