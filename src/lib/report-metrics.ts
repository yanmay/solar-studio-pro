// ─────────────────────────────────────────────────────────────
// Canonical report metrics — ONE computed value per metric,
// referenced by every widget on the page and by the PDF export.
//
// Before this module the page showed contradicting numbers for the
// same metric (e.g. real NPV in one card, `npv * 0.78` fabricated in
// another; lifetime savings sourced three different ways). Everything
// now funnels through deriveMetrics() so the numbers agree everywhere.
// ─────────────────────────────────────────────────────────────

/** The subset of computeModel()'s return that metrics depend on. */
export interface SolarModel {
  installedKw: number;
  baseAnnualKwh: number;
  netCostInr: number;
  totalGrossCapEx: number;
  subsidyInr: number;
  cashFlows: number[];
  cumulativeCashFlow: number[];
  npv: number;
  irr: number;
  irrFound: boolean;
  paybackPeriod: number;
  breakEvenYr: number;
  breakEvenFound: boolean;
  lcoe: number;
}

export interface ReportMetrics {
  /** Hero metric — years to recover net cost. */
  paybackYears: number;
  paybackFound: boolean;
  /** Net present value over 25 years (real, from the cash flows). */
  npvInr: number;
  /** Total nominal savings over 25 years, net of the upfront cost. */
  lifetimeSavingsInr: number;
  /** First-year production. */
  annualProductionKwh: number;
  /** Net capital cost after subsidy — the money out the door. */
  netCostInr: number;
  /** Installed DC capacity. */
  installedKw: number;
  /** Internal rate of return (%). */
  irrPct: number;
  /** Whether IRR was solvable (search bracketed a root). False ⇒ show N/A, not 0%. */
  irrFound: boolean;
  /** Levelised cost of energy (₹/kWh). */
  lcoeInrPerKwh: number;
  /** Undiscounted 25-yr cumulative cash position (for the chart). */
  cumulativeCashFlow: number[];
}

const HORIZON_YEARS = 25;

/**
 * Derive the single canonical set of report metrics from a model.
 * All widgets and the PDF read from this — never recompute a metric
 * inline, and never apply cosmetic multipliers to these values.
 */
export function deriveMetrics(model: SolarModel): ReportMetrics {
  // Lifetime savings = final cumulative cash position + the upfront cost
  // that was subtracted at year 0. cumulativeCashFlow[0] === -netCostInr,
  // so cumulativeCashFlow[25] already nets out the capital outlay; adding
  // netCostInr back yields gross nominal savings over the horizon.
  const finalCumulative = model.cumulativeCashFlow[HORIZON_YEARS] ?? 0;
  const lifetimeSavingsInr = finalCumulative + model.netCostInr;

  return {
    paybackYears: model.paybackPeriod,
    paybackFound: model.breakEvenFound,
    npvInr: model.npv, // real NPV — no fabricated scaling
    lifetimeSavingsInr,
    annualProductionKwh: model.baseAnnualKwh,
    netCostInr: model.netCostInr,
    installedKw: model.installedKw,
    irrPct: model.irr,
    irrFound: model.irrFound,
    lcoeInrPerKwh: model.lcoe,
    cumulativeCashFlow: model.cumulativeCashFlow,
  };
}
