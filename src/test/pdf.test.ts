import { describe, it, expect } from "vitest";
import { calculateSubsidy, buildWhatsAppUrl } from "../lib/pdf-generator";

describe("PDF Report Generator & WhatsApp Share Utilities", () => {
  describe("PM-Surya Ghar Subsidy Calculation", () => {
    it("should calculate correct subsidy for systems <= 2 kWp", () => {
      expect(calculateSubsidy(1.5)).toBe(45000);
      expect(calculateSubsidy(2.0)).toBe(60000);
    });

    it("should calculate correct subsidy for systems between 2 and 3 kWp", () => {
      expect(calculateSubsidy(2.5)).toBe(69000);
      expect(calculateSubsidy(3.0)).toBe(78000);
    });

    it("should cap subsidy at ₹78,000 for systems > 3 kWp", () => {
      expect(calculateSubsidy(3.5)).toBe(78000);
      expect(calculateSubsidy(5.0)).toBe(78000);
    });

    it("should return 0 for <= 0 kWp systems", () => {
      expect(calculateSubsidy(0)).toBe(0);
      expect(calculateSubsidy(-1.5)).toBe(0);
    });
  });

  describe("WhatsApp Share URL Builder", () => {
    it("should strip non-digits and format phone numbers with 91 prefix if 10-digits", () => {
      const url = buildWhatsAppUrl("98765 43210", "Hello");
      expect(url).toContain("https://wa.me/919876543210");
    });

    it("should preserve country code if already prefixed", () => {
      const url = buildWhatsAppUrl("+91 88888 88888", "Hello");
      expect(url).toContain("https://wa.me/918888888888");
    });

    it("should properly URI encode prefilled messages", () => {
      const text = "Solar System Quote:\n- Capacity: 3.5kWp\n- Price: ₹1.2L";
      const url = buildWhatsAppUrl("", text);
      expect(url).toContain("https://wa.me/");
      expect(url).toContain("text=Solar%20System%20Quote%3A%0A-%20Capacity%3A%203.5kWp%0A-%20Price%3A%20%E2%82%B91.2L");
    });
  });
});
