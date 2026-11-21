// ─────────────────────────────────────────────────────────────
// Currency formatting — unified convention for INR amounts
// Supports both positional and options-based calls.
// ─────────────────────────────────────────────────────────────

const CRORE = 1_00_00_000; // 10,000,000
const LAKH  = 1_00_000;    //    100,000

/**
 * Format an INR amount with Indian numbering format.
 * @param value amount in rupees
 * @param opts.decimals override decimal places for Cr/L (default 2)
 */
export function formatINR(
  value: number,
  opts: { decimals?: number } = {},
): string {
  const decimals = opts.decimals ?? 2;
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (abs >= CRORE) {
    return `${sign}₹${(abs / CRORE).toFixed(decimals)} Cr`;
  }
  if (abs >= LAKH) {
    return `${sign}₹${(abs / LAKH).toFixed(decimals)} L`;
  }
  return `${sign}₹${Math.round(abs).toLocaleString("en-IN")}`;
}

/** Returns the numeric Lakh value (e.g. 1_13_000 → 1.13) */
export function formatLakhs(val: number): number {
  return val / LAKH;
}

/** Compact formatter for chart axis labels */
export function formatINRCompact(val: number): string {
  const abs = Math.abs(val);
  const sign = val < 0 ? "-" : "";
  if (abs >= CRORE) return `${sign}₹${(abs / CRORE).toFixed(1)}Cr`;
  if (abs >= LAKH)  return `${sign}₹${(abs / LAKH).toFixed(1)}L`;
  if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(0)}K`;
  return `${sign}₹${Math.round(abs)}`;
}
