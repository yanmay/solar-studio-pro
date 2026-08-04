import { useMutation } from "@tanstack/react-query";

interface GeocodeResponse {
  lat: number;
  lng: number;
  formatted_address: string;
  state?: string;
}

const INDIAN_CITIES: Record<string, { lat: number; lng: number; formatted_address: string; state: string }> = {
  pune: { lat: 18.5204, lng: 73.8567, formatted_address: "Pune, Maharashtra, India", state: "Maharashtra" },
  mumbai: { lat: 19.0760, lng: 72.8777, formatted_address: "Mumbai, Maharashtra, India", state: "Maharashtra" },
  delhi: { lat: 28.6139, lng: 77.2090, formatted_address: "New Delhi, Delhi, India", state: "Delhi" },
  "new delhi": { lat: 28.6139, lng: 77.2090, formatted_address: "New Delhi, Delhi, India", state: "Delhi" },
  bengaluru: { lat: 12.9716, lng: 77.5946, formatted_address: "Bengaluru, Karnataka, India", state: "Karnataka" },
  bangalore: { lat: 12.9716, lng: 77.5946, formatted_address: "Bengaluru, Karnataka, India", state: "Karnataka" },
  hyderabad: { lat: 17.3850, lng: 78.4867, formatted_address: "Hyderabad, Telangana, India", state: "Telangana" },
  chennai: { lat: 13.0827, lng: 80.2707, formatted_address: "Chennai, Tamil Nadu, India", state: "Tamil Nadu" },
  kolkata: { lat: 22.5726, lng: 88.3639, formatted_address: "Kolkata, West Bengal, India", state: "West Bengal" },
  ahmedabad: { lat: 23.0225, lng: 72.5714, formatted_address: "Ahmedabad, Gujarat, India", state: "Gujarat" },
  jaipur: { lat: 26.9124, lng: 75.7873, formatted_address: "Jaipur, Rajasthan, India", state: "Rajasthan" },
  surat: { lat: 21.1702, lng: 72.8311, formatted_address: "Surat, Gujarat, India", state: "Gujarat" },
  lucknow: { lat: 26.8467, lng: 80.9462, formatted_address: "Lucknow, Uttar Pradesh, India", state: "Uttar Pradesh" },
  nagpur: { lat: 21.1458, lng: 79.0882, formatted_address: "Nagpur, Maharashtra, India", state: "Maharashtra" },
  indore: { lat: 22.7196, lng: 75.8577, formatted_address: "Indore, Madhya Pradesh, India", state: "Madhya Pradesh" },
  thane: { lat: 19.2183, lng: 72.9781, formatted_address: "Thane, Maharashtra, India", state: "Maharashtra" },
  bhopal: { lat: 23.2599, lng: 77.4126, formatted_address: "Bhopal, Madhya Pradesh, India", state: "Madhya Pradesh" },
  visakhapatnam: { lat: 17.6868, lng: 83.2185, formatted_address: "Visakhapatnam, Andhra Pradesh, India", state: "Andhra Pradesh" },
  patna: { lat: 25.5941, lng: 85.1376, formatted_address: "Patna, Bihar, India", state: "Bihar" },
  vadodara: { lat: 22.3072, lng: 73.1812, formatted_address: "Vadodara, Gujarat, India", state: "Gujarat" },
  nashik: { lat: 19.9975, lng: 73.7898, formatted_address: "Nashik, Maharashtra, India", state: "Maharashtra" },
  faridabad: { lat: 28.4089, lng: 77.3178, formatted_address: "Faridabad, Haryana, India", state: "Haryana" },
  rajkot: { lat: 22.3039, lng: 70.8022, formatted_address: "Rajkot, Gujarat, India", state: "Gujarat" },
  varanasi: { lat: 25.3176, lng: 82.9739, formatted_address: "Varanasi, Uttar Pradesh, India", state: "Uttar Pradesh" },
  srinagar: { lat: 34.0837, lng: 74.7973, formatted_address: "Srinagar, Jammu and Kashmir, India", state: "Jammu and Kashmir" },
  aurangabad: { lat: 19.8762, lng: 75.3433, formatted_address: "Chhatrapati Sambhajinagar, Maharashtra, India", state: "Maharashtra" },
  amritsar: { lat: 31.6340, lng: 74.8723, formatted_address: "Amritsar, Punjab, India", state: "Punjab" },
  "navi mumbai": { lat: 19.0330, lng: 73.0297, formatted_address: "Navi Mumbai, Maharashtra, India", state: "Maharashtra" },
  ranchi: { lat: 23.3441, lng: 85.3096, formatted_address: "Ranchi, Jharkhand, India", state: "Jharkhand" },
  coimbatore: { lat: 11.0168, lng: 76.9558, formatted_address: "Coimbatore, Tamil Nadu, India", state: "Tamil Nadu" },
  vijayawada: { lat: 16.5062, lng: 80.6480, formatted_address: "Vijayawada, Andhra Pradesh, India", state: "Andhra Pradesh" },
  jodhpur: { lat: 26.2389, lng: 73.0243, formatted_address: "Jodhpur, Rajasthan, India", state: "Rajasthan" },
  madurai: { lat: 9.9252, lng: 78.1198, formatted_address: "Madurai, Tamil Nadu, India", state: "Tamil Nadu" },
  raipur: { lat: 21.2514, lng: 81.6296, formatted_address: "Raipur, Chhattisgarh, India", state: "Chhattisgarh" },
  chandigarh: { lat: 30.7333, lng: 76.7794, formatted_address: "Chandigarh, India", state: "Chandigarh" },
  guwahati: { lat: 26.1445, lng: 91.7362, formatted_address: "Guwahati, Assam, India", state: "Assam" },
  solapur: { lat: 17.6599, lng: 75.9064, formatted_address: "Solapur, Maharashtra, India", state: "Maharashtra" },
  hubli: { lat: 15.3647, lng: 75.1240, formatted_address: "Hubballi, Karnataka, India", state: "Karnataka" },
  mysore: { lat: 12.2958, lng: 76.6394, formatted_address: "Mysuru, Karnataka, India", state: "Karnataka" },
  gurgaon: { lat: 28.4595, lng: 77.0266, formatted_address: "Gurugram, Haryana, India", state: "Haryana" },
  gurugram: { lat: 28.4595, lng: 77.0266, formatted_address: "Gurugram, Haryana, India", state: "Haryana" },
  noida: { lat: 28.5355, lng: 77.3910, formatted_address: "Noida, Uttar Pradesh, India", state: "Uttar Pradesh" },
  dehradun: { lat: 30.3165, lng: 78.0322, formatted_address: "Dehradun, Uttarakhand, India", state: "Uttarakhand" },
  kochi: { lat: 9.9312, lng: 76.2673, formatted_address: "Kochi, Kerala, India", state: "Kerala" },
  bhubaneswar: { lat: 20.2961, lng: 85.8245, formatted_address: "Bhubaneswar, Odisha, India", state: "Odisha" },
  kolhapur: { lat: 16.7050, lng: 74.2433, formatted_address: "Kolhapur, Maharashtra, India", state: "Maharashtra" },
  shimla: { lat: 31.1048, lng: 77.1734, formatted_address: "Shimla, Himachal Pradesh, India", state: "Himachal Pradesh" },
  goa: { lat: 15.2993, lng: 74.1240, formatted_address: "Goa, India", state: "Goa" },
};

