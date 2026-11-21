// ─────────────────────────────────────────────────────────────────────────
// Google Solar API — buildingInsights:findClosest client (feature-flagged).
//
// Provides LIVE roof geometry (pitch / azimuth), annual sunshine (→ peak sun
// hours) and a bounded shading proxy that OVERRIDE the NASA POWER / regional
// estimates when Google returns coverage for a location.
//
// Coverage is limited. Notably Google Solar does NOT cover India as of this
// writing (see GOOGLE_SOLAR_AUDIT.md) — the primary market for this tool — so
// this integration is gated behind GOOGLE_SOLAR_API_KEY and every failure mode
// (flag unset, no coverage / 404, transport error, malformed payload) resolves
// to `null`. The caller then falls back to NASA POWER. This client NEVER throws.
//
// Google does NOT supply wind or ambient-temperature data, so it augments —
// never replaces — the NASA payload: the caller keeps NASA's wind/temp/monthly
// profile and lets Google's PSH + geometry + shading take precedence.
// ─────────────────────────────────────────────────────────────────────────

const GOOGLE_SOLAR_ENDPOINT =
  "https://solar.googleapis.com/v1/buildingInsights:findClosest";

const DAYS_PER_YEAR = 365;

// Physical sanity bounds for peak sun hours (kWh/m²/day equivalent). Anything
// outside this range signals a bad payload and is discarded rather than fed
// into the financial model.
const MIN_PEAK_SUN_HOURS = 2.0;
const MAX_PEAK_SUN_HOURS = 8.0;

// Shading-loss proxy is clamped to the same ceiling as the discrete "heavy"
// bucket in solar-calc.ts (SHADING_LOSS.heavy = 0.30) so a derived value can
// never exceed what the hand-set levels allow.
const MAX_SHADING_LOSS = 0.3;

/** Normalized, model-ready insight derived from a Google Solar building. */
export interface GoogleSolarInsights {
  source: "GOOGLE_SOLAR";
  /** maxSunshineHoursPerYear / 365, clamped to a physical range. */
  peakSunHours: number;
  /** Area-weighted mean roof pitch in degrees, if roof segments are present. */
  pitchDegrees?: number;
  /** Area-weighted circular-mean roof azimuth in degrees (0–360), if present. */
  azimuthDegrees?: number;
  /** Bounded [0, 0.30] shading-loss proxy from the roof sunshine distribution. */
  shadingLoss?: number;
  /** Raw annual sunshine figure, retained for provenance / debugging. */
  maxSunshineHoursPerYear: number;
}

// Minimal shape of the fields we consume from the buildingInsights response.
interface RoofSegmentStat {
  pitchDegrees?: number;
  azimuthDegrees?: number;
  stats?: { areaMeters2?: number; sunshineQuantiles?: number[] };
}
interface SolarPotential {
  maxSunshineHoursPerYear?: number;
  wholeRoofStats?: { areaMeters2?: number; sunshineQuantiles?: number[] };
  roofSegmentStats?: RoofSegmentStat[];
}
interface BuildingInsightsResponse {
  solarPotential?: SolarPotential;
}

