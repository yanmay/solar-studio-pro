import { checkRateLimit } from "./_utils/rate-limit.js";
import { toNodeHandler } from "./_utils/vercel-node.js";

interface AutocompletePayload {
  input?: string;
  mapCenter?: { lat?: number; lng?: number };
}

interface LocationSuggestion {
  place_id: string | number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  address?: { state?: string };
}

async function fetchPhotonSuggestions(
  input: string,
  mapCenter?: { lat?: number; lng?: number },
): Promise<LocationSuggestion[]> {
  try {
    let url = `https://photon.komoot.io/api/?q=${encodeURIComponent(input)}&limit=6&lang=en`;
    if (typeof mapCenter?.lat === "number" && typeof mapCenter?.lng === "number") {
      url += `&lat=${mapCenter.lat.toFixed(4)}&lon=${mapCenter.lng.toFixed(4)}`;
    }
    const response = await fetch(url, {
      headers: { "User-Agent": "SolarScanAI/1.0" },
    });
    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data?.features)) return [];
    return data.features
      .map((feat: any, idx: number) => {
        const coords = feat.geometry?.coordinates;
        if (!Array.isArray(coords) || coords.length < 2) return null;
        const p = feat.properties || {};
        const parts = [p.name, p.street, p.locality || p.district, p.city, p.state, p.country].filter(Boolean);
        const deduped = Array.from(new Set(parts));
        return {
          place_id: p.osm_id ? `${p.osm_type || "W"}-${p.osm_id}` : `photon-${idx}`,
          display_name: deduped.join(", ") || input,
          lat: String(coords[1]),
          lon: String(coords[0]),
          type: p.osm_value || p.type || "place",
          ...(p.state ? { address: { state: p.state } } : {}),
        } as LocationSuggestion;
      })
      .filter(Boolean) as LocationSuggestion[];
  } catch {
    return [];
  }
}

async function fetchFallbackSuggestions(
  input: string,
  mapCenter?: { lat?: number; lng?: number },
): Promise<LocationSuggestion[]> {
  const photonResults = await fetchPhotonSuggestions(input, mapCenter);
  if (photonResults.length > 0) return photonResults;

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(input)}&format=json&addressdetails=1&limit=6&accept-language=en`,
      { headers: { "User-Agent": "SolarScanAI/1.0" } },
    );
    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data)) return [];
    return data.map((item) => ({
      place_id: item.place_id,
      display_name: item.display_name,
      lat: String(item.lat),
      lon: String(item.lon),
      type: item.type || "place",
      address: item.address,
    }));
  } catch {
    return [];
  }
}

async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed. Use POST." }, { status: 405 });
  }

  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const { allowed } = await checkRateLimit(ip, "places-autocomplete", 60, 3600);
  if (!allowed) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  let payload: AutocompletePayload;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const input = payload.input?.trim();
  if (!input) return Response.json([]);

  const apiKey = process.env.GOOGLE_PLACES_KEY || process.env.GOOGLE_GEOCODING_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || apiKey === "your_google_geocoding_key_here") {
    return Response.json(await fetchFallbackSuggestions(input));
  }

  try {
    const body: Record<string, unknown> = {
      input,
      languageCode: "en",
      regionCode: "IN",
    };
    const lat = payload.mapCenter?.lat;
    const lng = payload.mapCenter?.lng;
    if (typeof lat === "number" && typeof lng === "number") {
      body.locationBias = {
        circle: { center: { latitude: lat, longitude: lng }, radius: 100000 },
      };
    }

    const autocompleteResponse = await fetch(
      `https://places.googleapis.com/v1/places:autocomplete?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    if (!autocompleteResponse.ok) {
      return Response.json(await fetchFallbackSuggestions(input));
    }

    const autocompleteData = await autocompleteResponse.json();
    const predictions = (autocompleteData.suggestions || [])
      .map((suggestion) => suggestion.placePrediction)
      .filter(Boolean)
      .slice(0, 6);
    if (predictions.length === 0) {
      return Response.json(await fetchFallbackSuggestions(input));
    }

    const details = await Promise.all(
      predictions.map((prediction) =>
        fetch(`https://places.googleapis.com/v1/places/${prediction.placeId}?fields=location&key=${apiKey}`)
          .then((response) => response.ok ? response.json() : null)
          .catch(() => null),
      ),
    );

    const suggestions: LocationSuggestion[] = predictions.map((prediction, index) => ({
      place_id: prediction.placeId,
      display_name: prediction.text?.text || prediction.structuredFormat?.mainText?.text || input,
      lat: String(details[index]?.location?.latitude ?? 0),
      lon: String(details[index]?.location?.longitude ?? 0),
      type: "place",
    })).filter((suggestion) => suggestion.lat !== "0" && suggestion.lon !== "0");

    return Response.json(suggestions.length > 0 ? suggestions : await fetchFallbackSuggestions(input, payload.mapCenter));
  } catch {
    return Response.json(await fetchFallbackSuggestions(input, payload.mapCenter));
  }
}

export default toNodeHandler(handler);
