// Pure solar calculation functions — no API calls, no side effects.
// Every function takes inputs and returns outputs. Nothing else.

import {
  USABLE_AREA_FACTOR,
  PANEL_AREA_PER_KW,
  SYSTEM_LOSSES,
  ELECTRICITY_RATE_INR,
  EMISSION_FACTOR_KG,
  CO2_PER_TREE_KG_YR,
  SYSTEM_LIFETIME_YRS,
  SYSTEM_COST_PER_KW_INR_TIERS,
  calcSubsidyInr,
  MIN_AREA_M2,
  MAX_AREA_M2,
  MIN_PSH,
  MAX_PSH,
  MIN_ELECTRICITY_RATE,
  MAX_ELECTRICITY_RATE,
} from "./solar-defaults";
import { classifyWindZone, calcWindCostAdder } from "./wind-zone";
import { calcTemperatureDerate } from "./temperature-derate";

// ---------- Validation ----------

export class SolarCalcError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = "SolarCalcError";
  }
}

function validateInputs(rooftopAreaM2: number, peakSunHours: number, electricityRate: number): void {
  if (rooftopAreaM2 < MIN_AREA_M2) {
    throw new SolarCalcError(`Area too small: ${rooftopAreaM2} m². Minimum is ${MIN_AREA_M2} m².`, "AREA_TOO_SMALL");
  }
  if (rooftopAreaM2 > MAX_AREA_M2) {
    throw new SolarCalcError(`Area too large: ${rooftopAreaM2} m². Maximum is ${MAX_AREA_M2} m².`, "AREA_TOO_LARGE");
  }
  if (peakSunHours < MIN_PSH || peakSunHours > MAX_PSH) {
    throw new SolarCalcError(`Invalid peak sun hours: ${peakSunHours}. Must be between ${MIN_PSH} and ${MAX_PSH}.`, "INVALID_PSH");
  }
  if (electricityRate < MIN_ELECTRICITY_RATE || electricityRate > MAX_ELECTRICITY_RATE) {
    throw new SolarCalcError(`Invalid electricity rate: ₹${electricityRate}. Must be between ₹${MIN_ELECTRICITY_RATE} and ₹${MAX_ELECTRICITY_RATE}.`, "INVALID_RATE");
  }
}

// ---------- Step functions ----------

/** Step 1: Usable area = (rooftopArea / cos(pitch)) × 0.75 */
export function calcUsableArea(rooftopAreaM2: number, pitchDegrees: number = 0, exclusionAreaM2: number = 0): number {
  const correctedArea = (rooftopAreaM2 - exclusionAreaM2) / Math.cos((pitchDegrees * Math.PI) / 180);
  return Math.round(correctedArea * USABLE_AREA_FACTOR * 10) / 10;
}

/** Step 2: Installed capacity (kWp) = usableArea / 8 */
export function calcInstalledCapacity(usableAreaM2: number): number {
  return Math.round((usableAreaM2 / PANEL_AREA_PER_KW) * 100) / 100;
}

/** Step 3: Annual energy (kWh) = kWp × PSH × 365 × (1 - losses) × (1 - shading) */
export function calcAnnualEnergy(
  installedKw: number,
  peakSunHoursDaily: number,
  shading: "none" | "partial" | "heavy" | "auto" = "auto",
  computedShadingLoss: number | null = null,
  t2mCelsius?: number
): number {
  let manualShadingLoss = 0;
  if (shading === "partial") {
    manualShadingLoss = 0.15;
  } else if (shading === "heavy") {
    manualShadingLoss = 0.30;
  }

  const actualComputedShadingLoss = shading === "auto" ? (computedShadingLoss ?? 0) : 0;
  const baseEnergy = installedKw * peakSunHoursDaily * 365 * (1 - SYSTEM_LOSSES);
  const shadingMultiplier = 1 - (actualComputedShadingLoss || manualShadingLoss);
  let energy = baseEnergy * shadingMultiplier;

  if (t2mCelsius !== undefined) {
    energy *= calcTemperatureDerate(t2mCelsius);
  }
  return Math.round(energy * 10) / 10;
}

/** Step 5: Financial savings */
export function calcFinancials(
  annualKwh: number,
  electricityRate: number = ELECTRICITY_RATE_INR
): { monthly: number; annual: number; yr25: number } {
  const annual = Math.round(annualKwh * electricityRate);
  return {
    monthly: Math.round(annual / 12),
    annual,
    yr25: annual * SYSTEM_LIFETIME_YRS,
  };
}

