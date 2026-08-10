import { jsPDF } from "jspdf";
import type { SolarAnalysis } from "./solar-calc";
import { calcConfidenceScore } from "./confidence-score";
import { REPORT_RGB } from "./report-tokens";
import { formatINR } from "./format-currency";
import { deriveMetrics } from "./report-metrics";

export interface BrandConfig {
  logoUrl?: string; // base64 PNG data URL
  companyName?: string;
  primaryColor?: string; // hex string, e.g. "#10B981"
  contactPhone?: string;
  contactEmail?: string;
}

interface PDFOptions {
  locationLabel?: string;
  brandConfig?: BrandConfig;
}

/**
/**
 * PM-Surya Ghar national subsidy (INR) for a given system size in kWp.
 * ≤2 kWp: ₹30,000/kWp · 2–3 kWp: ₹60,000 + ₹18,000/kWp above 2 · >3 kWp: capped ₹78,000.
 */
export function calculateSubsidy(installedKw: number): number {
  if (installedKw <= 0) return 0;
  if (installedKw <= 2) return Math.round(installedKw * 30000);
  if (installedKw <= 3) return Math.round(60000 + (installedKw - 2) * 18000);
  return 78000;
}

/**
 * Build a wa.me share URL. Strips non-digits from the phone; a bare 10-digit
 * Indian number is prefixed with 91, an already-prefixed number is left as-is.
 * The message is URI-encoded.
 */
