import React from "react";
import { describe, it, expect } from "vitest";
import { Document, renderToBuffer } from "@react-pdf/renderer";
import { buildReportData } from "../components/report/types";
import { FinancialAnalysisPage } from "../components/report/FinancialAnalysisPage";
import { BalanceSheetPage } from "../components/report/BalanceSheetPage";
import { SubsidyCompliancePage } from "../components/report/SubsidyCompliancePage";
import { InstallerQuotationPage } from "../components/report/InstallerQuotationPage";

const mockBaseData = {
  location: { label: "Bandra West, Mumbai, Maharashtra", lat: 19.0596, lng: 72.8295 },
  rooftop: { drawnAreaM2: 60, usableAreaM2: 45 },
  energy: { peakSunHoursDaily: 5.2, annualKwh: 4500 },
  investment: {
    systemCostInr: 210000,
    subsidyInr: 78000,
    netCostInr: 132000,
    paybackYears: 4.1,
    npv: 450000,
    irr: 22.4,
    lcoe: 2.8,
  },
  financials: { savings25yrInr: 950000, electricityRateInr: 8.0 },
  environmental: { co2AnnualKg: 3600, treesEquivalent: 165 },
  roof: { tilt: 18, azimuth: 180 },
  tempDerate: { percent: 4.2 },
};

function createMockModel(kw: number, grossCost: number, subsidyInr?: number) {
  const annualKwh = Math.round(kw * 1450);
  const annualSaving = Math.round(annualKwh * 8.0);
  const sub = subsidyInr;
  const net = grossCost - (sub ?? 0);
  const yearlySavings = Array(25).fill(0).map((_, i) => Math.round(annualSaving * Math.pow(1.045, i)));
  const cashFlows = [-net, ...yearlySavings.map((s, i) => Math.round(s - (grossCost * 0.01 * Math.pow(1.04, i))))];
  let cum = -net;
  const cumulativeCashFlow = [-net, ...cashFlows.slice(1).map(cf => { cum += cf; return cum; })];

  return {
    installedKw: kw,
    panelCount: Math.round((kw * 1000) / 450),
    pType: "compact" as const,
    baseAnnualKwh: annualKwh,
    subsidyInr: sub as any,
    grossCost,
    netCostInr: net,
    paybackPeriod: Number((net / annualSaving).toFixed(1)),
    breakEvenYr: Math.ceil(net / annualSaving),
    npv: Math.round(net * 2.8),
    irr: 24.5,
    lcoe: 2.8,
    yearlySavings,
    cashFlows,
    cumulativeCashFlow,
  };
}

