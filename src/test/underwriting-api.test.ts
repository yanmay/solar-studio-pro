import { describe, it, expect } from "vitest";
import solarEstimateHandler from "../../api/v1/solar-estimate";
import subsidyCheckHandler from "../../api/v1/subsidy-check";
import validateRoofHandler from "../../api/v1/validate-roof";

describe("Solar Loan Underwriting Public API Endpoints", () => {
  it("should deny access if X-API-Key is missing or invalid", async () => {
    const mockReq = new Request("http://localhost/api/v1/solar-estimate", {
      method: "GET",
    });
    const res = await solarEstimateHandler(mockReq);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain("Unauthorized");
  });

  it("should calculate exact underwriting parameters for valid keys", async () => {
    const mockReq = new Request("http://localhost/api/v1/solar-estimate?lat=19.076&lng=72.877&roofAreaM2=100&electricityRate=8", {
      method: "GET",
      headers: { "X-API-Key": "sk_test_demo_underwriting_key" }
    });
    const res = await solarEstimateHandler(mockReq);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.systemSizeKw).toBe(12.5); // 100 * 0.125
    expect(body.annualProductionKwh).toBe(18125); // 12.5 * 1450
    expect(body.paybackYears).toBeDefined();
    expect(body.lifetimeSavingsInr).toBeDefined();
  });

  it("should compute government subsidies according to capacity tiers", async () => {
    // 3kWp -> Max ₹78,000
    const req1 = new Request("http://localhost/api/v1/subsidy-check?systemSizeKw=3.5", {
      method: "GET",
      headers: { "X-API-Key": "sk_test_demo_key" }
    });
    const res1 = await subsidyCheckHandler(req1);
    const body1 = await res1.json();
    expect(body1.eligibleSubsidy).toBe(78000);

    // 2kWp -> ₹60,000
    const req2 = new Request("http://localhost/api/v1/subsidy-check?systemSizeKw=2.0", {
      method: "GET",
      headers: { "X-API-Key": "sk_test_demo_key" }
    });
    const res2 = await subsidyCheckHandler(req2);
    const body2 = await res2.json();
    expect(body2.eligibleSubsidy).toBe(60000);
  });
});
