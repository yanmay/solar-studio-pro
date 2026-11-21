/**
 * installer-leads — single source of truth for the Vendor CRM dashboard.
 *
 * Pure data + pure helpers (no React, no side effects) so it is trivially
 * unit-testable and shared by BOTH the DataTable and the Kanban without drift.
 *
 * The mock `Lead` shape deliberately mirrors the real API's `PurchasedLead`
 * field names (`homeowner_name`, `assignment_status`, `system_size_kwp`, …) and
 * the DB status/stage vocabulary, so a later phase can wire the Supabase
 * `/api/installer/leads/*` endpoints with zero shape rework. `activities` is the
 * one UI-only extra (an in-memory timeline the DB doesn't return yet).
 */

/** Assignment status — matches the `lead_assignments` enum in the DB/API. */
export type LeadStatus =
  | "delivered"
  | "viewed"
  | "contacted"
  | "site_visit"
  | "quoted"
  | "won"
  | "lost";

/** Project delivery stage — matches the DB/API `project_stage` enum. */
export type ProjectStage = "lead" | "survey" | "design" | "install" | "commissioned";

export type ConfidenceLevel = "High" | "Medium" | "Low";

export interface LeadActivity {
  date: string;
  type: string;
  description: string;
}

/**
 * Flat, wire-ready lead. Field names mirror the API's `PurchasedLead` so the
 * table/sheet/Kanban render straight off the eventual network payload.
 */
export interface Lead {
  id: string;
  assignment_id: string;
  session_id: string;
  homeowner_name: string;
  homeowner_phone: string;
  assignment_status: LeadStatus;
  reminder_date: string | null;
  reminder_note: string | null;
  project_stage: ProjectStage | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  total_roof_area_sqm: number | null;
  usable_roof_area_sqm: number | null;
  system_size_kwp: number | null;
  /** Project value / capital cost, in rupees (format to lakh at the edge). */
  capex_estimate: number | null;
  pm_surya_subsidy: number | null;
  payback_years: number | null;
  annual_production_kwh: number | null;
  confidence_level: ConfidenceLevel | null;
  confidence_reason: string | null;
  /** When the lead landed in the pipeline (ISO date). UI-facing. */
  received_date: string;
  /** In-memory activity timeline (UI-only until the DB exposes one). */
  activities?: LeadActivity[];
}

interface StatusMeta {
  label: string;
  /** Full `border + bg + text` recipe for badges/pills (dark stage palette). */
  badgeClass: string;
  /** Solid dot fill for Kanban column headers. */
  dotClass: string;
}

/**
 * The one place stage labels + colors live, so the table badge and the Kanban
 * column can never disagree. Dark-premium palette carried over from the
 * original hand-rolled board.
 */
export const LEAD_STATUS_META: Record<LeadStatus, StatusMeta> = {
  delivered: {
    label: "New Lead",
    badgeClass: "border-blue-500/30 bg-blue-500/10 text-blue-300",
    dotClass: "bg-blue-400",
  },
  viewed: {
    label: "Viewed",
    badgeClass: "border-sky-500/30 bg-sky-500/10 text-sky-300",
    dotClass: "bg-sky-400",
  },
  contacted: {
    label: "Contacted",
    badgeClass: "border-[#FF6600]/30 bg-[#FF6600]/10 text-[#FF6600]",
    dotClass: "bg-[#FF6600]",
  },
  site_visit: {
    label: "Site Visit",
    badgeClass: "border-violet-500/30 bg-violet-500/10 text-violet-300",
    dotClass: "bg-violet-400",
  },
  quoted: {
    label: "Quoted",
    badgeClass: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
    dotClass: "bg-cyan-400",
  },
  won: {
    label: "Won",
    badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    dotClass: "bg-emerald-400",
  },
  lost: {
    label: "Lost",
    badgeClass: "border-red-500/30 bg-red-500/10 text-red-300",
    dotClass: "bg-red-400",
  },
};

