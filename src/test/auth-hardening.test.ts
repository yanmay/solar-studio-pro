import { describe, it, expect, beforeEach } from "vitest";
const apiServer = require("../../api-server.cjs");
const { handleRequest, issueSessionToken, verifySessionToken, hashApiKey } = apiServer;

const mockReqRes = (options: { method: string; url: string; body?: any; headers?: any }) => {
  const req = {
    method: options.method,
    url: options.url,
    headers: options.headers || {},
    socket: { remoteAddress: "127.0.0.1" },
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
  let bodySent = "";
  const res = {
    writeHead: (s: number) => { status = s; },
    end: (body: string) => { bodySent = body; },
  };
  return { req, res, getResult: () => ({ status, body: bodySent ? JSON.parse(bodySent) : null }) };
};

describe("Phase D — Auth Hardening", () => {
  beforeEach(() => {
    process.env.ALLOW_MOCK_PAYMENTS = "true";
    apiServer.inMemoryTables = {
      profiles: [{ id: "installer-user-1", role: "installer" }],
      installer_profiles: [
        {
          id: "inst-1",
          user_id: "installer-user-1",
          company_name: "Solar Co",
          gstin: "27AAPCG0818N1ZS",
          city: "Pune",
          state: "Maharashtra",
          subscription_tier: "pro",
          subscription_status: "active",
          trial_scans_remaining: 10,
          white_label: true,
        },
      ],
      analysis_sessions: [],
      solar_reports: [],
      lead_requests: [],
      lead_assignments: [],
      payments: [],
      api_keys: [],
    };
  });

  describe("Session tokens", () => {
    it("issues a token that round-trips through verification", () => {
      const token = issueSessionToken("installer-user-1");
      const payload = verifySessionToken(token);
      expect(payload).not.toBeNull();
      expect(payload.sub).toBe("installer-user-1");
    });

    it("rejects a tampered token", () => {
      const token = issueSessionToken("installer-user-1");
      const tampered = token.slice(0, -2) + "xx";
      expect(verifySessionToken(tampered)).toBeNull();
    });

    it("rejects a malformed token", () => {
      expect(verifySessionToken("not-a-token")).toBeNull();
      expect(verifySessionToken("")).toBeNull();
    });
  });

  describe("Installer signup returns a session token", () => {
    it("includes a valid token in the signup response", async () => {
      const { req, res, getResult } = mockReqRes({
        method: "POST",
        url: "/api/installer/signup",
        body: {
          email: "co@test.com",
          companyName: "Deccan Solar",
          gstin: "27AAPCG0818N1ZS",
          city: "Pune",
          state: "Maharashtra",
        },
      });
      await handleRequest(req, res);
      const result = getResult();
      expect(result.status).toBe(200);
      expect(result.body.token).toBeDefined();
      const payload = verifySessionToken(result.body.token);
      expect(payload.sub).toBe(result.body.profileId);
    });
  });

  describe("Installer routes accept a Bearer token (dev mode)", () => {
    it("authorizes branding update with a valid token", async () => {
      const token = issueSessionToken("installer-user-1");
      const { req, res, getResult } = mockReqRes({
        method: "POST",
        url: "/api/installer/branding/update",
        headers: { authorization: `Bearer ${token}` },
        body: {
          installerUserId: "installer-user-1",
          customLogoUrl: "https://logo.com/l.png",
        },
      });
      await handleRequest(req, res);
      expect(getResult().status).toBe(200);
    });
  });

  describe("V1 underwriting requires an API key", () => {
    it("rejects requests without an API key", async () => {
      const { req, res, getResult } = mockReqRes({
        method: "POST",
        url: "/api/v1/underwriting/score",
        body: { annualKwh: 12000, systemSizeKw: 9, panelCount: 20 },
      });
      await handleRequest(req, res);
      expect(getResult().status).toBe(401);
    });

    it("rejects an invalid API key", async () => {
      const { req, res, getResult } = mockReqRes({
        method: "POST",
        url: "/api/v1/underwriting/score",
        headers: { authorization: "Bearer sk_test_invalidkey" },
        body: { annualKwh: 12000, systemSizeKw: 9, panelCount: 20 },
      });
      await handleRequest(req, res);
      expect(getResult().status).toBe(401);
    });

    it("scores a project with a valid API key", async () => {
      const plainKey = "sk_test_validkey123";
      apiServer.inMemoryTables.api_keys.push({
        id: "key-1",
        key_hash: hashApiKey(plainKey),
        revoked: false,
      });
      const { req, res, getResult } = mockReqRes({
        method: "POST",
        url: "/api/v1/underwriting/score",
        headers: { authorization: `Bearer ${plainKey}` },
        body: { annualKwh: 12000, systemSizeKw: 9, panelCount: 20, panelWattage: 550, tariffRate: 8 },
      });
      await handleRequest(req, res);
      const result = getResult();
      expect(result.status).toBe(200);
      expect(result.body.grade).toBeDefined();
      expect(result.body.financials).toBeDefined();
      expect(result.body.financials.npv).toBeDefined();
    });

    it("rejects a revoked API key", async () => {
      const plainKey = "sk_test_revokedkey";
      apiServer.inMemoryTables.api_keys.push({
        id: "key-2",
        key_hash: hashApiKey(plainKey),
        revoked: true,
      });
      const { req, res, getResult } = mockReqRes({
        method: "POST",
        url: "/api/v1/underwriting/score",
        headers: { authorization: `Bearer ${plainKey}` },
        body: { annualKwh: 12000, systemSizeKw: 9, panelCount: 20 },
      });
      await handleRequest(req, res);
      expect(getResult().status).toBe(401);
    });
  });
});
