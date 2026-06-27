import { describe, it, expect, beforeEach } from "vitest";
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

describe("Leads Pipeline & Installer Marketplace Tests", () => {
  let mockDb: any;

  beforeEach(() => {
    // Access the in-memory database directly to seed/reset it
    const apiServer = require("../../api-server.cjs");
    // We will clean/re-seed the in-memory tables in each test run
    // Let's clear the mock tables
    apiServer.inMemoryTables = {
      nasa_power_cache: [],
      analysis_sessions: [
        {
          id: "session-pune",
          site_id: "site_pune_123",
          address: "123 Ganeshkhind Road, Pune",
          latitude: 18.5204,
          longitude: 73.8567,
          city: "Pune",
          status: "ready",
          is_preview_unlocked: true,
          is_full_unlocked: true,
        },
        {
          id: "session-mumbai",
          site_id: "site_mumbai_456",
          address: "456 Marine Drive, Mumbai",
          latitude: 18.9524,
          longitude: 72.8258,
          city: "Mumbai",
          status: "ready",
          is_preview_unlocked: true,
          is_full_unlocked: true,
        }
      ],
      solar_reports: [
        {
          id: "report-pune",
          session_id: "session-pune",
          total_roof_area_sqm: 120.0,
          usable_roof_area_sqm: 90.0,
          panel_count: 20,
          system_size_kwp: 9.0,
          annual_production_kwh: 14000,
          capex_estimate: 450000,
          pm_surya_subsidy: 78000,
          payback_years: 4.5,
        },
        {
          id: "report-mumbai",
          session_id: "session-mumbai",
          total_roof_area_sqm: 80.0,
          usable_roof_area_sqm: 60.0,
          panel_count: 13,
          system_size_kwp: 5.8,
          annual_production_kwh: 9000,
          capex_estimate: 290000,
          pm_surya_subsidy: 78000,
          payback_years: 5.2,
        }
      ],
      profiles: [
        { id: "installer-user-a", role: "installer" },
        { id: "installer-user-b", role: "installer" },
        { id: "installer-user-c", role: "installer" },
        { id: "installer-user-d", role: "installer" },
      ],
      installer_profiles: [
        {
          id: "inst-a",
          user_id: "installer-user-a",
          company_name: "Pune Solar Pros",
          city: "Pune",
          state: "Maharashtra",
        },
        {
          id: "inst-b",
          user_id: "installer-user-b",
          company_name: "Mumbai Sun Power",
          city: "Mumbai",
          state: "Maharashtra",
        },
        {
          id: "inst-c",
          user_id: "installer-user-c",
          company_name: "Deccan Solar",
          city: "Pune",
          state: "Maharashtra",
        },
        {
          id: "inst-d",
          user_id: "installer-user-d",
          company_name: "Western India Renewables",
          city: "Pune",
          state: "Maharashtra",
        }
      ],
      lead_requests: [],
      lead_assignments: [],
      payments: [],
    };
    mockDb = apiServer.inMemoryTables;
  });

  it("1. Homeowner should be able to create a lead linked to scan/session data", async () => {
    const { req, res, getResult } = mockReqRes({
      method: "POST",
      url: "/api/leads",
      body: {
        name: "Ganesh Pujari",
        phone: "9876543210",
        city: "Pune",
        siteId: "site_pune_123",
      },
    });

    await handleRequest(req, res);
    const result = getResult();

    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);
    expect(result.body.leadRequestId).toBeDefined();

    // Check mock DB state
    expect(mockDb.lead_requests.length).toBe(1);
    const lead = mockDb.lead_requests[0];
    expect(lead.session_id).toBe("session-pune");
    expect(lead.homeowner_name).toBe("Ganesh Pujari");
    expect(lead.homeowner_phone).toBe("9876543210");
  });

  it("2. Cities matching: lead should be visible to installers in Pune but not Mumbai", async () => {
    // Create a lead in Pune
    mockDb.lead_requests.push({
      id: "lead-pune",
      session_id: "session-pune",
      homeowner_name: "Ganesh Pujari",
      homeowner_phone: "9876543210",
      status: "open",
      installers_assigned_count: 0,
    });

    // Pune Installer requests available leads
    const { req: reqA, res: resA, getResult: getResultA } = mockReqRes({
      method: "GET",
      url: "/api/installer/leads/available?installerUserId=installer-user-a",
    });
    await handleRequest(reqA, resA);
    const resultA = getResultA();

    expect(resultA.status).toBe(200);
    expect(resultA.body.leads.length).toBe(1);
    expect(resultA.body.leads[0].id).toBe("lead-pune");
    // Assert full scan details are present
    expect(resultA.body.leads[0].total_roof_area_sqm).toBe(120.0);
    expect(resultA.body.leads[0].system_size_kwp).toBe(9.0);
    expect(resultA.body.leads[0].capex_estimate).toBe(450000);

    // Mumbai Installer requests available leads
    const { req: reqB, res: resB, getResult: getResultB } = mockReqRes({
      method: "GET",
      url: "/api/installer/leads/available?installerUserId=installer-user-b",
    });
    await handleRequest(reqB, resB);
    const resultB = getResultB();

    expect(resultB.status).toBe(200);
    expect(resultB.body.leads.length).toBe(0); // none matched Mumbai
  });

  it("3. Enforces max-3-buyers cap and price field per purchase", async () => {
    // Create a lead in Pune
    mockDb.lead_requests.push({
      id: "lead-pune",
      session_id: "session-pune",
      homeowner_name: "Ganesh Pujari",
      homeowner_phone: "9876543210",
      status: "open",
      installers_assigned_count: 0,
    });

    // Pune Installers A, B, C buy
    const purchaseLeads = ["installer-user-a", "installer-user-c", "installer-user-d"];
    for (const userId of purchaseLeads) {
      const { req, res, getResult } = mockReqRes({
        method: "POST",
        url: "/api/installer/leads/purchase",
        body: {
          leadRequestId: "lead-pune",
          installerUserId: userId,
        },
      });
      await handleRequest(req, res);
      const resVal = getResult();
      expect(resVal.status).toBe(200);
      expect(resVal.body.success).toBe(true);
      expect(resVal.body.priceCharged).toBe(50000); // 500 INR in paise
    }

    // Lead request installers count should be 3 and status should be fulfilled
    const lead = mockDb.lead_requests[0];
    expect(lead.installers_assigned_count).toBe(3);
    expect(lead.status).toBe("fulfilled");

    // Installer D (another Pune installer) tries to purchase but it's capped
    // Wait, let's create installer D profile, we already seeded inst-d in Pune
    // But since the cap has reached 3, it should fail
    const { req: reqFail, res: resFail, getResult: getResultFail } = mockReqRes({
      method: "POST",
      url: "/api/installer/leads/purchase",
      body: {
        leadRequestId: "lead-pune",
        installerUserId: "installer-user-d", // inst-d already bought it in loop above, wait, Pune Installers are inst-a, inst-c, inst-d.
        // Let's use installer B ("inst-b" in Mumbai) or let's create a 5th installer profile in Pune to test cap.
      },
    });
    // Wait, installer-user-d already purchased. Let's seed a 5th installer
    mockDb.profiles.push({ id: "installer-user-e", role: "installer" });
    mockDb.installer_profiles.push({
      id: "inst-e",
      user_id: "installer-user-e",
      company_name: "Pune Solar Master",
      city: "Pune",
      state: "Maharashtra",
    });

    const { req: reqE, res: resE, getResult: getResultE } = mockReqRes({
      method: "POST",
      url: "/api/installer/leads/purchase",
      body: {
        leadRequestId: "lead-pune",
        installerUserId: "installer-user-e",
      },
    });
    await handleRequest(reqE, resE);
    const resValE = getResultE();

    expect(resValE.status).toBe(400); // Cap exceeded
    expect(resValE.body.error).toContain("exceeded");
  });

  it("4. Enforces RLS verification (installer A only sees leads purchased by installer A)", async () => {
    // Create lead Pune & Mumbai
    mockDb.lead_requests.push(
      {
        id: "lead-pune",
        session_id: "session-pune",
        homeowner_name: "Ganesh Pujari",
        homeowner_phone: "9876543210",
        status: "open",
        installers_assigned_count: 1,
      },
      {
        id: "lead-mumbai",
        session_id: "session-mumbai",
        homeowner_name: "Rajesh Patil",
        homeowner_phone: "8888888888",
        status: "open",
        installers_assigned_count: 1,
      }
    );

    // Installer A buys Pune, Installer B buys Mumbai
    mockDb.lead_assignments.push(
      {
        id: "assign-a",
        lead_request_id: "lead-pune",
        installer_id: "inst-a",
        price_charged_paise: 50000,
        status: "delivered",
      },
      {
        id: "assign-b",
        lead_request_id: "lead-mumbai",
        installer_id: "inst-b",
        price_charged_paise: 50000,
        status: "delivered",
      }
    );

    // Query Installer A's purchased leads
    const { req: reqA, res: resA, getResult: getResultA } = mockReqRes({
      method: "GET",
      url: "/api/installer/leads/purchased?installerUserId=installer-user-a",
    });
    await handleRequest(reqA, resA);
    const resultA = getResultA();

    expect(resultA.status).toBe(200);
    expect(resultA.body.leads.length).toBe(1);
    expect(resultA.body.leads[0].id).toBe("lead-pune");

    // Query Installer B's purchased leads
    const { req: reqB, res: resB, getResult: getResultB } = mockReqRes({
      method: "GET",
      url: "/api/installer/leads/purchased?installerUserId=installer-user-b",
    });
    await handleRequest(reqB, resB);
    const resultB = getResultB();

    expect(resultB.status).toBe(200);
    expect(resultB.body.leads.length).toBe(1);
    expect(resultB.body.leads[0].id).toBe("lead-mumbai");
  });

  it("5. Never show vendor favouritism (order installers neutrally in GET /api/installers)", async () => {
    // Query installers for Pune
    const { req, res, getResult } = mockReqRes({
      method: "GET",
      url: "/api/installers?city=Pune",
    });

    await handleRequest(req, res);
    const result = getResult();

    expect(result.status).toBe(200);
    expect(result.body.installers.length).toBe(3); // inst-a, inst-c, inst-d
    
    // Test that ordering is shuffled or rotated (not static by ID)
    // We will query it multiple times, and verify it shuffled/rotated,
    // or verify that there's no fixed order based on billing/pricing
    const firstNames = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const { req: r, res: rs, getResult: gr } = mockReqRes({
        method: "GET",
        url: "/api/installers?city=Pune",
      });
      await handleRequest(r, rs);
      const resObj = gr();
      if (resObj.body.installers.length > 0) {
        firstNames.add(resObj.body.installers[0].company_name);
      }
    }
    // With 3 options and 20 iterations, random shuffle should yield more than 1 distinct first element
    expect(firstNames.size).toBeGreaterThan(1);
  });

  it("6. Should allow updating assignment status and setting reminders", async () => {
    // Seed lead Pune and assign to A
    mockDb.lead_requests.push({
      id: "lead-pune",
      session_id: "session-pune",
      homeowner_name: "Ganesh Pujari",
      homeowner_phone: "9876543210",
      status: "open",
      installers_assigned_count: 1,
    });
    mockDb.lead_assignments.push({
      id: "assign-pune-a",
      lead_request_id: "lead-pune",
      installer_id: "inst-a",
      price_charged_paise: 50000,
      status: "delivered",
    });

    // Update status to contacted and set a reminder
    const { req, res, getResult } = mockReqRes({
      method: "PATCH",
      url: "/api/installer/leads/update-assignment",
      body: {
        assignmentId: "assign-pune-a",
        installerUserId: "installer-user-a",
        status: "contacted",
        reminderDate: "2026-06-20T10:00:00.000Z",
        reminderNote: "Follow up with Ganesh regarding layout customization",
      },
    });

    await handleRequest(req, res);
    const result = getResult();

    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);

    // Verify DB update
    const updated = mockDb.lead_assignments.find((a: any) => a.id === "assign-pune-a");
    expect(updated.status).toBe("contacted");
    expect(updated.reminder_date).toBe("2026-06-20T10:00:00.000Z");
    expect(updated.reminder_note).toBe("Follow up with Ganesh regarding layout customization");
  });

  it("7. Should block unauthorized status/reminder updates on assignments by other installers", async () => {
    // Pune Installer A has assign-pune-a
    mockDb.lead_requests.push({
      id: "lead-pune",
      session_id: "session-pune",
      homeowner_name: "Ganesh Pujari",
      homeowner_phone: "9876543210",
      status: "open",
      installers_assigned_count: 1,
    });
    mockDb.lead_assignments.push({
      id: "assign-pune-a",
      lead_request_id: "lead-pune",
      installer_id: "inst-a",
      price_charged_paise: 50000,
      status: "delivered",
    });

    // Mumbai Installer B tries to update Pune Installer A's assignment
    const { req, res, getResult } = mockReqRes({
      method: "PATCH",
      url: "/api/installer/leads/update-assignment",
      body: {
        assignmentId: "assign-pune-a",
        installerUserId: "installer-user-b", // inst-b
        status: "quoted",
      },
    });

    await handleRequest(req, res);
    const result = getResult();

    expect(result.status).toBe(403);
    expect(result.body.error).toContain("Unauthorized");
  });
});
