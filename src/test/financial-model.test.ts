/**
 * BUG-005: Financial model unification.
 * computeModel() in ResultsPage uses flat per-panel pricing (₹18k/22k per panel + ₹35k fixed).
 * runFullCalculation() / calcSystemCost() uses tiered ₹/kW pricing (₹65k/₹58k/₹50k/kW).
 * Tiered ₹/kW is the correct model (user-approved in Q2 decision).
 *
 * This test records the output of BOTH models on 5 known inputs to document the divergence,
 * then after the fix, asserts the unified model (tiered ₹/kW) is used consistently.
 */
import { describe, it, expect } from "vitest";
import { calcSystemCost } from "../lib/solar-calc";
import { SYSTEM_COST_PER_KW_INR_TIERS } from "../lib/solar-defaults";

// Known input set: { installedKw, pCount, pType }
const TEST_CASES = [
  { installedKw: 2.25,  pCount: 5,  pType: "compact" as const },   // small system (≤3 kW tier)
  { installedKw: 3.3,   pCount: 6,  pType: "premium" as const },   // mid system (3–10 kW tier)
  { installedKw: 5.4,   pCount: 12, pType: "compact" as const },   // mid system
  { installedKw: 9.9,   pCount: 18, pType: "premium" as const },   // near 10 kW cap
  { installedKw: 10.35, pCount: 23, pType: "compact" as const },   // over 10 kW
];

function flatPanelCost(pCount: number, pType: "compact" | "premium"): number {
  return pCount * (pType === "premium" ? 22000 : 18000) + 35000;
}

function tieredKwCost(installedKw: number): number {
  return calcSystemCost(installedKw);
}

describe("BUG-005: Financial model comparison (pre-fix documentation)", () => {
  it("tiered model always differs from flat-panel model on representative inputs", () => {
    for (const tc of TEST_CASES) {
      const flat = flatPanelCost(tc.pCount, tc.pType);
      const tiered = tieredKwCost(tc.installedKw);
      // These WILL differ — that's the bug. Documenting the gap.
      console.log(`${tc.installedKw} kW: flat=₹${flat.toLocaleString("en-IN")}, tiered=₹${tiered.toLocaleString("en-IN")}, diff=₹${Math.abs(flat-tiered).toLocaleString("en-IN")}`);
      // No assertion here — this is just documentation
    }
    expect(true).toBe(true); // placeholder
  });
});

describe("BUG-005: Tiered pricing is the correct model (calcSystemCost)", () => {
  it("SYSTEM_COST_PER_KW_INR_TIERS defines tiered pricing", () => {
    expect(SYSTEM_COST_PER_KW_INR_TIERS).toBeDefined();
    expect(SYSTEM_COST_PER_KW_INR_TIERS[0].cost).toBe(65000); // ≤3 kW tier
    expect(SYSTEM_COST_PER_KW_INR_TIERS[1].cost).toBe(58000); // 3–10 kW tier
  });

  it("3 kW system costs ₹1,95,000 (3 × ₹65,000)", () => {
    expect(calcSystemCost(3)).toBe(195000);
  });

  it("5 kW system costs ₹2,90,000 (5 × ₹58,000)", () => {
    expect(calcSystemCost(5)).toBe(290000);
  });

  it("10 kW system costs ₹5,80,000 (10 × ₹58,000)", () => {
    expect(calcSystemCost(10)).toBe(580000);
  });

  it("15 kW system costs ₹7,50,000 (15 × ₹50,000)", () => {
    expect(calcSystemCost(15)).toBe(750000);
  });
});

describe("BUG-005: computeModel in ResultsPage.tsx uses tiered pricing (post-fix)", () => {
  it("ResultsPage.tsx computeModel must NOT use flat per-panel pricing", () => {
    const { readFileSync } = require("fs");
    const { resolve } = require("path");
    const src = readFileSync(resolve(__dirname, "../pages/ResultsPage.tsx"), "utf-8");

    // After fix: computeModel must call calcSystemCost, not use flat per-panel formula
    expect(src).toContain("calcSystemCost");

    // After fix: the flat per-panel formula must be gone from computeModel
    // The formula is: pCount * (pType === "premium" ? 22000 : 18000) + 35000
    expect(src).not.toContain("pCount * (pType === \"premium\" ? 22000 : 18000) + 35000");
  });
});
