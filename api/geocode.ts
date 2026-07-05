import { checkRateLimit } from "./_utils/rate-limit.js";

export const config = {
  runtime: "nodejs",
};

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

export default async function handler(req: Request): Promise<Response> {
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
          headers: { "User-Agent": "SunPowerLinkSolarApp/1.0" },
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

  async function fetchNominatimGeocode(queryStr: string): Promise<Response | null> {
    try {
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        queryStr.trim()
      )}&format=json&addressdetails=1&limit=1&accept-language=en`;
      const res = await fetch(nominatimUrl, {
        headers: { "User-Agent": "SunPowerLinkSolarApp/1.0" },
      });
      if (res.ok) {
        const nomData = await res.json();
        if (nomData && nomData.length > 0) {
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

