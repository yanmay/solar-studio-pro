import { describe, it, expect } from "vitest";
import { can, Action, UserRole } from "../context/AuthContext";
import {
  coordinateSchema,
  areaSchema,
  gstinSchema,
  tariffSchema,
  isSelfIntersecting,
  polygonSchema,
  verifyRazorpaySignature,
} from "../lib/validation";

describe("1. Permission Matrix Tests", () => {
  it("Guest permissions", () => {
    expect(can("guest", "view_preview")).toBe(true);
    expect(can("guest", "unlock_prospectus")).toBe(false);
    expect(can("guest", "submit_lead")).toBe(false);
    expect(can("guest", "view_all_scans")).toBe(false);
  });

  it("Homeowner permissions", () => {
    expect(can("homeowner", "view_preview")).toBe(true);
    // Homeowner can unlock/view their own prospectus
    expect(can("homeowner", "unlock_prospectus", { ownerId: "user-1", currentUserId: "user-1" })).toBe(true);
    // Homeowner CANNOT unlock other homeowner's prospectus
    expect(can("homeowner", "unlock_prospectus", { ownerId: "user-2", currentUserId: "user-1" })).toBe(false);
    // Homeowner can submit lead for their own scan
    expect(can("homeowner", "submit_lead", { ownerId: "user-1", currentUserId: "user-1" })).toBe(true);
    expect(can("homeowner", "submit_lead", { ownerId: "user-2", currentUserId: "user-1" })).toBe(false);
    // Homeowner cannot view all scans
    expect(can("homeowner", "view_all_scans")).toBe(false);
  });

  it("Installer permissions", () => {
    expect(can("installer", "view_preview")).toBe(true);
    expect(can("installer", "unlock_prospectus")).toBe(false); // cannot unlock random prospectus
    // Installer can view/unlock if lead is assigned to them
    expect(can("installer", "view_assigned_leads", { installerId: "installer-1", leadInstallerId: "installer-1" })).toBe(true);
    expect(can("installer", "view_assigned_leads", { installerId: "installer-1", leadInstallerId: "installer-2" })).toBe(false);
    expect(can("installer", "view_all_scans")).toBe(false);
  });

  it("Admin permissions", () => {
    expect(can("admin", "view_preview")).toBe(true);
    expect(can("admin", "unlock_prospectus")).toBe(true);
    expect(can("admin", "view_all_scans")).toBe(true);
    expect(can("admin", "view_all_leads")).toBe(true);
    expect(can("admin", "manage_users")).toBe(true);
  });
});

describe("2. Validation Schemas & Polygon Geometry Tests", () => {
  describe("Coordinates Validation", () => {
    it("validates correct coordinates within bounds", () => {
      const valid = coordinateSchema.safeParse({ lat: 19.076, lng: 72.877 });
      expect(valid.success).toBe(true);
    });

    it("rejects invalid coordinates out of bounds", () => {
      const invalidLat = coordinateSchema.safeParse({ lat: 95.0, lng: 72.877 });
      expect(invalidLat.success).toBe(false);
      const invalidLng = coordinateSchema.safeParse({ lat: 19.076, lng: 190.0 });
      expect(invalidLng.success).toBe(false);
    });
  });

  describe("Roof Area Validation", () => {
    it("accepts positive area values", () => {
      expect(areaSchema.safeParse(85.5).success).toBe(true);
      expect(areaSchema.safeParse(0.1).success).toBe(true);
    });

    it("rejects zero or negative area values", () => {
      expect(areaSchema.safeParse(0).success).toBe(false);
      expect(areaSchema.safeParse(-5).success).toBe(false);
    });
  });

  describe("GSTIN Validation", () => {
    it("accepts valid Indian GSTINs", () => {
      // 22AAAAA0000A1Z5 is a standard format
      expect(gstinSchema.safeParse("27AAPCG0818N1ZS").success).toBe(true);
      expect(gstinSchema.safeParse("07AAAAA1111A1Z1").success).toBe(true);
    });

    it("rejects invalid GSTINs", () => {
      expect(gstinSchema.safeParse("123456789012345").success).toBe(false);
      expect(gstinSchema.safeParse("ABCDE1234F").success).toBe(false);
      expect(gstinSchema.safeParse("").success).toBe(false);
    });
  });

  describe("Tariff Validation", () => {
    it("accepts positive tariff rates", () => {
      expect(tariffSchema.safeParse(7.5).success).toBe(true);
      expect(tariffSchema.safeParse(4).success).toBe(true);
    });

    it("rejects zero or negative tariff rates", () => {
      expect(tariffSchema.safeParse(0).success).toBe(false);
      expect(tariffSchema.safeParse(-2).success).toBe(false);
    });
  });

  describe("Polygon Geometry (Self-Intersection)", () => {
    it("detects non-intersecting polygons as valid", () => {
      // Square: non-intersecting
      const square: [number, number][] = [
        [0, 0],
        [4, 0],
        [4, 4],
        [0, 4],
        [0, 0]
      ];
      expect(isSelfIntersecting(square)).toBe(false);
    });

    it("detects self-intersecting polygons (hourglass shape)", () => {
      // Hourglass/Butterfly shape with intersecting lines
      const butterfly: [number, number][] = [
        [0, 0],
        [4, 4],
        [4, 0],
        [0, 4],
        [0, 0]
      ];
      expect(isSelfIntersecting(butterfly)).toBe(true);
    });

    it("Zod polygon schema validates standard inputs", () => {
      const validPoly = [
        [
          [0, 0],
          [4, 0],
          [4, 4],
          [0, 4],
          [0, 0]
        ]
      ];
      expect(polygonSchema.safeParse(validPoly).success).toBe(true);

      const invalidPoly = [
        [
          [0, 0],
          [4, 4],
          [4, 0],
          [0, 4],
          [0, 0]
        ]
      ];
      expect(polygonSchema.safeParse(invalidPoly).success).toBe(false);
    });
  });
});

describe("3. Payment Signature Verification Tests", () => {
  const secret = "test_razorpay_secret";
  const orderId = "order_12345";
  const paymentId = "pay_67890";
  // The expected signature is HMAC-SHA256 of `order_12345|pay_67890` using key `test_razorpay_secret`
  // We will generate the correct signature dynamically or use precalculated values
  const crypto = require("crypto");
  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(orderId + "|" + paymentId)
    .digest("hex");

  it("verifies valid signature", () => {
    const verified = verifyRazorpaySignature({
      orderId,
      paymentId,
      signature: expectedSig,
      secret,
    });
    expect(verified).toBe(true);
  });

  it("fails invalid signature", () => {
    const verified = verifyRazorpaySignature({
      orderId,
      paymentId,
      signature: "wrong_sig",
      secret,
    });
    expect(verified).toBe(false);
  });

  it("always approves mock payment id", () => {
    const verified = verifyRazorpaySignature({
      orderId: "order_mock_xyz",
      paymentId: "pay_mock_123",
      signature: "any",
      secret,
    });
    expect(verified).toBe(true);
  });
});
