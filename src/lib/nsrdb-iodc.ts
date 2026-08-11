// ─────────────────────────────────────────────────────────────────────────
// NREL NSRDB — Meteosat IODC (msg-iodc-download) client (feature-flagged).
//
// This is the LIVE solar source for INDIA. Google Solar (google-solar.ts) has
// zero India coverage, so for the app's primary market it 404s and falls back
// to the coarse NASA POWER climatology. NSRDB's Meteosat IODC dataset was built
// by NREL specifically for India (and surrounding regions) under the U.S.–India
// Energy Cooperation, at 4km resolution.
//
// For an in-coverage coordinate this returns a full model-ready payload —
// monthly GHI (peak sun hours), monthly + annual air temperature, and wind —
// so the caller can REPLACE NASA entirely for India rather than augment it.
//
// Coverage/constraints (verified live against the API):
//   • Host: developer.nlr.gov (developer.nrel.gov retired; nlr.gov confirmed as
//     DoE/NREL via the CISA federal .gov registry).
//   • Single POINT + single YEAR per CSV; IODC years are 2017/2018/2019 only.
//   • 8760 hourly rows via an S3 302 redirect (fetch follows it automatically).
//
// Gated behind NSRDB_API_KEY. Every failure mode (flag off, out of coverage,
// missing email, transport error/timeout, non-2xx, empty/garbled CSV) resolves
// to `null`; the caller then falls back to NASA POWER. This client NEVER throws.
// ─────────────────────────────────────────────────────────────────────────

import { getRegionalPSH } from "./india-grid";

const NSRDB_IODC_ENDPOINT =
  "https://developer.nlr.gov/api/nsrdb/v2/solar/msg-iodc-download.csv";

// Latest IODC year available (only 2017/2018/2019 exist for this dataset).
const NSRDB_IODC_YEAR = "2019";

// IODC coverage box. Deliberately broader than india-grid.ts's per-state
// envelope so "India and surrounding regions" (Sri Lanka, Pakistan, Nepal,
// Bangladesh, Bhutan, Myanmar fringe) resolve to a real grid site rather than
// a distant/garbage nearest-point. Tunable.
const IODC_LAT_MIN = 5;
const IODC_LAT_MAX = 38;
const IODC_LNG_MIN = 60;
const IODC_LNG_MAX = 100;

const FETCH_TIMEOUT_MS = 15000;

// Below this many distinct days of usable data the payload is treated as
// garbled (a full year is 365) and discarded rather than fed to the model.
const MIN_USABLE_DAYS = 300;

const MONTHS_PER_YEAR = 12;

/** Model-ready payload derived from an NSRDB IODC year of hourly data. */
export interface NsrdbIodcPayload {
  source: "NSRDB_IODC";
  /** 12 monthly means of daily insolation (kWh/m²/day) — same shape as NASA. */
  monthly_ghi: number[];
  /** Annual mean 2 m air temperature (°C). */
  t2m: number;
  /** 12 monthly mean air temperatures (°C). */
  t2m_monthly: number[];
  /** Annual mean wind speed (m/s). See wind-height caveat in fetchNsrdbIodc. */
  ws10m: number;
  ws50m?: number;
  /** Human-readable region label (reused from the india-grid lookup). */
  region: string;
  /** IODC year the data was drawn from, for provenance/debugging. */
  nsrdb_year: string;
}

/** True when the NSRDB integration is switched on for this environment. */
export function isNsrdbEnabled(): boolean {
  return !!process.env.NSRDB_API_KEY;
}

/** Bounding-box test for the IODC coverage region. */
export function isWithinIodcCoverage(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return (
    lat >= IODC_LAT_MIN &&
    lat <= IODC_LAT_MAX &&
    lng >= IODC_LNG_MIN &&
    lng <= IODC_LNG_MAX
  );
}

/** Column indices resolved by name from the NSRDB CSV header row. */
interface ColumnMap {
  month: number;
  day: number;
  ghi: number;
  temp: number;
  wind: number;
}

/**
 * Locate the required columns by header NAME (never by fixed position — NSRDB
 * column order shifts with the requested `attributes`). Returns null when a
 * required column is absent. `Wind Speed` is optional.
 */
function resolveColumns(header: string[]): ColumnMap | null {
  const idx = (name: string) =>
    header.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());
  const month = idx("Month");
  const day = idx("Day");
  const ghi = idx("GHI");
  const temp = idx("Temperature");
  const wind = idx("Wind Speed");
  if (month < 0 || day < 0 || ghi < 0 || temp < 0) return null;
  return { month, day, ghi, temp, wind };
}

interface ParsedIodc {
  monthly_ghi: number[];
  t2m_monthly: number[];
  t2m: number;
  ws10m: number;
  usableDays: number;
}

/**
 * Parse an 8760-row IODC hourly CSV into monthly aggregates.
 *
 * NSRDB CSV layout: 2 metadata rows, then a column-header row, then hourly data.
 * With interval=60 each hourly GHI (W/m²) contributes that many Wh/m² for the
 * hour, so a month's Σ(GHI)/1000 is its total kWh/m² and dividing by the days
 * present yields the mean daily insolation the model expects (kWh/m²/day).
 */
