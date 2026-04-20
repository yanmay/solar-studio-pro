// Tilt + azimuth yield correction
// Reference: PVGIS / NREL — fraction of optimal-tilt yield achievable
// at a given (tilt, azimuth) for India latitudes (10°-32° N).

export type Azimuth = "S" | "SE" | "SW" | "E" | "W" | "N" | "NE" | "NW";

export const AZIMUTH_LABELS: Record<Azimuth, string> = {
  S: "South",
  SE: "South-East",
  SW: "South-West",
  E: "East",
  W: "West",
  NE: "North-East",
  NW: "North-West",
  N: "North",
};

/**
 * Yield factor multiplier (1.0 = optimal).
 * For Indian latitudes, optimal tilt ≈ latitude (15-25°), south-facing.
 *
 * Approximation matrix from PVGIS lookups for India tilt/azimuth combinations.
 * Returns a multiplier 0.55–1.00 applied to the flat-roof annual yield.
 */
export function calcTiltAzimuthFactor(tiltDeg: number, az: Azimuth): number {
  const t = Math.max(0, Math.min(60, tiltDeg));

  // Azimuth penalty (fraction of south-facing yield at any tilt)
  const azPenalty: Record<Azimuth, number> = {
    S: 1.00,
    SE: 0.97, SW: 0.97,
    E:  0.88, W:  0.88,
    NE: 0.78, NW: 0.78,
    N:  0.62,
  };

  // Tilt curve — peaks ~20° in India, falls off either side
  // 0° (flat): 0.92, 15°: 0.99, 20°: 1.00, 30°: 0.98, 45°: 0.92, 60°: 0.80
  let tiltFactor: number;
  if (t < 15)      tiltFactor = 0.92 + (0.99 - 0.92) * (t / 15);
  else if (t < 20) tiltFactor = 0.99 + (1.00 - 0.99) * ((t - 15) / 5);
  else if (t < 30) tiltFactor = 1.00 - (1.00 - 0.98) * ((t - 20) / 10);
  else if (t < 45) tiltFactor = 0.98 - (0.98 - 0.92) * ((t - 30) / 15);
  else             tiltFactor = 0.92 - (0.92 - 0.80) * ((t - 45) / 15);

  // North-facing roofs lose more steeply with tilt (sun never crosses north zenith
  // in India), so apply extra tilt penalty
  if (az === "N" && t > 10) {
    tiltFactor *= 1 - (t - 10) * 0.012;
  }

  return Math.round(tiltFactor * azPenalty[az] * 1000) / 1000;
}

/** Produce a one-line plain-English summary for the user */
export function describeTiltAzimuth(tilt: number, az: Azimuth, factor: number): string {
  const dir = AZIMUTH_LABELS[az];
  const pct = Math.round(factor * 100);
  if (factor >= 0.98) return `${dir}-facing at ${tilt}° tilt — near-optimal (${pct}% of ideal yield)`;
  if (factor >= 0.90) return `${dir}-facing at ${tilt}° tilt — good (${pct}% of ideal yield)`;
  if (factor >= 0.80) return `${dir}-facing at ${tilt}° tilt — acceptable (${pct}% of ideal yield)`;
  return `${dir}-facing at ${tilt}° tilt — sub-optimal (${pct}% of ideal yield)`;
}
