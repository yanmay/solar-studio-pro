import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import {
  fetchNsrdbIodc,
  isNsrdbEnabled,
  isWithinIodcCoverage,
} from "../lib/nsrdb-iodc";

// ─────────────────────────────────────────────────────────────────────────
// NSRDB Meteosat IODC client — payload-failure coverage.
//
// This is the LIVE India source; it sits between an unreliable third-party CSV
// endpoint and the financial model. Contract: NEVER throw, resolve to `null`
// for every non-success outcome, and only hand back a complete, sanitized
// payload on success. These tests pin every failure branch plus the happy path.
// ─────────────────────────────────────────────────────────────────────────

const LAT = 28.61; // New Delhi — inside IODC coverage
const LNG = 77.22;

const ORIGINAL_KEY = process.env.NSRDB_API_KEY;
const ORIGINAL_EMAIL = process.env.NSRDB_API_EMAIL;

/** Build a mock fetch that resolves to a Response-like object. */
function mockFetch(impl: () => Partial<Response> | Promise<Partial<Response>>) {
  const fn = vi.fn(async () => impl() as unknown as Response);
  vi.stubGlobal("fetch", fn);
  return fn;
}

function csvResponse(status: number, text: string): Partial<Response> {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
  };
}

const DAYS_IN_MONTH_2019 = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * Generate a faithful NSRDB IODC hourly CSV for a full non-leap year:
 * 2 metadata rows, a named header row, then 24 hourly rows per day with the
 * given constant GHI (W/m²), temperature (°C) and wind (m/s). Column ORDER is
 * deliberately not the "natural" one — the parser must resolve by name.
 */
function buildIodcCsv(
  opts: { ghi?: number; temp?: number; wind?: number; months?: number; days?: number } = {},
): string {
  const { ghi = 200, temp = 25, wind = 3, months = 12, days } = opts;
  const rows: string[] = [
    "Source,Location ID,City,State,Country,Latitude,Longitude,Time Zone,Elevation",
    "NSRDB,123456,-,-,India,28.61,77.22,5.5,216",
    "Year,Month,Day,Hour,Minute,Temperature,Wind Speed,GHI",
  ];
  for (let m = 1; m <= months; m++) {
    const lastDay = days ?? DAYS_IN_MONTH_2019[m - 1];
    for (let d = 1; d <= lastDay; d++) {
      for (let h = 0; h < 24; h++) {
        rows.push(`2019,${m},${d},${h},0,${temp},${wind},${ghi}`);
      }
    }
  }
  return rows.join("\n");
}

beforeEach(() => {
  process.env.NSRDB_API_KEY = "test-key";
  process.env.NSRDB_API_EMAIL = "tester@sunpowerlink.dev";
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (ORIGINAL_KEY === undefined) delete process.env.NSRDB_API_KEY;
  else process.env.NSRDB_API_KEY = ORIGINAL_KEY;
  if (ORIGINAL_EMAIL === undefined) delete process.env.NSRDB_API_EMAIL;
  else process.env.NSRDB_API_EMAIL = ORIGINAL_EMAIL;
});

describe("isNsrdbEnabled", () => {
  it("is false when the API key is unset", () => {
    delete process.env.NSRDB_API_KEY;
    expect(isNsrdbEnabled()).toBe(false);
  });

  it("is true when the API key is set", () => {
    process.env.NSRDB_API_KEY = "test-key";
    expect(isNsrdbEnabled()).toBe(true);
  });
});

