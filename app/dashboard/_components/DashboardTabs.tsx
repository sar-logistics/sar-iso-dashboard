"use client";
import { useState } from "react";
import { titleCase } from "@/lib/utils";
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
  creditNotes: number;
}

interface Props {
  kpis: Kpis;
  customerTrend: MonthlyTrendData;
  tradeLaneTrend: MonthlyTrendData;
}

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "customer", label: "Customer Detail" },
  { id: "tradelane", label: "Trade Lane Detail" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function DashboardTabs({ kpis, customerTrend, tradeLaneTrend }: Props) {
  const [tab, setTab] = useState<TabId>("overview");

  const topCustomers = customerTrend.rows.slice(0, 10).map((r) => ({
    name: titleCase(r.group),
    value: r.total,
  }));

  const topTradeLanes = tradeLaneTrend.rows.slice(0, 10).map((r) => ({
    name: r.group,
    value: r.total,
  }));

  const revenueMix = [
    { name: "Lease", value: kpis.lease },
    { name: "Detention", value: kpis.detention },
    { name: "EXIM", value: kpis.exim },
    { name: "M&R", value: kpis.mr },
    ...(kpis.unmapped > 0 ? [{ name: "Unmapped", value: kpis.unmapped }] : []),
  ].filter((d) => d.value > 0);

  // Monthly trend = sum of grand-total primary row across months
  const monthlyTrend = customerTrend.months.map((m) => {
    const primary = customerTrend.grandTotal.metrics.find((x) => x.level === "primary");
    return { month: m.label, value: primary?.monthly[m.key] || 0 };
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <KPICard
              label="Total Revenue"
              value={kpis.totalRevenue}
              subtitle={`Across ${kpis.totalRows.toLocaleString("en-IN")} invoice lines`}
              accent="bg-accent-green"
            />
            <KPICard
              label="Lease Revenue"
              value={kpis.lease}
              subtitle="Lease Rent Charges"
              accent="bg-accent-blue"
            />
            <KPICard
              label="Detention Revenue"
              value={kpis.detention}
              subtitle="Detention, DEM-IMP, DEM-EXP"
              accent="bg-accent-orange"
            />
            <KPICard
              label="EXIM Revenue"
              value={kpis.exim}
              subtitle="Freight, handling, docs, customs"
              accent="bg-accent-yellow"
            />
            <KPICard
              label="M&R Revenue"
              value={kpis.mr}
              subtitle="Repair, cleaning, storage"
              accent="bg-accent-pink"
            />
            <KPICard
              label="Credit Notes"
              value={kpis.creditNotes}
              subtitle="Net of all credits"
              accent="bg-accent-purple"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <HorizontalBarChart
              data={topTradeLanes}
              title="Revenue by Trade Lane"
              subtitle="Top 10 trade lanes (POL → POD)"
              color="#3B82F6"
            />
            <DonutChart
              data={revenueMix}
              title="Revenue Mix"
              subtitle="Distribution by charge category"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <HorizontalBarChart
              data={topCustomers}
              title="Top Customers"
              subtitle="Top 10 customers by total revenue"
              color="#22C55E"
            />
            <MonthlyTrendLine
              data={monthlyTrend}
              title="Monthly Revenue Trend"
              subtitle="Total revenue per month (excl. credit notes)"
              color="#A855F7"
            />
          </div>
        </>
      )}

      {tab === "customer" && (
        <MonthlyTrendTable
          data={customerTrend}
          groupBy="customer"
          title="Customer · Monthly Trend"
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
