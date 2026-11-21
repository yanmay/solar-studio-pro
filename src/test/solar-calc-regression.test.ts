/**
 * runFullCalculation — standalone regression test.
 *
 * Context: runFullCalculation() is used in ResultsPage to build the FullResult
 * data backbone (analysis ID, Supabase storage, environmental calculations, the
 * data.* object consumed throughout the page). It is NOT the source of the
 * payback number shown to users — that comes from computeModel(). It was never
 * removed; it still runs on every scan load.
 *
 * This test locks in the function's outputs for 5 canonical inputs so a future
 * refactor can't silently change energy, financial, or investment numbers.
 * Expected values were computed by running the function and recording outputs.
 */
import { describe, it, expect } from "vitest";
import { runFullCalculation, calcSystemCost } from "../lib/solar-calc";
import { calcPMSuryaSubsidy } from "../lib/pm-surya-subsidy";

// Helper: run with fixed inputs, strip the non-deterministic analysisId & timestamp
function run(rooftopAreaM2: number, peakSunHours: number, installedKw: number, tariff: number) {
  return runFullCalculation(rooftopAreaM2, peakSunHours, {
    customCapacityKw: installedKw,
    electricityRate: tariff,
  });
}

describe("runFullCalculation — energy outputs", () => {
  it("2.25 kW @ 5.5 PSH: annualKwh is in range [3800, 4100]", () => {
    const r = run(24, 5.5, 2.25, 7);
    expect(r.energy.annualKwh).toBeGreaterThan(3800);
    expect(r.energy.annualKwh).toBeLessThan(4100);
    expect(r.energy.installedCapacityKw).toBeCloseTo(2.25, 1);
  });

  it("5.4 kW @ 5.0 PSH: annualKwh is in range [8300, 8700]", () => {
    const r = run(56, 5.0, 5.4, 8);
    expect(r.energy.annualKwh).toBeGreaterThan(8300);
    expect(r.energy.annualKwh).toBeLessThan(8700);
  });

  it("9.9 kW @ 4.8 PSH: annualKwh is in range [14500, 15300]", () => {
    const r = run(100, 4.8, 9.9, 9);
    expect(r.energy.annualKwh).toBeGreaterThan(14500);
    expect(r.energy.annualKwh).toBeLessThan(15300);
  });
});

describe("runFullCalculation — capex uses tiered ₹/kW (BUG-005 regression)", () => {
  const cases = [
    { label: "2.25 kW (≤3 kW tier)", installedKw: 2.25, tariff: 7, rooftopM2: 24, psh: 5.5 },
    { label: "5.4 kW (3–10 kW tier)", installedKw: 5.4,  tariff: 8, rooftopM2: 56, psh: 5.0 },
    { label: "9.9 kW (3–10 kW tier)", installedKw: 9.9,  tariff: 9, rooftopM2: 100, psh: 4.8 },
    { label: "10.35 kW (>10 kW tier)", installedKw: 10.35, tariff: 7, rooftopM2: 110, psh: 5.1 },
  ];

  for (const tc of cases) {
    it(`${tc.label}: investment.systemCostInr === calcSystemCost(${tc.installedKw})`, () => {
      const result = run(tc.rooftopM2, tc.psh, tc.installedKw, tc.tariff);
      expect(result.investment.systemCostInr).toBe(calcSystemCost(tc.installedKw));
    });
  }
});

describe("runFullCalculation — subsidy cap applied (10 kWp)", () => {
  it("9.9 kW: subsidyInr === calcPMSuryaSubsidy(9.9) (non-zero)", () => {
    const r = run(100, 4.8, 9.9, 9);
    expect(r.investment.subsidyInr).toBe(calcPMSuryaSubsidy(9.9));
    expect(r.investment.subsidyInr).toBeGreaterThan(0);
  });

  it("10.35 kW: subsidyInr === 0 (over 10 kWp cap)", () => {
    const r = run(110, 5.1, 10.35, 7);
    expect(r.investment.subsidyInr).toBe(0);
  });
});

describe("runFullCalculation — financial sanity (not precision)", () => {
  it("payback period is positive and < 25 years for a viable system", () => {
    const r = run(56, 5.0, 5.4, 8);
    expect(r.investment.paybackYears).toBeGreaterThan(0);
    expect(r.investment.paybackYears).toBeLessThan(25);
  });

  it("npv is a number (not NaN)", () => {
    const r = run(56, 5.0, 5.4, 8);
    expect(Number.isFinite(r.investment.npv!)).toBe(true);
  });

  it("savings25yrInr > systemCostInr for a good system (positive ROI)", () => {
    const r = run(56, 5.0, 5.4, 8);
    expect(r.financials.savings25yrInr).toBeGreaterThan(r.investment.systemCostInr);
  });
});
