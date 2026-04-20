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

/** Step 1: Usable area = rooftopArea × 0.75 */
export function calcUsableArea(rooftopAreaM2: number): number {
  return Math.round(rooftopAreaM2 * USABLE_AREA_FACTOR * 10) / 10;
}

/** Step 2: Installed capacity (kWp) = usableArea / 8 */
export function calcInstalledCapacity(usableAreaM2: number): number {
  return Math.round((usableAreaM2 / PANEL_AREA_PER_KW) * 100) / 100;
}

/** Step 3: Annual energy (kWh) = kWp × PSH × 365 × (1 - losses) */
export function calcAnnualEnergy(installedKw: number, peakSunHoursDaily: number): number {
  return Math.round(installedKw * peakSunHoursDaily * 365 * (1 - SYSTEM_LOSSES) * 10) / 10;
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
export function calcSystemCost(installedKw: number): number {
  for (const tier of SYSTEM_COST_PER_KW_INR_TIERS) {
    if (installedKw <= tier.maxKw) return Math.round(installedKw * tier.cost);
  }
  return Math.round(installedKw * 50000);
}

/** Step 5c: Investment summary — subsidy, net cost, payback period */
export function calcInvestment(
  installedKw: number,
  annualSavingsInr: number,
): { systemCostInr: number; subsidyInr: number; netCostInr: number; paybackYears: number; roi25yrPercent: number } {
  const systemCostInr = calcSystemCost(installedKw);
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
  };
  environmental: {
    co2AnnualKg: number;
    co2_25yrKg: number;
    treesEquivalent: number;
  };
  generatedAt: string;
  irradianceSource?: string;
  monthlyIrradiance?: Record<string, number>;
}

function generateAnalysisId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "sunpower_";
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

interface FullCalcOptions {
  electricityRate?: number;
  irradianceSource?: string;
  monthlyIrradiance?: Record<string, number>;
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
  const usableArea = calcUsableArea(rooftopAreaM2);

  // Step 2
  const installedKw = calcInstalledCapacity(usableArea);

  // Step 3
  const annualKwh = calcAnnualEnergy(installedKw, peakSunHours);

  // Step 4
  const dailyKwh = Math.round((annualKwh / 365) * 10) / 10;
  const monthlyKwh = Math.round((annualKwh / 12) * 10) / 10;

  // Step 5
  const financials = calcFinancials(annualKwh, electricityRate);

  // Step 5b/c
  const investment = calcInvestment(installedKw, financials.annual);

  // Step 6
  const co2 = calcCO2Impact(annualKwh);

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
    investment,
    environmental: {
      co2AnnualKg: co2.annualKg,
      co2_25yrKg: co2.yr25Kg,
      treesEquivalent: co2.trees,
    },
    generatedAt: new Date().toISOString(),
    irradianceSource: opts.irradianceSource,
    monthlyIrradiance: opts.monthlyIrradiance,
  };
}
