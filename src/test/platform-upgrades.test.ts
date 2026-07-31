import { describe, it, expect } from "vitest";
import { calcStateBoosterInr, STATE_SUBSIDIES } from "../lib/state-subsidies";

const api = require("../../api-server.cjs");
const { rankInstallersByWeight, validateGstinFormat, WHITE_LABEL_CNAME_TARGET } = api;

// Shared request/response harness (mirrors leads-workflow.test.ts).
const mockReqRes = (options: { method: string; url: string; body?: any; headers?: any }) => {
  const req = {
    method: options.method,
    url: options.url,
    headers: options.headers || {},
    socket: { remoteAddress: "127.0.0.1" },
    on: (event: string, callback: any) => {
      if (event === "data" && options.body) callback(Buffer.from(JSON.stringify(options.body)));
      if (event === "end") callback();
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

describe("F10 — State subsidy boosters", () => {
  it("applies Gujarat booster: ₹10,000/kW capped at 3 kW", () => {
    const r = calcStateBoosterInr("Gujarat", 5);
    expect(r.boosterInr).toBe(30000); // min(5,3) * 10000
    expect(r.scheme).toBe("Surya Gujarat");
  });

  it("scales below the cap for small systems", () => {
    expect(calcStateBoosterInr("Maharashtra", 2).boosterInr).toBe(10000); // 2 * 5000
  });

  it("returns zero for states with no active scheme", () => {
    expect(calcStateBoosterInr("Karnataka", 5).boosterInr).toBe(0);
  });

  it("returns zero for unknown states and non-positive sizes", () => {
    expect(calcStateBoosterInr("Atlantis", 5).boosterInr).toBe(0);
    expect(calcStateBoosterInr("Gujarat", 0).boosterInr).toBe(0);
  });

  it("every configured scheme has a verified date", () => {
    Object.values(STATE_SUBSIDIES).forEach((s) => {
      expect(s.verified).toMatch(/^\d{4}-\d{2}$/);
    });
  });
});

describe("F11 — Weighted lead routing", () => {
  it("returns every installer exactly once (a permutation)", () => {
    const installers = [
      { id: "a", rating: 5 },
      { id: "b", rating: 1 },
      { id: "c", rating: 3 },
    ];
    const ranked = rankInstallersByWeight(installers);
    expect(ranked.map((i: any) => i.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("handles empty and single-element inputs", () => {
    expect(rankInstallersByWeight([])).toEqual([]);
    expect(rankInstallersByWeight([{ id: "solo" }]).length).toBe(1);
  });

  it("favours higher-rated installers on average over many draws", () => {
    const installers = [
      { id: "high", rating: 5, response_rate: 1, recency_score: 1 },
      { id: "low", rating: 0.1, response_rate: 0, recency_score: 0 },
    ];
    let highFirst = 0;
    for (let i = 0; i < 400; i++) {
      if (rankInstallersByWeight(installers)[0].id === "high") highFirst++;
    }
    expect(highFirst).toBeGreaterThan(280); // strongly biased, not deterministic
  });
});

describe("F2 — GSTIN format validation", () => {
  it("accepts a well-formed GSTIN", () => {
    expect(validateGstinFormat("27AABCU9603R1ZX").valid).toBe(true);
  });

  it("rejects wrong length, bad pattern, and bad state code", () => {
    expect(validateGstinFormat("hello").valid).toBe(false);
    expect(validateGstinFormat("27AABCU9603R1AX").valid).toBe(false); // no 'Z' at pos 14
    expect(validateGstinFormat("99AABCU9603R1ZX").valid).toBe(false); // invalid state code
  });
});

describe("F2/F3 — verify endpoints", () => {
  it("POST /api/installer/verify-gstin returns valid:true for a good GSTIN", async () => {
    const { req, res, getResult } = mockReqRes({
      method: "POST",
      url: "/api/installer/verify-gstin",
      body: { gstin: "27AABCU9603R1ZX" },
    });
    await api.handleRequest(req, res);
    expect(getResult().body.valid).toBe(true);
  });

  it("POST /api/installer/verify-domain returns verified:false for an unconfigured domain", async () => {
    const { req, res, getResult } = mockReqRes({
      method: "POST",
      url: "/api/installer/verify-domain",
      body: { domain: "no-such-host.invalid-tld-xyz.test" },
    });
    await api.handleRequest(req, res);
    const body = getResult().body;
    expect(body.verified).toBe(false);
    expect(WHITE_LABEL_CNAME_TARGET).toBe("cname.solarscan.in");
  });
});

describe("F5 — Provider-agnostic subscription", () => {
  it("activates Pro then cancels back to trial", async () => {
    // Seed an installer profile in the mock store.
    api.inMemoryTables = {
      installer_profiles: [
        { id: "ip-1", user_id: "u-1", company_name: "Test Solar", city: "Pune", subscription_tier: "trial" },
      ],
    };

    const create = mockReqRes({
      method: "POST",
      url: "/api/subscription/create",
      body: { installerUserId: "u-1", plan: "pro_monthly" },
    });
    await api.handleRequest(create.req, create.res);
    const created = create.getResult().body;
    expect(created.status).toBe("active");
    expect(created.subscriptionId).toMatch(/^sub_mock_/);
    expect(api.inMemoryTables.installer_profiles[0].subscription_tier).toBe("pro");

    const cancel = mockReqRes({
      method: "POST",
      url: "/api/subscription/cancel",
      body: { installerUserId: "u-1" },
    });
    await api.handleRequest(cancel.req, cancel.res);
    expect(cancel.getResult().body.subscription_tier).toBe("trial");
    expect(api.inMemoryTables.installer_profiles[0].subscription_tier).toBe("trial");
  });

  it("annual plan is priced 15% below 12x monthly", async () => {
    api.inMemoryTables = {
      installer_profiles: [{ id: "ip-2", user_id: "u-2", subscription_tier: "trial" }],
    };
    const { req, res, getResult } = mockReqRes({
      method: "POST",
      url: "/api/subscription/create",
      body: { installerUserId: "u-2", plan: "pro_annual" },
    });
    await api.handleRequest(req, res);
    expect(getResult().body.amountPaise).toBe(Math.round(350000 * 12 * 0.85));
  });
});
