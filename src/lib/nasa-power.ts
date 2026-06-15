// NASA POWER API client for solar irradiance data
// Fetches solar data from the server-side API proxy.

export interface NASAPowerResponse {
  properties: {
    parameter: {
      ALLSKY_SFC_SW_DWN: Record<string, number>;
    };
  };
}

export interface IrradianceResult {
  peakSunHours: number;
  source: "NASA_POWER" | "REGIONAL_FALLBACK";
  region?: string;
  monthlyValues?: Record<string, number>;
}

export interface MonthlyGHIResult {
  monthly_ghi: number[];
  lat: number;
  lng: number;
  year: number;
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
  try {
    const data = await fetchSolarData(lat, lng);
    const monthlyGhi = data.monthly_ghi;

    // Convert flat array [Jan..Dec] to keyed record
    const monthlyValues: Record<string, number> = {};
    MONTH_KEYS.forEach((key, i) => {
      monthlyValues[key] = monthlyGhi[i] ?? 0;
    });

    // Annual average = mean of the 12 monthly values
    const validValues = monthlyGhi.filter((v) => v > 0);
    const peakSunHours =
      validValues.length > 0
        ? validValues.reduce((sum, v) => sum + v, 0) / validValues.length
        : 4.5; // regional fallback

    return {
      peakSunHours: Math.round(peakSunHours * 100) / 100,
      source: "NASA_POWER",
      monthlyValues,
    };
  } catch {
    // Graceful fallback if the Edge proxy is unavailable (local dev without vercel dev)
    return {
      peakSunHours: 4.5,
      source: "REGIONAL_FALLBACK",
      region: "India average",
    };
  }
}
