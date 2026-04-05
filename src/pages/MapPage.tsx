import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const MapPage = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [vertices, setVertices] = useState<{ lat: number; lng: number }[]>([]);
  const [drawingState, setDrawingState] = useState<"IDLE" | "DRAWING" | "COMPLETE">("IDLE");
  const [area, setArea] = useState<number | null>(null);

  // Mock search
  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSearchError("");
    // Simulate geocoding delay
    await new Promise(r => setTimeout(r, 1000));
    setSearching(false);
    setHasSearched(true);
    // Mock: always succeed for demo
    setDrawingState("IDLE");
  };

  // Mock polygon complete
  const handleMockDraw = () => {
    setDrawingState("DRAWING");
    setTimeout(() => {
      setVertices([
        { lat: 28.6139, lng: 77.209 },
        { lat: 28.614, lng: 77.2095 },
        { lat: 28.6135, lng: 77.2098 },
        { lat: 28.6132, lng: 77.2092 },
      ]);
      setArea(150.3);
      setDrawingState("COMPLETE");
    }, 500);
  };

  const handleCancel = () => {
    setVertices([]);
    setArea(null);
    setDrawingState("IDLE");
  };

  const handleCalculate = () => {
    navigate("/results");
  };

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Map placeholder */}
      <div className="absolute inset-0 bg-[#2c3e50]">
        {/* Grey map placeholder with grid */}
        <div className="w-full h-full opacity-20" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "40px 40px"
        }} />
        {hasSearched && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="text-white/40 text-sm cursor-pointer border border-dashed border-white/30 px-6 py-3 rounded-md hover:border-white/50 transition-colors"
              onClick={handleMockDraw}
            >
              Click here to simulate drawing a polygon
            </div>
          </div>
        )}
      </div>

      {/* Search Bar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[min(560px,90vw)] z-10">
        <div className={`flex items-center bg-urja-bg-card rounded-pill shadow-float overflow-hidden ${searchError ? "ring-2 ring-destructive" : ""}`}>
          <div className="pl-4 text-urja-text-muted">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setSearchError(""); }}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
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
      {drawingState === "DRAWING" && (
        <div className="absolute top-4 right-4 flex gap-2 z-10 animate-fade-slide-up">
          <Button variant="ghost" size="sm" className="bg-urja-bg-card" onClick={() => {
            setArea(150.3);
            setDrawingState("COMPLETE");
          }}>
            <span className="border-l-2 border-urja-success pl-2">Finish</span>
          </Button>
          <Button variant="ghost" size="sm" className="bg-urja-bg-card">Delete last point</Button>
          <Button variant="ghost" size="sm" className="bg-urja-bg-card" onClick={handleCancel}>Cancel</Button>
        </div>
      )}

      {/* Instruction Tooltip */}
      {drawingState === "IDLE" && hasSearched && (
        <div className="absolute bottom-36 left-1/2 -translate-x-1/2 z-10 bg-foreground/70 backdrop-blur-sm text-white text-sm px-5 py-2.5 rounded-pill animate-fade-slide-up">
          Click on the map to draw a polygon on your rooftop
        </div>
      )}

      {drawingState === "IDLE" && !hasSearched && (
        <div className="absolute bottom-36 left-1/2 -translate-x-1/2 z-10 bg-foreground/70 backdrop-blur-sm text-white text-sm px-5 py-2.5 rounded-pill">
          Search location, then draw a polygon on your rooftop
        </div>
      )}

      {/* Area Card */}
      {drawingState === "COMPLETE" && area !== null && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[min(400px,90vw)] z-10 animate-fade-slide-up">
          <div className="bg-urja-bg-card rounded-xl shadow-float p-6 text-center">
            <div className="text-sm text-urja-text-muted mb-1">Rooftop Area</div>
            <div className="font-mono text-[32px] font-semibold text-urja-accent">{area} m²</div>
            <Button variant="cta" className="w-full mt-4" onClick={handleCalculate}>
              Calculate Solar Potential
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapPage;
