import * as Sentry from '@sentry/node';
import { checkRateLimit } from "./_utils/rate-limit.js";
import { toNodeHandler } from "./_utils/vercel-node.js";

if (process.env.VITE_SENTRY_DSN) {
  Sentry.init({ dsn: process.env.VITE_SENTRY_DSN, environment: process.env.NODE_ENV || 'production' });
}

interface GoogleGeocodingResult {
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  formatted_address: string;
  place_id: string;
  address_components?: {
    long_name: string;
    short_name: string;
    types: string[];
  }[];
}

interface GoogleGeocodingResponse {
  status: string;
  results: GoogleGeocodingResult[];
  error_message?: string;
}

async function handler(req: Request): Promise<Response> {
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed. Use GET." }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // SCN-008: Rate Limiting check
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const { allowed } = await checkRateLimit(ip, "geocode", 20, 3600);
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
  const q = searchParams.get("q");
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  if (!q && (!lat || !lng)) {
    return new Response(
      JSON.stringify({ error: "Missing required query parameter: 'q' or 'lat' and 'lng'." }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  if (q !== null && q.trim() === "") {
    return new Response(
      JSON.stringify({ error: "Query parameter 'q' cannot be empty." }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // ── REVERSE GEOCODE PATH ──
  if (lat && lng) {
    async function fetchNominatimReverse(latitude: string, longitude: string): Promise<Response | null> {
      try {
        const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${parseFloat(latitude).toFixed(6)}&lon=${parseFloat(longitude).toFixed(6)}&accept-language=en`;
        const res = await fetch(nominatimUrl, {
          headers: { "User-Agent": "SolarScanAIApp/1.0" },
        });
        if (res.ok) {
          const data = await res.json();
          return new Response(JSON.stringify(data), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "public, max-age=3600",
            },
          });
        }
      } catch (e) {
        console.warn("Nominatim reverse geocoding fallback failed:", e);
      }
      return null;
    }

    const apiKey = process.env.GOOGLE_GEOCODING_KEY;
    if (apiKey && apiKey !== "your_google_geocoding_key_here") {
      try {
        const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${parseFloat(lat).toFixed(6)},${parseFloat(lng).toFixed(6)}&key=${apiKey}`;
        const response = await fetch(googleUrl);
        if (response.ok) {
          const data = await response.json();
          if (data.status === "OK" && data.results && data.results.length > 0) {
            const first = data.results[0];
            const stateComp = first.address_components?.find((c: any) =>
              c.types.includes("administrative_area_level_1")
            );
            return new Response(
              JSON.stringify({
                display_name: first.formatted_address,
                address: {
                  state: stateComp ? stateComp.long_name : undefined,
                },
              }),
              {
                status: 200,
                headers: {
                  "Content-Type": "application/json",
                  "Cache-Control": "public, max-age=3600",
                },
              }
            );
          }
        }
      } catch (err) {
        console.error("Google reverse geocoding failed:", err);
      }
    }

    const nomResponse = await fetchNominatimReverse(lat, lng);
    if (nomResponse) return nomResponse;

    return new Response(
      JSON.stringify({ error: "Reverse geocoding service unavailable" }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Force TypeScript type assertion that q is string from this point forward
  const queryStr = q as string;
  const limitParam = Math.min(Math.max(parseInt(searchParams.get("limit") || "1", 10) || 1, 1), 10);

  async function fetchNominatimGeocode(queryStr: string): Promise<Response | null> {
    try {
      const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(queryStr.trim())}&limit=${limitParam}&lang=en`;
      const pRes = await fetch(photonUrl, {
        headers: { "User-Agent": "SolarScanAIApp/1.0" },
      });
      if (pRes.ok) {
        const pData = await pRes.json();
        const features = Array.isArray(pData?.features) ? pData.features : [];
        if (features.length > 0) {
          if (limitParam > 1) {
            const list = features
              .map((feat: any, idx: number) => {
                const coords = feat.geometry?.coordinates;
                if (!Array.isArray(coords) || coords.length < 2) return null;
                const p = feat.properties || {};
                const parts = Array.from(
                  new Set([p.name, p.street, p.locality || p.district, p.city, p.state, p.country].filter(Boolean))
                );
                return {
                  place_id: p.osm_id ? `${p.osm_type || "W"}-${p.osm_id}` : `photon-${idx}`,
                  display_name: parts.join(", ") || queryStr,
                  lat: String(coords[1]),
                  lon: String(coords[0]),
                  type: p.osm_value || p.type || "place",
                  ...(p.state ? { address: { state: p.state } } : {}),
                };
              })
              .filter(Boolean);
            if (list.length > 0) {
              return new Response(JSON.stringify(list), {
                status: 200,
                headers: {
                  "Content-Type": "application/json",
                  "Cache-Control": "public, max-age=3600",
                },
              });
            }
          } else {
            const first = features[0];
            const coords = first.geometry?.coordinates;
            if (Array.isArray(coords) && coords.length >= 2) {
              const p = first.properties || {};
              const parts = Array.from(
                new Set([p.name, p.street, p.locality || p.district, p.city, p.state, p.country].filter(Boolean))
              );
              return new Response(
                JSON.stringify({
                  lat: coords[1],
                  lng: coords[0],
                  formatted_address: parts.join(", ") || queryStr,
                  place_id: String(p.osm_id || "photon-0"),
                  state: p.state || undefined,
                }),
                {
                  status: 200,
                  headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "public, max-age=3600",
                  },
                }
              );
            }
          }
        }
      }
    } catch (e) {
      console.warn("Photon geocoding fallback failed:", e);
    }

    try {
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        queryStr.trim()
      )}&format=json&addressdetails=1&limit=${limitParam}&accept-language=en`;
      const res = await fetch(nominatimUrl, {
        headers: { "User-Agent": "SolarScanAIApp/1.0" },
      });
      if (res.ok) {
        const nomData = await res.json();
        if (nomData && nomData.length > 0) {
          if (limitParam > 1) {
            return new Response(JSON.stringify(nomData), {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, max-age=3600",
              },
            });
          }
          const first = nomData[0];
          return new Response(
            JSON.stringify({
              lat: parseFloat(first.lat),
              lng: parseFloat(first.lon),
              formatted_address: first.display_name,
              place_id: String(first.place_id),
              state: first.address?.state || undefined,
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, max-age=3600",
              },
            }
          );
        }
      }
    } catch (e) {
      console.warn("Nominatim geocoding fallback failed:", e);
    }
    return null;
  }

  const apiKey = process.env.GOOGLE_GEOCODING_KEY;
  if (!apiKey) {
    const nomResponse = await fetchNominatimGeocode(queryStr);
    if (nomResponse) return nomResponse;

    return new Response(
      JSON.stringify({ error: "Geocoding service misconfigured. API key is missing." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
    queryStr.trim()
  )}&key=${apiKey}`;

  try {
    const response = await fetch(googleUrl);

    if (!response.ok) {
      const nomResponse = await fetchNominatimGeocode(queryStr);
      if (nomResponse) return nomResponse;

      return new Response(
        JSON.stringify({ error: "Geocoding service unavailable" }),
        {
          status: 502,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const data: GoogleGeocodingResponse = await response.json();

    if (data.status !== "OK" || !data.results || data.results.length === 0) {
      const nomResponse = await fetchNominatimGeocode(queryStr);
      if (nomResponse) return nomResponse;

      return new Response(JSON.stringify({ error: "Address not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const firstResult = data.results[0];
    const lat = firstResult.geometry.location.lat;
    const lng = firstResult.geometry.location.lng;
    const formattedAddress = firstResult.formatted_address;
    const placeId = firstResult.place_id;

    // SCN-016: Extract state for DISCOM tariff lookup
    const stateComponent = firstResult.address_components?.find((comp) =>
      comp.types.includes("administrative_area_level_1")
    );
    const state = stateComponent ? stateComponent.long_name : undefined;

    return new Response(
      JSON.stringify({
        lat,
        lng,
        formatted_address: formattedAddress,
        place_id: placeId,
        state,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=3600",
        },
      }
    );
  } catch (err) {
    const nomResponse = await fetchNominatimGeocode(queryStr);
    if (nomResponse) return nomResponse;

    return new Response(
      JSON.stringify({ error: "Geocoding service unavailable", details: err instanceof Error ? err.message : String(err) }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

export default toNodeHandler(handler);

