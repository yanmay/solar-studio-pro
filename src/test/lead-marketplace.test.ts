import { describe, it, expect } from "vitest";
import { calculateLeadPrice } from "../../api/leads/distribute";

describe("Lead Marketplace Pricing and Distribution", () => {
  it("should calculate correct Lead Pricing based on homeowner city tiers", () => {
    // Tier 1 cities: Delhi, Mumbai, Bangalore / Bengaluru -> ₹2,000
    expect(calculateLeadPrice("Mumbai")).toBe(2000);
    expect(calculateLeadPrice("Delhi NCR ")).toBe(2000);
    expect(calculateLeadPrice("bengaluru")).toBe(2000);

    // Tier 2 cities: Pune, Jaipur, Lucknow -> ₹1,200
    expect(calculateLeadPrice("Pune")).toBe(1200);
    expect(calculateLeadPrice("jaipur")).toBe(1200);
    expect(calculateLeadPrice("LUCKNOW")).toBe(1200);

    // Tier 3+ cities -> ₹500
    expect(calculateLeadPrice("Nagpur")).toBe(500);
    expect(calculateLeadPrice(" Patna ")).toBe(500);
    expect(calculateLeadPrice("Udaipur")).toBe(500);
  });
});
