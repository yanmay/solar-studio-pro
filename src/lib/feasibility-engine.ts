import { getRegionalPSH } from "./india-grid";
import { 
  calcSubsidyInr, 
  ELECTRICITY_RATE_INR,
  PANEL_AREA_PER_KW, 
  SYSTEM_LOSSES, 
  SYSTEM_LIFETIME_YRS,
  SYSTEM_COST_PER_KW_INR_TIERS 
} from "./solar-defaults";
import { 
  calculateWindZoneDetails, 
  calculateAltitudeAdjustment, 
  calculateTemperatureCoefficientLoss 
} from "./accuracy-modules";
import { detectBuildingAt, nearbyBuildings } from "./osm-buildings";
import { getDiscomTariff } from "./india-grid";
import { calcStateBoosterInr } from "./state-subsidies";
import { createClient } from "@supabase/supabase-js";

// Database state & Mocking hooks
export let supabase: any = null;

export function setMockSupabaseClient(client: any) {
  supabase = client;
}

// Skip real-client init under tests so the injected mock client is always used.
if (typeof process !== "undefined" && process.env.NODE_ENV !== "test") {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabase && supabaseUrl && supabaseKey && supabaseUrl !== "https://your-project.supabase.co") {
    try {
      supabase = createClient(supabaseUrl, supabaseKey);
    } catch (e) {
      console.warn("Failed to initialize supabase client in feasibility-engine.ts:", e);
    }
  }
}

// ==========================================
// CONFIGURATION MODULE
// ==========================================

export interface FeasibilityConfig {
  defaultObstructionMargin: number; // e.g. 0.10 (10% deduction for walkways, structures)
  maxAltitudeIrrBonusPct: number;    // e.g. 5% max altitude bonus
  maxWindCoolingBonusPct: number;   // e.g. 3% max wind cooling bonus
  defaultStoreyHeightM: number;     // e.g. 3.0 meters per storey
  shadowLengthDefaultM: number;     // e.g. 8.0 meters fallback shadow length
  sunElevationDefaultDeg: number;   // e.g. 45.0 degrees fallback sun elevation
  slopeSampleSpacingDeg: number;    // e.g. 0.0001 degrees (~11m)
  electricityRateInr: number;       // national fallback tariff
  googleSolarApiUrl: string;
  openMeteoElevationUrl: string;
  defaultShadingLossNoBuildings: number; // e.g. 0.05 (5% flat default)
}

export const FEASIBILITY_CONFIG: FeasibilityConfig = {
  defaultObstructionMargin: 0.10, // 10% safety margin for structures/walkways
  maxAltitudeIrrBonusPct: 5.0,    // 5% max altitude bonus capping
  maxWindCoolingBonusPct: 3.0,   // 3% max wind cooling bonus capping
  defaultStoreyHeightM: 3.0,     // 3 meters per level
  shadowLengthDefaultM: 8.0,     // Default building shadow length modeled in satellite analysis
  sunElevationDefaultDeg: 45.0,   // Default sun elevation at imagery time
  slopeSampleSpacingDeg: 0.0001,  // ~11 meters: enough to dampen elevation noise without smoothing whole roofs
  electricityRateInr: ELECTRICITY_RATE_INR,
  googleSolarApiUrl: "https://solar.googleapis.com/v1/buildingInsights:findClosest",
  openMeteoElevationUrl: "https://api.open-meteo.com/v1/elevation",
  defaultShadingLossNoBuildings: 0.05,
};

// ==========================================
// CUSTOM ENUMS & INTERFACES FOR OUTPUTS
// ==========================================

export type ConfidenceLevel = "High" | "Medium" | "Low";

export interface ProviderResult<T> {
  value: T;
  confidence: ConfidenceLevel;
  source: string;
  isModeled: boolean;
  heightInferred?: boolean;
}

export interface FeasibilityReport {
  coordinates: { lat: number; lng: number };
  usableRoofArea: ProviderResult<number>;
  systemSizeKwp: ProviderResult<number>;
  annualYieldKwh: ProviderResult<number>;
  optimalTiltDeg: ProviderResult<number>;
  optimalAzimuth: ProviderResult<string>;
  multipliers: {
    shadingLoss: ProviderResult<number>;
    windCoolingBonus: ProviderResult<number>;
    altitudeIrrBonus: ProviderResult<number>;
    temperatureLoss: ProviderResult<number>;
  };
  financials: {
    capexCostInr: ProviderResult<number>;
    netCostInr: ProviderResult<number>;
    subsidyInr: ProviderResult<number>;
    centralSubsidyInr: number;
    stateBoosterInr: number;
    stateSubsidyScheme: string | null;
    stateSubsidyVerified: string | null;
    electricityRateInr: ProviderResult<number>;
    tariffSource: "state_tariff" | "national_fallback";
    tariffState: string;
    paybackYears: ProviderResult<number>;
    roiPercent25yr: ProviderResult<number>;
  };
  windZone: ProviderResult<string>;
  windZoneLabel: string;
  highWindWarning: boolean;
  elevationM: ProviderResult<number>;
  storeyCountEstimate: ProviderResult<number>;
  onSiteVerificationChecklist: {
    factor: string;
    description: string;
    verificationStep: string;
  }[];
  sourcesUsed: string[];
  overallConfidence: ConfidenceLevel;
  generatedAt: string;
  analysisId?: string;
}

