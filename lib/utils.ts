// Small helpers shared across the app

const SMALL_WORDS = new Set([
  "and", "or", "the", "of", "in", "on", "at", "to", "for", "a", "an",
]);

const KEEP_UPPER = new Set([
  "ISO", "BL", "POL", "POD", "USA", "UAE", "UK", "USD", "AED", "INR",
  "M&R", "GST", "GSTIN", "PVT", "LTD", "LLC", "INC", "CO", "PTE",
  "ICD", "EXP", "IMP", "DEM",
]);

/**
 * Convert ALL CAPS or messy names to readable Title Case.
 * Preserves common acronyms (ISO, LLC, PTE, USA, etc.).
 *   "SAR LOGISOLUTIONS PTE. LTD." -> "Sar Logisolutions Pte. Ltd."
 *   "EMPTY AVAILABLE" -> "Empty Available"
 *   "M&R Sales Invoice" -> "M&R Sales Invoice"
 */
export function titleCase(input: string | null | undefined): string {
  if (!input) return "";
  return String(input)
    .trim()
    .toLowerCase()
    .split(/(\s+|[\-/&,.])/) // keep separators
    .map((tok, i) => {
      if (!tok.trim()) return tok;
      const upper = tok.toUpperCase();
      if (KEEP_UPPER.has(upper)) return upper;
      if (i > 0 && SMALL_WORDS.has(tok)) return tok;
      return tok.charAt(0).toUpperCase() + tok.slice(1);
    })
    .join("");
}

/** USD formatter for revenue / amounts. */
export function fmtUSD(n: number): string {
  if (!isFinite(n)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

/** Parse dd/MM/yyyy or other common formats from the sheet to a JS Date. */
export function parseSheetDate(v: any): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v;
  const s = String(v).trim();

  // dd/MM/yyyy or dd-MM-yyyy
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const year = y.length === 2 ? 2000 + Number(y) : Number(y);
    const dt = new Date(Date.UTC(year, Number(mo) - 1, Number(d)));
    return isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : dt;
}

export function toNumber(v: any): number {
  if (v == null || v === "") return 0;
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  return isFinite(n) ? n : 0;
}