/** True when the Google Solar integration is switched on for this environment. */
export function isGoogleSolarEnabled(): boolean {
  return !!process.env.GOOGLE_SOLAR_API_KEY;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Area-weighted mean roof pitch. Pitch is bounded 0–90° with no wraparound, so
 * a plain weighted arithmetic mean is correct. Returns undefined when no
 * segment carries a usable pitch.
 */
function areaWeightedPitch(segments: RoofSegmentStat[]): number | undefined {
  let weightedSum = 0;
  let weight = 0;
  for (const seg of segments) {
    const pitch = seg.pitchDegrees;
    const area = seg.stats?.areaMeters2;
    if (typeof pitch !== "number" || !Number.isFinite(pitch)) continue;
    const w = typeof area === "number" && area > 0 ? area : 1;
    weightedSum += pitch * w;
    weight += w;
  }
  if (weight === 0) return undefined;
  return Math.round((weightedSum / weight) * 10) / 10;
}

/**
 * Area-weighted circular mean roof azimuth. Azimuth wraps at 360°, so a naive
 * arithmetic mean of e.g. 350° and 10° would give 180° (opposite of the truth);
 * the sin/cos vector mean handles the wraparound. Returns undefined when no
 * segment carries a usable azimuth.
 */
function areaWeightedAzimuth(segments: RoofSegmentStat[]): number | undefined {
  let sumSin = 0;
  let sumCos = 0;
  let weight = 0;
  for (const seg of segments) {
    const az = seg.azimuthDegrees;
    const area = seg.stats?.areaMeters2;
    if (typeof az !== "number" || !Number.isFinite(az)) continue;
    const w = typeof area === "number" && area > 0 ? area : 1;
    const rad = (az * Math.PI) / 180;
    sumSin += Math.sin(rad) * w;
    sumCos += Math.cos(rad) * w;
    weight += w;
  }
  if (weight === 0 || (sumSin === 0 && sumCos === 0)) return undefined;
  let deg = (Math.atan2(sumSin, sumCos) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return Math.round(deg * 10) / 10;
}

/**
 * Bounded shading-loss proxy from the roof's sunshine distribution.
 * `sunshineQuantiles` is an ascending list of annual sunshine hours across the
 * roof (min → max). We treat the sunniest quantile as the unshaded reference
 * and express the median's shortfall against it as fractional loss, clamped to
 * [0, MAX_SHADING_LOSS]. Returns undefined when the distribution is unusable.
 */
function shadingLossFromQuantiles(quantiles?: number[]): number | undefined {
  if (!Array.isArray(quantiles) || quantiles.length < 3) return undefined;
  const max = quantiles[quantiles.length - 1];
  const median = quantiles[Math.floor(quantiles.length / 2)];
  if (typeof max !== "number" || typeof median !== "number" || max <= 0) {
    return undefined;
  }
  const loss = 1 - median / max;
  if (!Number.isFinite(loss) || loss <= 0) return 0;
  return Math.round(clamp(loss, 0, MAX_SHADING_LOSS) * 1000) / 1000;
}

/**
 * Fetch and normalize Google Solar building insights for a coordinate.
 *
 * Resolves to `null` — never throws — for every non-success outcome so the
 * caller can transparently fall back to NASA POWER:
 *   • GOOGLE_SOLAR_API_KEY unset (feature flag off)
 *   • HTTP 404 (no coverage for the location) or any non-2xx status
 *   • network / transport failure
 *   • missing `solarPotential` or an unusable `maxSunshineHoursPerYear`
 */
export async function fetchGoogleSolarInsights(
  lat: number,
  lng: number,
): Promise<GoogleSolarInsights | null> {
  const apiKey = process.env.GOOGLE_SOLAR_API_KEY;
  if (!apiKey) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const url =
    `${GOOGLE_SOLAR_ENDPOINT}?location.latitude=${lat.toFixed(6)}` +
    `&location.longitude=${lng.toFixed(6)}` +
    `&requiredQuality=LOW&key=${encodeURIComponent(apiKey)}`;

  let response: Response;
  try {
    response = await fetch(url, { headers: { Accept: "application/json" } });
  } catch {
    // Transport failure (DNS, timeout, offline) → fall back to NASA POWER.
    return null;
  }

  // 404 = no Google Solar coverage for this location (expected in India);
  // any other non-2xx is an upstream/auth error. Both fall back silently.
  if (!response.ok) return null;

  let body: BuildingInsightsResponse;
  try {
    body = (await response.json()) as BuildingInsightsResponse;
  } catch {
    return null;
  }

  const potential = body?.solarPotential;
  const maxSunshine = potential?.maxSunshineHoursPerYear;
  if (
    !potential ||
    typeof maxSunshine !== "number" ||
    !Number.isFinite(maxSunshine) ||
    maxSunshine <= 0
  ) {
    return null;
  }

  const rawPsh = maxSunshine / DAYS_PER_YEAR;
  const peakSunHours =
    Math.round(clamp(rawPsh, MIN_PEAK_SUN_HOURS, MAX_PEAK_SUN_HOURS) * 100) / 100;

  const segments = Array.isArray(potential.roofSegmentStats)
    ? potential.roofSegmentStats
    : [];

  return {
    source: "GOOGLE_SOLAR",
    peakSunHours,
    pitchDegrees: areaWeightedPitch(segments),
    azimuthDegrees: areaWeightedAzimuth(segments),
    shadingLoss: shadingLossFromQuantiles(potential.wholeRoofStats?.sunshineQuantiles),
    maxSunshineHoursPerYear: maxSunshine,
  };
}

/** Fields appended to a NASA payload when Google Solar coverage is applied. */
export interface GoogleSolarAugmentation {
  source: "GOOGLE_SOLAR";
  google_psh: number;
  pitch_degrees?: number;
  azimuth_degrees?: number;
  shading_loss?: number;
}

/**
 * Augment a NASA POWER payload with Google Solar overrides when the feature is
 * enabled AND Google returns coverage. Otherwise the payload is returned
 * unchanged, so with the flag off the response is byte-identical to before.
 *
 * NASA's wind/temp/monthly fields are preserved; only the headline irradiance,
 * geometry and shading are overridden, tagged with `source: "GOOGLE_SOLAR"`.
 */
export async function augmentPayloadWithGoogleSolar<T extends Record<string, unknown>>(
  payload: T,
  lat: number,
  lng: number,
): Promise<T & Partial<GoogleSolarAugmentation>> {
  if (!isGoogleSolarEnabled()) return payload;

  let insights: GoogleSolarInsights | null;
  try {
    insights = await fetchGoogleSolarInsights(lat, lng);
  } catch {
    // Defense in depth: fetchGoogleSolarInsights already swallows its errors.
    return payload;
  }
  if (!insights) return payload;

  return {
    ...payload,
    source: "GOOGLE_SOLAR",
    google_psh: insights.peakSunHours,
    pitch_degrees: insights.pitchDegrees,
    azimuth_degrees: insights.azimuthDegrees,
    shading_loss: insights.shadingLoss,
  };
}
