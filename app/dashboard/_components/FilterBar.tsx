import { Calendar, ChevronDown, Filter, ArrowUpDown, Trophy, RefreshCw } from "lucide-react";

interface FilterBarProps {
  fromLabel: string;
  toLabel: string;
  lastSyncedAt?: Date | null;
  rowsSynced?: number;
}

/**
 * Top filter strip — visual only for Phase 2A.
 * In Phase 2B these become interactive (date picker, customer filter, etc.).
 */
export function FilterBar({ fromLabel, toLabel, lastSyncedAt, rowsSynced }: FilterBarProps) {
  return (
    <div className="bg-white border border-surface-border rounded-lg px-4 py-3 mb-6 flex items-center gap-x-5 gap-y-2 flex-wrap">
      <div className="flex items-center gap-2">
        <span className="filter-label">Report View</span>
        <button className="filter-chip">
          Monthly View <ChevronDown size={12} />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <span className="filter-label">From</span>
        <button className="filter-chip">
          <Calendar size={12} /> {fromLabel}
        </button>
        <span className="filter-label">To</span>
        <button className="filter-chip">
          <Calendar size={12} /> {toLabel}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <span className="filter-label">Currency</span>
        <div className="flex items-center border border-surface-border rounded-md overflow-hidden">
          <button className="px-3 py-1.5 text-xs font-medium bg-info/40 text-info-text">USD</button>
          <button className="px-3 py-1.5 text-xs font-medium text-ink-tertiary hover:bg-surface-muted">INR</button>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <button className="filter-chip hover:bg-surface-muted">
          <Filter size={12} /> Filters
        </button>
        <button className="filter-chip hover:bg-surface-muted">
          <ArrowUpDown size={12} /> Sort
        </button>
        <button className="filter-chip hover:bg-surface-muted">
          <Trophy size={12} /> Leaderboard
        </button>
        {lastSyncedAt && (
          <span className="text-[11px] text-ink-tertiary">
            Last sync {new Date(lastSyncedAt).toLocaleString("en-IN", {
              dateStyle: "medium",
              timeStyle: "short",
            })}{rowsSynced ? ` · ${rowsSynced.toLocaleString("en-IN")} rows` : ""}
          </span>
        )}
      </div>
    </div>
  );
}
