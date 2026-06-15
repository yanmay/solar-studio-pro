// Client-side PDF report generator for SUNPOWER LINK
// Uses jsPDF to create a branded solar analysis report

import { jsPDF } from "jspdf";
import type { SolarAnalysis } from "./solar-calc";
import { COST_PER_KW_INR } from "./solar-defaults";

interface PDFOptions {
  locationLabel?: string;
}

/**
 * Generate a branded PDF report from a SolarAnalysis object.
 * Returns a Promise that resolves when the download triggers.
 * 
 * Hard limit: 10 seconds. If generation exceeds this, rejects with REPORT_TIMEOUT.
 */
export async function generatePDFReport(
  analysis: SolarAnalysis,
  opts: PDFOptions = {}
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("REPORT_TIMEOUT"));
    }, 10000);

    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - margin * 2;
      let y = margin;

      // ==========================================
      // ===== PAGE 1: TITLE & SITE OVERVIEW ======
      // ==========================================

      // ===== HEADER GRADIENT BAR =====
      doc.setFillColor(26, 143, 209); // #1A8FD1
      doc.rect(0, 0, pageWidth, 45, "F");
      // Gradient overlay
      doc.setFillColor(61, 170, 111); // #3DAA6F
      doc.rect(pageWidth * 0.4, 0, pageWidth * 0.6, 45, "F");
      doc.setFillColor(212, 184, 0); // #D4B800
      doc.rect(pageWidth * 0.75, 0, pageWidth * 0.25, 45, "F");

      // Title
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(28);
      doc.setFont("helvetica", "bold");
      doc.text("SUNPOWER LINK", margin, 22);
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text("Solar Potential Analysis Report", margin, 33);

      // Date
      const dateStr = new Date(analysis.generatedAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      doc.setFontSize(10);
      doc.text(dateStr, pageWidth - margin, 33, { align: "right" });

      y = 55;

      // ===== LOCATION =====
      if (opts.locationLabel) {
        doc.setTextColor(80, 80, 80);
        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        doc.text(`📍 ${opts.locationLabel}`, margin, y);
        y += 8;
      }

      // ===== ANALYSIS ID =====
      doc.setTextColor(150, 150, 150);
      doc.setFontSize(9);
      doc.text(`Analysis ID: ${analysis.analysisId}`, margin, y);
      y += 12;

      // ===== SECTION: ROOFTOP OVERVIEW =====
      y = drawSectionTitle(doc, "Rooftop Overview", margin, y, pageWidth);
      y = drawKeyValue(doc, "Drawn Area", `${analysis.rooftop.drawnAreaM2} m²`, margin, y, contentWidth);
      y = drawKeyValue(doc, "Usable Area (75%)", `${analysis.rooftop.usableAreaM2} m²`, margin, y, contentWidth);
      y += 6;

      // ===== SECTION: ENERGY PRODUCTION =====
      y = drawSectionTitle(doc, "Energy Production", margin, y, pageWidth);
      y = drawKeyValue(doc, "Installed Capacity", `${analysis.energy.installedCapacityKw} kWp`, margin, y, contentWidth);
      y = drawKeyValue(doc, "Peak Sun Hours", `${analysis.energy.peakSunHoursDaily} hrs/day`, margin, y, contentWidth);
      y = drawKeyValue(doc, "Daily Generation", `${analysis.energy.dailyKwh} kWh`, margin, y, contentWidth);
      y = drawKeyValue(doc, "Monthly Generation", `${analysis.energy.monthlyKwh.toLocaleString()} kWh`, margin, y, contentWidth);
      y = drawKeyValue(doc, "Annual Generation", `${analysis.energy.annualKwh.toLocaleString()} kWh`, margin, y, contentWidth);
      y += 6;

      // ===== SECTION: ENVIRONMENTAL IMPACT =====
      y = drawSectionTitle(doc, "Environmental Impact", margin, y, pageWidth);
      y = drawKeyValue(doc, "CO₂ Saved Annually", `${analysis.environmental.co2AnnualKg.toLocaleString()} kg`, margin, y, contentWidth);
      y = drawKeyValue(doc, "CO₂ Saved (25 Years)", `${analysis.environmental.co2_25yrKg.toLocaleString()} kg`, margin, y, contentWidth);
      y = drawKeyValue(doc, "Equivalent Trees Planted", `${analysis.environmental.treesEquivalent} trees`, margin, y, contentWidth);

      // Page 1 Footer
      doc.setTextColor(180, 180, 180);
      doc.setFontSize(8);
      doc.text("Page 1 of 2", pageWidth / 2, pageHeight - 10, { align: "center" });

      // ==========================================
      // ===== PAGE 2: FINANCIAL FEASIBILITY ======
      // ==========================================
      doc.addPage();

      // Header Banner
      doc.setFillColor(26, 143, 209); // #1A8FD1
      doc.rect(0, 0, pageWidth, 20, "F");
      doc.setFillColor(61, 170, 111); // #3DAA6F
      doc.rect(pageWidth * 0.4, 0, pageWidth * 0.6, 20, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("SUNPOWER LINK — Solar Potential Report", margin, 12);

      y = 35;

      // ===== SECTION: FINANCIAL IMPACT =====
      y = drawSectionTitle(doc, "Financial Impact & Outlay Ledger", margin, y, pageWidth);
      y = drawKeyValue(doc, "Electricity Tariff Rate", `₹${analysis.financials.electricityRateInr}/kWh`, margin, y, contentWidth);
      y = drawKeyValue(doc, "Monthly Utility Savings", `₹${analysis.financials.monthlySavingsInr.toLocaleString()}`, margin, y, contentWidth);
      y = drawKeyValue(doc, "Annual Utility Savings", `₹${analysis.financials.annualSavingsInr.toLocaleString()}`, margin, y, contentWidth);

      // Capital calculations matching ResultsPage.tsx
      const installedKw = analysis.energy.installedCapacityKw;
      const grossCostInr = Math.round(installedKw * COST_PER_KW_INR);
      let subsidyInr = 0;
      if (installedKw <= 2) subsidyInr = Math.round(installedKw * 30000);
      else if (installedKw <= 3) subsidyInr = 60000 + Math.round((installedKw - 2) * 18000);
      else subsidyInr = 78000;
      const netCostInr = Math.max(0, grossCostInr - subsidyInr);
      const emi5yr = Math.round((netCostInr * 0.08 / 12) / (1 - Math.pow(1 + 0.08 / 12, -60)));

      y = drawKeyValue(doc, "Gross Installation Outlay", `₹${grossCostInr.toLocaleString()}`, margin, y, contentWidth);
      y = drawKeyValue(doc, "PM Surya Ghar National Subsidy", `− ₹${subsidyInr.toLocaleString()}`, margin, y, contentWidth);
      y = drawKeyValue(doc, "Estimated EMI (5-Yr @ 8%)", `₹${emi5yr.toLocaleString()} / month`, margin, y, contentWidth);

      y += 6;

      // Outlay Highlights
      doc.setFillColor(248, 250, 252); // light slate/gray
      doc.roundedRect(margin, y, contentWidth, 14, 2, 2, "F");
      doc.setTextColor(71, 85, 105);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("Net Capital Outlay (Post-Subsidy)", margin + 6, y + 9);
      doc.setFontSize(11);
      doc.setTextColor(241, 124, 88); // brand primary color #F17C58
      doc.text(`₹${netCostInr.toLocaleString()}`, pageWidth - margin - 6, y + 9, { align: "right" });
      
      y += 18;

      // 25-Year Savings Box
      doc.setFillColor(234, 247, 239); // light green
      doc.roundedRect(margin, y, contentWidth, 14, 2, 2, "F");
      doc.setTextColor(43, 120, 62);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("25-Year Cumulative Savings", margin + 6, y + 9);
      doc.setFontSize(11);
      doc.text(`₹${analysis.financials.savings25yrInr.toLocaleString()}`, pageWidth - margin - 6, y + 9, { align: "right" });
      
      y += 24;

      // ===== ASSUMPTIONS =====
      doc.setFillColor(245, 245, 245);
      doc.roundedRect(margin, y, contentWidth, 30, 2, 2, "F");
      doc.setTextColor(120, 120, 120);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      const assumptions = [
        "Assumptions: Panel efficiency 20% (monocrystalline) · System losses 14% (inverter + wiring)",
        "Usable area factor 75% · Grid emission factor 0.82 kg CO₂/kWh (India national average)",
        `Data source: ${analysis.irradianceSource === "NASA_POWER" ? "NASA POWER API (satellite-derived)" : "Regional PSH lookup table (MNRE)"}`,
      ];
      assumptions.forEach((line, i) => {
        doc.text(line, margin + 4, y + 6 + i * 8);
      });

      // ===== FOOTER =====
      doc.setTextColor(180, 180, 180);
      doc.setFontSize(8);
      doc.text("Generated by SUNPOWER LINK — sunpowerlink.in", pageWidth / 2, pageHeight - 15, { align: "center" });
      doc.text("This report is for estimation purposes only. Actual results may vary.", pageWidth / 2, pageHeight - 10, { align: "center" });
      doc.text("Page 2 of 2", pageWidth / 2, pageHeight - 5, { align: "center" });

      // Save directly via jsPDF
      doc.save(`SUNPOWER_LINK_Solar_Report_${analysis.analysisId}.pdf`);
      clearTimeout(timer);
      resolve();
    } catch (err) {
      clearTimeout(timer);
      reject(err);
    }
  });
}

// ---------- Helper functions ----------

function drawSectionTitle(doc: jsPDF, title: string, x: number, y: number, pageWidth: number): number {
  doc.setTextColor(26, 143, 209); // brand blue
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(title, x, y);
  // Underline
  doc.setDrawColor(26, 143, 209);
  doc.setLineWidth(0.5);
  doc.line(x, y + 2, pageWidth - x, y + 2);
  doc.setFont("helvetica", "normal");
  return y + 10;
}

function drawKeyValue(doc: jsPDF, key: string, value: string, x: number, y: number, width: number): number {
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(key, x + 4, y);
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold");
  doc.text(value, x + width - 4, y, { align: "right" });

  // Dotted separator
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.2);
  doc.setLineDashPattern([1, 2], 0);
  doc.line(x, y + 3, x + width, y + 3);
  doc.setLineDashPattern([], 0);

  return y + 9;
}
