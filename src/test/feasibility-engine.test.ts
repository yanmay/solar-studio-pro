import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { 
  runAutomatedFeasibility, 
  ElevationSlopeProvider,
  ShadingProvider,
  IElevationSlopeProvider,
  IRoofGeometryProvider,
  IShadingProvider,
  IWeatherProvider,
} from "../lib/feasibility-engine";
import { nearbyBuildings } from "../lib/osm-buildings";

vi.mock("../lib/osm-buildings", () => ({
  detectBuildingAt: vi.fn(),
  nearbyBuildings: vi.fn(),
}));

const mockedNearbyBuildings = vi.mocked(nearbyBuildings);

const highConfidenceElevation: IElevationSlopeProvider = {
  getElevationAndSlope: async () => ({
    elevationM: 100.0,
    slopeDeg: 10.0,
    source: "Mock Google Elevation",
    confidence: "High",
  })
};

const highConfidenceGeometry: IRoofGeometryProvider = {
  getRoofGeometry: async () => ({
    areaM2: 200.0,
    polygon: [{ lat: 18.5, lng: 73.9 }],
    tiltDeg: 12.0,
    azimuth: "S",
    source: "Mock Google Solar API",
    confidence: "High",
  })
};

const highConfidenceShading: IShadingProvider = {
  getShading: async () => ({
    shadingLossPct: 4.0,
    source: "Mock Google Solar Shading",
    confidence: "High",
  })
};

const highConfidenceWeather: IWeatherProvider = {
  getWeather: async () => ({
    monthlyGhi: [5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0],
    monthlyWind10m: [2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0],
    monthlyWind50m: [3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0],
    monthlyTemp: [25.0, 25.0, 25.0, 25.0, 25.0, 25.0, 25.0, 25.0, 25.0, 25.0, 25.0, 25.0],
    elevationM: 100.0,
    source: "Mock NASA weather",
    confidence: "High",
  })
};

