import { describe, it, expect, beforeEach } from "vitest";
import { verifyGSTIN } from "../hooks/use-installer-auth";

describe("Installer Onboarding Auth checks", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("should validate correct GSTIN formatting patterns", async () => {
    // Correct format: 2 digits, 5 letters, 4 digits, 1 letter, 1 digit/letter, Z, 1 digit/letter
    const res = await verifyGSTIN("27AAAAA0000A1Z5");
    expect(res.success).toBe(true);
    expect(res.companyName).toBe("Verified Solar Corporation India");
  });

  it("should reject invalid GSTIN string lengths and patterns", async () => {
    // Wrong length
    const res1 = await verifyGSTIN("27AAAAA0000A1Z");
    expect(res1.success).toBe(false);
    expect(res1.message).toContain("exactly 15 alphanumeric characters");

    // Invalid format character (not matching standard regex)
    const res2 = await verifyGSTIN("27AAAAA0000A1Y5"); // missing Z
    expect(res2.success).toBe(false);
  });
});
