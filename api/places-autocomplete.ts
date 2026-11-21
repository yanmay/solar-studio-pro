import { checkRateLimit } from "./_utils/rate-limit.js";

export const config = {
  runtime: "nodejs",
};

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

async function fetchFallbackSuggestions(input: string): Promise<LocationSuggestion[]> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(input)}&format=json&addressdetails=1&limit=6&accept-language=en`,
      { headers: { "User-Agent": "SunPowerLinkSolarApp/1.0" } },
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

export default async function handler(req: Request): Promise<Response> {
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

    return Response.json(suggestions.length > 0 ? suggestions : await fetchFallbackSuggestions(input));
  } catch {
    return Response.json(await fetchFallbackSuggestions(input));
  }
}
