"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, AlertCircle, RefreshCw } from "lucide-react";

interface SystemStatus {
  database: { ok: boolean; latencyMs?: number; error?: string };
  cron: {
    ok: boolean;
    lastSyncAt?: string | null;
    minutesSinceLastSync?: number | null;
    recentSuccessCount?: number;
    recentFailureCount?: number;
  };
  envVars: { name: string; present: boolean }[];
  collections: { name: string; count: number }[];
  serverTime: string;
  serverTimeIst: string;
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

export function SystemStatusTab() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/system-status", { cache: "no-store" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setStatus(data);
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <div className="card p-4 mb-4 flex items-center justify-between">
        <div className="text-xs text-ink-tertiary">
          Health check across database, cron sync, env vars, and collections
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="px-3 py-1.5 rounded-md bg-surface-muted hover:bg-surface-border text-ink-primary text-xs font-medium transition inline-flex items-center gap-1.5"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="card p-4 mb-4 bg-negative/10 text-negative text-xs">
          Error: {error}
        </div>
      )}

      {loading && !status && (
        <div className="card p-6 text-center text-ink-tertiary text-sm">
          Running checks…
        </div>
      )}

      {status && (
        <>
          {/* Top status cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <StatusCard
              label="Database"
              status={status.database.ok ? "ok" : "fail"}
              primary={
                status.database.ok
                  ? `${status.database.latencyMs ?? "?"} ms`
                  : "Unreachable"
              }
              secondary={
                status.database.ok ? "MongoDB Atlas connection" : status.database.error
              }
            />
            <StatusCard
              label="Cron Sync"
              status={
                status.cron.ok
                  ? "ok"
                  : status.cron.minutesSinceLastSync != null
                  ? "warn"
                  : "fail"
              }
              primary={
                status.cron.minutesSinceLastSync != null
                  ? `${status.cron.minutesSinceLastSync} min ago`
                  : "Never"
              }
              secondary={
                status.cron.lastSyncAt
                  ? `Last: ${fmtIst(status.cron.lastSyncAt)}`
                  : "No sync events recorded yet"
              }
            />
            <StatusCard
              label="Recent Success"
              status={
                (status.cron.recentSuccessCount || 0) > 0 ? "ok" : "warn"
              }
              primary={`${status.cron.recentSuccessCount || 0}`}
              secondary="In last 100 events"
            />
            <StatusCard
              label="Recent Failures"
              status={
                (status.cron.recentFailureCount || 0) === 0 ? "ok" : "warn"
              }
              primary={`${status.cron.recentFailureCount || 0}`}
              secondary="In last 100 events"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Env vars */}
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-surface-border">
                <h3 className="text-sm font-medium text-ink-primary">
                  Environment Variables
                </h3>
                <p className="text-[11px] text-ink-tertiary mt-0.5">
                  Presence check only — values are never displayed
                </p>
              </div>
              <ul>
                {status.envVars.map((e) => (
                  <li
                    key={e.name}
                    className="px-4 py-2 border-b border-surface-border last:border-b-0 flex items-center justify-between text-xs"
                  >
                    <span className="font-mono text-ink-secondary">
                      {e.name}
                    </span>
                    {e.present ? (
                      <span className="inline-flex items-center gap-1 text-positive">
                        <CheckCircle2 size={12} />
                        Set
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-negative">
                        <XCircle size={12} />
                        Missing
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* Collections */}
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-surface-border">
                <h3 className="text-sm font-medium text-ink-primary">
                  MongoDB Collections
                </h3>
                <p className="text-[11px] text-ink-tertiary mt-0.5">
                  Document counts in each collection
                </p>
              </div>
              <ul>
                {status.collections.map((c) => (
                  <li
                    key={c.name}
                    className="px-4 py-2 border-b border-surface-border last:border-b-0 flex items-center justify-between text-xs"
                  >
                    <span className="font-mono text-ink-secondary">
                      {c.name}
                    </span>
                    <span className="text-ink-primary tabular-nums">
                      {c.count.toLocaleString("en-IN")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Server time */}
          <div className="mt-4 text-[11px] text-ink-tertiary text-center">
            Server time: {status.serverTimeIst} (IST) ·{" "}
            {new Date(status.serverTime).toISOString()} (UTC)
          </div>
        </>
      )}
    </div>
  );
}

function StatusCard({
  label,
  status,
  primary,
  secondary,
}: {
  label: string;
  status: "ok" | "warn" | "fail";
  primary: string;
  secondary?: string;
}) {
  const Icon =
    status === "ok" ? CheckCircle2 : status === "warn" ? AlertCircle : XCircle;
  const color =
    status === "ok"
      ? "text-positive"
      : status === "warn"
      ? "text-warning-text"
      : "text-negative";
  const accent =
    status === "ok"
      ? "bg-positive"
      : status === "warn"
      ? "bg-warning"
      : "bg-negative";

  return (
    <div className="card p-4 relative overflow-hidden">
      <div className={`absolute top-0 left-0 right-0 h-0.5 ${accent}`} />
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider text-ink-tertiary font-medium">
          {label}
        </div>
        <Icon size={16} className={color} />
      </div>
      <div className="mt-2 text-lg font-semibold text-ink-primary">{primary}</div>
      {secondary && (
        <div className="text-[11px] text-ink-tertiary mt-0.5">{secondary}</div>
      )}
    </div>
  );
}
