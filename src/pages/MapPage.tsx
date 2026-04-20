import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { polygon as turfPolygon } from "@turf/helpers";
import turfArea from "@turf/area";
import { Search, Loader2, Minus, Plus, RotateCcw, AlertTriangle, MapPin, MousePointerClick, LocateFixed, Sparkles, Sun, Mic, MicOff } from "lucide-react";
import { useVoiceSearch } from "@/hooks/use-voice-search";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { fetchSolarIrradiance } from "@/lib/nasa-power";
import { runFullCalculation, type SolarAnalysis, SolarCalcError } from "@/lib/solar-calc";
import { computePanelLayout, type PanelRect } from "@/lib/panel-layout";
import Globe3D, { type Globe3DHandle } from "@/components/Globe3D";
import {
  ELECTRICITY_RATE_INR,
  MIN_ELECTRICITY_RATE,
  MAX_ELECTRICITY_RATE,
  USABLE_AREA_FACTOR,
  MIN_AREA_M2,
} from "@/lib/solar-defaults";
import { calcTiltAzimuthFactor, type Azimuth, AZIMUTH_LABELS } from "@/lib/tilt-azimuth";
import { detectDiscom, type DiscomInfo } from "@/lib/discom-rates";
import { detectBuildingAt, nearbyBuildings } from "@/lib/osm-buildings";
import { recommendBattery, type BackupMode } from "@/lib/battery-calc";
import { track } from "@/lib/analytics";
import PhotoRoofEstimator from "@/components/PhotoRoofEstimator";

type LatLng = { lat: number; lng: number };
type DrawState = "IDLE" | "DRAWING" | "COMPLETE";
type GuideStep = 1 | 2 | 3 | 4;

// ─── Nominatim suggestion type ─────────────────────────────
interface NominatimSuggestion {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  address?: Record<string, string>;
}

// ─── Marker icons ──────────────────────────────────────────
const vertexIcon = L.divIcon({
  className: "",
  html: `<div style="width:10px;height:10px;background:#fff;border:2px solid #3B82F6;border-radius:2px;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`,
  iconSize: [10, 10],
  iconAnchor: [5, 5],
});

