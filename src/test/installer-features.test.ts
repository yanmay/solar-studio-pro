import { describe, it, expect, beforeEach } from "vitest";
import { gstinSchema } from "../lib/validation";
const { handleRequest } = require("../../api-server.cjs");

const mockReqRes = (options: { method: string; url: string; body?: any; headers?: any }) => {
  const req = {
    method: options.method,
    url: options.url,
    headers: options.headers || {},
    on: (event: string, callback: any) => {
      if (event === "data" && options.body) {
        callback(Buffer.from(JSON.stringify(options.body)));
      }
      if (event === "end") {
        callback();
      }
    },
  };
  let status = 200;
  let headersSent = {};
  let bodySent = "";
  const res = {
    writeHead: (s: number, h: any) => {
      status = s;
      headersSent = h;
    },
    end: (body: string) => {
      bodySent = body;
    },
  };
  return { req, res, getResult: () => ({ status, headers: headersSent, body: bodySent ? JSON.parse(bodySent) : null }) };
};

describe("Installer Core Features - TDD Test Suite", () => {
  let mockDb: any;

  beforeEach(() => {
    const apiServer = require("../../api-server.cjs");
    apiServer.inMemoryTables = {
      profiles: [
        { id: "existing-installer-user", role: "installer" }
      ],
      installer_profiles: [
        {
          id: "inst-existing",
          user_id: "existing-installer-user",
          company_name: "Pune Solar Pros",
          gstin: "27AAPCG0818N1ZS",
          city: "Pune",
          state: "Maharashtra",
          subscription_tier: "trial",
          subscription_status: "active",
          trial_scans_remaining: 10,
          white_label: false
        }
      ],
      analysis_sessions: [],
      solar_reports: [],
      payments: []
    };
    mockDb = apiServer.inMemoryTables;
  });

  describe("1. GSTIN Validation Schema", () => {
    it("should accept valid GSTIN formats", () => {
      expect(gstinSchema.safeParse("27AAPCG0818N1ZS").success).toBe(true);
      expect(gstinSchema.safeParse("07AAAAA1111A1Z1").success).toBe(true);
    });

    it("should reject invalid GSTIN formats", () => {
      expect(gstinSchema.safeParse("invalid-gstin").success).toBe(false);
      expect(gstinSchema.safeParse("12345").success).toBe(false);
    });
  });

  describe("2. Self-Serve Installer Signup", () => {
    it("should register a new installer and create corresponding profile entries", async () => {
      const { req, res, getResult } = mockReqRes({
        method: "POST",
        url: "/api/installer/signup",
        body: {
          email: "new_installer@test.com",
          companyName: "Deccan Solar Power",
          gstin: "27AAPCG0818N1ZS",
          city: "Pune",
          state: "Maharashtra"
        }
      });

      await handleRequest(req, res);
      const result = getResult();

      expect(result.status).toBe(200);
      expect(result.body.success).toBe(true);
      expect(result.body.profileId).toBeDefined();

      // Ensure profile and installer_profile are created correctly in the in-memory database
      const profile = mockDb.profiles.find((p: any) => p.id === result.body.profileId);
      expect(profile).toBeDefined();
      expect(profile.role).toBe("installer");

      const installerProfile = mockDb.installer_profiles.find((ip: any) => ip.user_id === result.body.profileId);
      expect(installerProfile).toBeDefined();
      expect(installerProfile.company_name).toBe("Deccan Solar Power");
      expect(installerProfile.gstin).toBe("27AAPCG0818N1ZS");
      expect(installerProfile.subscription_tier).toBe("trial");
      expect(installerProfile.trial_scans_remaining).toBe(10);
    });

    it("should fail signup if GSTIN format is invalid", async () => {
      const { req, res, getResult } = mockReqRes({
        method: "POST",
        url: "/api/installer/signup",
        body: {
          email: "new_installer@test.com",
          companyName: "Deccan Solar Power",
          gstin: "invalid-gstin",
          city: "Pune",
          state: "Maharashtra"
        }
      });

      await handleRequest(req, res);
      const result = getResult();

      expect(result.status).toBe(400);
      expect(result.body.error).toContain("GSTIN");
    });
  });

  describe("3. Server-side Plan Limits Enforcement", () => {
    // Helper scan base64 parameters
    const scanInputObj = {
      scanInput: { lat: 18.5204, lng: 73.8567, roofAreaM2: 100 },
      panelConfig: { panelCount: 20, panelWattage: 450 },
      tariff: { tariffPerKwh: 8.0 }
    };
    const scanParamStr = Buffer.from(JSON.stringify(scanInputObj)).toString("base64");

    it("should allow scans and decrement trial limit for installers with scans remaining", async () => {
      // Set scans remaining to 3
      mockDb.installer_profiles[0].trial_scans_remaining = 3;

      const { req, res, getResult } = mockReqRes({
        method: "GET",
        url: `/api/report?siteId=site_test_1&scan=${encodeURIComponent(scanParamStr)}&installerUserId=existing-installer-user`
      });

      await handleRequest(req, res);
      const result = getResult();

      expect(result.status).toBe(200);
      expect(mockDb.installer_profiles[0].trial_scans_remaining).toBe(2);
    });

    it("should block scans (403) for installers with 0 trial scans remaining", async () => {
      mockDb.installer_profiles[0].trial_scans_remaining = 0;

      const { req, res, getResult } = mockReqRes({
        method: "GET",
        url: `/api/report?siteId=site_test_2&scan=${encodeURIComponent(scanParamStr)}&installerUserId=existing-installer-user`
      });

      await handleRequest(req, res);
      const result = getResult();

      expect(result.status).toBe(403);
      expect(result.body.error).toContain("limit reached");
    });

    it("should not decrement scans when retrieving an already generated report", async () => {
      mockDb.installer_profiles[0].trial_scans_remaining = 3;

      // Seed scan session & report
      mockDb.analysis_sessions.push({
        id: "sess-test-3",
        site_id: "site_test_3",
        latitude: 18.5204,
        longitude: 73.8567,
        is_full_unlocked: true,
        status: "ready"
      });
      mockDb.solar_reports.push({
        id: "rep-test-3",
        session_id: "sess-test-3",
        total_roof_area_sqm: 100,
        system_size_kwp: 9.0
      });

      const { req, res, getResult } = mockReqRes({
        method: "GET",
        url: `/api/report?siteId=site_test_3&installerUserId=existing-installer-user`
      });

      await handleRequest(req, res);
      const result = getResult();

      expect(result.status).toBe(200);
      // Limit should NOT be decremented since report already existed
      expect(mockDb.installer_profiles[0].trial_scans_remaining).toBe(3);
    });
  });

  describe("4. Monthly Razorpay Subscription State", () => {
    it("should charge ₹3,999 (399900 paise) for pro_monthly plan", async () => {
      const { req, res, getResult } = mockReqRes({
        method: "POST",
        url: "/api/payment/create-order",
        body: {
          plan: "pro_monthly",
          installerUserId: "existing-installer-user"
        }
      });

      await handleRequest(req, res);
      const result = getResult();

      expect(result.status).toBe(200);
      expect(result.body.amount).toBe(399900);
    });

    it("should update installer profile to pro tier and enable white-labeling upon subscription verification", async () => {
      const { req, res, getResult } = mockReqRes({
        method: "POST",
        url: "/api/payment/verify",
        body: {
          razorpay_order_id: "order_mock_subs123",
          razorpay_payment_id: "pay_mock_subs123",
          razorpay_signature: "mock_sig",
          plan: "pro_monthly",
          installerUserId: "existing-installer-user"
        }
      });

      await handleRequest(req, res);
      const result = getResult();

      expect(result.status).toBe(200);
      expect(result.body.verified).toBe(true);

      const profile = mockDb.installer_profiles[0];
      expect(profile.subscription_tier).toBe("pro");
      expect(profile.white_label).toBe(true);
    });
  });

  describe("5. White-Label Configuration & Overrides", () => {
    const scanInputObj = {
      scanInput: { lat: 18.5204, lng: 73.8567, roofAreaM2: 100 },
      panelConfig: { panelCount: 20, panelWattage: 450 },
      tariff: { tariffPerKwh: 8.0 }
    };
    const scanParamStr = Buffer.from(JSON.stringify(scanInputObj)).toString("base64");

    it("should return branding metadata for pro/white-label installer accounts", async () => {
      mockDb.installer_profiles[0].subscription_tier = "pro";
      mockDb.installer_profiles[0].white_label = true;
      mockDb.installer_profiles[0].custom_domain = "punesolarpros.com";
      mockDb.installer_profiles[0].custom_logo_url = "https://punesolarpros.com/logo.png";

      const { req, res, getResult } = mockReqRes({
        method: "GET",
        url: `/api/report?siteId=site_test_wl1&scan=${encodeURIComponent(scanParamStr)}&installerUserId=existing-installer-user`
      });

      await handleRequest(req, res);
      const result = getResult();

      expect(result.status).toBe(200);
      expect(result.body.branding).toBeDefined();
      expect(result.body.branding.isWhiteLabeled).toBe(true);
      expect(result.body.branding.companyName).toBe("Pune Solar Pros");
      expect(result.body.branding.domain).toBe("punesolarpros.com");
    });

    it("should allow updating custom logo and domain via branding update endpoint", async () => {
      mockDb.installer_profiles[0].subscription_tier = "pro";
      mockDb.installer_profiles[0].white_label = true;

      const { req, res, getResult } = mockReqRes({
        method: "POST",
        url: "/api/installer/branding/update",
        body: {
          installerUserId: "existing-installer-user",
          customLogoUrl: "https://newlogo.com/logo.png",
          customDomain: "newdomain.com"
        }
      });

      await handleRequest(req, res);
      const result = getResult();

      expect(result.status).toBe(200);
      expect(result.body.success).toBe(true);

      const profile = mockDb.installer_profiles[0];
      expect(profile.custom_logo_url).toBe("https://newlogo.com/logo.png");
      expect(profile.custom_domain).toBe("newdomain.com");
    });
  });
});
