// Sales/workflow constants for installer-facing proposal, CRM, and kanban flows.
// PM Surya Ghar Muft Bijli Yojana central subsidy slabs:
// Source: National Portal for Rooftop Solar / PM Surya Ghar scheme schedule
// (Rs 30,000/kW up to 2 kW, Rs 18,000 for the third kW, capped at Rs 78,000).
export const PM_SURYA_GHAR_SUBSIDY = {
  firstTwoKwRateInr: 30000,
  thirdKwRateInr: 18000,
  maxSubsidyInr: 78000,
  maxEligibleKw: 3,
} as const;

// National fallback tariff used only when the feasibility report has no state tariff.
// Source: existing SUNPOWER LINK default residential tariff assumption.
export const NATIONAL_FALLBACK_TARIFF_INR_PER_KWH = 7;

export const PROPOSAL_ROI_YEARS = 25;

export const LEAD_STAGES = ["New", "Contacted", "Site Visit", "Quoted", "Won", "Lost"] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export const KANBAN_STAGES = ["Lead", "Survey", "Design", "Install", "Commissioned"] as const;
export type KanbanStage = (typeof KANBAN_STAGES)[number];

