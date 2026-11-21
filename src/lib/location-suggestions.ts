export interface LocationSuggestion {
  place_id: number | string;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  address?: Record<string, string>;
}

type GeocodeResponse =
  | LocationSuggestion[]
  | {
      place_id?: number | string;
      formatted_address?: string;
      display_name?: string;
      lat?: number | string;
      lng?: number | string;
      lon?: number | string;
      state?: string;
    };

function normalizeGeocodeResponse(data: GeocodeResponse): LocationSuggestion[] {
  if (Array.isArray(data)) return data;
  if (data && data.lat != null && (data.lng != null || data.lon != null)) {
    return [{
      place_id: data.place_id ?? data.display_name ?? data.formatted_address ?? "location",
      display_name: data.display_name ?? data.formatted_address ?? "Selected location",
      lat: String(data.lat),
      lon: String(data.lng ?? data.lon),
      type: "place",
      ...(data.state ? { address: { state: data.state } } : {}),
    }];
  }
  return [];
}

export async function fetchLocationSuggestions(
  query: string,
  signal: AbortSignal,
  mapCenter?: { lat: number; lng: number },
): Promise<LocationSuggestion[]> {
  try {
    const placesResponse = await fetch("/api/places/autocomplete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: query, mapCenter }),
      signal,
    });
    if (placesResponse.ok) {
      const placesData = await placesResponse.json();
      if (Array.isArray(placesData) && placesData.length > 0) return placesData;
    }
  } catch {
    // Continue with the server geocoder fallback.
  }

  try {
    const geocodeResponse = await fetch(`/api/geocode?q=${encodeURIComponent(query)}&limit=6`, { signal });
    if (!geocodeResponse.ok) return [];
    return normalizeGeocodeResponse(await geocodeResponse.json());
  } catch {
    return [];
  }
}
