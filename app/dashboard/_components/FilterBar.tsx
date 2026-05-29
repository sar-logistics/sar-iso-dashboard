"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Calendar, ChevronDown, Filter, ArrowUpDown } from "lucide-react";

interface Props {
  currentView: "monthly" | "quarterly" | "yearly";
  currentFrom: string;
  currentTo: string;
  fromLabel: string;
  toLabel: string;
  lastSyncedAt?: Date;
  rowsSynced?: number;
}

const VIEW_OPTIONS = [
  { value: "monthly", label: "Monthly View", disabled: false, badge: null },
  { value: "weekly", label: "Weekly View", disabled: true, badge: "Soon" },
  { value: "quarterly", label: "Quarterly View", disabled: false, badge: null },
  { value: "yearly", label: "Yearly View", disabled: false, badge: null },
  { value: "custom", label: "Custom Range", disabled: false, badge: null },
];

function fmtSync(d?: Date | string): string {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function FilterBar({
  currentView,
  currentFrom,
  currentTo,
  fromLabel,
  toLabel,
  lastSyncedAt,
  rowsSynced,
}: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const isCustom = (sp.get("view") || "") === "custom";
  const selectedView = isCustom ? "custom" : currentView;

  const navigate = (params: URLSearchParams) => {
    const qs = params.toString();
    router.push(qs ? `/dashboard?${qs}` : "/dashboard");
  };

  const handleViewChange = (newView: string) => {
    const params = new URLSearchParams(sp.toString());
    if (newView === "monthly") {
      params.delete("view");
      params.delete("from");
      params.delete("to");
    } else if (newView === "custom") {
      params.set("view", "custom");
      // Keep existing from/to if any
    } else {
      params.set("view", newView);
      params.delete("from");
      params.delete("to");
    }
    navigate(params);
  };

  const handleDateChange = (which: "from" | "to", value: string) => {
    const params = new URLSearchParams(sp.toString());
    params.set("view", "custom");
    if (value) params.set(which, value);
    else params.delete(which);
    navigate(params);
  };

  return (
    <div className="card bg-white px-4 py-3 flex items-center flex-wrap gap-x-5 gap-y-2 mb-5 text-xs">
      <div className="flex items-center gap-2">
        <span className="text-ink-tertiary uppercase tracking-wider text-[10px] font-medium">
          Report View
        </span>
        <ViewDropdown current={selectedView} onChange={handleViewChange} />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-ink-tertiary uppercase tracking-wider text-[10px] font-medium">
          From
        </span>
        {isCustom ? (
          <input
            type="month"
            value={currentFrom}
            onChange={(e) => handleDateChange("from", e.target.value)}
            className="bg-surface-muted px-2.5 py-1.5 rounded-md text-ink-primary border border-surface-border focus:ring-2 focus:ring-info focus:outline-none text-xs"
          />
        ) : (
          <span className="inline-flex items-center gap-1.5 bg-surface-muted px-2.5 py-1.5 rounded-md text-ink-primary">
            <Calendar size={12} />
            {fromLabel}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-ink-tertiary uppercase tracking-wider text-[10px] font-medium">
          To
        </span>
        {isCustom ? (
          <input
            type="month"
            value={currentTo}
            onChange={(e) => handleDateChange("to", e.target.value)}
            className="bg-surface-muted px-2.5 py-1.5 rounded-md text-ink-primary border border-surface-border focus:ring-2 focus:ring-info focus:outline-none text-xs"
          />
        ) : (
          <span className="inline-flex items-center gap-1.5 bg-surface-muted px-2.5 py-1.5 rounded-md text-ink-primary">
            <Calendar size={12} />
            {toLabel}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-ink-tertiary uppercase tracking-wider text-[10px] font-medium">
          Currency
        </span>
        <div className="inline-flex bg-surface-muted rounded-md p-0.5">
          <button className="px-2.5 py-1 rounded text-ink-primary bg-white shadow-sm font-medium">
            USD
          </button>
          <button
            className="px-2.5 py-1 rounded text-ink-tertiary cursor-not-allowed"
            title="INR view coming soon"
          >
            INR
          </button>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-4 text-[11px]">
        <button
          className="text-ink-tertiary inline-flex items-center gap-1.5 cursor-not-allowed"
          title="Filters coming soon"
        >
          <Filter size={12} /> Filters
        </button>
        <button
          className="text-ink-tertiary inline-flex items-center gap-1.5 cursor-not-allowed"
          title="Sort coming soon"
        >
          <ArrowUpDown size={12} /> Sort
        </button>
        {lastSyncedAt && (
          <span className="text-ink-tertiary">
            Last sync {fmtSync(lastSyncedAt)} ·{" "}
            {(rowsSynced ?? 0).toLocaleString("en-IN")} rows
          </span>
        )}
      </div>
    </div>
  );
}

function ViewDropdown({
  current,
  onChange,
}: {
  current: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const currentOpt = VIEW_OPTIONS.find((o) => o.value === current);
  const currentLabel = currentOpt?.label || "Monthly View";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="bg-surface-muted hover:bg-surface-border transition px-3 py-1.5 rounded-md inline-flex items-center gap-2 text-ink-primary text-xs font-medium"
      >
        {currentLabel}
        <ChevronDown size={14} className={open ? "rotate-180 transition" : "transition"} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1.5 bg-white border border-surface-border rounded-md shadow-lg min-w-[170px] py-1 z-20">
          {VIEW_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              disabled={opt.disabled}
              onClick={() => {
                if (!opt.disabled) {
                  onChange(opt.value);
                  setOpen(false);
                }
              }}
              className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between gap-2 ${
                opt.disabled
                  ? "text-ink-tertiary cursor-not-allowed"
                  : current === opt.value
                  ? "bg-accent-green/20 text-ink-primary font-medium"
                  : "text-ink-secondary hover:bg-surface-muted"
              }`}
            >
              <span>{opt.label}</span>
              {opt.badge && (
                <span className="text-[9px] bg-warning/60 text-warning-text px-1.5 py-0.5 rounded font-medium">
                  {opt.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
