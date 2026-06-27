import { describe, it, expect } from "vitest";
import {
  calculateAltitudeAdjustment,
  calculateWindZoneDetails,
  calculateTemperatureCoefficientLoss,
  DEFAULT_ACCURACY_CONFIG,
} from "../lib/accuracy-modules";
import { runFullCalculation } from "../lib/solar-calc";

describe("1. Altitude Irradiance Adjustment Module", () => {
  it("applies zero adjustment for sea-level (0m) coordinates", () => {
    const adj = calculateAltitudeAdjustment(0, 5.0);
    expect(adj).toBeCloseTo(5.0, 4);
  });

  it("applies +7.5% irradiance adjustment for 1000m coordinates", () => {
    // Scaling is +0.75% per 100m, so +7.5% at 1000m.
    // 5.0 * 1.075 = 5.375
    const adj = calculateAltitudeAdjustment(1000, 5.0);
    expect(adj).toBeCloseTo(5.375, 4);
  });

  it("applies +15% irradiance adjustment for 2000m coordinates", () => {
    // 5.0 * 1.15 = 5.75
    const adj = calculateAltitudeAdjustment(2000, 5.0);
    expect(adj).toBeCloseTo(5.75, 4);
  });
});

describe("2. Wind Zones IS 875 Module", () => {
  it("maps Low wind speed to Zone 1", () => {
    // Wind average 2.0 m/s -> basic 20.0 m/s < 33 m/s -> Zone 1 (Low)
    const details = calculateWindZoneDetails(2.0);
    expect(details.windZone).toBe("Zone 1");
    expect(details.windZoneLabel).toBe("Low");
    expect(details.surchargePerKwp).toBe(5000);
    expect(details.coolingBonus).toBe(0.0);
  });

  it("maps Moderate wind speed to Zone 2", () => {
    // Wind average 3.5 m/s -> basic 35.0 m/s -> Zone 2 (Moderate)
    const details = calculateWindZoneDetails(3.5);
    expect(details.windZone).toBe("Zone 2");
    expect(details.windZoneLabel).toBe("Moderate");
    expect(details.surchargePerKwp).toBe(7500);
    expect(details.coolingBonus).toBe(0.01); // +1%
  });

  it("maps High wind speed to Zone 3", () => {
    // Wind average 4.2 m/s -> basic 42.0 m/s -> Zone 3 (High)
    const details = calculateWindZoneDetails(4.2);
    expect(details.windZone).toBe("Zone 3");
    expect(details.windZoneLabel).toBe("High");
    expect(details.surchargePerKwp).toBe(10000);
    expect(details.coolingBonus).toBe(0.02); // +2%
  });

  it("maps Very High wind speed to Zone 4", () => {
    // Wind average 4.8 m/s -> basic 48.0 m/s -> Zone 4 (Very High)
    const details = calculateWindZoneDetails(4.8);
    expect(details.windZone).toBe("Zone 4");
    expect(details.windZoneLabel).toBe("Very High");
    expect(details.surchargePerKwp).toBe(12500);
    expect(details.coolingBonus).toBe(0.02); // +2%
  });

  it("maps Extreme wind speed to Zone 5/6", () => {
    // Wind average 5.5 m/s -> basic 55.0 m/s -> Zone 5/6 (Extreme)
    const details = calculateWindZoneDetails(5.5);
    expect(details.windZone).toBe("Zone 5/6");
    expect(details.windZoneLabel).toBe("Extreme");
    expect(details.surchargePerKwp).toBe(15000);
    expect(details.coolingBonus).toBe(0.02); // +2%
  });
});

describe("3. Temperature Coefficient Monthly Loss Module", () => {
  it("applies no loss when cell temperature is below 25C STC", () => {
    // Air temp = -5°C -> Cell temp = 23°C <= 25°C -> No loss -> factor = 1.0
    const factor = calculateTemperatureCoefficientLoss(-5);
    expect(factor).toBeCloseTo(1.0, 4);
  });

  it("calculates correct loss for air temp = 20C", () => {
    // Air temp = 20°C -> Cell temp = 48°C
    // Temp difference = 48 - 25 = 23°C
    // Loss = 23 * -0.0035 = -0.0805
    // Multiplier = 1 - 0.0805 = 0.9195
    const factor = calculateTemperatureCoefficientLoss(20);
    expect(factor).toBeCloseTo(0.9195, 4);
  });

  it("calculates correct loss for air temp = 30C", () => {
    // Air temp = 30°C -> Cell temp = 58°C
    // Temp difference = 58 - 25 = 33°C
    // Loss = 33 * -0.0035 = -0.1155
    // Multiplier = 1 - 0.1155 = 0.8845
    const factor = calculateTemperatureCoefficientLoss(30);
    expect(factor).toBeCloseTo(0.8845, 4);
  });
});

describe("4. Shading Factor Degradation Module", () => {
  it("calculates 0% loss for none shading level", () => {
    const analysis = runFullCalculation(100, 5.0, { shading: "none" });
    const baseline = runFullCalculation(100, 5.0, { shading: undefined });
    expect(analysis.energy.annualKwh).toBeCloseTo(baseline.energy.annualKwh, 1);
    expect(analysis.horizonShadingLoss).toBe(0.0);
    expect(analysis.skyViewFactor).toBeCloseTo(0.95, 4);
  });

  it("calculates exactly 15% loss for partial shading level", () => {
    const baseline = runFullCalculation(100, 5.0, { shading: "none" });
    const partial = runFullCalculation(100, 5.0, { shading: "partial" });
    const lossPct = (baseline.energy.annualKwh - partial.energy.annualKwh) / baseline.energy.annualKwh;
    expect(lossPct).toBeCloseTo(0.15, 3);
    expect(partial.horizonShadingLoss).toBe(0.15);
    expect(partial.skyViewFactor).toBeCloseTo(0.95 * 0.85, 4);
  });

  it("calculates exactly 30% loss for heavy shading level", () => {
    const baseline = runFullCalculation(100, 5.0, { shading: "none" });
    const heavy = runFullCalculation(100, 5.0, { shading: "heavy" });
    const lossPct = (baseline.energy.annualKwh - heavy.energy.annualKwh) / baseline.energy.annualKwh;
    expect(lossPct).toBeCloseTo(0.30, 3);
    expect(heavy.horizonShadingLoss).toBe(0.30);
    expect(heavy.skyViewFactor).toBeCloseTo(0.95 * 0.70, 4);
  });
});
