import { describe, it, expect, beforeEach } from "vitest";
import { calcSubsidyInr } from "../lib/solar-defaults";
import { runAutomatedFeasibility, setMockSupabaseClient, supabase as engineSupabase, IElevationSlopeProvider, IRoofGeometryProvider, IShadingProvider, IWeatherProvider } from "../lib/feasibility-engine";
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

const highConfidenceElevation: IElevationSlopeProvider = {
  getElevationAndSlope: async () => ({
    elevationM: 100.0,
    slopeDeg: 10.0,
    source: "Mock Google Elevation",
    confidence: "High",
  })
};

const highConfidenceGeometry: IRoofGeometryProvider = {
  getRoofGeometry: async () => ({
    areaM2: 200.0,
    polygon: [{ lat: 18.5204, lng: 73.8567 }],
    tiltDeg: 12.0,
    azimuth: "S",
    source: "Mock Google Solar API",
    confidence: "High",
  })
};

const highConfidenceShading: IShadingProvider = {
  getShading: async () => ({
    shadingLossPct: 4.0,
    source: "Mock Google Solar Shading",
    confidence: "High",
  })
};

const highConfidenceWeather: IWeatherProvider = {
  getWeather: async () => ({
    monthlyGhi: [5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0],
    monthlyWind10m: [2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0],
    monthlyWind50m: [3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0],
    monthlyTemp: [25.0, 25.0, 25.0, 25.0, 25.0, 25.0, 25.0, 25.0, 25.0, 25.0, 25.0, 25.0],
    elevationM: 100.0,
    source: "Mock NASA weather",
    confidence: "High",
  })
};

