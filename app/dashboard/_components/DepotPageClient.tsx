"use client";
import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { titleCase } from "@/lib/utils";
import { CustomerAvatar } from "./CustomerAvatar";
import { HorizontalBarChart, DonutChart } from "./RevenueCharts";
import { DepotDrillModal, DepotDrillContext } from "./DepotDrillModal";
import type { DepotRow, DepotData } from "@/lib/depotData";

interface Props {
  data: DepotData;
}

function clickableCount(
  value: number,
  onClick: () => void,
  isBold = false
) {
  if (value === 0) return <span className="text-ink-tertiary">—</span>;
  return (
    <button
      onClick={onClick}
      className={`hover:underline hover:text-info-text transition-colors tabular-nums ${
        isBold ? "font-semibold" : ""
      }`}
      title="Click for tank details"
    >
      {value.toLocaleString("en-IN")}
    </button>
  );
}

export function DepotPageClient({ data }: Props) {
  const [drill, setDrill] = useState<DepotDrillContext | null>(null);
  const [collapsedCountries, setCollapsedCountries] = useState<Set<string>>(
    new Set()
  );

  // Group rows by country
  const grouped = (() => {
    const m = new Map<
      string,
      {
        country: string;
        rows: DepotRow[];
        totals: {
          allocated: number;
          underCleaning: number;
          underRepair: number;
          underSurvey: number;
          available: number;
          atDepot: number;
          buckets: Record<string, number>;
        };
      }
    >();
    for (const r of data.rows) {
      if (!m.has(r.country))
        m.set(r.country, {
          country: r.country,
          rows: [],
          totals: {
            allocated: 0,
            underCleaning: 0,
            underRepair: 0,
            underSurvey: 0,
            available: 0,
            atDepot: 0,
            buckets: {},
          },
        });
      const g = m.get(r.country)!;
      g.rows.push(r);
      g.totals.allocated += r.allocated;
      g.totals.underCleaning += r.underCleaning;
      g.totals.underRepair += r.underRepair;
      g.totals.underSurvey += r.underSurvey;
      g.totals.available += r.totalAvailable;
      g.totals.atDepot += r.totalAtDepot;
      for (const b of data.ageingBuckets) {
        g.totals.buckets[b] =
          (g.totals.buckets[b] || 0) + (r.availableBuckets[b] || 0);
      }
    }
    return [...m.values()].sort((a, b) => b.totals.atDepot - a.totals.atDepot);
  })();

  const toggle = (c: string) =>
    setCollapsedCountries((p) => {
      const n = new Set(p);
      n.has(c) ? n.delete(c) : n.add(c);
      return n;
    });
  const expandAll = () => setCollapsedCountries(new Set());
  const collapseAll = () =>
    setCollapsedCountries(new Set(grouped.map((g) => g.country)));

  const openDrill = (ctx: DepotDrillContext) => setDrill(ctx);

  const onKpiClick = (
    bucketKey: string,
    title: string,
    count: number
  ) => {
    setDrill({
      title,
      subtitle: `${count.toLocaleString("en-IN")} tanks across all depots`,
      cellCount: count,
      bucket: bucketKey,
    });
  };

  const byCountryBar = data.byCountry.slice(0, 10).map((c) => ({
    name: c.label,
    value: c.count,
  }));
  const statusDonut = data.statusMix.map((s) => ({
    name: s.label,
    value: s.count,
  }));

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        <KPIClickable
          label="Total at Depot"
          value={data.kpis.total}
          subtitle="All depot stock"
          accent="bg-accent-green"
          onClick={() => onKpiClick("", "All Tanks at Depot", data.kpis.total)}
        />
        <KPIClickable
          label="Allocated"
          value={data.kpis.allocated}
          subtitle="Assigned tanks"
          accent="bg-accent-blue"
          onClick={() =>
            onKpiClick("allocated", "Allocated Tanks", data.kpis.allocated)
          }
        />
        <KPIClickable
          label="Available"
          value={data.kpis.available}
          subtitle="Ready to deploy"
          accent="bg-accent-purple"
          onClick={() =>
            onKpiClick("available", "Available Tanks", data.kpis.available)
          }
        />
        <KPIClickable
          label="Under Cleaning"
          value={data.kpis.underCleaning}
          subtitle="In wash / clean"
          accent="bg-accent-yellow"
          onClick={() =>
            onKpiClick(
              "underCleaning",
              "Tanks Under Cleaning",
              data.kpis.underCleaning
            )
          }
        />
        <KPIClickable
          label="Under Repair"
          value={data.kpis.underRepair}
          subtitle="In repair shop"
          accent="bg-accent-orange"
          onClick={() =>
            onKpiClick(
              "underRepair",
              "Tanks Under Repair",
              data.kpis.underRepair
            )
          }
        />
        <KPIClickable
          label="Under Survey"
          value={data.kpis.underSurvey}
          subtitle="In inspection"
          accent="bg-accent-blue"
          onClick={() =>
            onKpiClick(
              "underSurvey",
              "Tanks Under Survey",
              data.kpis.underSurvey
            )
          }
        />
        <KPIClickable
          label="Aged > 60 Days"
          value={data.kpis.agedOver60}
          subtitle="Long-sitting tanks"
          accent="bg-accent-pink"
          onClick={() =>
            onKpiClick("", "Aged Over 60 Days", data.kpis.agedOver60)
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <HorizontalBarChart
          data={byCountryBar}
          title="Tanks by Country"
          subtitle="Top depots aggregated by country"
          color="#3B82F6"
        />
        <DonutChart
          data={statusDonut}
          title="Tank Status Mix"
          subtitle="Distribution across all depots"
        />
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between flex-wrap gap-3">
          <div className="text-[11px] uppercase tracking-wider text-ink-tertiary">
            Depot · Country › Depot · Ageing buckets
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
              Click any number for tank details
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-ink-tertiary border-b border-surface-border bg-surface-subtle/70">
                <th className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wider min-w-[260px]">
                  Country / Depot
                </th>
                <th className="text-right px-3 py-2.5 text-[11px] uppercase tracking-wider min-w-[80px]">
                  At Depot
                </th>
                <th className="text-right px-3 py-2.5 text-[11px] uppercase tracking-wider min-w-[80px]">
                  Allocated
                </th>
                <th className="text-right px-3 py-2.5 text-[11px] uppercase tracking-wider min-w-[90px]">
                  Cleaning
                </th>
                <th className="text-right px-3 py-2.5 text-[11px] uppercase tracking-wider min-w-[80px]">
                  Repair
                </th>
                <th className="text-right px-3 py-2.5 text-[11px] uppercase tracking-wider min-w-[80px]">
                  Survey
                </th>
                {data.ageingBuckets.map((b) => (
                  <th
                    key={b}
                    className="text-right px-3 py-2.5 text-[11px] uppercase tracking-wider min-w-[80px]"
                    title={b}
                  >
                    {b.replace(/^Available\s*/i, "").trim() || b}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grouped.map((g) => {
                const isCollapsed = collapsedCountries.has(g.country);
                return (
                  <>
                    <tr
                      key={`c-${g.country}`}
                      className="subtotal-row border-b border-surface-border/60"
                    >
                      <td className="px-4 py-2.5">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => toggle(g.country)}
                            className="p-0.5 hover:bg-surface-muted rounded text-ink-tertiary hover:text-ink-primary transition"
                          >
                            {isCollapsed ? (
                              <ChevronRight size={14} />
                            ) : (
                              <ChevronDown size={14} />
                            )}
                          </button>
                          <CustomerAvatar name={g.country} />
                          <span className="font-semibold text-ink-primary">
                            {g.country}
                          </span>
                          <span className="text-ink-tertiary text-[11px] font-normal">
                            · {g.rows.length} depot{g.rows.length === 1 ? "" : "s"}
                          </span>
                        </div>
                      </td>
                      <td className="text-right px-3 py-2.5">
                        {clickableCount(
                          g.totals.atDepot,
                          () =>
                            openDrill({
                              title: `${g.country} — All Tanks`,
                              subtitle: `${g.rows.length} depots · ${g.totals.atDepot} tanks`,
                              cellCount: g.totals.atDepot,
                              country: g.country,
                            }),
                          true
                        )}
                      </td>
                      <td className="text-right px-3 py-2.5">
                        {clickableCount(g.totals.allocated, () =>
                          openDrill({
                            title: `${g.country} — Allocated`,
                            subtitle: `${g.totals.allocated} allocated tanks`,
                            cellCount: g.totals.allocated,
                            country: g.country,
                            bucket: "allocated",
                          })
                        )}
                      </td>
                      <td className="text-right px-3 py-2.5">
                        {clickableCount(g.totals.underCleaning, () =>
                          openDrill({
                            title: `${g.country} — Under Cleaning`,
                            subtitle: `${g.totals.underCleaning} tanks under cleaning`,
                            cellCount: g.totals.underCleaning,
                            country: g.country,
                            bucket: "underCleaning",
                          })
                        )}
                      </td>
                      <td className="text-right px-3 py-2.5">
                        {clickableCount(g.totals.underRepair, () =>
                          openDrill({
                            title: `${g.country} — Under Repair`,
                            subtitle: `${g.totals.underRepair} tanks under repair`,
                            cellCount: g.totals.underRepair,
                            country: g.country,
                            bucket: "underRepair",
                          })
                        )}
                      </td>
                      <td className="text-right px-3 py-2.5">
                        {clickableCount(g.totals.underSurvey, () =>
                          openDrill({
                            title: `${g.country} — Under Survey`,
                            subtitle: `${g.totals.underSurvey} tanks under survey`,
                            cellCount: g.totals.underSurvey,
                            country: g.country,
                            bucket: "underSurvey",
                          })
                        )}
                      </td>
                      {data.ageingBuckets.map((b) => (
                        <td
                          key={`${g.country}-${b}`}
                          className="text-right px-3 py-2.5"
                        >
                          {clickableCount(g.totals.buckets[b] || 0, () =>
                            openDrill({
                              title: `${g.country} — ${b}`,
                              subtitle: `${g.totals.buckets[b] || 0} tanks (ageing ${b})`,
                              cellCount: g.totals.buckets[b] || 0,
                              country: g.country,
                              ageing: b,
                            })
                          )}
                        </td>
                      ))}
                    </tr>
                    {!isCollapsed &&
                      g.rows.map((r) => (
                        <tr
                          key={r._id}
                          className="border-b border-surface-border/40"
                        >
                          <td className="px-4 py-2 pl-12 text-ink-secondary">
                            <div className="text-[13px]">
                              {titleCase(r.depotName)}
                            </div>
                            <div className="text-[10px] text-ink-tertiary">
                              {r.port} · {titleCase(r.agent)}
                            </div>
                          </td>
                          <td className="text-right px-3 py-2">
                            {clickableCount(
                              r.totalAtDepot,
                              () =>
                                openDrill({
                                  title: `${titleCase(r.depotName)} — All Tanks`,
                                  subtitle: `${r.port}, ${r.country} · ${r.totalAtDepot} tanks`,
                                  cellCount: r.totalAtDepot,
                                  depot: r.depotName,
                                  port: r.port,
                                }),
                              true
                            )}
                          </td>
                          <td className="text-right px-3 py-2">
                            {clickableCount(r.allocated, () =>
                              openDrill({
                                title: `${titleCase(r.depotName)} — Allocated`,
                                subtitle: `${r.port} · ${r.allocated} tanks`,
                                cellCount: r.allocated,
                                depot: r.depotName,
                                port: r.port,
                                bucket: "allocated",
                              })
                            )}
                          </td>
                          <td className="text-right px-3 py-2">
                            {clickableCount(r.underCleaning, () =>
                              openDrill({
                                title: `${titleCase(r.depotName)} — Under Cleaning`,
                                subtitle: `${r.port} · ${r.underCleaning} tanks`,
                                cellCount: r.underCleaning,
                                depot: r.depotName,
                                port: r.port,
                                bucket: "underCleaning",
                              })
                            )}
                          </td>
                          <td className="text-right px-3 py-2">
                            {clickableCount(r.underRepair, () =>
                              openDrill({
                                title: `${titleCase(r.depotName)} — Under Repair`,
                                subtitle: `${r.port} · ${r.underRepair} tanks`,
                                cellCount: r.underRepair,
                                depot: r.depotName,
                                port: r.port,
                                bucket: "underRepair",
                              })
                            )}
                          </td>
                          <td className="text-right px-3 py-2">
                            {clickableCount(r.underSurvey, () =>
                              openDrill({
                                title: `${titleCase(r.depotName)} — Under Survey`,
                                subtitle: `${r.port} · ${r.underSurvey} tanks`,
                                cellCount: r.underSurvey,
                                depot: r.depotName,
                                port: r.port,
                                bucket: "underSurvey",
                              })
                            )}
                          </td>
                          {data.ageingBuckets.map((b) => (
                            <td
                              key={`${r._id}-${b}`}
                              className="text-right px-3 py-2"
                            >
                              {clickableCount(
                                r.availableBuckets[b] || 0,
                                () =>
                                  openDrill({
                                    title: `${titleCase(r.depotName)} — ${b}`,
                                    subtitle: `${r.port} · ${r.availableBuckets[b] || 0} tanks`,
                                    cellCount: r.availableBuckets[b] || 0,
                                    depot: r.depotName,
                                    port: r.port,
                                    ageing: b,
                                  })
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                  </>
                );
              })}
              {grouped.length === 0 && (
                <tr>
                  <td
                    colSpan={6 + data.ageingBuckets.length}
                    className="px-4 py-8 text-center text-ink-tertiary"
                  >
                    No depot data. Click Sync Now to pull from Google Sheets.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <DepotDrillModal ctx={drill} onClose={() => setDrill(null)} />
    </>
  );
}

function KPIClickable({
  label,
  value,
  subtitle,
  accent,
  onClick,
}: {
  label: string;
  value: number;
  subtitle: string;
  accent: string;
  onClick: () => void;
}) {
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
          {value.toLocaleString("en-IN")}
        </div>
        <div className="text-[11px] text-ink-tertiary mt-1">{subtitle}</div>
      </div>
    </button>
  );
}