/** Step 5b: System cost (turn-key, INR) — uses tiered ₹/kW pricing */
export function calcSystemCost(installedKw: number, windZone?: number): number {
  let baseCost = 0;
  let found = false;
  for (const tier of SYSTEM_COST_PER_KW_INR_TIERS) {
    if (installedKw <= tier.maxKw) {
      baseCost = Math.round(installedKw * tier.cost);
      found = true;
      break;
    }
  }
  if (!found) {
    baseCost = Math.round(installedKw * 50000);
  }
  if (windZone !== undefined) {
    baseCost += Math.round(calcWindCostAdder(windZone) * installedKw);
  }
  return baseCost;
}

/** Step 5c: Investment summary — subsidy, net cost, payback period */
export function calcInvestment(
  installedKw: number,
  annualSavingsInr: number,
  windZone?: number
): { systemCostInr: number; subsidyInr: number; netCostInr: number; paybackYears: number; roi25yrPercent: number } {
  const systemCostInr = calcSystemCost(installedKw, windZone);
  const subsidyInr = calcSubsidyInr(installedKw);
  const netCostInr = Math.max(0, systemCostInr - subsidyInr);
  const paybackYears = annualSavingsInr > 0
    ? Math.round((netCostInr / annualSavingsInr) * 10) / 10
    : 0;
  const lifetimeSavings = annualSavingsInr * SYSTEM_LIFETIME_YRS;
  const roi25yrPercent = netCostInr > 0
    ? Math.round(((lifetimeSavings - netCostInr) / netCostInr) * 100)
    : 0;
  return { systemCostInr, subsidyInr, netCostInr, paybackYears, roi25yrPercent };
}

/**
 * LCOE — Levelised Cost of Energy (₹/kWh) over 25 years.
 * LCOE = Net Capital Cost / (Annual kWh × Lifetime).
 * Accounts for 0.5%/yr degradation in panel output.
 */
export function calcLCOE(netCostInr: number, annualKwh: number): number {
  if (annualKwh <= 0 || netCostInr <= 0) return 0;
  const DEGRADATION_RATE = 0.005; // 0.5% per year
  let totalLifetimeKwh = 0;
  for (let yr = 0; yr < SYSTEM_LIFETIME_YRS; yr++) {
    totalLifetimeKwh += annualKwh * Math.pow(1 - DEGRADATION_RATE, yr);
  }
  return Math.round((netCostInr / totalLifetimeKwh) * 100) / 100;
}

/**
 * NPV — Net Present Value of the investment (INR).
 * Uses a discount rate of 8% (WACC proxy for Indian solar MSME).
 * Cash inflow = annual savings with 3%/yr tariff escalation.
 */
export function calcNPV(
  netCostInr: number,
  annualSavingsInr: number,
  tariffEscalationRate: number = 0.03,
  discountRate: number = 0.08
): number {
  let npv = -netCostInr;
  for (let yr = 1; yr <= SYSTEM_LIFETIME_YRS; yr++) {
    const cashflow = annualSavingsInr * Math.pow(1 + tariffEscalationRate, yr - 1);
    npv += cashflow / Math.pow(1 + discountRate, yr);
  }
  return Math.round(npv);
}

/**
 * IRR — Internal Rate of Return (%) using binary search (Newton's method approximation).
 * Solves for the discount rate that makes NPV = 0.
 */
export function calcIRR(
  netCostInr: number,
  annualSavingsInr: number,
  tariffEscalationRate: number = 0.03
): number {
  if (netCostInr <= 0 || annualSavingsInr <= 0) return 0;
  let lo = -0.5, hi = 5.0; // search between -50% and 500%
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const npv = calcNPV(netCostInr, annualSavingsInr, tariffEscalationRate, mid);
    if (Math.abs(npv) < 1) break;
    if (npv > 0) lo = mid;
    else hi = mid;
  }
  return Math.round(((lo + hi) / 2) * 10000) / 100; // % with 2 decimal places
}

/**
 * 25-year cashflow table with tariff escalation (3%/yr) and panel degradation (0.5%/yr).
 * Returns an array of { year, savingsInr, cumulativeSavingsInr } objects.
 */
export function calc25YrCashflow(
  netCostInr: number,
  annualSavingsInr: number,
  tariffEscalationRate: number = 0.03
): Array<{ year: number; savingsInr: number; cumulativeSavingsInr: number }> {
  const DEGRADATION_RATE = 0.005;
  let cumulative = -netCostInr; // start negative (upfront cost)
  return Array.from({ length: SYSTEM_LIFETIME_YRS }, (_, i) => {
    const yr = i + 1;
    const savings = Math.round(
      annualSavingsInr *
      Math.pow(1 + tariffEscalationRate, yr - 1) *
      Math.pow(1 - DEGRADATION_RATE, yr - 1)
    );
    cumulative += savings;
    return { year: yr, savingsInr: savings, cumulativeSavingsInr: Math.round(cumulative) };
  });
}

/**
 * Investment grade classifier (A+, A, B, C, D) based on payback and IRR.
 * Matches the schema's `investment_grade` field.
 */
