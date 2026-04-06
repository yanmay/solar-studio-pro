import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { polygon as turfPolygon } from "@turf/helpers";
import turfArea from "@turf/area";
import { Search, Loader2, Minus, Plus, RotateCcw, AlertTriangle, MapPin, MousePointerClick } from "lucide-react";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ThemeToggle";
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
  "User-Agent": "UrjaLinkSolarApp/1.0 (https://urjalink.in)",
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
function scoreResult(result: NominatimSuggestion, queryWords: string[]): number {
  const displayLower = (result.display_name || "").toLowerCase();
  let matched = 0;
  for (const word of queryWords) {
    if (displayLower.includes(word)) matched++;
  }
  const matchRatio = queryWords.length > 0 ? matched / queryWords.length : 0;
  const indiaBonus = displayLower.includes("india") ? 0.05 : 0;
  return matchRatio + indiaBonus;
}

/** Pick the best result from a list using query-word scoring */
function pickBestResult(results: NominatimSuggestion[], query: string): { lat: number; lng: number; label: string } {
  const queryWords = getQueryWords(query);
  let bestScore = -1;
  let best = results[0];

  for (const r of results) {
    const score = scoreResult(r, queryWords);
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
  // Nominatim (India-biased) + Photon (better POI fuzzy matching)
  try {
    const [nominatimIndia, photonFallback] = await Promise.allSettled([
      nominatimSearch(query, { countrycodes: "in", viewbox }, controller.signal),
      photonSearch(query, { limit: 5, lat: mapCenter?.lat ?? 20.5, lon: mapCenter?.lng ?? 78.9 }, controller.signal),
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
        const s = scoreResult(r, queryWords);
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
            nominatimSearch(localityQuery, { countrycodes: "in", limit: 2 }, controller.signal),
            photonSearch(localityQuery, { limit: 2, lat: mapCenter?.lat ?? 20.5, lon: mapCenter?.lng ?? 78.9 }, controller.signal),
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
              nominatimSearch(query, { viewbox: localViewbox, countrycodes: "in" }, controller.signal),
              matchedWords.length > 0
                ? nominatimSearch(matchedWords.join(" "), { viewbox: localViewbox, countrycodes: "in" }, controller.signal)
                : Promise.resolve([] as NominatimSuggestion[]),
            ]);

            // Check if any refined result is better
            let bestRefinedScore = bestScore;
            let bestRefined: NominatimSuggestion | null = null;
            for (const settled of [fullNearby, poiNearby]) {
              if (settled.status === "fulfilled") {
                for (const r of settled.value) {
                  const s = scoreResult(r, queryWords);
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
    const fallbackStrategies = [
      () => nominatimSearch(query, { viewbox }, controller.signal),
      () => nominatimSearch(`${query}, India`, {}, controller.signal),
    ];

    for (const fallback of fallbackStrategies) {
      try {
        const results = await fallback();
        if (results.length > 0) {
          clearTimeout(timeoutId);
          return pickBestResult(results, query);
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
  // Run both geocoders in parallel — don't wait for one to fail before trying the other
  const [nominatimResults, photonResults] = await Promise.allSettled([
    nominatimSearch(query, { countrycodes: "in", limit: 4 }, signal),
    photonSearch(query, { limit: 3, lat: mapCenter?.lat ?? 20.5, lon: mapCenter?.lng ?? 78.9 }, signal),
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

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14`;
    const res = await fetch(url, { headers: NOMINATIM_HEADERS, signal: controller.signal });
    clearTimeout(timeoutId);
    const data = await res.json();
    if (data?.display_name) {
      const parts = data.display_name.split(", ");
      if (parts.length >= 3) return `${parts[parts.length - 4] || parts[0]}, ${parts[parts.length - 3]}, ${parts[parts.length - 1]}`;
      return data.display_name;
    }
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
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
// MapPage Component
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const MapPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
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
    reverseGeocode(centroid.lat, centroid.lng).then((label) => setLocationLabel(label));
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

    try {
      const centroid = calcCentroid(verticesRef.current);
      const irradiance = await fetchSolarIrradiance(centroid.lat, centroid.lng);
      const analysis: SolarAnalysis = runFullCalculation(area, irradiance.peakSunHours, {
        electricityRate,
        irradianceSource: irradiance.source,
        monthlyIrradiance: irradiance.monthlyValues,
      });

      const fullResult = {
        ...analysis,
        location: {
          lat: centroid.lat,
          lng: centroid.lng,
          label: locationLabel || `${centroid.lat.toFixed(4)}, ${centroid.lng.toFixed(4)}`,
        },
        panelCount,
      };

      sessionStorage.setItem("urja-results", JSON.stringify(fullResult));
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
      <div ref={searchContainerRef} className="absolute top-4 sm:top-6 left-16 sm:left-1/2 right-4 sm:right-auto sm:-translate-x-1/2 sm:w-[560px] z-[1000]">
        <div
          className={`flex items-center bg-urja-bg-card rounded-pill shadow-float overflow-hidden transition-all duration-300 ${
            guideStep === 1 ? "ring-2 ring-urja-accent ring-offset-2 ring-offset-transparent" : ""
          } ${searchError ? "ring-2 ring-destructive" : ""} ${showSuggestions && suggestions.length > 0 ? "rounded-b-none" : ""}`}
          role="search"
          aria-label="Location search"
        >
          <div className="pl-4 text-urja-text-muted" aria-hidden="true">
            <Search className="w-4 h-4" />
          </div>
          <input
            id="location-search"
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSearchError(""); }}
            onKeyDown={handleSearchKeyDown}
            onFocus={() => { if (suggestions.length > 0 && query.length >= 2) setShowSuggestions(true); }}
            placeholder="Search any address, city, or landmark..."
            className="flex-1 bg-transparent border-none outline-none px-3 py-3 text-[15px] text-urja-text-primary placeholder:text-urja-text-muted font-body"
            aria-label="Search for a location"
            autoComplete="off"
            role="combobox"
            aria-expanded={showSuggestions}
            aria-controls="search-suggestions"
            aria-activedescendant={activeSuggestion >= 0 ? `suggestion-${activeSuggestion}` : undefined}
          />
          <button
            onClick={handleSearch}
            disabled={searching}
            className="bg-urja-accent hover:bg-urja-accent-hover text-urja-accent-text px-5 py-3 text-[15px] font-medium transition-colors disabled:opacity-70 flex items-center gap-2"
            aria-label="Search"
          >
            {searching ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : "Search"}
          </button>
        </div>

        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            id="search-suggestions"
            className="bg-urja-bg-card border-t border-foreground/[0.06] rounded-b-xl shadow-float overflow-hidden"
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
                    i === activeSuggestion ? "bg-urja-accent/10" : "hover:bg-foreground/[0.03]"
                  } ${i < suggestions.length - 1 ? "border-b border-foreground/[0.04]" : ""}`}
                  onClick={() => handleSuggestionClick(s)}
                >
                  <MapPin className="w-4 h-4 text-urja-text-muted mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-urja-text-primary truncate">{main}</div>
                    {secondary && (
                      <div className="text-xs text-urja-text-muted truncate mt-0.5">{secondary}</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {searchError && (
          <div className="mt-2 text-sm text-destructive bg-urja-bg-card rounded-md px-3 py-2 shadow-card flex items-center gap-2" role="alert">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            {searchError}
          </div>
        )}
      </div>

      {/* ── Theme Toggle + Zoom ──────────────────────────── */}
      <div className="absolute top-4 sm:top-6 left-4 z-[1000]">
        <ThemeToggle />
      </div>

      <div className="absolute bottom-32 sm:bottom-8 right-4 z-[1000] flex flex-col gap-1" role="group" aria-label="Map zoom controls">
        <button onClick={handleZoomIn} className="w-10 h-10 bg-urja-bg-card shadow-card rounded-lg flex items-center justify-center hover:bg-secondary transition-colors" aria-label="Zoom in">
          <Plus className="w-4 h-4 text-urja-text-primary" />
        </button>
        <button onClick={handleZoomOut} className="w-10 h-10 bg-urja-bg-card shadow-card rounded-lg flex items-center justify-center hover:bg-secondary transition-colors" aria-label="Zoom out">
          <Minus className="w-4 h-4 text-urja-text-primary" />
        </button>
      </div>

      {/* ── Drawing Toolbar ─────────────────────────────── */}
      {drawState === "DRAWING" && (
        <div className="absolute top-20 sm:top-6 right-4 flex gap-2 z-[1000] animate-fade-slide-up" role="toolbar" aria-label="Drawing controls">
          <Button variant="ghost" size="sm" className="bg-urja-bg-card shadow-card" onClick={() => finishPolygon()} disabled={vertexCount < 3} aria-label="Finish drawing polygon">
            <span className="border-l-2 border-urja-success pl-2">{vertexCount >= 3 ? "Finish" : `${3 - vertexCount} more`}</span>
          </Button>
          <Button variant="ghost" size="sm" className="bg-urja-bg-card shadow-card" onClick={handleDeleteLast} aria-label="Undo last point">Undo</Button>
          <Button variant="ghost" size="sm" className="bg-urja-bg-card shadow-card" onClick={clearDrawing} aria-label="Cancel drawing">Cancel</Button>
        </div>
      )}

      {/* ── Progressive Step Guide ──────────────────────── */}
      {drawState !== "COMPLETE" && (
        <div className="absolute bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 z-[1000] w-[calc(100vw-32px)] sm:w-[480px]">
          <div className="bg-urja-bg-card/95 backdrop-blur-md rounded-2xl shadow-float overflow-hidden">
            <div className="h-1 bg-muted">
              <div className="h-full bg-gradient-to-r from-urja-accent to-urja-accent transition-all duration-700 ease-out" style={{ width: `${(guideStep / 4) * 100}%` }} />
            </div>
            <div className="px-5 py-4">
              <div className="flex items-center gap-1.5 mb-2.5">
                {[1, 2, 3, 4].map((s) => (
                  <div key={s} className={`flex items-center gap-1 sm:gap-1.5 text-xs font-medium transition-all duration-300 ${guideStep === s ? "text-urja-accent" : guideStep > s ? "text-urja-success" : "text-urja-text-muted/40"}`}>
                    <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[9px] sm:text-[10px] font-semibold transition-all duration-300 ${guideStep === s ? "bg-urja-accent text-white scale-110" : guideStep > s ? "bg-urja-success text-white" : "bg-muted text-urja-text-muted"}`}>
                      {guideStep > s ? "✓" : s}
                    </div>
                    {s < 4 && <div className={`w-4 sm:w-8 h-px transition-colors duration-300 ${guideStep > s ? "bg-urja-success" : "bg-muted"}`} />}
                  </div>
                ))}
              </div>
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-300 ${
                  guideStep === 1 ? "bg-urja-accent/10 text-urja-accent" :
                  guideStep === 2 ? "bg-urja-info-light text-urja-info" :
                  "bg-urja-accent/10 text-urja-accent"
                }`}>
                  {guideStep === 1 && <Search className="w-4 h-4" />}
                  {guideStep === 2 && <MapPin className="w-4 h-4" />}
                  {guideStep === 3 && <MousePointerClick className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] sm:text-sm font-medium text-urja-text-primary leading-snug">
                    {guideStep === 1 && "Search your location"}
                    {guideStep === 2 && "Click on your rooftop to start drawing"}
                    {guideStep === 3 && (vertexCount < 3 ? `Trace your rooftop edges · ${vertexCount} of 3 minimum` : "Click the green start point to complete the shape")}
                  </div>
                  <div className="text-[11px] sm:text-xs text-urja-text-muted mt-0.5 leading-tight sm:leading-relaxed">
                    {guideStep === 1 && "Type your city, area, or full address — suggestions will appear as you type"}
                    {guideStep === 2 && "The map is zoomed in — click the corners of your rooftop one by one"}
                    {guideStep === 3 && (vertexCount < 3 ? "Click on each corner of your roof to create the outline" : "Or double-click anywhere, or press the Finish button above")}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Area Card + Panels + Calculate ───────────────── */}
      {drawState === "COMPLETE" && area !== null && (
        <div className="absolute bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 w-[calc(100vw-32px)] sm:w-[420px] z-[1000] animate-fade-slide-up">
          <div className="bg-urja-bg-card rounded-xl shadow-float p-6">
            <div className="text-center mb-4">
              <div className="text-sm text-urja-text-muted mb-1">Rooftop Area</div>
              <div className={`font-mono text-[32px] font-semibold ${areaWarning ? "text-destructive" : "text-urja-accent"}`} aria-label={`Rooftop area: ${area} square meters`}>
                {area} m²
              </div>
              <div className="flex items-center justify-center gap-3 text-xs text-urja-text-muted mt-1">
                <span>Usable: {Math.round(area * USABLE_AREA_FACTOR * 10) / 10} m²</span>
                {panelCount > 0 && (
                  <>
                    <span>·</span>
                    <span className="text-urja-info font-medium">{panelCount} panels fit</span>
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

            <div className="border-t border-foreground/[0.06] pt-3 mb-4">
              <button className="w-full flex items-center justify-between text-sm text-urja-text-secondary hover:text-urja-text-primary transition-colors" onClick={() => setShowRateInput(!showRateInput)} aria-expanded={showRateInput}>
                <span>Electricity Rate: ₹{electricityRate}/kWh</span>
                <span className="text-xs text-urja-accent underline underline-offset-2">{showRateInput ? "Hide" : "Change"}</span>
              </button>
              {showRateInput && (
                <div className="mt-3 flex items-center gap-3">
                  <span className="text-sm text-urja-text-muted">₹</span>
                  <input type="range" min={MIN_ELECTRICITY_RATE} max={MAX_ELECTRICITY_RATE} step={0.5} value={electricityRate} onChange={(e) => setElectricityRate(parseFloat(e.target.value))} className="flex-1 accent-urja-accent h-1.5 rounded-full" aria-label="Electricity rate" />
                  <div className="flex items-center gap-1 bg-secondary rounded-md px-2 py-1">
                    <input type="number" min={MIN_ELECTRICITY_RATE} max={MAX_ELECTRICITY_RATE} step={0.5} value={electricityRate} onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= MIN_ELECTRICITY_RATE && v <= MAX_ELECTRICITY_RATE) setElectricityRate(v); }} className="w-12 bg-transparent text-center text-sm font-mono text-urja-text-primary border-none outline-none" aria-label="Rate input" />
                    <span className="text-xs text-urja-text-muted">/kWh</span>
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
                {calculating ? "Analyzing..." : calcError ? "Retry Calculation" : "Calculate Solar Potential"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Loading overlay ─────────────────────────────── */}
      {calculating && (
        <div className="absolute inset-0 z-[2000] bg-foreground/50 backdrop-blur-sm flex items-center justify-center" role="progressbar" aria-label="Analyzing solar potential">
          <div className="bg-urja-bg-card rounded-xl shadow-float p-8 text-center animate-fade-slide-up max-w-xs">
            <Loader2 className="w-10 h-10 text-urja-accent animate-spin mx-auto mb-4" aria-hidden="true" />
            <div className="text-lg font-medium text-urja-text-primary">Analyzing Solar Potential</div>
            <div className="text-sm text-urja-text-secondary mt-1">Fetching irradiance data from NASA...</div>
            <div className="flex gap-1 justify-center mt-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-2 h-2 rounded-full bg-urja-accent" style={{ animation: `urjaPulse 1.2s ease-in-out ${i * 0.2}s infinite`, opacity: 0.3 }} />
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes urjaPulse {
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
