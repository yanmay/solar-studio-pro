/**
 * BUG-004: formatLakhsCr has a Lakh formatting bug.
 * Line ~428 divides by 1_00_00_000 (1 Crore) instead of 1_00_000 (1 Lakh)
 * for the Lakh branch, so amounts like ₹1,13,469 render as "₹0.00 L".
 *
 * We test via the shared formatINR utility we're extracting (src/lib/format-currency.ts).
 */
import { describe, it, expect } from "vitest";
import { formatINR, formatLakhs } from "../lib/format-currency";

describe("BUG-004: Currency formatting (Indian number system)", () => {
  it("formats amounts < ₹1,000 correctly", () => {
    expect(formatINR(500)).toBe("₹500");
    expect(formatINR(999)).toBe("₹999");
  });

  it("formats thousands correctly (not as Lakhs)", () => {
    // ₹1,000–₹99,999 must NOT show as Lakhs
    expect(formatINR(1000)).toBe("₹1,000");
    expect(formatINR(5000)).toBe("₹5,000");
    expect(formatINR(13469)).toBe("₹13,469");
    expect(formatINR(99999)).toBe("₹99,999");
  });

  it("formats Lakhs correctly (≥₹1,00,000)", () => {
    expect(formatINR(100000)).toBe("₹1.00 L");
    expect(formatINR(113000)).toBe("₹1.13 L");
    expect(formatINR(500000)).toBe("₹5.00 L");
    expect(formatINR(7800000)).toBe("₹78.00 L");
  });

  it("formats Crores correctly (≥₹1,00,00,000)", () => {
    expect(formatINR(10000000)).toBe("₹1.00 Cr");
    expect(formatINR(25000000)).toBe("₹2.50 Cr");
  });

  it("handles negatives", () => {
    expect(formatINR(-113000)).toBe("-₹1.13 L");
    expect(formatINR(-5000)).toBe("-₹5,000");
  });

  it("formatLakhs returns numeric lakh value", () => {
    expect(formatLakhs(100000)).toBeCloseTo(1.0, 2);
    expect(formatLakhs(1130000)).toBeCloseTo(11.3, 1);
  });
});
