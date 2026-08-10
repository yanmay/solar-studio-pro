import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import {
  fetchGoogleSolarInsights,
  isGoogleSolarEnabled,
  augmentPayloadWithGoogleSolar,
} from "../lib/google-solar";

// ─────────────────────────────────────────────────────────────────────────
// Google Solar client — payload-failure coverage.
//
// The client is the boundary between an unreliable third-party API and the
// financial model. Its contract: NEVER throw, resolve to `null` for every
// non-success outcome, and only ever hand back sanitized, in-range numbers.
// These tests pin every failure branch plus the happy path.
// ─────────────────────────────────────────────────────────────────────────

const LAT = 19.076; // Mumbai — real Google Solar returns 404 (no India coverage)
const LNG = 72.877;

const ORIGINAL_KEY = process.env.GOOGLE_SOLAR_API_KEY;

/** Build a mock fetch that resolves to a Response-like object. */
function mockFetch(impl: () => Partial<Response> | Promise<Partial<Response>>) {
  const fn = vi.fn(async () => impl() as unknown as Response);
  vi.stubGlobal("fetch", fn);
  return fn;
}

function jsonResponse(status: number, body: unknown): Partial<Response> {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

beforeEach(() => {
  process.env.GOOGLE_SOLAR_API_KEY = "test-key";
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (ORIGINAL_KEY === undefined) {
    delete process.env.GOOGLE_SOLAR_API_KEY;
  } else {
    process.env.GOOGLE_SOLAR_API_KEY = ORIGINAL_KEY;
  }
});

describe("isGoogleSolarEnabled", () => {
  it("is false when the API key is unset", () => {
    delete process.env.GOOGLE_SOLAR_API_KEY;
    expect(isGoogleSolarEnabled()).toBe(false);
  });

  it("is true when the API key is set", () => {
    process.env.GOOGLE_SOLAR_API_KEY = "test-key";
    expect(isGoogleSolarEnabled()).toBe(true);
  });
});

describe("fetchGoogleSolarInsights — failure modes resolve to null", () => {
  it("returns null and does not fetch when the feature flag is off", async () => {
    delete process.env.GOOGLE_SOLAR_API_KEY;
    const fetchFn = mockFetch(() => jsonResponse(200, {}));

    const result = await fetchGoogleSolarInsights(LAT, LNG);

    expect(result).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("returns null on HTTP 404 (no coverage for the location)", async () => {
    mockFetch(() => jsonResponse(404, { error: { status: "NOT_FOUND" } }));
    expect(await fetchGoogleSolarInsights(LAT, LNG)).toBeNull();
  });

  it("returns null on a non-2xx status (e.g. 403 auth error)", async () => {
    mockFetch(() => jsonResponse(403, { error: { status: "PERMISSION_DENIED" } }));
    expect(await fetchGoogleSolarInsights(LAT, LNG)).toBeNull();
  });

  it("returns null on a network / transport failure", async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    vi.stubGlobal("fetch", fetchFn);

    await expect(fetchGoogleSolarInsights(LAT, LNG)).resolves.toBeNull();
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it("returns null when the response body is not valid JSON", async () => {
    mockFetch(() => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected end of JSON input");
      },
    }));
    expect(await fetchGoogleSolarInsights(LAT, LNG)).toBeNull();
  });

  it("returns null when solarPotential is missing", async () => {
    mockFetch(() => jsonResponse(200, { name: "buildings/abc" }));
    expect(await fetchGoogleSolarInsights(LAT, LNG)).toBeNull();
  });

  it("returns null when maxSunshineHoursPerYear is missing", async () => {
    mockFetch(() => jsonResponse(200, { solarPotential: { roofSegmentStats: [] } }));
    expect(await fetchGoogleSolarInsights(LAT, LNG)).toBeNull();
  });

  it("returns null when maxSunshineHoursPerYear is non-positive", async () => {
    mockFetch(() => jsonResponse(200, { solarPotential: { maxSunshineHoursPerYear: 0 } }));
    expect(await fetchGoogleSolarInsights(LAT, LNG)).toBeNull();
  });

  it("returns null for non-finite coordinates without fetching", async () => {
    const fetchFn = mockFetch(() => jsonResponse(200, {}));
    expect(await fetchGoogleSolarInsights(Number.NaN, LNG)).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe("fetchGoogleSolarInsights — valid payload parsing", () => {
  const validBody = {
    solarPotential: {
      maxSunshineHoursPerYear: 1825, // 1825 / 365 = exactly 5.0 PSH
      wholeRoofStats: {
        areaMeters2: 100,
        // median (index 2 of 5) = 1600, max = 2000 → loss = 1 - 1600/2000 = 0.20
        sunshineQuantiles: [1000, 1400, 1600, 1800, 2000],
      },
      roofSegmentStats: [
        { pitchDegrees: 10, azimuthDegrees: 180, stats: { areaMeters2: 30 } },
        { pitchDegrees: 20, azimuthDegrees: 180, stats: { areaMeters2: 10 } },
      ],
    },
  };

  it("parses PSH, geometry, and shading with the correct source tag", async () => {
    mockFetch(() => jsonResponse(200, validBody));

    const result = await fetchGoogleSolarInsights(LAT, LNG);

    expect(result).not.toBeNull();
    expect(result!.source).toBe("GOOGLE_SOLAR");
    expect(result!.peakSunHours).toBe(5.0);
    // Area-weighted pitch = (10*30 + 20*10) / 40 = 12.5
    expect(result!.pitchDegrees).toBe(12.5);
    // Both segments face 180° → mean azimuth 180°
    expect(result!.azimuthDegrees).toBe(180);
    // 1 - median/max = 0.20
    expect(result!.shadingLoss).toBe(0.2);
    expect(result!.maxSunshineHoursPerYear).toBe(1825);
  });

  it("clamps an implausibly high PSH to the physical ceiling (8.0)", async () => {
    mockFetch(() =>
      jsonResponse(200, {
        solarPotential: { maxSunshineHoursPerYear: 5000 /* 13.7/day */ },
      }),
    );

    const result = await fetchGoogleSolarInsights(LAT, LNG);
    expect(result!.peakSunHours).toBe(8.0);
  });

  it("clamps derived shading loss to the 0.30 ceiling", async () => {
    mockFetch(() =>
      jsonResponse(200, {
        solarPotential: {
          maxSunshineHoursPerYear: 1500,
          // median 400, max 2000 → raw loss 0.80, clamped to 0.30
          wholeRoofStats: { sunshineQuantiles: [200, 300, 400, 1200, 2000] },
        },
      }),
    );

    const result = await fetchGoogleSolarInsights(LAT, LNG);
    expect(result!.shadingLoss).toBe(0.3);
  });

  it("omits geometry when roofSegmentStats is absent, still returning PSH", async () => {
    mockFetch(() =>
      jsonResponse(200, { solarPotential: { maxSunshineHoursPerYear: 1460 } }),
    );

    const result = await fetchGoogleSolarInsights(LAT, LNG);
    expect(result).not.toBeNull();
    expect(result!.peakSunHours).toBe(4.0);
    expect(result!.pitchDegrees).toBeUndefined();
    expect(result!.azimuthDegrees).toBeUndefined();
    expect(result!.shadingLoss).toBeUndefined();
  });

  it("uses circular mean for azimuths that straddle the 0/360 wraparound", async () => {
    mockFetch(() =>
      jsonResponse(200, {
        solarPotential: {
          maxSunshineHoursPerYear: 1460,
          roofSegmentStats: [
            { pitchDegrees: 15, azimuthDegrees: 350, stats: { areaMeters2: 10 } },
            { pitchDegrees: 15, azimuthDegrees: 10, stats: { areaMeters2: 10 } },
          ],
        },
      }),
    );

    const result = await fetchGoogleSolarInsights(LAT, LNG);
    // 350° and 10° average to 0°/360°, NOT the naive-arithmetic 180°.
    expect(result!.azimuthDegrees === 0 || result!.azimuthDegrees === 360).toBe(true);
  });
});

describe("augmentPayloadWithGoogleSolar — precedence with fallback", () => {
  const nasaPayload = {
    monthly_ghi: [4, 4, 5, 5, 6, 6, 5, 5, 5, 4, 4, 4],
    lat: LAT,
    lng: LNG,
    year: 2024,
    ws10m: 3.2,
    t2m: 27.1,
    t2m_monthly: [22, 24, 28, 31, 33, 31, 28, 28, 28, 27, 25, 22],
  };

  it("returns the NASA payload UNCHANGED when the flag is off", async () => {
    delete process.env.GOOGLE_SOLAR_API_KEY;
    const fetchFn = mockFetch(() => jsonResponse(200, {}));

    const result = await augmentPayloadWithGoogleSolar(nasaPayload, LAT, LNG);

    expect(result).toEqual(nasaPayload);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("returns the NASA payload unchanged when Google has no coverage (404)", async () => {
    mockFetch(() => jsonResponse(404, {}));

    const result = await augmentPayloadWithGoogleSolar(nasaPayload, LAT, LNG);

    expect(result).toEqual(nasaPayload);
    expect(result).not.toHaveProperty("google_psh");
  });

  it("overrides irradiance/geometry while preserving NASA wind + temp on coverage", async () => {
    mockFetch(() =>
      jsonResponse(200, {
        solarPotential: {
          maxSunshineHoursPerYear: 1825,
          wholeRoofStats: { sunshineQuantiles: [1000, 1400, 1600, 1800, 2000] },
          roofSegmentStats: [
            { pitchDegrees: 18, azimuthDegrees: 175, stats: { areaMeters2: 50 } },
          ],
        },
      }),
    );

    const result = await augmentPayloadWithGoogleSolar(nasaPayload, LAT, LNG);

    // Google overrides
    expect(result.source).toBe("GOOGLE_SOLAR");
    expect(result.google_psh).toBe(5.0);
    expect(result.pitch_degrees).toBe(18);
    expect(result.azimuth_degrees).toBe(175);
    expect(result.shading_loss).toBe(0.2);
    // NASA data Google can't supply is preserved untouched
    expect(result.ws10m).toBe(3.2);
    expect(result.t2m).toBe(27.1);
    expect(result.monthly_ghi).toEqual(nasaPayload.monthly_ghi);
  });
});