export function calcInvestmentGrade(
  paybackYears: number,
  irr: number
): { grade: "A+" | "A" | "B" | "C" | "D"; label: string; color: string } {
  if (paybackYears <= 4 && irr >= 25) return { grade: "A+", label: "Exceptional", color: "#10B981" };
  if (paybackYears <= 6 && irr >= 18) return { grade: "A", label: "Excellent", color: "#22C55E" };
  if (paybackYears <= 8 && irr >= 12) return { grade: "B", label: "Good", color: "#F59E0B" };
  if (paybackYears <= 12 && irr >= 6) return { grade: "C", label: "Fair", color: "#F97316" };
  return { grade: "D", label: "Poor", color: "#EF4444" };
}

export function calcAnnualSavings(annualKwh: number, electricityRate: number): number {
  return calcFinancials(annualKwh, electricityRate).annual;
}

export function calcPaybackYears(netCostInr: number, annualSavingsInr: number): number {
  return annualSavingsInr > 0 ? Math.round((netCostInr / annualSavingsInr) * 10) / 10 : 0;
}

export function calcROI(netCostInr: number, annualSavingsInr: number): number {
  const lifetimeSavings = annualSavingsInr * SYSTEM_LIFETIME_YRS;
  return netCostInr > 0 ? Math.round(((lifetimeSavings - netCostInr) / netCostInr) * 100) : 0;
}

/** Step 6: CO₂ impact */
export function calcCO2Impact(annualKwh: number): { annualKg: number; yr25Kg: number; trees: number } {
  const annualKg = Math.round(annualKwh * EMISSION_FACTOR_KG * 10) / 10;
  const yr25Kg = Math.round(annualKg * SYSTEM_LIFETIME_YRS * 10) / 10;
  const trees = Math.round(yr25Kg / (CO2_PER_TREE_KG_YR * SYSTEM_LIFETIME_YRS));
  return { annualKg, yr25Kg, trees };
}

// ---------- Full calculation ----------

export interface SolarAnalysis {
  analysisId: string;
  rooftop: {
    drawnAreaM2: number;
    usableAreaM2: number;
  };
  energy: {
    installedCapacityKw: number;
    peakSunHoursDaily: number;
    dailyKwh: number;
    monthlyKwh: number;
    annualKwh: number;
  };
  financials: {
    electricityRateInr: number;
    monthlySavingsInr: number;
    annualSavingsInr: number;
    savings25yrInr: number;
  };
  investment: {
    systemCostInr: number;
    subsidyInr: number;
    netCostInr: number;
    paybackYears: number;
    roi25yrPercent: number;
    lcoe?: number;
    npv?: number;
    irr?: number;
    investmentGrade?: { grade: "A+" | "A" | "B" | "C" | "D"; label: string; color: string };
    cashflow25yr?: Array<{ year: number; savingsInr: number; cumulativeSavingsInr: number }>;
  };
  environmental: {
    co2AnnualKg: number;
    co2_25yrKg: number;
    treesEquivalent: number;
  };
  generatedAt: string;
  irradianceSource?: string;
  monthlyIrradiance?: Record<string, number>;
  // Shading accuracy outputs
  horizonShadingLoss?: number;
  skyViewFactor?: number;
  windZone?: { zone: number; label: string };
  tempDerate?: number;
  ws10m?: number;
  t2m?: number;
  shadingLoss?: number;
  // Custom layout properties
  panelCount?: number;
  panelType?: "compact" | "premium";
  alignment?: "roof" | "south";
  tiltDeg?: number;
  orientation?: "portrait" | "landscape" | "auto";
  walkways?: boolean;
  setbackM?: number;
  pitchDegrees?: number;
  shading?: "none" | "partial" | "heavy" | "auto";
  computedShadingLoss?: number | null;
}

