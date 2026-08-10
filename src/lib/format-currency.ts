// ─────────────────────────────────────────────────────────────
// Currency formatting — ONE convention per magnitude, used by the
// web report AND the PDF export. Replaces the divergent, buggy
// formatLakhsCr (page) and formatCurrencyPDF (pdf) helpers.
//
//   >= 1 Cr   →  "₹1.2 Cr"   (1 decimal)
//   >= 1 L    →  "₹3.4 L"    (1 decimal)
//   <  1 L    →  "₹45,000"   (Indian grouping, no decimals)
// ─────────────────────────────────────────────────────────────

const CRORE = 1_00_00_000; // 10,000,000
const LAKH  = 1_00_000;    //    100,000

/**
 * Format an INR amount with a single, consistent convention.
 * @param value amount in rupees
 * @param opts.decimals override decimal places for Cr/L (default 1)
 */
export function formatINR(
  value: number,
  opts: { decimals?: number } = {},
): string {
  const decimals = opts.decimals ?? 1;
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
