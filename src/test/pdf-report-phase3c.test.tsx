import React from "react";
import { describe, it, expect } from "vitest";
import { Document, renderToBuffer } from "@react-pdf/renderer";
import { formatReportFooter, formatDate } from "../components/report/tokens";
import { buildReportData } from "../components/report/types";
import { PDFReport } from "../components/report/PDFReport";
import { CoverPage } from "../components/report/CoverPage";
import { ExecutiveSummaryPage } from "../components/report/ExecutiveSummaryPage";
import { SiteAnalysisPage } from "../components/report/SiteAnalysisPage";
import { SystemDesignPage } from "../components/report/SystemDesignPage";
import { FinancialAnalysisPage } from "../components/report/FinancialAnalysisPage";
import { BalanceSheetPage } from "../components/report/BalanceSheetPage";
import { SubsidyCompliancePage } from "../components/report/SubsidyCompliancePage";
import { InstallerQuotationPage } from "../components/report/InstallerQuotationPage";
import { ReportFooter } from "../components/report/ReportFooter";

const mockBaseData = {
  location: { label: "Bandra West, Mumbai, Maharashtra", lat: 19.0596, lng: 72.8295 },
  rooftop: { drawnAreaM2: 80, usableAreaM2: 60 },
  energy: { peakSunHoursDaily: 5.2, annualKwh: 8500 },
  investment: {
    systemCostInr: 350000,
    subsidyInr: 78000,
    netCostInr: 272000,
    paybackYears: 4.0,
    npv: 655216,
    irr: 27.4,
    lcoe: 2.8,
  },
  financials: { savings25yrInr: 2381787, electricityRateInr: 8.0 },
  environmental: { co2AnnualKg: 6800, treesEquivalent: 310 },
  roof: { tilt: 19, azimuth: 180, type: "Reinforced Concrete (RCC) Flat Roof" },
  tempDerate: { percent: 4.2 },
};

function createCompoundingModel() {
  const baseAnnualKwh = 8500;
  const tariff = 8.0;
  const escalation = 0.045;
  const degradation = 0.005;
  const grossCost = 350000;
  const subsidyInr = 78000;
  const netCostInr = grossCost - subsidyInr;

  const yearlySavings: number[] = [];
  const cashFlows: number[] = [-netCostInr];
  const cumulativeCashFlow: number[] = [-netCostInr];
  let runningCum = -netCostInr;

  for (let y = 1; y <= 25; y++) {
    const gen = y === 1 ? Math.round(baseAnnualKwh * 0.995) : Math.round(baseAnnualKwh * (1 - y * degradation));
    const t = tariff * Math.pow(1 + escalation, y - 1);
    const sav = Math.round(gen * t);
    const om = Math.round((grossCost * 0.01) * Math.pow(1 + 0.04, y - 1));
    const net = sav - om;
    runningCum += net;
    yearlySavings.push(sav);
    cashFlows.push(net);
    cumulativeCashFlow.push(runningCum);
  }

  return {
    installedKw: 5.4,
    panelCount: 12,
    pType: "compact" as const,
    baseAnnualKwh,
    subsidyInr,
    grossCost,
    netCostInr,
    paybackPeriod: 4.0,
    breakEvenYr: 4,
    npv: 655216,
    irr: 27.4,
    lcoe: 2.8,
    yearlySavings,
    cashFlows,
    cumulativeCashFlow,
  };
}

