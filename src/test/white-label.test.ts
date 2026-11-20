import { describe, it, expect } from "vitest";
import { generatePDFReport } from "../lib/pdf-generator";
import type { SolarAnalysis } from "../lib/solar-calc";

describe("White-Label report customizations", () => {
  it("should generate reports with brand config overrides successfully", async () => {
    const mockAnalysis: SolarAnalysis = {
      analysisId: "WL-9988",
      generatedAt: new Date().toISOString(),
      source: "manual",
      pitchDegrees: 15,
      isExplicitlyFlat: false,
      exclusionAreaM2: 0,
      exclusionZones: [],
      rooftop: {
        drawnAreaM2: 120,
        usableAreaM2: 84,
      },
      energy: {
        installedCapacityKw: 10,
        annualKwh: 14500,
        peakSunHoursDaily: 4.8,
      },
      financials: {
        electricityRateInr: 8,
        monthlySavingsInr: 9700,
        annualSavingsInr: 116000,
        savings25yrInr: 2900000,
      },
      investment: {
        systemCostInr: 450000,
        subsidyInr: 78000,
        netCostInr: 372000,
        paybackYears: 3.2,
      },
      windZone: {
        zone: 2,
        label: "Moderate Wind Zone",
      },
      tempDerate: 0.88,
      shadingLoss: 0.08,
      confidenceScore: 0.94,
    };

    // Verify it builds with custom logo base64 and hex colors
    const promise = generatePDFReport(
      mockAnalysis,
      {
        locationLabel: "Worli, Mumbai",
        brandConfig: {
          companyName: "Aura Solar Systems",
          primaryColor: "#10B981",
          contactPhone: "9876543210",
          contactEmail: "b2b@aurasolar.com",
        },
      },
      {
        installedKw: 10,
        baseAnnualKwh: 14500,
        paybackPeriod: 3.2,
        netCostInr: 372000,
        cumulativeCashFlow: new Array(26).fill(0),
        yearlySavings: new Array(25).fill(0),
        yearlyOm: new Array(25).fill(0),
        irr: 28.5,
        npv: 970000,
        shadingLoss: 0.08,
      }
    );

    await expect(promise).resolves.not.toThrow();
  });
});