/** Deterministic left-to-right pipeline order for Kanban columns + selects. */
export const LEAD_STATUS_ORDER: LeadStatus[] = [
  "delivered",
  "viewed",
  "contacted",
  "site_visit",
  "quoted",
  "won",
  "lost",
];

/** Statuses that count as an open opportunity (drive pipeline value). */
const ACTIVE_STATUSES: ReadonlySet<LeadStatus> = new Set<LeadStatus>([
  "delivered",
  "viewed",
  "contacted",
  "site_visit",
  "quoted",
]);

/** Seed leads — remapped from the legacy board onto the DB status vocabulary. */
export const INITIAL_LEADS: Lead[] = [
  {
    id: "lead-101",
    assignment_id: "asg-101",
    session_id: "ses-101",
    homeowner_name: "Ramesh Sharma",
    homeowner_phone: "9820012345",
    assignment_status: "delivered",
    reminder_date: null,
    reminder_note: null,
    project_stage: null,
    latitude: 19.0176,
    longitude: 72.8181,
    address: "Sea Face Apartment, Worli, Mumbai, MH",
    total_roof_area_sqm: 120,
    usable_roof_area_sqm: 96,
    system_size_kwp: 12.5,
    capex_estimate: 1450000,
    pm_surya_subsidy: 78000,
    payback_years: 6.4,
    annual_production_kwh: 17500,
    confidence_level: "High",
    confidence_reason: "Unshaded south-facing terrace with clean access.",
    received_date: "2026-07-17",
    activities: [
      { date: "2026-07-17", type: "received", description: "Lead received from SolarScan B2C" },
    ],
  },
  {
    id: "lead-102",
    assignment_id: "asg-102",
    session_id: "ses-102",
    homeowner_name: "Ananya Deshmukh",
    homeowner_phone: "9819922334",
    assignment_status: "contacted",
    reminder_date: "2026-07-20",
    reminder_note: "Follow up on financing options.",
    project_stage: null,
    latitude: 18.5074,
    longitude: 73.8077,
    address: "Greenwood Colony, Kothrud, Pune, MH",
    total_roof_area_sqm: 85,
    usable_roof_area_sqm: 68,
    system_size_kwp: 8.5,
    capex_estimate: 980000,
    pm_surya_subsidy: 78000,
    payback_years: 6.9,
    annual_production_kwh: 11900,
    confidence_level: "High",
    confidence_reason: "Standard RCC rooftop, minimal obstructions.",
    received_date: "2026-07-16",
    activities: [
      { date: "2026-07-16", type: "received", description: "Lead received from SolarScan B2C" },
      { date: "2026-07-16", type: "contact", description: "First call made" },
    ],
  },
  {
    id: "lead-103",
    assignment_id: "asg-103",
    session_id: "ses-103",
    homeowner_name: "Vijay Reddy",
    homeowner_phone: "9900112233",
    assignment_status: "site_visit",
    reminder_date: "2026-07-19",
    reminder_note: "Confirm structural load before quoting.",
    project_stage: "survey",
    latitude: 12.9716,
    longitude: 77.5946,
    address: "UB Hills, Lavelle Road, Bengaluru, KA",
    total_roof_area_sqm: 250,
    usable_roof_area_sqm: 210,
    system_size_kwp: 24.0,
    capex_estimate: 2850000,
    pm_surya_subsidy: 78000,
    payback_years: 5.8,
    annual_production_kwh: 34800,
    confidence_level: "Medium",
    confidence_reason: "Large roof but partial shading from adjacent tower.",
    received_date: "2026-07-15",
    activities: [
      { date: "2026-07-16", type: "visit", description: "Rooftop site visit scheduled" },
    ],
  },
  {
    id: "lead-104",
    assignment_id: "asg-104",
    session_id: "ses-104",
    homeowner_name: "Karthik Srinivasan",
    homeowner_phone: "9740054321",
    assignment_status: "quoted",
    reminder_date: null,
    reminder_note: null,
    project_stage: "design",
    latitude: 12.9784,
    longitude: 77.6408,
    address: "12th Cross, Indiranagar, Bengaluru, KA",
    total_roof_area_sqm: 75,
    usable_roof_area_sqm: 58,
    system_size_kwp: 6.0,
    capex_estimate: 720000,
    pm_surya_subsidy: 60000,
    payback_years: 7.1,
    annual_production_kwh: 8400,
    confidence_level: "High",
    confidence_reason: "Compact system, quote submitted at ₹5.8L.",
    received_date: "2026-07-14",
    activities: [
      { date: "2026-07-15", type: "quote", description: "Quote submitted: ₹5.8 Lakh" },
    ],
  },
  {
    id: "lead-105",
    assignment_id: "asg-105",
    session_id: "ses-105",
    homeowner_name: "Sunita Patel",
    homeowner_phone: "9611223344",
    assignment_status: "won",
    reminder_date: null,
    reminder_note: null,
    project_stage: "install",
    latitude: 23.0225,
    longitude: 72.5714,
    address: "Nirma Heights, Satellite, Ahmedabad, GJ",
    total_roof_area_sqm: 140,
    usable_roof_area_sqm: 118,
    system_size_kwp: 15.0,
    capex_estimate: 1800000,
    pm_surya_subsidy: 78000,
    payback_years: 6.0,
    annual_production_kwh: 21750,
    confidence_level: "High",
    confidence_reason: "Project won & locked; install scheduled.",
    received_date: "2026-07-13",
    activities: [
      { date: "2026-07-15", type: "status", description: "Project won & locked" },
    ],
  },
];

