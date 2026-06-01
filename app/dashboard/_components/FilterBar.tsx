"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";

interface Props {
  currentView: "monthly" | "weekly" | "quarterly" | "yearly" | "custom";
  currentFrom: string;
  currentTo: string;
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
    // Switching view: keep any explicit dates the user has set
    if (newView === "monthly") {
      params.delete("view");
    } else {
      params.set("view", newView);
    }
    navigate(params);
  };

  const handleDateChange = (which: "from" | "to", value: string) => {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set(which, value);
    else params.delete(which);
    // If user is editing dates while a named view is active, keep that view.
    // Only flip to "custom" if neither view nor date params existed before.
    if (!params.get("view") && (params.get("from") || params.get("to"))) {
      // user is on default monthly + setting dates — keep monthly
    }
    navigate(params);
  };

  const isWeekly = selectedView === "weekly";

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

      {isWeekly && (
        <div className="text-[11px] text-ink-tertiary italic">
          Weekly view shows at most 5 weeks. Wider ranges are auto-trimmed to
          the most recent 5 weeks.
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
