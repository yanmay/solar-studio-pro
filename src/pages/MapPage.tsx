import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { polygon as turfPolygon } from "@turf/helpers";
import turfArea from "@turf/area";
import { Search, Loader2, Minus, Plus, RotateCcw, AlertTriangle, MapPin, MousePointerClick, Cpu, Sliders, Info, Sun, Compass, HelpCircle, Check, Home, Monitor, Trash2, X, LocateFixed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import ThemeToggle from "@/components/ThemeToggle";
import { useToast } from "@/hooks/use-toast";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { fetchSolarIrradiance } from "@/lib/nasa-power";
import { useScanStore } from "@/hooks/use-scan-store";
import { useGeocode } from "@/hooks/use-geocode";
import { runFullCalculation, type SolarAnalysis, SolarCalcError } from "@/lib/solar-calc";
import { computePanelLayout, type PanelRect } from "@/lib/panel-layout";
import Globe3D, { type Globe3DHandle } from "@/components/Globe3D";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { encodeScanToUrl } from "@/lib/scan-url";
import { trackPolygonCompleted, trackConfigStepCompleted } from "@/lib/analytics";
import { getDiscomTariff } from "@/lib/india-grid";
import {
  ELECTRICITY_RATE_INR,
  MIN_ELECTRICITY_RATE,
  MAX_ELECTRICITY_RATE,
  USABLE_AREA_FACTOR,
  MIN_AREA_M2,
} from "@/lib/solar-defaults";

type LatLng = { lat: number; lng: number };
type DrawState = "IDLE" | "DRAWING" | "COMPLETE";

// ─── Google Maps API key ───────────────────────────────────
const GOOGLE_MAPS_API_KEY = "AIzaSyDFkPRXVfhHADwyZHtFy2j_XElhNqa2HS4";

// ─── Suggestion type (kept compatible with UI consumers) ───
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

// ─── Live location marker (pulsing blue dot) ───────────────
const locationDotIcon = L.divIcon({
  className: "",
  html: `
    <style>
      @keyframes locPulse {
        0%   { transform: scale(1);   opacity: 0.8; }
        70%  { transform: scale(2.2); opacity: 0; }
        100% { transform: scale(1);   opacity: 0; }
      }
    </style>
    <div style="position:relative;width:20px;height:20px;">
      <div style="position:absolute;inset:0;background:#3B82F6;border-radius:50%;animation:locPulse 2s ease-out infinite;"></div>
      <div style="position:absolute;inset:4px;background:#3B82F6;border:2.5px solid #fff;border-radius:50%;box-shadow:0 0 8px rgba(59,130,246,0.7);"></div>
    </div>
  `,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

// ─── Globe dismiss threshold ────────────────────────────────
// When the user scrolls the globe camera closer than this distance,
// the globe fades out and the Leaflet map takes over.
const GLOBE_DISMISS_DISTANCE = 250;

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

// ─── Google Places Autocomplete ────────────────────────────

interface PlacesAutocompleteCandidate {
  placePrediction: {
    placeId: string;
    text: { text: string };
    structuredFormat?: {
      mainText: { text: string };
      secondaryText?: { text: string };
    };
  };
}

interface NominatimSearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
  address?: Record<string, string>;
}

/** Autocomplete: Google Places Autocomplete (New) API */
async function fetchNominatimSuggestions(
  query: string,
  signal: AbortSignal,
): Promise<NominatimSuggestion[]> {
  try {
    const nomUrl = `/api/geocode?q=${encodeURIComponent(query)}&limit=6`;
    const nomRes = await fetch(nomUrl, {
      signal,
    });
    if (nomRes.ok) {
      const nomData = (await nomRes.json()) as NominatimSearchResult[];
      return nomData.map((item) => ({
        place_id: item.place_id,
        display_name: item.display_name,
        lat: item.lat,
        lon: item.lon,
        type: item.type || "place",
        address: item.address,
      }));
    }
  } catch {
    // Ignore error
  }
  return [];
}

/** Autocomplete: Google Places Autocomplete (New) API */
async function fetchSuggestions(
  query: string,
  signal: AbortSignal,
  mapCenter?: { lat: number; lng: number },
): Promise<NominatimSuggestion[]> {
  const body: Record<string, unknown> = {
    input: query,
    languageCode: "en",
    regionCode: "IN",
  };

  // Bias results towards the visible map area
  if (mapCenter) {
    body.locationBias = {
      circle: {
        center: { latitude: mapCenter.lat, longitude: mapCenter.lng },
        radius: 50000, // 50 km
      },
    };
  }

  let res: Response;
  try {
    res = await fetch(
      `https://places.googleapis.com/v1/places:autocomplete?key=${GOOGLE_MAPS_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      },
    );
  } catch (err) {
    if (signal.aborted) throw err;
    return fetchNominatimSuggestions(query, signal);
  }

  if (!res.ok) {
    return fetchNominatimSuggestions(query, signal);
  }

  const data = await res.json();

  const candidates: PlacesAutocompleteCandidate[] = data.suggestions ?? [];

  // Convert to NominatimSuggestion shape — lat/lon resolved lazily via geocoding on click
  return candidates.slice(0, 6).map((c, i) => {
    const sf = c.placePrediction.structuredFormat;
    const display = sf
      ? [sf.mainText.text, sf.secondaryText?.text].filter(Boolean).join(", ")
      : c.placePrediction.text.text;
    return {
      place_id: i,
      display_name: display,
      lat: "",  // resolved when the user clicks the suggestion
      lon: "",
      type: "place",
      // stash placeId so geocoding can resolve it
      address: { _googlePlaceId: c.placePrediction.placeId },
    } as NominatimSuggestion;
  });
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const nomUrl = `/api/geocode?lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}`;
    const res = await fetch(nomUrl);
    if (res.ok) {
      const data = await res.json();
      if (data.display_name) {
        return data.display_name;
      }
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

// ─── Google Maps Tile API session ──────────────────────────
// The official Maps Tile API requires a session token for authenticated,
// full-resolution satellite imagery (tile.googleapis.com/v1/2dtiles).
async function createMapTileSession(): Promise<string | null> {
  const defaultSession = "JOJQJH0ZFj6JoA54JpDewgrjE8U=";
  try {
    const res = await fetch("/api/map-session", {
      method: "POST"
    });
    if (!res.ok) return defaultSession;
    const data = await res.json();
    return data.session || defaultSession;
  } catch {
    return defaultSession;
  }
}

// SCN-014: Distinct colors for multi-roof polygons
const POLYGON_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MapPage Component
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const MapPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const geocodeMutation = useGeocode();
  const { mutateAsync: geocodeAsync } = geocodeMutation;
  const [mapReady, setMapReady] = useState(false);

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
  const [isOfflineFallback, setIsOfflineFallback] = useState(false);
  const [electricityRate, setElectricityRate] = useState(ELECTRICITY_RATE_INR);
  const [showRateInput, setShowRateInput] = useState(false);
  const [locationLabel, setLocationLabel] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [panelCount, setPanelCount] = useState(0);

  // ── Live location state ─────────────────────────────────
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const locationMarkerRef = useRef<L.Marker | null>(null);


  // SCN-014: State for active polygons list
  const [polygons, setPolygons] = useState<{ id: string; vertices: LatLng[]; area: number; polygonLayer: L.Polygon }[]>([]);

  // SCN-009: Mobile Alert warning state
  const isMobile = useIsMobile();
  const [mobileWarningDismissed, setMobileWarningDismissed] = useState(() => 
    sessionStorage.getItem("mobile-warning-dismissed") === "true"
  );

  // SCN-016: Detected state name and DISCOM name
  const [discomName, setDiscomName] = useState<string | null>(null);
  const [detectedState, setDetectedState] = useState<string | null>(null);

  // ── Panel Layout settings ────────────────────────────────
  const [panelType, setPanelType] = useState<"compact" | "premium">("compact");
  const [alignment, setAlignment] = useState<"roof" | "south">("roof");
  const [tiltDeg, setTiltDeg] = useState(15);
  const [orientation, setOrientation] = useState<"portrait" | "landscape" | "auto">("portrait");
  const [walkways, setWalkways] = useState(true);
  const [setbackM, setSetbackM] = useState(0.5);
  const [shading, setShading] = useState<"none" | "partial" | "heavy">("none");
  const [showLayoutSettings, setShowLayoutSettings] = useState(false);

  // ── Globe state (binary: visible or hidden) ─────────────────
  const [globeVisible, setGlobeVisible] = useState(true);
  const [globeFadingOut, setGlobeFadingOut] = useState(false);
  const [activeStep, setActiveStep] = useState<number>(1);
  const changeStep = (targetStep: number) => {
    if (targetStep > activeStep) {
      if (activeStep === 1) {
        trackConfigStepCompleted(1);
      } else if (activeStep === 2) {
        trackConfigStepCompleted(2);
      }
    }
    setActiveStep(targetStep);
  };
  const globeRef = useRef<Globe3DHandle>(null);

  // ── Sidebar state ────────────────────────────────────────────
  // sidebarExpanded: true = fully open; false = peeking (narrow tab on right)
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  // Auto-expand when user has searched/jumped to a location
  useEffect(() => {
    if (hasSearched) setSidebarExpanded(true);
  }, [hasSearched]);
  // Also expand when drawing starts
  useEffect(() => {
    if (drawState === "DRAWING" || drawState === "COMPLETE") setSidebarExpanded(true);
  }, [drawState]);

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

  // SCN-009: Dismiss Mobile warning helper
  const dismissMobileWarning = () => {
    sessionStorage.setItem("mobile-warning-dismissed", "true");
    setMobileWarningDismissed(true);
  };

  // SCN-014: Delete individual roof section
  const handleDeleteSection = (id: string) => {
    setPolygons((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) {
        target.polygonLayer.remove();
      }
      const filtered = prev.filter((p) => p.id !== id);
      
      // Update calculations
      const totalArea = filtered.reduce((sum, p) => sum + p.area, 0);
      setArea(totalArea === 0 ? null : totalArea);
      if (totalArea > 0 && totalArea < MIN_AREA_M2) {
        setAreaWarning(`Total area is only ${totalArea} m². Minimum is ${MIN_AREA_M2} m² for accurate analysis.`);
      } else {
        setAreaWarning(null);
      }
      return filtered;
    });
  };

  // SCN-014: Done drawing sections - proceed to specs
  const handleDoneDrawing = () => {
    if (polygons.length === 0) return;
    const totalArea = polygons.reduce((sum, p) => sum + p.area, 0);
    const centroid = calcCentroid(polygons.flatMap((p) => p.vertices));

    reverseGeocode(centroid.lat, centroid.lng).then((label) => {
      setLocationLabel(label);
      useScanStore.getState().setScanInput({
        address: label,
        lat: centroid.lat,
        lng: centroid.lng,
        roofPolygon: polygons.map((p) => ({
          type: "Polygon" as const,
          coordinates: [p.vertices.map((v) => [v.lng, v.lat] as [number, number])],
        })),
        roofAreaM2: totalArea,
      });
    });

    setDrawState("COMPLETE");
    setActiveStep(1);
  };

  const finishPolygon = useCallback((map?: L.Map) => {
    const m = map || mapRef.current;
    if (!m || verticesRef.current.length < 3) return;

    polylineRef.current?.remove(); polylineRef.current = null;
    previewLineRef.current?.remove(); previewLineRef.current = null;
    closingLineRef.current?.remove(); closingLineRef.current = null;
    m.getContainer().style.cursor = "";

    const coords = verticesRef.current.map((v) => [v.lat, v.lng] as [number, number]);

    setPolygons((prev) => {
      const color = POLYGON_COLORS[prev.length % POLYGON_COLORS.length];
      const polygonLayer = L.polygon(coords, {
        color, fillColor: color, fillOpacity: 0.15, weight: 2.5,
      }).addTo(m);

      const calculatedArea = calcAreaM2(verticesRef.current);
      
      const newPoly = {
        id: `poly_${Date.now()}`,
        vertices: [...verticesRef.current],
        area: calculatedArea,
        polygonLayer,
      };

      const next = [...prev, newPoly];
      const totalArea = next.reduce((sum, p) => sum + p.area, 0);
      setArea(totalArea);
      if (totalArea < MIN_AREA_M2) {
        setAreaWarning(`Total area is only ${totalArea} m². Minimum is ${MIN_AREA_M2} m² for accurate analysis.`);
      } else {
        setAreaWarning(null);
      }
      return next;
    });

    // Clear current active markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
    verticesRef.current = [];
    setVertexCount(0);
    setDrawState("IDLE");
  }, []);

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
      maxZoom: 21,
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: false,   // disabled while globe is visible — enabled when globe hides
      dragging: false,          // disabled while globe is visible
      doubleClickZoom: false,
    });

    const esriSat = L.tileLayer(
      "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { attribution: "Tiles &copy; Esri", maxZoom: 21, maxNativeZoom: 19 }
    );

    const bhuvanSat = L.tileLayer.wms(
      "https://bhuvan-vec2.nrsc.gov.in/bhuvan/wms",
      {
        layers: "multispectral",
        format: "image/png",
        transparent: true,
        attribution: "© ISRO/Bhuvan",
        maxZoom: 21
      }
    );

    // Setup fallback chain logic
    esriSat.on("tileerror", () => {
      if (!map.hasLayer(bhuvanSat)) {
        esriSat.remove();
        bhuvanSat.addTo(map);
      }
    });

    // Load official Google hybrid tiles asynchronously or fallback to Esri
    (async () => {
      const session = await createMapTileSession();
      if (!mapRef.current) return;

      if (session) {
        const satUrl = `https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session=${session}&key=${GOOGLE_MAPS_API_KEY}`;
        const googleHybrid = L.tileLayer(satUrl, {
          attribution: "© Google",
          maxZoom: 21,
          maxNativeZoom: 20,
        });

        googleHybrid.on("tileerror", () => {
          if (!map.hasLayer(esriSat) && !map.hasLayer(bhuvanSat)) {
            googleHybrid.remove();
            esriSat.addTo(map);
          }
        });

        googleHybrid.addTo(map);
      } else {
        esriSat.addTo(map);
      }
    })();




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
    setMapReady(true);
    return () => {
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [finishPolygon]);

  // SCN-014: Draw panels for all active roof sections
  const redrawAllPanels = useCallback(() => {
    const map = mapRef.current;
    if (!map || polygons.length === 0) {
      if (panelLayerRef.current) {
        panelLayerRef.current.remove();
        panelLayerRef.current = null;
      }
      setPanelCount(0);
      return;
    }

    if (panelLayerRef.current) {
      panelLayerRef.current.remove();
      panelLayerRef.current = null;
    }

    const panelGroup = L.layerGroup();
    let totalPanels = 0;

    polygons.forEach((poly) => {
      const layout = computePanelLayout(poly.vertices, {
        panelType,
        alignment,
        tiltDeg,
        orientation,
        walkways,
        setbackM,
      });
      totalPanels += layout.panelCount;

      layout.panels.forEach((panel: PanelRect) => {
        // ── Outer panel body ─────────────────────────────────
        const panelPoly = L.polygon(panel.corners, {
          color: "#0F1F3D",       // dark navy frame
          fillColor: "#1a3a6e",   // deep blue solar glass
          fillOpacity: 0.82,
          weight: 1,
        });
        panelGroup.addLayer(panelPoly);

        // ── Internal cell grid lines (busbars + cell lines) ──
        const [tl, tr, br, bl] = panel.corners; // [lat,lng] each
        const COLS = panel.isLandscape ? 10 : 3;
        const ROWS = panel.isLandscape ? 3 : 10;

        const lerp = (
          a: [number, number], b: [number, number], t: number,
        ): [number, number] => [
          a[0] + (b[0] - a[0]) * t,
          a[1] + (b[1] - a[1]) * t,
        ];

        // Vertical cell lines
        for (let c = 1; c < COLS; c++) {
          const t = c / COLS;
          const top = lerp(tl, tr, t);
          const bot = lerp(bl, br, t);
          panelGroup.addLayer(L.polyline([top, bot], {
            color: "#5b8fc9", weight: 0.5, opacity: 0.6,
          }));
        }

        // Horizontal cell lines
        for (let r = 1; r < ROWS; r++) {
          const t = r / ROWS;
          const left  = lerp(tl, bl, t);
          const right = lerp(tr, br, t);
          panelGroup.addLayer(L.polyline([left, right], {
            color: "#5b8fc9", weight: 0.5, opacity: 0.6,
          }));
        }

        // Centre busbar (horizontal or vertical slightly thicker silver line at mid-point)
        if (panel.isLandscape) {
          const midTop = lerp(tl, tr, 0.5);
          const midBot = lerp(bl, br, 0.5);
          panelGroup.addLayer(L.polyline([midTop, midBot], {
            color: "#a8c8f0", weight: 1, opacity: 0.8,
          }));
        } else {
          const midLeft  = lerp(tl, bl, 0.5);
          const midRight = lerp(tr, br, 0.5);
          panelGroup.addLayer(L.polyline([midLeft, midRight], {
            color: "#a8c8f0", weight: 1, opacity: 0.8,
          }));
        }
      });
    });

    panelGroup.addTo(map);
    panelLayerRef.current = panelGroup;
    setPanelCount(totalPanels);
  }, [polygons, panelType, alignment, tiltDeg, orientation, walkways, setbackM]);

  // Redraw panels reactive to layout settings changes and polygons list
  useEffect(() => {
    if (drawState === "COMPLETE" || polygons.length > 0) {
      redrawAllPanels();
    }
  }, [drawState, polygons, redrawAllPanels]);

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

    // Clear all completed polygons from map
    polygons.forEach((p) => p.polygonLayer.remove());
    setPolygons([]);

    locationMarkerRef.current?.remove(); locationMarkerRef.current = null;
    panelLayerRef.current?.remove(); panelLayerRef.current = null;
    setPanelCount(0);
    setArea(null);
    setAreaWarning(null);
    setDrawState("IDLE");
    setCalcError(null);
    setDiscomName(null);
    setDetectedState(null);
    if (mapRef.current) mapRef.current.getContainer().style.cursor = "";
  }, [polygons]);

  // ── Globe dismiss logic ────────────────────────────────────
  const globeDismissedRef = useRef(false);
  const lastGlobeCoordsRef = useRef<{lat: number, lng: number} | null>(null);
  const zoomControlAddedRef = useRef(false);

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
        // Dynamically add zoom control when globe is dismissed
        if (!zoomControlAddedRef.current) {
          L.control.zoom({ position: "topleft" }).addTo(map);
          zoomControlAddedRef.current = true;
        }
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
      const map = mapRef.current;
      if (!map) return;
      map.flyTo([lat, lng], 18, { animate: true, duration: 1.5 });
      // Show crosshair cursor immediately so user knows they can start drawing
      map.getContainer().style.cursor = "crosshair";
    }, 100);
    setLocationLabel(label);
    setHasSearched(true);
    setShowSuggestions(false);
  }, [clearDrawing, dismissGlobe]);

  // ── Use My Location (GPS) ───────────────────────────────
  const handleUseMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser.");
      return;
    }
    setLocating(true);
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const label = await reverseGeocode(lat, lng);
        flyToLocation(lat, lng, label);
        // Place / update pulsing blue dot on the map
        if (mapRef.current) {
          locationMarkerRef.current?.remove();
          locationMarkerRef.current = L.marker([lat, lng], { icon: locationDotIcon, zIndexOffset: 500 }).addTo(mapRef.current);
        }
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        if (err.code === 1) {
          setLocationError("Location access denied. Please allow it in your browser settings.");
        } else {
          setLocationError("Unable to determine your location. Please try again.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [flyToLocation]);

  // ── Quick Sandbox Jumps ──────────────────────────────────
  const quickJump = useCallback((city: string) => {
    let lat = 20.5937;
    let lng = 78.9629;
    let label = city;

    if (city === "New Delhi") {
      lat = 28.6143;
      lng = 77.1994;
      label = "Presidential Estate, New Delhi, Delhi, India";
      setDetectedState("Delhi");
    } else if (city === "Mumbai") {
      lat = 19.0178;
      lng = 72.8478;
      label = "Dadar West, Mumbai, Maharashtra, India";
      setDetectedState("Maharashtra");
    } else if (city === "Bengaluru") {
      lat = 12.9724;
      lng = 77.6220;
      label = "Indiranagar, Bengaluru, Karnataka, India";
      setDetectedState("Karnataka");
    } else if (city === "Chennai") {
      lat = 13.0418;
      lng = 80.2341;
      label = "T. Nagar, Chennai, Tamil Nadu, India";
      setDetectedState("Tamil Nadu");
    }

    flyToLocation(lat, lng, label);
  }, [flyToLocation]);

  // ── Trigger URL Search on Mount ──────────────────────────
  useEffect(() => {
    const qParam = searchParams.get("q");
    if (qParam && mapRef.current) {
      setQuery(qParam);
      setSearching(true);
      setSearchError("");
      geocodeAsync(qParam)
        .then(({ lat, lng, formatted_address, state }) => {
          flyToLocation(lat, lng, formatted_address);
          setDetectedState(state || null);
        })
        .catch((err) => {
          setSearchError(err.message || "Location not found.");
        })
        .finally(() => {
          setSearching(false);
        });
    }
  }, [searchParams, flyToLocation, geocodeAsync, mapReady]);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSearchError("");
    setShowSuggestions(false);
    try {
      const { lat, lng, formatted_address, state } = await geocodeMutation.mutateAsync(query);
      flyToLocation(lat, lng, formatted_address);
      setDetectedState(state || null);
    } catch (error) {
      const msg = (error as Error).message || "Location not found. Try again.";
      setSearchError(msg);
      toast({ title: "Location not found", description: "Please try a different address or use the autocomplete suggestions.", variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  const handleSuggestionClick = async (s: NominatimSuggestion) => {
    setQuery(s.display_name.split(", ").slice(0, 3).join(", "));
    setShowSuggestions(false);

    const placeId = s.address?.["_googlePlaceId"];
    if (placeId) {
      // Google Places suggestion — resolve via our backend API geocode proxy using s.display_name
      setSearching(true);
      try {
        const result = await geocodeMutation.mutateAsync(s.display_name);
        flyToLocation(result.lat, result.lng, result.formatted_address);
        setDetectedState(result.state || null);
      } catch {
        setSearchError("Could not resolve location. Please try searching manually.");
      } finally {
        setSearching(false);
      }
    } else {
      // Legacy path (direct lat/lon from Nominatim)
      flyToLocation(parseFloat(s.lat), parseFloat(s.lon), s.display_name);
      const parts = s.display_name.split(", ");
      if (parts.length >= 2) {
        const possibleState = parts[parts.length - 3] || parts[parts.length - 2];
        setDetectedState(possibleState || null);
      }
    }
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

  // SCN-016: Pre-fill tariff when entering Step 3
  useEffect(() => {
    if (activeStep === 3 && detectedState) {
      const info = getDiscomTariff(detectedState);
      if (info) {
        setElectricityRate(info.defaultTariff);
        setDiscomName(info.discom);
      }
    }
  }, [activeStep, detectedState]);

  const handleCalculate = async () => {
    const totalArea = polygons.reduce((sum, p) => sum + p.area, 0);
    if (polygons.length === 0 || totalArea < MIN_AREA_M2) {
      setCalcError(`Area is too small (${totalArea} m²). Please draw a larger rooftop (minimum ${MIN_AREA_M2} m²).`);
      return;
    }
    setCalculating(true);
    setCalcError(null);

    try {
      const centroid = calcCentroid(polygons.flatMap((p) => p.vertices));
      
      // SCN-017: Track polygon completion and step completion
      trackPolygonCompleted(totalArea);
      trackConfigStepCompleted(3);

      const irradiance = await fetchSolarIrradiance(centroid.lat, centroid.lng);
      setIsOfflineFallback(irradiance.source === "REGIONAL_FALLBACK");
      
      const panelWattage = panelType === "premium" ? 550 : 450;
      const customCapacityKw = panelCount > 0 
        ? Math.round((panelCount * panelWattage / 1000) * 100) / 100 
        : undefined;

      const analysis: SolarAnalysis = runFullCalculation(totalArea, irradiance.peakSunHours, {
        electricityRate,
        irradianceSource: irradiance.source,
        monthlyIrradiance: irradiance.monthlyValues,
        customCapacityKw,
        panelCount: panelCount > 0 ? panelCount : undefined,
        panelType,
        alignment,
        tiltDeg,
        orientation,
        walkways,
        setbackM,
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

      const panelWattageValue = (panelType === "premium" ? 550 : 450) as 450 | 550;

      const scanInput = {
        address: locationLabel || `${centroid.lat.toFixed(4)}, ${centroid.lng.toFixed(4)}`,
        lat: centroid.lat,
        lng: centroid.lng,
        roofPolygon: polygons.map((p) => ({
          type: "Polygon" as const,
          coordinates: [p.vertices.map((v) => [v.lng, v.lat] as [number, number])],
        })),
        roofAreaM2: totalArea,
      };

      const panelConfig = {
        tiltAngle: tiltDeg,
        setbackM,
        walkwayM: walkways ? 0.8 : 0,
        panelWattage: panelWattageValue,
        orientation: orientation === "auto" ? "portrait" : orientation,
        rowAlignment: (alignment === "south" ? "geographical_south" : "roof_perimeter") as "geographical_south" | "roof_perimeter",
        panelCount,
        systemKwp: analysis.energy.installedCapacityKw,
        shading,
      };

      const tariff = { tariffPerKwh: electricityRate };

      useScanStore.getState().setScanInput(scanInput);
      useScanStore.getState().setPanelConfig(panelConfig);
      useScanStore.getState().setTariff(tariff);
      useScanStore.getState().setFullAnalysis(fullResult);

      setCalculating(false);

      // SCN-012: Encode scan data and navigate
      const encoded = encodeScanToUrl(scanInput, panelConfig, tariff);
      navigate(`/results?scan=${encoded}`);
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

  return (
    <TooltipProvider>
      <div className="relative w-full h-screen flex flex-col overflow-hidden" role="main" aria-label="Rooftop Solar Map">
        {/* SCN-009: Mobile Interstitial alert banner */}
        {isMobile && !mobileWarningDismissed && (
          <Alert className="rounded-none border-b border-border bg-amber-500/10 dark:bg-amber-500/5 text-foreground px-4 py-3 shrink-0 flex items-start justify-between gap-3 animate-in slide-in-from-top-full duration-300">
            <div className="flex gap-3 items-start">
              <Monitor className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <AlertTitle className="text-xs font-extrabold uppercase tracking-wide">Best experienced on desktop</AlertTitle>
                <AlertDescription className="text-[11px] leading-normal text-muted-foreground mt-0.5">
                  The map editor works best on a desktop or tablet. You can still continue, but tracing your roof may be harder on a small screen.
                </AlertDescription>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6 rounded-lg text-muted-foreground hover:text-foreground shrink-0 hover:bg-muted"
              onClick={dismissMobileWarning}
              type="button"
              aria-label="Dismiss warning"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </Alert>
        )}

        {/* Map page layout wrapper */}
        <div className="relative flex-1 w-full h-full overflow-hidden">
          {/* ── Floating Home Button ─────────────────────────── */}
          <button
            onClick={() => navigate("/")}
            className="absolute top-6 left-4 z-[1000] flex items-center justify-center w-10 h-10 rounded-xl bg-card/65 backdrop-blur-2xl border border-border/80 shadow-[0_4px_30px_rgba(0,0,0,0.2)] hover:border-primary/80 hover:text-primary hover:shadow-[0_0_15px_rgba(255,107,0,0.3)] hover:scale-105 active:scale-95 transition-all cursor-pointer text-muted-foreground group"
            aria-label="Back to Home"
          >
            <Home className="w-4.5 h-4.5 group-hover:scale-110 transition-transform duration-300" />
          </button>

          {/* ── Breadcrumbs Indexing ─────────────────────────── */}
          <div className="absolute top-6 left-18 z-[1000] hidden lg:block bg-card/65 backdrop-blur-2xl border border-border/80 px-4 py-2.5 rounded-2xl shadow-[0_4px_30px_rgba(0,0,0,0.2)] hover:border-primary/40 hover:shadow-[0_0_15px_rgba(255,107,0,0.15)] transition-all duration-300">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink onClick={() => navigate("/")} className="cursor-pointer hover:text-primary transition-colors text-xs font-semibold">Home</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-xs font-semibold text-foreground/80">Rooftop Editor</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>

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
                className="absolute bottom-[6%] left-1/2 -translate-x-1/2 flex items-center gap-3 px-5 py-2.5 rounded-xl pointer-events-none animate-float-slow bg-black/50 dark:bg-black/60 backdrop-blur-md border border-white/10 dark:border-white/5 shadow-2xl"
              >
                <Compass className="w-4 h-4 text-primary animate-spin-slow" />
                <span className="text-xs text-white/80 font-medium tracking-wide">Search a location or scroll to zoom in</span>
              </div>
            )}
          </div>
        )}

        {/* ── Search Bar with Autocomplete ──────────────────── */}
        <div ref={searchContainerRef} className="absolute top-6 left-16 sm:left-1/2 right-4 sm:right-auto sm:-translate-x-1/2 sm:w-[520px] z-[1000] animate-in fade-in slide-in-from-top-4 duration-500 group">
          {/* Ambient neon glow */}
          <div className="absolute -inset-1.5 bg-gradient-to-r from-primary/30 to-amber-500/30 rounded-[22px] blur-lg opacity-0 group-focus-within:opacity-100 group-hover:opacity-60 transition-all duration-500 pointer-events-none -z-10" />

          <div
            className={`flex items-center bg-card/75 backdrop-blur-2xl border border-border/80 rounded-2xl shadow-[0_4px_30px_rgba(0,0,0,0.25)] overflow-hidden transition-all duration-300 focus-within:ring-2 focus-within:ring-primary/40 focus-within:border-primary focus-within:shadow-[0_0_20px_rgba(255,107,0,0.25)] ${
              !hasSearched ? "ring-2 ring-primary/35 border-primary shadow-[0_0_15px_rgba(255,107,0,0.15)]" : ""
            } ${searchError ? "ring-2 ring-destructive/20 border-destructive" : ""} ${showSuggestions && suggestions.length > 0 ? "rounded-b-none border-b-0" : ""}`}
            role="search"
            aria-label="Location search"
          >
            <div className="pl-4 text-muted-foreground" aria-hidden="true">
              <Search className={`w-4 h-4 transition-all duration-300 ${searching ? "animate-spin text-primary" : ""}`} />
            </div>
            <input
              id="location-search"
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSearchError(""); }}
              onKeyDown={handleSearchKeyDown}
              onFocus={() => { if (suggestions.length > 0 && query.length >= 2) setShowSuggestions(true); }}
              placeholder="Search your address, locality or city…"
              className="flex-1 bg-transparent border-none outline-none px-3 py-3.5 text-sm text-foreground placeholder:text-muted-foreground/50 font-body"
              aria-label="Search for a location"
              autoComplete="off"
              role="combobox"
              aria-expanded={showSuggestions}
              aria-controls="search-suggestions"
              aria-activedescendant={activeSuggestion >= 0 ? `suggestion-${activeSuggestion}` : undefined}
            />
            {/* GPS locator button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    id="use-my-location-btn"
                    onClick={handleUseMyLocation}
                    disabled={locating}
                    aria-label="Use my current location"
                    className="mr-1 w-10 h-10 flex items-center justify-center rounded-xl text-muted-foreground hover:text-blue-400 hover:bg-blue-500/10 border border-transparent hover:border-blue-400/30 transition-all shrink-0 disabled:opacity-50 disabled:cursor-not-allowed group/gps"
                  >
                    {locating
                      ? <Loader2 className="w-4 h-4 animate-spin text-blue-400" aria-hidden="true" />
                      : <LocateFixed className="w-4 h-4 group-hover/gps:scale-110 transition-transform" aria-hidden="true" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs max-w-[180px] text-center">
                  Use my current location — instantly fly the map to your GPS position
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button
              onClick={handleSearch}
              disabled={searching}
              size="sm"
              className="mr-2 h-9 px-5 rounded-xl bg-gradient-to-r from-primary to-amber-500 text-black hover:scale-[1.03] active:scale-[0.97] text-xs font-bold tracking-wide transition-all shadow-[0_0_12px_rgba(255,107,0,0.25)] hover:shadow-[0_0_20px_rgba(255,107,0,0.45)] shrink-0 cursor-pointer border-none"
              aria-label="Search"
            >
              {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : "Search"}
            </Button>
          </div>

          {/* Dual-mode hint row — shown when not yet searched */}
          {!hasSearched && !showSuggestions && (
            <div className="flex items-center gap-2 mt-2 px-1 animate-in fade-in duration-300">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 cursor-pointer hover:bg-blue-500/15 transition-colors" onClick={handleUseMyLocation}>
                <LocateFixed className="w-3 h-3 text-blue-400 shrink-0" />
                <span className="text-[10px] font-semibold text-blue-400">Use GPS location</span>
              </div>
              <span className="text-[10px] text-muted-foreground/40 font-medium">or</span>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/30 border border-border/40">
                <Search className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                <span className="text-[10px] text-muted-foreground/60 font-medium">Type address / city manually</span>
              </div>
            </div>
          )}

          {/* DISCOM / state chip — shown after location is found */}
          {hasSearched && (discomName || detectedState) && !showSuggestions && (
            <div className="flex items-center gap-2 mt-2 px-1 animate-in fade-in slide-in-from-top-2 duration-300">
              {detectedState && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span className="text-[10px] font-semibold text-emerald-400">{detectedState}</span>
                </div>
              )}
              {discomName && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20">
                  <Sun className="w-3 h-3 text-primary shrink-0" />
                  <span className="text-[10px] font-semibold text-primary">{discomName}</span>
                </div>
              )}
            </div>
          )}

          {/* Suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div
              id="search-suggestions"
              className="bg-card/85 backdrop-blur-2xl border-x border-b border-border/80 rounded-b-2xl shadow-[0_15px_40px_rgba(0,0,0,0.45)] overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200"
              role="listbox"
              aria-label="Location suggestions"
            >
              {suggestions.map((s, i) => {
                const { main, secondary } = formatSuggestion(s);
                const isActive = i === activeSuggestion;
                return (
                  <button
                    key={s.place_id}
                    id={`suggestion-${i}`}
                    role="option"
                    aria-selected={isActive}
                    className={`w-full text-left px-4 py-3.5 flex items-start gap-3 transition-all cursor-pointer relative ${
                      isActive ? "bg-primary/10 text-primary" : "hover:bg-muted/40 text-foreground"
                    } ${i < suggestions.length - 1 ? "border-b border-border/30" : ""}`}
                    onClick={() => handleSuggestionClick(s)}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary shadow-[0_0_8px_rgba(255,107,0,0.8)] animate-pulse" />
                    )}
                    <MapPin className={`w-4 h-4 mt-0.5 shrink-0 transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                    <div className="min-w-0">
                      <div className={`text-xs font-semibold truncate ${isActive ? "text-primary" : "text-foreground"}`}>{main}</div>
                      {secondary && (
                        <div className="text-[10px] text-muted-foreground truncate mt-0.5">{secondary}</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* GPS error */}
          {locationError && (
            <div className="mt-2 px-3 py-2.5 text-xs text-red-400 bg-red-500/8 border border-red-500/20 rounded-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <LocateFixed className="w-3.5 h-3.5 shrink-0" />
              <span>{locationError}</span>
            </div>
          )}
        </div>

        {/* ── Unified Right Workspace Sidebar ──────────────── */}
        {/* Peek Tab — always visible when sidebar is closed */}
        {!sidebarExpanded && (
          <div className="absolute right-0 top-1/2 -translate-y-1/2 z-[1001] group">
            {/* Ambient glow */}
            <div className="absolute top-0 right-0 w-10 h-36 bg-gradient-to-l from-primary/40 to-amber-500/10 blur-xl opacity-60 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

            <button
              onClick={() => setSidebarExpanded(true)}
              className="relative flex flex-col items-center justify-center gap-2 w-9 py-7 bg-card/80 backdrop-blur-2xl border border-y-border/80 border-l-border/60 border-r-0 text-foreground rounded-l-2xl shadow-[0_4px_30px_rgba(0,0,0,0.3)] hover:w-11 hover:border-primary/60 hover:text-primary transition-all duration-300 cursor-pointer overflow-hidden"
              aria-label="Open Rooftop Editor"
            >
              {/* Orange accent bar */}
              <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-primary via-amber-500 to-primary rounded-l-lg" />
              {/* Subtle pulse ring to draw attention */}
              <div className="absolute inset-0 rounded-l-2xl ring-1 ring-primary/30 animate-pulse pointer-events-none" />

              <Cpu className="w-4 h-4 text-primary group-hover:rotate-90 transition-transform duration-500" />
              <span className="text-[9px] font-black uppercase tracking-widest [writing-mode:vertical-rl] rotate-180 text-primary/80 group-hover:text-primary transition-colors">Editor</span>
              <div className="w-1 h-1 rounded-full bg-primary/60 animate-pulse" />
            </button>
          </div>
        )}

        {/* Right sidebar ambient background glow */}
        <div 
          className={`absolute md:top-6 md:bottom-6 bottom-0 right-0 md:left-auto md:w-[380px] md:h-[calc(100vh-48px)] h-[55vh] blur-3xl bg-gradient-to-br from-primary/10 to-amber-500/5 rounded-3xl -z-10 pointer-events-none transition-all duration-500 ease-out hidden md:block ${
            sidebarExpanded ? "md:right-6 translate-x-0 opacity-100" : "md:right-[-380px] translate-x-full opacity-0"
          }`}
        />

        <Card
          className={`absolute md:top-6 md:bottom-6 bottom-0 left-0 right-0 md:left-auto md:w-[380px] md:h-[calc(100vh-48px)] h-[55vh] z-[1000] flex flex-col border bg-card/75 backdrop-blur-2xl shadow-[0_4px_30px_rgba(0,0,0,0.3)] overflow-hidden rounded-b-none md:rounded-3xl transition-all duration-500 ease-out ${
            sidebarExpanded
              ? "md:right-6 translate-x-0 border-border"
              : "md:right-[-380px] translate-x-full md:translate-x-0 border-border/60"
          } ${
            drawState === "COMPLETE"
              ? "border-emerald-500/30 shadow-[0_0_30px_rgba(34,197,94,0.08)]"
              : hasSearched && drawState !== "IDLE"
              ? "border-primary/30 shadow-[0_0_20px_rgba(255,107,0,0.08)]"
              : "border-border"
          }`}
        >
          
          {/* Sidebar Header */}
          <CardHeader className="px-5 pt-4 pb-3.5 border-b border-border/60 flex flex-row items-center justify-between bg-gradient-to-r from-muted/30 to-transparent shrink-0 space-y-0 relative overflow-hidden">
            {/* Accent bar */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary via-amber-400 to-transparent" />

            <div className="flex flex-col gap-0.5">
              <CardTitle className="flex items-center gap-2.5 text-sm font-bold text-foreground tracking-tight mt-0.5">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Cpu className={`w-3.5 h-3.5 text-primary ${drawState === "DRAWING" ? "animate-pulse" : ""}`} />
                </div>
                Rooftop Editor
              </CardTitle>
              <p className="text-[10px] text-muted-foreground ml-[36px] font-medium">
                {drawState === "IDLE" && !hasSearched && "Pinpoint your building on the map"}
                {drawState === "IDLE" && hasSearched && polygons.length === 0 && "Now trace the rooftop boundary"}
                {drawState === "DRAWING" && `Placing point ${vertexCount + 1} — click corners on the roof`}
                {drawState === "COMPLETE" && "Rooftop mapped · Configure & run analysis"}
                {drawState === "IDLE" && hasSearched && polygons.length > 0 && "Add more sections or proceed"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* Live status pill */}
              {drawState === "COMPLETE" && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[10px] font-bold text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />Ready
                </span>
              )}
              {drawState === "DRAWING" && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-[10px] font-bold text-amber-400 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />Live
                </span>
              )}
              {!hasSearched && drawState === "IDLE" && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/25 text-[10px] font-bold text-primary">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />Waiting
                </span>
              )}
              <button
                onClick={() => setSidebarExpanded(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all"
                aria-label="Collapse sidebar"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </CardHeader>

          {/* Scrollable Sidebar Content */}
          <CardContent className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4 pt-4 pb-2">
            
            {/* ─── PHASE 1: No location yet — invite user to search ─── */}
            {!hasSearched && drawState === "IDLE" && (
              <div className="space-y-4 animate-in fade-in duration-300">

                {/* Hero invite card */}
                <div className="relative border border-primary/25 bg-gradient-to-br from-primary/8 to-primary/2 rounded-2xl p-5 space-y-4 overflow-hidden">
                  <div className="absolute top-0 right-0 w-28 h-28 bg-primary/5 rounded-full -translate-y-10 translate-x-10 pointer-events-none" />
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0 ring-1 ring-primary/20">
                      <MapPin className="w-4.5 h-4.5 text-primary" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-primary uppercase tracking-widest">Step 1 of 3</p>
                      <h3 className="text-sm font-bold text-foreground leading-tight tracking-tight">Find Your Building</h3>
                    </div>
                  </div>

                  {/* Two ways to start */}
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      onClick={handleUseMyLocation}
                      disabled={locating}
                      className="flex items-center gap-3 px-4 py-3 bg-blue-500/8 border border-blue-500/25 rounded-xl hover:bg-blue-500/15 hover:border-blue-400/40 transition-all text-left group/gps cursor-pointer"
                    >
                      <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
                        {locating ? <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" /> : <LocateFixed className="w-3.5 h-3.5 text-blue-400 group-hover/gps:scale-110 transition-transform" />}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-blue-400">Use my GPS location</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Instantly fly to your home</p>
                      </div>
                    </button>
                    <div className="flex items-center gap-3 px-4 py-3 bg-muted/20 border border-border/40 rounded-xl">
                      <div className="w-7 h-7 rounded-lg bg-muted/40 flex items-center justify-center shrink-0">
                        <Search className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground">Type your address</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Use the search bar above ↑</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sandbox Locations */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Or try a demo city</span>
                    <div className="flex-1 h-px bg-border/40" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {["New Delhi", "Mumbai", "Bengaluru", "Chennai"].map((city) => (
                      <button
                        key={city}
                        onClick={() => quickJump(city)}
                        className="flex items-center gap-2 px-3 py-2.5 bg-card/50 border border-border/60 rounded-xl hover:border-primary/50 hover:bg-primary/5 text-left transition-all hover:scale-[1.02] active:scale-[0.98] group cursor-pointer"
                      >
                        <Compass className="w-3.5 h-3.5 text-primary shrink-0 group-hover:rotate-90 transition-transform duration-500" />
                        <span className="text-xs font-semibold text-foreground truncate">{city}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <div className="flex-1 h-px bg-border/30" />
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Pre-configure below</span>
                  <div className="flex-1 h-px bg-border/30" />
                </div>
              </div>
            )}

            {/* SCN-014: Traced sections list during active drawing/idle phase */}
            {polygons.length > 0 && drawState !== "COMPLETE" && (
              <div className="border border-border/80 bg-card/30 backdrop-blur-md rounded-2xl p-3.5 space-y-2 animate-in fade-in duration-300">
                <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
                  <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">Traced Sections</span>
                  <span className="font-mono text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-lg">
                    {polygons.length} {polygons.length === 1 ? 'section' : 'sections'}
                  </span>
                </div>
                <div className="max-h-[100px] overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                  {polygons.map((poly, index) => {
                    const color = POLYGON_COLORS[index % POLYGON_COLORS.length];
                    return (
                      <div key={poly.id} className="flex items-center justify-between text-[11px] bg-card/60 border border-border/50 px-3 py-1.5 rounded-xl hover:border-primary/30 transition-colors">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                          <span className="font-bold text-foreground">Section {index + 1}</span>
                          <span className="text-muted-foreground">({poly.area} m²)</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-6 h-6 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                          onClick={() => handleDeleteSection(poly.id)}
                          aria-label={`Delete section ${index + 1}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
                {/* Total area summary */}
                <div className="flex justify-between items-center text-[11px] font-bold text-foreground pt-1 border-t border-border/40">
                  <span>Total Usable Area:</span>
                  <span className="font-mono text-primary font-bold">{polygons.reduce((sum, p) => sum + p.area, 0).toFixed(1)} m²</span>
                </div>
              </div>
            )}

            {/* ─── PHASE 2: Location found, waiting to draw ─── */}
            {hasSearched && drawState === "IDLE" && polygons.length === 0 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-400">
                <div className="relative border border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent rounded-2xl p-5 space-y-3 overflow-hidden">
                  <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-amber-500/5 rounded-full" />
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0 animate-pulse">
                      <MousePointerClick className="w-4 h-4 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-[10px] font-extrabold text-amber-500 uppercase tracking-wider">Step 2 of 3</p>
                      <h3 className="text-sm font-bold text-foreground leading-tight">Draw the Rooftop</h3>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    <span className="text-foreground font-semibold">Click the corners</span> of the roof on the satellite map to trace the boundary. Your cursor is now a crosshair.
                  </p>
                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    {[
                      { icon: "①", label: "Click corners" },
                      { icon: "②", label: "3+ points" },
                      { icon: "③", label: "Close loop" },
                    ].map(tip => (
                      <div key={tip.label} className="bg-muted/30 rounded-xl p-2 text-center">
                        <div className="text-base font-bold text-amber-500">{tip.icon}</div>
                        <div className="text-[9px] text-muted-foreground font-semibold leading-tight mt-0.5">{tip.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {hasSearched && drawState === "IDLE" && polygons.length > 0 && (
              <div className="space-y-3 animate-in fade-in duration-300">
                <div className="relative border border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent rounded-2xl p-4 space-y-3 overflow-hidden">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                      <Plus className="w-4 h-4 text-amber-500 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground leading-tight">Add Another Section?</h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Click the map to start tracing a new roof section.</p>
                    </div>
                  </div>
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full text-xs h-9 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm hover:scale-[1.01] active:scale-[0.99] transition-all"
                    onClick={handleDoneDrawing}
                  >
                    <Check className="w-3.5 h-3.5 mr-1" />
                    Done & Configure Specs
                  </Button>
                </div>
              </div>
            )}

            {/* ─── PHASE 2b: Actively drawing ─── */}
            {drawState === "DRAWING" && (
              <div className="space-y-3 animate-in fade-in duration-200">
                {/* Live vertex counter */}
                <div className="border border-primary/30 bg-gradient-to-br from-primary/5 to-transparent rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                        <MousePointerClick className="w-3.5 h-3.5 text-primary animate-bounce" />
                      </div>
                      <span className="text-[10px] font-extrabold text-primary uppercase tracking-wider">Drafting Active</span>
                    </div>
                    <span className="font-mono text-xs font-bold text-foreground bg-muted px-2 py-0.5 rounded-lg">
                      {vertexCount} pts
                    </span>
                  </div>

                  {/* Progress dots */}
                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: Math.max(vertexCount + 2, 5) }).map((_, i) => (
                      <div
                        key={i}
                        className={`rounded-full transition-all duration-300 ${
                          i < vertexCount
                            ? "w-2.5 h-2.5 bg-primary"
                            : i === vertexCount
                            ? "w-2.5 h-2.5 bg-primary/40 animate-pulse"
                            : "w-1.5 h-1.5 bg-muted-foreground/20"
                        }`}
                      />
                    ))}
                    <span className="text-[9px] text-muted-foreground ml-1 font-medium">points placed</span>
                  </div>

                  {/* Contextual tip */}
                  <div className="bg-muted/30 rounded-xl px-3 py-2 text-[10px] text-muted-foreground leading-relaxed">
                    {vertexCount === 0 && "👆 Click any corner of the roof to start"}
                    {vertexCount === 1 && "Click the next corner of the roof boundary"}
                    {vertexCount === 2 && "One more point to unlock the Close button"}
                    {vertexCount >= 3 && vertexCount < 5 && "Keep clicking corners — or click the green ● dot to close"}
                    {vertexCount >= 5 && "✓ Double-click or click the green ● dot to seal the boundary"}
                  </div>
                </div>
              </div>
            )}

            {/* ─── PHASE 3: Drawing complete — celebration + metrics ─── */}
            {drawState === "COMPLETE" && area !== null && (
              <div className="space-y-3 animate-in fade-in zoom-in-95 duration-400">

                {/* Success banner */}
                <div className="border border-emerald-500/30 bg-gradient-to-br from-emerald-500/8 to-transparent rounded-2xl p-4 space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                      <Check className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-[10px] font-extrabold text-emerald-500 uppercase tracking-wider">Rooftop Mapped ✓</p>
                      <p className="text-[10px] text-muted-foreground">Configure panels &amp; run analysis below</p>
                    </div>
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="bg-card/45 backdrop-blur-md border border-border/80 rounded-2xl p-3.5 space-y-0.5 shadow-sm hover:border-primary/45 transition-all duration-300 hover:scale-[1.02]">
                    <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider block">Rooftop Area</span>
                    <div className="font-mono text-lg font-extrabold gradient-text">{area} m²</div>
                    <span className="text-[9px] text-muted-foreground font-semibold">Usable: {Math.round(area * USABLE_AREA_FACTOR * 10) / 10} m²</span>
                  </div>
                  <div className="bg-card/45 backdrop-blur-md border border-border/80 rounded-2xl p-3.5 space-y-0.5 shadow-sm hover:border-primary/45 transition-all duration-300 hover:scale-[1.02]">
                    <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider block">Grid Size</span>
                    <div className="font-mono text-lg font-extrabold gradient-text">{panelCount} Panels</div>
                    <span className="text-[9px] text-muted-foreground font-semibold">~{Math.round((panelCount * (panelType === "premium" ? 550 : 450) / 1000) * 10) / 10} kWp</span>
                  </div>
                </div>

                {/* SCN-014: Mapped Roof Sections List */}
                <div className="border border-border/80 bg-card/30 backdrop-blur-md rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
                    <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">Traced Sections</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[10px] h-6 px-2 text-primary font-bold hover:bg-primary/5 rounded-lg flex items-center gap-1 cursor-pointer"
                      onClick={() => setDrawState("IDLE")}
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Section
                    </Button>
                  </div>
                  <div className="max-h-[100px] overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                    {polygons.map((poly, index) => {
                      const color = POLYGON_COLORS[index % POLYGON_COLORS.length];
                      return (
                        <div key={poly.id} className="flex items-center justify-between text-[11px] bg-card/60 border border-border/50 px-3 py-1.5 rounded-xl hover:border-primary/30 transition-colors">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                            <span className="font-bold text-foreground">Section {index + 1}</span>
                            <span className="text-muted-foreground">({poly.area} m²)</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-6 h-6 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                            onClick={() => handleDeleteSection(poly.id)}
                            aria-label={`Delete section ${index + 1}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {areaWarning && (
                  <Alert variant="destructive" className="rounded-2xl p-3 flex items-start gap-2 bg-destructive/5 border-destructive/15">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <div>
                      <AlertTitle className="text-xs font-bold leading-none mb-1">Area Warning</AlertTitle>
                      <AlertDescription className="text-[11px] leading-normal">{areaWarning}</AlertDescription>
                    </div>
                  </Alert>
                )}
              </div>
            )}

            {/* Stepper Header — only after drawing is complete */}
            <div className={`border-t border-border mt-3 pt-4 pb-2 transition-all duration-300 ${
              drawState !== "COMPLETE" ? "opacity-40 pointer-events-none" : ""
            }`}>
              {drawState !== "COMPLETE" && (
                <p className="text-[9px] text-muted-foreground text-center mb-3 font-medium">
                  🔒 Map your rooftop to unlock configuration
                </p>
              )}
              <div className="flex items-center justify-between px-1">
                {[
                  { num: 1, label: "Surface" },
                  { num: 2, label: "Panels" },
                  { num: 3, label: "Tariff" }
                ].map((step) => {
                  const isActive = activeStep === step.num;
                  const isCompleted = activeStep > step.num;
                  return (
                    <button
                      key={step.num}
                      onClick={() => drawState === "COMPLETE" && changeStep(step.num)}
                      className="flex flex-col items-center gap-1 group focus:outline-none flex-1 relative"
                      type="button"
                      disabled={drawState !== "COMPLETE"}
                    >
                      <div className="flex items-center w-full justify-center relative">
                        <div className="h-[2px] absolute left-0 right-0 top-1/2 -translate-y-1/2 z-0" style={{
                          left: step.num === 1 ? '50%' : '0%',
                          right: step.num === 3 ? '50%' : '0%',
                          backgroundColor: isCompleted ? '#22C55E' : 'rgba(120, 120, 120, 0.2)'
                        }} />
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold transition-all duration-300 relative z-10 ${
                            isActive && drawState === "COMPLETE"
                              ? "bg-gradient-to-br from-primary to-amber-500 text-black shadow-[0_0_12px_rgba(255,107,0,0.4)] ring-4 ring-primary/25 scale-110"
                              : isCompleted
                              ? "bg-emerald-500 text-white shadow-[0_0_10px_rgba(34,197,94,0.3)]"
                              : "bg-muted text-muted-foreground group-hover:bg-muted/80"
                          }`}
                        >
                          {isCompleted ? <Check className="w-3.5 h-3.5" /> : step.num}
                        </div>
                      </div>
                      <span
                        className={`text-[9px] font-extrabold uppercase tracking-wider transition-colors duration-300 mt-1.5 ${
                          isActive && drawState === "COMPLETE" ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                        }`}
                      >
                        {step.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Stepper Active Content */}
            <div className="mt-3">
              {/* Section 1: Surface Geometry */}
              {activeStep === 1 && (
                <div className="space-y-4 pt-1 pb-2 animate-in fade-in duration-300">
                  {/* Tilt Slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-muted-foreground font-medium cursor-help hover:text-foreground transition-colors flex items-center gap-1">
                            Structure Tilt <Info className="w-3.5 h-3.5 text-muted-foreground/60" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-[200px] text-[10px]">
                          Mounting tilt relative to the horizontal surface. Higher tilt angles require greater shading clearance spacing between rows.
                        </TooltipContent>
                      </Tooltip>
                      <span className="font-mono font-bold text-primary">{tiltDeg}°</span>
                    </div>
                    <Slider 
                      value={[tiltDeg]}
                      min={0}
                      max={45}
                      step={5}
                      onValueChange={(val) => setTiltDeg(val[0])}
                      className="py-1 cursor-pointer"
                    />
                  </div>

                  {/* Setback Slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-muted-foreground font-medium cursor-help hover:text-foreground transition-colors flex items-center gap-1">
                            Boundary Setback <Info className="w-3.5 h-3.5 text-muted-foreground/60" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-[200px] text-[10px]">
                          Clearance safety distance left along the outer edges of the roof perimeter (setback factor).
                        </TooltipContent>
                      </Tooltip>
                      <span className="font-mono font-bold text-primary">{setbackM} m</span>
                    </div>
                    <Slider 
                      value={[setbackM]}
                      min={0.2}
                      max={1.5}
                      step={0.1}
                      onValueChange={(val) => setSetbackM(val[0])}
                      className="py-1 cursor-pointer"
                    />
                  </div>

                  {/* Walkways Toggle */}
                  <div className="flex justify-between items-center pt-0.5 pb-0.5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-muted-foreground font-medium cursor-help hover:text-foreground transition-colors flex items-center gap-1">
                          Maintenance Walkways <Info className="w-3.5 h-3.5 text-muted-foreground/60" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-[200px] text-[10px]">
                        Integrate 0.8 meter gaps between rows to allow technical maintenance and washing clearance.
                      </TooltipContent>
                    </Tooltip>
                    <Switch 
                      checked={walkways}
                      onCheckedChange={setWalkways}
                    />
                  </div>

                  {/* Roof Shading Dropdown */}
                  <div className="flex justify-between items-center pt-0.5 pb-0.5 gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-muted-foreground font-medium cursor-help hover:text-foreground transition-colors flex items-center gap-1">
                          Roof Shading <Info className="w-3.5 h-3.5 text-muted-foreground/60" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-[200px] text-[10px]">
                        Select roof shading level (None: 0%, Partial: 15% loss, Heavy: 30% loss).
                      </TooltipContent>
                    </Tooltip>
                    <select
                      value={shading}
                      onChange={(e) => setShading(e.target.value as "none" | "partial" | "heavy")}
                      className="bg-muted text-foreground text-[10px] font-bold px-2 py-0.5 rounded-lg border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary h-7 w-28 cursor-pointer"
                    >
                      <option value="none" className="bg-background">None</option>
                      <option value="partial" className="bg-background">Partial</option>
                      <option value="heavy" className="bg-background">Heavy</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Section 2: Panel Specs */}
              {activeStep === 2 && (
                <div className="space-y-4 pt-1 pb-2 animate-in fade-in duration-300">
                  {/* Panel Wattage Selector */}
                  <div className="flex justify-between items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-muted-foreground font-medium cursor-help hover:text-foreground transition-colors flex items-center gap-1">
                          Panel Wattage <Info className="w-3.5 h-3.5 text-muted-foreground/60" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-[200px] text-[10px]">
                        Choose solar panel rating. Premium 550W panels occupy less space per kW.
                      </TooltipContent>
                    </Tooltip>
                    <ToggleGroup 
                      type="single" 
                      value={panelType} 
                      onValueChange={(val) => { if (val) setPanelType(val as "compact" | "premium"); }} 
                      className="bg-muted p-0.5 rounded-xl border border-border/50 h-7"
                    >
                      <ToggleGroupItem 
                        value="compact" 
                        className="px-2.5 h-6 text-[10px] font-bold rounded-lg data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
                      >
                        450W
                      </ToggleGroupItem>
                      <ToggleGroupItem 
                        value="premium" 
                        className="px-2.5 h-6 text-[10px] font-bold rounded-lg data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
                      >
                        550W
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>

                  {/* Alignment Selector */}
                  <div className="flex justify-between items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-muted-foreground font-medium cursor-help hover:text-foreground transition-colors flex items-center gap-1">
                          Alignment <Info className="w-3.5 h-3.5 text-muted-foreground/60" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-[200px] text-[10px]">
                        Roof aligns layout with the drawn perimeter. South aligns panel rows toward the geographical south for maximum solar harvest in India.
                      </TooltipContent>
                    </Tooltip>
                    <ToggleGroup 
                      type="single" 
                      value={alignment} 
                      onValueChange={(val) => { if (val) setAlignment(val as "roof" | "south"); }} 
                      className="bg-muted p-0.5 rounded-xl border border-border/50 h-7"
                    >
                      <ToggleGroupItem 
                        value="roof" 
                        className="px-2.5 h-6 text-[10px] font-bold rounded-lg data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
                      >
                        Roof
                      </ToggleGroupItem>
                      <ToggleGroupItem 
                        value="south" 
                        className="px-2.5 h-6 text-[10px] font-bold rounded-lg data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
                      >
                        South
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>

                  {/* Orientation Selector */}
                  <div className="flex justify-between items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-muted-foreground font-medium cursor-help hover:text-foreground transition-colors flex items-center gap-1">
                          Orientation <Info className="w-3.5 h-3.5 text-muted-foreground/60" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-[200px] text-[10px]">
                        Layout panels either vertically (Portrait), horizontally (Landscape), or calculate maximum coverage (Auto).
                      </TooltipContent>
                    </Tooltip>
                    <ToggleGroup 
                      type="single" 
                      value={orientation} 
                      onValueChange={(val) => { if (val) setOrientation(val as "portrait" | "landscape" | "auto"); }} 
                      className="bg-muted p-0.5 rounded-xl border border-border/50 h-7"
                    >
                      <ToggleGroupItem 
                        value="portrait" 
                        className="px-2 h-6 text-[10px] font-bold rounded-lg data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
                      >
                        Portrait
                      </ToggleGroupItem>
                      <ToggleGroupItem 
                        value="landscape" 
                        className="px-2 h-6 text-[10px] font-bold rounded-lg data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
                      >
                        Landscape
                      </ToggleGroupItem>
                      <ToggleGroupItem 
                        value="auto" 
                        className="px-2 h-6 text-[10px] font-bold rounded-lg data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
                        title="Fits maximum panels"
                      >
                        Auto
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                </div>
              )}

              {/* Section 3: Electricity Pricing */}
              {activeStep === 3 && (
                <div className="space-y-4 pt-1 pb-2 animate-in fade-in duration-300">
                  <div className="flex justify-between items-center text-[10px] font-bold text-foreground uppercase tracking-wider">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help hover:text-primary transition-colors flex items-center gap-1 text-muted-foreground">
                          Electricity Rate <Info className="w-3 h-3 text-muted-foreground/60" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-[200px] text-[10px]">
                        Your current grid utility bill rate per unit. Used to calculate financial offset potentials.
                      </TooltipContent>
                    </Tooltip>
                    <span className="font-mono font-bold text-primary">₹{electricityRate}/kWh</span>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Slider 
                      value={[electricityRate]}
                      min={MIN_ELECTRICITY_RATE} 
                      max={MAX_ELECTRICITY_RATE} 
                      step={0.5} 
                      onValueChange={(val) => setElectricityRate(val[0])}
                      className="flex-1 py-1 cursor-pointer"
                    />
                    <div className="flex items-center gap-1 bg-muted rounded-xl px-2 py-1 border border-border/50 shrink-0">
                      <input 
                        type="number" 
                        min={MIN_ELECTRICITY_RATE} 
                        max={MAX_ELECTRICITY_RATE} 
                        step={0.5} 
                        value={electricityRate} 
                        onChange={(e) => { 
                          const v = parseFloat(e.target.value); 
                          if (!isNaN(v) && v >= MIN_ELECTRICITY_RATE && v <= MAX_ELECTRICITY_RATE) setElectricityRate(v); 
                        }} 
                        className="w-8 bg-transparent text-center text-[11px] font-mono text-foreground font-bold border-none outline-none" 
                        aria-label="Rate input" 
                      />
                      <span className="text-[9px] text-muted-foreground font-medium">/kWh</span>
                    </div>
                  </div>
                </div>
              )}
            </div>


            {/* Offline Fallback Warning */}
            {isOfflineFallback && (
              <Alert className="rounded-2xl p-3 flex items-start gap-2 bg-amber-500/5 border-amber-500/15 text-amber-700 dark:text-amber-400 animate-in fade-in duration-300 mt-2 shadow-sm">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                <div>
                  <AlertTitle className="text-xs font-bold leading-none mb-1">Offline Fallback Mode</AlertTitle>
                  <AlertDescription className="text-[11px] leading-normal">
                    Local API server is unavailable. Calculations are using regional solar profile tables.
                  </AlertDescription>
                </div>
              </Alert>
            )}

            {/* Calculation Errors */}
            {calcError && (
              <Alert variant="destructive" className="rounded-2xl p-3 flex items-start gap-2 bg-destructive/5 border-destructive/15 animate-in fade-in slide-in-from-top-2 duration-300">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <div>
                  <AlertTitle className="text-xs font-bold leading-none mb-1">Calculation Failed</AlertTitle>
                  <AlertDescription className="text-[11px] leading-normal">{calcError}</AlertDescription>
                </div>
              </Alert>
            )}
          </CardContent>

            {/* Sticky/Pinned Sidebar Footer for Actions */}
            {((drawState === "DRAWING" && vertexCount >= 0) || (drawState === "COMPLETE" && area !== null)) && (
              <CardFooter className="p-5 border-t border-border bg-card/95 shrink-0 flex flex-col gap-2">
                {drawState === "DRAWING" && (
                  <div className="flex flex-col gap-2 w-full">
                    <div className="grid grid-cols-2 gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-xs h-9 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
                        onClick={handleDeleteLast}
                      >
                        Undo Last
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-xs h-9 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/5 hover:scale-[1.02] active:scale-[0.98] transition-all"
                          >
                            Cancel
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-2xl max-w-sm border border-border bg-card p-6 shadow-lg animate-in fade-in zoom-in-95 duration-200">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-sm font-bold">Discard Draft?</AlertDialogTitle>
                            <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
                              This will clear all rooftop outline coordinates you have placed so far. This action is irreversible.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="mt-4 flex flex-row gap-2 justify-end sm:space-x-0">
                            <AlertDialogCancel className="text-xs h-9 rounded-xl mt-0 border border-border bg-background text-foreground hover:bg-muted">Keep Editing</AlertDialogCancel>
                            <AlertDialogAction onClick={clearDrawing} className="text-xs h-9 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90">Discard</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                    <Button 
                      variant="default"
                      className="w-full text-xs h-10 rounded-xl bg-foreground text-background hover:bg-foreground/90 font-bold shadow-sm hover:scale-[1.01] active:scale-[0.99] transition-all"
                      onClick={() => finishPolygon()} 
                      disabled={vertexCount < 3}
                    >
                      {vertexCount >= 3 ? "Complete Outline" : `Need ${3 - vertexCount} more point${3 - vertexCount > 1 ? "s" : ""}`}
                    </Button>
                  </div>
                )}
                {drawState === "COMPLETE" && area !== null && (
                  <div className="flex gap-2 w-full">
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="shrink-0 h-11 w-11 rounded-xl hover:scale-[1.05] active:scale-[0.95] transition-all" 
                      onClick={clearDrawing} 
                      aria-label="Redraw polygon"
                    >
                      <RotateCcw className="w-4 h-4 text-foreground" />
                    </Button>
                    {activeStep >= 1 && (
                      <Button
                        variant="outline"
                        className="h-11 rounded-xl text-xs font-bold transition-all px-4 hover:scale-[1.03] active:scale-[0.97]"
                        onClick={() => {
                          if (activeStep === 1) {
                            setDrawState("IDLE");
                          } else {
                            changeStep(Math.max(activeStep - 1, 1));
                          }
                        }}
                        type="button"
                      >
                        {activeStep === 1 ? "Edit Sections" : "Back"}
                      </Button>
                    )}
                    {activeStep < 3 ? (
                      <Button
                        className="btn-primary flex-1 h-11 rounded-xl text-sm font-bold relative overflow-hidden hover:scale-[1.02] active:scale-[0.98] transition-all"
                        onClick={() => changeStep(Math.min(activeStep + 1, 3))}
                        type="button"
                      >
                        Next Step
                      </Button>
                    ) : (
                      <button 
                        className={`btn-primary flex-1 h-11 rounded-xl text-sm font-bold relative overflow-hidden hover:scale-[1.02] active:scale-[0.98] transition-all ${
                          (!!areaWarning || calculating) ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                        onClick={handleCalculate} 
                        disabled={!!areaWarning || calculating}
                        aria-label={calcError ? "Retry" : "Calculate potential"}
                      >
                        {calculating ? "Analyzing..." : calcError ? "Retry Calculation" : "Calculate Potential"}
                      </button>
                    )}
                  </div>
                )}
              </CardFooter>
            )}
          </Card>

        {/* ── Floating Zoom Controls ─────────────────────────── */}
        {!globeVisible && (
          <div className="absolute bottom-6 left-4 z-[1000] flex flex-col gap-2" role="group" aria-label="Map zoom controls">
            <button
              onClick={handleZoomIn}
              className="map-zoom-btn"
              aria-label="Zoom in"
              title="Zoom in"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={handleZoomOut}
              className="map-zoom-btn"
              aria-label="Zoom out"
              title="Zoom out"
            >
              <Minus className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── Loading overlay (High-fidelity GIS satellite radar scanner simulation) ── */}
        {calculating && (() => {
          const centroid = verticesRef.current && verticesRef.current.length >= 3 
            ? calcCentroid(verticesRef.current) 
            : { lat: 0, lng: 0 };
          const capacityKw = panelCount > 0 
            ? (panelCount * (panelType === "premium" ? 550 : 450) / 1000) 
            : 0;
          return (
            <div className="absolute inset-0 z-[2000] bg-black/65 backdrop-blur-[3px] flex items-center justify-center animate-in fade-in duration-300" role="progressbar" aria-label="Analyzing solar potential">
              {/* GIS Fullscreen Scanline */}
              <div className="absolute w-full h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_12px_rgba(255,107,0,0.8)] z-10 pointer-events-none animate-[scanline_2.5s_ease-in-out_infinite]" />

              {/* GIS Grid Overlay */}
              <div className="absolute inset-0 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.03] pointer-events-none" />

              {/* Telemetry Panel - Top Left */}
              <div className="absolute top-8 left-8 hidden md:flex flex-col gap-1.5 font-mono text-[10px] text-neutral-400 bg-black/50 border border-white/5 p-4 rounded-xl backdrop-blur-md pointer-events-none text-left">
                <div className="text-primary font-bold border-b border-white/10 pb-1 mb-1 tracking-wider">▲ SYSTEM TELEMETRY</div>
                <div>LOC.LAT: <span className="text-white">{centroid.lat.toFixed(6)}</span></div>
                <div>LOC.LNG: <span className="text-white">{centroid.lng.toFixed(6)}</span></div>
                <div>ROOF.AREA: <span className="text-white">{area ?? 0} m²</span></div>
                <div>EST.KWp: <span className="text-white">{capacityKw.toFixed(2)} kWp</span></div>
              </div>

              {/* Telemetry Panel - Top Right */}
              <div className="absolute top-8 right-8 hidden md:flex flex-col gap-1.5 font-mono text-[10px] text-neutral-400 bg-black/50 border border-white/5 p-4 rounded-xl backdrop-blur-md pointer-events-none text-left">
                <div className="text-primary font-bold border-b border-white/10 pb-1 mb-1 tracking-wider">▲ SOL.SIM.STATUS</div>
                <div>DATABASE: <span className="text-white">NASA POWER API</span></div>
                <div>NET.METERING: <span className="text-green-400 font-bold">ACTIVE</span></div>
                <div>TARIFF: <span className="text-white">₹{electricityRate}/kWh</span></div>
                <div>STATE: <span className="text-primary animate-pulse font-bold">CALCULATING...</span></div>
              </div>

              {/* Concentric radar circle behind the card */}
              <div className="absolute w-[450px] h-[450px] border border-primary/20 rounded-full animate-[radarPulse_4s_ease-out_infinite] pointer-events-none" />
              <div className="absolute w-[300px] h-[300px] border border-primary/10 rounded-full animate-[radarPulse_4s_ease-out_infinite_1.3s] pointer-events-none" />
              <div className="absolute w-[150px] h-[150px] border border-primary/5 rounded-full animate-[radarPulse_4s_ease-out_infinite_2.6s] pointer-events-none" />

              {/* Central scanning HUD Card */}
              <div className="bg-zinc-950/90 border border-white/10 rounded-3xl shadow-2xl p-10 text-center max-w-sm w-[calc(100vw-32px)] space-y-6 relative overflow-hidden animate-fade-slide-up z-20">
                <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-primary via-orange-500 to-amber-500 animate-pulse"></div>
                
                {/* Spinning compass HUD */}
                <div className="flex justify-center relative">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-primary/10 via-orange-400/5 to-transparent flex items-center justify-center animate-spin-slow">
                    <Compass className="w-10 h-10 text-primary opacity-60" />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Sun className="w-8 h-8 text-primary animate-pulse" />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-base font-extrabold text-white tracking-tight uppercase">GIS Satellite Scan Active</div>
                  <div className="text-xs text-neutral-400 leading-relaxed">
                    Compiling spatial Twin layout with historical meteorological yields & net-metering schedules.
                  </div>
                </div>

                {/* Staggered process steps */}
                <div className="space-y-2 border-y border-white/5 py-4 font-mono text-[10px] text-left max-w-[280px] mx-auto text-neutral-400">
                  <div className="animate-[fadeIn_0.4s_ease_both] flex items-center gap-2">
                    <span className="text-green-500 font-bold">✓</span> Ingesting NASA solar irradiance...
                  </div>
                  <div className="animate-[fadeIn_0.4s_ease_both] flex items-center gap-2 [animation-delay:500ms]">
                    <span className="text-green-500 font-bold">✓</span> Analyzing layout panel geometry...
                  </div>
                  <div className="animate-[fadeIn_0.4s_ease_both] flex items-center gap-2 [animation-delay:1000ms]">
                    <span className="text-green-500 font-bold">✓</span> Calculating PM Surya Ghar subsidies...
                  </div>
                  <div className="animate-[fadeIn_0.4s_ease_both] flex items-center gap-2 [animation-delay:1500ms]">
                    <span className="text-primary">●</span> Compiling 25-yr ROI balance sheet...
                  </div>
                </div>

                {/* Sweeping loading bar */}
                <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden relative">
                  <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-primary to-orange-400 rounded-full animate-flow-dash h-full" style={{ width: '40%', animation: 'gradientShift 1.5s infinite linear' }}></div>
                </div>
              </div>
            </div>
          );
        })()}

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
      </div>
    </TooltipProvider>
  );
};

export default MapPage;