export interface LeadKpis {
  /** Total leads in the pipeline. */
  total: number;
  /** Leads with status `won`. */
  won: number;
  /** Won ÷ total, as an integer percentage (0 when there are no leads). */
  conversionPct: number;
  /** Mean project value across all leads that carry a capex estimate, in rupees. */
  avgProjectValueInr: number;
  /** Sum of capex for still-open opportunities (excludes won/lost), in rupees. */
  pipelineValueInr: number;
}

/** Derive the dashboard KPI figures from the current lead set (pure). */
export function deriveKpis(leads: Lead[]): LeadKpis {
  const total = leads.length;
  const won = leads.filter((l) => l.assignment_status === "won").length;
  const conversionPct = total === 0 ? 0 : Math.round((won / total) * 100);

  const withValue = leads.filter((l) => l.capex_estimate != null);
  const avgProjectValueInr =
    withValue.length === 0
      ? 0
      : Math.round(
          withValue.reduce((sum, l) => sum + (l.capex_estimate ?? 0), 0) / withValue.length,
        );

  const pipelineValueInr = leads
    .filter((l) => ACTIVE_STATUSES.has(l.assignment_status))
    .reduce((sum, l) => sum + (l.capex_estimate ?? 0), 0);

  return { total, won, conversionPct, avgProjectValueInr, pipelineValueInr };
}

/**
 * Case-insensitive search across name, phone, and address. An empty/whitespace
 * query returns the list unchanged.
 */
export function filterLeads(leads: Lead[], query: string): Lead[] {
  const q = query.trim().toLowerCase();
  if (!q) return leads;
  return leads.filter((lead) => {
    const haystack = [lead.homeowner_name, lead.homeowner_phone, lead.address ?? ""]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

/** All leads currently in a given pipeline status (order preserved). */
export function leadsByStatus(leads: Lead[], status: LeadStatus): Lead[] {
  return leads.filter((lead) => lead.assignment_status === status);
}

/** Immutably return a new list with one lead moved to a new status. */
export function updateLeadStatus(leads: Lead[], id: string, status: LeadStatus): Lead[] {
  return leads.map((lead) =>
    lead.id === id ? { ...lead, assignment_status: status } : lead,
  );
}

/** Format a rupee amount as compact lakh, e.g. 1450000 → "₹14.5L". */
export function formatInrLakh(rupees: number | null | undefined): string {
  if (rupees == null) return "—";
  return `₹${(rupees / 100000).toFixed(1)}L`;
}
