import { useMutation } from "@tanstack/react-query";

interface GeocodeResponse {
  lat: number;
  lng: number;
  formatted_address: string;
  state?: string;
}

/** Call Nominatim directly — works without any backend server */
async function nominatimGeocode(address: string): Promise<GeocodeResponse> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
    address.trim()
  )}&format=json&addressdetails=1&limit=1&accept-language=en`;
  const res = await fetch(url, {
    headers: { "User-Agent": "SunPowerLinkSolarApp/1.0" },
  });
  if (!res.ok) throw new Error("Geocoding service unavailable.");
  const data = await res.json();
  if (!data || data.length === 0) throw new Error("Address not found. Please try a different search.");
  const first = data[0];
  const state =
    first.address?.state ||
    first.address?.county ||
    undefined;
  return {
    lat: parseFloat(first.lat),
    lng: parseFloat(first.lon),
    formatted_address: first.display_name,
    state,
  };
}

export function useGeocode() {
  return useMutation<GeocodeResponse, Error, string>({
    mutationFn: async (address: string) => {
      // Try the backend proxy first
      try {
        const url = `/api/geocode?q=${encodeURIComponent(address.trim())}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        if (res.ok) {
          const data = await res.json();
          if (data?.lat != null) {
            return {
              lat: data.lat,
              lng: data.lng,
              formatted_address: data.formatted_address || address,
              state: data.state,
            };
          }
        }
        if (res.status === 429) {
          throw new Error("Too many requests. Please try again in an hour.");
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes("Too many")) throw err;
        // Any other error (timeout/ECONNREFUSED) → fall through to Nominatim
      }

      // Direct Nominatim call as fallback with Google client-side ultimate fallback
      try {
        return await nominatimGeocode(address);
      } catch (nomErr) {
        try {
          const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
            address.trim()
          )}&key=AIzaSyDFkPRXVfhHADwyZHtFy2j_XElhNqa2HS4`;
          const googleRes = await fetch(googleUrl);
          if (googleRes.ok) {
            const data = await googleRes.json();
            if (data.status === "OK" && data.results && data.results.length > 0) {
              const first = data.results[0];
              const stateComp = first.address_components?.find((c: any) =>
                c.types.includes("administrative_area_level_1")
              );
              return {
                lat: first.geometry.location.lat,
                lng: first.geometry.location.lng,
                formatted_address: first.formatted_address,
                state: stateComp ? stateComp.long_name : undefined,
              };
            }
          }
        } catch (googleErr) {
          console.warn("Client-side Google Geocoding fallback failed:", googleErr);
        }
        throw nomErr;
      }
    },
  });
}



