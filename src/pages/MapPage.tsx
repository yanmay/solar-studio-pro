import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { polygon as turfPolygon } from "@turf/helpers";
import turfArea from "@turf/area";
import {
  Search,
  Loader2,
  Minus,
  Plus,
  RotateCcw,
  AlertTriangle,
  MapPin,
  MousePointerClick,
  Cpu,
  Sliders,
  Info,
  Sun,
  Compass,
  HelpCircle,
  Check,
  Home,
  Monitor,
  Trash2,
  X,
  LocateFixed,
  Sparkles,
  Mic,
  MicOff
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from "@/components/ui/breadcrumb";
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
import { detectDiscom, type DiscomInfo } from "@/lib/discom-rates";
import { detectBuildingAt, nearbyBuildings } from "@/lib/osm-buildings";
import { recommendBattery, type BackupMode } from "@/lib/battery-calc";
import { calcTiltAzimuthFactor, type Azimuth, AZIMUTH_LABELS } from "@/lib/tilt-azimuth";
import PhotoRoofEstimator from "@/components/PhotoRoofEstimator";
import { useVoiceSearch } from "@/hooks/use-voice-search";
import {
  ELECTRICITY_RATE_INR,
  MIN_ELECTRICITY_RATE,
  MAX_ELECTRICITY_RATE,
  USABLE_AREA_FACTOR,
  MIN_AREA_M2,
  MAX_AREA_M2,
} from "@/lib/solar-defaults";

type LatLng = { lat: number; lng: number };
type DrawState = "IDLE" | "DRAWING" | "COMPLETE";

const GOOGLE_MAPS_API_KEY = "AIzaSyDFkPRXVfhHADwyZHtFy2j_XElhNqa2HS4";
const CLOSE_SNAP_PX = 20;
const GLOBE_DISMISS_DISTANCE = 250;

const POLYGON_COLORS = [
  "#3B82F6", // Blue
  "#10B981", // Emerald
  "#F59E0B", // Amber
  "#EC4899", // Pink
  "#8B5CF6", // Purple
];

interface NominatimSuggestion {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  address?: Record<string, string>;
}

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

function calcAreaM2(latlngs: LatLng[]): number {
  if (latlngs.length < 3) return 0;
  const coords = latlngs.map((p) => [p.lng, p.lat] as [number, number]);
  coords.push(coords[0]);
  const poly = turfPolygon([coords]);
  return Math.round(turfArea(poly) * 10) / 10;
}

function calcCentroid(latlngs: LatLng[]): LatLng {
  if (latlngs.length === 0) return { lat: 20.5937, lng: 78.9629 };
  const lat = latlngs.reduce((sum, p) => sum + p.lat, 0) / latlngs.length;
  const lng = latlngs.reduce((sum, p) => sum + p.lng, 0) / latlngs.length;
  return { lat, lng };
}

// ── Geocode helpers ────────────────────────────────────────

const NOMINATIM_HEADERS = {
  "Accept-Language": "en",
  "User-Agent": "SunPowerLinkSolarApp/1.0 (https://sunpowerlink.in)",
};

interface NominatimSearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
  address?: Record<string, string>;
}

async function fetchNominatimSuggestions(
  query: string,
  signal: AbortSignal,
): Promise<NominatimSuggestion[]> {
  try {
    const nomUrl = `/api/geocode?q=${encodeURIComponent(query)}&limit=6`;
    const nomRes = await fetch(nomUrl, { signal });
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

async function fetchSuggestions(
  query: string,
  signal: AbortSignal,
  mapCenter?: { lat: number; lng: number },
): Promise<NominatimSuggestion[]> {
  // Try Google Autocomplete first
  const body: Record<string, unknown> = {
    input: query,
    languageCode: "en",
    regionCode: "IN",
  };

  if (mapCenter) {
    body.locationBias = {
      circle: {
        center: { latitude: mapCenter.lat, longitude: mapCenter.lng },
        radius: 50000,
      },
    };
  }

  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/places:autocomplete?key=${GOOGLE_MAPS_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      },
    );
    if (res.ok) {
      const data = await res.json();
      if (data.suggestions) {
        const nomSuggestions: NominatimSuggestion[] = [];
        for (const s of data.suggestions) {
          const pred = s.placePrediction;
          if (!pred) continue;
          
          let lat = "0";
          let lon = "0";
          try {
            const detailRes = await fetch(
              `https://places.googleapis.com/v1/places/${pred.placeId}?fields=location&key=${GOOGLE_MAPS_API_KEY}`,
              { signal }
            );
            if (detailRes.ok) {
              const detail = await detailRes.json();
              if (detail.location) {
                lat = String(detail.location.latitude);
                lon = String(detail.location.longitude);
              }
            }
          } catch {
            continue;
          }

          nomSuggestions.push({
            place_id: Date.now() + Math.random(),
            display_name: pred.text.text,
            lat,
            lon,
            type: "place",
          });
        }
        if (nomSuggestions.length > 0) return nomSuggestions;
      }
    }
  } catch {
    // Fallback
  }

  // Fallback to local Nominatim proxy
  return fetchNominatimSuggestions(query, signal);
}