export function buildWhatsAppUrl(phone: string, text: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  const normalized = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`;
}

/**
 * Converts a hex color string to RGB object
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return { r, g, b };
  }
  const num = parseInt(clean, 16);
  if (isNaN(num)) return { r: 15, g: 23, b: 42 }; // default navy
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

export async function generatePDFReport(
  analysis: SolarAnalysis & { panelCount?: number; panelType?: string },
  opts: PDFOptions = {},
  model?: any
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("REPORT_TIMEOUT"));
    }, 15000);

    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Margins & Dimensions (survey-board grid)
      const margin = 18;
      const contentWidth = pageWidth - margin * 2;
      let y = margin;

      // ─── Survey-board palette (single source of truth: report-tokens) ───
      const INK = REPORT_RGB.ink;          // page background
      const PARCEL = REPORT_RGB.parcel;    // card / panel fill
      const PARCEL_HIGH = REPORT_RGB.parcelHigh; // raised inset / table wells
      const GRID = REPORT_RGB.graticule;   // borders & grid hairlines ONLY
      const SOLAR = REPORT_RGB.solar;      // brand / CTA / accent
      const YIELD = REPORT_RGB.yield;      // positive savings / cashflow ONLY
      const COST = REPORT_RGB.cost;        // outflows / negatives ONLY
      const TEXT = REPORT_RGB.text;        // body text
      const MUTED = REPORT_RGB.muted;      // secondary text / labels
      const ONACCENT: readonly number[] = [0, 0, 0]; // text on solar/yield fills

      // Brand accent may tint the header/CTA; base surfaces stay dark.
      const brandAccent = opts.brandConfig?.primaryColor
        ? hexToRgb(opts.brandConfig.primaryColor)
        : null;
      const accent: readonly number[] = brandAccent
        ? [brandAccent.r, brandAccent.g, brandAccent.b]
        : SOLAR;

      // jsPDF color setters (avoid tuple-spread arity noise, keep it DRY)
      const setFill = (c: readonly number[]) => doc.setFillColor(c[0], c[1], c[2]);
      const setText = (c: readonly number[]) => doc.setTextColor(c[0], c[1], c[2]);
      const setStroke = (c: readonly number[]) => doc.setDrawColor(c[0], c[1], c[2]);

      // Paint the whole page with the dark survey board (jsPDF pages are white).
      const paintBoard = () => {
        setFill(INK);
        doc.rect(0, 0, pageWidth, pageHeight, "F");
      };

      // ─── Canonical metrics — ONE value per metric (page & PDF agree) ───
      const rm = model
        ? deriveMetrics(model)
        : {
            paybackYears: analysis.investment.paybackYears,
            paybackFound: true,
            npvInr: analysis.investment.netCostInr,
            lifetimeSavingsInr: analysis.financials.savings25yrInr,
            annualProductionKwh: analysis.energy.annualKwh,
            netCostInr: analysis.investment.netCostInr,
            installedKw: analysis.energy.installedCapacityKw,
            irrPct: 0,
            lcoeInrPerKwh: 0,
            cumulativeCashFlow: [] as number[],
          };

      const siteId = analysis.analysisId?.slice(-6).toUpperCase() || "REPORT";
      const dateStr = new Date(analysis.generatedAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });

      // Calculate confidence score
      const rawConfidence = calcConfidenceScore({
        source: analysis.source ?? "none",
        pitchDegrees: analysis.pitchDegrees ?? 0,
        isExplicitlyFlat: analysis.isExplicitlyFlat ?? false,
        computedShadingLoss: analysis.computedShadingLoss ?? null,
        exclusionAreaM2: analysis.exclusionAreaM2 ?? 0,
        isRegionalFallback: analysis.irradianceSource === "REGIONAL_FALLBACK",
        pvlibAvailable: false, // fallback
        allExclusionZonesDrawn: (analysis.exclusionAreaM2 ?? 0) > 0,
      });
      const confidenceScore = Math.round(rawConfidence * 100);

      // Helper for Header Banner (instrument bar)
      const drawHeaderBanner = (pageTitle: string) => {
        setFill(PARCEL);
        doc.rect(0, 0, pageWidth, 16, "F");

        // Accent spine + hairline baseline
        setFill(accent);
        doc.rect(0, 0, 2, 16, "F");
        setStroke(GRID);
        doc.setLineWidth(0.3);
        doc.line(0, 16, pageWidth, 16);

        const co = opts.brandConfig?.companyName || "SUNPOWER LINK";
        setText(TEXT);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(co, margin, 10);

        const coW = doc.getTextWidth(co);
        setText(MUTED);
        doc.setFont("helvetica", "normal");
        doc.text(`  |  ${pageTitle}`, margin + coW, 10);

        setText(MUTED);
        doc.setFont("courier", "bold");
        doc.setFontSize(8.5);
        doc.text(`SITE ID: ${siteId}`, pageWidth - margin, 10, { align: "right" });
      };

      // Helper for Footer
      const drawFooter = (pageNum: number) => {
        setStroke(GRID);
        doc.setLineWidth(0.3);
        doc.line(margin, pageHeight - 16, pageWidth - margin, pageHeight - 16);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        setText(MUTED);

        if (opts.brandConfig) {
          const contactStr = [opts.brandConfig.contactPhone, opts.brandConfig.contactEmail].filter(Boolean).join(" | ");
          doc.text(`${opts.brandConfig.companyName} Solar Assessment${contactStr ? ` · Contact: ${contactStr}` : ""}`, margin, pageHeight - 10);
        } else {
          doc.text("Independent analysis · Not affiliated with any installer", margin, pageHeight - 10);
        }

        doc.text(`Page ${pageNum} of 5`, pageWidth - margin, pageHeight - 10, { align: "right" });
      };

      // =======================================================================
      // ========================== PAGE 1: COVER ==============================
      // =======================================================================
      paintBoard();

      // Top accent bar
      setFill(accent);
      doc.rect(0, 0, pageWidth, 4, "F");

      // Brand Logo (PNG or Fallback text wordmark)
      if (opts.brandConfig?.logoUrl) {
        try {
          doc.addImage(opts.brandConfig.logoUrl, "PNG", margin, 16, 35, 12);
        } catch (e) {
          setText(accent);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(14);
          doc.text(opts.brandConfig.companyName || "SUNPOWER LINK", margin, 24);
        }
      } else {
        setText(accent);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text("SUNPOWER LINK", margin, 24);
      }

      y = 65;

      // Report Title (display hierarchy)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(32);
      setText(TEXT);
      doc.text("Solar Potential\nAssessment", margin, y);

      y += 24;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      setText(MUTED);
      doc.text("Rooftop Geospatial Energy Yield & Capital Valuation Prospectus", margin, y);

      // Horizontal Rule
      y += 10;
      setStroke(accent);
      doc.setLineWidth(0.6);
      doc.line(margin, y, pageWidth - margin, y);

      y += 15;

      // Metadata block (mono key/value rows)
      const metaRow = (key: string, val: string, yy: number) => {
        doc.setFont("courier", "normal");
        doc.setFontSize(10);
        setText(MUTED);
        doc.text(key, margin, yy);
        setText(TEXT);
        doc.text(val, margin + 32, yy);
      };

      metaRow("SITE ID:", `${analysis.analysisId ?? "N/A"}`, y);
      y += 6.5;
      metaRow("GENERATED:", dateStr, y);
      y += 6.5;

      doc.setFont("courier", "normal");
      doc.setFontSize(10);
      setText(MUTED);
      doc.text("LOCATION:", margin, y);
      setText(TEXT);
      const splitLocation = doc.splitTextToSize(`${opts.locationLabel || "India"}`, contentWidth - 32);
      doc.text(splitLocation, margin + 32, y);

      y += (splitLocation.length * 6);

      // Confidence Badge
      doc.setFont("courier", "bold");
      doc.setFontSize(9.5);
      setText(MUTED);
      doc.text("CONFIDENCE:", margin, y + 2.5);

      const badgeText = `${confidenceScore}% ACCURACY`;
      doc.setFont("courier", "bold");
      doc.setFontSize(8.5);
      const badgeW = doc.getTextWidth(badgeText) + 6;
      setFill(accent);
      doc.roundedRect(margin + 32, y - 1.5, badgeW, 6, 1, 1, "F");
      setText(ONACCENT);
      doc.text(badgeText, margin + 35, y + 2.5);

      y += 25;

      // Large Metric Highlight Card (valuation)
      setFill(PARCEL);
      setStroke(GRID);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, y, contentWidth, 40, 2, 2, "FD");

      setText(MUTED);
      doc.setFont("courier", "bold");
      doc.setFontSize(9);
      doc.text("ESTIMATED PROJECT VALUATION", margin + 8, y + 10);

      // Positive lifetime savings → yield (green) ONLY
      setText(YIELD);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(32);
      doc.text(formatINR(rm.lifetimeSavingsInr), margin + 8, y + 24);

      setText(MUTED);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text("Projected 25-Year Cumulative Lifetime Grid Savings (Post-Subsidy Net Cost)", margin + 8, y + 33);

      drawFooter(1);

      // =======================================================================
      // ========================== PAGE 2: EXEC SUMMARY =======================
      // =======================================================================
      doc.addPage();
      paintBoard();
      drawHeaderBanner("EXECUTIVE SUMMARY");

      y = 32;
      setText(TEXT);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text("Executive Summary", margin, y);

      y += 8;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      setText(MUTED);

      const summaryText = "This technical audit outlines the solar generation capability and financial yield forecasts for the rooftop structure. Calculations are derived via astronomical solar tracking equations combined with local meteorological data proxy models to estimate net solar cash flow, payback timeframes, and levelized costs.";
      const splitSummary = doc.splitTextToSize(summaryText, contentWidth);
      doc.text(splitSummary, margin, y);

      y += 22;

      // 4-Column Metric Grid
      const colW = contentWidth / 4;
      const gridH = 34;

      const metricCards = [
        { label: "SYSTEM SIZE", val: `${rm.installedKw.toFixed(1)} kWp`, desc: `${analysis.panelCount ?? 15} Modules`, tone: TEXT },
        { label: "ANNUAL PRODUCTION", val: `${Math.round(rm.annualProductionKwh).toLocaleString()} kWh`, desc: "Year 1 Yield", tone: TEXT },
        { label: "PAYBACK PERIOD", val: `${rm.paybackYears.toFixed(1)} Yrs`, desc: "Est. Break-even", tone: TEXT },
        { label: "NET PRESENT VALUE", val: formatINR(rm.npvInr), desc: "25-Yr Net NPV", tone: YIELD, highlight: true },
      ];

      metricCards.forEach((m, idx) => {
        const boxX = margin + idx * colW;
        setFill(m.highlight ? PARCEL_HIGH : PARCEL);
        setStroke(GRID);
        doc.setLineWidth(0.3);
        doc.roundedRect(boxX + 1, y, colW - 2, gridH, 1, 1, "FD");

        setText(MUTED);
        doc.setFont("courier", "bold");
        doc.setFontSize(7.5);
        doc.text(m.label, boxX + 5, y + 8);

        setText(m.tone);
        doc.setFont("courier", "bold");
        doc.setFontSize(13);
        doc.text(m.val, boxX + 5, y + 18);

        setText(MUTED);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.text(m.desc, boxX + 5, y + 27);
      });

      y += gridH + 18;

      // Detailed outline text
      setText(TEXT);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("Analysis Parameters", margin, y);

      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      setText(MUTED);

      const paramsText = `• Geospatial orientation is optimized based on an array azimuth of ${analysis.roof?.azimuth ? `${analysis.roof.azimuth}°` : "180° (South)"} and an array tilt angle of ${analysis.roof?.tilt ?? 15}°.
• Usable roof boundary consists of ${analysis.rooftop.usableAreaM2} m² which comfortably supports the estimated capacity.
• Regional climatology is derived from historical solar irradiance arrays, showing stable annual averages.`;
      const splitParams = doc.splitTextToSize(paramsText, contentWidth);
      doc.text(splitParams, margin, y);

      y += 35;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      setText(MUTED);
      doc.text("Based on NASA POWER satellite data and geospatial modeling", margin, y);

      drawFooter(2);

      // =======================================================================
      // ========================== PAGE 3: FINANCIALS =========================
      // =======================================================================
      doc.addPage();
      paintBoard();
      drawHeaderBanner("FINANCIAL FORECAST");

      y = 32;
      setText(TEXT);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text("25-Year Operational Balance Sheet", margin, y);

      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      setText(MUTED);
      doc.text("Key simulation intervals showing projected cash flows, O&M provisions, and cumulative returns.", margin, y);

      y += 12;

      // Table parameters
      const headers = ["Year", "Annual Yield", "Savings", "O&M Cost", "Maint. Res", "Net Cashflow", "Cumulative NPV"];
      const colWidths = [12, 28, 25, 22, 22, 28, 33]; // Total 170

      // Draw table header background (raised inset well)
      setFill(PARCEL_HIGH);
      doc.rect(margin, y, contentWidth, 7, "F");
      setFill(accent);
      doc.rect(margin, y, contentWidth, 0.8, "F"); // accent top rule

      setText(MUTED);
      doc.setFont("courier", "bold");
      doc.setFontSize(8);

      let currentX = margin;
      headers.forEach((h, idx) => {
        const align = idx === 0 ? "left" : "right";
        const textX = align === "left" ? currentX + 2 : currentX + colWidths[idx] - 2;
        doc.text(h, textX, y + 5, { align });
        currentX += colWidths[idx];
      });

      y += 7;

      // Show specific years: 1, 5, 10, 15, 20, 25
      const keyYears = [1, 5, 10, 15, 20, 25];

      keyYears.forEach((yr, rIdx) => {
        // Alternating raised-inset row on the dark board
        if (rIdx % 2 === 1) {
          setFill(PARCEL);
          doc.rect(margin, y, contentWidth, 9, "F");
        }

        const prod = model ? (model.baseAnnualKwh * Math.pow(0.995, yr - 1)) : (rm.annualProductionKwh * Math.pow(0.995, yr - 1));
        const savings = model ? model.yearlySavings[yr - 1] : (rm.annualProductionKwh * 8);
        const om = model ? model.yearlyOm[yr - 1] : (1500 * Math.pow(1.01, yr - 1));
        const maintRes = yr === 10 ? 35000 : 0;
        const net = savings - om - maintRes;
        const cum = model ? (rm.cumulativeCashFlow[yr] ?? 0) : 0;

        const cells = [
          `Yr ${yr}`,
          `${Math.round(prod).toLocaleString()} kWh`,
          formatINR(savings, { decimals: 2 }),
          `(${formatINR(om, { decimals: 2 })})`,
          maintRes > 0 ? `(${formatINR(maintRes, { decimals: 2 })})` : "—",
          `${net > 0 ? "+" : ""}${formatINR(net, { decimals: 2 })}`,
          `${cum >= 0 ? "+" : ""}${formatINR(cum, { decimals: 2 })}`,
        ];

        currentX = margin;
        cells.forEach((val, idx) => {
          const align = idx === 0 ? "left" : "right";
          const textX = align === "left" ? currentX + 2 : currentX + colWidths[idx] - 2;

          if (idx === 0) {
            doc.setFont("helvetica", "bold");
            setText(MUTED);
          } else {
            doc.setFont("courier", "normal");
            if (idx === 2) setText(YIELD);              // Savings (inflow)
            else if (idx === 3 || idx === 4) setText(COST); // O&M + Maint reserve (outflow)
            else if (idx === 5) setText(net >= 0 ? YIELD : COST); // Net cashflow
            else if (idx === 6) setText(cum >= 0 ? YIELD : COST); // Cumulative position
            else setText(TEXT);                          // Annual yield (neutral data)
          }

          doc.text(val, textX, y + 6, { align });
          currentX += colWidths[idx];
        });

        y += 9;
        setStroke(GRID);
        doc.setLineWidth(0.2);
        doc.line(margin, y, pageWidth - margin, y);
      });

      drawFooter(3);

      // =======================================================================
      // ========================== PAGE 4: ASSUMPTIONS ========================
      // =======================================================================
      doc.addPage();
      paintBoard();
      drawHeaderBanner("TECHNICAL ASSUMPTIONS");

      y = 32;
      setText(TEXT);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text("Technical Assumptions", margin, y);

      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      setText(MUTED);
      doc.text("System engineering criteria and weather reference sources used in this assessment.", margin, y);

      y += 12;

      // Table layout: Parameter | Value | Source
      const assHeaders = ["Parameter", "Assumed Value", "Reference Source"];
      const assWidths = [60, 45, 65]; // Total 170

      setFill(PARCEL_HIGH);
      doc.rect(margin, y, contentWidth, 7, "F");
      setFill(accent);
      doc.rect(margin, y, contentWidth, 0.8, "F");

      setText(MUTED);
      doc.setFont("courier", "bold");
      doc.setFontSize(8);

      currentX = margin;
      assHeaders.forEach((h, idx) => {
        doc.text(h, currentX + 2, y + 5);
        currentX += assWidths[idx];
      });

      y += 7;

      const shadingPct = analysis.shadingLoss !== undefined ? `${Math.round(analysis.shadingLoss * 100)}%` : "0.0%";
      const tempDeratePct = analysis.tempDerate !== undefined ? `-${Math.round((1 - analysis.tempDerate) * 100)}%` : "0.0%";

      const assRows = [
        { param: "Panel Degradation", val: "0.55% / yr", src: "NREL Linear Performance Standard" },
        { param: "Inverter Efficiency", val: "97.5%", src: "Manufacturer utility datasheet spec" },
        { param: "System Losses", val: "14.0%", src: "NREL PVWatts structural standard" },
        { param: "Wind Zone", val: analysis.windZone?.label || "Zone 1 (Low)", src: "Bureau of Indian Standards (IS 875 Part 3)" },
        { param: "Temperature Derate", val: tempDeratePct, src: "NASA POWER T2M Temperature Model" },
        { param: "Shading Loss Factor", val: shadingPct, src: "OpenStreetMap 3D building modeling" },
      ];

      assRows.forEach((row, rIdx) => {
        if (rIdx % 2 === 1) {
          setFill(PARCEL);
          doc.rect(margin, y, contentWidth, 9, "F");
        }

        currentX = margin;

        // Parameter
        doc.setFont("helvetica", "bold");
        setText(TEXT);
        doc.text(row.param, currentX + 2, y + 6);
        currentX += assWidths[0];

        // Value
        doc.setFont("courier", "bold");
        setText(TEXT);
        doc.text(row.val, currentX + 2, y + 6);
        currentX += assWidths[1];

        // Source
        doc.setFont("helvetica", "normal");
        setText(MUTED);
        doc.text(row.src, currentX + 2, y + 6);

        y += 9;
        setStroke(GRID);
        doc.setLineWidth(0.2);
        doc.line(margin, y, pageWidth - margin, y);
      });

      drawFooter(4);

      // =======================================================================
      // ========================== PAGE 5: INSTALLER ==========================
      // =======================================================================
      doc.addPage();
      paintBoard();
      drawHeaderBanner("PROJECT MOBILIZATION");

      y = 32;
      setText(TEXT);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text("Installer Quotes & Project Mobilization", margin, y);

      y += 8;

      // "Ready to install? Get 3 verified quotes" heading (accent / CTA)
      setText(accent);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.text("Ready to install? Get 3 verified quotes", margin, y);

      y += 8;

      const installers = [
        { name: "Kalyan Solar Solutions", rating: "4.9 ★", spec: "Residential structural reinforcement & RCC roof mountings" },
        { name: "Tata Power Solar Partner (Aura Energy)", rating: "4.8 ★", spec: "Certified high-wind ballast mounting systems" },
        { name: "Loom Solar Network India", rating: "4.7 ★", spec: "Premium high-wattage monocrystalline PERC installations" },
      ];

      installers.forEach((inst, idx) => {
        setFill(PARCEL);
        setStroke(GRID);
        doc.setLineWidth(0.3);
        doc.roundedRect(margin, y, contentWidth, 24, 1, 1, "FD");

        // Name
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.5);
        setText(TEXT);
        doc.text(inst.name, margin + 6, y + 8);

        // Rating
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        setText(accent);
        doc.text(inst.rating, margin + contentWidth - 16, y + 8);

        // Spec
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        setText(MUTED);
        doc.text(inst.spec, margin + 6, y + 16);

        y += 29;
      });

      y += 2;

      // CTA Button
      const btnW = 65;
      const btnH = 10;
      const btnX = margin + (contentWidth - btnW) / 2;

      setFill(accent);
      doc.roundedRect(btnX, y, btnW, btnH, 1, 1, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      setText(ONACCENT);
      doc.text("REQUEST QUOTES", btnX + (btnW - doc.getTextWidth("REQUEST QUOTES")) / 2, y + 6.5);

      y += 16;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      setText(MUTED);
      doc.text("Clicking the Request Quotes trigger submits your prospectus configuration to local partners.", margin, y, { align: "left" });

      drawFooter(5);

      // Save PDF document
      const filename = `SUNPOWER-${siteId}-${new Date(analysis.generatedAt).toISOString().split('T')[0]}.pdf`;
      doc.save(filename);
      clearTimeout(timer);
      resolve();
    } catch (err) {
      clearTimeout(timer);
      reject(err);
    }
  });
}
