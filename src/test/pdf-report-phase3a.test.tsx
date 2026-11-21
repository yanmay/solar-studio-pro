import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import ReactPDF from "@react-pdf/renderer";
import { existsSync, unlinkSync } from "fs";
import { resolve } from "path";
import { buildReportData, type ReportData } from "../components/report/types";
import { PDFReport } from "../components/report/PDFReport";
import { HTMLPrintView } from "../components/report/HTMLPrintView";
import { inrFmt, inrLakhs } from "../components/report/tokens";

const mockSolarData = {
  location: { label: "Bandra West, Mumbai, Maharashtra", lat: 19.0596, lng: 72.8295 },
  rooftop: { drawnAreaM2: 80, usableAreaM2: 60 },
  energy: { peakSunHoursDaily: 5.2, annualKwh: 8500 },
  investment: {
    systemCostInr: 350000,
    subsidyInr: 78000,
    netCostInr: 272000,
    paybackYears: 4.1,
    npv: 820000,
    irr: 24.5,
    lcoe: 2.8,
  },
  financials: { savings25yrInr: 1250000, electricityRateInr: 8.0 },
  environmental: { co2AnnualKg: 6800, treesEquivalent: 310 },
  roof: { tilt: 19, azimuth: 180 },
};

const mockModel = {
  installedKw: 5.4,
  panelCount: 12,
  pType: "compact" as const,
  baseAnnualKwh: 8500,
  subsidyInr: 78000,
  grossCost: 350000,
  netCostInr: 272000,
  paybackPeriod: 4.1,
  breakEvenYr: 5,
  npv: 820000,
  irr: 24.5,
  lcoe: 2.8,
  yearlySavings: [68000, 71000, 74000],
  cashFlows: [-272000, 68000, 71000, 74000],
  cumulativeCashFlow: [-272000, -204000, -133000, -59000, 15000],
};

describe("PDF Report — Phase 3a Data & Tokens", () => {
  it("inrFmt formats with Indian grouping", () => {
    expect(inrFmt(113469)).toBe("1,13,469");
    expect(inrFmt(1000000)).toBe("10,00,000");
  });

  it("inrLakhs formats with L and Cr suffixes", () => {
    expect(inrLakhs(78000)).toBe("₹78,000");
    expect(inrLakhs(125000)).toBe("₹1.25L");
    expect(inrLakhs(12500000)).toBe("₹1.3Cr");
  });

  it("buildReportData constructs a complete ReportData contract", () => {
    const report = buildReportData(mockSolarData, mockModel, 12, "compact", 8.0, 4.5, 8.5);

    expect(report.site.address).toBe("Bandra West, Mumbai, Maharashtra");
    expect(report.system.installedKw).toBe(5.4);
    expect(report.system.panelCount).toBe(12);
    expect(report.financial.paybackPeriod).toBe(4.1);
    expect(report.financial.subsidyInr).toBe(78000);
    expect(report.subsidy.eligible).toBe(true);
    expect(report.subsidy.cap10kWpApplied).toBe(false);
  });

  it("buildReportData marks >10 kWp as subsidy cap applied", () => {
    const bigModel = { ...mockModel, installedKw: 10.35, subsidyInr: 0 };
    const report = buildReportData(mockSolarData, bigModel, 23, "compact", 8.0, 4.5, 8.5);

    expect(report.subsidy.cap10kWpApplied).toBe(true);
    expect(report.financial.subsidyInr).toBe(0);
  });

  it("HTMLPrintView renders without crashing and shows both pages", () => {
    const report = buildReportData(mockSolarData, mockModel, 12, "compact", 8.0, 4.5, 8.5);
    const { getByText, getAllByText } = render(<HTMLPrintView report={report} />);

    // Check page 1 (Cover)
    expect(getAllByText(/SolarScan AI/i).length).toBeGreaterThan(0);
    expect(getAllByText(/Bandra West, Mumbai, Maharashtra/i).length).toBeGreaterThan(0);

    // Check page 2 (Executive Summary)
    expect(getByText(/Executive Summary & Financial Prospectus/i)).toBeDefined();
    expect(getByText(/Key Feasibility Metrics/i)).toBeDefined();
    expect(getAllByText(/5.40 kWp/i).length).toBeGreaterThan(0);
    expect(getByText(/PM Surya Ghar: Muft Bijli Yojana Status/i)).toBeDefined();
  });

  it("renders a 2-page PDF file to disk with @react-pdf/renderer without error", async () => {
    const report = buildReportData(mockSolarData, mockModel, 12, "compact", 8.0, 4.5, 8.5);
    const outputPath = resolve(process.cwd(), "test-feasibility-report.pdf");
    await ReactPDF.renderToFile(<PDFReport report={report} />, outputPath);
    expect(existsSync(outputPath)).toBe(true);
    if (existsSync(outputPath)) unlinkSync(outputPath);
  });
});
