/**
 * Indian number system currency formatter.
 * Replaces the hand-rolled formatLakhsCr() in ResultsPage.tsx which had
 * a Lakh division bug (divided by 1 Crore instead of 1 Lakh).
 *
 * Usage:
 *   formatINR(113000)  → "₹1.13 L"
 *   formatINR(5000)    → "₹5,000"
 *   formatINR(1e7)     → "₹1.00 Cr"
 */

/** Full display formatter: "₹X,XXX" / "₹X.XX L" / "₹X.XX Cr" */
export function formatINR(val: number): string {
  const abs = Math.abs(val);
  const sign = val < 0 ? "-" : "";

  if (abs >= 1_00_00_000) {
    return `${sign}₹${(abs / 1_00_00_000).toFixed(2)} Cr`;
  }
  if (abs >= 1_00_000) {
    // BUG-004 fix: was dividing by 1_00_00_000 (Crore) instead of 1_00_000 (Lakh)
    return `${sign}₹${(abs / 1_00_000).toFixed(2)} L`;
  }
  return `${sign}₹${Math.round(abs).toLocaleString("en-IN")}`;
}

/** Returns the numeric Lakh value (e.g. 1_13_000 → 1.13) */
export function formatLakhs(val: number): number {
  return val / 1_00_000;
}

/** Compact formatter for chart axis labels */
export function formatINRCompact(val: number): string {
  const abs = Math.abs(val);
  const sign = val < 0 ? "-" : "";
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(1)}Cr`;
  if (abs >= 1_00_000)    return `${sign}₹${(abs / 1_00_000).toFixed(1)}L`;
  if (abs >= 1_000)       return `${sign}₹${(abs / 1_000).toFixed(0)}K`;
  return `${sign}₹${Math.round(abs)}`;
}
