"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";

interface PeriodOption {
  key: string;
  label: string;
  fromIso: string;
  toIso: string;
}

interface Props {
  currentView: "monthly" | "weekly" | "quarterly" | "yearly" | "custom";
  currentFrom: string;
  currentTo: string;
  currentPeriod: string;
  availablePeriods: PeriodOption[];
  fromLabel: string;
  toLabel: string;
  lastSyncedAt?: Date;
  rowsSynced?: number;
}

const VIEW_OPTIONS = [
  { value: "monthly", label: "Monthly View", disabled: false },
  { value: "weekly", label: "Weekly View", disabled: false },
  { value: "quarterly", label: "Quarterly View", disabled: false },
  { value: "yearly", label: "Yearly View", disabled: false },
  { value: "custom", label: "Custom Range", disabled: false },
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
    timeZone: "Asia/Kolkata",
  });
}

/** Convert a Date or "yyyy-mm-dd" string into "yyyy-mm-dd" for input value. */
function toInputDate(s: string): string {
  if (!s) return "";
  // Already yyyy-mm-dd?
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}$/.test(s)) return s + "-01";
  return "";
}

export function FilterBar({
  currentView,
  currentFrom,
  currentTo,
  currentPeriod,
  availablePeriods,
  lastSyncedAt,
  rowsSynced,
}: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const urlView = sp.get("view") || "";
  // Treat "custom" specially in the dropdown label
  const selectedView =
    urlView === "custom" ? "custom" : (currentView as string);

  const navigate = (params: URLSearchParams) => {
    const qs = params.toString();
    router.push(qs ? `/dashboard?${qs}` : "/dashboard");
  };

  const handleViewChange = (newView: string) => {
    const params = new URLSearchParams(sp.toString());
    // Switching view invalidates the picked period (Q1 26 makes no sense in monthly)
    // and any explicit dates
    params.delete("period");
    params.delete("from");
    params.delete("to");
    if (newView === "monthly") {
      params.delete("view");
    } else {
      params.set("view", newView);
    }
    navigate(params);
  };

  const handlePeriodChange = (periodKey: string) => {
    const params = new URLSearchParams(sp.toString());
    if (!periodKey) {
      // "All recent" selected → clear specific period
      params.delete("period");
      params.delete("from");
      params.delete("to");
    } else {
      const opt = availablePeriods.find((p) => p.key === periodKey);
      if (!opt) return;
      params.set("period", periodKey);
      params.set("from", opt.fromIso);
      params.set("to", opt.toIso);
    }
    navigate(params);
  };

  const handleDateChange = (which: "from" | "to", value: string) => {
    const params = new URLSearchParams(sp.toString());
    // Manual date edit means the named period no longer matches → clear it
    params.delete("period");
    if (value) params.set(which, value);
    else params.delete(which);
    navigate(params);
  };

  // Whether ANY filter is active (period, dates, custom view, non-default currency)
  const hasActiveFilter =
    !!sp.get("period") ||
    !!sp.get("from") ||
    !!sp.get("to") ||
    !!sp.get("view");

  const clearFilters = () => {
    const params = new URLSearchParams();
    // Preserve currency choice — it's a display preference, not a data filter
    const cur = sp.get("currency");
    const rate = sp.get("inrRate");
    if (cur) params.set("currency", cur);
    if (rate) params.set("inrRate", rate);
    navigate(params);
  };

  // Currency state — synced with URL
  const currency = (sp.get("currency") || "USD").toUpperCase() === "INR"
    ? "INR"
    : "USD";
  const urlRate = sp.get("inrRate") || "83";
  const [localRate, setLocalRate] = useState(urlRate);
  useEffect(() => {
    setLocalRate(urlRate);
  }, [urlRate]);

  const handleCurrencyChange = (newCurrency: "USD" | "INR") => {
    const params = new URLSearchParams(sp.toString());
    if (newCurrency === "USD") {
      params.delete("currency");
      params.delete("inrRate");
    } else {
      params.set("currency", "INR");
      // Default rate if not already set
      if (!params.get("inrRate")) params.set("inrRate", "83");
    }
    navigate(params);
  };

  const commitRate = (raw: string) => {
    const parsed = parseFloat(raw);
    if (!isFinite(parsed) || parsed <= 0) {
      setLocalRate(urlRate);
      return;
    }
    if (String(parsed) === urlRate) return;
    const params = new URLSearchParams(sp.toString());
    params.set("currency", "INR");
    params.set("inrRate", String(parsed));
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

      {selectedView !== "custom" && availablePeriods.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-ink-tertiary uppercase tracking-wider text-[10px] font-medium">
            {selectedView === "monthly"
              ? "Month"
              : selectedView === "quarterly"
              ? "Quarter"
              : selectedView === "yearly"
              ? "Year"
              : "Week"}
          </span>
          <PeriodDropdown
            current={currentPeriod}
            options={availablePeriods}
            onChange={handlePeriodChange}
          />
        </div>
      )}

      {selectedView === "custom" && (
        <>
          <div className="flex items-center gap-2">
            <span className="text-ink-tertiary uppercase tracking-wider text-[10px] font-medium">
              From
            </span>
            <input
              type="date"
              value={toInputDate(currentFrom)}
              onChange={(e) => handleDateChange("from", e.target.value)}
              className="bg-surface-muted px-2.5 py-1.5 rounded-md text-ink-primary border border-surface-border focus:ring-2 focus:ring-info focus:outline-none text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-ink-tertiary uppercase tracking-wider text-[10px] font-medium">
              To
            </span>
            <input
              type="date"
              value={toInputDate(currentTo)}
              onChange={(e) => handleDateChange("to", e.target.value)}
              className="bg-surface-muted px-2.5 py-1.5 rounded-md text-ink-primary border border-surface-border focus:ring-2 focus:ring-info focus:outline-none text-xs"
            />
          </div>
        </>
      )}

      {hasActiveFilter && (
        <button
          onClick={clearFilters}
          className="px-3 py-1.5 rounded-md text-xs font-medium text-ink-secondary hover:text-ink-primary hover:bg-surface-muted transition inline-flex items-center gap-1.5 border border-surface-border"
          title="Reset all filters to defaults"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18" />
            <path d="M6 6l12 12" />
          </svg>
          Clear filters
        </button>
      )}

      <div className="flex items-center gap-2">
        <span className="text-ink-tertiary uppercase tracking-wider text-[10px] font-medium">
          Currency
        </span>
        <div className="inline-flex bg-surface-muted rounded-md p-0.5">
          <button
            onClick={() => handleCurrencyChange("USD")}
            className={`px-2.5 py-1 rounded text-xs font-medium transition ${
              currency === "USD"
                ? "text-ink-primary bg-white shadow-sm"
                : "text-ink-tertiary hover:text-ink-primary"
            }`}
          >
            USD
          </button>
          <button
            onClick={() => handleCurrencyChange("INR")}
            className={`px-2.5 py-1 rounded text-xs font-medium transition ${
              currency === "INR"
                ? "text-ink-primary bg-white shadow-sm"
                : "text-ink-tertiary hover:text-ink-primary"
            }`}
          >
            INR
          </button>
        </div>
        {currency === "INR" && (
          <div className="inline-flex items-center gap-1.5">
            <span className="text-ink-tertiary text-[10px]">@ ₹</span>
            <input
              type="number"
              step="0.5"
              min="1"
              max="500"
              value={localRate}
              onChange={(e) => setLocalRate(e.target.value)}
              onBlur={() => commitRate(localRate)}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              className="w-16 bg-surface-muted px-2 py-1.5 rounded-md text-ink-primary border border-surface-border focus:ring-2 focus:ring-info focus:outline-none text-xs"
            />
            <span className="text-ink-tertiary text-[10px]">/ $</span>
          </div>
        )}
      </div>

      {selectedView === "custom" && (
        <div className="text-[11px] text-ink-tertiary italic">
          Pick any From/To range
        </div>
      )}

      <div className="ml-auto flex items-center gap-4 text-[11px]">
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
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
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
        <ChevronDown
          size={14}
          className={open ? "rotate-180 transition" : "transition"}
        />
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
              className={`w-full text-left px-3 py-2 text-xs hover:bg-surface-muted transition ${
                opt.value === current
                  ? "bg-info/30 text-ink-primary font-medium"
                  : "text-ink-secondary"
              } ${opt.disabled ? "cursor-not-allowed opacity-50" : ""}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PeriodDropdown({
  current,
  options,
  onChange,
}: {
  current: string;
  options: PeriodOption[];
  onChange: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const currentOpt = options.find((o) => o.key === current);
  const currentLabel = currentOpt?.label || "All recent";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="bg-surface-muted hover:bg-surface-border transition px-3 py-1.5 rounded-md inline-flex items-center gap-2 text-ink-primary text-xs font-medium min-w-[110px] justify-between"
      >
        {currentLabel}
        <ChevronDown
          size={14}
          className={open ? "rotate-180 transition" : "transition"}
        />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1.5 bg-white border border-surface-border rounded-md shadow-lg min-w-[160px] py-1 z-20 max-h-[300px] overflow-y-auto">
          <button
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className={`w-full text-left px-3 py-2 text-xs hover:bg-surface-muted transition italic ${
              current === ""
                ? "bg-info/30 text-ink-primary font-medium"
                : "text-ink-secondary"
            }`}
          >
            All recent
          </button>
          <div className="border-t border-surface-border my-1" />
          {options.map((opt) => (
            <button
              key={opt.key}
              onClick={() => {
                onChange(opt.key);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-surface-muted transition ${
                opt.key === current
                  ? "bg-info/30 text-ink-primary font-medium"
                  : "text-ink-secondary"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