function generateAnalysisId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "scan_";
  for (let i = 0; i < 12; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

/** Roof shading levels → fractional yield loss (matches Python engine + ResultsPage UI). */
export const SHADING_LOSS: Record<"none" | "partial" | "heavy", number> = {
  none: 0.0,
  partial: 0.15,
  heavy: 0.30,
};

/** Clear-sky sky-view factor before shading is applied. */
export const BASE_SKY_VIEW_FACTOR = 0.95;

interface FullCalcOptions {
  electricityRate?: number;
  irradianceSource?: string;
  monthlyIrradiance?: Record<string, number>;
  shading?: "none" | "partial" | "heavy" | "auto";
  computedShadingLoss?: number | null;
  exclusionAreaM2?: number;
  ws10m?: number;
  t2m?: number;
  // Custom capacity & layout inputs
  customCapacityKw?: number;
  panelCount?: number;
  panelType?: "compact" | "premium";
  alignment?: "roof" | "south";
  tiltDeg?: number;
  orientation?: "portrait" | "landscape" | "auto";
  walkways?: boolean;
  setbackM?: number;
  pitchDegrees?: number;
}

/**
 * Run the complete solar calculation pipeline.
 * Pure function: takes inputs, returns full analysis object.
 */
export function runFullCalculation(
  rooftopAreaM2: number,
  peakSunHours: number,
  opts: FullCalcOptions = {}
): SolarAnalysis {
  const electricityRate = opts.electricityRate ?? ELECTRICITY_RATE_INR;

  // Validate
  validateInputs(rooftopAreaM2, peakSunHours, electricityRate);

  // Step 1
  const usableArea = calcUsableArea(rooftopAreaM2, opts.pitchDegrees, opts.exclusionAreaM2);

  // Step 2: Use custom capacity if provided (calculated from actual panels), otherwise fallback to area-based estimation
  const installedKw = opts.customCapacityKw ?? calcInstalledCapacity(usableArea);

  // Wind Zone classification
  let windZoneObj: { zone: number; label: string } | undefined;
  if (opts.ws10m !== undefined) {
    windZoneObj = classifyWindZone(opts.ws10m);
  }

  // Step 3
  const annualKwh = calcAnnualEnergy(installedKw, peakSunHours, opts.shading, opts.computedShadingLoss, opts.t2m);

  // Applied Shading Loss calculation for return payload
  let appliedShadingLoss = 0;
  if (opts.shading === "none") {
    appliedShadingLoss = 0;
  } else if (opts.shading === "partial") {
    appliedShadingLoss = 0.15;
  } else if (opts.shading === "heavy") {
    appliedShadingLoss = 0.30;
  } else {
    appliedShadingLoss = opts.computedShadingLoss ?? 0;
  }
  const skyViewFactor = BASE_SKY_VIEW_FACTOR * (1 - appliedShadingLoss);

  // Step 4
  const dailyKwh = Math.round((annualKwh / 365) * 10) / 10;
  const monthlyKwh = Math.round((annualKwh / 12) * 10) / 10;

  // Step 5
  const financials = calcFinancials(annualKwh, electricityRate);

  // Step 5b/c — core investment metrics
  const investment = calcInvestment(installedKw, financials.annual, windZoneObj?.zone);

  // Stage 1 financial upgrades: LCOE, IRR, NPV, cashflow, investment grade
  const lcoe = calcLCOE(investment.netCostInr, annualKwh);
  const npv = calcNPV(investment.netCostInr, financials.annual);
  const irr = calcIRR(investment.netCostInr, financials.annual);
  const cashflow25yr = calc25YrCashflow(investment.netCostInr, financials.annual);
  const investmentGrade = calcInvestmentGrade(investment.paybackYears, irr);

  // Step 6
  const co2 = calcCO2Impact(annualKwh);

  // Temperature Derating multiplier calculation
  const tempDerate = opts.t2m !== undefined ? calcTemperatureDerate(opts.t2m) : undefined;

  return {
    analysisId: generateAnalysisId(),
    rooftop: {
      drawnAreaM2: Math.round(rooftopAreaM2 * 10) / 10,
      usableAreaM2: usableArea,
    },
    energy: {
      installedCapacityKw: installedKw,
      peakSunHoursDaily: peakSunHours,
      dailyKwh,
      monthlyKwh,
      annualKwh,
    },
    financials: {
      electricityRateInr: electricityRate,
      monthlySavingsInr: financials.monthly,
      annualSavingsInr: financials.annual,
      savings25yrInr: financials.yr25,
    },
    investment: {
      ...investment,
      lcoe,
      npv,
      irr,
      investmentGrade,
      cashflow25yr,
    },
    environmental: {
      co2AnnualKg: co2.annualKg,
      co2_25yrKg: co2.yr25Kg,
      treesEquivalent: co2.trees,
    },
    generatedAt: new Date().toISOString(),
    irradianceSource: opts.irradianceSource,
    monthlyIrradiance: opts.monthlyIrradiance,
    // Shading accuracy outputs
    horizonShadingLoss: appliedShadingLoss,
    skyViewFactor,
    windZone: windZoneObj,
    tempDerate,
    ws10m: opts.ws10m,
    t2m: opts.t2m,
    shadingLoss: appliedShadingLoss,
    // Pass custom layout properties to the results object
    panelCount: opts.panelCount,
    panelType: opts.panelType,
    alignment: opts.alignment,
    tiltDeg: opts.tiltDeg,
    orientation: opts.orientation,
    walkways: opts.walkways,
    setbackM: opts.setbackM,
    pitchDegrees: opts.pitchDegrees || 0,
    shading: opts.shading || "auto",
    computedShadingLoss: opts.computedShadingLoss ?? null,
  };
}

export { calcSubsidyInr };