// Fallback forward geocoder — queries Nominatim directly, biased to the
// current map bounds when available. Used when the primary geocoder fails.
async function geocodeAddress(
  address: string,
  bounds?: L.LatLngBounds | null
): Promise<{ lat: number; lng: number; label: string }> {
  let url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
    address.trim()
  )}&format=json&addressdetails=1&limit=1&accept-language=en`;
  if (bounds) {
    const viewbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;
    url += `&viewbox=${viewbox}`;
  }
  const res = await fetch(url, {
    headers: { "User-Agent": "SunPowerLinkSolarApp/1.0" },
  });
  if (!res.ok) throw new Error("Geocoding service unavailable.");
  const data = await res.json();
  if (!data || data.length === 0) {
    throw new Error("Location not found. Try adding details like city or state name.");
  }
  const first = data[0];
  return {
    lat: parseFloat(first.lat),
    lng: parseFloat(first.lon),
    label: first.display_name,
  };
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

// ── MapPage Component ───────────────────────────────────────────

const MapPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  
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
  const [locationDotMarker, setLocationDotMarker] = useState<L.Marker | null>(null);

  // ── SCN-014: Distinct colors for multi-roof polygons ───
  const [polygons, setPolygons] = useState<{ id: string; vertices: LatLng[]; area: number; polygonLayer: L.Polygon }[]>([]);
  const [activeStep, setActiveStep] = useState<number>(1);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [detectedState, setDetectedState] = useState<string | null>(null);
  const [discomName, setDiscomName] = useState<string | null>(null);

  // ── Remote yield states & BESS settings ─────────────────
  const [tiltDeg, setTiltDeg] = useState(20);             // degrees, 0-45
  const [azimuth, setAzimuth] = useState<Azimuth>("S");
  const [backupMode, setBackupMode] = useState<BackupMode>("none");
  const [photoEstOpen, setPhotoEstOpen] = useState(false);
  const [autoDetecting, setAutoDetecting] = useState(false);
  const [shadingNote, setShadingNote] = useState<string | null>(null);

  // ── Layout settings ─────────────────────────────────────
  const [orientation, setOrientation] = useState<"portrait" | "landscape" | "auto">("auto");
  const [alignment, setAlignment] = useState<"roof" | "south">("roof");
  const [walkways, setWalkways] = useState(false);
  const [setbackM, setSetbackM] = useState(0.5);
  const [panelType, setPanelType] = useState<"compact" | "premium">("compact");
  const [shading, setShading] = useState<"none" | "partial" | "heavy">("none");

  // ── Voice search ────────────────────────────────────────
  const voice = useVoiceSearch();
  useEffect(() => {
    if (voice.transcript) {
      setQuery(voice.transcript);
    }
  }, [voice.transcript]);

  // ── Globe state ─────────────────────────────────────────
  const [globeVisible, setGlobeVisible] = useState(true);
  const [globeFadingOut, setGlobeFadingOut] = useState(false);
  const globeRef = useRef<Globe3DHandle>(null);

  const isMobile = useIsMobile();
  const [mobileWarningDismissed, setMobileWarningDismissed] = useState(false);
  const dismissMobileWarning = () => setMobileWarningDismissed(true);

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

  const guideStep =
    drawState === "COMPLETE" ? 4 :
    drawState === "DRAWING" ? 3 :
    hasSearched ? 2 : 1;

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
      scrollWheelZoom: false,
      dragging: false,
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
        map.getContainer().style.cursor = "crosshair";
      }
    });

    mapRef.current = map;
    setMapReady(true);
  }, []);

  // ── Globe distance handler (binary fade thresholds) ──────
  const handleGlobeDistance = useCallback((dist: number) => {
    if (dist <= GLOBE_DISMISS_DISTANCE) {
      setGlobeFadingOut(true);
      setTimeout(() => {
        setGlobeVisible(false);
        setGlobeFadingOut(false);
        if (mapRef.current) {
          mapRef.current.scrollWheelZoom.enable();
          mapRef.current.dragging.enable();
        }
      }, 600);
    }
  }, []);

  // ── Search & Pan ─────────────────────────────────────────
  const flyToLocation = useCallback((lat: number, lng: number, label: string) => {
    const map = mapRef.current;
    if (!map) return;

    setHasSearched(true);
    setSidebarExpanded(true);
    setLocationLabel(label);

    if (globeVisible) {
      setGlobeFadingOut(true);
      setTimeout(() => {
        setGlobeVisible(false);
        setGlobeFadingOut(false);
        map.scrollWheelZoom.enable();
        map.dragging.enable();
        map.setView([lat, lng], 19);
      }, 600);
    } else {
      map.setView([lat, lng], 19);
    }
  }, [globeVisible]);

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

  // ── Geocoder lookup on query submit ──────────────────────
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
      // Fallback geocoder lookup
      try {
        const bounds = mapRef.current?.getBounds();
        const fallbackRes = await geocodeAddress(query, bounds);
        flyToLocation(fallbackRes.lat, fallbackRes.lng, fallbackRes.label);
        
        // Reverse geocode fallback state detection
        const fullGeo = await reverseGeocode(fallbackRes.lat, fallbackRes.lng);
        if (fullGeo) {
          const stateMatch = fullGeo.split(", ").find(s => s.toLowerCase().includes("india") === false && s.match(/^[a-zA-Z\s]+$/));
          if (stateMatch) setDetectedState(stateMatch);
        }
      } catch (errFallback) {
        const msg = (error as Error).message || "Location not found. Try adding details like city or state name.";
        setSearchError(msg);
        toast({ title: "Search Failed", description: msg, variant: "destructive" });
      }
    } finally {
      setSearching(false);
    }
  };

  const handleSuggestionClick = (s: NominatimSuggestion) => {
    const lat = parseFloat(s.lat);
    const lng = parseFloat(s.lon);
    setQuery(s.display_name.split(", ").slice(0, 3).join(", "));
    
    // Attempt state extraction from address
    if (s.address?.state) {
      setDetectedState(s.address.state);
    } else {
      const stateMatch = s.display_name.split(", ").find(part => part.match(/^[a-zA-Z\s]+$/) && !part.toLowerCase().includes("india"));
      if (stateMatch) setDetectedState(stateMatch);
    }

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

  // ── Navigation Wizard steps handler ──────────────────────
  const changeStep = (targetStep: number) => {
    if (targetStep > activeStep) {
      if (activeStep === 1) {
        if (polygons.length === 0) {
          toast({ title: "Outline Required", description: "Please outline your rooftop boundary first.", variant: "destructive" });
          return;
        }
      } else if (activeStep === 2) {
        if (panelCount === 0) {
          toast({ title: "No Panels Placed", description: "Rooftop settings cleared panel grids. Readjust setbacks or mounting properties.", variant: "destructive" });
          return;
        }
      }
    }
    setActiveStep(targetStep);
  };

  // ── Layout rendering logic (Cell grid & busbars) ──────────
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
        // Outer panel body
        const panelPoly = L.polygon(panel.corners, {
          color: "#0F1F3D",
          fillColor: "#1a3a6e",
          fillOpacity: 0.82,
          weight: 1,
        });
        panelGroup.addLayer(panelPoly);

        // Internal cell grid lines
        const [tl, tr, br, bl] = panel.corners;
        const COLS = panel.isLandscape ? 10 : 3;
        const ROWS = panel.isLandscape ? 3 : 10;

        const lerp = (
          a: [number, number], b: [number, number], t: number,
        ): [number, number] => [
          a[0] + (b[0] - a[0]) * t,
          a[1] + (b[1] - a[1]) * t,
        ];

        // Vertical lines
        for (let c = 1; c < COLS; c++) {
          const t = c / COLS;
          const top = lerp(tl, tr, t);
          const bot = lerp(bl, br, t);
          panelGroup.addLayer(L.polyline([top, bot], {
            color: "#5b8fc9", weight: 0.5, opacity: 0.6,
          }));
        }

        // Horizontal lines
        for (let r = 1; r < ROWS; r++) {
          const t = r / ROWS;
          const left  = lerp(tl, bl, t);
          const right = lerp(tr, br, t);
          panelGroup.addLayer(L.polyline([left, right], {
            color: "#5b8fc9", weight: 0.5, opacity: 0.6,
          }));
        }

        // Mid line busbar
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

  // Redraw panels reactive to settings and polygons
  useEffect(() => {
    if (drawState === "COMPLETE" || polygons.length > 0) {
      redrawAllPanels();
    }
  }, [drawState, polygons, redrawAllPanels]);

  // ── Drawing controllers ──────────────────────────────────
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

    // Clear completed polygons
    polygons.forEach((p) => p.polygonLayer.remove());
    setPolygons([]);
    setArea(null);
    setAreaWarning(null);
    setDrawState("IDLE");

    if (panelLayerRef.current) {
      panelLayerRef.current.remove();
      panelLayerRef.current = null;
    }
    setPanelCount(0);
    setShadingNote(null);
  }, [polygons]);

  const removePolygon = (id: string) => {
    setPolygons((prev) => {
      const match = prev.find((p) => p.id === id);
      match?.polygonLayer.remove();
      const next = prev.filter((p) => p.id !== id);
      const totalArea = next.reduce((sum, p) => sum + p.area, 0);
      setArea(next.length > 0 ? totalArea : null);
      if (next.length > 0 && totalArea < MIN_AREA_M2) {
        setAreaWarning(`Total area is only ${totalArea} m². Minimum is ${MIN_AREA_M2} m² for accurate analysis.`);
      } else {
        setAreaWarning(null);
      }
      return next;
    });
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

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
    verticesRef.current = [];
    setVertexCount(0);
    setDrawState("IDLE");
  }, []);

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
        .catch(() => {
          // Fallback geocoder lookup
          geocodeAddress(qParam, mapRef.current?.getBounds())
            .then((res) => {
              flyToLocation(res.lat, res.lng, res.label);
              reverseGeocode(res.lat, res.lng).then((fullGeo) => {
                const stateMatch = fullGeo.split(", ").find(s => !s.toLowerCase().includes("india") && s.match(/^[a-zA-Z\s]+$/));
                if (stateMatch) setDetectedState(stateMatch);
              });
            })
            .catch((err) => {
              setSearchError(err.message || "Location not found.");
            });
        })
        .finally(() => {
          setSearching(false);
        });
    }
  }, [searchParams, flyToLocation, geocodeAsync, mapReady]);

  // ── Photo Estimator import area ─────────────────────────
  const handlePhotoAreaAccept = useCallback((areaM2: number) => {
    const map = mapRef.current;
    if (!map) return;
    clearDrawing();
    const center = map.getCenter();
    const side = Math.sqrt(areaM2);
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
    trackPolygonCompleted(areaM2);
    toast({ title: "Area imported", description: `${areaM2} m² from your photo.` });
  }, [clearDrawing, finishPolygon, toast]);

  // ── OSM building boundary detector ───────────────────────
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
      clearDrawing();
      const ring = result.polygon[0].lat === result.polygon[result.polygon.length - 1].lat
                 && result.polygon[0].lng === result.polygon[result.polygon.length - 1].lng
                 ? result.polygon.slice(0, -1)
                 : result.polygon;
      verticesRef.current = ring.map((p) => ({ lat: p.lat, lng: p.lng }));
      setVertexCount(verticesRef.current.length);
      verticesRef.current.forEach((v, i) => {
        const marker = L.marker([v.lat, v.lng], { icon: i === 0 ? firstVertexIcon : vertexIcon }).addTo(map);
        markersRef.current.push(marker);
      });
      finishPolygon(map);
      
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
        .catch(() => {});
      
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

  // ── GPS Geolocation finder ────────────────────────────────
  const handleLocateMe = useCallback(() => {
    if (!("geolocation" in navigator)) {
      toast({ title: "Location not supported", description: "Your browser doesn't support geolocation.", variant: "destructive" });
      return;
    }
    setLocating(true);
    setLocationError("");
    
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        let label = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        
        const map = mapRef.current;
        if (map) {
          if (locationDotMarker) locationDotMarker.remove();
          const mark = L.marker([lat, lng], { icon: locationDotIcon }).addTo(map);
          setLocationDotMarker(mark);
        }

        try { label = await reverseGeocode(lat, lng); } catch { /* ignore */ }
        
        // Detect state for discom rates
        const stateMatch = label.split(", ").find(s => !s.toLowerCase().includes("india") && s.match(/^[a-zA-Z\s]+$/));
        if (stateMatch) setDetectedState(stateMatch);

        flyToLocation(lat, lng, label);
        toast({ title: "Location found", description: label });
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        const msg = err.code === 1
          ? "Permission denied. Allow location access in browser settings."
          : err.code === 2
          ? "Location unavailable. Search for your address instead."
          : "Location request timed out.";
        setLocationError(msg);
        toast({ title: "Geolocation Failed", description: msg, variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, [flyToLocation, locationDotMarker, toast]);

  // ── Calculation execution ────────────────────────────────
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
      trackPolygonCompleted(totalArea);
      trackConfigStepCompleted(3);

      const irradiance = await fetchSolarIrradiance(centroid.lat, centroid.lng);
      setIsOfflineFallback(irradiance.source === "REGIONAL_FALLBACK");

      // Tilt + azimuth correction applied to PSH
      const tiltFactor = calcTiltAzimuthFactor(tiltDeg, azimuth);
      const correctedPsh = irradiance.peakSunHours * tiltFactor;

      const panelWattage = panelType === "premium" ? 550 : 450;
      const customCapacityKw = panelCount > 0 
        ? Math.round((panelCount * panelWattage / 1000) * 100) / 100 
        : undefined;

      const analysis: SolarAnalysis = runFullCalculation(totalArea, correctedPsh, {
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

      // Battery BESS recommendation sized against daily generation output
      const battery = recommendBattery(analysis.energy.dailyKwh, backupMode);

      // Discom detection
      const discomInfo = detectedState ? getDiscomTariff(detectedState) : null;

      const fullResult = {
        ...analysis,
        location: {
          lat: centroid.lat,
          lng: centroid.lng,
          label: locationLabel || `${centroid.lat.toFixed(4)}, ${centroid.lng.toFixed(4)}`,
        },
        panelCount,
        roof: {
          tilt: tiltDeg,
          azimuth,
          tiltFactor,
          sectionsCount: polygons.length,
          totalAreaM2: totalArea,
        },
        discom: discomInfo ? { name: discomInfo.discom, autoDetectedRate: discomInfo.defaultTariff } : undefined,
        battery,
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

      // Hydrate sessionStorage for remote i18n & AR pages
      sessionStorage.setItem("sunpower-results", JSON.stringify(fullResult));

      setCalculating(false);

      // Encode scan configuration URL payload
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
        {/* SCN-009: Mobile Interstitial warning banner */}
        {isMobile && !mobileWarningDismissed && (
          <Alert className="rounded-none border-b border-border bg-amber-500/10 dark:bg-amber-500/5 text-foreground px-4 py-3 shrink-0 flex items-start justify-between gap-3 animate-in slide-in-from-top-full duration-300 z-[3000]">
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

        {/* Map layout wrapper */}
        <div className="relative flex-1 w-full h-full overflow-hidden">
          
          {/* ── Floating Controls Bar (Home, Theme, i18n) ─────────────────── */}
          <div className="absolute top-6 left-4 z-[1000] flex flex-col gap-2">
            <button
              onClick={() => navigate("/")}
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-card/65 backdrop-blur-2xl border border-border/80 shadow-[0_4px_30px_rgba(0,0,0,0.2)] hover:border-primary/80 hover:text-primary hover:shadow-[0_0_15px_rgba(255,107,0,0.3)] hover:scale-105 active:scale-95 transition-all cursor-pointer text-muted-foreground group"
              aria-label="Back to Home"
            >
              <Home className="w-4.5 h-4.5 group-hover:scale-110 transition-transform duration-300" />
            </button>
            <div className="flex flex-col gap-2 scale-90 sm:scale-100 origin-top-left">
              <ThemeToggle />
              <LanguageSwitcher align="left" />
            </div>
          </div>

          {/* ── Breadcrumbs ────────────────────────────────────────── */}
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

          {/* ── Leaflet map satellite layer ── */}
          <div
            ref={mapContainerRef}
            className="absolute inset-0 z-[2]"
            role="application"
            aria-label="Interactive satellite map"
          />

          {/* ── Three.js 3D Globe overlay ── */}
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
              {!globeFadingOut && (
                <div
                  className="absolute bottom-[6%] left-1/2 -translate-x-1/2 flex items-center gap-2 px-5 py-2.5 rounded-full pointer-events-none"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    backdropFilter: "blur(8px)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <Search className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs text-white/60 font-medium tracking-wide">Search a location or scroll to zoom in</span>
                </div>
              )}
            </div>
          )}

          {/* ── Search Bar with Autocomplete suggestions ── */}
          <div
            ref={searchContainerRef}
            className="absolute top-[max(1rem,env(safe-area-inset-top))] sm:top-6 left-14 sm:left-1/2 right-3 sm:right-auto sm:-translate-x-1/2 sm:w-[560px] z-[1000]"
          >
            <div
              className={`flex items-center bg-card/65 backdrop-blur-2xl border border-border/80 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.15)] overflow-hidden transition-all duration-300 ${
                guideStep === 1 ? "ring-2 ring-primary ring-offset-2 ring-offset-transparent" : ""
              } ${searchError ? "ring-2 ring-destructive" : ""} ${showSuggestions && suggestions.length > 0 ? "rounded-b-none" : ""}`}
              role="search"
              aria-label="Location search"
            >
              <div className="pl-4 text-muted-foreground" aria-hidden="true">
                <Search className="w-4 h-4" />
              </div>
              <input
                id="location-search"
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSearchError(""); }}
                onKeyDown={handleSearchKeyDown}
                onFocus={() => { if (suggestions.length > 0 && query.length >= 2) setShowSuggestions(true); }}
                placeholder={t("map.searchPlaceholder", "Search your rooftop address...")}
                className="flex-1 bg-transparent border-none outline-none px-3 py-3 text-[14px] text-foreground placeholder:text-muted-foreground font-medium"
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
                      const lang = i18n.language.startsWith("hi") ? "hi-IN"
                                 : i18n.language.startsWith("mr") ? "mr-IN"
                                 : i18n.language.startsWith("ta") ? "ta-IN"
                                 : i18n.language.startsWith("bn") ? "bn-IN"
                                 : "en-IN";
                      voice.start(lang);
                    }
                  }}
                  className={`px-2.5 py-3 text-sm shrink-0 transition-colors ${
                    voice.listening
                      ? "text-red-500 bg-red-500/10 animate-pulse"
                      : "text-muted-foreground hover:text-primary"
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
                className="bg-foreground text-background hover:bg-foreground/90 px-3 sm:px-5 py-3 text-[13px] font-bold transition-colors disabled:opacity-70 flex items-center gap-2 shrink-0"
                aria-label="Search"
              >
                {searching ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <>
                    <Search className="w-4 h-4 sm:hidden" aria-hidden="true" />
                    <span className="hidden sm:inline">{t("map.search", "Search")}</span>
                  </>
                )}
              </button>
            </div>

            {/* Suggestions dropdown list */}
            {showSuggestions && suggestions.length > 0 && (
              <div
                id="search-suggestions"
                className="bg-card/95 border-x border-b border-border rounded-b-2xl shadow-float overflow-hidden backdrop-blur-2xl"
                role="listbox"
                aria-label="Location suggestions"
              >
                {suggestions.map((s, index) => {
                  const { main, secondary } = formatSuggestion(s);
                  return (
                    <button
                      key={s.place_id}
                      id={`suggestion-${index}`}
                      onClick={() => handleSuggestionClick(s)}
                      className={`w-full text-left px-4 py-3 border-b border-border/40 hover:bg-muted/80 flex items-start gap-3 transition-colors ${
                        activeSuggestion === index ? "bg-muted" : ""
                      }`}
                      role="option"
                      aria-selected={activeSuggestion === index}
                    >
                      <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-foreground truncate">{main}</div>
                        {secondary && (
                          <div className="text-[10px] text-muted-foreground truncate mt-0.5">{secondary}</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {/* Listening notification */}
            {voice.listening && (
              <div className="mt-2 text-xs text-primary bg-card/65 border border-border/85 rounded-xl px-4 py-2.5 shadow-card flex items-center gap-2 animate-in fade-in duration-300">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                </span>
                <span className="truncate">
                  Listening{voice.interim ? ` · ${voice.interim}` : "…"}
                </span>
              </div>
            )}
            {voice.error && !voice.listening && (
              <div className="mt-2 text-xs text-destructive bg-card/65 border border-border/85 rounded-xl px-4 py-2.5 shadow-card">
                {voice.error}
              </div>
            )}
          </div>

          {/* ── GPS locator floating button ── */}
          <div className="absolute bottom-6 right-4 z-[1000] flex flex-col gap-2">
            <button
              onClick={handleLocateMe}
              disabled={locating}
              className="w-10 h-10 bg-card/65 backdrop-blur-2xl border border-border/80 shadow-md rounded-xl flex items-center justify-center hover:border-primary/80 hover:text-primary active:scale-95 transition-all disabled:opacity-60 cursor-pointer"
              aria-label="Find my location"
              title="Find my location"
            >
              {locating ? (
                <Loader2 className="w-4.5 h-4.5 text-primary animate-spin" />
              ) : (
                <LocateFixed className="w-4.5 h-4.5 text-muted-foreground hover:text-primary transition-colors" />
              )}
            </button>
          </div>

          {/* ── Right workspace sidebar config panel ── */}
          <Card
            className={`absolute top-[100px] bottom-6 right-4 w-[360px] z-[1000] border border-border shadow-[0_10px_40px_rgba(0,0,0,0.35)] flex flex-col overflow-hidden rounded-3xl transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] bg-card/75 backdrop-blur-2xl ${
              sidebarExpanded ? "opacity-100 translate-x-0" : "opacity-0 translate-x-[40px] pointer-events-none"
            }`}
          >
            {/* Sidebar header */}
            <CardHeader className="p-5 border-b border-border bg-muted/20 shrink-0">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <div className="text-[10px] font-extrabold text-primary uppercase tracking-widest flex items-center gap-1 font-mono">
                    <Sliders className="w-3.5 h-3.5" /> Workspace Config
                  </div>
                  <CardTitle className="text-base font-extrabold text-foreground leading-tight">
                    {drawState === "COMPLETE"
                      ? `Configure Potential`
                      : `Trace Rooftop Boundary`}
                  </CardTitle>
                </div>
                {drawState === "COMPLETE" && (
                  <Badge variant="secondary" className="text-[9px] font-bold tracking-wider font-mono">
                    STEP {activeStep}/3
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
                {drawState === "COMPLETE"
                  ? `Adjust panel orientation, mounting angles, and localized rates to simulate your yield.`
                  : `Draw the unshaded borders of your roof. Double-click the map or close the shape to finish.`}
              </p>
            </CardHeader>

            {/* Config panel body */}
            <CardContent className="p-5 flex-1 overflow-y-auto space-y-4 scrollbar-thin">
              {drawState !== "COMPLETE" && (
                <div className="space-y-4">
                  {/* Auto-detect & Photo Area Estimation row */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-[10px] h-8 rounded-xl flex items-center justify-center gap-1.5 font-bold hover:scale-[1.02] active:scale-[0.98] transition-all border-border"
                      onClick={handleAutoDetect}
                      disabled={autoDetecting}
                    >
                      {autoDetecting ? (
                        <><Loader2 className="w-3 h-3 animate-spin" /> {t("map.detecting", "Detecting...")}</>
                      ) : (
                        <><Sparkles className="w-3 h-3 text-amber-500" /> {t("map.autoDetect", "OSM Detect")}</>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-[10px] h-8 rounded-xl flex items-center justify-center gap-1.5 font-bold hover:scale-[1.02] active:scale-[0.98] transition-all border-border"
                      onClick={() => setPhotoEstOpen(true)}
                    >
                      <Sun className="w-3 h-3 text-primary" />
                      <span>Photo Area</span>
                    </Button>
                  </div>

                  {shadingNote && (
                    <div className="text-[9px] text-muted-foreground bg-muted/40 p-2.5 rounded-xl border border-border/40 leading-normal">
                      {shadingNote}
                    </div>
                  )}

                  <div className="flex gap-2 items-center text-xs text-muted-foreground border-b border-border/30 pb-2">
                    <MousePointerClick className="w-4 h-4 text-primary shrink-0" />
                    <span>Left-click on map satellite view to drop vertices.</span>
                  </div>

                  {/* Polygons drawing lists */}
                  {polygons.length > 0 && (
                    <div className="space-y-2.5">
                      <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        <span>Rooftop Sections</span>
                        <span className="font-mono text-foreground font-bold">
                          {polygons.length} {polygons.length === 1 ? 'section' : 'sections'}
                        </span>
                      </div>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {polygons.map((poly, index) => {
                          const col = POLYGON_COLORS[index % POLYGON_COLORS.length];
                          return (
                            <div key={poly.id} className="flex justify-between items-center bg-muted/40 px-3 py-2 rounded-xl border border-border/40 animate-in fade-in duration-200">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: col }} />
                                <span className="text-xs font-semibold text-foreground truncate">Section {index + 1}</span>
                                <span className="text-[10px] text-muted-foreground font-mono">({poly.area} m²)</span>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-destructive rounded-lg"
                                onClick={() => removePolygon(poly.id)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-border/30">
                        <span className="text-xs text-muted-foreground font-medium">Accumulated Usable Area</span>
                        <span className="font-mono text-primary font-bold">
                          {polygons.reduce((sum, p) => sum + p.area, 0).toFixed(1)} m²
                        </span>
                      </div>
                    </div>
                  )}

                  {hasSearched && drawState === "IDLE" && polygons.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground bg-muted/20 border border-dashed border-border/60 rounded-2xl">
                      <Sun className="w-8 h-8 text-primary/40 mb-2 animate-pulse" />
                      <p className="text-xs font-bold text-foreground">Awaiting Rooftop Tracing</p>
                      <p className="text-[10px] px-4 mt-0.5 leading-normal">
                        Click on your roof perimeter to place structure points. Connect them to calculate capacity.
                      </p>
                    </div>
                  )}

                  {hasSearched && drawState === "IDLE" && polygons.length > 0 && (
                    <Button
                      type="button"
                      className="w-full text-xs h-10 rounded-xl bg-foreground text-background hover:bg-foreground/90 font-bold hover:scale-[1.01] active:scale-[0.99] transition-all"
                      onClick={handleDoneDrawing}
                    >
                      Done Drawing · Proceed to Specs
                    </Button>
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
                {/* Step 1: Surface Geometry */}
                {activeStep === 1 && drawState === "COMPLETE" && (
                  <div className="space-y-4 pt-1 pb-2 animate-in fade-in duration-300">
                    {/* Tilt Slider */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[11px]">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-muted-foreground font-medium cursor-help hover:text-foreground transition-colors flex items-center gap-1">
                              Structure Tilt <Info className="w-3.5 h-3.5 text-muted-foreground/60" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="max-w-[200px] text-[10px]">
                            Mounting tilt relative to horizontal surface. Higher tilt angles require greater shading spacing between panel rows.
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
                    <div className="space-y-1.5">
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
                          <span className="text-muted-foreground font-medium cursor-help hover:text-foreground transition-colors flex items-center gap-1 text-[11px]">
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
                          <span className="text-muted-foreground font-medium cursor-help hover:text-foreground transition-colors flex items-center gap-1 text-[11px]">
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

                {/* Step 2: Panel Specs */}
                {activeStep === 2 && drawState === "COMPLETE" && (
                  <div className="space-y-4 pt-1 pb-2 animate-in fade-in duration-300">
                    {/* Panel Wattage Selector */}
                    <div className="flex justify-between items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-muted-foreground font-medium cursor-help hover:text-foreground transition-colors flex items-center gap-1 text-[11px]">
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
                          className="px-2.5 h-6 text-[10px] font-bold rounded-lg data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm"
                        >
                          450W
                        </ToggleGroupItem>
                        <ToggleGroupItem
                          value="premium"
                          className="px-2.5 h-6 text-[10px] font-bold rounded-lg data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm"
                        >
                          550W
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </div>

                    {/* Alignment Selector */}
                    <div className="flex justify-between items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-muted-foreground font-medium cursor-help hover:text-foreground transition-colors flex items-center gap-1 text-[11px]">
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
                          className="px-2.5 h-6 text-[10px] font-bold rounded-lg data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm"
                        >
                          Roof
                        </ToggleGroupItem>
                        <ToggleGroupItem
                          value="south"
                          className="px-2.5 h-6 text-[10px] font-bold rounded-lg data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm"
                        >
                          South
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </div>

                    {/* Orientation Selector */}
                    <div className="flex justify-between items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-muted-foreground font-medium cursor-help hover:text-foreground transition-colors flex items-center gap-1 text-[11px]">
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
                          className="px-2 h-6 text-[10px] font-bold rounded-lg data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm"
                        >
                          Portrait
                        </ToggleGroupItem>
                        <ToggleGroupItem
                          value="landscape"
                          className="px-2 h-6 text-[10px] font-bold rounded-lg data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm"
                        >
                          Landscape
                        </ToggleGroupItem>
                        <ToggleGroupItem
                          value="auto"
                          className="px-2 h-6 text-[10px] font-bold rounded-lg data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm"
                          title="Fits maximum panels"
                        >
                          Auto
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </div>

                    {/* Panel Azimuth direction button grid */}
                    <div className="space-y-1.5 pt-1 border-t border-border/40">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-muted-foreground font-medium cursor-help hover:text-foreground transition-colors flex items-center gap-1 text-[11px]">
                            Panel Azimuth <Info className="w-3.5 h-3.5 text-muted-foreground/60" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-[200px] text-[10px]">
                          Cardinal direction panels are facing. South (180°) is optimal for India.
                        </TooltipContent>
                      </Tooltip>
                      <div className="grid grid-cols-4 gap-1">
                        {(["S", "SE", "SW", "E", "W", "NE", "NW", "N"] as Azimuth[]).map((a) => (
                          <button
                            key={a}
                            type="button"
                            onClick={() => setAzimuth(a)}
                            className={`py-1 text-[10px] font-bold rounded-lg transition-all ${
                              azimuth === a
                                ? "bg-primary text-black shadow-sm"
                                : "bg-muted text-muted-foreground hover:bg-muted/80"
                            }`}
                          >
                            {AZIMUTH_LABELS[a]}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* BESS Battery recommendation selector */}
                    <div className="space-y-1.5 pt-1 border-t border-border/40">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-muted-foreground font-medium cursor-help hover:text-foreground transition-colors flex items-center gap-1 text-[11px]">
                            Battery Storage <Info className="w-3.5 h-3.5 text-muted-foreground/60" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-[200px] text-[10px]">
                          Choose BESS configuration for backup power during grid outages.
                        </TooltipContent>
                      </Tooltip>
                      <div className="grid grid-cols-3 gap-1.5">
                        {([
                          { v: "none", label: "Grid-tied", sub: "No battery" },
                          { v: "evening", label: "Evening", sub: "4 hr backup" },
                          { v: "offgrid", label: "Off-grid", sub: "Full day" },
                        ] as { v: BackupMode; label: string; sub: string }[]).map((o) => (
                          <button
                            key={o.v}
                            type="button"
                            onClick={() => setBackupMode(o.v)}
                            className={`py-1.5 px-1 rounded-lg text-[10px] font-bold transition-all flex flex-col items-center justify-center ${
                              backupMode === o.v
                                ? "bg-primary text-black shadow-sm"
                                : "bg-muted text-muted-foreground hover:bg-muted/80"
                            }`}
                          >
                            <span>{o.label}</span>
                            <span className="text-[8px] opacity-75 font-normal">{o.sub}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Electricity Pricing */}
                {activeStep === 3 && drawState === "COMPLETE" && (
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
                    {discomName && (
                      <div className="text-[10px] text-muted-foreground mt-1 bg-muted/20 p-2 rounded-lg leading-normal">
                        Auto-detected state tariff schedule: <span className="font-bold text-foreground">{discomName}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Offline Fallback Warning */}
              {isOfflineFallback && (
                <Alert className="rounded-2xl p-3 flex items-start gap-2 bg-amber-500/5 border-amber-500/15 text-amber-700 dark:text-amber-400 animate-in fade-in duration-300 mt-2 shadow-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                  <div>
                    <AlertTitle className="text-xs font-bold leading-none mb-1">Offline Fallback Mode</AlertTitle>
                    <AlertDescription className="text-[11px] leading-normal text-muted-foreground">
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

            {/* Pinned Card Footer actions */}
            {((drawState === "DRAWING" && vertexCount >= 0) || (drawState === "COMPLETE" && area !== null)) && (
              <CardFooter className="p-5 border-t border-border bg-card/95 shrink-0 flex flex-col gap-2">
                {drawState === "DRAWING" && (
                  <div className="flex flex-col gap-2 w-full">
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-9 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all border-border"
                        onClick={handleDeleteLast}
                      >
                        Undo Last
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-9 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/5 hover:scale-[1.02] active:scale-[0.98] transition-all border-border"
                          >
                            Cancel
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-3xl max-w-sm border border-border bg-card p-6 shadow-lg animate-in fade-in zoom-in-95 duration-200">
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
                      className="shrink-0 h-11 w-11 rounded-xl hover:scale-[1.05] active:scale-[0.95] transition-all border-border"
                      onClick={clearDrawing}
                      aria-label="Redraw polygon"
                    >
                      <RotateCcw className="w-4 h-4 text-foreground" />
                    </Button>
                    {activeStep >= 1 && (
                      <Button
                        variant="outline"
                        className="h-11 rounded-xl text-xs font-bold transition-all px-4 hover:scale-[1.03] active:scale-[0.97] border-border"
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
                        className="btn-primary flex-1 h-11 rounded-xl text-sm font-bold relative overflow-hidden hover:scale-[1.02] active:scale-[0.98] transition-all bg-primary text-black"
                        onClick={() => changeStep(Math.min(activeStep + 1, 3))}
                        type="button"
                      >
                        Next Step
                      </Button>
                    ) : (
                      <button
                        className={`btn-primary flex-1 h-11 rounded-xl text-sm font-bold relative overflow-hidden hover:scale-[1.02] active:scale-[0.98] transition-all bg-primary text-black ${
                          (!!areaWarning || calculating) ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                        onClick={handleCalculate}
                        disabled={!!areaWarning || calculating}
                        aria-label={calcError ? "Retry" : "Calculate potential"}
                      >
                        {calculating ? "Analyzing..." : calcError ? "Retry" : "Calculate Potential"}
                      </button>
                    )}
                  </div>
                )}
              </CardFooter>
            )}
          </Card>

          {/* ── Left Zoom Controls ── */}
          {!globeVisible && (
            <div className="absolute bottom-6 left-4 z-[1000] flex flex-col gap-2" role="group" aria-label="Map zoom controls">
              <button
                onClick={handleZoomIn}
                className="w-10 h-10 bg-card/65 backdrop-blur-2xl border border-border shadow-md rounded-xl flex items-center justify-center hover:border-primary/80 hover:text-primary active:scale-95 transition-all text-muted-foreground cursor-pointer"
                aria-label="Zoom in"
                title="Zoom in"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                onClick={handleZoomOut}
                className="w-10 h-10 bg-card/65 backdrop-blur-2xl border border-border shadow-md rounded-xl flex items-center justify-center hover:border-primary/80 hover:text-primary active:scale-95 transition-all text-muted-foreground cursor-pointer"
                aria-label="Zoom out"
                title="Zoom out"
              >
                <Minus className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ── GIS loading scanner overlay ── */}
          {calculating && (() => {
            const centroid = polygons.length > 0 
              ? calcCentroid(polygons.flatMap((p) => p.vertices))
              : { lat: 0, lng: 0 };
            const capacityKw = panelCount > 0 
              ? (panelCount * (panelType === "premium" ? 550 : 450) / 1000) 
              : 0;
            return (
              <div className="absolute inset-0 z-[2000] bg-black/65 backdrop-blur-[3px] flex items-center justify-center animate-in fade-in duration-300" role="progressbar" aria-label="Analyzing solar potential">
                {/* Fullscreen Scanline */}
                <div className="absolute w-full h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_12px_rgba(255,107,0,0.8)] z-10 pointer-events-none animate-[scanline_2.5s_ease-in-out_infinite]" />

                {/* Grid Overlay */}
                <div className="absolute inset-0 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.03] pointer-events-none" />

                {/* Left Telemetry HUD */}
                <div className="absolute top-8 left-8 hidden md:flex flex-col gap-1.5 font-mono text-[10px] text-neutral-400 bg-black/50 border border-white/5 p-4 rounded-xl backdrop-blur-md pointer-events-none text-left">
                  <div className="text-primary font-bold border-b border-white/10 pb-1 mb-1 tracking-wider">▲ SYSTEM TELEMETRY</div>
                  <div>LOC.LAT: <span className="text-white">{centroid.lat.toFixed(6)}</span></div>
                  <div>LOC.LNG: <span className="text-white">{centroid.lng.toFixed(6)}</span></div>
                  <div>ROOF.AREA: <span className="text-white">{area ?? 0} m²</span></div>
                  <div>EST.KWp: <span className="text-white">{capacityKw.toFixed(2)} kWp</span></div>
                </div>

                {/* Right Telemetry HUD */}
                <div className="absolute top-8 right-8 hidden md:flex flex-col gap-1.5 font-mono text-[10px] text-neutral-400 bg-black/50 border border-white/5 p-4 rounded-xl backdrop-blur-md pointer-events-none text-left">
                  <div className="text-primary font-bold border-b border-white/10 pb-1 mb-1 tracking-wider">▲ SOL.SIM.STATUS</div>
                  <div>DATABASE: <span className="text-white">NASA POWER API</span></div>
                  <div>NET.METERING: <span className="text-green-400 font-bold">ACTIVE</span></div>
                  <div>TARIFF: <span className="text-white">₹{electricityRate}/kWh</span></div>
                  <div>STATE: <span className="text-primary animate-pulse font-bold">CALCULATING...</span></div>
                </div>

                {/* Concentric radar circles */}
                <div className="absolute w-[450px] h-[450px] border border-primary/20 rounded-full animate-[radarPulse_4s_ease-out_infinite] pointer-events-none" />
                <div className="absolute w-[300px] h-[300px] border border-primary/10 rounded-full animate-[radarPulse_4s_ease-out_infinite_1.3s] pointer-events-none" />
                <div className="absolute w-[150px] h-[150px] border border-primary/5 rounded-full animate-[radarPulse_4s_ease-out_infinite_2.6s] pointer-events-none" />

                {/* HUD scan card */}
                <div className="bg-zinc-950/90 border border-white/10 rounded-3xl shadow-2xl p-10 text-center max-w-sm w-[calc(100vw-32px)] space-y-6 relative overflow-hidden animate-fade-slide-up z-20">
                  <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-primary via-orange-500 to-amber-500 animate-pulse"></div>
                  
                  {/* Compass */}
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

                  {/* Processes checklist */}
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

                  {/* Progress flow bar */}
                  <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden relative">
                    <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-primary to-orange-400 rounded-full animate-flow-dash h-full" style={{ width: '40%', animation: 'gradientShift 1.5s infinite linear' }}></div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Photo rooftop estimator dialog */}
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
      </div>
    </TooltipProvider>
  );
};

export default MapPage;