// ==========================================
// SWAPPABLE INTERFACES (PLUGGABLE MODULES)
// ==========================================

export interface IElevationSlopeProvider {
  getElevationAndSlope(lat: number, lng: number, apiKey?: string): Promise<{
    elevationM: number;
    slopeDeg: number;
    source: string;
    confidence: ConfidenceLevel;
  }>;
}

export interface IRoofGeometryProvider {
  getRoofGeometry(lat: number, lng: number, apiKey?: string): Promise<{
    areaM2: number;
    polygon: { lat: number; lng: number }[];
    tiltDeg?: number;
    azimuth?: string;
    source: string;
    confidence: ConfidenceLevel;
  }>;
}

export interface IShadingProvider {
  getShading(
    lat: number,
    lng: number,
    apiKey?: string,
    roofGeometry?: any
  ): Promise<{
    shadingLossPct: number;
    source: string;
    confidence: ConfidenceLevel;
    heightInferred?: boolean;
  }>;
}

export interface IWeatherProvider {
  getWeather(lat: number, lng: number): Promise<{
    monthlyGhi: number[];
    monthlyWind10m: number[];
    monthlyWind50m: number[];
    monthlyTemp: number[];
    elevationM: number;
    source: string;
    confidence: ConfidenceLevel;
  }>;
}

// ==========================================
// PROVIDER IMPLEMENTATIONS
// ==========================================

/**
 * 1. Weather Provider using NASA POWER Edge API / Regional Fallback
 */
export class WeatherProvider implements IWeatherProvider {
  async getWeather(lat: number, lng: number): Promise<{
    monthlyGhi: number[];
    monthlyWind10m: number[];
    monthlyWind50m: number[];
    monthlyTemp: number[];
    elevationM: number;
    source: string;
    confidence: ConfidenceLevel;
  }> {
    try {
      // Calls local proxy or Vercel Serverless `/api/solar-data`
      // For backend compatibility, check if running in serverless env or fetch.
      // We will construct the API URL. Note: in tests/local we fetch from localhost or mock.
      const baseUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:8080";
      const res = await fetch(`${baseUrl}/api/solar-data?lat=${lat}&lng=${lng}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      
      if (data && data.monthly_ghi && data.monthly_wind_speed_10m && data.monthly_temperature) {
        return {
          monthlyGhi: data.monthly_ghi,
          monthlyWind10m: data.monthly_wind_speed_10m,
          monthlyWind50m: data.monthly_wind_speed_50m || data.monthly_wind_speed_10m.map((w: number) => w * 1.3),
          monthlyTemp: data.monthly_temperature,
          elevationM: data.elevation_m || 0.0,
          source: "NASA POWER Climatology",
          confidence: "High"
        };
      }
      throw new Error("Missing variables in API response");
    } catch (err) {
      console.warn("[WeatherProvider] Falling back to Regional Lookup:", err);
      // Fallback
      const reg = getRegionalPSH(lat, lng);
      // Construct approximate months
      const fallbackGhi = Array(12).fill(reg.psh);
      const fallbackWind = Array(12).fill(3.0); // India average wind speed
      const fallbackWind50 = Array(12).fill(4.0);
      const fallbackTemp = Array(12).fill(27.0); // India average temperature
      return {
        monthlyGhi: fallbackGhi,
        monthlyWind10m: fallbackWind,
        monthlyWind50m: fallbackWind50,
        monthlyTemp: fallbackTemp,
        elevationM: 0.0,
        source: `Regional Fallback Database (${reg.region})`,
        confidence: "Low"
      };
    }
  }
}

/**
 * 2. Elevation / Slope Provider
 * Google Elevation API with Open-Meteo SRTM Elevation as a free swappable fallback.
 */
export class ElevationSlopeProvider implements IElevationSlopeProvider {
  async getElevationAndSlope(lat: number, lng: number, apiKey?: string): Promise<{
    elevationM: number;
    slopeDeg: number;
    source: string;
    confidence: ConfidenceLevel;
  }> {
    // 1. Try Google Elevation API if API key is provided
    if (apiKey && apiKey !== "your_google_geocoding_key_here") {
      try {
        // Fetch symmetric points around the target coordinates to derive terrain gradient.
        const spacing = FEASIBILITY_CONFIG.slopeSampleSpacingDeg;
        const northLat = lat + spacing;
        const southLat = lat - spacing;
        const eastLng = lng + spacing;
        const westLng = lng - spacing;
        const url = `https://maps.googleapis.com/maps/api/elevation/json?locations=${lat},${lng}|${northLat},${lng}|${southLat},${lng}|${lat},${eastLng}|${lat},${westLng}&key=${apiKey}`;
        
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data.status === "OK" && data.results && data.results.length >= 5) {
            const eCenter = data.results[0].elevation;
            const eNorth = data.results[1].elevation;
            const eSouth = data.results[2].elevation;
            const eEast = data.results[3].elevation;
            const eWest = data.results[4].elevation;

            const slope = this.calculateSlope(lat, eNorth, eSouth, eEast, eWest);
            return {
              elevationM: Math.round(eCenter * 10) / 10,
              slopeDeg: Math.round(slope * 10) / 10,
              source: "Google Elevation API",
              confidence: "High",
            };
          }
        }
      } catch (err) {
        console.warn("[ElevationSlopeProvider] Google API failed, trying Open-Meteo SRTM:", err);
      }
    }

    // 2. Open-Meteo SRTM free Elevation API fallback
    try {
      const spacing = FEASIBILITY_CONFIG.slopeSampleSpacingDeg;
      const northLat = lat + spacing;
      const southLat = lat - spacing;
      const eastLng = lng + spacing;
      const westLng = lng - spacing;
      const url = `${FEASIBILITY_CONFIG.openMeteoElevationUrl}?latitude=${lat},${northLat},${southLat},${lat},${lat}&longitude=${lng},${lng},${lng},${eastLng},${westLng}`;
      
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.elevation) && data.elevation.length >= 5) {
          const eCenter = data.elevation[0];
          const eNorth = data.elevation[1];
          const eSouth = data.elevation[2];
          const eEast = data.elevation[3];
          const eWest = data.elevation[4];

          const slope = this.calculateSlope(lat, eNorth, eSouth, eEast, eWest);
          return {
            elevationM: Math.round(eCenter * 10) / 10,
            slopeDeg: Math.round(slope * 10) / 10,
            source: "Open-Meteo SRTM Elevation API",
            confidence: "Medium",
          };
        }
      }
    } catch (err) {
      console.warn("[ElevationSlopeProvider] Open-Meteo SRTM failed, using modeled fallback:", err);
    }

    // 3. Modeled Fallback
    return {
      elevationM: 150.0, // Default India sea-level elevation estimate
      slopeDeg: 15.0,    // Standard pitch
      source: "Elevation Modeled Fallback",
      confidence: "Low",
    };
  }

  private calculateSlope(lat: number, eNorth: number, eSouth: number, eEast: number, eWest: number): number {
    const latRad = (lat * Math.PI) / 180;
    const spacing = FEASIBILITY_CONFIG.slopeSampleSpacingDeg;
    const distN = spacing * 2 * 111320;
    const distE = spacing * 2 * 111320 * Math.cos(latRad);
    const slopeN = (eNorth - eSouth) / distN;
    const slopeE = (eEast - eWest) / distE;
    const slopeRad = Math.atan(Math.sqrt(slopeE * slopeE + slopeN * slopeN));
    return (slopeRad * 180) / Math.PI;
  }
}

