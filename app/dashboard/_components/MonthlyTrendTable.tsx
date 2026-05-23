import { fmtUSD } from "@/lib/utils";
import { titleCase } from "@/lib/utils";
import { CustomerAvatar } from "./CustomerAvatar";

export interface MonthlyTrendData {
  months: { key: string; label: string }[]; // e.g. { key: "2025-04", label: "APR '25" }
  rows: CustomerBlock[];
  grandTotal: CustomerBlock; // a virtual "block" representing all customers
}

export interface CustomerBlock {
  customer: string;
  metrics: MetricRow[];
}

export interface MetricRow {
  label: string; // "Revenue", "Detention", "Export", "M&R"
  total: number;
  monthly: Record<string, number>; // month key -> value
  isPrimary?: boolean; // bold "Revenue" row
}

interface Props {
  data: MonthlyTrendData;
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

export function MonthlyTrendTable({ data }: Props) {
  const { months, rows, grandTotal } = data;

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-wider text-ink-tertiary">
          Sales · Customer · Monthly Trend
        </div>
        <div className="text-[11px] text-ink-tertiary">Monthly · USD</div>
      </div>

      <div className="overflow-x-auto">
        <table className="trend-table">
          <thead>
            <tr>
              <th className="left min-w-[200px]">Customer</th>
              <th className="left min-w-[120px]">Metric</th>
              <th className="min-w-[110px] bg-surface-subtle/80">Grand Total</th>
              {months.map((m) => (
                <th key={m.key} className="min-w-[80px]">{m.label}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {/* Grand Total block (all customers combined) */}
            <BlockRows block={grandTotal} months={months} isGrand />
            {/* Top customer blocks */}
            {rows.map((block) => (
              <BlockRows key={block.customer} block={block} months={months} />
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3 + months.length} className="left text-ink-tertiary py-6">
                  No sales data in the selected range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BlockRows({
  block,
  months,
  isGrand = false,
}: {
  block: CustomerBlock;
  months: { key: string; label: string }[];
  isGrand?: boolean;
}) {
  const metrics = block.metrics;
  return (
    <>
      {metrics.map((m, i) => {
        const rowClass = m.isPrimary
          ? isGrand
            ? "total-row"
            : "subtotal-row"
          : "metric-row";
        return (
          <tr key={m.label} className={rowClass}>
            {i === 0 ? (
              <td className="left align-top" rowSpan={metrics.length}>
                <div className="flex items-center gap-2 pt-1">
                  <CustomerAvatar name={isGrand ? "TT" : block.customer} />
                  <span className={isGrand ? "font-semibold" : ""}>
                    {isGrand ? "ALL CUSTOMERS" : titleCase(block.customer)}
                  </span>
                </div>
              </td>
            ) : null}
            <td className="left">
              <span className={m.isPrimary ? "font-medium" : "italic text-ink-tertiary"}>
                {m.label}
              </span>
            </td>
            <td className={`bg-surface-subtle/40 ${cellClass(m.total)}`}>
              <span className={m.isPrimary ? "font-semibold" : ""}>
                {fmtCompact(m.total)}
              </span>
            </td>
            {months.map((mo) => {
              const v = m.monthly[mo.key] || 0;
              return (
                <td key={mo.key} className={cellClass(v)}>
                  {fmtCompact(v)}
                </td>
              );
            })}
          </tr>
        );
      })}
    </>
  );
}
