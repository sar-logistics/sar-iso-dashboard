// Pure currency utilities — safe to import from both server and client components.
// NO "use client" directive here — that lives in currency-context.tsx.

export type CurrencyMode = "USD" | "INR";

export interface CurrencyState {
  currency: CurrencyMode;
  inrRate: number;
}

/** Convert a USD value to the currently selected currency. */
export function convert(
  value: number,
  state: CurrencyState | undefined
): number {
  if (!state || state.currency === "USD") return value;
  return value * state.inrRate;
}

/** Format a USD value as the currently selected currency, full precision. */
export function fmtMoney(
  value: number,
  state: CurrencyState | undefined
): string {
  const cur: CurrencyMode = state?.currency || "USD";
  const v = convert(value, state);
  const sym = cur === "INR" ? "\u20B9" : "$";
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  const locale = cur === "INR" ? "en-IN" : "en-US";
  return `${sign}${sym}${Math.round(abs).toLocaleString(locale)}`;
}

/** Compact formatter for chart axes / labels (K / M / L / Cr). */
export function fmtMoneyCompact(
  value: number,
  state: CurrencyState | undefined
): string {
  const cur: CurrencyMode = state?.currency || "USD";
  const v = convert(value, state);
  const sym = cur === "INR" ? "\u20B9" : "$";
  if (v === 0) return `${sym}0`;
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);

  if (cur === "INR") {
    if (abs >= 10_000_000) return `${sign}${sym}${(abs / 10_000_000).toFixed(2)}Cr`;
    if (abs >= 100_000) return `${sign}${sym}${(abs / 100_000).toFixed(2)}L`;
    if (abs >= 1_000) return `${sign}${sym}${(abs / 1_000).toFixed(1)}K`;
    return `${sign}${sym}${abs.toFixed(0)}`;
  }
  if (abs >= 1_000_000) return `${sign}${sym}${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}${sym}${(abs / 1_000).toFixed(1)}K`;
  return `${sign}${sym}${abs.toFixed(0)}`;
}

/** Parse currency params from URL searchParams. */
export function parseCurrencyParams(sp: {
  currency?: string;
  inrRate?: string;
}): CurrencyState {
  const currency: CurrencyMode = sp.currency === "INR" ? "INR" : "USD";
  let inrRate = parseFloat(sp.inrRate || "83");
  if (!isFinite(inrRate) || inrRate <= 0) inrRate = 83;
  return { currency, inrRate };
}