/**
 * 3. Roof Geometry Provider
 * Google Solar API with OpenStreetMap Overpass (detectBuildingAt) fallback.
 */
export class RoofGeometryProvider implements IRoofGeometryProvider {
  async getRoofGeometry(lat: number, lng: number, apiKey?: string): Promise<{
    areaM2: number;
    polygon: { lat: number; lng: number }[];
    tiltDeg?: number;
    azimuth?: string;
    source: string;
    confidence: ConfidenceLevel;
  }> {
    // 1. Try Google Solar API
    if (apiKey && apiKey !== "your_google_geocoding_key_here") {
      try {
        const url = `${FEASIBILITY_CONFIG.googleSolarApiUrl}?location.latitude=${lat}&location.longitude=${lng}&requiredQuality=HIGH&key=${apiKey}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const pot = data.solarPotential;
          if (pot && pot.wholeRoofStats && pot.wholeRoofStats.areaMeters2 > 0) {
            const area = pot.wholeRoofStats.areaMeters2;
            const bbox = data.boundingBox;
            
            // Build a rough bounding box polygon representing the roof boundaries
            const polygon = bbox ? [
              { lat: bbox.sw.latitude, lng: bbox.sw.longitude },
              { lat: bbox.ne.latitude, lng: bbox.sw.longitude },
              { lat: bbox.ne.latitude, lng: bbox.ne.longitude },
              { lat: bbox.sw.latitude, lng: bbox.ne.longitude },
              { lat: bbox.sw.latitude, lng: bbox.sw.longitude }
            ] : [];

            // Check if there are segments to resolve tilt/azimuth
            let tilt = 15.0;
            let az = "S";
            if (pot.roofSegmentStats && pot.roofSegmentStats.length > 0) {
              const seg = pot.roofSegmentStats[0];
              tilt = seg.pitchDegrees || 15.0;
              const azDeg = seg.azimuthDegrees || 180.0;
              if (azDeg > 337.5 || azDeg <= 22.5) az = "N";
              else if (azDeg > 22.5 && azDeg <= 67.5) az = "NE";
              else if (azDeg > 67.5 && azDeg <= 112.5) az = "E";
              else if (azDeg > 112.5 && azDeg <= 157.5) az = "SE";
              else if (azDeg > 157.5 && azDeg <= 202.5) az = "S";
              else if (azDeg > 202.5 && azDeg <= 247.5) az = "SW";
              else if (azDeg > 247.5 && azDeg <= 292.5) az = "W";
              else az = "NW";
            }

            return {
              areaM2: Math.round(area * 10) / 10,
              polygon,
              tiltDeg: Math.round(tilt * 10) / 10,
              azimuth: az,
              source: "Google Solar API Building Insights",
              confidence: "High",
            };
          }
        }
      } catch (err) {
        console.warn("[RoofGeometryProvider] Google Solar API failed, trying OSM:", err);
      }
    }

    // 2. OpenStreetMap Overpass Fallback
    try {
      const osmResult = await detectBuildingAt(lat, lng, 35);
      if (osmResult && osmResult.polygon && osmResult.polygon.length >= 3) {
        // Calculate building area using the equirectangular approximation
        const area = this.approxAreaM2(osmResult.polygon);
        return {
          areaM2: Math.round(area * 10) / 10,
          polygon: osmResult.polygon,
          source: "OSM Overpass Building Footprint",
          confidence: "Medium",
        };
      }
    } catch (err) {
      console.warn("[RoofGeometryProvider] OSM Overpass failed, using modeled fallback:", err);
    }

    // 3. Fallback Modeled Area
    const defaultArea = 120.0; // standard medium residential roof
    const size = 0.0001; // approx 11m
    const polygon = [
      { lat: lat - size, lng: lng - size },
      { lat: lat + size, lng: lng - size },
      { lat: lat + size, lng: lng + size },
      { lat: lat - size, lng: lng + size },
      { lat: lat - size, lng: lng - size }
    ];
    return {
      areaM2: defaultArea,
      polygon,
      source: "Geometry Modeled Fallback",
      confidence: "Low",
    };
  }

  private approxAreaM2(poly: { lat: number; lng: number }[]): number {
    if (poly.length < 3) return 0;
    const lat0 = poly[0].lat * Math.PI / 180;
    const cosLat = Math.cos(lat0);
    let area = 0;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].lng * 111320 * cosLat;
      const yi = poly[i].lat * 110540;
      const xj = poly[j].lng * 111320 * cosLat;
      const yj = poly[j].lat * 110540;
      area += xj * yi - xi * yj;
    }
    return Math.abs(area / 2);
  }
}

/**
 * 4. Shading Provider
 * Google Solar API shading indexes with a modeled fallback using OSM building levels + distances.
 */
export class ShadingProvider implements IShadingProvider {
  async getShading(
    lat: number,
    lng: number,
    apiKey?: string,
    roofGeometry?: any
  ): Promise<{
    shadingLossPct: number;
    source: string;
    confidence: ConfidenceLevel;
    heightInferred?: boolean;
  }> {
    // 1. Google Solar API shading
    if (apiKey && apiKey !== "your_google_geocoding_key_here") {
      try {
        const url = `${FEASIBILITY_CONFIG.googleSolarApiUrl}?location.latitude=${lat}&location.longitude=${lng}&requiredQuality=HIGH&key=${apiKey}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const pot = data.solarPotential;
          if (pot && pot.wholeRoofStats) {
            // Sunshine quantiles contains 11 values from lowest to highest sunlight.
            // Shading loss can be computed as a penalty index compared to peak possible sunshine.
            const stats = pot.wholeRoofStats;
            const maxSunshine = pot.maxStats?.maxSunshineHoursPerYear || 1600.0;
            const medianSunshine = stats.sunshineQuantiles?.[5] || maxSunshine * 0.9;
            const shadingLoss = Math.max(0.0, 1.0 - (medianSunshine / maxSunshine));
            return {
              shadingLossPct: Math.round(shadingLoss * 1000) / 10,
              source: "Google Solar API Sunlight Quantiles",
              confidence: "High",
            };
          }
        }
      } catch (err) {
        console.warn("[ShadingProvider] Google Solar API failed, trying Modeled Shading:", err);
      }
    }

