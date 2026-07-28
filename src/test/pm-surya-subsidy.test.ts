import { describe, it, expect } from "vitest";
import { calcPMSuryaSubsidy, isEligible } from "../lib/pm-surya-subsidy";

describe("PM-Surya Ghar Subsidy Calculation", () => {
  it("should calculate correct subsidy for systems up to 2 kWp", () => {
    expect(calcPMSuryaSubsidy(1)).toBe(30000);
    expect(calcPMSuryaSubsidy(1.5)).toBe(45000);
    expect(calcPMSuryaSubsidy(2)).toBe(60000);
  });

  it("should calculate correct subsidy for systems between 2 and 3 kWp", () => {
    expect(calcPMSuryaSubsidy(2.5)).toBe(69000);
    expect(calcPMSuryaSubsidy(3)).toBe(78000);
  });

  it("should cap subsidy at ₹78,000 for systems above 3 kWp", () => {
    expect(calcPMSuryaSubsidy(3.5)).toBe(78000);
    expect(calcPMSuryaSubsidy(5)).toBe(78000);
    expect(calcPMSuryaSubsidy(10)).toBe(78000);
    expect(calcPMSuryaSubsidy(12)).toBe(78000);
  });

  it("should return 0 for non-positive system sizes", () => {
    expect(calcPMSuryaSubsidy(0)).toBe(0);
    expect(calcPMSuryaSubsidy(-1)).toBe(0);
  });
});

describe("PM-Surya Ghar Eligibility Checker", () => {
  it("should approve domestic connections in eligible states", () => {
    expect(isEligible("Maharashtra", "domestic")).toBe(true);
    expect(isEligible("Delhi", "DOMESTIC")).toBe(true);
    expect(isEligible("karnataka", " domestic ")).toBe(true);
  });

  it("should reject non-domestic connection types", () => {
    expect(isEligible("Maharashtra", "commercial")).toBe(false);
    expect(isEligible("Delhi", "industrial")).toBe(false);
    expect(isEligible("Karnataka", "")).toBe(false);
  });

  it("should reject North Eastern states", () => {
    expect(isEligible("Assam", "domestic")).toBe(false);
    expect(isEligible("Arunachal Pradesh", "domestic")).toBe(false);
    expect(isEligible("Manipur", "domestic")).toBe(false);
    expect(isEligible("Meghalaya", "domestic")).toBe(false);
    expect(isEligible("Mizoram", "domestic")).toBe(false);
    expect(isEligible("Nagaland", "domestic")).toBe(false);
    expect(isEligible("Tripura", "domestic")).toBe(false);
    expect(isEligible("Sikkim", "domestic")).toBe(false);
  });
});
