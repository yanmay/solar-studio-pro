/**
 * Q3: PM Surya 10 kWp cap — FAILING TEST.
 * calcPMSuryaSubsidy(10.01) must return 0 (ineligible), not ₹78,000.
 * calcSubsidyInr (solar-defaults.ts) must have the same cap.
 *
 * User-approved spec:
 *  3.0 kWp → ₹78,000
 * 10.0 kWp → ₹78,000
 * 10.01 kWp → ₹0 (over 10 kWp cap)
 * 15 kWp → ₹0
 */
import { describe, it, expect } from "vitest";
import { calcPMSuryaSubsidy } from "../lib/pm-surya-subsidy";
import { calcSubsidyInr } from "../lib/solar-defaults";

describe("Q3 — PM Surya 10 kWp cap (calcPMSuryaSubsidy)", () => {
  // Existing passing cases — must remain unchanged
  it("1 kWp → ₹30,000", () => expect(calcPMSuryaSubsidy(1)).toBe(30000));
  it("2 kWp → ₹60,000", () => expect(calcPMSuryaSubsidy(2)).toBe(60000));
  it("3 kWp → ₹78,000 (scheme cap)", () => expect(calcPMSuryaSubsidy(3)).toBe(78000));
  it("3 kWp–10 kWp eligible (subsidy cap ₹78,000)", () => {
    expect(calcPMSuryaSubsidy(5)).toBe(78000);
    expect(calcPMSuryaSubsidy(10)).toBe(78000);
  });

  // NEW: 10 kWp system-size cap — user-approved spec
  it("10.01 kWp → ₹0 (exceeds 10 kWp system-size cap)", () =>
    expect(calcPMSuryaSubsidy(10.01)).toBe(0));

  it("10.35 kWp → ₹0 (the spec example from the brief)", () =>
    expect(calcPMSuryaSubsidy(10.35)).toBe(0));

  it("15 kWp → ₹0", () =>
    expect(calcPMSuryaSubsidy(15)).toBe(0));
});

describe("Q3 — PM Surya 10 kWp cap (calcSubsidyInr in solar-defaults)", () => {
  it("3 kWp → ₹78,000", () => expect(calcSubsidyInr(3)).toBe(78000));
  it("10 kWp → ₹78,000", () => expect(calcSubsidyInr(10)).toBe(78000));
  it("10.01 kWp → ₹0 (exceeds 10 kWp cap)", () => expect(calcSubsidyInr(10.01)).toBe(0));
  it("15 kWp → ₹0", () => expect(calcSubsidyInr(15)).toBe(0));
});
