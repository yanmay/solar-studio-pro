/**
 * Report design tokens — single source of truth for all PDF styles.
 * All colours, spacing, font sizes, and border radii.
 * Swapping to Puppeteer later: only this file + page components change, not data layer.
 */

export const C = {
  // Brand
  primary:  "#FF6600",
  secondary: "#2BD4A0",
  accent:   "#FFAA00",

  // Backgrounds
  pageBg:   "#FFFFFF",
  cardBg:   "#F7F7F7",
  dark:     "#0A0A0A",

  // Text
  heading:  "#0A0A0A",
  body:     "#2D2D2D",
  muted:    "#6B6B6B",
  onDark:   "#FFFFFF",
  onDarkMuted: "#AAAAAA",

  // Borders
  border:   "#E5E5E5",
  divider:  "#F0F0F0",

  // Chart palette
  chartBar:    "#FF6600",
  chartLine:   "#2BD4A0",
  chartNeg:    "#FF4444",
  chartNeutral:"#CCCCCC",
} as const;

export const S = {
  // Font sizes (pt)
  xs:   7,
  sm:   8,
  base: 9,
  md:   10,
  lg:   12,
  xl:   16,
  h3:   18,
  h2:   22,
  h1:   28,
  display: 36,

  // Spacing (pt — Flexbox units)
  gap1:  4,
  gap2:  8,
  gap3:  12,
  gap4:  16,
  gap5:  20,
  gap6:  24,
  gap8:  32,

  // Page margins
  pageH: 36,  // horizontal
  pageV: 40,  // vertical

  // Radius (PDF uses borderRadius)
  r1: 4,
  r2: 6,
  r3: 8,
} as const;

/** Indian number formatting — ₹1,13,469 not ₹113,469 */
export function inrFmt(n: number, decimals = 0): string {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

/** Format as lakhs: 113469 → "₹1.13L" */
export function inrLakhs(n: number): string {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(1)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  return `₹${inrFmt(n)}`;
}

/** Format ISO date string into "21 Nov 2026" */
export function formatDate(isoStr?: string): string {
  const d = isoStr ? new Date(isoStr) : new Date();
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Uniform footer format: "Report #<id> · Generated <date> · Page X of 8" */
export function formatReportFooter(reportId: string, generatedAt: string, pageNumber: number): string {
  const dateStr = formatDate(generatedAt);
  const cleanId = (reportId || "SCAN").toUpperCase();
  return `Report #${cleanId} · Generated ${dateStr} · Page ${pageNumber} of 8`;
}
