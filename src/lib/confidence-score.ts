export interface ScanState {
  source?: 'manual' | 'osm' | 'photo' | 'none';
  pitchDegrees?: number;
  isExplicitlyFlat?: boolean;
  computedShadingLoss?: number | null;
  exclusionAreaM2?: number;
  isRegionalFallback?: boolean;
  pvlibAvailable?: boolean;
  allExclusionZonesDrawn?: boolean;
}

export function calcConfidenceScore(scan: ScanState): number {
  // Base score by footprint source
  const source = scan.source || 'none';
  let score = 0.40;
  if (source === 'manual') score = 0.92;
  else if (source === 'osm') score = 0.75;
  else if (source === 'photo') score = 0.55;

  // Deductions
  // pitchDegrees === 0 and roof is not explicitly confirmed flat
  const pitch = scan.pitchDegrees ?? 0;
  if (pitch === 0 && !scan.isExplicitlyFlat) {
    score -= 0.03;
  }

  // computedShadingLoss is null (manual shading used)
  if (scan.computedShadingLoss === null || scan.computedShadingLoss === undefined) {
    score -= 0.05;
  }

  // exclusionAreaM2 === 0 (no obstructions marked)
  if ((scan.exclusionAreaM2 ?? 0) === 0) {
    score -= 0.04;
  }

  // NASA POWER used regional fallback table instead of live API
  if (scan.isRegionalFallback) {
    score -= 0.06;
  }

  // Bonuses
  // pvlib engine result available
  if (scan.pvlibAvailable) {
    score += 0.05;
  }

  // All exclusion zones drawn
  if (scan.allExclusionZonesDrawn) {
    score += 0.02;
  }

  // Clamp result to [0.30, 0.97]
  return Math.max(0.30, Math.min(0.97, score));
}
