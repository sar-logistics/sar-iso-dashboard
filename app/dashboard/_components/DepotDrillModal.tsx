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

export interface DepotDrillContext {
  title: string;
  subtitle: string;
  cellCount: number;
  country?: string;
  depot?: string;
  port?: string;
  bucket?: string;
  ageing?: string;
}

interface Props {
  ctx: DepotDrillContext | null;
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

export function DepotDrillModal({ ctx, onClose }: Props) {
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
    if (ctx.country) params.set("country", ctx.country);
    if (ctx.depot) params.set("depot", ctx.depot);
    if (ctx.port) params.set("port", ctx.port);
    if (ctx.bucket) params.set("bucket", ctx.bucket);
    if (ctx.ageing) params.set("ageing", ctx.ageing);

    fetch(`/api/depot/detail?${params.toString()}`)
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
            <span className="text-ink-tertiary">Depot count: </span>
            <span className="font-semibold text-ink-primary">
              {ctx.cellCount.toLocaleString("en-IN")}
            </span>
          </div>
          <div>
            <span className="text-ink-tertiary">Matched in inventory: </span>
            <span className="font-semibold text-ink-primary">
              {count.toLocaleString("en-IN")}
            </span>
          </div>
          {count !== ctx.cellCount && !truncated && (
            <div className="text-warning-text text-[11px]">
              Counts differ — depot sheet is independent of inventory feed
            </div>
          )}
          {truncated && (
            <div className="text-warning-text">
              Showing first 500
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
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-ink-tertiary text-sm px-4 text-center">
              <div>No matching tanks found in inventory.</div>
              <div className="text-[11px] max-w-md">
                The depot report shows aggregated counts; the matching containers
                may not be present in the inventory feed yet.
              </div>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-surface-subtle sticky top-0 border-b border-surface-border">
                <tr className="text-ink-tertiary">
                  <th className="px-3 py-2.5 text-left">Container</th>
                  <th className="px-3 py-2.5 text-left">Type</th>
                  <th className="px-3 py-2.5 text-left">Principal</th>
                  <th className="px-3 py-2.5 text-left">Activity</th>
                  <th className="px-3 py-2.5 text-left">Date</th>
                  <th className="px-3 py-2.5 text-right">Idle Days</th>
                  <th className="px-3 py-2.5 text-left">Agent</th>
                  <th className="px-3 py-2.5 text-left">From</th>
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
                      {fmtDate(r.activityDate)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.idleDays != null ? (
                        <span
                          className={
                            r.idleDays > 60
                              ? "text-warning-text font-medium"
                              : "text-ink-secondary"
                          }
                        >
                          {r.idleDays}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-ink-secondary">
                      {titleCase(r.agent)}
                    </td>
                    <td className="px-3 py-2 text-ink-secondary">
                      {r.fromLocation || "—"}
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