describe("Feasibility Engine Yield Calculations", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("should calculate correctly with ideal high-confidence mock providers", async () => {
    const result = await runAutomatedFeasibility(18.5, 73.9, {
      elevation: highConfidenceElevation,
      geometry: highConfidenceGeometry,
      shading: highConfidenceShading,
      weather: highConfidenceWeather,
    });

    expect(result.overallConfidence).toBe("High");
    expect(result.usableRoofArea.value).toBe(180.0); // 200 * 0.90 (10% obstruction margin)
    expect(result.systemSizeKwp.value).toBe(22.5); // 180 / 8
    expect(result.optimalTiltDeg.value).toBe(17.7); // lat * 0.9 + slope * 0.1
    expect(result.optimalAzimuth.value).toBe("S");
    expect(result.elevationM.value).toBe(100.0);
    expect(result.annualYieldKwh.value).toBeGreaterThan(0);
    expect(result.storeyCountEstimate.value).toBe(3); // Shadow based estimator default check
    expect(result.onSiteVerificationChecklist.length).toBe(4);
    expect(result.sourcesUsed).toContain("Mock Google Elevation");
    expect(result.sourcesUsed).toContain("Mock Google Solar API");
    expect(result.financials.tariffSource).toBe("state_tariff");
  });

  it("should downgrade confidence if any provider has a low-confidence fallback", async () => {
    const mockElev: IElevationSlopeProvider = {
      getElevationAndSlope: async () => ({
        elevationM: 150.0,
        slopeDeg: 15.0,
        source: "Fallback Elevation",
        confidence: "Low",
      })
    };

    const mockGeom: IRoofGeometryProvider = {
      getRoofGeometry: async () => ({
        areaM2: 120.0,
        polygon: [],
        source: "Fallback Geometry",
        confidence: "Low",
      })
    };

    const mockShad: IShadingProvider = {
      getShading: async () => ({
        shadingLossPct: 5.0,
        source: "Fallback Shading",
        confidence: "Low",
      })
    };

    const mockWeather: IWeatherProvider = {
      getWeather: async () => ({
        monthlyGhi: [4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5],
        monthlyWind10m: [2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0],
        monthlyWind50m: [3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0],
        monthlyTemp: [25.0, 25.0, 25.0, 25.0, 25.0, 25.0, 25.0, 25.0, 25.0, 25.0, 25.0, 25.0],
        elevationM: 150.0,
        source: "Mock weather",
        confidence: "High",
      })
    };

    const result = await runAutomatedFeasibility(18.5, 73.9, {
      elevation: mockElev,
      geometry: mockGeom,
      shading: mockShad,
      weather: mockWeather,
    });

    expect(result.overallConfidence).toBe("Low");
    expect(result.usableRoofArea.value).toBe(108.0); // 120 * 0.9
    expect(result.systemSizeKwp.value).toBe(13.5); // 108 / 8
  });

  it("should fall back from Google Elevation to Open-Meteo with medium confidence", async () => {
    vi.stubEnv("GOOGLE_GEOCODING_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ elevation: [100, 101, 99, 102, 98] })
      })
    );

    const result = await new ElevationSlopeProvider().getElevationAndSlope(18.5, 73.9, "test-key");

    expect(result.source).toBe("Open-Meteo SRTM Elevation API");
    expect(result.confidence).toBe("Medium");
    expect(result.slopeDeg).toBeGreaterThan(0);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });

  it("should gracefully downgrade when weather and geometry providers throw", async () => {
    const failingGeometry: IRoofGeometryProvider = {
      getRoofGeometry: async () => {
        throw new Error("geometry unavailable");
      }
    };
    const failingWeather: IWeatherProvider = {
      getWeather: async () => {
        throw new Error("weather unavailable");
      }
    };

    const result = await runAutomatedFeasibility(18.5, 73.9, {
      elevation: highConfidenceElevation,
      geometry: failingGeometry,
      shading: highConfidenceShading,
      weather: failingWeather,
    });

    expect(result.usableRoofArea.confidence).toBe("Low");
    expect(result.multipliers.temperatureLoss.confidence).toBe("Low");
    expect(result.overallConfidence).toBe("Low");
    expect(result.sourcesUsed).toContain("Geometry Modeled Fallback");
    expect(result.sourcesUsed.some((source) => source.startsWith("Regional Fallback Database"))).toBe(true);
  });

  it("should handle zero OSM nearby buildings without crashing", async () => {
    mockedNearbyBuildings.mockResolvedValue([]);

    const result = await new ShadingProvider().getShading(18.5, 73.9);

    expect(result.confidence).toBe("Low");
    expect(result.shadingLossPct).toBe(5);
    expect(result.source).toBe("Shading Modeled Fallback");
  });

  it("should downgrade OSM shading confidence when building height is inferred", async () => {
    mockedNearbyBuildings.mockResolvedValue([{ areaM2: 200, distanceM: 10 }]);

    const result = await new ShadingProvider().getShading(18.5, 73.9);

    expect(result.heightInferred).toBe(true);
    expect(result.confidence).toBe("Low");
    expect(result.source).toBe("OSM Surface Obstructive Model");
  });

  it("should apply latitude cosine when computing east-west slope", async () => {
    const fetchAtEquator = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ elevation: [0, 0, 0, 10, -10] })
    });
    vi.stubGlobal("fetch", fetchAtEquator);
    const equator = await new ElevationSlopeProvider().getElevationAndSlope(0, 73.9);

    const fetchAtThirtyNorth = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ elevation: [0, 0, 0, 10, -10] })
    });
    vi.stubGlobal("fetch", fetchAtThirtyNorth);
    const thirtyNorth = await new ElevationSlopeProvider().getElevationAndSlope(30, 73.9);

    expect(thirtyNorth.slopeDeg).toBeGreaterThan(equator.slopeDeg);
  });

  it("should mark tariff as national fallback and downgrade financial confidence when state tariff is missing", async () => {
    const result = await runAutomatedFeasibility(26, 92, {
      elevation: highConfidenceElevation,
      geometry: highConfidenceGeometry,
      shading: highConfidenceShading,
      weather: highConfidenceWeather,
    });

    expect(result.overallConfidence).toBe("High");
    expect(result.financials.tariffSource).toBe("national_fallback");
    expect(result.financials.electricityRateInr.confidence).toBe("Low");
    expect(result.financials.paybackYears.confidence).toBe("Low");
    expect(result.financials.roiPercent25yr.confidence).toBe("Low");
  });
});
