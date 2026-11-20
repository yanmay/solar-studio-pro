// NASA POWER API client for solar irradiance data
// Fetches solar data from the server-side API proxy.

import { getRegionalPSH } from "./india-grid";
import { captureApiError } from "./sentry";

export interface NASAPowerResponse {
  properties: {
    parameter: {
      ALLSKY_SFC_SW_DWN: Record<string, number>;
      WS10M?: Record<string, number>;
      WS50M?: Record<string, number>;
      T2M?: Record<string, number>;
    };
  };
}

export interface IrradianceResult {
  peakSunHours: number;
  source: "NASA_POWER" | "REGIONAL_FALLBACK";
  region?: string;
  monthlyValues?: Record<string, number>;
  ws10m?: number;
  ws50m?: number;
  t2m?: number;
  t2m_monthly?: number[];
}

export interface MonthlyGHIResult {
  monthly_ghi: number[];
  lat: number;
  lng: number;
  year: number;
  ws10m?: number;
  ws50m?: number;
  t2m?: number;
  t2m_monthly?: number[];
}

// In-memory cache: key → { data, timestamp }
const cache = new Map<string, { data: IrradianceResult; timestamp: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(2)}_${lng.toFixed(2)}`;
}

/**
 * Fetch solar data from the Vercel Edge proxy.
 * Throws a descriptive Error if the response is not ok.
 */
export async function fetchSolarData(lat: number, lng: number): Promise<MonthlyGHIResult> {
  const response = await fetch(`/api/solar-data?lat=${lat}&lng=${lng}`);
  
  if (!response.ok) {
    let errorDetails = "";
    try {
      const errData = await response.json();
      errorDetails = errData.details || errData.error || "";
    } catch {
      // Ignore fallback if response body is not JSON
    }
    
    const message = errorDetails
      ? `Failed to fetch solar data: ${response.status} ${response.statusText || ""} (${errorDetails})`.trim()
      : `Failed to fetch solar data: ${response.status} ${response.statusText || ""}`.trim();
    
    throw new Error(message);
  }
  
  return response.json();
}

// Month keys matching NASA POWER API response order (annual avg is keyed "ANN")
const MONTH_KEYS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/**
 * Adapter: fetches solar irradiance via the Edge proxy and converts the
 * monthly GHI array into the IrradianceResult shape consumed by MapPage.
 */
export async function fetchSolarIrradiance(lat: number, lng: number): Promise<IrradianceResult> {
  const key = cacheKey(lat, lng);

  // Check cache
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const data = await fetchSolarData(lat, lng);
    const monthlyGhi = data.monthly_ghi;

    // Convert flat array [Jan..Dec] to keyed record
    const monthlyValues: Record<string, number> = {};
    MONTH_KEYS.forEach((k, i) => {
      monthlyValues[k] = monthlyGhi[i] ?? 0;
    });

    // Annual average = mean of the 12 monthly values
    const validValues = monthlyGhi.filter((v) => v > 0);
    const peakSunHours =
      validValues.length > 0
        ? validValues.reduce((sum, v) => sum + v, 0) / validValues.length
        : 4.5; // regional fallback

    const result: IrradianceResult = {
      peakSunHours: Math.round(peakSunHours * 100) / 100,
      source: "NASA_POWER",
      monthlyValues,
      ws10m: data.ws10m,
      ws50m: data.ws50m,
      t2m: data.t2m,
      t2m_monthly: data.t2m_monthly,
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
      ws10m: 3.0,
      ws50m: 4.5,
      t2m: 26.5,
      t2m_monthly: [22, 24, 28, 31, 33, 31, 28.5, 28, 28.5, 27.5, 25, 22],
    };

    cache.set(key, { data: result, timestamp: Date.now() });
    return result;
  }
}