    // 2. Modeled Shading Fallback using nearby buildings
    try {
      const buildings = await nearbyBuildings(lat, lng, 50);
      if (buildings && buildings.length > 0) {
        let cumulativeLoss = 0.0;
        let heightInferred = false;
        buildings.forEach((b) => {
          if (b.levels == null) heightInferred = true;
          const levels = b.levels || 2;
          const height = levels * FEASIBILITY_CONFIG.defaultStoreyHeightM;
          const dist = b.distanceM || 10.0;
          
          // Calculate the obstruction angle to estimate shadows
          const obstructionAngleDeg = (Math.atan2(height, dist) * 180) / Math.PI;
          
          // Shading loss increases with larger building area, height, and closer distance.
          if (dist > 0) {
            const buildingAreaWeight = Math.min(1.0, b.areaM2 / 250);
            const shadingInfluence = Math.max(0, obstructionAngleDeg - 15) * 0.012 * buildingAreaWeight;
            // Shading decays with distance
            const distanceDecay = Math.exp(-dist / 25);
            cumulativeLoss += shadingInfluence * distanceDecay;
          }
        });
        
        const shadingLossPct = Math.min(35.0, cumulativeLoss * 100);
        return {
          shadingLossPct: Math.round(shadingLossPct * 10) / 10,
          source: "OSM Surface Obstructive Model",
          confidence: heightInferred ? "Low" : "Medium",
          heightInferred,
        };
      }
    } catch (err) {
      console.warn("[ShadingProvider] OSM shadow modeling failed:", err);
    }

    // 3. Fallback Modeled Default
    return {
      shadingLossPct: FEASIBILITY_CONFIG.defaultShadingLossNoBuildings * 100, // 5% flat default
      source: "Shading Modeled Fallback",
      confidence: "Low",
      heightInferred: true,
    };
  }
}

function minConfidence(...levels: ConfidenceLevel[]): ConfidenceLevel {
  if (levels.includes("Low")) return "Low";
  if (levels.includes("Medium")) return "Medium";
  return "High";
}