function parseIodcCsv(text: string): ParsedIodc | null {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 4) return null; // 2 meta + header + >=1 data row

  const header = lines[2].split(",");
  const cols = resolveColumns(header);
  if (!cols) return null;

  const ghiSum = new Array(MONTHS_PER_YEAR).fill(0);
  const tempSum = new Array(MONTHS_PER_YEAR).fill(0);
  const tempCount = new Array(MONTHS_PER_YEAR).fill(0);
  const daysPresent: Array<Set<number>> = Array.from(
    { length: MONTHS_PER_YEAR },
    () => new Set<number>(),
  );
  let windSum = 0;
  let windCount = 0;

  for (let i = 3; i < lines.length; i++) {
    const c = lines[i].split(",");
    const month = Number(c[cols.month]);
    const day = Number(c[cols.day]);
    const ghi = Number(c[cols.ghi]);
    const temp = Number(c[cols.temp]);
    if (
      !Number.isFinite(month) ||
      month < 1 ||
      month > 12 ||
      !Number.isFinite(day) ||
      !Number.isFinite(ghi) ||
      ghi < 0
    ) {
      continue; // skip garbled / fill-value rows
    }
    const m = month - 1;
    ghiSum[m] += ghi;
    daysPresent[m].add(day);
    if (Number.isFinite(temp)) {
      tempSum[m] += temp;
      tempCount[m] += 1;
    }
    if (cols.wind >= 0) {
      const wind = Number(c[cols.wind]);
      if (Number.isFinite(wind) && wind >= 0) {
        windSum += wind;
        windCount += 1;
      }
    }
  }

  const monthly_ghi: number[] = [];
  const t2m_monthly: number[] = [];
  let usableDays = 0;
  let tempTotal = 0;
  let tempTotalCount = 0;

  for (let m = 0; m < MONTHS_PER_YEAR; m++) {
    const nDays = daysPresent[m].size;
    if (nDays === 0) return null; // a full IODC year has every month populated
    usableDays += nDays;
    monthly_ghi.push(Math.round((ghiSum[m] / 1000 / nDays) * 100) / 100);
    const monthTemp = tempCount[m] > 0 ? tempSum[m] / tempCount[m] : 0;
    t2m_monthly.push(Math.round(monthTemp * 10) / 10);
    tempTotal += tempSum[m];
    tempTotalCount += tempCount[m];
  }

  const t2m =
    tempTotalCount > 0 ? Math.round((tempTotal / tempTotalCount) * 10) / 10 : 0;
  const ws10m = windCount > 0 ? Math.round((windSum / windCount) * 100) / 100 : 0;

  return { monthly_ghi, t2m_monthly, t2m, ws10m, usableDays };
}

/**
 * Fetch and normalize an NSRDB IODC year for a coordinate.
 *
 * Resolves to `null` — never throws — for every non-success outcome so the
 * caller can transparently fall back to NASA POWER:
 *   • NSRDB_API_KEY unset (feature flag off)
 *   • NSRDB_API_EMAIL unset (the API requires a valid registration email)
 *   • coordinate outside the IODC coverage box, or non-finite
 *   • network / transport failure or timeout (AbortController)
 *   • any non-2xx status
 *   • empty / header-only / garbled CSV, or fewer than MIN_USABLE_DAYS of data
 */
export async function fetchNsrdbIodc(
  lat: number,
  lng: number,
): Promise<NsrdbIodcPayload | null> {
  const apiKey = process.env.NSRDB_API_KEY;
  const email = process.env.NSRDB_API_EMAIL;
  if (!apiKey || !email) return null;
  if (!isWithinIodcCoverage(lat, lng)) return null;

  // WKT is lng-then-lat (X Y), unlike the lat/lng order used elsewhere.
  const wkt = `POINT(${lng.toFixed(4)} ${lat.toFixed(4)})`;
  const url =
    `${NSRDB_IODC_ENDPOINT}?api_key=${encodeURIComponent(apiKey)}` +
    `&wkt=${encodeURIComponent(wkt)}` +
    `&names=${NSRDB_IODC_YEAR}&interval=60&utc=false&leap_day=false` +
    `&attributes=ghi,air_temperature,wind_speed` +
    `&email=${encodeURIComponent(email)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let text: string;
  try {
    const response = await fetch(url, {
      headers: { Accept: "text/csv" },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    text = await response.text();
  } catch {
    // Transport failure, timeout/abort, offline → fall back to NASA POWER.
    return null;
  } finally {
    clearTimeout(timeout);
  }

  const parsed = parseIodcCsv(text);
  if (!parsed || parsed.usableDays < MIN_USABLE_DAYS) return null;

  const { region } = getRegionalPSH(lat, lng);

  return {
    source: "NSRDB_IODC",
    monthly_ghi: parsed.monthly_ghi,
    t2m: parsed.t2m,
    t2m_monthly: parsed.t2m_monthly,
    // Wind-height caveat: NSRDB `wind_speed` is a 2 m value while this field is
    // nominally 10 m. The downstream calc consumes only ws10m + t2m, and the
    // temperature derate dominates, so we map it directly and leave ws50m unset.
    ws10m: parsed.ws10m,
    region,
    nsrdb_year: NSRDB_IODC_YEAR,
  };
}
