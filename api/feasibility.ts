import * as Sentry from "@sentry/node";
import { checkRateLimit } from "./_utils/rate-limit";
import { runAutomatedFeasibility } from "../src/lib/feasibility-engine";

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

  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const { allowed } = await checkRateLimit(ip, "feasibility", 30, 3600);
  if (!allowed) {
    return new Response(
      JSON.stringify({ error: "Too many requests. Try again in an hour." }),
      {
        status: 429,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const url = new URL(req.url);
  const latStr = url.searchParams.get("lat");
  const lngStr = url.searchParams.get("lng");

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
      JSON.stringify({ error: "Invalid coordinates." }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    const report = await runAutomatedFeasibility(lat, lng);
    return new Response(JSON.stringify(report), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    if (process.env.VITE_SENTRY_DSN) {
      Sentry.captureException(error, { extra: { lat, lng } });
    }
    return new Response(
      JSON.stringify({
        error: "Feasibility computation failed",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