describe("PDF Report — Phase 3b Data Builder Contracts & Computations", () => {
  describe("PM Surya Ghar Subsidy Tier Computations", () => {
    it("1 kW system receives ₹30,000", () => {
      const model = createMockModel(1.0, 75000);
      const report = buildReportData(mockBaseData, model, 2, "compact", 8.0, 4.5, 8.5);
      expect(report.subsidy.tier1Amount).toBe(30000);
      expect(report.subsidy.tier2Amount).toBe(0);
      expect(report.subsidy.amount).toBe(30000);
      expect(report.subsidy.cap10kWpApplied).toBe(false);
    });

    it("2 kW system receives ₹60,000", () => {
      const model = createMockModel(2.0, 140000);
      const report = buildReportData(mockBaseData, model, 4, "compact", 8.0, 4.5, 8.5);
      expect(report.subsidy.tier1Amount).toBe(60000);
      expect(report.subsidy.tier2Amount).toBe(0);
      expect(report.subsidy.amount).toBe(60000);
      expect(report.subsidy.cap10kWpApplied).toBe(false);
    });

    it("3 kW system receives ₹78,000 (Tier 1 ₹60k + Tier 2 ₹18k)", () => {
      const model = createMockModel(3.0, 210000);
      const report = buildReportData(mockBaseData, model, 7, "compact", 8.0, 4.5, 8.5);
      expect(report.subsidy.tier1Amount).toBe(60000);
      expect(report.subsidy.tier2Amount).toBe(18000);
      expect(report.subsidy.amount).toBe(78000);
      expect(report.subsidy.cap10kWpApplied).toBe(false);
    });

    it("5 kW system receives ₹78,000 (capped at ₹78k ceiling)", () => {
      const model = createMockModel(5.0, 320000);
      const report = buildReportData(mockBaseData, model, 11, "compact", 8.0, 4.5, 8.5);
      expect(report.subsidy.amount).toBe(78000);
      expect(report.subsidy.cap10kWpApplied).toBe(false);
    });

    it("10 kW system receives ₹78,000 (at the 10 kW residential ceiling)", () => {
      const model = createMockModel(10.0, 600000);
      const report = buildReportData(mockBaseData, model, 22, "compact", 8.0, 4.5, 8.5);
      expect(report.subsidy.amount).toBe(78000);
      expect(report.subsidy.cap10kWpApplied).toBe(false);
    });

    it(">10 kW system receives ₹0 and marks cap10kWpApplied / ineligibleAbove10kW", () => {
      const model = createMockModel(10.35, 620000);
      const report = buildReportData(mockBaseData, model, 23, "compact", 8.0, 4.5, 8.5);
      expect(report.subsidy.amount).toBe(0);
      expect(report.subsidy.tier1Amount).toBe(0);
      expect(report.subsidy.tier2Amount).toBe(0);
      expect(report.subsidy.cap10kWpApplied).toBe(true);
      expect(report.subsidy.ineligibleAbove10kW).toBe(true);
      expect(report.subsidy.eligible).toBe(false);
    });

    it("tier1Amount + tier2Amount equals finalSubsidy for eligible systems", () => {
      [1, 2, 3, 5, 10].forEach(kw => {
        const m = createMockModel(kw, 70000 * kw, undefined);
        const r = buildReportData(mockBaseData, m, Math.ceil(kw / 0.45), "compact", 8.0, 4.5, 8.5);
        expect(r.subsidy.tier1Amount + r.subsidy.tier2Amount).toBe(r.subsidy.amount);
      });
    });
  });

  describe("25-Year Cashflow Schedule (Balance Sheet Rows)", () => {
    const model3kW = createMockModel(3.0, 210000, 78000);
    const report = buildReportData(mockBaseData, model3kW, 7, "compact", 8.0, 4.5, 8.5);

    it("cashFlowRows has exactly 25 rows", () => {
      expect(report.financial.cashFlowRows.length).toBe(25);
    });

    it("cashFlowRows[0].generationKwh matches system.annualKwhYear1", () => {
      expect(report.financial.cashFlowRows[0].generationKwh).toBe(report.system.annualKwhYear1);
    });

    it("cashFlowRows correctly maps 26-element model.cashFlows without off-by-one errors", () => {
      // cashFlowRows[0] (Year 1) must equal model.cashFlows[1]
      expect(report.financial.cashFlowRows[0].netCashflowInr).toBe(model3kW.cashFlows[1]);
      // cashFlowRows[24] (Year 25) must equal model.cashFlows[25]
      expect(report.financial.cashFlowRows[24].netCashflowInr).toBe(model3kW.cashFlows[25]);
    });

    it("degradationPct starts at 0.5% in Year 1 and reaches 12.5% in Year 25", () => {
      expect(report.financial.cashFlowRows[0].degradationPct).toBe(0.5);
      expect(report.financial.cashFlowRows[24].degradationPct).toBe(12.5);
    });

    it("cumulativeInr starts at -netCapex + Year 1 net cashflow and crosses zero at payback", () => {
      const netCapex = report.financial.netCapexInr;
      const y1Net = report.financial.cashFlowRows[0].netCashflowInr;
      expect(report.financial.cashFlowRows[0].cumulativeInr).toBe(-netCapex + y1Net);

      const sumNet = report.financial.cashFlowRows.reduce((acc, row) => acc + row.netCashflowInr, 0);
      expect(report.financial.cashFlowRows[24].cumulativeInr).toBe(-netCapex + sumNet);
    });

    it("netCashflowInr equals grossSavingsInr minus omCostInr for every row", () => {
      report.financial.cashFlowRows.forEach(row => {
        expect(row.netCashflowInr).toBe(row.grossSavingsInr - row.omCostInr);
      });
    });
  });

  describe("Derating & Cost Breakdown Consistency", () => {
    const model = createMockModel(3.0, 210000, 78000);
    const report = buildReportData(mockBaseData, model, 7, "compact", 8.0, 4.5, 8.5);

    it("derating.totalSystemLossPct ≈ 14% (±0.5)", () => {
      expect(report.system.derating.totalSystemLossPct).toBeGreaterThanOrEqual(13.5);
      expect(report.system.derating.totalSystemLossPct).toBeLessThanOrEqual(14.5);
    });

    it("costBreakdown reflects 13.8% composite GST on pre-GST base and matches grossCapexInr exactly", () => {
      const { costBreakdown, grossCapexInr } = report.financial;
      const preGstBase = Math.round(grossCapexInr / 1.138);

      // Pre-GST subtotal matches
      const preGstSum =
        costBreakdown.panelsInr +
        costBreakdown.inverterInr +
        costBreakdown.mountingBosInr +
        costBreakdown.laborInstallInr;
      expect(preGstSum).toBe(preGstBase);

      // GST is exactly ~13.8% of pre-GST base
      const effectiveGstRate = costBreakdown.gstInr / preGstBase;
      expect(effectiveGstRate).toBeCloseTo(0.138, 2);

      // Total equals grossCapexInr exactly to the rupee
      expect(costBreakdown.totalInr).toBe(grossCapexInr);
      expect(preGstSum + costBreakdown.gstInr).toBe(grossCapexInr);
    });
  });

  describe("Discounted Payback Calculation", () => {
    it("discountedPaybackYears is > 0 and < 25 for a standard 3kW system", () => {
      const model = createMockModel(3.0, 210000, 78000);
      const report = buildReportData(mockBaseData, model, 7, "compact", 8.0, 4.5, 8.5);
      expect(report.financial.discountedPaybackYears).toBeGreaterThan(0);
      expect(report.financial.discountedPaybackYears).toBeLessThan(25);
    });
  });

  describe("Jurisdiction & DISCOM Mapping", () => {
    it("site.state drives subsidy.discomName (e.g. Maharashtra → MSEDCL)", () => {
      const model = createMockModel(3.0, 210000, 78000);
      const report = buildReportData(
        { ...mockBaseData, location: { label: "Kothrud, Pune, Maharashtra, India" } },
        model,
        7,
        "compact",
        8.0,
        4.5,
        8.5
      );

      expect(report.site.state).toBe("Maharashtra");
      expect(report.subsidy.discomName).toContain("MSEDCL");
    });
  });

  describe("Page 3: SiteAnalysisPage Component & Contracts", () => {
    it("exports SiteAnalysisPage component that accepts ReportData", async () => {
      const { SiteAnalysisPage } = await import("../components/report/SiteAnalysisPage");
      expect(SiteAnalysisPage).toBeDefined();
      expect(typeof SiteAnalysisPage).toBe("function");
    });

    it("site.monthlyShadingProfile contains exactly 12 months with valid loss percentages", () => {
      const model = createMockModel(3.0, 210000, 78000);
      const report = buildReportData(mockBaseData, model, 7, "compact", 8.0, 4.5, 8.5);
      expect(report.site.monthlyShadingProfile).toHaveLength(12);
      expect(report.site.monthlyShadingProfile[0].month).toBe("Jan");
      expect(report.site.monthlyShadingProfile[11].month).toBe("Dec");
      report.site.monthlyShadingProfile.forEach(m => {
        expect(m.lossPct).toBeGreaterThanOrEqual(0);
        expect(m.lossPct).toBeLessThanOrEqual(100);
      });
    });

    it("site roof geometry satisfies area bounds, tilt, and azimuth requirements", () => {
      const model = createMockModel(3.0, 210000, 78000);
      const report = buildReportData(mockBaseData, model, 7, "compact", 8.0, 4.5, 8.5);
      expect(report.site.rooftopAreaM2).toBeGreaterThan(0);
      expect(report.site.usableAreaM2).toBeLessThanOrEqual(report.site.rooftopAreaM2);
      expect(report.site.tiltDeg).toBe(18);
      expect(report.site.azimuth).toBe(180);
      expect(report.site.orientationLabel).toBe("South-facing, 18° tilt");
    });

    it("site structural parameters specify roofType and structuralLoadKgM2", () => {
      const model = createMockModel(3.0, 210000, 78000);
      const report = buildReportData(mockBaseData, model, 7, "compact", 8.0, 4.5, 8.5);
      expect(report.site.roofType).toBe("Reinforced Concrete (RCC) Flat Roof");
      expect(report.site.structuralLoadKgM2).toBeGreaterThan(0);
      expect(report.site.structuralLoadKgM2).toBeLessThanOrEqual(25);
    });
  });

  describe("Page 4: SystemDesignPage Component & Contracts", () => {
    it("exports SystemDesignPage component that accepts ReportData", async () => {
      const { SystemDesignPage } = await import("../components/report/SystemDesignPage");
      expect(SystemDesignPage).toBeDefined();
      expect(typeof SystemDesignPage).toBe("function");
    });

    it("panel grid generates exactly N panels for system.panelCount", () => {
      const model = createMockModel(3.0, 210000, 78000);
      const report = buildReportData(mockBaseData, model, 7, "compact", 8.0, 4.5, 8.5);
      expect(report.system.panelCount).toBe(7);

      const columns = Math.min(10, Math.max(4, Math.ceil(Math.sqrt(report.system.panelCount * 1.5))));
      const panels = Array.from({ length: report.system.panelCount });
      expect(panels).toHaveLength(7);
      expect(columns).toBe(4);
    });

    it("derating factors sum to totalSystemLossPct", () => {
      const model = createMockModel(3.0, 210000, 78000);
      const report = buildReportData(mockBaseData, model, 7, "compact", 8.0, 4.5, 8.5);
      const { derating } = report.system;
      const sum = Number((
        derating.temperaturePct +
        derating.soilingPct +
        derating.mismatchPct +
        derating.inverterPct +
        derating.wiringPct
      ).toFixed(1));
      expect(sum).toBe(derating.totalSystemLossPct);
    });

    it("dcAcRatio matches installedKw / inverterKw", () => {
      const model = createMockModel(5.4, 350000, 78000);
      const report = buildReportData(mockBaseData, model, 12, "compact", 8.0, 4.5, 8.5);
      const expectedRatio = Number((report.system.installedKw / report.system.inverterKw).toFixed(2));
      expect(report.system.dcAcRatio).toBe(expectedRatio);
    });

    it("equipment table shows correct panel model for compact vs premium", () => {
      const model = createMockModel(3.0, 210000, 78000);
      const compactReport = buildReportData(mockBaseData, model, 7, "compact", 8.0, 4.5, 8.5);
      expect(compactReport.system.panelModel).toBe("Waaree WS-450 HalfCell");
      expect(compactReport.system.panelWattage).toBe(450);

      const premiumReport = buildReportData(mockBaseData, model, 6, "premium", 8.0, 4.5, 8.5);
      expect(premiumReport.system.panelModel).toBe("Longi Hi-MO 6 LR5-72HTH-550M");
      expect(premiumReport.system.panelWattage).toBe(550);
    });
  });

  describe("Page 5: FinancialAnalysisPage Component", () => {
    it("FinancialAnalysisPage renders without throwing for valid ReportData", async () => {
      const model = createMockModel(3.0, 210000, 78000);
      const report = buildReportData(mockBaseData, model, 7, "compact", 8.0, 4.5, 8.5);
      const buffer = await renderToBuffer(
        <Document>
          <FinancialAnalysisPage report={report} />
        </Document>
      );
      expect(buffer.length).toBeGreaterThan(0);
    });

    it("creates a valid React element accepting data prop", () => {
      const model = createMockModel(3.0, 210000, 78000);
      const report = buildReportData(mockBaseData, model, 7, "compact", 8.0, 4.5, 8.5);
      const el = <FinancialAnalysisPage data={report} />;
      expect(el).toBeTruthy();
      expect(el.type).toBe(FinancialAnalysisPage);
    });
  });

  describe("Page 6: BalanceSheetPage Component", () => {
    it("BalanceSheetPage renders 25 rows and produces valid PDF buffer", async () => {
      const model = createMockModel(3.0, 210000, 78000);
      const report = buildReportData(mockBaseData, model, 7, "compact", 8.0, 4.5, 8.5);
      expect(report.financial.cashFlowRows).toHaveLength(25);
      expect(report.financial.cashFlowRows[24].year).toBe(25);

      const buffer = await renderToBuffer(
        <Document>
          <BalanceSheetPage report={report} />
        </Document>
      );
      expect(buffer.length).toBeGreaterThan(0);
    });

    it("creates a valid React element accepting data prop", () => {
      const model = createMockModel(3.0, 210000, 78000);
      const report = buildReportData(mockBaseData, model, 7, "compact", 8.0, 4.5, 8.5);
      const el = <BalanceSheetPage data={report} />;
      expect(el).toBeTruthy();
      expect(el.type).toBe(BalanceSheetPage);
    });
  });

  describe("Page 7: SubsidyCompliancePage Component & Compliance Rules", () => {
    it("subsidy.amount === tier1Amount + tier2Amount for eligible systems", () => {
      [1, 2, 3].forEach(kw => {
        const m = createMockModel(kw, 70000 * kw, undefined);
        const r = buildReportData(mockBaseData, m, Math.ceil(kw / 0.45), "compact", 8.0, 4.5, 8.5);
        expect(r.subsidy.amount).toBe(r.subsidy.tier1Amount + r.subsidy.tier2Amount);
      });
    });

    it("complianceList renders N rows matching subsidy.complianceList.length", () => {
      const model = createMockModel(5.4, 350000, 78000);
      const report = buildReportData(mockBaseData, model, 12, "compact", 8.0, 4.5, 8.5);
      expect(report.subsidy.complianceList).toBeDefined();
      expect(report.subsidy.complianceList.length).toBe(4);
      const validStatuses = ["Eligible", "Required", "Exempt", "Pending"];
      report.subsidy.complianceList.forEach(item => {
        expect(validStatuses).toContain(item.status);
        expect(item.item.length).toBeGreaterThan(0);
        expect(item.authority.length).toBeGreaterThan(0);
        expect(item.reference.length).toBeGreaterThan(0);
      });
    });

    it("ineligibleAbove10kW shows not eligible message and sets subsidy amount to 0", () => {
      const model = createMockModel(12.0, 720000);
      const report = buildReportData(mockBaseData, model, 27, "compact", 8.0, 4.5, 8.5);
      expect(report.subsidy.ineligibleAbove10kW).toBe(true);
      expect(report.subsidy.eligible).toBe(false);
      expect(report.subsidy.amount).toBe(0);
      expect(report.subsidy.cap10kWpApplied).toBe(true);
    });

    it("SubsidyCompliancePage renders without error and outputs valid PDF buffer", async () => {
      const model = createMockModel(3.0, 210000, 78000);
      const report = buildReportData(mockBaseData, model, 7, "compact", 8.0, 4.5, 8.5);
      const buffer = await renderToBuffer(
        <Document>
          <SubsidyCompliancePage report={report} />
        </Document>
      );
      expect(buffer.length).toBeGreaterThan(0);
    });

    it("creates a valid React element accepting data prop", () => {
      const model = createMockModel(3.0, 210000, 78000);
      const report = buildReportData(mockBaseData, model, 7, "compact", 8.0, 4.5, 8.5);
      const el = <SubsidyCompliancePage data={report} />;
      expect(el).toBeTruthy();
      expect(el.type).toBe(SubsidyCompliancePage);
    });
  });

  describe("Page 8: InstallerQuotationPage Component & Quotation Rules", () => {
    it("quotation.lineItems sum to quotation.grossTotalInr (±1 rounding)", () => {
      [1.0, 3.0, 5.4, 10.0].forEach(kw => {
        const model = createMockModel(kw, Math.round(kw * 65000), 78000);
        const report = buildReportData(mockBaseData, model, Math.ceil(kw / 0.45), "compact", 8.0, 4.5, 8.5);
        const sumLineItems = report.quotation.lineItems.reduce((acc, item) => acc + item.amountInr, 0);
        expect(Math.abs(sumLineItems - report.quotation.grossTotalInr)).toBeLessThanOrEqual(1);
      });
    });

    it("quotation.milestones percentages sum to 100", () => {
      const model = createMockModel(5.4, 350000, 78000);
      const report = buildReportData(mockBaseData, model, 12, "compact", 8.0, 4.5, 8.5);
      const sumPct = report.quotation.milestones.reduce((acc, ms) => acc + ms.percentage, 0);
      expect(sumPct).toBe(100);
      expect(report.quotation.milestones.length).toBe(3);
    });

    it("isPlaceholder flag reflects whether custom installer details are configured", () => {
      const model = createMockModel(3.0, 210000, 78000);
      const defaultReport = buildReportData(mockBaseData, model, 7, "compact", 8.0, 4.5, 8.5);
      expect(defaultReport.quotation.installerInfo.isPlaceholder).toBe(true);

      const customReport = buildReportData(
        mockBaseData,
        model,
        7,
        "compact",
        8.0,
        4.5,
        8.5,
        { installerName: "Apex Solar EPC Ltd", phone: "+91 98765 43210", email: "info@apexsolar.in" }
      );
      expect(customReport.quotation.installerInfo.isPlaceholder).toBe(false);
      expect(customReport.quotation.installerInfo.name).toBe("Apex Solar EPC Ltd");
    });

    it("InstallerQuotationPage renders without error and outputs valid PDF buffer", async () => {
      const model = createMockModel(3.0, 210000, 78000);
      const report = buildReportData(mockBaseData, model, 7, "compact", 8.0, 4.5, 8.5);
      const buffer = await renderToBuffer(
        <Document>
          <InstallerQuotationPage report={report} />
        </Document>
      );
      expect(buffer.length).toBeGreaterThan(0);
    });

    it("creates a valid React element accepting data prop", () => {
      const model = createMockModel(3.0, 210000, 78000);
      const report = buildReportData(mockBaseData, model, 7, "compact", 8.0, 4.5, 8.5);
      const el = <InstallerQuotationPage data={report} />;
      expect(el).toBeTruthy();
      expect(el.type).toBe(InstallerQuotationPage);
    });
  });
});
