import { describe, it, expect } from "vitest";
import {
  deriveKpis,
  filterLeads,
  leadsByStatus,
  updateLeadStatus,
  formatInrLakh,
  INITIAL_LEADS,
  LEAD_STATUS_META,
  LEAD_STATUS_ORDER,
  type Lead,
  type LeadStatus,
} from "../lib/installer-leads";

// ─────────────────────────────────────────────────────────────────────────
// Pure data layer behind the Vendor CRM. The DataTable and the Kanban both
// render off these helpers + LEAD_STATUS_META, so their contracts must hold
// exactly or the two views drift.
// ─────────────────────────────────────────────────────────────────────────

/** Minimal builder so each test states only the fields it cares about. */
function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "lead-x",
    assignment_id: "asg-x",
    session_id: "ses-x",
    homeowner_name: "Test Owner",
    homeowner_phone: "9000000000",
    assignment_status: "delivered",
    reminder_date: null,
    reminder_note: null,
    project_stage: null,
    latitude: null,
    longitude: null,
    address: "Somewhere, City, ST",
    total_roof_area_sqm: 100,
    usable_roof_area_sqm: 80,
    system_size_kwp: 10,
    capex_estimate: 1000000,
    pm_surya_subsidy: 78000,
    payback_years: 6,
    annual_production_kwh: 14000,
    confidence_level: "High",
    confidence_reason: null,
    received_date: "2026-07-01",
    ...overrides,
  };
}

describe("LEAD_STATUS_META", () => {
  it("has an entry for every status in LEAD_STATUS_ORDER", () => {
    // Arrange / Act
    const metaKeys = Object.keys(LEAD_STATUS_META).sort();
    const orderKeys = [...LEAD_STATUS_ORDER].sort();

    // Assert
    expect(orderKeys).toEqual(metaKeys);
  });

  it("provides a non-empty label, badgeClass and dotClass for each status", () => {
    for (const status of LEAD_STATUS_ORDER) {
      const meta = LEAD_STATUS_META[status];
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.badgeClass.length).toBeGreaterThan(0);
      expect(meta.dotClass.length).toBeGreaterThan(0);
    }
  });

  it("keeps every INITIAL_LEADS status within the known vocabulary", () => {
    const known = new Set<LeadStatus>(LEAD_STATUS_ORDER);
    for (const lead of INITIAL_LEADS) {
      expect(known.has(lead.assignment_status)).toBe(true);
    }
  });
});

describe("deriveKpis", () => {
  it("returns all-zero figures for an empty pipeline", () => {
    // Arrange / Act
    const kpis = deriveKpis([]);

    // Assert
    expect(kpis).toEqual({
      total: 0,
      won: 0,
      conversionPct: 0,
      avgProjectValueInr: 0,
      pipelineValueInr: 0,
    });
  });

  it("counts wins and rounds the conversion rate", () => {
    // Arrange — 1 win out of 3 leads → 33%
    const leads = [
      makeLead({ id: "a", assignment_status: "won", capex_estimate: 900000 }),
      makeLead({ id: "b", assignment_status: "contacted", capex_estimate: 1200000 }),
      makeLead({ id: "c", assignment_status: "quoted", capex_estimate: 600000 }),
    ];

    // Act
    const kpis = deriveKpis(leads);

    // Assert
    expect(kpis.total).toBe(3);
    expect(kpis.won).toBe(1);
    expect(kpis.conversionPct).toBe(33);
  });

  it("averages project value only across leads that carry a capex estimate", () => {
    // Arrange
    const leads = [
      makeLead({ id: "a", capex_estimate: 1000000 }),
      makeLead({ id: "b", capex_estimate: 2000000 }),
      makeLead({ id: "c", capex_estimate: null }),
    ];

    // Act
    const kpis = deriveKpis(leads);

    // Assert — (1M + 2M) / 2, the null is excluded
    expect(kpis.avgProjectValueInr).toBe(1500000);
  });

  it("sums pipeline value from open opportunities only (excludes won and lost)", () => {
    // Arrange
    const leads = [
      makeLead({ id: "a", assignment_status: "delivered", capex_estimate: 500000 }),
      makeLead({ id: "b", assignment_status: "quoted", capex_estimate: 700000 }),
      makeLead({ id: "c", assignment_status: "won", capex_estimate: 900000 }),
      makeLead({ id: "d", assignment_status: "lost", capex_estimate: 400000 }),
    ];

    // Act
    const kpis = deriveKpis(leads);

    // Assert — only delivered + quoted count
    expect(kpis.pipelineValueInr).toBe(1200000);
  });
});

describe("filterLeads", () => {
  const leads = [
    makeLead({ id: "a", homeowner_name: "Ramesh Sharma", homeowner_phone: "9820012345", address: "Worli, Mumbai" }),
    makeLead({ id: "b", homeowner_name: "Vijay Reddy", homeowner_phone: "9900112233", address: "Indiranagar, Bengaluru" }),
  ];

  it("returns the full list for an empty or whitespace query", () => {
    expect(filterLeads(leads, "")).toHaveLength(2);
    expect(filterLeads(leads, "   ")).toHaveLength(2);
  });

  it("matches on name case-insensitively", () => {
    const result = filterLeads(leads, "ramesh");
    expect(result.map((l) => l.id)).toEqual(["a"]);
  });

  it("matches on phone and address too", () => {
    expect(filterLeads(leads, "9900").map((l) => l.id)).toEqual(["b"]);
    expect(filterLeads(leads, "bengaluru").map((l) => l.id)).toEqual(["b"]);
  });
});

describe("leadsByStatus", () => {
  it("returns only the leads in the requested status, preserving order", () => {
    // Arrange
    const leads = [
      makeLead({ id: "a", assignment_status: "contacted" }),
      makeLead({ id: "b", assignment_status: "quoted" }),
      makeLead({ id: "c", assignment_status: "contacted" }),
    ];

    // Act
    const result = leadsByStatus(leads, "contacted");

    // Assert
    expect(result.map((l) => l.id)).toEqual(["a", "c"]);
  });
});

describe("updateLeadStatus", () => {
  it("moves the target lead without mutating the original list", () => {
    // Arrange
    const leads = [makeLead({ id: "a", assignment_status: "delivered" })];

    // Act
    const next = updateLeadStatus(leads, "a", "contacted");

    // Assert — new array + object, source untouched (immutability rule)
    expect(next[0].assignment_status).toBe("contacted");
    expect(leads[0].assignment_status).toBe("delivered");
    expect(next).not.toBe(leads);
    expect(next[0]).not.toBe(leads[0]);
  });

  it("leaves non-matching leads referentially identical", () => {
    // Arrange
    const leads = [makeLead({ id: "a" }), makeLead({ id: "b" })];

    // Act
    const next = updateLeadStatus(leads, "a", "won");

    // Assert — untouched lead is the same reference (cheap re-renders)
    expect(next[1]).toBe(leads[1]);
  });
});

describe("formatInrLakh", () => {
  it("formats rupees into one-decimal lakh", () => {
    expect(formatInrLakh(1450000)).toBe("₹14.5L");
    expect(formatInrLakh(720000)).toBe("₹7.2L");
  });

  it("renders an em dash for null/undefined", () => {
    expect(formatInrLakh(null)).toBe("—");
    expect(formatInrLakh(undefined)).toBe("—");
  });
});
