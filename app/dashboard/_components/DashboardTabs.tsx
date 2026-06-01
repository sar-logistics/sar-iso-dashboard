"use client";
import { useState } from "react";
import { titleCase } from "@/lib/utils";
import { useCurrency, fmtMoneyCompact, convert } from "@/lib/currency";
import { KPICard } from "./KPICard";
import { MonthlyTrendTable, MonthlyTrendData } from "./MonthlyTrendTable";
import {
  HorizontalBarChart,
  DonutChart,
  MonthlyTrendLine,
} from "./RevenueCharts";

interface Kpis {
  totalRevenue: number;
  totalRows: number;
  lease: number;
  detention: number;
  exim: number;
  mr: number;
  unmapped: number;
}

interface Props {
  kpis: Kpis;
  customerTrend: MonthlyTrendData;
  tradeLaneTrend: MonthlyTrendData;
}

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "customer", label: "Agent Detail" },
  { id: "tradelane", label: "Trade Lane Detail" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function DashboardTabs({ kpis, customerTrend, tradeLaneTrend }: Props) {
  const [tab, setTab] = useState<TabId>("overview");
  const cur = useCurrency();
  const moneyFmt = (n: number) => fmtMoneyCompact(n, cur);

  // Convert raw USD values to the chosen currency before charts render
  const topCustomers = customerTrend.rows.slice(0, 10).map((r) => ({
    name: titleCase(r.group),
    value: convert(r.total, cur),
  }));

  const topTradeLanes = tradeLaneTrend.rows
    .filter((r) => r.group !== "No Trade Lane / Sundry")
    .slice(0, 10)
    .map((r) => ({
      name: r.group,
      value: convert(r.total, cur),
    }));

  const revenueMix = [
    { name: "Lease", value: convert(kpis.lease, cur) },
    { name: "Detention", value: convert(kpis.detention, cur) },
    { name: "EXIM", value: convert(kpis.exim, cur) },
    { name: "M&R", value: convert(kpis.mr, cur) },
    ...(kpis.unmapped > 0
      ? [{ name: "Unmapped", value: convert(kpis.unmapped, cur) }]
      : []),
  ].filter((d) => d.value > 0);

  const monthlyTrend = customerTrend.months.map((m) => {
    const primary = customerTrend.grandTotal.metrics.find(
      (x) => x.level === "primary"
    );
    return {
      month: m.label,
      value: convert(primary?.monthly[m.key] || 0, cur),
    };
  });

  return (
    <>
      <div className="border-b border-surface-border mb-6 flex gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
              tab === t.id
                ? "border-accent-green text-ink-primary"
                : "border-transparent text-ink-tertiary hover:text-ink-primary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
            <KPICard
              label="Total Revenue"
              value={kpis.totalRevenue}
              subtitle={`Net of credit notes · ${kpis.totalRows.toLocaleString("en-IN")} lines`}
              accent="bg-accent-green"
            />
            <KPICard
              label="Lease Revenue"
              value={kpis.lease}
              subtitle="Net of credit notes"
              accent="bg-accent-blue"
            />
            <KPICard
              label="Detention Revenue"
              value={kpis.detention}
              subtitle="Net of credit notes"
              accent="bg-accent-orange"
            />
            <KPICard
              label="EXIM Revenue"
              value={kpis.exim}
              subtitle="Net of credit notes"
              accent="bg-accent-yellow"
            />
            <KPICard
              label="M&R Revenue"
              value={kpis.mr}
              subtitle="Net of credit notes"
              accent="bg-accent-pink"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <HorizontalBarChart
              data={topTradeLanes}
              title="Revenue by Trade Lane"
              subtitle="Top 10 trade lanes (excludes sundry / no-BL entries)"
              color="#3B82F6"
              valueFormatter={moneyFmt}
            />
            <DonutChart
              data={revenueMix}
              title="Revenue Mix"
              subtitle="Distribution by charge category"
              valueFormatter={moneyFmt}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <HorizontalBarChart
              data={topCustomers}
              title="Top Agents"
              subtitle="Top 10 agents by total revenue"
              color="#22C55E"
              valueFormatter={moneyFmt}
            />
            <MonthlyTrendLine
              data={monthlyTrend}
              title="Revenue Trend"
              subtitle="Total revenue per period (net of credit notes)"
              color="#A855F7"
              valueFormatter={moneyFmt}
            />
          </div>
        </>
      )}

      {tab === "customer" && (
        <MonthlyTrendTable
          data={customerTrend}
          groupBy="customer"
          title="Agent · Monthly Trend"
        />
      )}

      {tab === "tradelane" && (
        <MonthlyTrendTable
          data={tradeLaneTrend}
          groupBy="tradeLane"
          title="Trade Lane (POL → POD) · Monthly Trend"
        />
      )}
    </>
  );
}
