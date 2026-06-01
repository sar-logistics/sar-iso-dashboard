"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { titleCase, fmtUSD } from "@/lib/utils";

interface DetailRow {
  _id: string;
  invoiceDate: string | null;
  invoiceNo: string;
  invoiceType: string;
  partyName: string;
  chargeName: string;
  blNo: string;
  pol: string;
  pod: string;
  qty: number;
  rate: number;
  chargeCurrency: string;
  amountInChargeCurrency: number;
}

export interface DrillContext {
  customer: string | null;
  pol: string | null;
  pod: string | null;
  polEmpty?: boolean;
  podEmpty?: boolean;
  customerLabel: string;
  year: number;
  month: number;
  monthLabel: string;
  head: string;
  bucket: "Detention" | "Export" | "M&R" | null;
  chargeName: string | null;
  level: "primary" | "subtotal" | "detail";
  cellTotal: number;
}

interface Props {
  ctx: DrillContext | null;
  onClose: () => void;
}

export function DrillDownModal({ ctx, onClose }: Props) {
  const [rows, setRows] = useState<DetailRow[]>([]);
  const [total, setTotal] = useState(0);
  const [count, setCount] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ctx) return;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      year: String(ctx.year),
      month: String(ctx.month),
      level: ctx.level,
      head: ctx.head,
    });
    if (ctx.customer) params.set("customer", ctx.customer);
    if (ctx.pol) params.set("pol", ctx.pol);
    if (ctx.pod) params.set("pod", ctx.pod);
    if (ctx.polEmpty) params.set("polEmpty", "1");
    if (ctx.podEmpty) params.set("podEmpty", "1");
    if (ctx.bucket) params.set("bucket", ctx.bucket);
    if (ctx.chargeName) params.set("chargeName", ctx.chargeName);

    fetch(`/api/sales/detail?${params}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Failed to load");
        return d;
      })
      .then((d) => {
        setRows(d.rows || []);
        setTotal(d.total || 0);
        setCount(d.count || 0);
        setTruncated(!!d.truncated);
      })
      .catch((e) => setError(e?.message || String(e)))
      .finally(() => setLoading(false));
  }, [ctx]);

  if (!ctx) return null;

  const subtitle = ctx.chargeName
    ? titleCase(ctx.chargeName)
    : ctx.bucket
    ? `${ctx.bucket} (all charges)`
    : ctx.head;

  const showCustomer = !ctx.customer;
  const showPolPod = !!(ctx.pol || ctx.pod) ? false : true;

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-surface-border flex items-start justify-between">
          <div>
            <div className="text-sm font-semibold text-ink-primary">
              {ctx.customerLabel} · {subtitle} · {ctx.monthLabel}
            </div>
            <div className="text-xs text-ink-tertiary mt-1 flex items-center gap-3 flex-wrap">
              <span>
                Total: <span className="font-semibold text-ink-primary">{fmtUSD(total)}</span>
              </span>
              <span>·</span>
              <span>{count.toLocaleString("en-IN")} invoice line(s)</span>
              {truncated && (
                <span className="text-warning-text bg-warning/40 px-2 py-0.5 rounded text-[11px]">
                  Showing first 500
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-ink-tertiary hover:text-ink-primary p-1 rounded hover:bg-surface-muted"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="p-8 text-center text-ink-tertiary">Loading…</div>
          ) : error ? (
            <div className="p-8 text-center text-negative">Error: {error}</div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-ink-tertiary">No records found.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-surface-subtle sticky top-0 z-10">
                <tr className="text-[11px] uppercase tracking-wider text-ink-tertiary">
                  <th className="px-3 py-2.5 text-left">Date</th>
                  <th className="px-3 py-2.5 text-left">Invoice No</th>
                  <th className="px-3 py-2.5 text-left">BL No</th>
                  {showCustomer && <th className="px-3 py-2.5 text-left">Agent</th>}
                  <th className="px-3 py-2.5 text-left">Charge Name</th>
                  {showPolPod && (
                    <th className="px-3 py-2.5 text-left">Trade Lane (POL → POD)</th>
                  )}
                  <th className="px-3 py-2.5 text-right">Qty</th>
                  <th className="px-3 py-2.5 text-right">Rate</th>
                  <th className="px-3 py-2.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-surface-border hover:bg-surface-muted">
                    <td className="px-3 py-2 text-ink-secondary whitespace-nowrap">
                      {r.invoiceDate
                        ? new Date(r.invoiceDate).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-ink-secondary whitespace-nowrap">
                      {r.invoiceNo}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-ink-secondary whitespace-nowrap">
                      {r.blNo || "—"}
                    </td>
                    {showCustomer && (
                      <td className="px-3 py-2 text-ink-primary">{titleCase(r.partyName)}</td>
                    )}
                    <td className="px-3 py-2 text-ink-primary">{titleCase(r.chargeName)}</td>
                    {showPolPod && (
                      <td className="px-3 py-2 text-xs text-ink-secondary whitespace-nowrap">
                        <span>{r.pol || "—"}</span>
                        <span className="mx-1.5 text-ink-tertiary">→</span>
                        <span>{r.pod || "—"}</span>
                      </td>
                    )}
                    <td className="px-3 py-2 text-right tabular-nums text-ink-secondary">
                      {r.qty ? r.qty.toLocaleString("en-IN") : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink-secondary">
                      {r.rate ? fmtUSD(r.rate) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium text-ink-primary whitespace-nowrap">
                      {fmtUSD(r.amountInChargeCurrency)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-surface-subtle">
                <tr className="text-xs font-semibold">
                  <td
                    className="px-3 py-2.5 text-left"
                    colSpan={3 + (showCustomer ? 1 : 0) + 1 + (showPolPod ? 1 : 0) + 2}
                  >
                    Total
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmtUSD(total)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
