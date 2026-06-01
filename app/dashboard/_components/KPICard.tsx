"use client";
import { useCurrency } from "@/lib/currency-context";
import { fmtMoney } from "@/lib/currency-utils";

interface KPICardProps {
  label: string;
  value: number;
  subtitle?: string;
  /** Tailwind background color class for top bar, e.g. "bg-accent-green" */
  accent: string;
  /** Optional small warning text below value */
  warning?: string;
  /** If true (default), format as currency. If false, render as plain number. */
  currency?: boolean;
}

export function KPICard({
  label,
  value,
  subtitle,
  accent,
  warning,
  currency = true,
}: KPICardProps) {
  const cur = useCurrency();
  const formatted = currency
    ? fmtMoney(value, cur)
    : value.toLocaleString("en-IN");

  return (
    <div className="kpi-card">
      <div className={`kpi-bar ${accent}`} />
      <div className="p-4">
        <div className="kpi-label">{label}</div>
        <div className="kpi-value">{formatted}</div>
        {warning && (
          <div className="text-[11px] text-amber-700 mt-1.5 flex items-center gap-1">
            <span>⚠️</span>
            <span>{warning}</span>
          </div>
        )}
        {subtitle && !warning && <div className="kpi-sub">{subtitle}</div>}
      </div>
    </div>
  );
}
