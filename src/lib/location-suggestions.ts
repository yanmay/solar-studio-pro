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
    if (geocodeResponse.ok) {
      const normalized = normalizeGeocodeResponse(await geocodeResponse.json());
      if (normalized.length > 0) return normalized;
    }
  } catch {
    // Continue with client-side Photon fallback.
  }

  try {
    let photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=6&lang=en`;
    if (typeof mapCenter?.lat === "number" && typeof mapCenter?.lng === "number") {
      photonUrl += `&lat=${mapCenter.lat.toFixed(4)}&lon=${mapCenter.lng.toFixed(4)}`;
    }
    const photonRes = await fetch(photonUrl, { signal });
    if (!photonRes.ok) return [];
    const photonData = await photonRes.json();
    if (!Array.isArray(photonData?.features)) return [];
    return photonData.features
      .map((feat: any, idx: number) => {
        const coords = feat.geometry?.coordinates;
        if (!Array.isArray(coords) || coords.length < 2) return null;
        const p = feat.properties || {};
        const parts = Array.from(
          new Set([p.name, p.street, p.locality || p.district, p.city, p.state, p.country].filter(Boolean)),
        );
        return {
          place_id: p.osm_id ? `${p.osm_type || "W"}-${p.osm_id}` : `photon-${idx}`,
          display_name: parts.join(", ") || query,
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
