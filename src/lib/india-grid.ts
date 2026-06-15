// Regional Peak Sun Hours (PSH) fallback lookup table for India
// Used when NASA POWER API is unavailable.
// Keyed by approximate lat/lng bounding boxes.
// Source: MNRE Solar Radiation Handbook + ISRO data

interface RegionPSH {
  name: string;
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
  psh: number; // peak sun hours (kWh/m²/day)
}

export const INDIA_REGIONAL_PSH: RegionPSH[] = [
  // Rajasthan — highest irradiance
  { name: "Rajasthan", latMin: 23.5, latMax: 30.2, lngMin: 69.5, lngMax: 78.2, psh: 5.8 },
  // Gujarat
  { name: "Gujarat", latMin: 20.1, latMax: 24.7, lngMin: 68.2, lngMax: 74.5, psh: 5.6 },
  // Maharashtra
  { name: "Maharashtra", latMin: 15.6, latMax: 22.0, lngMin: 72.6, lngMax: 80.9, psh: 5.2 },
  // Madhya Pradesh
  { name: "Madhya Pradesh", latMin: 21.0, latMax: 26.9, lngMin: 74.0, lngMax: 82.8, psh: 5.3 },
  // Karnataka
  { name: "Karnataka", latMin: 11.6, latMax: 18.5, lngMin: 74.0, lngMax: 78.6, psh: 5.4 },
  // Tamil Nadu
  { name: "Tamil Nadu", latMin: 8.0, latMax: 13.5, lngMin: 76.2, lngMax: 80.4, psh: 5.1 },
  // Andhra Pradesh / Telangana
  { name: "Andhra Pradesh", latMin: 12.5, latMax: 19.9, lngMin: 77.0, lngMax: 84.8, psh: 5.3 },
  // Uttar Pradesh
  { name: "Uttar Pradesh", latMin: 23.5, latMax: 30.4, lngMin: 77.1, lngMax: 84.6, psh: 4.8 },
  // Bihar
  { name: "Bihar", latMin: 24.3, latMax: 27.5, lngMin: 83.3, lngMax: 88.2, psh: 4.6 },
  // West Bengal
  { name: "West Bengal", latMin: 21.5, latMax: 27.2, lngMin: 86.0, lngMax: 89.9, psh: 4.4 },
  // Odisha
  { name: "Odisha", latMin: 17.8, latMax: 22.6, lngMin: 81.3, lngMax: 87.5, psh: 4.8 },
  // Punjab / Haryana
  { name: "Punjab-Haryana", latMin: 27.5, latMax: 32.5, lngMin: 73.8, lngMax: 77.6, psh: 5.0 },
  // Kerala
  { name: "Kerala", latMin: 8.2, latMax: 12.8, lngMin: 74.8, lngMax: 77.4, psh: 4.6 },
  // Chhattisgarh
  { name: "Chhattisgarh", latMin: 17.8, latMax: 24.1, lngMin: 80.2, lngMax: 84.4, psh: 4.9 },
  // Jharkhand
  { name: "Jharkhand", latMin: 21.9, latMax: 25.3, lngMin: 83.3, lngMax: 87.9, psh: 4.6 },
  // Assam / NE
  { name: "Northeast", latMin: 22.0, latMax: 29.5, lngMin: 88.0, lngMax: 97.4, psh: 3.8 },
  // J&K / Ladakh
  { name: "Jammu & Kashmir", latMin: 32.2, latMax: 37.1, lngMin: 73.2, lngMax: 80.3, psh: 5.5 },
  // HP / Uttarakhand
  { name: "Himalayan", latMin: 28.7, latMax: 33.0, lngMin: 75.5, lngMax: 81.0, psh: 4.8 },
  // Goa
  { name: "Goa", latMin: 14.8, latMax: 15.8, lngMin: 73.6, lngMax: 74.3, psh: 5.1 },
];

// India-wide average fallback
export const INDIA_AVERAGE_PSH = 4.5;

export function getRegionalPSH(lat: number, lng: number): { psh: number; region: string } {
  for (const region of INDIA_REGIONAL_PSH) {
    if (
      lat >= region.latMin &&
      lat <= region.latMax &&
      lng >= region.lngMin &&
      lng <= region.lngMax
    ) {
      return { psh: region.psh, region: region.name };
    }
  }
  return { psh: INDIA_AVERAGE_PSH, region: "India (National Average)" };
}

// SCN-016: DISCOM tariff lookup table (reviewed June 2025)
const DISCOM_TARIFFS: Record<string, { discom: string; defaultTariff: number }> = {
  'delhi': { discom: 'BSES / Tata Power Delhi', defaultTariff: 8.0 },
  'maharashtra': { discom: 'MSEDCL', defaultTariff: 7.5 },
  'karnataka': { discom: 'BESCOM', defaultTariff: 7.0 },
  'tamil nadu': { discom: 'TNEB', defaultTariff: 6.5 },
  'gujarat': { discom: 'DGVCL/MGVCL', defaultTariff: 5.5 },
  'rajasthan': { discom: 'JVVNL/AVVNL', defaultTariff: 7.0 },
  'uttar pradesh': { discom: 'DVVNL/PuVVNL', defaultTariff: 6.5 },
  'west bengal': { discom: 'WBSEDCL / CESC', defaultTariff: 7.5 },
  'telangana': { discom: 'TSSPDCL/TSNPDCL', defaultTariff: 6.8 },
  'andhra pradesh': { discom: 'APEPDCL/APSPDCL', defaultTariff: 6.5 },
};

/**
 * Returns the default DISCOM tariff for a given Indian state.
 * Performs lookup by lowercase state name.
 */
export function getDiscomTariff(state: string): { discom: string; defaultTariff: number } | null {
  if (!state) return null;
  const key = state.toLowerCase().trim();
  return DISCOM_TARIFFS[key] ?? null;
}

