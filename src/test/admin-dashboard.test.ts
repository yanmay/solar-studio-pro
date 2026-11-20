import { describe, it, expect } from "vitest";

// Analytics formula tests
describe("Internal Analytics Formula Verification", () => {
  it("should calculate correct Scan Completion Rate", () => {
    const started = 620;
    const completed = 580;
    const rate = started > 0 ? (completed / started) * 100 : 0;
    expect(rate).toBeCloseTo(93.548, 3);
  });

  it("should calculate correct PDF Purchase Rate", () => {
    const completedScans = 580;
    const pdfSales = 12;
    const rate = completedScans > 0 ? (pdfSales / completedScans) * 100 : 0;
    expect(rate).toBeCloseTo(2.069, 3);
  });

  it("should calculate correct Lead Generation Rate", () => {
    const completedScans = 580;
    const leadSales = 24;
    const rate = completedScans > 0 ? (leadSales / completedScans) * 100 : 0;
    expect(rate).toBeCloseTo(4.1379, 4);
  });

  it("should sum up total platform revenue correctly", () => {
    const pdfSalesCount = 100; // * 149
    const leadSalesCount = 50;  // * 1200
    const saasRevenue = 49950;
    
    const total = (pdfSalesCount * 149) + (leadSalesCount * 1200) + saasRevenue;
    expect(total).toBe(14900 + 60000 + 49950); // 124850
  });
});
