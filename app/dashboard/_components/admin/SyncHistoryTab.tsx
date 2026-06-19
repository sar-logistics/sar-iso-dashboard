"use client";
import { useEffect, useState } from "react";

interface SyncLog {
  _id: string;
  sheetName: string;
  syncedAt: string;
  rowsRead: number;
  rowsInserted: number;
  status: "success" | "failure";
  durationMs: number;
  errorMsg?: string | null;
}

function fmtIst(d?: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

export function SyncHistoryTab() {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheetFilter, setSheetFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (sheetFilter) params.set("sheet", sheetFilter);
      if (statusFilter) params.set("status", statusFilter);
      const r = await fetch(`/api/admin/sync-logs?${params}`, {
        cache: "no-store",
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setLogs(data.logs || []);
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [sheetFilter, statusFilter]);

  const distinctSheets = Array.from(new Set(logs.map((l) => l.sheetName)));
  const successCount = logs.filter((l) => l.status === "success").length;
  const failureCount = logs.length - successCount;

  return (
    <div>
      <div className="card p-4 mb-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="text-xs text-ink-tertiary">
            Showing <span className="text-ink-primary font-medium">{logs.length}</span>{" "}
            most recent sync events ·{" "}
            <span className="text-positive">{successCount} success</span> ·{" "}
            <span className="text-negative">{failureCount} failed</span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-ink-tertiary uppercase tracking-wider text-[10px]">
                Sheet
              </span>
              <select
                value={sheetFilter}
                onChange={(e) => setSheetFilter(e.target.value)}
                className="bg-surface-muted px-2.5 py-1.5 rounded-md text-ink-primary border border-surface-border text-xs"
              >
                <option value="">All sheets</option>
                {distinctSheets.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-ink-tertiary uppercase tracking-wider text-[10px]">
                Status
              </span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-surface-muted px-2.5 py-1.5 rounded-md text-ink-primary border border-surface-border text-xs"
              >
                <option value="">All</option>
                <option value="success">Success</option>
                <option value="failure">Failure</option>
              </select>
            </div>
            <button
              onClick={load}
              className="px-3 py-1.5 rounded-md bg-surface-muted hover:bg-surface-border text-ink-primary text-xs font-medium transition"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="card p-4 mb-4 bg-negative/10 text-negative text-xs">
          Error: {error}
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-surface-subtle border-b border-surface-border text-[10px] uppercase tracking-wider text-ink-tertiary">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium">When (IST)</th>
              <th className="text-left px-4 py-2.5 font-medium">Sheet</th>
              <th className="text-left px-4 py-2.5 font-medium">Status</th>
              <th className="text-right px-4 py-2.5 font-medium">Rows Read</th>
              <th className="text-right px-4 py-2.5 font-medium">Inserted</th>
              <th className="text-right px-4 py-2.5 font-medium">Duration</th>
              <th className="text-left px-4 py-2.5 font-medium">Error</th>
            </tr>
          </thead>
          <tbody>
            {loading && logs.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-ink-tertiary py-6">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && logs.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-ink-tertiary py-6">
                  No sync events match the current filter.
                </td>
              </tr>
            )}
            {logs.map((l) => (
              <tr
                key={l._id}
                className="border-b border-surface-border hover:bg-surface-subtle/50"
              >
                <td className="px-4 py-2 text-ink-secondary whitespace-nowrap">
                  {fmtIst(l.syncedAt)}
                </td>
                <td className="px-4 py-2 text-ink-primary font-medium">
                  {l.sheetName}
                </td>
                <td className="px-4 py-2">
                  {l.status === "success" ? (
                    <span className="inline-flex items-center gap-1 text-positive">
                      <span className="w-1.5 h-1.5 rounded-full bg-positive" />
                      Success
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-negative">
                      <span className="w-1.5 h-1.5 rounded-full bg-negative" />
                      Failed
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-ink-secondary">
                  {(l.rowsRead || 0).toLocaleString("en-IN")}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-ink-secondary">
                  {(l.rowsInserted || 0).toLocaleString("en-IN")}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-ink-tertiary">
                  {l.durationMs ? `${(l.durationMs / 1000).toFixed(1)}s` : "—"}
                </td>
                <td className="px-4 py-2 text-ink-tertiary text-[11px] max-w-md truncate">
                  {l.errorMsg || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
