import {
  NATIONAL_FALLBACK_TARIFF_INR_PER_KWH,
  PM_SURYA_GHAR_SUBSIDY,
  PROPOSAL_ROI_YEARS,
} from "./sales-workflow-config";

type ConfidenceLevel = "High" | "Medium" | "Low";

export interface ProposalFeasibilityResult {
  coordinates?: { lat: number; lng: number };
  usableRoofArea?: { value: number; confidence?: ConfidenceLevel };
  systemSizeKwp?: { value: number; confidence?: ConfidenceLevel };
  annualYieldKwh?: { value: number; confidence?: ConfidenceLevel };
  financials?: {
    capexCostInr?: { value: number; confidence?: ConfidenceLevel };
    netCostInr?: { value: number; confidence?: ConfidenceLevel };
    subsidyInr?: { value: number; confidence?: ConfidenceLevel };
    paybackYears?: { value: number; confidence?: ConfidenceLevel };
    roiPercent25yr?: { value: number; confidence?: ConfidenceLevel };
    electricityRateInr?: { value: number; confidence?: ConfidenceLevel; source?: string };
    tariffSource?: string;
  };
  overallConfidence?: ConfidenceLevel;
  generatedAt?: string;
}

export interface ProposalFinancials {
  grossCapexInr: number;
  subsidyInr: number;
  netCostInr: number;
  tariffInrPerKwh: number;
  monthlySavingsInr: number;
  annualSavingsInr: number;
  paybackYears: number;
  lifetimeSavingsInr: number;
  roiPercent25yr: number;
  subsidyEligible: boolean;
  subsidySource: string;
  confidence: ConfidenceLevel;
}

export function calculatePmSuryaGharSubsidy(systemKwp: number): number {
  if (systemKwp <= 0) return 0;
  const firstTwoKw = Math.min(systemKwp, 2) * PM_SURYA_GHAR_SUBSIDY.firstTwoKwRateInr;
  const thirdKw = Math.max(0, Math.min(systemKwp, PM_SURYA_GHAR_SUBSIDY.maxEligibleKw) - 2)
    * PM_SURYA_GHAR_SUBSIDY.thirdKwRateInr;
  return Math.min(PM_SURYA_GHAR_SUBSIDY.maxSubsidyInr, Math.round(firstTwoKw + thirdKw));
}

export function buildProposalFinancials(result: ProposalFeasibilityResult): ProposalFinancials {
  const systemKwp = result.systemSizeKwp?.value ?? 0;
  const annualYieldKwh = result.annualYieldKwh?.value ?? 0;
  const grossCapexInr = Math.round(result.financials?.capexCostInr?.value ?? 0);
  const subsidyInr = calculatePmSuryaGharSubsidy(systemKwp);
  const netCostInr = Math.max(0, grossCapexInr - subsidyInr);
  const tariffInrPerKwh =
    result.financials?.electricityRateInr?.value ?? NATIONAL_FALLBACK_TARIFF_INR_PER_KWH;
  const annualSavingsInr = Math.round(annualYieldKwh * tariffInrPerKwh);
  const monthlySavingsInr = Math.round(annualSavingsInr / 12);
  const paybackYears = annualSavingsInr > 0
    ? Math.round((netCostInr / annualSavingsInr) * 10) / 10
    : 0;
  const lifetimeSavingsInr = annualSavingsInr * PROPOSAL_ROI_YEARS;
  const roiPercent25yr = netCostInr > 0
    ? Math.round(((lifetimeSavingsInr - netCostInr) / netCostInr) * 100)
    : 0;
  const tariffConfidence = result.financials?.electricityRateInr?.confidence;
  const confidence = tariffConfidence === "Low" ? "Low" : result.overallConfidence ?? "Low";

  return {
    grossCapexInr,
    subsidyInr,
    netCostInr,
    tariffInrPerKwh,
    monthlySavingsInr,
    annualSavingsInr,
    paybackYears,
    lifetimeSavingsInr,
    roiPercent25yr,
    subsidyEligible: systemKwp > 0,
    subsidySource: "PM Surya Ghar central subsidy slabs",
    confidence,
  };
}

export function buildRoiSeries(financials: ProposalFinancials): { year: number; cumulativeSavingsInr: number; netCostInr: number }[] {
  return Array.from({ length: PROPOSAL_ROI_YEARS + 1 }, (_, year) => ({
    year,
    cumulativeSavingsInr: financials.annualSavingsInr * year,
    netCostInr: financials.netCostInr,
  }));
}