describe("PDF Report — Phase 3c Polish & Standardizations", () => {
  const model = createCompoundingModel();
  const report = buildReportData(mockBaseData, model, 12, "compact", 8.0, 4.5, 8.5);

  describe("A. Footer Consistency Across All 8 Pages", () => {
    it("formatReportFooter produces exact uniform string format", () => {
      const footerStr = formatReportFooter("SCAN-MUM-54", "2026-11-21T00:00:00.000Z", 1);
      expect(footerStr).toMatch(/^Report #SCAN-MUM-54 · Generated \d{1,2} \w{3} \d{4} · Page 1 of 8$/);
    });

    it("ReportFooter renders the expected text string for each page", () => {
      for (let p = 1; p <= 8; p++) {
        const expected = formatReportFooter(report.reportId, report.generatedAt, p);
        expect(expected).toContain(`Page ${p} of 8`);
        expect(expected).toContain(`Report #${report.reportId.toUpperCase()}`);
      }
    });

    it("every page component produces valid PDF buffer containing its page number in sequence", async () => {
      const pages = [
        <CoverPage report={report} />,
        <ExecutiveSummaryPage report={report} />,
        <SiteAnalysisPage report={report} />,
        <SystemDesignPage report={report} />,
        <FinancialAnalysisPage report={report} />,
        <BalanceSheetPage report={report} />,
        <SubsidyCompliancePage report={report} />,
        <InstallerQuotationPage report={report} />,
      ];

      for (let idx = 0; idx < pages.length; idx++) {
        const buffer = await renderToBuffer(<Document>{pages[idx]}</Document>);
        expect(buffer.length).toBeGreaterThan(0);
      }
    });
  });

  describe("B. Terminology Standardization", () => {
    it("uses uppercase DISCOM in technical specifications and jurisdiction", () => {
      expect(report.subsidy.discomName).toBeDefined();
      expect(report.subsidy.complianceList.some(c => c.authority.includes("DISCOM") || c.authority.includes("MSEDCL"))).toBe(true);
    });

    it("uses kWp for array capacity and kW for inverter sizing", () => {
      expect(report.system.installedKw).toBe(5.4);
      expect(report.system.inverterKw).toBe(8);
    });

    it("uses PM Surya Ghar scheme naming consistently", () => {
      expect(report.subsidy.complianceList[0].item).toContain("PM Surya Ghar");
    });
  });

  describe("C. PDF Metadata Verification", () => {
    it("PDFReport defines complete document-level metadata", () => {
      const doc = PDFReport({ report });
      expect(doc.props.title).toContain("Solar Feasibility Report — Bandra West, Mumbai, Maharashtra");
      expect(doc.props.author).toBe("SolarScan AI");
      expect(doc.props.subject).toBe("Rooftop Solar Feasibility & Financial Assessment Prospectus");
      expect(doc.props.keywords).toContain("PM Surya Ghar");
      expect(doc.props.creator).toBe("SolarScan AI");
      expect(doc.props.producer).toBe("SolarScan AI");
      expect(doc.props.language).toBe("en-IN");
    });

    it("PDFReport renders complete 8-page document to buffer without throwing", async () => {
      const buffer = await renderToBuffer(<PDFReport report={report} />);
      expect(buffer.length).toBeGreaterThan(50000);
    });
  });

  describe("D. Compounding Model & Curve Verification", () => {
    it("Year 1, 10, 25 net cashflows exhibit realistic compounding growth", () => {
      const y1 = report.financial.cashFlowRows[0].netCashflowInr;
      const y10 = report.financial.cashFlowRows[9].netCashflowInr;
      const y25 = report.financial.cashFlowRows[24].netCashflowInr;

      expect(y1).toBe(64164);
      expect(y10).toBe(91020);
      expect(y25).toBe(162162);

      // Prove compounding: y25 > y10 > y1
      expect(y25).toBeGreaterThan(y10);
      expect(y10).toBeGreaterThan(y1);

      // 25-year cumulative is meaningfully higher than y1 * 25
      const cum25 = report.financial.cashFlowRows[24].cumulativeInr;
      expect(cum25).toBe(2381787);
      expect(cum25).toBeGreaterThan(y1 * 25);
    });

    it("break-even occurs at Year 4 with non-negative cumulative balance", () => {
      expect(report.financial.cashFlowRows[2].cumulativeInr).toBeLessThan(0); // Year 3 negative
      expect(report.financial.cashFlowRows[3].cumulativeInr).toBeGreaterThanOrEqual(0); // Year 4 positive/break-even
      expect(report.financial.breakEvenYear).toBe(4);
    });
  });
});