describe("isWithinIodcCoverage", () => {
  it("is true for a coordinate inside the box", () => {
    expect(isWithinIodcCoverage(LAT, LNG)).toBe(true);
  });

  it("is true at the inclusive box corners", () => {
    expect(isWithinIodcCoverage(5, 60)).toBe(true);
    expect(isWithinIodcCoverage(38, 100)).toBe(true);
  });

  it("is false just outside the box edges", () => {
    expect(isWithinIodcCoverage(4.99, 60)).toBe(false);
    expect(isWithinIodcCoverage(38.01, 100)).toBe(false);
    expect(isWithinIodcCoverage(20, 59.9)).toBe(false);
    expect(isWithinIodcCoverage(20, 100.1)).toBe(false);
  });

  it("is false for a far-away coordinate (New York)", () => {
    expect(isWithinIodcCoverage(40.7, -74)).toBe(false);
  });

  it("is false for non-finite coordinates", () => {
    expect(isWithinIodcCoverage(Number.NaN, LNG)).toBe(false);
    expect(isWithinIodcCoverage(LAT, Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe("fetchNsrdbIodc — failure modes resolve to null", () => {
  it("returns null and does not fetch when the flag is off", async () => {
    delete process.env.NSRDB_API_KEY;
    const fetchFn = mockFetch(() => csvResponse(200, buildIodcCsv()));

    expect(await fetchNsrdbIodc(LAT, LNG)).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("returns null and does not fetch when the registration email is missing", async () => {
    delete process.env.NSRDB_API_EMAIL;
    const fetchFn = mockFetch(() => csvResponse(200, buildIodcCsv()));

    expect(await fetchNsrdbIodc(LAT, LNG)).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("returns null and does not fetch for an out-of-coverage coordinate", async () => {
    const fetchFn = mockFetch(() => csvResponse(200, buildIodcCsv()));

    expect(await fetchNsrdbIodc(40.7, -74)).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("returns null and does not fetch for non-finite coordinates", async () => {
    const fetchFn = mockFetch(() => csvResponse(200, buildIodcCsv()));

    expect(await fetchNsrdbIodc(Number.NaN, LNG)).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("returns null on HTTP 404", async () => {
    mockFetch(() => csvResponse(404, "Not Found"));
    expect(await fetchNsrdbIodc(LAT, LNG)).toBeNull();
  });

  it("returns null on a non-2xx status (e.g. 429 rate limit)", async () => {
    mockFetch(() => csvResponse(429, "rate limit exceeded"));
    expect(await fetchNsrdbIodc(LAT, LNG)).toBeNull();
  });

  it("returns null on a network / transport failure", async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    vi.stubGlobal("fetch", fetchFn);

    await expect(fetchNsrdbIodc(LAT, LNG)).resolves.toBeNull();
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it("returns null on an empty CSV body", async () => {
    mockFetch(() => csvResponse(200, ""));
    expect(await fetchNsrdbIodc(LAT, LNG)).toBeNull();
  });

  it("returns null on a header-only CSV (no data rows)", async () => {
    const headerOnly = buildIodcCsv().split("\n").slice(0, 3).join("\n");
    mockFetch(() => csvResponse(200, headerOnly));
    expect(await fetchNsrdbIodc(LAT, LNG)).toBeNull();
  });

  it("returns null when a required column is absent from the header", async () => {
    const noGhi =
      "meta1\nmeta2\nYear,Month,Day,Hour,Minute,Temperature,Wind Speed\n2019,1,1,0,0,25,3";
    mockFetch(() => csvResponse(200, noGhi));
    expect(await fetchNsrdbIodc(LAT, LNG)).toBeNull();
  });

  it("returns null when a month is entirely absent (garbled year)", async () => {
    // Only January present → months 2..12 have zero days → discarded.
    mockFetch(() => csvResponse(200, buildIodcCsv({ months: 1 })));
    expect(await fetchNsrdbIodc(LAT, LNG)).toBeNull();
  });

  it("returns null when too few days are usable (below the safety floor)", async () => {
    // 12 months but only 10 days each = 120 usable days < MIN_USABLE_DAYS (300).
    mockFetch(() => csvResponse(200, buildIodcCsv({ days: 10 })));
    expect(await fetchNsrdbIodc(LAT, LNG)).toBeNull();
  });
});

describe("fetchNsrdbIodc — valid payload parsing", () => {
  it("parses a full year into a model-ready NSRDB payload", async () => {
    // 200 W/m² × 24 h ÷ 1000 = 4.8 kWh/m²/day for every month.
    mockFetch(() => csvResponse(200, buildIodcCsv({ ghi: 200, temp: 25, wind: 3 })));

    const result = await fetchNsrdbIodc(LAT, LNG);

    expect(result).not.toBeNull();
    expect(result!.source).toBe("NSRDB_IODC");
    expect(result!.monthly_ghi).toHaveLength(12);
    expect(result!.monthly_ghi.every((v) => v === 4.8)).toBe(true);
    expect(result!.t2m_monthly).toHaveLength(12);
    expect(result!.t2m).toBe(25);
    expect(result!.ws10m).toBe(3);
    expect(result!.nsrdb_year).toBe("2019");
    expect(typeof result!.region).toBe("string");
  });

  it("averages hourly GHI correctly across a month (mean daily insolation)", async () => {
    // 250 W/m² × 24 h ÷ 1000 = 6.0 kWh/m²/day.
    mockFetch(() => csvResponse(200, buildIodcCsv({ ghi: 250 })));

    const result = await fetchNsrdbIodc(LAT, LNG);
    expect(result!.monthly_ghi.every((v) => v === 6.0)).toBe(true);
  });

  it("sends a WKT POINT in lng-then-lat order to the NSRDB host", async () => {
    const fetchFn = mockFetch(() => csvResponse(200, buildIodcCsv()));

    await fetchNsrdbIodc(LAT, LNG);

    expect(fetchFn).toHaveBeenCalledOnce();
    const url = (fetchFn.mock.calls[0] as unknown[])[0] as string;
    expect(url).toContain("developer.nlr.gov");
    // WKT is X Y = lng lat; encoded space is %20 or +.
    expect(decodeURIComponent(url)).toContain(`POINT(${LNG.toFixed(4)} ${LAT.toFixed(4)})`);
    expect(url).toContain("names=2019");
  });
});
