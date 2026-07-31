import { describe, it, expect } from "vitest";
import { classifyWindZone, calcWindCostAdder } from "../lib/wind-zone";

describe("wind-zone utilities", () => {
  describe("classifyWindZone", () => {
    it("should classify wind speeds < 17 m/s as Zone 1 (Low)", () => {
      expect(classifyWindZone(10)).toEqual({ zone: 1, label: "Low Wind Zone" });
      expect(classifyWindZone(16.9)).toEqual({ zone: 1, label: "Low Wind Zone" });
    });

    it("should classify wind speeds 17-20 m/s as Zone 2 (Moderate)", () => {
      expect(classifyWindZone(17)).toEqual({ zone: 2, label: "Moderate Wind Zone" });
      expect(classifyWindZone(19)).toEqual({ zone: 2, label: "Moderate Wind Zone" });
      expect(classifyWindZone(20)).toEqual({ zone: 2, label: "Moderate Wind Zone" });
    });

    it("should classify wind speeds 20-25 m/s as Zone 3 (High)", () => {
      expect(classifyWindZone(20.1)).toEqual({ zone: 3, label: "High Wind Zone" });
      expect(classifyWindZone(23)).toEqual({ zone: 3, label: "High Wind Zone" });
      expect(classifyWindZone(25)).toEqual({ zone: 3, label: "High Wind Zone" });
    });

    it("should classify wind speeds > 25 m/s as Zone 4 (Very High)", () => {
      expect(classifyWindZone(25.1)).toEqual({ zone: 4, label: "Very High Wind Zone" });
      expect(classifyWindZone(30)).toEqual({ zone: 4, label: "Very High Wind Zone" });
    });
  });

  describe("calcWindCostAdder", () => {
    it("should return correct cost adder for each zone", () => {
      expect(calcWindCostAdder(1)).toBe(0);
      expect(calcWindCostAdder(2)).toBe(3000);
      expect(calcWindCostAdder(3)).toBe(8000);
      expect(calcWindCostAdder(4)).toBe(15000);
      expect(calcWindCostAdder(99)).toBe(0); // Default fallback
    });
  });
});
