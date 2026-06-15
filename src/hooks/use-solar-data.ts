import { useQuery } from "@tanstack/react-query";

interface SolarDataResponse {
  monthly_ghi: number[];
  lat: number;
  lng: number;
}

/**
 * Fetches monthly GHI data from the /api/solar-data Edge Function proxy.
 * Only runs when both lat and lng are non-null.
 * Results are cached for 24 hours, matching the Edge Function's Cache-Control header.
 */
export function useSolarData(lat: number | null, lng: number | null) {
  return useQuery<SolarDataResponse>({
    queryKey: ["solar-data", lat, lng],
    queryFn: async () => {
      const res = await fetch(`/api/solar-data?lat=${lat}&lng=${lng}`);
      if (!res.ok) {
        let message = `Solar data fetch failed: ${res.status} ${res.statusText}`.trim();
        try {
          const body = await res.json();
          if (body?.error) message = body.error;
        } catch {
          // ignore — non-JSON error body
        }
        throw new Error(message);
      }
      return res.json() as Promise<SolarDataResponse>;
    },
    enabled: lat !== null && lng !== null,
    staleTime: 1000 * 60 * 60 * 24, // 24 hours — matches Edge Function Cache-Control
  });
}