describe("Installer Sales & Workflow Layer Integration Tests", () => {
  let mockDb: any;

  beforeEach(() => {
    // Reset/re-seed mock in-memory tables
    const apiServer = require("../../api-server.cjs");
    apiServer.inMemoryTables = {
      nasa_power_cache: [],
      analysis_sessions: [
        {
          id: "sess-pune-uuid",
          site_id: "automated_sess-pune-uuid",
          address: "123 Ganeshkhind Road, Pune",
          latitude: 18.5204,
          longitude: 73.8567,
          city: "Pune",
          status: "ready",
          is_preview_unlocked: true,
          is_full_unlocked: true,
          created_at: new Date().toISOString(),
          structure_tilt: 15,
          boundary_setback: 0.5,
          maintenance_walkways: true,
          panel_wattage: 450,
          panel_alignment: "roof",
          panel_orientation: "auto",
          shading: "none"
        }
      ],
      solar_reports: [
        {
          id: "report-pune-uuid",
          session_id: "sess-pune-uuid",
          total_roof_area_sqm: 120.0,
          usable_roof_area_sqm: 90.0,
          panel_count: 20,
          system_size_kwp: 9.0,
          annual_production_kwh: 14000,
          capex_estimate: 450000,
          pm_surya_subsidy: 78000,
          payback_years: 4.5,
          confidence_level: "High",
          confidence_reason: "High confidence satellite scan."
        }
      ],
      profiles: [
        { id: "installer-user-a", role: "installer" },
        { id: "installer-user-b", role: "installer" }
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
        }
      ],
      lead_requests: [],
      lead_assignments: [],
      payments: []
    };
    mockDb = apiServer.inMemoryTables;
  });

  it("1. Proposal Subsidy cross-check: calcSubsidyInr matches stored pm_surya_subsidy", async () => {
    // Assert for system sizes matching various slabs
    expect(calcSubsidyInr(1.5)).toBe(45000);
    expect(calcSubsidyInr(2.0)).toBe(60000);
    expect(calcSubsidyInr(2.5)).toBe(69000);
    expect(calcSubsidyInr(3.0)).toBe(78000);
    expect(calcSubsidyInr(5.0)).toBe(78000);

    // Cross-check for report values
    const report = mockDb.solar_reports[0];
    const systemSize = report.system_size_kwp; // 9.0 kWp
    const calculatedSubsidy = calcSubsidyInr(systemSize);
    expect(calculatedSubsidy).toBe(report.pm_surya_subsidy); // 78000 === 78000
  });

  it("2. Auto-population & Silent Save: coordinate scan silently saves session and submits lead successfully", async () => {
    const apiServer = require("../../api-server.cjs");
    setMockSupabaseClient(apiServer.supabase);

    const report = await runAutomatedFeasibility(18.6000, 73.9000, {
      elevation: highConfidenceElevation,
      geometry: highConfidenceGeometry,
      shading: highConfidenceShading,
      weather: highConfidenceWeather,
    });
    expect(report.analysisId).toBeDefined();

    // The silent save should have pushed to analysis_sessions and solar_reports
    const createdSession = mockDb.analysis_sessions.find((s: any) => s.id === report.analysisId);
    expect(createdSession).toBeDefined();
    expect(createdSession.latitude).toBeCloseTo(18.6000, 4);
    expect(createdSession.site_id).toContain("automated_");

    const createdReport = mockDb.solar_reports.find((r: any) => r.session_id === report.analysisId);
    expect(createdReport).toBeDefined();
    expect(createdReport.pm_surya_subsidy).toBe(calcSubsidyInr(createdReport.system_size_kwp));

    // Submit lead request referencing this analysisId (which is a valid UUID)
    const { req, res, getResult } = mockReqRes({
      method: "POST",
      url: "/api/leads",
      body: {
        name: "Test User",
        phone: "9876543210",
        city: "Pune",
        siteId: report.analysisId
      }
    });

    await handleRequest(req, res);
    const result = getResult();
    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);

    const leadReq = mockDb.lead_requests[0];
    expect(leadReq).toBeDefined();
    expect(leadReq.session_id).toBe(report.analysisId);
  });

  it("3. Idempotent Won-trigger: setting status to 'won' triggers project promotion only once", async () => {
    // Seed lead assignment
    mockDb.lead_requests.push({
      id: "lead-req-1",
      session_id: "sess-pune-uuid",
      homeowner_name: "Ganesh Pujari",
      homeowner_phone: "9876543210",
      status: "open",
      installers_assigned_count: 1
    });

    mockDb.lead_assignments.push({
      id: "assign-1",
      lead_request_id: "lead-req-1",
      installer_id: "inst-a",
      price_charged_paise: 50000,
      status: "contacted",
      project_stage: null
    });

    // 1st update to 'won' should set project_stage = 'lead'
    const { req: req1, res: res1, getResult: getResult1 } = mockReqRes({
      method: "PATCH",
      url: "/api/installer/leads/update-assignment",
      body: {
        assignmentId: "assign-1",
        installerUserId: "installer-user-a",
        status: "won"
      }
    });
    await handleRequest(req1, res1);
    expect(getResult1().status).toBe(200);

    const assignmentAfter1 = mockDb.lead_assignments.find((a: any) => a.id === "assign-1");
    expect(assignmentAfter1.status).toBe("won");
    expect(assignmentAfter1.project_stage).toBe("lead");

    // Manually progress the project_stage to 'survey'
    const { req: reqMove, res: resMove, getResult: getResultMove } = mockReqRes({
      method: "PATCH",
      url: "/api/installer/leads/update-assignment",
      body: {
        assignmentId: "assign-1",
        installerUserId: "installer-user-a",
        projectStage: "survey"
      }
    });
    await handleRequest(reqMove, resMove);
    expect(getResultMove().status).toBe(200);
    expect(assignmentAfter1.project_stage).toBe("survey");

    // 2nd update to status = 'won' should be idempotent and not clobber project_stage back to 'lead'
    const { req: req2, res: res2, getResult: getResult2 } = mockReqRes({
      method: "PATCH",
      url: "/api/installer/leads/update-assignment",
      body: {
        assignmentId: "assign-1",
        installerUserId: "installer-user-a",
        status: "won"
      }
    });
    await handleRequest(req2, res2);
    expect(getResult2().status).toBe(200);

    const assignmentAfter2 = mockDb.lead_assignments.find((a: any) => a.id === "assign-1");
    expect(assignmentAfter2.status).toBe("won");
    expect(assignmentAfter2.project_stage).toBe("survey"); // Still survey!
  });
});
