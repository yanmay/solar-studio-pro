import * as Sentry from "@sentry/node";
import { checkRateLimit } from "./_utils/rate-limit.js";
import { getSupabaseAdmin } from "./_utils/supabase.js";
import { augmentPayloadWithGoogleSolar } from "../src/lib/google-solar";

export const config = {
  runtime: "nodejs",
};

interface NASAPowerResponse {
  properties: {
    parameter: {
      ALLSKY_SFC_SW_DWN?: Record<string, number>;
      WS10M?: Record<string, number>;
      WS50M?: Record<string, number>;
      T2M?: Record<string, number>;
    };
  };
}

if (process.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.VITE_SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed. Use GET." }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // SCN-008: Rate Limiting check
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const { allowed } = await checkRateLimit(ip, "solar-data", 20, 3600);
  if (!allowed) {
    return new Response(
      JSON.stringify({ error: "Too many requests. Try again in an hour." }),
      {
        status: 429,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const { searchParams } = new URL(req.url);
  const latStr = searchParams.get("lat");
  const lngStr = searchParams.get("lng");
  const yearStr = searchParams.get("year");

  if (!latStr || !lngStr) {
    return new Response(
      JSON.stringify({ error: "Missing required query parameters: 'lat' and 'lng'." }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);

  if (isNaN(lat) || isNaN(lng)) {
    return new Response(
      JSON.stringify({ error: "Invalid query parameters: 'lat' and 'lng' must be valid numbers." }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const currentYear = new Date().getFullYear();
  const defaultYear = currentYear - 1;
  let year = defaultYear;
  if (yearStr) {
    const parsedYear = parseInt(yearStr, 10);
    if (!isNaN(parsedYear)) {
      year = parsedYear;
    }
  }

  // PART A — NASA POWER cache check
  const latRounded = Math.round(lat * 100) / 100;
  const lngRounded = Math.round(lng * 100) / 100;
  const nowStr = new Date().toISOString();

  const supabase = getSupabaseAdmin();
  if (supabase) {
    try {
      const { data: cached } = await supabase
        .from("nasa_power_cache")
        .select("payload")
        .eq("lat", latRounded)
        .eq("lng", lngRounded)
        .gt("expires_at", nowStr)
        .maybeSingle();

      if (cached && cached.payload && cached.payload.ws10m !== undefined && cached.payload.t2m_monthly !== undefined) {
        // Google Solar is applied as a fresh override layer on top of the
        // cached NASA data (flag off → payload returned unchanged).
        const augmented = await augmentPayloadWithGoogleSolar(cached.payload, lat, lng);
        return new Response(
          JSON.stringify(augmented),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "public, max-age=86400",
            },
          }
        );
      }
    } catch (cacheError) {
      console.warn("NASA POWER cache lookup failed, proceeding to live API:", cacheError);
    }
  }

  const nasaBaseUrl = process.env.NASA_POWER_BASE_URL || "https://power.larc.nasa.gov";
  const nasaUrl = `${nasaBaseUrl}/api/temporal/climatology/point?parameters=ALLSKY_SFC_SW_DWN,WS10M,WS50M,T2M&community=RE&longitude=${lng.toFixed(4)}&latitude=${lat.toFixed(4)}&format=JSON`;

  try {
    const response = await fetch(nasaUrl, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          error: "NASA API unavailable",
          details: `HTTP ${response.status} ${response.statusText || ""}`.trim(),
        }),
        {
          status: 502,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const data: NASAPowerResponse = await response.json();
    const parameter = data.properties?.parameter;

    if (!parameter || !parameter.ALLSKY_SFC_SW_DWN || !parameter.WS10M || !parameter.WS50M || !parameter.T2M) {
      const err = new Error("Required parameters (ALLSKY_SFC_SW_DWN, WS10M, WS50M, T2M) are missing in the NASA response.");
      if (process.env.VITE_SENTRY_DSN) {
        Sentry.captureException(err, { extra: { lat, lng } });
      }
      return new Response(
        JSON.stringify({
          error: "NASA API unavailable",
          details: "Required meteorological parameters are missing in the NASA response.",
        }),
        {
          status: 502,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const monthKeys = [
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY",
      "JUN",
      "JUL",
      "AUG",
      "SEP",
      "OCT",
      "NOV",
      "DEC",
    ];
    const monthlyGhi: number[] = [];
    const t2mMonthly: number[] = [];
    const ws10mMonthly: number[] = [];
    const ws50mMonthly: number[] = [];

    for (const key of monthKeys) {
      const ghiVal = parameter.ALLSKY_SFC_SW_DWN[key];
      const ws10mVal = parameter.WS10M[key];
      const ws50mVal = parameter.WS50M[key];
      const t2mVal = parameter.T2M[key];

      if (
        typeof ghiVal !== "number" ||
        typeof ws10mVal !== "number" ||
        typeof ws50mVal !== "number" ||
        typeof t2mVal !== "number"
      ) {
        const err = new Error(`Missing monthly data value for key: ${key}`);
        if (process.env.VITE_SENTRY_DSN) {
          Sentry.captureException(err, { extra: { lat, lng } });
        }
        return new Response(
          JSON.stringify({
            error: "NASA API unavailable",
            details: `Missing monthly data value for key: ${key}`,
          }),
          {
            status: 502,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      monthlyGhi.push(ghiVal);
      t2mMonthly.push(t2mVal);
      ws10mMonthly.push(ws10mVal);
      ws50mMonthly.push(ws50mVal);
    }

    const ws10m = typeof parameter.WS10M.ANN === "number"
      ? parameter.WS10M.ANN
      : (ws10mMonthly.reduce((a, b) => a + b, 0) / 12);

    const ws50m = typeof parameter.WS50M.ANN === "number"
      ? parameter.WS50M.ANN
      : (ws50mMonthly.reduce((a, b) => a + b, 0) / 12);

    const t2m = typeof parameter.T2M.ANN === "number"
      ? parameter.T2M.ANN
      : (t2mMonthly.reduce((a, b) => a + b, 0) / 12);

    const returnedPayload = {
      monthly_ghi: monthlyGhi,
      lat,
      lng,
      year,
      ws10m,
      ws50m,
      t2m,
      t2m_monthly: t2mMonthly,
    };

    if (supabase) {
      try {
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const payload = {
          ...data,
          ...returnedPayload,
        };
        await supabase
          .from("nasa_power_cache")
          .insert({
            cache_key: `nasa_power:${latRounded}:${lngRounded}`,
            latitude: latRounded,
            longitude: lngRounded,
            lat: latRounded,
            lng: lngRounded,
            payload: payload,
            expires_at: expiresAt,
            monthly_ghi: monthlyGhi,
            monthly_temperature: t2mMonthly,
            monthly_wind_speed_10m: ws10mMonthly,
            monthly_wind_speed_50m: ws50mMonthly,
          });
      } catch (cacheInsertError) {
        console.warn("NASA POWER cache write failed:", cacheInsertError);
      }
    }

    // Cache stores the pure NASA payload above; Google Solar is layered onto
    // the response only, so coverage is re-checked fresh on every request
    // rather than frozen into the 30-day NASA cache.
    const responsePayload = await augmentPayloadWithGoogleSolar(returnedPayload, lat, lng);

    return new Response(
      JSON.stringify(responsePayload),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=86400",
        },
      }
    );
  } catch (error) {
    if (process.env.VITE_SENTRY_DSN) {
      Sentry.captureException(error, { extra: { lat, lng } });
    }
    return new Response(
      JSON.stringify({
        error: "NASA API unavailable",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