function fallbackElevation(): Awaited<ReturnType<IElevationSlopeProvider["getElevationAndSlope"]>> {
  return {
    elevationM: 150.0,
    slopeDeg: 15.0,
    source: "Elevation Modeled Fallback",
    confidence: "Low",
  };
}

function fallbackGeometry(lat: number, lng: number): Awaited<ReturnType<IRoofGeometryProvider["getRoofGeometry"]>> {
  const size = FEASIBILITY_CONFIG.slopeSampleSpacingDeg;
  return {
    areaM2: 120.0,
    polygon: [
      { lat: lat - size, lng: lng - size },
      { lat: lat + size, lng: lng - size },
      { lat: lat + size, lng: lng + size },
      { lat: lat - size, lng: lng + size },
      { lat: lat - size, lng: lng - size }
    ],
    source: "Geometry Modeled Fallback",
    confidence: "Low",
  };
}

function fallbackShading(): Awaited<ReturnType<IShadingProvider["getShading"]>> {
  return {
    shadingLossPct: FEASIBILITY_CONFIG.defaultShadingLossNoBuildings * 100,
    source: "Shading Modeled Fallback",
    confidence: "Low",
    heightInferred: true,
  };
}

function fallbackWeather(lat: number, lng: number): Awaited<ReturnType<IWeatherProvider["getWeather"]>> {
  const reg = getRegionalPSH(lat, lng);
  return {
    monthlyGhi: Array(12).fill(reg.psh),
    monthlyWind10m: Array(12).fill(3.0),
    monthlyWind50m: Array(12).fill(4.0),
    monthlyTemp: Array(12).fill(27.0),
    elevationM: 0.0,
    source: `Regional Fallback Database (${reg.region})`,
    confidence: "Low",
  };
}

function resolveTariff(lat: number, lng: number): {
  rate: number;
  state: string;
  source: "state_tariff" | "national_fallback";
  confidence: ConfidenceLevel;
} {
  const region = getRegionalPSH(lat, lng).region;
  const tariff = getDiscomTariff(region);
  if (tariff) {
    return {
      rate: tariff.defaultTariff,
      state: region,
      source: "state_tariff",
      confidence: "Medium",
    };
  }
  return {
    rate: FEASIBILITY_CONFIG.electricityRateInr,
    state: region,
    source: "national_fallback",
    confidence: "Low",
  };
}

// ==========================================
// CORE CALCULATION PIPELINE
// ==========================================

