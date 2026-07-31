import { describe, it, expect } from "vitest";
import { runFullCalculation } from "../lib/solar-calc";

describe("solar-calc", () => {
  it("should calculate correctly with default area-based capacity", () => {
    const analysis = runFullCalculation(100, 4.8, { pitchDegrees: 0 }); // 100 m2 roof, 4.8 peak sun hours, pitch 0

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
      pitchDegrees: 0,
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
      pitchDegrees: 0,
    });

    expect(analysis.energy.installedCapacityKw).toBe(9.38); // estimated
    expect(analysis.energy.annualKwh).toBeGreaterThan(0);
  });

  it("should apply roof pitch correction correctly to usable area", () => {
    const analysis0 = runFullCalculation(100, 4.8, { pitchDegrees: 0 });
    expect(analysis0.rooftop.usableAreaM2).toBe(75);

    const analysis20 = runFullCalculation(100, 4.8, { pitchDegrees: 20 });
    expect(analysis20.rooftop.usableAreaM2).toBe(79.8);

    const analysis30 = runFullCalculation(100, 4.8, { pitchDegrees: 30 });
    expect(analysis30.rooftop.usableAreaM2).toBe(86.6);
  });

  it("should calculate correctly with wind and temperature parameters", () => {
    const analysisBase = runFullCalculation(100, 4.8, { pitchDegrees: 0 });
    
    const analysisWithWindAndTemp = runFullCalculation(100, 4.8, {
      pitchDegrees: 0,
      ws10m: 18,
      t2m: 25,
    });

    expect(analysisWithWindAndTemp.windZone).toEqual({ zone: 2, label: "Moderate Wind Zone" });
    
    const capacity = analysisBase.energy.installedCapacityKw;
    const expectedWindAdder = 3000 * capacity;
    expect(analysisWithWindAndTemp.investment.systemCostInr).toBe(analysisBase.investment.systemCostInr + Math.round(expectedWindAdder));

    expect(analysisWithWindAndTemp.energy.annualKwh).toBeCloseTo(analysisBase.energy.annualKwh * 0.902, -1);
  });

  it("should respect shading override modes and apply correct losses", () => {
    const analysisAuto = runFullCalculation(100, 4.8, { pitchDegrees: 0, shading: "auto", computedShadingLoss: 0.12 });
    expect(analysisAuto.shadingLoss).toBe(0.12);

    const analysisNone = runFullCalculation(100, 4.8, { pitchDegrees: 0, shading: "none", computedShadingLoss: 0.12 });
    expect(analysisNone.shadingLoss).toBe(0.0);

    const analysisPartial = runFullCalculation(100, 4.8, { pitchDegrees: 0, shading: "partial", computedShadingLoss: 0.12 });
    expect(analysisPartial.shadingLoss).toBe(0.15);

    const analysisHeavy = runFullCalculation(100, 4.8, { pitchDegrees: 0, shading: "heavy", computedShadingLoss: 0.12 });
    expect(analysisHeavy.shadingLoss).toBe(0.30);
  });
});
