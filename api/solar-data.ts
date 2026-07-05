import * as Sentry from "@sentry/node";
import { checkRateLimit } from "./_utils/rate-limit.js";

export const config = {
  runtime: "nodejs",
};

interface NASAPowerResponse {
  properties: {
    parameter: {
      ALLSKY_SFC_SW_DWN: Record<string, number>;
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

  const nasaBaseUrl = process.env.NASA_POWER_BASE_URL || "https://power.larc.nasa.gov";
  const nasaUrl = `${nasaBaseUrl}/api/temporal/climatology/point?parameters=ALLSKY_SFC_SW_DWN&community=RE&longitude=${lng.toFixed(4)}&latitude=${lat.toFixed(4)}&format=JSON`;

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
    const monthly = data.properties?.parameter?.ALLSKY_SFC_SW_DWN;

    if (!monthly) {
      const err = new Error("Parameter 'ALLSKY_SFC_SW_DWN' is missing in the NASA response.");
      if (process.env.VITE_SENTRY_DSN) {
        Sentry.captureException(err, { extra: { lat, lng } });
      }
      return new Response(
        JSON.stringify({
          error: "NASA API unavailable",
          details: "Parameter 'ALLSKY_SFC_SW_DWN' is missing in the NASA response.",
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

    for (const key of monthKeys) {
      const val = monthly[key];
      if (typeof val !== "number") {
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
      monthlyGhi.push(val);
    }

    return new Response(
      JSON.stringify({
        monthly_ghi: monthlyGhi,
        lat,
        lng,
        year,
      }),
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

