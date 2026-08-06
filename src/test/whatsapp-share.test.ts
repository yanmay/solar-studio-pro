import { describe, it, expect } from "vitest";
import { generateWhatsAppMessage, generateWhatsAppUrl } from "../lib/whatsapp-share";

describe("whatsapp-share utilities", () => {
  it("should generate the correct formatted message with solar details", () => {
    const message = generateWhatsAppMessage({
      address: "123 Solar Street, Mumbai",
      systemSizeKw: 8.5,
      lifetimeSavingsLakh: 97.4,
      paybackYears: 3.4,
      confidenceScore: 92,
      reportUrl: "https://tinyurl.com/abcd"
    });

    expect(message).toContain("🏠 *Solar Potential Report for 123 Solar Street, Mumbai*");
    expect(message).toContain("☀️ System Size: 8.5 kW");
    expect(message).toContain("💰 Lifetime Savings: ₹97.4 Lakh");
    expect(message).toContain("⏱️ Payback: 3.4 Years");
    expect(message).toContain("🎯 Confidence: 92%");
    expect(message).toContain("📄 Full report: https://tinyurl.com/abcd");
    expect(message).toContain("Want 3 verified installer quotes? Reply YES.");
  });

  it("should generate correct wa.me link with prefilled text and sanitization", () => {
    const rawMsg = "Hello World! Test & share.";
    const url = generateWhatsAppUrl("9876543210", rawMsg);
    
    // Expect country code 91 to be pre-pended for Indian local 10-digit number
    expect(url).toBe("https://wa.me/919876543210?text=Hello%20World!%20Test%20%26%20share.");
  });

  it("should generate correct wa.me link when country code is already present", () => {
    const url = generateWhatsAppUrl("+91 98765-43210", "Hello");
    expect(url).toBe("https://wa.me/919876543210?text=Hello");
  });
});