const firstVertexIcon = L.divIcon({
  className: "",
  html: `
    <div style="position:relative;width:18px;height:18px;">
      <div style="position:absolute;inset:0;background:#22C55E;border-radius:50%;opacity:0.3;animation:startPulse 1.5s ease-in-out infinite;"></div>
      <div style="position:absolute;inset:3px;background:#22C55E;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 6px rgba(0,0,0,0.3);"></div>
    </div>
  `,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const CLOSE_SNAP_PX = 20;

// ─── Globe dismiss threshold ────────────────────────────────
// When the user scrolls the globe camera closer than this distance,
// the globe fades out and the Leaflet map takes over.
const GLOBE_DISMISS_DISTANCE = 250;

// Nominatim requires a valid User-Agent to not return 403
const NOMINATIM_HEADERS = {
  "Accept-Language": "en",
  "User-Agent": "SunPowerLinkSolarApp/1.0 (https://sunpowerlink.in)",
};

function calcAreaM2(latlngs: LatLng[]): number {
  if (latlngs.length < 3) return 0;
  const coords = latlngs.map((p) => [p.lng, p.lat] as [number, number]);
  coords.push(coords[0]);
  const poly = turfPolygon([coords]);
  return Math.round(turfArea(poly) * 10) / 10;
}

function calcCentroid(latlngs: LatLng[]): LatLng {
  const lat = latlngs.reduce((sum, p) => sum + p.lat, 0) / latlngs.length;
  const lng = latlngs.reduce((sum, p) => sum + p.lng, 0) / latlngs.length;
  return { lat, lng };
}

// ── Locale hint detection (smart bias) ─────────────────────
const FOREIGN_TOKENS = [
  "usa", "u.s.a", "america", "uk", "u.k", "england", "scotland", "wales", "ireland",
  "london", "manchester", "paris", "france", "berlin", "germany", "munich",
  "rome", "italy", "milan", "madrid", "spain", "barcelona",
  "tokyo", "japan", "osaka", "kyoto", "seoul", "korea",
  "beijing", "shanghai", "china", "hong kong", "taiwan", "taipei",
  "dubai", "uae", "abu dhabi", "qatar", "doha", "saudi",
  "singapore", "malaysia", "kuala lumpur", "thailand", "bangkok",
  "australia", "sydney", "melbourne", "canada", "toronto", "vancouver",
  "nyc", "new york", "los angeles", "san francisco", "chicago", "boston",
  "moscow", "russia", "istanbul", "turkey", "cairo", "egypt",
  "brazil", "rio", "mexico", "argentina",
];

const INDIA_TOKENS = [
  "india", "bharat",
  "mumbai", "delhi", "bangalore", "bengaluru", "kolkata", "chennai", "hyderabad",
  "pune", "ahmedabad", "jaipur", "lucknow", "kanpur", "nagpur", "indore", "bhopal",
  "patna", "surat", "vadodara", "thane", "noida", "gurgaon", "gurugram", "ghaziabad",
  "maharashtra", "karnataka", "tamil nadu", "kerala", "gujarat", "rajasthan",
  "punjab", "haryana", "telangana", "andhra pradesh", "odisha", "bihar",
  "uttar pradesh", "madhya pradesh", "west bengal", "assam", "goa",
];

function detectLocaleHint(query: string): { countryCode?: string; bias: boolean } {
  const q = query.toLowerCase();
  for (const tok of FOREIGN_TOKENS) {
    if (q.includes(tok)) return { bias: false };
  }
  for (const tok of INDIA_TOKENS) {
    if (q.includes(tok)) return { countryCode: "in", bias: true };
  }
  // Ambiguous → keep India default (app targets India)
  return { countryCode: "in", bias: true };
}

// ── Geocode helpers ────────────────────────────────────────

/** Low-level Nominatim search with configurable params */
async function nominatimSearch(
  query: string,
  opts: { countrycodes?: string; viewbox?: string; limit?: number } = {},
  signal?: AbortSignal,
): Promise<NominatimSuggestion[]> {
  const params = new URLSearchParams({
    format: "json",
    q: query,
    limit: String(opts.limit ?? 5),
    addressdetails: "1",
  });
  if (opts.countrycodes) params.set("countrycodes", opts.countrycodes);
  if (opts.viewbox) {
    params.set("viewbox", opts.viewbox);
    params.set("bounded", "0");
  }

  const url = `https://nominatim.openstreetmap.org/search?${params}`;
  const res = await fetch(url, { headers: NOMINATIM_HEADERS, signal });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/** Photon geocoder (Komoot) — much better fuzzy matching for POIs */
async function photonSearch(
  query: string,
  opts: { limit?: number; lat?: number; lon?: number } = {},
  signal?: AbortSignal,
): Promise<NominatimSuggestion[]> {
  const params = new URLSearchParams({
    q: query,
    limit: String(opts.limit ?? 5),
  });
  // Bias towards a location (e.g. center of India for Indian searches)
  if (opts.lat !== undefined && opts.lon !== undefined) {
    params.set("lat", String(opts.lat));
    params.set("lon", String(opts.lon));
  }

  const url = `https://photon.komoot.io/api/?${params}`;
  const res = await fetch(url, { signal });
  if (!res.ok) return [];
  const data = await res.json();

  // Convert Photon GeoJSON features to NominatimSuggestion format
  if (!data?.features?.length) return [];
  return data.features.map((f: Record<string, unknown>, i: number) => {
    const props = (f.properties || {}) as Record<string, string>;
    const geom = f.geometry as { coordinates?: [number, number] };
    const [lon, lat] = geom?.coordinates || [0, 0];
    const parts = [props.name, props.street, props.city || props.county, props.state, props.country].filter(Boolean);
    return {
      place_id: Date.now() + i,
      display_name: parts.join(", "),
      lat: String(lat),
      lon: String(lon),
      type: props.osm_value || "place",
      address: props,
    } as NominatimSuggestion;
  });
}

/** Extract normalized query words (2+ chars) */
function getQueryWords(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length >= 2);
}

/** Score how well a result matches the query (0–1+ scale) */
function scoreResult(result: NominatimSuggestion, queryWords: string[], indiaBias = true): number {
  const displayLower = (result.display_name || "").toLowerCase();
  let matched = 0;
  for (const word of queryWords) {
    if (displayLower.includes(word)) matched++;
  }
  const matchRatio = queryWords.length > 0 ? matched / queryWords.length : 0;
  const indiaBonus = indiaBias && displayLower.includes("india") ? 0.05 : 0;
  return matchRatio + indiaBonus;
}

/** Pick the best result from a list using query-word scoring */
function pickBestResult(results: NominatimSuggestion[], query: string, indiaBias = true): { lat: number; lng: number; label: string } {
  const queryWords = getQueryWords(query);
  let bestScore = -1;
  let best = results[0];

  for (const r of results) {
    const score = scoreResult(r, queryWords, indiaBias);
    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }

  return {
    lat: parseFloat(best.lat),
    lng: parseFloat(best.lon),
    label: best.display_name || query,
  };
}

/**
 * Multi-strategy geocoding: tries multiple services and query variations.
 * 1. Nominatim with India country code + viewport bias
 * 2. Nominatim global (no country restriction)
 * 3. Nominatim with ", India" appended
 * 4. Photon geocoder (best for fuzzy POI matching)
 */
async function geocodeAddress(
  query: string,
  mapBounds?: L.LatLngBounds,
): Promise<{ lat: number; lng: number; label: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  // Smart bias: India by default, drop country lock for explicit foreign queries
  const hint = detectLocaleHint(query);
  const biasIndia = hint.bias;
  const ccode = hint.countryCode;

  // Build viewbox from current map bounds to bias towards visible area
  let viewbox: string | undefined;
  let mapCenter: { lat: number; lng: number } | undefined;
  if (mapBounds) {
    const sw = mapBounds.getSouthWest();
    const ne = mapBounds.getNorthEast();
    viewbox = `${sw.lng.toFixed(4)},${ne.lat.toFixed(4)},${ne.lng.toFixed(4)},${sw.lat.toFixed(4)}`;
    const center = mapBounds.getCenter();
    mapCenter = { lat: center.lat, lng: center.lng };
  }

  // Phase 1: Run the two best strategies in parallel for speed
  // Nominatim + Photon (locale-aware)
  try {
    const [nominatimIndia, photonFallback] = await Promise.allSettled([
      nominatimSearch(query, { countrycodes: ccode, viewbox }, controller.signal),
      biasIndia
        ? photonSearch(query, { limit: 5, lat: mapCenter?.lat ?? 20.5, lon: mapCenter?.lng ?? 78.9 }, controller.signal)
        : photonSearch(query, { limit: 5 }, controller.signal),
    ]);

    // Collect & deduplicate all results from parallel strategies
    const allResults: NominatimSuggestion[] = [];
    const seenCoords = new Set<string>();

    for (const settled of [nominatimIndia, photonFallback]) {
      if (settled.status === "fulfilled") {
        for (const r of settled.value) {
          const coordKey = `${parseFloat(r.lat).toFixed(4)}_${parseFloat(r.lon).toFixed(4)}`;
          if (!seenCoords.has(coordKey)) {
            seenCoords.add(coordKey);
            allResults.push(r);
          }
        }
      }
    }

    // If we got results from phase 1, check match quality
    if (allResults.length > 0) {
      const queryWords = getQueryWords(query);

      // Score all results and find the best
      let bestScore = -1;
      let bestResult = allResults[0];
      for (const r of allResults) {
        const s = scoreResult(r, queryWords, biasIndia);
        if (s > bestScore) { bestScore = s; bestResult = r; }
      }

      // If all query words are matched, return immediately
      if (bestScore >= 0.99) {
        clearTimeout(timeoutId);
        return { lat: parseFloat(bestResult.lat), lng: parseFloat(bestResult.lon), label: bestResult.display_name || query };
      }

      // ── Phase 1.5: Locality-aware refinement ────────────────────
      // Some query words didn't match any result — they may be locality names
      // e.g. "army public school dighi" → "dighi" is unmatched
      const unmatchedWords: string[] = [];
      const matchedWords: string[] = [];
      for (const word of queryWords) {
        const matchesAny = allResults.some((r) => (r.display_name || "").toLowerCase().includes(word));
        if (matchesAny) matchedWords.push(word);
        else unmatchedWords.push(word);
      }

      if (unmatchedWords.length > 0 && unmatchedWords.length <= 3) {
        try {
          // Geocode the unmatched words as a locality (e.g. "dighi" → Dighi, Pune)
          const localityQuery = unmatchedWords.join(" ");
          const [localNom, localPhoton] = await Promise.allSettled([
            nominatimSearch(localityQuery, { countrycodes: ccode, limit: 2 }, controller.signal),
            biasIndia
              ? photonSearch(localityQuery, { limit: 2, lat: mapCenter?.lat ?? 20.5, lon: mapCenter?.lng ?? 78.9 }, controller.signal)
              : photonSearch(localityQuery, { limit: 2 }, controller.signal),
          ]);

          let localityLat: number | null = null;
          let localityLng: number | null = null;
          let localityLabel: string | null = null;

          for (const settled of [localNom, localPhoton]) {
            if (settled.status === "fulfilled" && settled.value.length > 0) {
              localityLat = parseFloat(settled.value[0].lat);
              localityLng = parseFloat(settled.value[0].lon);
              localityLabel = settled.value[0].display_name;
              break;
            }
          }

          if (localityLat !== null && localityLng !== null) {
            // Create a tight viewbox around the locality (~2 km radius)
            const delta = 0.02;
            const localViewbox = `${(localityLng - delta).toFixed(4)},${(localityLat + delta).toFixed(4)},${(localityLng + delta).toFixed(4)},${(localityLat - delta).toFixed(4)}`;

            // Search for the full query AND just the POI name near the locality
            const [fullNearby, poiNearby] = await Promise.allSettled([
              nominatimSearch(query, { viewbox: localViewbox, countrycodes: ccode }, controller.signal),
              matchedWords.length > 0
                ? nominatimSearch(matchedWords.join(" "), { viewbox: localViewbox, countrycodes: ccode }, controller.signal)
                : Promise.resolve([] as NominatimSuggestion[]),
            ]);

            // Check if any refined result is better
            let bestRefinedScore = bestScore;
            let bestRefined: NominatimSuggestion | null = null;
            for (const settled of [fullNearby, poiNearby]) {
              if (settled.status === "fulfilled") {
                for (const r of settled.value) {
                  const s = scoreResult(r, queryWords, biasIndia);
                  if (s > bestRefinedScore) {
                    bestRefinedScore = s;
                    bestRefined = r;
                  }
                }
              }
            }

            if (bestRefined) {
              clearTimeout(timeoutId);
              return { lat: parseFloat(bestRefined.lat), lng: parseFloat(bestRefined.lon), label: bestRefined.display_name || query };
            }

            // No better POI found, but we know the locality —
            // navigate there so the user can visually find their building
            clearTimeout(timeoutId);
            return { lat: localityLat, lng: localityLng, label: localityLabel || `${query} area` };
          }
        } catch (err) {
          if ((err as Error).name === "AbortError") throw err;
          // Locality refinement failed — fall through to original best
        }
      }

      // Return best result from Phase 1 (partial match is better than nothing)
      clearTimeout(timeoutId);
      return { lat: parseFloat(bestResult.lat), lng: parseFloat(bestResult.lon), label: bestResult.display_name || query };
    }

    // Phase 2: Fallback strategies (only if phase 1 found nothing at all)
    const fallbackStrategies: Array<() => Promise<NominatimSuggestion[]>> = [
      () => nominatimSearch(query, { viewbox }, controller.signal),
    ];
    if (biasIndia) {
      fallbackStrategies.push(() => nominatimSearch(`${query}, India`, {}, controller.signal));
    }

    for (const fallback of fallbackStrategies) {
      try {
        const results = await fallback();
        if (results.length > 0) {
          clearTimeout(timeoutId);
          return pickBestResult(results, query, biasIndia);
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") throw err;
        continue;
      }
    }

    clearTimeout(timeoutId);
    throw new Error("Location not found. Try adding more details like city or state name.");
  } catch (error) {
    clearTimeout(timeoutId);
    if ((error as Error).name === "AbortError") {
      throw new Error("Search timed out. Please try again.");
    }
    throw error;
  }
}

/** Autocomplete: merges Nominatim + Photon results in parallel for faster, richer suggestions */
async function fetchSuggestions(
  query: string,
  signal: AbortSignal,
  mapCenter?: { lat: number; lng: number },
): Promise<NominatimSuggestion[]> {
  const hint = detectLocaleHint(query);
  const ccode = hint.countryCode;
  const biasIndia = hint.bias;

  // Run both geocoders in parallel — don't wait for one to fail before trying the other
  const [nominatimResults, photonResults] = await Promise.allSettled([
    nominatimSearch(query, { countrycodes: ccode, limit: 4 }, signal),
    biasIndia
      ? photonSearch(query, { limit: 3, lat: mapCenter?.lat ?? 20.5, lon: mapCenter?.lng ?? 78.9 }, signal)
      : photonSearch(query, { limit: 3 }, signal),
  ]);

  const results: NominatimSuggestion[] = [];
  const seenCoords = new Set<string>();

  // Add Nominatim results first (higher accuracy)
  if (nominatimResults.status === "fulfilled") {
    for (const r of nominatimResults.value) {
      const coordKey = `${parseFloat(r.lat).toFixed(3)}_${parseFloat(r.lon).toFixed(3)}`;
      if (!seenCoords.has(coordKey)) {
        seenCoords.add(coordKey);
        results.push(r);
      }
    }
  }

  // Add unique Photon results (better POI & fuzzy matching)
  if (photonResults.status === "fulfilled") {
    for (const r of photonResults.value) {
      const coordKey = `${parseFloat(r.lat).toFixed(3)}_${parseFloat(r.lon).toFixed(3)}`;
      if (!seenCoords.has(coordKey)) {
        seenCoords.add(coordKey);
        results.push(r);
      }
    }
  }

  // Cap at 6 suggestions for clean UI
  return results.slice(0, 6);
}

async function reverseGeocodeFull(
  lat: number, lng: number,
): Promise<{ label: string; state?: string; city?: string; country?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`;
    const res = await fetch(url, { headers: NOMINATIM_HEADERS, signal: controller.signal });
    clearTimeout(timeoutId);
    const data = await res.json();
    const addr = data?.address || {};
    const state = addr.state || addr.region;
    const city = addr.city || addr.town || addr.village || addr.suburb;
    const country = addr.country;
    let label: string;
    if (data?.display_name) {
      const parts = data.display_name.split(", ");
      label = parts.length >= 3
        ? `${parts[parts.length - 4] || parts[0]}, ${parts[parts.length - 3]}, ${parts[parts.length - 1]}`
        : data.display_name;
    } else {
      label = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
    return { label, state, city, country };
  } catch {
    return { label: `${lat.toFixed(4)}, ${lng.toFixed(4)}` };
  }
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  return (await reverseGeocodeFull(lat, lng)).label;
}

/** Format Nominatim suggestion into main + secondary text */
function formatSuggestion(s: NominatimSuggestion): { main: string; secondary: string } {
  const parts = s.display_name.split(", ");
  if (parts.length >= 3) {
    return {
      main: parts.slice(0, 2).join(", "),
      secondary: parts.slice(2, 5).join(", "),
    };
  }
  return { main: s.display_name, secondary: "" };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Calculation Progress — stepped skeleton with live stage text
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const CALC_STAGES = [
  { at: 0,    label: "Analyzing rooftop geometry…" },
  { at: 900,  label: "Fetching NASA POWER irradiance data…" },
  { at: 3200, label: "Computing panel layout & yield…" },
  { at: 5200, label: "Estimating subsidy & payback…" },
  { at: 6800, label: "Preparing your report…" },
];
const CalculationProgress = () => {
  const [stageIdx, setStageIdx] = useState(0);
  useEffect(() => {
    const timers = CALC_STAGES.map((s, i) => setTimeout(() => setStageIdx(i), s.at));
    return () => timers.forEach(clearTimeout);
  }, []);
  const pct = Math.min(95, ((stageIdx + 1) / CALC_STAGES.length) * 100);
  return (
    <div className="absolute inset-0 z-[2000] bg-foreground/50 backdrop-blur-sm flex items-center justify-center px-4" role="progressbar" aria-label="Analyzing solar potential" aria-valuenow={Math.round(pct)}>
      <div className="bg-sunpower-bg-card rounded-2xl shadow-float p-6 sm:p-8 w-full max-w-sm animate-fade-in">
        <div className="flex items-center gap-3 mb-4">
          <Loader2 className="w-6 h-6 text-sunpower-accent animate-spin shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-medium text-sunpower-text-primary">Analyzing Solar Potential</div>
            <div className="text-xs text-sunpower-text-muted mt-0.5 truncate">{CALC_STAGES[stageIdx].label}</div>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-5">
          <div
            className="h-full bg-gradient-to-r from-sunpower-accent to-orange-500 transition-all duration-700 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        {/* Stage checklist */}
        <div className="space-y-2">
          {CALC_STAGES.map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                i < stageIdx ? "bg-sunpower-success text-white" :
                i === stageIdx ? "bg-sunpower-accent text-white animate-pulse" :
                "bg-muted text-sunpower-text-muted"
              }`}>
                {i < stageIdx ? "✓" : <span className="text-[9px] font-semibold">{i + 1}</span>}
              </div>
              <span className={i <= stageIdx ? "text-sunpower-text-primary" : "text-sunpower-text-muted/60"}>
                {s.label.replace("…", "")}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MapPage Component
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const MapPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // ── Search state ────────────────────────────────────────
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [suggestions, setSuggestions] = useState<NominatimSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const suggestionsAbortRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // ── Drawing state ───────────────────────────────────────
  const [drawState, setDrawState] = useState<DrawState>("IDLE");
  const [vertexCount, setVertexCount] = useState(0);
  const [area, setArea] = useState<number | null>(null);
  const [areaWarning, setAreaWarning] = useState<string | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [electricityRate, setElectricityRate] = useState(ELECTRICITY_RATE_INR);
  const [showRateInput, setShowRateInput] = useState(false);
  const [locationLabel, setLocationLabel] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [panelCount, setPanelCount] = useState(0);
  // Voice search
  const voice = useVoiceSearch();
  useEffect(() => {
    // Push final voice transcript into query; trigger search when user stops speaking
    if (voice.transcript) {
      setQuery(voice.transcript);
    }
  }, [voice.transcript]);
  // Tilt + azimuth (Tier 2 — yield correction)
  const [tilt, setTilt] = useState(20);             // degrees, 0-45
  const [azimuth, setAzimuth] = useState<Azimuth>("S");
  const [showTiltControls, setShowTiltControls] = useState(false);
  // Discom info (auto-detected on flyToLocation / draw complete)
  const [discom, setDiscom] = useState<DiscomInfo | null>(null);
  // Multi-roof comparison — additional sections beyond the primary polygon
  const [extraSections, setExtraSections] = useState<{ id: string; areaM2: number; panelCount: number }[]>([]);
  // Backup/battery mode
  const [backupMode, setBackupMode] = useState<BackupMode>("none");
  // Photo estimator dialog
  const [photoEstOpen, setPhotoEstOpen] = useState(false);

  // ── Globe state (binary: visible or hidden) ─────────────────
  const [globeVisible, setGlobeVisible] = useState(true);
  const [globeFadingOut, setGlobeFadingOut] = useState(false);
  const globeRef = useRef<Globe3DHandle>(null);

  const guideStep: GuideStep =
    drawState === "COMPLETE" ? 4 :
    drawState === "DRAWING" ? 3 :
    hasSearched ? 2 : 1;

  // ── Drawing refs ────────────────────────────────────────
  const verticesRef = useRef<LatLng[]>([]);
  const markersRef = useRef<L.Marker[]>([]);
  const polylineRef = useRef<L.Polyline | null>(null);
  const previewLineRef = useRef<L.Polyline | null>(null);
  const closingLineRef = useRef<L.Polyline | null>(null);
  const polygonRef = useRef<L.Polygon | null>(null);
  const panelLayerRef = useRef<L.LayerGroup | null>(null);
  const drawStateRef = useRef<DrawState>("IDLE");
  const dblClickGuardRef = useRef(false);

  useEffect(() => { drawStateRef.current = drawState; }, [drawState]);

  // ── Close suggestions on outside click ──────────────────
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Autocomplete: debounced fetch on query change ───────
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (suggestionsAbortRef.current) suggestionsAbortRef.current.abort();

    if (query.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceTimerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      suggestionsAbortRef.current = controller;

      try {
        const center = mapRef.current?.getCenter();
        const mapCenter = center ? { lat: center.lat, lng: center.lng } : undefined;
        const results = await fetchSuggestions(query, controller.signal, mapCenter);
        if (!controller.signal.aborted) {
          setSuggestions(results);
          setShowSuggestions(results.length > 0);
          setActiveSuggestion(-1);
        }
      } catch {
        // Aborted or network error — ignore
      }
    }, 300);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [query]);

  // ── Init map ───────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [20.5937, 78.9629],
      zoom: 5,
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: false,   // disabled while globe is visible — enabled when globe hides
      dragging: false,          // disabled while globe is visible
      doubleClickZoom: false,
    });

    const googleSat = L.tileLayer(
      "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
      { attribution: "© Google", maxZoom: 21, subdomains: ["mt0", "mt1", "mt2", "mt3"] }
    );
    const esriSat = L.tileLayer(
      "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { attribution: "Tiles &copy; Esri", maxZoom: 21 }
    );
    const labels = L.tileLayer(
      "https://mt1.google.com/vt/lyrs=h&x={x}&y={y}&z={z}",
      { maxZoom: 21, opacity: 0.7, pane: "overlayPane" }
    );

    googleSat.on("tileerror", () => {
      if (!map.hasLayer(esriSat)) { googleSat.remove(); esriSat.addTo(map); labels.addTo(map); }
    });
    googleSat.addTo(map);
    labels.addTo(map);

    // Globe visibility is now driven by the Three.js camera distance,
    // not Leaflet zoom — see handleGlobeDistance callback below.

    // ── Click handler ──────────────────────────────────────
    const handleMapClick = (e: L.LeafletMouseEvent) => {
      const state = drawStateRef.current;
      if (state === "COMPLETE") return;
      if (dblClickGuardRef.current) { dblClickGuardRef.current = false; return; }

      const clickLatLng: LatLng = { lat: e.latlng.lat, lng: e.latlng.lng };

      // AUTO-CLOSE near first vertex
      if (state === "DRAWING" && verticesRef.current.length >= 3) {
        const first = verticesRef.current[0];
        const firstPx = map.latLngToContainerPoint(L.latLng(first.lat, first.lng));
        const clickPx = map.latLngToContainerPoint(e.latlng);
        if (firstPx.distanceTo(clickPx) <= CLOSE_SNAP_PX) {
          finishPolygon(map);
          return;
        }
      }

      verticesRef.current = [...verticesRef.current, clickLatLng];
      setVertexCount(verticesRef.current.length);

      const isFirst = verticesRef.current.length === 1;
      const marker = L.marker([clickLatLng.lat, clickLatLng.lng], { icon: isFirst ? firstVertexIcon : vertexIcon }).addTo(map);
      markersRef.current.push(marker);

      const coords = verticesRef.current.map((v) => [v.lat, v.lng] as [number, number]);
      if (polylineRef.current) {
        polylineRef.current.setLatLngs(coords);
      } else {
        polylineRef.current = L.polyline(coords, { color: "#3B82F6", weight: 2 }).addTo(map);
      }

      if (drawStateRef.current === "IDLE") setDrawState("DRAWING");
    };

    map.on("click", handleMapClick);

    // ── Mousemove: rubber-band + closing preview ───────────
    map.on("mousemove", (e: L.LeafletMouseEvent) => {
      if (drawStateRef.current !== "DRAWING" || verticesRef.current.length === 0) {
        previewLineRef.current?.remove(); previewLineRef.current = null;
        closingLineRef.current?.remove(); closingLineRef.current = null;
        return;
      }

      const lastV = verticesRef.current[verticesRef.current.length - 1];
      const previewCoords: [number, number][] = [[lastV.lat, lastV.lng], [e.latlng.lat, e.latlng.lng]];

      if (previewLineRef.current) previewLineRef.current.setLatLngs(previewCoords);
      else previewLineRef.current = L.polyline(previewCoords, { color: "#3B82F6", weight: 2, dashArray: "6, 8", opacity: 0.5 }).addTo(map);

      if (verticesRef.current.length >= 3) {
        const firstV = verticesRef.current[0];
        const closingCoords: [number, number][] = [[e.latlng.lat, e.latlng.lng], [firstV.lat, firstV.lng]];
        if (closingLineRef.current) closingLineRef.current.setLatLngs(closingCoords);
        else closingLineRef.current = L.polyline(closingCoords, { color: "#22C55E", weight: 2, dashArray: "4, 6", opacity: 0.4 }).addTo(map);

        const firstPx = map.latLngToContainerPoint(L.latLng(firstV.lat, firstV.lng));
        const cursorPx = map.latLngToContainerPoint(e.latlng);
        if (firstPx.distanceTo(cursorPx) <= CLOSE_SNAP_PX) {
          closingLineRef.current?.setStyle({ opacity: 0.8, weight: 3 });
          map.getContainer().style.cursor = "pointer";
        } else {
          closingLineRef.current?.setStyle({ opacity: 0.4, weight: 2 });
          map.getContainer().style.cursor = "crosshair";
        }
      } else {
        closingLineRef.current?.remove(); closingLineRef.current = null;
        map.getContainer().style.cursor = "crosshair";
      }
    });

    // ── Double-click to finish ─────────────────────────────
    map.on("dblclick", (e: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(e as unknown as Event);
      L.DomEvent.preventDefault(e as unknown as Event);
      if (drawStateRef.current !== "DRAWING") return;
      dblClickGuardRef.current = true;

      if (verticesRef.current.length > 3) {
        const lastV = verticesRef.current[verticesRef.current.length - 1];
        const secLastV = verticesRef.current[verticesRef.current.length - 2];
        if (Math.abs(lastV.lat - secLastV.lat) + Math.abs(lastV.lng - secLastV.lng) < 0.0001) {
          verticesRef.current = verticesRef.current.slice(0, -1);
          markersRef.current.pop()?.remove();
          setVertexCount(verticesRef.current.length);
        }
      }
      if (verticesRef.current.length >= 3) finishPolygon(map);
    });

    map.doubleClickZoom.disable();
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // ─── Finish polygon + panel overlay ────────────────────
  const finishPolygon = useCallback((map?: L.Map) => {
    const m = map || mapRef.current;
    if (!m || verticesRef.current.length < 3) return;

    polylineRef.current?.remove(); polylineRef.current = null;
    previewLineRef.current?.remove(); previewLineRef.current = null;
    closingLineRef.current?.remove(); closingLineRef.current = null;
    m.getContainer().style.cursor = "";

    const coords = verticesRef.current.map((v) => [v.lat, v.lng] as [number, number]);
    polygonRef.current = L.polygon(coords, {
      color: "#3B82F6", fillColor: "#3B82F6", fillOpacity: 0.1, weight: 2,
    }).addTo(m);

    const calculatedArea = calcAreaM2(verticesRef.current);
    setArea(calculatedArea);
    setDrawState("COMPLETE");

    if (calculatedArea < MIN_AREA_M2) {
      setAreaWarning(`Area is only ${calculatedArea} m². Minimum is ${MIN_AREA_M2} m² for accurate analysis.`);
    } else {
      setAreaWarning(null);
    }

    // ── Solar Panel Layout Overlay ──────────────────────────
    const layout = computePanelLayout(verticesRef.current);
    setPanelCount(layout.panelCount);

    if (layout.panelCount > 0) {
      const panelGroup = L.layerGroup();
      layout.panels.forEach((panel: PanelRect) => {
        const panelPoly = L.polygon(panel.corners, {
          color: "#1E3A5F",
          fillColor: "#2563EB",
          fillOpacity: 0.55,
          weight: 0.5,
          className: "solar-panel",
        });
        panelGroup.addLayer(panelPoly);
      });
      panelGroup.addTo(m);
      panelLayerRef.current = panelGroup;
    }

    const centroid = calcCentroid(verticesRef.current);
    reverseGeocodeFull(centroid.lat, centroid.lng).then((info) => {
      setLocationLabel(info.label);
      // Auto-detect discom + tariff
      const dc = detectDiscom({ state: info.state, label: info.label });
      if (dc) {
        setDiscom(dc);
        setElectricityRate(dc.rate);
      }
    });
  }, []);

  const handleDeleteLast = useCallback(() => {
    if (verticesRef.current.length === 0) return;
    verticesRef.current = verticesRef.current.slice(0, -1);
    setVertexCount(verticesRef.current.length);
    markersRef.current.pop()?.remove();

    if (verticesRef.current.length > 0) {
      const coords = verticesRef.current.map((v) => [v.lat, v.lng] as [number, number]);
      polylineRef.current?.setLatLngs(coords);
    } else {
      polylineRef.current?.remove(); polylineRef.current = null;
      previewLineRef.current?.remove(); previewLineRef.current = null;
      closingLineRef.current?.remove(); closingLineRef.current = null;
      setDrawState("IDLE");
    }
  }, []);

  const clearDrawing = useCallback(() => {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    verticesRef.current = [];
    setVertexCount(0);
    polylineRef.current?.remove(); polylineRef.current = null;
    previewLineRef.current?.remove(); previewLineRef.current = null;
    closingLineRef.current?.remove(); closingLineRef.current = null;
    polygonRef.current?.remove(); polygonRef.current = null;
    panelLayerRef.current?.remove(); panelLayerRef.current = null;
    setPanelCount(0);
    setArea(null);
    setAreaWarning(null);
    setDrawState("IDLE");
    setCalcError(null);
    if (mapRef.current) mapRef.current.getContainer().style.cursor = "";
  }, []);

  // ── Globe dismiss logic ────────────────────────────────────
  const globeDismissedRef = useRef(false);
  const lastGlobeCoordsRef = useRef<{lat: number, lng: number} | null>(null);

  // Dismiss the globe: fade out, then unmount and enable Leaflet interaction
  const dismissGlobe = useCallback((syncCoords = false) => {
    if (globeDismissedRef.current) return; // prevent double-dismiss
    globeDismissedRef.current = true;
    
    // Sync the map center immediately underneath the globe just as it starts fading
    if (syncCoords && lastGlobeCoordsRef.current && mapRef.current) {
      mapRef.current.setView(
        [Math.max(-85, Math.min(85, lastGlobeCoordsRef.current.lat)), lastGlobeCoordsRef.current.lng],
        5, // Match Leaflet's zoom out to the Globe's zoom in point
        { animate: false }
      );
    }
    
    setGlobeFadingOut(true);
    // After the CSS fade-out transition completes, fully unmount the globe
    setTimeout(() => {
      setGlobeVisible(false);
      setGlobeFadingOut(false);
      // Enable Leaflet interaction now that the globe is gone
      const map = mapRef.current;
      if (map) {
        map.scrollWheelZoom.enable();
        map.dragging.enable();
        map.doubleClickZoom.enable();
      }
    }, 600); // matches the CSS transition duration
  }, []);

  // Called by Globe3D every frame with camera distance.
  // When the user scrolls close enough, dismiss the globe.
  const handleGlobeDistance = useCallback((distance: number, lat?: number, lng?: number) => {
    if (lat !== undefined && lng !== undefined) {
      lastGlobeCoordsRef.current = { lat, lng };
    }
    if (distance <= GLOBE_DISMISS_DISTANCE) {
      dismissGlobe(true);
    }
  }, [dismissGlobe]);

  // ── Fly to a location (shared by search and suggestion click) ─
  const flyToLocation = useCallback((lat: number, lng: number, label: string) => {
    if (drawStateRef.current === "COMPLETE") clearDrawing();
    // Dismiss the globe immediately so the Leaflet map is visible
    dismissGlobe();
    // Small delay to let the map container become interactive before flyTo
    setTimeout(() => {
      mapRef.current?.flyTo([lat, lng], 18, { animate: true, duration: 1.5 });
    }, 100);
    setLocationLabel(label);
    setHasSearched(true);
    setShowSuggestions(false);
  }, [clearDrawing, dismissGlobe]);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSearchError("");
    setShowSuggestions(false);
    try {
      const bounds = mapRef.current?.getBounds();
      const { lat, lng, label } = await geocodeAddress(query, bounds);
      track("Search Submitted", { query: query.slice(0, 50) });
      flyToLocation(lat, lng, label);
    } catch (error) {
      const msg = (error as Error).message || "Location not found. Try again.";
      setSearchError(msg);
      toast({ title: "Location not found", description: "Please try a different address or use the autocomplete suggestions.", variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  const handleSuggestionClick = (s: NominatimSuggestion) => {
    const lat = parseFloat(s.lat);
    const lng = parseFloat(s.lon);
    setQuery(s.display_name.split(", ").slice(0, 3).join(", "));
    flyToLocation(lat, lng, s.display_name);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === "Enter") handleSearch();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveSuggestion((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveSuggestion((prev) => Math.max(prev - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeSuggestion >= 0 && activeSuggestion < suggestions.length) {
        handleSuggestionClick(suggestions[activeSuggestion]);
      } else {
        handleSearch();
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  const handleCalculate = async () => {
    if (!area || verticesRef.current.length < 3) return;
    if (area < MIN_AREA_M2) {
      setCalcError(`Area is too small (${area} m²). Please draw a larger rooftop (minimum ${MIN_AREA_M2} m²).`);
      return;
    }
    setCalculating(true);
    setCalcError(null);
    track("Calculate Click", { areaM2: area, sections: 1 + extraSections.length });

    try {
      const centroid = calcCentroid(verticesRef.current);
      const irradiance = await fetchSolarIrradiance(centroid.lat, centroid.lng);
      // Tilt + azimuth correction applied to PSH so all downstream math benefits
      const tiltFactor = calcTiltAzimuthFactor(tilt, azimuth);
      const correctedPsh = irradiance.peakSunHours * tiltFactor;
      // Sum extra roof sections into total area + panels
      const extraArea = extraSections.reduce((s, r) => s + r.areaM2, 0);
      const extraPanels = extraSections.reduce((s, r) => s + r.panelCount, 0);
      const totalArea = Math.round((area + extraArea) * 10) / 10;
      const totalPanels = panelCount + extraPanels;

      const analysis: SolarAnalysis = runFullCalculation(totalArea, correctedPsh, {
        electricityRate,
        irradianceSource: irradiance.source,
        monthlyIrradiance: irradiance.monthlyValues,
      });

      // Battery recommendation (sized against daily generation)
      const battery = recommendBattery(analysis.energy.dailyKwh, backupMode);

      const fullResult = {
        ...analysis,
        location: {
          lat: centroid.lat,
          lng: centroid.lng,
          label: locationLabel || `${centroid.lat.toFixed(4)}, ${centroid.lng.toFixed(4)}`,
        },
        panelCount: totalPanels,
        roof: {
          tilt,
          azimuth,
          tiltFactor,
          sectionsCount: 1 + extraSections.length,
          totalAreaM2: totalArea,
        },
        discom: discom ? { name: discom.discom, autoDetectedRate: discom.rate } : undefined,
        battery,
      };

      sessionStorage.setItem("sunpower-results", JSON.stringify(fullResult));
      setCalculating(false);
      navigate("/results");
    } catch (error) {
      setCalculating(false);
      let errorMsg = "Something went wrong. Please try again.";
      if (error instanceof SolarCalcError) errorMsg = error.message;
      else if ((error as Error).message) errorMsg = (error as Error).message;
      setCalcError(errorMsg);
      toast({ title: "Calculation Failed", description: errorMsg, variant: "destructive" });
    }
  };

  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();

  // ── Auto-detect rooftop polygon via OSM Overpass ───────────
  const [autoDetecting, setAutoDetecting] = useState(false);
  const [shadingNote, setShadingNote] = useState<string | null>(null);

  const handleAutoDetect = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    const center = map.getCenter();
    setAutoDetecting(true);
    try {
      const result = await detectBuildingAt(center.lat, center.lng, 30);
      if (!result || result.polygon.length < 3) {
        toast({
          title: "No building found",
          description: "Zoom in closer to a roof, then try again — or trace it manually.",
          variant: "destructive",
        });
        return;
      }
      // Replace any in-progress drawing
      clearDrawing();
      // Fill verticesRef from OSM polygon (excluding closing duplicate if present)
      const ring = result.polygon[0].lat === result.polygon[result.polygon.length - 1].lat
                 && result.polygon[0].lng === result.polygon[result.polygon.length - 1].lng
                 ? result.polygon.slice(0, -1)
                 : result.polygon;
      verticesRef.current = ring.map((p) => ({ lat: p.lat, lng: p.lng }));
      setVertexCount(verticesRef.current.length);
      // Drop markers for visual confirmation
      verticesRef.current.forEach((v, i) => {
        const marker = L.marker([v.lat, v.lng], { icon: i === 0 ? firstVertexIcon : vertexIcon }).addTo(map);
        markersRef.current.push(marker);
      });
      // Finish polygon (computes area + panel layout + reverse-geocodes)
      finishPolygon(map);
      // Fire-and-forget shading advisory
      nearbyBuildings(center.lat, center.lng, 50)
        .then((others) => {
          if (others.length === 0) {
            setShadingNote("Open exposure — no nearby buildings detected.");
            return;
          }
          const tallNeighbors = others.filter((b) => (b.levels ?? 1) >= 3 && b.distanceM < 25);
          if (tallNeighbors.length >= 2) {
            setShadingNote(`⚠️ ${tallNeighbors.length} tall buildings within 25 m — expect 10-25% shading loss in mornings/evenings.`);
          } else if (tallNeighbors.length === 1) {
            setShadingNote(`Possible shading from a tall neighbor (${tallNeighbors[0].levels}+ floors at ${Math.round(tallNeighbors[0].distanceM)} m).`);
          } else {
            setShadingNote(`${others.length} low-rise neighbors — minimal shading expected.`);
          }
        })
        .catch(() => { /* non-blocking */ });
      track("Auto-Detect Roof", { vertices: ring.length });
      toast({
        title: "Roof detected",
        description: `${ring.length}-vertex outline from OpenStreetMap.`,
      });
    } catch (err) {
      toast({
        title: "Auto-detect failed",
        description: (err as Error).message || "Try zooming closer or tracing manually.",
        variant: "destructive",
      });
    } finally {
      setAutoDetecting(false);
    }
  }, [clearDrawing, finishPolygon, toast]);

  // ── Photo estimator → synthetic square polygon at current center ─
  const handlePhotoAreaAccept = useCallback((areaM2: number) => {
    const map = mapRef.current;
    if (!map) return;
    clearDrawing();
    const center = map.getCenter();
    // Build a square polygon with the given area, centered on map view.
    // At this latitude, 1° latitude ≈ 110.54 km, 1° lng ≈ 111.32 * cos(lat) km.
    const side = Math.sqrt(areaM2); // meters
    const halfLat = (side / 2) / 110540;
    const halfLng = (side / 2) / (111320 * Math.cos(center.lat * Math.PI / 180));
    const corners: LatLng[] = [
      { lat: center.lat + halfLat, lng: center.lng - halfLng },
      { lat: center.lat + halfLat, lng: center.lng + halfLng },
      { lat: center.lat - halfLat, lng: center.lng + halfLng },
      { lat: center.lat - halfLat, lng: center.lng - halfLng },
    ];
    verticesRef.current = corners;
    setVertexCount(4);
    corners.forEach((v, i) => {
      const marker = L.marker([v.lat, v.lng], { icon: i === 0 ? firstVertexIcon : vertexIcon }).addTo(map);
      markersRef.current.push(marker);
    });
    finishPolygon(map);
    track("Photo Area Accepted", { areaM2 });
    toast({ title: "Area imported", description: `${areaM2} m² from your photo.` });
  }, [clearDrawing, finishPolygon, toast]);

  // ── Geolocation: "Find Me" → snap to user GPS ──────────────
  const [locating, setLocating] = useState(false);
  const handleLocateMe = useCallback(() => {
    if (!("geolocation" in navigator)) {
      toast({ title: "Location not supported", description: "Your browser doesn't support geolocation.", variant: "destructive" });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        let label = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        try { label = await reverseGeocode(lat, lng); } catch { /* keep coords */ }
        track("Location Found");
        flyToLocation(lat, lng, label);
        toast({ title: "Location found", description: label });
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        const msg = err.code === 1
          ? "Permission denied. Please allow location access in your browser settings."
          : err.code === 2
          ? "Location unavailable. Try searching for your address instead."
          : "Location request timed out.";
        toast({ title: "Couldn't find you", description: msg, variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, [flyToLocation, toast]);

  // ━━ Render ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  return (
    <div className="relative w-full h-screen overflow-hidden" role="main" aria-label="Rooftop Solar Map">
      {/* ── Leaflet map layer (always in DOM, interaction toggled) ── */}
      <div
        ref={mapContainerRef}
        className="absolute inset-0 z-[2]"
        role="application"
        aria-label="Interactive satellite map"
      />

      {/* ── Three.js 3D Globe — full viewport overlay ── */}
      {(globeVisible || globeFadingOut) && (
        <div
          className="absolute inset-0 z-[5]"
          style={{
            opacity: globeFadingOut ? 0 : 1,
            transition: "opacity 0.6s ease-in-out",
            background: "#000",
          }}
        >
          <Globe3D
            ref={globeRef}
            className="w-full h-full"
            onDistanceChange={handleGlobeDistance}
            stopRotation={hasSearched}
          />
          {/* Globe hint label */}
          {!globeFadingOut && (
            <div
              className="absolute bottom-[6%] left-1/2 -translate-x-1/2 flex items-center gap-2 px-5 py-2.5 rounded-full pointer-events-none"
              style={{
                background: "rgba(255,255,255,0.06)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <Search className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-xs text-white/60 font-medium tracking-wide">Search a location or scroll to zoom in</span>
            </div>
          )}
        </div>
      )}

      {/* ── Search Bar with Autocomplete ──────────────────── */}
      <div
        ref={searchContainerRef}
        className="absolute top-[max(1rem,env(safe-area-inset-top))] sm:top-6 left-14 sm:left-1/2 right-3 sm:right-auto sm:-translate-x-1/2 sm:w-[560px] z-[1000]"
      >
        <div
          className={`flex items-center bg-sunpower-bg-card/90 backdrop-blur-xl border border-white/20 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.15)] overflow-hidden transition-all duration-300 ${
            guideStep === 1 ? "ring-2 ring-sunpower-accent ring-offset-2 ring-offset-transparent" : ""
          } ${searchError ? "ring-2 ring-destructive" : ""} ${showSuggestions && suggestions.length > 0 ? "rounded-b-none" : ""}`}
          role="search"
          aria-label="Location search"
        >
          <div className="pl-4 text-sunpower-text-muted" aria-hidden="true">
            <Search className="w-4 h-4" />
          </div>
          <input
            id="location-search"
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSearchError(""); }}
            onKeyDown={handleSearchKeyDown}
            onFocus={() => { if (suggestions.length > 0 && query.length >= 2) setShowSuggestions(true); }}
            placeholder={t("map.searchPlaceholder")}
            className="flex-1 bg-transparent border-none outline-none px-3 py-3 text-[15px] text-sunpower-text-primary placeholder:text-sunpower-text-muted font-body"
            aria-label="Search for a location"
            autoComplete="off"
            role="combobox"
            aria-expanded={showSuggestions}
            aria-controls="search-suggestions"
            aria-activedescendant={activeSuggestion >= 0 ? `suggestion-${activeSuggestion}` : undefined}
          />
          {voice.supported && (
            <button
              onClick={() => {
                if (voice.listening) voice.stop();
                else {
                  // Use Hindi if UI language is Hindi; else Indian English
                  const lang = i18n.language.startsWith("hi") ? "hi-IN"
                             : i18n.language.startsWith("mr") ? "mr-IN"
                             : i18n.language.startsWith("ta") ? "ta-IN"
                             : i18n.language.startsWith("bn") ? "bn-IN"
                             : "en-IN";
                  voice.start(lang);
                  track("Search Submitted", { mode: "voice", lang });
                }
              }}
              className={`px-2.5 py-3 text-sm shrink-0 transition-colors ${
                voice.listening
                  ? "text-red-500 bg-red-500/10 animate-pulse"
                  : "text-sunpower-text-muted hover:text-sunpower-accent"
              }`}
              aria-label={voice.listening ? "Stop voice input" : "Start voice input"}
              title={voice.listening ? "Listening… tap to stop" : "Voice search"}
            >
              {voice.listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}
          <button
            onClick={handleSearch}
            disabled={searching}
            className="bg-sunpower-accent hover:bg-sunpower-accent-hover text-sunpower-accent-text px-3 sm:px-5 py-3 text-[15px] font-medium transition-colors disabled:opacity-70 flex items-center gap-2 shrink-0"
            aria-label="Search"
          >
            {searching ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <>
                <Search className="w-4 h-4 sm:hidden" aria-hidden="true" />
                <span className="hidden sm:inline">{t("map.search")}</span>
              </>
            )}
          </button>
        </div>

        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            id="search-suggestions"
            className="bg-sunpower-bg-card border-t border-foreground/[0.06] rounded-b-xl shadow-float overflow-hidden"
            role="listbox"
            aria-label="Location suggestions"
          >
            {suggestions.map((s, i) => {
              const { main, secondary } = formatSuggestion(s);
              return (
                <button
                  key={s.place_id}
                  id={`suggestion-${i}`}
                  role="option"
                  aria-selected={i === activeSuggestion}
                  className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors cursor-pointer ${
                    i === activeSuggestion ? "bg-sunpower-accent/10" : "hover:bg-foreground/[0.03]"
                  } ${i < suggestions.length - 1 ? "border-b border-foreground/[0.04]" : ""}`}
                  onClick={() => handleSuggestionClick(s)}
                >
                  <MapPin className="w-4 h-4 text-sunpower-text-muted mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-sunpower-text-primary truncate">{main}</div>
                    {secondary && (
                      <div className="text-xs text-sunpower-text-muted truncate mt-0.5">{secondary}</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {searchError && (
          <div className="mt-2 text-sm text-destructive bg-sunpower-bg-card rounded-md px-3 py-2 shadow-card flex items-center gap-2" role="alert">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            {searchError}
          </div>
        )}
        {voice.listening && (
          <div className="mt-2 text-xs text-sunpower-text-secondary bg-sunpower-bg-card rounded-md px-3 py-2 shadow-card flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            <span className="truncate">
              Listening{voice.interim ? ` · ${voice.interim}` : "…"}
            </span>
          </div>
        )}
        {voice.error && !voice.listening && (
          <div className="mt-2 text-xs text-destructive bg-sunpower-bg-card rounded-md px-3 py-2 shadow-card">
            {voice.error}
          </div>
        )}
      </div>

      {/* ── Theme Toggle + Zoom ──────────────────────────── */}
      <div className="absolute top-[max(1rem,env(safe-area-inset-top))] sm:top-6 left-3 sm:left-4 z-[1000] scale-90 sm:scale-100 origin-top-left flex flex-col gap-2">
        <ThemeToggle />
        <LanguageSwitcher />
      </div>

      <div className="absolute bottom-44 sm:bottom-8 right-3 sm:right-4 z-[1000] flex flex-col gap-1.5" role="group" aria-label="Map controls">
        <button
          onClick={handleLocateMe}
          disabled={locating}
          className="w-11 h-11 sm:w-10 sm:h-10 bg-sunpower-bg-card shadow-card rounded-lg flex items-center justify-center hover:bg-secondary active:scale-95 transition-all disabled:opacity-60"
          aria-label="Find my location"
          title="Find my location"
        >
          {locating
            ? <Loader2 className="w-5 h-5 sm:w-4 sm:h-4 text-sunpower-accent animate-spin" />
            : <LocateFixed className="w-5 h-5 sm:w-4 sm:h-4 text-sunpower-accent" />}
        </button>
        <button onClick={handleZoomIn} className="w-11 h-11 sm:w-10 sm:h-10 bg-sunpower-bg-card shadow-card rounded-lg flex items-center justify-center hover:bg-secondary active:scale-95 transition-all" aria-label="Zoom in">
          <Plus className="w-5 h-5 sm:w-4 sm:h-4 text-sunpower-text-primary" />
        </button>
        <button onClick={handleZoomOut} className="w-11 h-11 sm:w-10 sm:h-10 bg-sunpower-bg-card shadow-card rounded-lg flex items-center justify-center hover:bg-secondary active:scale-95 transition-all" aria-label="Zoom out">
          <Minus className="w-5 h-5 sm:w-4 sm:h-4 text-sunpower-text-primary" />
        </button>
      </div>

      {/* ── Drawing Toolbar ─────────────────────────────── */}
      {drawState === "DRAWING" && (
        <div className="absolute top-[calc(max(1rem,env(safe-area-inset-top))+56px)] sm:top-6 right-3 sm:right-4 flex gap-1.5 sm:gap-2 z-[1000] animate-fade-in" role="toolbar" aria-label="Drawing controls">
          <Button variant="ghost" size="sm" className="bg-sunpower-bg-card shadow-card" onClick={() => finishPolygon()} disabled={vertexCount < 3} aria-label="Finish drawing polygon">
            <span className="border-l-2 border-sunpower-success pl-2">{vertexCount >= 3 ? "Finish" : `${3 - vertexCount} more`}</span>
          </Button>
          <Button variant="ghost" size="sm" className="bg-sunpower-bg-card shadow-card" onClick={handleDeleteLast} aria-label="Undo last point">Undo</Button>
          <Button variant="ghost" size="sm" className="bg-sunpower-bg-card shadow-card" onClick={clearDrawing} aria-label="Cancel drawing">Cancel</Button>
        </div>
      )}

      {/* ── Progressive Step Guide ──────────────────────── */}
      {drawState !== "COMPLETE" && (
        <div
          className="absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] sm:bottom-8 inset-x-3 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[480px] z-[1000] mx-auto max-w-[480px]"
        >
          <div className="bg-sunpower-bg-card/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.15)] overflow-hidden">
            <div className="h-1 bg-muted">
              <div className="h-full bg-gradient-to-r from-sunpower-accent to-sunpower-accent transition-all duration-700 ease-out" style={{ width: `${(guideStep / 4) * 100}%` }} />
            </div>
            <div className="px-4 py-3 sm:px-5 sm:py-4">
              <div className="flex items-center gap-1.5 mb-2.5">
                {[1, 2, 3, 4].map((s) => (
                  <div key={s} className={`flex items-center gap-1 sm:gap-1.5 text-xs font-medium transition-all duration-300 ${guideStep === s ? "text-sunpower-accent" : guideStep > s ? "text-sunpower-success" : "text-sunpower-text-muted/40"}`}>
                    <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[9px] sm:text-[10px] font-semibold transition-all duration-300 ${guideStep === s ? "bg-sunpower-accent text-white scale-110" : guideStep > s ? "bg-sunpower-success text-white" : "bg-muted text-sunpower-text-muted"}`}>
                      {guideStep > s ? "✓" : s}
                    </div>
                    {s < 4 && <div className={`w-4 sm:w-8 h-px transition-colors duration-300 ${guideStep > s ? "bg-sunpower-success" : "bg-muted"}`} />}
                  </div>
                ))}
              </div>
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-300 ${
                  guideStep === 1 ? "bg-sunpower-accent/10 text-sunpower-accent" :
                  guideStep === 2 ? "bg-sunpower-info-light text-sunpower-info" :
                  "bg-sunpower-accent/10 text-sunpower-accent"
                }`}>
                  {guideStep === 1 && <Search className="w-4 h-4" />}
                  {guideStep === 2 && <MapPin className="w-4 h-4" />}
                  {guideStep === 3 && <MousePointerClick className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] sm:text-sm font-medium text-sunpower-text-primary leading-snug">
                    {guideStep === 1 && "Search your location"}
                    {guideStep === 2 && "Auto-detect or trace your rooftop"}
                    {guideStep === 3 && (vertexCount < 3 ? `Trace your rooftop edges · ${vertexCount} of 3 minimum` : "Click the green start point to complete the shape")}
                  </div>
                  <div className="text-[11px] sm:text-xs text-sunpower-text-muted mt-0.5 leading-tight sm:leading-relaxed">
                    {guideStep === 1 && "Type your city, area, or full address — suggestions will appear as you type"}
                    {guideStep === 2 && "Tap the magic button below to fetch your roof from OpenStreetMap, or click corners to trace manually"}
                    {guideStep === 3 && (vertexCount < 3 ? "Click on each corner of your roof to create the outline" : "Or double-click anywhere, or press the Finish button above")}
                  </div>
                </div>
              </div>
              {guideStep === 2 && (
                <div className="mt-3 space-y-2">
                  <button
                    onClick={handleAutoDetect}
                    disabled={autoDetecting}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-sunpower-accent to-orange-500 text-white font-medium text-sm py-2.5 rounded-lg hover:opacity-95 active:scale-[0.99] transition-all disabled:opacity-60 shadow-md"
                  >
                    {autoDetecting
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> {t("map.detecting")}</>
                      : <><Sparkles className="w-4 h-4" /> {t("map.autoDetect")}</>}
                  </button>
                  <button
                    onClick={() => setPhotoEstOpen(true)}
                    className="w-full flex items-center justify-center gap-2 bg-violet-500/10 hover:bg-violet-500/20 text-violet-600 border border-violet-500/20 font-medium text-xs py-2 rounded-lg transition-all"
                  >
                    📷 Or estimate from a photo
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Area Card + Panels + Calculate ───────────────── */}
      {drawState === "COMPLETE" && area !== null && (
        <div
          className="absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] sm:bottom-8 inset-x-3 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[420px] z-[1000] mx-auto max-w-[420px] animate-fade-in"
        >
          <div className="bg-sunpower-bg-card/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.15)] p-4 sm:p-6">
            <div className="text-center mb-4">
              <div className="text-sm text-sunpower-text-muted mb-1">Rooftop Area</div>
              <div className={`font-mono text-[32px] font-semibold ${areaWarning ? "text-destructive" : "text-sunpower-accent"}`} aria-label={`Rooftop area: ${area} square meters`}>
                {area} m²
              </div>
              <div className="flex items-center justify-center gap-3 text-xs text-sunpower-text-muted mt-1">
                <span>Usable: {Math.round(area * USABLE_AREA_FACTOR * 10) / 10} m²</span>
                {panelCount > 0 && (
                  <>
                    <span>·</span>
                    <span className="text-sunpower-info font-medium">{panelCount} panels fit</span>
                  </>
                )}
              </div>
            </div>

            {areaWarning && (
              <div className="mb-3 p-2.5 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive flex items-center gap-2" role="alert">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                {areaWarning}
              </div>
            )}

            {/* Multi-roof: extra sections summary */}
            {extraSections.length > 0 && (
              <div className="mb-3 p-2.5 bg-sunpower-info-light/40 border border-sunpower-info/20 rounded-lg text-xs text-sunpower-text-primary">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{1 + extraSections.length} sections combined</span>
                  <button
                    className="text-sunpower-info underline underline-offset-2"
                    onClick={() => setExtraSections([])}
                    aria-label="Clear extra sections"
                  >
                    Reset
                  </button>
                </div>
                <div className="mt-1 text-sunpower-text-muted">
                  Primary: {area} m² · {extraSections.map((s, i) => `+${s.areaM2} m²`).join(" ")}
                </div>
              </div>
            )}

            {/* Add another section CTA */}
            <button
              onClick={() => {
                if (area === null || verticesRef.current.length < 3) return;
                setExtraSections((prev) => [...prev, { id: `roof_${Date.now()}`, areaM2: area, panelCount }]);
                clearDrawing();
                toast({ title: "Section saved", description: "Draw the next roof section" });
              }}
              className="w-full mb-3 text-xs text-sunpower-info border border-dashed border-sunpower-info/40 rounded-lg py-2 hover:bg-sunpower-info-light/40 transition-colors"
            >
              + Add another roof section
            </button>

            {/* Shading advisory (from OSM nearby buildings) */}
            {shadingNote && (
              <div className="mb-3 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[11px] text-amber-700 dark:text-amber-300 flex items-start gap-2">
                <Sun className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span className="leading-tight">{shadingNote}</span>
              </div>
            )}

            {/* Discom badge */}
            {discom && (
              <div className="mb-3 px-2.5 py-1.5 bg-foreground/[0.03] rounded-md text-[11px] text-sunpower-text-muted flex items-center justify-between">
                <span className="truncate">⚡ {discom.discom}</span>
                <span className="font-mono shrink-0">auto · ₹{discom.rate}/kWh</span>
              </div>
            )}

            {/* Tilt + Azimuth — collapsible */}
            <div className="border-t border-foreground/[0.06] pt-3 mb-3">
              <button
                className="w-full flex items-center justify-between text-sm text-sunpower-text-secondary hover:text-sunpower-text-primary transition-colors"
                onClick={() => setShowTiltControls(!showTiltControls)}
                aria-expanded={showTiltControls}
              >
                <span>Roof tilt: {tilt}° · {AZIMUTH_LABELS[azimuth]}-facing</span>
                <span className="text-xs text-sunpower-accent underline underline-offset-2">{showTiltControls ? "Hide" : "Change"}</span>
              </button>
              {showTiltControls && (
                <div className="mt-3 space-y-3">
                  <div>
                    <div className="flex justify-between text-xs text-sunpower-text-muted mb-1">
                      <span>Tilt angle</span>
                      <span className="font-mono">{tilt}°</span>
                    </div>
                    <input
                      type="range" min={0} max={45} step={1} value={tilt}
                      onChange={(e) => setTilt(parseInt(e.target.value))}
                      className="w-full accent-sunpower-accent h-1.5 rounded-full"
                      aria-label="Roof tilt angle"
                    />
                    <div className="flex justify-between text-[10px] text-sunpower-text-muted mt-0.5">
                      <span>0° flat</span>
                      <span>20° optimal</span>
                      <span>45° steep</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-sunpower-text-muted mb-1.5">Roof faces</div>
                    <div className="grid grid-cols-4 gap-1">
                      {(["N","NE","E","SE","S","SW","W","NW"] as Azimuth[]).map((a) => (
                        <button
                          key={a}
                          onClick={() => setAzimuth(a)}
                          className={`px-1 py-1.5 text-[11px] rounded-md font-medium transition-colors ${
                            azimuth === a
                              ? "bg-sunpower-accent text-white"
                              : "bg-foreground/[0.04] text-sunpower-text-secondary hover:bg-foreground/[0.08]"
                          }`}
                        >
                          {a}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Backup / battery mode */}
            <div className="border-t border-foreground/[0.06] pt-3 mb-3">
              <div className="text-sm text-sunpower-text-secondary mb-2">Backup power?</div>
              <div className="grid grid-cols-3 gap-1.5">
                {([
                  { v: "none", label: "Grid-tied", sub: "No battery" },
                  { v: "evening", label: "Evening", sub: "4 hr backup" },
                  { v: "offgrid", label: "Off-grid", sub: "Full day" },
                ] as { v: BackupMode; label: string; sub: string }[]).map((o) => (
                  <button
                    key={o.v}
                    onClick={() => setBackupMode(o.v)}
                    className={`px-2 py-2 rounded-lg text-[11px] font-medium transition-all ${
                      backupMode === o.v
                        ? "bg-sunpower-accent text-white shadow"
                        : "bg-foreground/[0.04] text-sunpower-text-secondary hover:bg-foreground/[0.08]"
                    }`}
                  >
                    <div>{o.label}</div>
                    <div className="text-[9px] opacity-80">{o.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-foreground/[0.06] pt-3 mb-4">
              <button className="w-full flex items-center justify-between text-sm text-sunpower-text-secondary hover:text-sunpower-text-primary transition-colors" onClick={() => setShowRateInput(!showRateInput)} aria-expanded={showRateInput}>
                <span>Electricity Rate: ₹{electricityRate}/kWh</span>
                <span className="text-xs text-sunpower-accent underline underline-offset-2">{showRateInput ? "Hide" : "Change"}</span>
              </button>
              {showRateInput && (
                <div className="mt-3 flex items-center gap-3">
                  <span className="text-sm text-sunpower-text-muted">₹</span>
                  <input type="range" min={MIN_ELECTRICITY_RATE} max={MAX_ELECTRICITY_RATE} step={0.5} value={electricityRate} onChange={(e) => setElectricityRate(parseFloat(e.target.value))} className="flex-1 accent-sunpower-accent h-1.5 rounded-full" aria-label="Electricity rate" />
                  <div className="flex items-center gap-1 bg-secondary rounded-md px-2 py-1">
                    <input type="number" min={MIN_ELECTRICITY_RATE} max={MAX_ELECTRICITY_RATE} step={0.5} value={electricityRate} onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= MIN_ELECTRICITY_RATE && v <= MAX_ELECTRICITY_RATE) setElectricityRate(v); }} className="w-12 bg-transparent text-center text-sm font-mono text-sunpower-text-primary border-none outline-none" aria-label="Rate input" />
                    <span className="text-xs text-sunpower-text-muted">/kWh</span>
                  </div>
                </div>
              )}
            </div>

            {calcError && (
              <div className="mb-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive flex items-start gap-2" role="alert">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <div className="flex-1"><div className="font-medium">Calculation failed</div><div className="text-xs mt-0.5 opacity-80">{calcError}</div></div>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="shrink-0" onClick={clearDrawing} aria-label="Redraw polygon"><RotateCcw className="w-4 h-4" /></Button>
              <Button variant="cta" className="flex-1" onClick={handleCalculate} loading={calculating} disabled={!!areaWarning} aria-label={calcError ? "Retry" : "Calculate solar potential"}>
                {calculating ? t("map.analyzing") : calcError ? "Retry" : t("map.calculate")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Calculation overlay with progressive skeleton ── */}
      {calculating && <CalculationProgress />}

      {/* Photo-based area estimator */}
      <PhotoRoofEstimator
        open={photoEstOpen}
        onOpenChange={setPhotoEstOpen}
        onAccept={handlePhotoAreaAccept}
      />

      <style>{`
        @keyframes sunpowerPulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.3); }
        }
        @keyframes startPulse {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.8); opacity: 0; }
        }
        @keyframes twinkle {
          0%, 100% { opacity: 0.1; }
          50% { opacity: 0.8; }
        }
        .solar-panel {
          transition: fill-opacity 0.2s ease;
        }
        .solar-panel:hover {
          fill-opacity: 0.75 !important;
        }
      `}</style>
    </div>
  );
};

export default MapPage;
