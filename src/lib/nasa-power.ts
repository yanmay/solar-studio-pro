// NASA POWER API client for solar irradiance data
// Fetches ALLSKY_SFC_SW_DWN (average daily solar irradiance in kWh/m²/day)
// with 24-hour caching and regional fallback.

import { getRegionalPSH } from "./india-grid";
import { captureApiError } from "./sentry";

interface NASAPowerResponse {
  properties: {
    parameter: {
      ALLSKY_SFC_SW_DWN: Record<string, number>;
    };
  };
}

interface IrradianceResult {
  peakSunHours: number;
  source: "NASA_POWER" | "REGIONAL_FALLBACK";
  region?: string;
  monthlyValues?: Record<string, number>;
}

// In-memory cache: key → { data, timestamp }
const cache = new Map<string, { data: IrradianceResult; timestamp: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(2)}_${lng.toFixed(2)}`;
}

/**
 * Fetch solar irradiance from NASA POWER API.
 * Returns peak sun hours (kWh/m²/day annual average).
 * 
 * On failure: falls back to regional PSH lookup table.
 * Caches result for 24 hours per coordinate pair.
 */
export async function fetchSolarIrradiance(
  lat: number,
  lng: number
): Promise<IrradianceResult> {
  const key = cacheKey(lat, lng);

  // Check cache
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    // 5-second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const url = `https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=ALLSKY_SFC_SW_DWN&community=RE&longitude=${lng.toFixed(4)}&latitude=${lat.toFixed(4)}&format=JSON`;

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`NASA POWER API returned ${response.status}`);
    }

    const data: NASAPowerResponse = await response.json();
    const monthly = data.properties.parameter.ALLSKY_SFC_SW_DWN;

    // ANN = annual average
    const annualAvg = monthly["ANN"];
    if (typeof annualAvg !== "number" || annualAvg <= 0) {
      throw new Error("Invalid annual average from NASA POWER");
    }

    // Monthly values for chart (Jan=1 .. Dec=12)
    const monthlyValues: Record<string, number> = {};
    const monthKeys = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    for (const mk of monthKeys) {
      if (typeof monthly[mk] === "number") {
        monthlyValues[mk] = monthly[mk];
      }
    }

    const result: IrradianceResult = {
      peakSunHours: Math.round(annualAvg * 100) / 100,
      source: "NASA_POWER",
      monthlyValues,
    };

    cache.set(key, { data: result, timestamp: Date.now() });
    return result;
  } catch (error) {
    console.error("[nasa-power] API failed, using regional fallback:", error);
    captureApiError("nasa-power", error, { lat, lng });

    // Fallback to regional lookup
    const { psh, region } = getRegionalPSH(lat, lng);
    const result: IrradianceResult = {
      peakSunHours: psh,
      source: "REGIONAL_FALLBACK",
      region,
    };

    cache.set(key, { data: result, timestamp: Date.now() });
    return result;
  }
}