/** Call Nominatim directly — works without any backend server */
async function nominatimGeocode(address: string): Promise<GeocodeResponse> {
  const cleanKey = address.trim().toLowerCase();
  
  // 1. Check direct city match fallback first if available
  if (INDIAN_CITIES[cleanKey]) {
    return INDIAN_CITIES[cleanKey];
  }

  // 2. Query Nominatim (no custom User-Agent in browser fetch to avoid CORS/forbidden errors)
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      address.trim()
    )}&format=json&addressdetails=1&limit=1&accept-language=en`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data && data.length > 0) {
        const first = data[0];
        const state = first.address?.state || first.address?.county || undefined;
        return {
          lat: parseFloat(first.lat),
          lng: parseFloat(first.lon),
          formatted_address: first.display_name,
          state,
        };
      }
    }
  } catch {
    // Ignore and proceed to Photon API fallback
  }

  // 3. Photon API fallback (OpenStreetMap backend via Komoot)
  try {
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(address.trim())}&limit=1`;
    const pRes = await fetch(photonUrl);
    if (pRes.ok) {
      const pData = await pRes.json();
      if (pData?.features && pData.features.length > 0) {
        const feat = pData.features[0];
        const coords = feat.geometry?.coordinates;
        if (coords && coords.length >= 2) {
          const props = feat.properties || {};
          const labelParts = [props.name, props.city, props.state, props.country].filter(Boolean);
          return {
            lat: coords[1],
            lng: coords[0],
            formatted_address: labelParts.join(", ") || address,
            state: props.state,
          };
        }
      }
    }
  } catch {
    // Ignore
  }

  // 4. Fuzzy city lookup match fallback
  const foundCityKey = Object.keys(INDIAN_CITIES).find(c => cleanKey.includes(c));
  if (foundCityKey) {
    return INDIAN_CITIES[foundCityKey];
  }

  throw new Error("Address not found. Please try adding details like city or state name.");
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
      }

      return await nominatimGeocode(address);
    },
  });
}



