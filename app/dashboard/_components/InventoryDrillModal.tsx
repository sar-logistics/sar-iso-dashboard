"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { titleCase } from "@/lib/utils";

interface DetailRow {
  _id: string;
  containerNo: string;
  size: string;
  type: string;
  principal: string;
  activityName: string;
  activityDate: string | null;
  idleDays: number | null;
  agent: string;
  agentBranch: string;
  fromLocation: string;
  toLocation: string;
}

export interface InventoryDrillContext {
  title: string;
  subtitle: string;
  cellCount: number;
  principal?: string | null;
  activity?: string | null;
  fromLocation?: string | null;
  toLocation?: string | null;
  agent?: string | null;
  kpi?: string | null; // KPI bucket name for KPI card clicks
}

interface Props {
  ctx: InventoryDrillContext | null;
  onClose: () => void;
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  try {
    const dt = new Date(d);
    return dt.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
    });
  } catch {
    return "—";
  }
}

export function InventoryDrillModal({ ctx, onClose }: Props) {
  const [rows, setRows] = useState<DetailRow[]>([]);
  const [count, setCount] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ctx) return;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (ctx.principal) params.set("principal", ctx.principal);
    if (ctx.activity) params.set("activity", ctx.activity);
    if (ctx.fromLocation) params.set("from", ctx.fromLocation);
    if (ctx.toLocation) params.set("to", ctx.toLocation);
    if (ctx.agent) params.set("agent", ctx.agent);
    if (ctx.kpi) params.set("kpi", ctx.kpi);

    fetch(`/api/inventory/detail?${params.toString()}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        setRows(d.rows || []);
        setCount(d.count || 0);
        setTruncated(!!d.truncated);
      })
      .catch((e) => setError(e?.message || "Failed to load"))
      .finally(() => setLoading(false));
  }, [ctx]);

  if (!ctx) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-ink-primary">
              {ctx.title}
            </h2>
            <p className="text-xs text-ink-tertiary mt-0.5">{ctx.subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-surface-muted rounded-md text-ink-tertiary hover:text-ink-primary transition"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-surface-border flex items-center gap-4 text-xs text-ink-secondary">
          <div>
            <span className="text-ink-tertiary">Tanks: </span>
            <span className="font-semibold text-ink-primary">
              {count.toLocaleString("en-IN")}
            </span>
          </div>
          {truncated && (
            <div className="text-warning-text">
              Showing first 500 records · refine your filter to see more
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-ink-tertiary text-sm">
              Loading…
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-32 text-warning-text text-sm">
              {error}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-ink-tertiary text-sm">
              No tanks match this filter.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-surface-subtle sticky top-0 border-b border-surface-border">
                <tr className="text-ink-tertiary">
                  <th className="px-3 py-2.5 text-left">Container</th>
                  <th className="px-3 py-2.5 text-left">Type</th>
                  <th className="px-3 py-2.5 text-left">Principal</th>
                  <th className="px-3 py-2.5 text-left">Activity</th>
                  <th className="px-3 py-2.5 text-left">Agent</th>
                  <th className="px-3 py-2.5 text-left">From</th>
                  <th className="px-3 py-2.5 text-left">To</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r._id}
                    className="border-b border-surface-border/60 hover:bg-surface-subtle/50"
                  >
                    <td className="px-3 py-2 font-medium text-ink-primary">
                      {r.containerNo}
                    </td>
                    <td className="px-3 py-2 text-ink-secondary">
                      {r.size && r.type ? `${r.size}ft ${r.type}` : r.type || "—"}
                    </td>
                    <td className="px-3 py-2 text-ink-secondary">
                      {titleCase(r.principal)}
                    </td>
                    <td className="px-3 py-2 text-ink-secondary">
                      {r.activityName}
                    </td>
                    <td className="px-3 py-2 text-ink-secondary">
                      {titleCase(r.agent)}
                    </td>
                    <td className="px-3 py-2 text-ink-secondary">
                      {r.fromLocation || "—"}
                    </td>
                    <td className="px-3 py-2 text-ink-secondary">
                      {r.toLocation || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
