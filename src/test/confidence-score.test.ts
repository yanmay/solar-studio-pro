import { describe, it, expect } from "vitest";
import { calcConfidenceScore } from "../lib/confidence-score";

describe("confidence-score", () => {
  it("should return the correct base score for manual trace", () => {
    // manual: 0.92, deduction for pitchDegrees === 0 (-0.03), deduction for computedShadingLoss is null (-0.05),
    // deduction for exclusionAreaM2 === 0 (-0.04)
    // 0.92 - 0.03 - 0.05 - 0.04 = 0.80
    const score = calcConfidenceScore({
      source: "manual",
      pitchDegrees: 0,
      isExplicitlyFlat: false,
      computedShadingLoss: null,
      exclusionAreaM2: 0,
    });
    expect(score).toBeCloseTo(0.80);
  });

  it("should return the maximum clamped score if bonuses exceed limit", () => {
    // manual: 0.92, isExplicitlyFlat: true (no pitch deduction), computedShadingLoss: 0.05 (no shading deduction),
    // exclusionAreaM2: 10 (no exclusion deduction), live api (no fallback deduction),
    // pvlibAvailable: true (+0.05), allExclusionZonesDrawn: true (+0.02)
    // 0.92 + 0.05 + 0.02 = 0.99 → clamped to 0.97
    const score = calcConfidenceScore({
      source: "manual",
      pitchDegrees: 0,
      isExplicitlyFlat: true,
      computedShadingLoss: 0.05,
      exclusionAreaM2: 10,
      isRegionalFallback: false,
      pvlibAvailable: true,
      allExclusionZonesDrawn: true,
    });
    expect(score).toBe(0.97);
  });

  it("should return the minimum clamped score if deductions are heavy", () => {
    // none: 0.40, pitchDegrees: 0, not confirmed flat (-0.03), shading loss null (-0.05),
    // no obstructions (-0.04), regional fallback (-0.06)
    // 0.40 - 0.03 - 0.05 - 0.04 - 0.06 = 0.22 → clamped to 0.30
    const score = calcConfidenceScore({
      source: "none",
      pitchDegrees: 0,
      isExplicitlyFlat: false,
      computedShadingLoss: null,
      exclusionAreaM2: 0,
      isRegionalFallback: true,
    });
    expect(score).toBe(0.30);
  });
});
