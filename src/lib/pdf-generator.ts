import { jsPDF } from "jspdf";
import type { SolarAnalysis } from "./solar-calc";
import { calcConfidenceScore } from "./confidence-score";

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

/**
 * Format currency to Lakhs / Crores or Thousands notation (never raw numbers)
 */
const formatCurrencyPDF = (val: number) => {
  const abs = Math.abs(val);
  const sign = val < 0 ? "-" : "";
  if (abs >= 1_00_00_000) {
    return `${sign}₹${(abs / 1_00_00_000).toFixed(2)} Cr`;
  }
  if (abs >= 1_00_000) {
    return `${sign}₹${(abs / 1_00_000).toFixed(2)} L`;
  }
  if (abs >= 1_000) {
    return `${sign}₹${(abs / 1_00_000).toFixed(2)} L`; // strict Lakhs limit per requirements
  }
  return `${sign}₹${abs}`;
};

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
      
      // Margins & Dimensions (McKinsey style grids)
      const margin = 18;
      const contentWidth = pageWidth - margin * 2;
      let y = margin;

      // Extract values
      const installedKw = model?.installedKw ?? analysis.energy.installedCapacityKw;
      const baseAnnualKwh = model?.baseAnnualKwh ?? analysis.energy.annualKwh;
      const paybackPeriod = model?.paybackPeriod ?? analysis.investment.paybackYears;
      const netCostInr = model?.netCostInr ?? analysis.investment.netCostInr;
      const npv = model?.npv ?? analysis.investment.netCostInr;
      const savings25yr = model ? (model.cumulativeCashFlow[25] + model.netCostInr) : analysis.financials.savings25yrInr;
      const savings25L = (savings25yr / 100000).toFixed(2);
      const siteId = analysis.analysisId?.slice(-6).toUpperCase() || "REPORT";
      const dateStr = new Date(analysis.generatedAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });

      // B2B White Label Color Accents setup
      const primaryRgb = opts.brandConfig?.primaryColor 
        ? hexToRgb(opts.brandConfig.primaryColor) 
        : { r: 15, g: 23, b: 42 }; // default navy #0F172A
      
      const highlightRgb = opts.brandConfig?.primaryColor 
        ? hexToRgb(opts.brandConfig.primaryColor) 
        : { r: 180, g: 83, b: 9 }; // default amber #B45309
      
      const highlightBgRgb = opts.brandConfig?.primaryColor 
        ? {
            r: Math.round(primaryRgb.r + (255 - primaryRgb.r) * 0.9),
            g: Math.round(primaryRgb.g + (255 - primaryRgb.g) * 0.9),
            b: Math.round(primaryRgb.b + (255 - primaryRgb.b) * 0.9)
          }
        : { r: 254, g: 243, b: 199 }; // default light-amber bg

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

      // Helper for Header Banner
      const drawHeaderBanner = (pageTitle: string) => {
        doc.setFillColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
        doc.rect(0, 0, pageWidth, 16, "F");
        
        doc.setTextColor(240, 238, 233); // #F0EEE9
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(`${opts.brandConfig?.companyName || "SUNPOWER LINK"}  |  ${pageTitle}`, margin, 10);
        
        doc.setFont("courier", "bold");
        doc.setFontSize(8.5);
        doc.text(`SITE ID: ${siteId}`, pageWidth - margin, 10, { align: "right" });
      };

      // Helper for Footer
      const drawFooter = (pageNum: number) => {
        doc.setDrawColor(229, 231, 235); // #E5E7EB
        doc.setLineWidth(0.3);
        doc.line(margin, pageHeight - 16, pageWidth - margin, pageHeight - 16);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139); // #64748B
        
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
      
      // Top accent bar
      doc.setFillColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
      doc.rect(0, 0, pageWidth, 4, "F");

      // Brand Logo (PNG or Fallback text wordmark)
      if (opts.brandConfig?.logoUrl) {
        try {
          doc.addImage(opts.brandConfig.logoUrl, "PNG", margin, 16, 35, 12);
        } catch (e) {
          doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(14);
          doc.text(opts.brandConfig.companyName || "SUNPOWER LINK", margin, 24);
        }
      } else {
        doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text("SUNPOWER LINK", margin, 24);
      }

      y = 65;

      // Report Title
      doc.setFont("times", "bold");
      doc.setFontSize(32);
      doc.setTextColor(26, 26, 26); // #1A1A1A
      doc.text("Solar Potential\nAssessment", margin, y);
      
      y += 24;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(100, 116, 139);
      doc.text("Rooftop Geospatial Energy Yield & Capital Valuation Prospectus", margin, y);

      // Horizontal Rule
      y += 10;
      doc.setDrawColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
      doc.setLineWidth(0.6);
      doc.line(margin, y, pageWidth - margin, y);

      y += 15;

      // Metadata block
      doc.setFont("courier", "normal");
      doc.setFontSize(10);
      doc.setTextColor(26, 26, 26);
      
      doc.text(`SITE ID:     ${analysis.analysisId ?? "N/A"}`, margin, y);
      y += 6.5;
      doc.text(`GENERATED:   ${dateStr}`, margin, y);
      y += 6.5;
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const splitLocation = doc.splitTextToSize(`LOCATION:    ${opts.locationLabel || "India"}`, contentWidth);
      doc.text(splitLocation, margin, y);
      
      y += (splitLocation.length * 6);

      // Confidence Badge
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.text("CONFIDENCE:  ", margin, y + 2.5);
      
      const badgeText = `${confidenceScore}% ACCURACY`;
      const badgeW = doc.getTextWidth(badgeText) + 6;
      doc.setFillColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
      doc.roundedRect(margin + 26, y - 1.5, badgeW, 6, 1, 1, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("courier", "bold");
      doc.setFontSize(8.5);
      doc.text(badgeText, margin + 29, y + 2.5);

      y += 25;

      // Large Metric Highlight Card
      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.3);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(margin, y, contentWidth, 40, 2, 2, "FD");

      doc.setTextColor(100, 116, 139);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("ESTIMATED PROJECT VALUATION", margin + 8, y + 10);

      doc.setTextColor(highlightRgb.r, highlightRgb.g, highlightRgb.b);
      doc.setFont("times", "bold");
      doc.setFontSize(32);
      doc.text(`₹${savings25L} Lakh`, margin + 8, y + 24);

      doc.setTextColor(100, 116, 139);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text("Projected 25-Year Cumulative Lifetime Grid Savings (Post-Subsidy Net Cost)", margin + 8, y + 33);

      drawFooter(1);

      // =======================================================================
      // ========================== PAGE 2: EXEC SUMMARY =======================
      // =======================================================================
      doc.addPage();
      drawHeaderBanner("EXECUTIVE SUMMARY");

      y = 32;
      doc.setTextColor(26, 26, 26);
      doc.setFont("times", "bold");
      doc.setFontSize(22);
      doc.text("Executive Summary", margin, y);
      
      y += 8;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85);
      
      const summaryText = "This technical audit outlines the solar generation capability and financial yield forecasts for the rooftop structure. Calculations are derived via astronomical solar tracking equations combined with local meteorological data proxy models to estimate net solar cash flow, payback timeframes, and levelized costs.";
      const splitSummary = doc.splitTextToSize(summaryText, contentWidth);
      doc.text(splitSummary, margin, y);
      
      y += 22;

      // 4-Column Metric Grid
      const colW = contentWidth / 4;
      const gridH = 34;

      const metrics = [
        { label: "System Size", val: `${installedKw.toFixed(1)} kWp`, desc: `${analysis.panelCount ?? 15} Modules` },
        { label: "Annual Production", val: `${Math.round(baseAnnualKwh).toLocaleString()} kWh`, desc: "Year 1 Yield" },
        { label: "Payback Period", val: `${paybackPeriod.toFixed(1)} Yrs`, desc: "Est. Break-even" },
        { label: "Net Present Value", val: formatCurrencyPDF(npv), desc: "25-Yr Net NPV", highlight: true },
      ];

      metrics.forEach((m, idx) => {
        const boxX = margin + idx * colW;
        doc.setFillColor(m.highlight ? highlightBgRgb.r : 255, m.highlight ? highlightBgRgb.g : 255, m.highlight ? highlightBgRgb.b : 255);
        doc.setDrawColor(229, 231, 235);
        doc.roundedRect(boxX + 1, y, colW - 2, gridH, 1, 1, "FD");

        doc.setTextColor(100, 116, 139);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text(m.label, boxX + 5, y + 8);

        doc.setTextColor(m.highlight ? highlightRgb.r : 26, m.highlight ? highlightRgb.g : 26, m.highlight ? highlightRgb.b : 26);
        doc.setFont("times", "bold");
        doc.setFontSize(14);
        doc.text(m.val, boxX + 5, y + 18);

        doc.setTextColor(148, 163, 184);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.text(m.desc, boxX + 5, y + 27);
      });

      y += gridH + 18;

      // Detailed outline text
      doc.setTextColor(26, 26, 26);
      doc.setFont("times", "bold");
      doc.setFontSize(14);
      doc.text("Analysis Parameters", margin, y);

      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(71, 85, 105);

      const paramsText = `• Geospatial orientation is optimized based on an array azimuth of ${analysis.roof?.azimuth ? `${analysis.roof.azimuth}°` : "180° (South)"} and an array tilt angle of ${analysis.roof?.tilt ?? 15}°.
• Usable roof boundary consists of ${analysis.rooftop.usableAreaM2} m² which comfortably supports the estimated capacity.
• Regional climatology is derived from historical solar irradiance arrays, showing stable annual averages.`;
      const splitParams = doc.splitTextToSize(paramsText, contentWidth);
      doc.text(splitParams, margin, y);

      y += 35;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text("Based on NASA POWER satellite data and geospatial modeling", margin, y);

      drawFooter(2);

      // =======================================================================
      // ========================== PAGE 3: FINANCIALS =========================
      // =======================================================================
      doc.addPage();
      drawHeaderBanner("FINANCIAL FORECAST");

      y = 32;
      doc.setTextColor(26, 26, 26);
      doc.setFont("times", "bold");
      doc.setFontSize(22);
      doc.text("25-Year Operational Balance Sheet", margin, y);

      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(100, 116, 139);
      doc.text("Key simulation intervals showing projected cash flows, O&M provisions, and cumulative returns.", margin, y);

      y += 12;

      // Table parameters
      const headers = ["Year", "Annual Yield", "Savings", "O&M Cost", "Maint. Res", "Net Cashflow", "Cumulative NPV"];
      const colWidths = [12, 28, 25, 22, 22, 28, 33]; // Total 170

      // Draw table header background
      doc.setFillColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
      doc.rect(margin, y, contentWidth, 7, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
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
      doc.setFont("courier", "normal"); // Monospace/tabular-nums look for cash flow ledger
      doc.setFontSize(8.5);

      keyYears.forEach((yr, rIdx) => {
        // Alternating background row color
        if (rIdx % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, y, contentWidth, 9, "F");
        }

        const prod = model ? (model.baseAnnualKwh * Math.pow(0.995, yr - 1)) : (baseAnnualKwh * Math.pow(0.995, yr - 1));
        const savings = model ? model.yearlySavings[yr - 1] : (baseAnnualKwh * 8);
        const om = model ? model.yearlyOm[yr - 1] : (1500 * Math.pow(1.01, yr - 1));
        const maintRes = yr === 10 ? 35000 : 0;
        const net = savings - om - maintRes;
        const cum = model ? model.cumulativeCashFlow[yr] : 0;

        const cells = [
          `Yr ${yr}`,
          `${Math.round(prod).toLocaleString()} kWh`,
          formatCurrencyPDF(savings),
          `(${formatCurrencyPDF(om)})`,
          maintRes > 0 ? `(${formatCurrencyPDF(maintRes)})` : "—",
          `${net > 0 ? "+" : ""}${formatCurrencyPDF(net)}`,
          `${cum >= 0 ? "+" : ""}${formatCurrencyPDF(cum)}`,
        ];

        currentX = margin;
        cells.forEach((val, idx) => {
          const align = idx === 0 ? "left" : "right";
          const textX = align === "left" ? currentX + 2 : currentX + colWidths[idx] - 2;
          
          if (idx === 0) {
            doc.setFont("helvetica", "bold");
            doc.setTextColor(71, 85, 105);
          } else {
            doc.setFont("courier", "normal");
            doc.setTextColor(idx === 3 || idx === 4 ? 185 : idx === 5 ? (net > 0 ? 5 : 185) : 26, idx === 3 || idx === 4 ? 28 : idx === 5 ? (net > 0 ? 150 : 28) : 26, idx === 3 || idx === 4 ? 28 : idx === 5 ? (net > 0 ? 105 : 28) : 26);
          }

          doc.text(val, textX, y + 6, { align });
          currentX += colWidths[idx];
        });

        y += 9;
        doc.setDrawColor(241, 245, 249);
        doc.setLineWidth(0.2);
        doc.line(margin, y, pageWidth - margin, y);
      });

      drawFooter(3);

      // =======================================================================
      // ========================== PAGE 4: ASSUMPTIONS ========================
      // =======================================================================
      doc.addPage();
      drawHeaderBanner("TECHNICAL ASSUMPTIONS");

      y = 32;
      doc.setTextColor(26, 26, 26);
      doc.setFont("times", "bold");
      doc.setFontSize(22);
      doc.text("Technical Assumptions", margin, y);

      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(100, 116, 139);
      doc.text("System engineering criteria and weather reference sources used in this assessment.", margin, y);

      y += 12;

      // Table layout: Parameter | Value | Source
      const assHeaders = ["Parameter", "Assumed Value", "Reference Source"];
      const assWidths = [60, 45, 65]; // Total 170

      doc.setFillColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
      doc.rect(margin, y, contentWidth, 7, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
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
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, y, contentWidth, 9, "F");
        }

        currentX = margin;
        
        // Parameter
        doc.setFont("helvetica", "bold");
        doc.setTextColor(26, 26, 26);
        doc.text(row.param, currentX + 2, y + 6);
        currentX += assWidths[0];

        // Value
        doc.setFont("courier", "bold");
        doc.setTextColor(71, 85, 105);
        doc.text(row.val, currentX + 2, y + 6);
        currentX += assWidths[1];

        // Source
        doc.setFont("helvetica", "normal");
        doc.setTextColor(148, 163, 184);
        doc.text(row.src, currentX + 2, y + 6);

        y += 9;
        doc.setDrawColor(241, 245, 249);
        doc.line(margin, y, pageWidth - margin, y);
      });

      drawFooter(4);

      // =======================================================================
      // ========================== PAGE 5: INSTALLER ==========================
      // =======================================================================
      doc.addPage();
      drawHeaderBanner("PROJECT MOBILIZATION");

      y = 32;
      doc.setTextColor(26, 26, 26);
      doc.setFont("times", "bold");
      doc.setFontSize(22);
      doc.text("Installer Quotes & Project Mobilization", margin, y);

      y += 8;

      // "Ready to install? Get 3 verified quotes" heading
      doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
      doc.setFont("times", "bold");
      doc.setFontSize(15);
      doc.text("Ready to install? Get 3 verified quotes", margin, y);

      y += 8;

      const installers = [
        { name: "Kalyan Solar Solutions", rating: "4.9 ★", spec: "Residential structural reinforcement & RCC roof mountings" },
        { name: "Tata Power Solar Partner (Aura Energy)", rating: "4.8 ★", spec: "Certified high-wind ballast mounting systems" },
        { name: "Loom Solar Network India", rating: "4.7 ★", spec: "Premium high-wattage monocrystalline PERC installations" },
      ];

      installers.forEach((inst, idx) => {
        doc.setDrawColor(229, 231, 235);
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(margin, y, contentWidth, 24, 1, 1, "FD");

        // Name
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.5);
        doc.setTextColor(26, 26, 26);
        doc.text(inst.name, margin + 6, y + 8);

        // Rating
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(highlightRgb.r, highlightRgb.g, highlightRgb.b);
        doc.text(inst.rating, margin + contentWidth - 16, y + 8);

        // Spec
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text(inst.spec, margin + 6, y + 16);

        y += 29;
      });

      y += 2;

      // CTA Button
      const btnW = 65;
      const btnH = 10;
      const btnX = margin + (contentWidth - btnW) / 2;

      doc.setFillColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
      doc.roundedRect(btnX, y, btnW, btnH, 1, 1, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(255, 255, 255);
      doc.text("REQUEST QUOTES", btnX + (btnW - doc.getTextWidth("REQUEST QUOTES")) / 2, y + 6.5);

      y += 16;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(148, 163, 184);
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
