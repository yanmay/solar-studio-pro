import { describe, it, expect } from "vitest";
import { calcTemperatureDerate } from "../lib/temperature-derate";

describe("temperature-derate utilities", () => {
  it("should calculate correct temperature derate multiplier", () => {
    // cellTemp = 25 + 28 = 53
    // delta = 53 - 25 = 28
    // loss = 28 * -0.35 = -9.8%
    // multiplier = 1 + (-0.098) = 0.902
    expect(calcTemperatureDerate(25)).toBeCloseTo(0.902, 4);

    // cellTemp = 37 + 28 = 65
    // delta = 65 - 25 = 40
    // loss = 40 * -0.35 = -14%
    // multiplier = 1 + (-0.14) = 0.86
    expect(calcTemperatureDerate(37)).toBeCloseTo(0.86, 4);
  });

  it("should not apply derating if cell temperature is 25C or lower", () => {
    // cellTemp = -3 + 28 = 25 (exactly 25C)
    expect(calcTemperatureDerate(-3)).toBe(1.0);

    // cellTemp = -10 + 28 = 18 (< 25C)
    // Should not increase efficiency above 100%
    expect(calcTemperatureDerate(-10)).toBe(1.0);
  });
});
