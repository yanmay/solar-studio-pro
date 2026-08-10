// ─────────────────────────────────────────────────────────────
// Report design tokens — "Geospatial Financial Audit for Solar"
// SINGLE SOURCE OF TRUTH for the results page AND the PDF export.
// A survey / cadastral audit board, not a fintech dashboard.
//
// Six named colors, each with ONE fixed meaning. Do not introduce
// ad-hoc colors elsewhere; if a hue is needed, it belongs here.
// ─────────────────────────────────────────────────────────────

export const REPORT_TOKENS = {
  // Survey-board surfaces (dark)
  ink:        "#0E1113", // base board — page background
  parcel:     "#16191C", // card / panel fill
  parcelHigh: "#1E2226", // raised inset (tables, wells)

  // Hairline graticule — grid lines & borders ONLY
  graticule:  "rgba(255, 255, 255, 0.08)",
  graticuleStrong: "rgba(255, 255, 255, 0.16)",

  // Semantic accents — each meaning is exclusive
  solar: "#FF6B00", // brand / CTA / accent
  yield: "#34C759", // positive cashflow / savings ONLY
  cost:  "#FF453A", // cost / outflow / negative ONLY

  // Neutrals — text
  text:   "#F5F5F7",
  muted:  "#8A8A90",
  onAccent: "#000000", // text on solar/yield fills
} as const;

export type ReportToken = keyof typeof REPORT_TOKENS;

// RGB tuples for jsPDF (which takes r,g,b not hex strings).
// Kept in lockstep with the hex values above so web + PDF match.
export const REPORT_RGB = {
  ink:        [14, 17, 19],
  parcel:     [22, 25, 28],
  parcelHigh: [30, 34, 38],
  graticule:  [46, 52, 58],   // solid approximation of the 8% hairline
  solar:      [255, 107, 0],
  yield:      [52, 199, 89],
  cost:       [255, 69, 58],
  text:       [245, 245, 247],
  muted:      [138, 138, 144],
  white:      [255, 255, 255],
} as const;

// ─── Type scale ──────────────────────────────────────────────
// Web sizes in px; tracking in em. The PDF mirrors the same
// hierarchy at print scale (see pdf-generator).
export const REPORT_TYPE = {
  display: { size: 56, tracking: -0.02, weight: 700 }, // the ONE hero number
  metric:  { size: 28, tracking: -0.02, weight: 700 }, // tier-1 KPIs
  title:   { size: 19, tracking: -0.01, weight: 600 }, // section titles
  body:    { size: 14, tracking: 0,     weight: 400, lineHeight: 1.5 },
  mono:    { size: 12, tracking: 0,     weight: 500 }, // data / coordinates
  label:   { size: 9,  tracking: 0.08,  weight: 700 }, // uppercase mono labels
} as const;

// System font stacks — no webfont dependency (survey-instrument feel
// comes from SF Mono for data, SF Pro for prose).
export const REPORT_FONTS = {
  sans: `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", system-ui, sans-serif`,
  mono: `"SF Mono", ui-monospace, SFMono-Regular, "Cascadia Mono", "Consolas", monospace`,
} as const;