export async function runAutomatedFeasibility(
  lat: number,
  lng: number,
  providers?: {
    elevation?: IElevationSlopeProvider;
    geometry?: IRoofGeometryProvider;
    shading?: IShadingProvider;
    weather?: IWeatherProvider;
  }
): Promise<FeasibilityReport> {
  const generatedAt = new Date().toISOString();
  const apiKey = typeof process !== "undefined" ? process.env.GOOGLE_GEOCODING_KEY : undefined;

  // Initialize providers
  const elevProvider = providers?.elevation || new ElevationSlopeProvider();
  const geomProvider = providers?.geometry || new RoofGeometryProvider();
  const shadProvider = providers?.shading || new ShadingProvider();
  const wethProvider = providers?.weather || new WeatherProvider();

  const sourcesUsed: string[] = [];

  // 1. Fetch Elevation and Slope
  let elevationResult: Awaited<ReturnType<IElevationSlopeProvider["getElevationAndSlope"]>>;
  try {
    elevationResult = await elevProvider.getElevationAndSlope(lat, lng, apiKey);
  } catch (err) {
    console.warn("[FeasibilityEngine] Elevation provider failed, using modeled fallback:", err);
    elevationResult = fallbackElevation();
  }
  sourcesUsed.push(elevationResult.source);

  // 2. Fetch Roof Geometry
  let geometryResult: Awaited<ReturnType<IRoofGeometryProvider["getRoofGeometry"]>>;
  try {
    geometryResult = await geomProvider.getRoofGeometry(lat, lng, apiKey);
  } catch (err) {
    console.warn("[FeasibilityEngine] Geometry provider failed, using modeled fallback:", err);
    geometryResult = fallbackGeometry(lat, lng);
  }
  sourcesUsed.push(geometryResult.source);

  // 3. Fetch Shading Loss
  let shadingResult: Awaited<ReturnType<IShadingProvider["getShading"]>>;
  try {
    shadingResult = await shadProvider.getShading(lat, lng, apiKey, geometryResult);
  } catch (err) {
    console.warn("[FeasibilityEngine] Shading provider failed, using modeled fallback:", err);
    shadingResult = fallbackShading();
  }
  sourcesUsed.push(shadingResult.source);

  // 4. Fetch Weather / Irradiance Data
  let weatherResult: Awaited<ReturnType<IWeatherProvider["getWeather"]>>;
  try {
    weatherResult = await wethProvider.getWeather(lat, lng);
  } catch (err) {
    console.warn("[FeasibilityEngine] Weather provider failed, using regional fallback:", err);
    weatherResult = fallbackWeather(lat, lng);
  }
  sourcesUsed.push(weatherResult.source);

  // ==========================================
  // METEOROLOGICAL CALCULATIONS
  // ==========================================
  
  // Calculate average annual GHI in kWh/m²/day
  const avgGhi = weatherResult.monthlyGhi.reduce((a, b) => a + b, 0) / 12;
  
  // Calculate altitude irradiance bonus
  const altitudeBonusMultiplier = calculateAltitudeAdjustment(elevationResult.elevationM, 1.0) - 1.0;
  const altitudeBonusPct = Math.min(
    FEASIBILITY_CONFIG.maxAltitudeIrrBonusPct, 
    Math.max(0.0, altitudeBonusMultiplier * 100)
  );

  // Calculate wind cooling bonus (heuristic based on average wind speed)
  const avgWind = weatherResult.monthlyWind10m.reduce((a, b) => a + b, 0) / 12;
  const windCoolingBonusPct = Math.min(
    FEASIBILITY_CONFIG.maxWindCoolingBonusPct,
    Math.max(0.0, (avgWind - 2.0) * FEASIBILITY_CONFIG.maxWindCoolingBonusPct * 0.3)
  );

  // Temperature coefficient average losses
  let tempLossSum = 0.0;
  weatherResult.monthlyTemp.forEach((t) => {
    tempLossSum += (1.0 - calculateTemperatureCoefficientLoss(t));
  });
  const avgTempLossPct = (tempLossSum / 12) * 100;

  // Wind zone calculation (IS 875 Part 3)
  const windZoneInfo = calculateWindZoneDetails(avgWind);
  const windZone = windZoneInfo.windZone;
  const windZoneLabel = windZoneInfo.windZoneLabel;
  const surchargePerKwp = windZoneInfo.surchargePerKwp;
  const highWindWarning = windZone === "Zone 3" || windZone === "Zone 4" || windZone === "Zone 5/6";

  // Usable area and System capacity
  const usableRoofArea = geometryResult.areaM2 * (1.0 - FEASIBILITY_CONFIG.defaultObstructionMargin);
  const systemSizeKwp = usableRoofArea / PANEL_AREA_PER_KW;

  // Derive optimal tilt & orientation
  // Optimal tilt is latitude + slope contribution
  const optimalTilt = Math.min(35.0, Math.max(10.0, Math.abs(lat) * 0.9 + elevationResult.slopeDeg * 0.1));
  const optimalAzimuth = geometryResult.azimuth || "S";

  // Yield production calculation (kWh)
  // Annual Yield = kWp * GHI * 365 * (1 - losses) * (1 - shading) * (1 + altitude) * (1 + wind_cooling)
  const baselineYield = systemSizeKwp * avgGhi * 365 * (1.0 - SYSTEM_LOSSES);
  
  const shadingFactor = 1.0 - shadingResult.shadingLossPct / 100;
  const altitudeFactor = 1.0 + altitudeBonusPct / 100;
  const windCoolingFactor = 1.0 + windCoolingBonusPct / 100;
  const tempFactor = 1.0 - avgTempLossPct / 100;

  const annualYieldKwh = Math.round(baselineYield * shadingFactor * altitudeFactor * windCoolingFactor * tempFactor * 10) / 10;

  // ==========================================
  // FINANCIAL CALCULATIONS
  // ==========================================

  // Determine base CapEx tiered cost
  let baseCostRate = 50000;
  for (const tier of SYSTEM_COST_PER_KW_INR_TIERS) {
    if (systemSizeKwp <= tier.maxKw) {
      baseCostRate = tier.cost;
      break;
    }
  }
  const baseCapEx = systemSizeKwp * baseCostRate;
  const windSurcharge = systemSizeKwp * surchargePerKwp;
  const totalCapEx = Math.round(baseCapEx + windSurcharge);

  // Estimate state/DISCOM tariff rate from the same coordinate grid used for PSH fallbacks.
  const tariff = resolveTariff(lat, lng);
  const tariffRate = tariff.rate;

  // Subsidy: central PM Surya Ghar slab + state-specific booster (F10).
  const centralSubsidyInr = Math.round(calcSubsidyInr(systemSizeKwp));
  const stateBooster = calcStateBoosterInr(tariff.state, systemSizeKwp);
  const subsidyInr = centralSubsidyInr + stateBooster.boosterInr;
  const netCostInr = Math.max(0, totalCapEx - subsidyInr);
  
  const annualSavingsInr = annualYieldKwh * tariffRate;
  const paybackYears = annualSavingsInr > 0 ? Math.round((netCostInr / annualSavingsInr) * 10) / 10 : 0.0;
  
  const lifetimeSavings = annualSavingsInr * SYSTEM_LIFETIME_YRS;
  const roi25yrPercent = netCostInr > 0 ? Math.round(((lifetimeSavings - netCostInr) / netCostInr) * 100) : 0;

  // ==========================================
  // STOREY COUNT ESTIMATION
  // ==========================================
  // Auto-estimate storey count from building shadow length + sun elevation angle
  const shadowLength = FEASIBILITY_CONFIG.shadowLengthDefaultM;
  const sunElevationRad = (FEASIBILITY_CONFIG.sunElevationDefaultDeg * Math.PI) / 180;
  const heightM = shadowLength * Math.tan(sunElevationRad);
  const storeyCountEstimate = Math.max(1, Math.round(heightM / FEASIBILITY_CONFIG.defaultStoreyHeightM));

  // Determine overall confidence level (lowest confidence among critical variables)
  const overallConfidence = minConfidence(
    elevationResult.confidence,
    geometryResult.confidence,
    shadingResult.confidence,
    weatherResult.confidence,
  );
  const financialConfidence = minConfidence(overallConfidence, tariff.confidence);

  // Define structured on-site verification list
  const checklist = [
    {
      factor: "Structural Load Capacity",
      description: "Rooftop structures must sustain dead-load of mounting frames & solar modules (approx 15-20 kg/m²).",
      verificationStep: "Request structural stability certificate from a civil engineer before installation."
    },
    {
      factor: "Roof Age & Leakage History",
      description: "Solar systems have a lifetime of 25+ years. Roof repairs post-installation require dismantling modules.",
      verificationStep: "Verify roof slab condition and apply waterproofing coating if roof age exceeds 10 years."
    },
    {
      factor: "Roof Material",
      description: "Standard calculations assume reinforced concrete (RCC) flat roof. Sheet metals or tiles require specialized fasteners.",
      verificationStep: "Confirm roof surface material to customize mounting clamp hardware configurations."
    },
    {
      factor: "Storey Count Verification",
      description: "Calculated shadow height estimates building height at approx 2-3 storeys (modeled hint).",
      verificationStep: "Physically verify building storey count to ensure correct cable-run sizing."
    }
  ];

  const report: FeasibilityReport = {
    coordinates: { lat, lng },
    usableRoofArea: {
      value: Math.round(usableRoofArea * 10) / 10,
      confidence: geometryResult.confidence,
      source: geometryResult.source,
      isModeled: geometryResult.source.includes("Fallback")
    },
    systemSizeKwp: {
      value: Math.round(systemSizeKwp * 100) / 100,
      confidence: geometryResult.confidence,
      source: "Engine Capacity Model",
      isModeled: geometryResult.source.includes("Fallback")
    },
    annualYieldKwh: {
      value: Math.round(annualYieldKwh * 10) / 10,
      confidence: overallConfidence,
      source: "PV-Calculations Engine Model",
      isModeled: true
    },
    optimalTiltDeg: {
      value: Math.round(optimalTilt * 10) / 10,
      confidence: elevationResult.confidence,
      source: "Terrain Gradient Model",
      isModeled: true
    },
    optimalAzimuth: {
      value: optimalAzimuth,
      confidence: geometryResult.confidence,
      source: geometryResult.source,
      isModeled: geometryResult.source.includes("Fallback")
    },
    multipliers: {
      shadingLoss: {
        value: shadingResult.shadingLossPct,
        confidence: shadingResult.confidence,
        source: shadingResult.source,
        isModeled: shadingResult.source.includes("Model") || shadingResult.source.includes("Fallback"),
        heightInferred: shadingResult.heightInferred,
      },
      windCoolingBonus: {
        value: Math.round(windCoolingBonusPct * 10) / 10,
        confidence: weatherResult.confidence,
        source: "NASA Meteorological Wind Heuristic",
        isModeled: true
      },
      altitudeIrrBonus: {
        value: Math.round(altitudeBonusPct * 100) / 100,
        confidence: elevationResult.confidence,
        source: "SRTM Elevation Altitude Multiplier",
        isModeled: true
      },
      temperatureLoss: {
        value: Math.round(avgTempLossPct * 10) / 10,
        confidence: weatherResult.confidence,
        source: "NASA Meteorological Temperature Coefficient Model",
        isModeled: true
      }
    },
    financials: {
      capexCostInr: {
        value: totalCapEx,
        confidence: geometryResult.confidence,
        source: "Market Rate Model + Wind Surcharge",
        isModeled: true
      },
      netCostInr: {
        value: netCostInr,
        confidence: geometryResult.confidence,
        source: "Market Rate Model - PM Subsidy",
        isModeled: true
      },
      subsidyInr: {
        value: subsidyInr,
        confidence: geometryResult.confidence,
        source: stateBooster.scheme
          ? `PM Surya Ghar + ${stateBooster.scheme}`
          : "PM Surya Ghar subsidy schedule",
        isModeled: false
      },
      centralSubsidyInr,
      stateBoosterInr: stateBooster.boosterInr,
      stateSubsidyScheme: stateBooster.scheme,
      stateSubsidyVerified: stateBooster.verified,
      electricityRateInr: {
        value: tariffRate,
        confidence: tariff.confidence,
        source: tariff.source,
        isModeled: tariff.source === "national_fallback"
      },
      tariffSource: tariff.source,
      tariffState: tariff.state,
      paybackYears: {
        value: paybackYears,
        confidence: financialConfidence,
        source: "Amortization solver",
        isModeled: true
      },
      roiPercent25yr: {
        value: roi25yrPercent,
        confidence: financialConfidence,
        source: "Amortization solver",
        isModeled: true
      }
    },
    windZone: {
      value: windZone,
      confidence: weatherResult.confidence,
      source: "IS 875 (Part 3) Wind Atlas Lookup",
      isModeled: true
    },
    windZoneLabel,
    highWindWarning,
    elevationM: {
      value: elevationResult.elevationM,
      confidence: elevationResult.confidence,
      source: elevationResult.source,
      isModeled: elevationResult.source.includes("Fallback")
    },
    storeyCountEstimate: {
      value: storeyCountEstimate,
      confidence: "Low",
      source: "Shadow-Length Elevation Model",
      isModeled: true
    },
    onSiteVerificationChecklist: checklist,
    sourcesUsed: Array.from(new Set(sourcesUsed)),
    overallConfidence,
    generatedAt
  };

  let dbAnalysisId: string | undefined = undefined;

  if (supabase) {
    try {
      const roundedLat = parseFloat(lat.toFixed(4));
      const roundedLng = parseFloat(lng.toFixed(4));
      const { data: sessions, error: sessionErr } = await supabase
        .from("analysis_sessions")
        .select("*");
        
      let matchedSession = null;
      if (sessions && !sessionErr) {
        matchedSession = sessions.find((s: any) => {
          const latDiff = Math.abs(s.latitude - lat);
          const lngDiff = Math.abs(s.longitude - lng);
          const timeDiff = Date.now() - new Date(s.created_at).getTime();
          
          const isRecent = timeDiff <= 15 * 60 * 1000;
          const isNear = latDiff < 0.0001 && lngDiff < 0.0001;
          const isDefaultConfig = 
            s.structure_tilt === 15 &&
            s.boundary_setback === 0.5 &&
            s.maintenance_walkways === true &&
            s.panel_wattage === 450 &&
            s.panel_alignment === "roof" &&
            s.panel_orientation === "auto" &&
            s.shading === "none";
            
          return s.status === "ready" && isRecent && isNear && isDefaultConfig;
        });
      }
      
      if (matchedSession) {
        dbAnalysisId = matchedSession.id;
      } else {
        const newSessionId = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === "x" ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
        const siteId = "automated_" + newSessionId;
        
        let confidenceReason = "High confidence satellite data matching exact roof boundaries.";
        if (overallConfidence === "Low") {
          if (geometryResult.confidence === "Low") {
            confidenceReason = "Geometry fallback used; roof area is estimated.";
          } else if (elevationResult.confidence === "Low") {
            confidenceReason = "Elevation fallback used; terrain gradient is modeled.";
          } else if (shadingResult.confidence === "Low") {
            confidenceReason = "Shading fallback used; local obstructions are estimated.";
          } else if (weatherResult.confidence === "Low") {
            confidenceReason = "Weather fallback used; solar irradiance is modeled.";
          } else {
            confidenceReason = "Low confidence calculations based on fallbacks.";
          }
        } else if (overallConfidence === "Medium") {
          confidenceReason = "Medium confidence satellite data with modeled fallbacks.";
        }
        
        let address = "Automated Scan";
        let city = "Pune";
        
        try {
          const nomUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=en`;
          const response = await fetch(nomUrl, {
            headers: { 'User-Agent': 'SunPowerLinkSolarApp/1.0' }
          });
          if (response.ok) {
            const data = await response.json();
            if (data.display_name) {
              address = data.display_name;
              city = data.address?.city || data.address?.town || data.address?.suburb || city;
            }
          }
        } catch (e) {}
        
        const { error: sessInsertErr } = await supabase
          .from("analysis_sessions")
          .insert({
            id: newSessionId,
            site_id: siteId,
            address: address,
            latitude: lat,
            longitude: lng,
            status: "ready",
            is_preview_unlocked: true,
            is_full_unlocked: true,
            created_at: generatedAt,
            expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
            structure_tilt: 15,
            boundary_setback: 0.5,
            maintenance_walkways: true,
            panel_wattage: 450,
            panel_alignment: "roof",
            panel_orientation: "auto",
            shading: "none",
            city: city
          });
          
        if (!sessInsertErr) {
          const panelCount = Math.round((systemSizeKwp * 1000) / 450);
          
          await supabase
            .from("solar_reports")
            .insert({
              session_id: newSessionId,
              total_roof_area_sqm: Math.round((usableRoofArea / 0.75) * 10) / 10,
              usable_roof_area_sqm: Math.round(usableRoofArea * 10) / 10,
              panel_count: panelCount,
              system_size_kwp: Math.round(systemSizeKwp * 100) / 100,
              annual_ghi_kwh_m2_day: 5.0,
              annual_production_kwh: Math.round(annualYieldKwh * 10) / 10,
              lcoe_per_kwh: 5.5,
              irr: roi25yrPercent > 0 ? 15.0 : 0.0,
              roe: 12.5,
              npv: 250000.0,
              payback_years: paybackYears,
              lifetime_savings: lifetimeSavings,
              utility_cost_25yr: lifetimeSavings * 1.5,
              capex_estimate: totalCapEx,
              pm_surya_subsidy: centralSubsidyInr,
              state_booster_subsidy: stateBooster.boosterInr,
              total_subsidy_inr: subsidyInr,
              suitability_score: overallConfidence === "High" ? 90 : overallConfidence === "Medium" ? 75 : 55,
              investment_grade: overallConfidence === "High" ? "A+" : "A",
              cashflow_projection: [],
              panel_layout: {},
              confidence_level: overallConfidence,
              confidence_reason: confidenceReason,
              generated_at: generatedAt
            });
            
          dbAnalysisId = newSessionId;
        }
      }
    } catch (dbErr) {
      console.error("[FeasibilityEngine] Error during silent database save:", dbErr);
    }
  }

  report.analysisId = dbAnalysisId;
  return report;
}
