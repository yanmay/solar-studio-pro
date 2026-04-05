import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { polygon as turfPolygon } from "@turf/helpers";
import turfArea from "@turf/area";
import { Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

type LatLng = { lat: number; lng: number };
type DrawState = "IDLE" | "DRAWING" | "COMPLETE";

// White square marker icon
const vertexIcon = L.divIcon({
  className: "",
  html: `<div style="width:12px;height:12px;background:#fff;border:2px solid #3B82F6;border-radius:2px;"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

function calcAreaM2(latlngs: LatLng[]): number {
  if (latlngs.length < 3) return 0;
  const coords = latlngs.map((p) => [p.lng, p.lat] as [number, number]);
  coords.push(coords[0]);
  const poly = turfPolygon([coords]);
  return Math.round(turfArea(poly) * 10) / 10;
}

async function geocodeAddress(query: string): Promise<LatLng> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
  const res = await fetch(url, { headers: { "Accept-Language": "en" } });
  const data = await res.json();
  if (!data || data.length === 0) throw new Error("Location not found");
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

const MapPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [drawState, setDrawState] = useState<DrawState>("IDLE");
  const [area, setArea] = useState<number | null>(null);
  const [calculating, setCalculating] = useState(false);

  // Drawing state refs (avoid stale closures in map listeners)
  const verticesRef = useRef<LatLng[]>([]);
  const markersRef = useRef<L.Marker[]>([]);
  const polylineRef = useRef<L.Polyline | null>(null);
  const polygonRef = useRef<L.Polygon | null>(null);
  const drawStateRef = useRef<DrawState>("IDLE");

  // Sync drawState to ref
  useEffect(() => {
    drawStateRef.current = drawState;
  }, [drawState]);

  // Init map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [20.5937, 78.9629],
      zoom: 5,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { attribution: "Tiles &copy; Esri", maxZoom: 21 }
    ).addTo(map);

    // Click handler for drawing
    map.on("click", (e: L.LeafletMouseEvent) => {
      const state = drawStateRef.current;
      if (state === "COMPLETE") return;

      // Start drawing on first click
      if (state === "IDLE") {
        // We'll set to DRAWING via React state
      }

      const latlng: LatLng = { lat: e.latlng.lat, lng: e.latlng.lng };
      verticesRef.current = [...verticesRef.current, latlng];

      // Add marker
      const marker = L.marker([latlng.lat, latlng.lng], { icon: vertexIcon }).addTo(map);
      markersRef.current.push(marker);

      // Update polyline
      const coords = verticesRef.current.map((v) => [v.lat, v.lng] as [number, number]);
      if (polylineRef.current) {
        polylineRef.current.setLatLngs(coords);
      } else {
        polylineRef.current = L.polyline(coords, {
          color: "#3B82F6",
          weight: 2,
        }).addTo(map);
      }

      // Set drawing state
      if (drawStateRef.current === "IDLE") {
        setDrawState("DRAWING");
      }
    });

    // Double-click to finish
    map.on("dblclick", (e: L.LeafletMouseEvent) => {
      if (drawStateRef.current === "DRAWING" && verticesRef.current.length >= 3) {
        L.DomEvent.stopPropagation(e as any);
        finishPolygon(map);
      }
    });

    map.doubleClickZoom.disable();
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const finishPolygon = useCallback((map?: L.Map) => {
    const m = map || mapRef.current;
    if (!m || verticesRef.current.length < 3) return;

    // Remove polyline
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    // Draw filled polygon
    const coords = verticesRef.current.map((v) => [v.lat, v.lng] as [number, number]);
    polygonRef.current = L.polygon(coords, {
      color: "#3B82F6",
      fillColor: "#3B82F6",
      fillOpacity: 0.15,
      weight: 2,
    }).addTo(m);

    const calculatedArea = calcAreaM2(verticesRef.current);
    setArea(calculatedArea);
    setDrawState("COMPLETE");
  }, []);

  const handleDeleteLast = useCallback(() => {
    if (verticesRef.current.length === 0) return;
    verticesRef.current = verticesRef.current.slice(0, -1);

    // Remove last marker
    const lastMarker = markersRef.current.pop();
    lastMarker?.remove();

    // Update polyline
    if (verticesRef.current.length > 0) {
      const coords = verticesRef.current.map((v) => [v.lat, v.lng] as [number, number]);
      polylineRef.current?.setLatLngs(coords);
    } else {
      polylineRef.current?.remove();
      polylineRef.current = null;
      setDrawState("IDLE");
    }
  }, []);

  const handleCancel = useCallback(() => {
    // Clear everything
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    verticesRef.current = [];
    polylineRef.current?.remove();
    polylineRef.current = null;
    polygonRef.current?.remove();
    polygonRef.current = null;
    setArea(null);
    setDrawState("IDLE");
  }, []);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSearchError("");
    try {
      const { lat, lng } = await geocodeAddress(query);
      mapRef.current?.flyTo([lat, lng], 18, { animate: true, duration: 1.5 });
    } catch {
      setSearchError("Location not found. Try again.");
      toast({ title: "Location not found", description: "Please try a different address.", variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  const handleCalculate = async () => {
    if (!area || verticesRef.current.length < 3) return;
    setCalculating(true);

    // Mock solar calculation (replace with Antigravity API later)
    const usableArea = Math.round(area * 0.75 * 10) / 10;
    const kw = Math.round((usableArea / 8) * 10) / 10; // ~8 m² per kW
    const psh = 4.5; // Peak sun hours (India avg)
    const kwh = Math.round(kw * psh * 365 * 0.8); // 80% performance ratio
    const savings = Math.round(kwh * 7); // ₹7/kWh
    const co2 = Math.round(kwh * 0.82); // 0.82 kg CO₂ per kWh
    const monthlySavings = Math.round(savings / 12);
    const dailyKwh = Math.round((kwh / 365) * 10) / 10;
    const monthlyKwh = Math.round(kwh / 12);

    // Simulate API delay
    await new Promise((r) => setTimeout(r, 1500));

    const results = {
      area,
      usable: usableArea,
      kw,
      kwh,
      savings,
      co2,
      dailyKwh,
      monthlyKwh,
      monthlySavings,
      twentyFiveYearSavings: savings * 25,
      co2_25yr: co2 * 25,
      trees: Math.round(co2 / 22), // ~22 kg CO₂ per tree per year
    };

    // Store in sessionStorage for results page
    sessionStorage.setItem("urja-results", JSON.stringify(results));
    setCalculating(false);
    navigate("/results");
  };

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Map container */}
      <div ref={mapContainerRef} className="absolute inset-0 z-0" />

      {/* Search Bar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[min(560px,90vw)] z-[1000]">
        <div className={`flex items-center bg-urja-bg-card rounded-pill shadow-float overflow-hidden ${searchError ? "ring-2 ring-destructive" : ""}`}>
          <div className="pl-4 text-urja-text-muted">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSearchError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search your location..."
            className="flex-1 bg-transparent border-none outline-none px-3 py-3 text-[15px] text-urja-text-primary placeholder:text-urja-text-muted font-body"
          />
          <button
            onClick={handleSearch}
            disabled={searching}
            className="bg-urja-accent hover:bg-urja-accent-hover text-urja-accent-text px-5 py-3 text-[15px] font-medium transition-colors disabled:opacity-70 flex items-center gap-2"
          >
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
          </button>
        </div>
        {searchError && (
          <div className="mt-2 text-sm text-destructive bg-urja-bg-card rounded-md px-3 py-2 shadow-card">
            {searchError}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {drawState === "DRAWING" && (
        <div className="absolute top-4 right-4 flex flex-col sm:flex-row gap-2 z-[1000] animate-fade-slide-up">
          <Button
            variant="ghost"
            size="sm"
            className="bg-urja-bg-card shadow-card"
            onClick={() => finishPolygon()}
            disabled={verticesRef.current.length < 3}
          >
            <span className="border-l-2 border-urja-success pl-2">Finish</span>
          </Button>
          <Button variant="ghost" size="sm" className="bg-urja-bg-card shadow-card" onClick={handleDeleteLast}>
            Delete last point
          </Button>
          <Button variant="ghost" size="sm" className="bg-urja-bg-card shadow-card" onClick={handleCancel}>
            Cancel
          </Button>
        </div>
      )}

      {/* Instruction Tooltip */}
      {drawState === "IDLE" && (
        <div className="absolute bottom-36 left-1/2 -translate-x-1/2 z-[1000] bg-foreground/70 backdrop-blur-sm text-white text-sm px-5 py-2.5 rounded-pill animate-fade-slide-up">
          Search location, then click on the map to draw your rooftop
        </div>
      )}

      {/* Area Card */}
      {drawState === "COMPLETE" && area !== null && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[min(400px,90vw)] z-[1000] animate-fade-slide-up">
          <div className="bg-urja-bg-card rounded-xl shadow-float p-6 text-center">
            <div className="text-sm text-urja-text-muted mb-1">Rooftop Area</div>
            <div className="font-mono text-[32px] font-semibold text-urja-accent">{area} m²</div>
            <Button variant="cta" className="w-full mt-4" onClick={handleCalculate} loading={calculating}>
              {calculating ? "Calculating..." : "Calculate Solar Potential"}
            </Button>
          </div>
        </div>
      )}

      {/* Full-screen loading overlay */}
      {calculating && (
        <div className="absolute inset-0 z-[2000] bg-foreground/50 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-urja-bg-card rounded-xl shadow-float p-8 text-center animate-fade-slide-up">
            <Loader2 className="w-10 h-10 text-urja-accent animate-spin mx-auto mb-4" />
            <div className="text-lg font-medium text-urja-text-primary">Analyzing Solar Potential</div>
            <div className="text-sm text-urja-text-secondary mt-1">Processing satellite data...</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapPage;
