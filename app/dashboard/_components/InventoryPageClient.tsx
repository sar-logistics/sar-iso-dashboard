"use client";
import { useState } from "react";
import { KPICard } from "./KPICard";
import { HorizontalBarChart, DonutChart } from "./RevenueCharts";
import { InventoryPivotTable } from "./InventoryPivotTable";
import {
  InventoryDrillModal,
  InventoryDrillContext,
} from "./InventoryDrillModal";
import type { InventoryNode } from "@/lib/inventoryTree";
import { titleCase } from "@/lib/utils";

interface Kpis {
  total: number;
  empty: number;
  loadedFull: number;
  onLease: number;
  underCleaning: number;
  underRepair: number;
  underSurvey: number;
  sentToConsignee: number;
  other: number;
}

interface Props {
  kpis: Kpis;
  byActivity: { label: string; count: number }[];
  byPrincipal: { label: string; count: number }[];
  byAgent: { label: string; count: number }[];
  rows: InventoryNode[];
}

export function InventoryPageClient({
  kpis,
  byActivity,
  byPrincipal,
  byAgent,
  rows,
}: Props) {
  const [drill, setDrill] = useState<InventoryDrillContext | null>(null);

  const onKpiClick = (kpi: string, label: string, count: number) => {
    setDrill({
      title: label,
      subtitle: `${count.toLocaleString("en-IN")} tanks`,
      cellCount: count,
      kpi,
    });
  };

  // Top 8 activities for donut (rest grouped as "Other")
  const donutData = (() => {
    const top = byActivity.slice(0, 7);
    const others = byActivity.slice(7);
    const otherSum = others.reduce((s, x) => s + x.count, 0);
    const data = top.map((a) => ({ name: a.label, value: a.count }));
    if (otherSum > 0) data.push({ name: "Other", value: otherSum });
    return data;
  })();

  const principalBarData = byPrincipal.map((p) => ({
    name: titleCase(p.label),
    value: p.count,
  }));

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-9 gap-3 mb-6">
        <KPIClickable
          label="Total Tanks"
          value={kpis.total}
          subtitle="All containers"
          accent="bg-accent-green"
          onClick={() => onKpiClick("", "All Tanks", kpis.total)}
          isCount
        />
        <KPIClickable
          label="Empty Tanks"
          value={kpis.empty}
          subtitle="Available + allocated"
          accent="bg-accent-blue"
          onClick={() => onKpiClick("empty", "Empty Tanks", kpis.empty)}
          isCount
        />
        <KPIClickable
          label="Loaded Full"
          value={kpis.loadedFull}
          subtitle="With cargo"
          accent="bg-accent-purple"
          onClick={() =>
            onKpiClick("loadedFull", "Loaded Full", kpis.loadedFull)
          }
          isCount
        />
        <KPIClickable
          label="Sent to Consignee"
          value={kpis.sentToConsignee}
          subtitle="In transit / delivered"
          accent="bg-accent-yellow"
          onClick={() =>
            onKpiClick(
              "sentToConsignee",
              "Sent to Consignee",
              kpis.sentToConsignee
            )
          }
          isCount
        />
        <KPIClickable
          label="On Lease"
          value={kpis.onLease}
          subtitle="Sub-leased / on hire"
          accent="bg-accent-pink"
          onClick={() => onKpiClick("onLease", "On Lease", kpis.onLease)}
          isCount
        />
        <KPIClickable
          label="Under Cleaning"
          value={kpis.underCleaning}
          subtitle="Wash / clean"
          accent="bg-accent-orange"
          onClick={() =>
            onKpiClick("underCleaning", "Under Cleaning", kpis.underCleaning)
          }
          isCount
        />
        <KPIClickable
          label="Under Repair"
          value={kpis.underRepair}
          subtitle="In repair shop"
          accent="bg-accent-orange"
          onClick={() =>
            onKpiClick("underRepair", "Under Repair", kpis.underRepair)
          }
          isCount
        />
        <KPIClickable
          label="Under Survey"
          value={kpis.underSurvey}
          subtitle="Inspection / survey"
          accent="bg-accent-blue"
          onClick={() =>
            onKpiClick("underSurvey", "Under Survey", kpis.underSurvey)
          }
          isCount
        />
        <KPIClickable
          label="Other Activity"
          value={kpis.other}
          subtitle="Movement, positioning, etc."
          accent="bg-accent-purple"
          onClick={() => onKpiClick("other", "Other Activity", kpis.other)}
          isCount
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <HorizontalBarChart
          data={principalBarData}
          title="Tanks by Principal"
          subtitle="Top principals by current tank count"
          color="#22C55E"
          valueFormatter={(n) => n.toLocaleString("en-IN")}
          tooltipLabel="Tanks"
        />
        <DonutChart
          data={donutData}
          title="Tanks by Activity"
          subtitle="Current status distribution"
          valueFormatter={(n) => n.toLocaleString("en-IN")}
        />
      </div>

      {byAgent.length > 0 && (
        <div className="grid grid-cols-1 gap-4 mb-4">
          <HorizontalBarChart
            data={byAgent.map((a) => ({
              name: a.label
                .split(" ")
                .map((w) =>
                  w.length > 2
                    ? w[0].toUpperCase() + w.slice(1).toLowerCase()
                    : w
                )
                .join(" "),
              value: a.count,
            }))}
            title="Tanks by Agent"
            subtitle="Top 10 agents holding your tanks right now"
            color="#A855F7"
            valueFormatter={(n) => n.toLocaleString("en-IN")}
            tooltipLabel="Tanks"
          />
        </div>
      )}

      <InventoryPivotTable rows={rows} totalCount={kpis.total} />

      <InventoryDrillModal ctx={drill} onClose={() => setDrill(null)} />
    </>
  );
}

function KPIClickable({
  label,
  value,
  subtitle,
  accent,
  onClick,
  isCount,
}: {
  label: string;
  value: number;
  subtitle: string;
  accent: string;
  onClick: () => void;
  isCount?: boolean;
}) {
  // Render a button-styled KPI card so the whole card is clickable
  return (
    <button
      onClick={onClick}
      className="card overflow-hidden text-left hover:shadow-md transition-all"
      title="Click for tank details"
    >
      <div className={`h-1 ${accent}`} />
      <div className="px-4 py-3">
        <div className="text-[11px] uppercase tracking-wider text-ink-tertiary mb-1">
          {label}
        </div>
        <div className="text-2xl font-semibold text-ink-primary tabular-nums">
          {isCount ? value.toLocaleString("en-IN") : value}
        </div>
        <div className="text-[11px] text-ink-tertiary mt-1">{subtitle}</div>
      </div>
    </button>
  );
}
