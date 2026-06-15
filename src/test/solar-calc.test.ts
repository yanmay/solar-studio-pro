import { describe, it, expect } from "vitest";
import { runFullCalculation } from "../lib/solar-calc";

describe("solar-calc", () => {
  it("should calculate correctly with default area-based capacity", () => {
    const analysis = runFullCalculation(100, 4.8); // 100 m2 roof, 4.8 peak sun hours

    expect(analysis.rooftop.drawnAreaM2).toBe(100);
    expect(analysis.rooftop.usableAreaM2).toBe(75); // 100 * 0.75
    expect(analysis.energy.installedCapacityKw).toBe(9.38); // 75 / 8
    expect(analysis.energy.annualKwh).toBeGreaterThan(0);
    expect(analysis.financials.annualSavingsInr).toBeGreaterThan(0);
    expect(analysis.environmental.treesEquivalent).toBeGreaterThan(0);
  });

  it("should calculate correctly with custom panel-based capacity", () => {
    const analysis = runFullCalculation(100, 4.8, {
      customCapacityKw: 6.6,
      panelCount: 12,
      panelType: "premium",
    });

    expect(analysis.rooftop.drawnAreaM2).toBe(100);
    expect(analysis.energy.installedCapacityKw).toBe(6.6); // overridden
    expect(analysis.panelCount).toBe(12);
    expect(analysis.panelType).toBe("premium");
  });

  it("should correctly fall back when custom capacity is 0", () => {
    const analysis = runFullCalculation(100, 4.8, {
      customCapacityKw: undefined, // simulated fallback
      panelCount: undefined,
    });

    expect(analysis.energy.installedCapacityKw).toBe(9.38); // estimated
    expect(analysis.energy.annualKwh).toBeGreaterThan(0);
  });
});
