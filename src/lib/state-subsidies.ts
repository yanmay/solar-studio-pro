// State-specific rooftop solar subsidy boosters (F10).
//
// These are LEGISLATIVE amounts that stack on top of the central PM Surya Ghar
// subsidy. They change quarterly and are maintained by hand (no live API), so a
// `verified` date is attached to every entry for transparency on the Results
// page and Policy Tracker.
//
// Keyed by the region/state name produced by `getRegionalPSH` in india-grid.ts
// (e.g. "Maharashtra", "Gujarat", "Rajasthan", "Karnataka").

export interface StateSubsidy {
  /** ₹ per kW state booster (stacks on central subsidy). */
  boosterPerKwInr: number;
  /** Maximum kW eligible for the state booster. 0 = no active scheme. */
  capKw: number;
  /** Human-readable scheme name shown in the UI. */
  scheme: string;
  /** Last human-verified month (YYYY-MM). */
  verified: string;
}

// Note: keys are matched case-insensitively against the resolved region name.
export const STATE_SUBSIDIES: Record<string, StateSubsidy> = {
  gujarat: {
    boosterPerKwInr: 10000,
    capKw: 3,
    scheme: "Surya Gujarat",
    verified: "2026-01",
  },
  maharashtra: {
    boosterPerKwInr: 5000,
    capKw: 3,
    scheme: "MSEDCL Rooftop Incentive",
    verified: "2025-10",
  },
  rajasthan: {
    boosterPerKwInr: 7500,
    capKw: 5,
    scheme: "Rajasthan Solar Policy 2024",
    verified: "2025-07",
  },
  karnataka: {
    boosterPerKwInr: 0,
    capKw: 0,
    scheme: "None currently active",
    verified: "2026-01",
  },
};

export interface StateBoosterResult {
  /** State booster amount in ₹ (0 when no scheme applies). */
  boosterInr: number;
  /** Scheme name, or null when none applies. */
  scheme: string | null;
  /** Last verified month (YYYY-MM), or null. */
  verified: string | null;
}

/**
 * Compute the state subsidy booster for a given state/region and system size.
 * Booster applies per kW up to the scheme's cap. Returns a neutral zero result
 * for unknown states or states with no active scheme.
 */
export function calcStateBoosterInr(
  state: string | null | undefined,
  systemKwp: number
): StateBoosterResult {
  if (!state || systemKwp <= 0) {
    return { boosterInr: 0, scheme: null, verified: null };
  }
  const key = state.toLowerCase().trim();
  const entry = STATE_SUBSIDIES[key];
  if (!entry || entry.boosterPerKwInr <= 0 || entry.capKw <= 0) {
    return { boosterInr: 0, scheme: entry?.scheme ?? null, verified: entry?.verified ?? null };
  }
  const eligibleKw = Math.min(systemKwp, entry.capKw);
  const boosterInr = Math.round(eligibleKw * entry.boosterPerKwInr);
  return { boosterInr, scheme: entry.scheme, verified: entry.verified };
}
