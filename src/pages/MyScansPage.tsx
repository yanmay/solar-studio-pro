import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { encodeScanToUrl } from "@/lib/scan-url";
import {
  Loader2, HardDrive, Calendar, MapPin, Zap, ArrowRight, ArrowLeft,
  ScanLine, BarChart3, Sun, Activity, Search
} from "lucide-react";
import { format } from "date-fns";

interface ScanRecord {
  id: string;
  site_id: string;
  address: string;
  latitude: number;
  longitude: number;
  structure_tilt: number;
  boundary_setback: number;
  maintenance_walkways: boolean;
  panel_wattage: number;
  panel_alignment: string;
  panel_orientation: string;
  shading: string;
  is_full_unlocked: boolean;
  created_at: string;
  solar_reports: {
    total_roof_area_sqm: number;
    panel_count: number;
    system_size_kwp: number;
  } | null;
  rooftop_sections: { polygon_coordinates: any }[];
}

// ui-ux-pro-max: expo.out easing token
const EASING = "cubic-bezier(0.16,1,0.3,1)";

export default function MyScansPage() {
  const { user } = useAuth();
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "My Scans — SolarScan AI";
    if (!user) return;
    const fetchScans = async () => {
      if (!supabase) { setLoading(false); return; }
      try {
        const { data, error } = await supabase
          .from("analysis_sessions")
          .select(`*, solar_reports(total_roof_area_sqm, panel_count, system_size_kwp), rooftop_sections(polygon_coordinates)`)
          .eq("user_id", user.id).order("created_at", { ascending: false });
        if (error) throw error;
        setScans((data as unknown as ScanRecord[]) || []);
      } catch (err) { console.error("Error fetching scans:", err); }
      finally { setLoading(false); }
    };
    fetchScans();
  }, [user]);

  const handleOpenScan = (scan: ScanRecord) => {
    const scanInput = {
      address: scan.address, lat: scan.latitude, lng: scan.longitude,
      roofAreaM2: scan.solar_reports?.total_roof_area_sqm || 0,
      roofPolygon: scan.rooftop_sections?.map(sec => ({ type: "Polygon" as const, coordinates: sec.polygon_coordinates })) || [],
    };
    const panelConfig = {
      tiltAngle: scan.structure_tilt, setbackM: scan.boundary_setback,
      walkwayM: scan.maintenance_walkways ? 0.5 : 0,
      panelWattage: (scan.panel_wattage as 450 | 550) || 450,
      orientation: (scan.panel_orientation as "portrait" | "landscape") || "portrait",
      rowAlignment: (scan.panel_alignment === "south" ? "geographical_south" : "roof_perimeter") as "geographical_south" | "roof_perimeter",
      panelCount: scan.solar_reports?.panel_count || 15,
      systemKwp: scan.solar_reports?.system_size_kwp || 6.75,
      shading: (scan.shading as "none" | "partial" | "heavy") || "none",
    };
    const encoded = encodeScanToUrl(scanInput, panelConfig, { tariffPerKwh: 7.5 });
    navigate(`/results?scan=${encoded}`);
  };

  const filtered = scans.filter(s =>
    !searchQuery || s.address?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Compute aggregate stats for bento top row
  const totalKwp = scans.reduce((acc, s) => acc + (s.solar_reports?.system_size_kwp || 0), 0);
  const totalPanels = scans.reduce((acc, s) => acc + (s.solar_reports?.panel_count || 0), 0);
  const unlockedCount = scans.filter(s => s.is_full_unlocked).length;

  return (
    <div className="min-h-screen bg-[#050505] text-white antialiased pb-24 selection:bg-[#FF6600]/30 selection:text-white relative overflow-x-hidden">
      {/* Ambient Glow Blobs — ui-ux-pro-max animated dark cinema */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div
          className="absolute top-[-15%] right-[-5%] w-[650px] h-[650px] rounded-full opacity-[0.07] blur-[140px]"
          style={{ background: "#FF6600", animation: "scansBlob1 20s ease-in-out infinite alternate" }}
        />
        <div
          className="absolute bottom-[-10%] left-[-5%] w-[450px] h-[450px] rounded-full opacity-[0.05] blur-[120px]"
          style={{ background: "#10B981", animation: "scansBlob2 25s ease-in-out infinite alternate" }}
        />
      </div>
      <style>{`
        @keyframes scansBlob1 { to { transform: translate(-40px, 50px) scale(1.08); } }
        @keyframes scansBlob2 { to { transform: translate(30px, -25px) scale(1.05); } }
        @keyframes scansCardIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .scan-card { animation: scansCardIn 0.5s ${EASING} both; }
        .scan-card:nth-child(1) { animation-delay: 0ms; }
        .scan-card:nth-child(2) { animation-delay: 60ms; }
        .scan-card:nth-child(3) { animation-delay: 120ms; }
        .scan-card:nth-child(4) { animation-delay: 180ms; }
        .scan-card:nth-child(5) { animation-delay: 240ms; }
        .scan-card:nth-child(6) { animation-delay: 300ms; }
      `}</style>

      {/* ── Sticky Header ──────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#050505]/85 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group" aria-label="SolarScan AI Home">
            <img src="/logo.png" alt="SolarScan AI Logo" className="w-8 h-8 object-contain transition-transform duration-200 group-hover:scale-105" />
            <span className="text-[15px] font-bold text-white tracking-tight">
              SUNPOWER <span className="font-['Calistoga',serif] italic font-normal text-[#FF6600]">LINK</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/map")}
              className="hidden sm:flex items-center gap-1.5 h-9 px-4 rounded-xl text-[11px] font-bold text-black transition-all active:scale-[0.97] cursor-pointer border-none shadow-lg shadow-[#FF6600]/20"
              style={{ background: "linear-gradient(135deg,#FF6600 0%,#FF8C38 100%)", transition: `all 200ms ${EASING}` }}
            >
              <Zap className="w-3.5 h-3.5 fill-current" /> New Scan
            </button>
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-1.5 h-9 px-4 rounded-xl text-[11px] font-semibold text-white/60 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all active:scale-[0.97] cursor-pointer"
              style={{ transition: `all 200ms ${EASING}` }}
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
          </div>
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 relative z-10 space-y-8">

        {/* Page Title — Calistoga hero */}
        <section className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-[#FF6600] text-[10px] font-mono font-bold uppercase tracking-[0.12em]">
            <HardDrive className="w-3.5 h-3.5" />
            <span>Analysis Repository</span>
          </div>
          <h1 className="text-4xl sm:text-5xl text-white leading-tight" style={{ fontFamily: "'Calistoga', serif", fontWeight: 400 }}>
            My Scans
          </h1>
          <p className="text-sm text-white/50 font-light max-w-xl leading-relaxed">
            Access, review, and reopen your saved rooftop solar performance analyses. Every scan is stored securely to your account.
          </p>
        </section>

        {/* Bento Summary Row — ui-ux-pro-max data-dense dashboard tiles */}
        {!loading && scans.length > 0 && (
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Total Scans", value: `${scans.length}`, sub: "Analysis sessions", icon: <ScanLine className="w-4 h-4 text-[#FF6600]" />, color: "text-white" },
              { label: "Total Capacity", value: `${totalKwp.toFixed(1)} kWp`, sub: "Aggregated system size", icon: <Zap className="w-4 h-4 text-[#FF6600]" />, color: "text-[#FF6600]" },
              { label: "Total Panels", value: `${totalPanels}`, sub: "Across all analyses", icon: <Sun className="w-4 h-4 text-amber-400" />, color: "text-amber-400" },
              { label: "Full Reports", value: `${unlockedCount}`, sub: `${scans.length - unlockedCount} preview mode`, icon: <BarChart3 className="w-4 h-4 text-emerald-400" />, color: "text-emerald-400" },
            ].map((stat, i) => (
              <div
                key={i}
                className="p-5 rounded-3xl border border-white/10 bg-[#0A0A0A]/90 backdrop-blur-2xl group hover:border-[#FF6600]/30 shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
                style={{ transition: `all 300ms ${EASING}` }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono font-bold text-white/40 uppercase tracking-[0.12em]">{stat.label}</span>
                  {stat.icon}
                </div>
                <div className={`font-mono text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                <div className="text-[10px] font-mono text-white/30 mt-1">{stat.sub}</div>
              </div>
            ))}
          </section>
        )}

        {/* Search Bar */}
        {!loading && scans.length > 0 && (
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by address…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-11 pl-11 pr-4 rounded-2xl bg-white/[0.04] border border-white/10 text-[13px] text-white placeholder:text-white/20 focus:outline-none focus:border-[#FF6600]/50 focus:ring-2 focus:ring-[#FF6600]/10"
              style={{ transition: `all 200ms ${EASING}` }}
            />
          </div>
        )}

        {/* Loading State — skeleton */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-28 gap-4 bg-[#0A0A0A]/60 border border-white/10 backdrop-blur-2xl rounded-3xl">
            <div className="w-10 h-10 rounded-full border-2 border-t-transparent border-[#FF6600] animate-spin" />
            <span className="text-xs font-mono text-white/40 uppercase tracking-widest">Loading scan history…</span>
          </div>

        ) : scans.length === 0 ? (
          /* Empty State */
          <div
            className="p-12 text-center rounded-3xl border border-white/10 bg-[#0A0A0A]/90 backdrop-blur-2xl max-w-md mx-auto space-y-7 shadow-2xl"
          >
            <div className="w-16 h-16 rounded-2xl bg-[#FF6600]/10 border border-[#FF6600]/20 flex items-center justify-center mx-auto">
              <HardDrive className="w-7 h-7 text-[#FF6600]" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white" style={{ fontFamily: "'Calistoga', serif", fontWeight: 400 }}>No scans stored yet</h3>
              <p className="text-xs text-white/40 leading-relaxed">
                You haven't run any rooftop solar analyses under this account. Run your first scan to get started.
              </p>
            </div>
            <button
              onClick={() => navigate("/map")}
              className="h-11 px-8 rounded-xl font-bold text-xs text-black flex items-center gap-2 mx-auto transition-all duration-200 active:scale-[0.98] cursor-pointer border-none"
              style={{
                background: "linear-gradient(135deg,#FF6600 0%,#FF8C38 100%)",
                boxShadow: "0 0 24px rgba(255,102,0,0.25)",
              }}
            >
              <Zap className="w-4 h-4 fill-current" /> Launch Roof Analysis
            </button>
          </div>

        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-white/40 text-sm font-mono">
            No scans matched "<span className="text-white/60">{searchQuery}</span>"
          </div>

        ) : (
          /* Scan Cards Grid — bento layout, stagger animation */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map((scan) => (
              <div
                key={scan.id}
                className="scan-card group relative p-6 rounded-3xl border border-white/10 bg-[#0A0A0A]/90 backdrop-blur-2xl flex flex-col justify-between gap-6 shadow-2xl overflow-hidden hover:border-[#FF6600]/40"
                style={{ transition: `all 300ms ${EASING}` }}
              >
                {/* Orange top-line accent on hover */}
                <div
                  className="absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 rounded-t-3xl pointer-events-none"
                  style={{
                    background: "linear-gradient(90deg,transparent,rgba(255,102,0,0.5),transparent)",
                    transition: `opacity 300ms ${EASING}`,
                  }}
                  aria-hidden="true"
                />

                <div className="space-y-4">
                  {/* Header row: date + status badge */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 text-[10px] text-white/40 font-mono">
                      <Calendar className="w-3.5 h-3.5 text-[#FF6600]" />
                      {format(new Date(scan.created_at), "PPP")}
                    </div>
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider font-mono ${
                      scan.is_full_unlocked
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    }`}>
                      {scan.is_full_unlocked ? "Full Report" : "Preview"}
                    </span>
                  </div>

                  {/* Address + Coordinates */}
                  <div>
                    <h3 className="font-semibold text-white text-sm leading-snug group-hover:text-[#FF6600] transition-colors line-clamp-2" style={{ transition: `color 200ms ${EASING}` }}>
                      {scan.address || "Rooftop Coordinates Scan"}
                    </h3>
                    <div className="flex items-center gap-1.5 text-[10px] text-white/40 font-mono mt-1.5">
                      <MapPin className="w-3 h-3 text-[#FF6600] shrink-0" />
                      <span>{scan.latitude.toFixed(4)}°, {scan.longitude.toFixed(4)}°</span>
                    </div>
                  </div>

                  {/* Stats mini-bento */}
                  {scan.solar_reports && (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="p-2.5 rounded-2xl border border-white/[0.06] bg-white/[0.02] text-center">
                        <div className="text-[9px] text-white/30 font-mono uppercase tracking-wider mb-1">Size</div>
                        <div className="text-xs font-bold text-[#FF6600] font-mono">{scan.solar_reports.system_size_kwp}kWp</div>
                      </div>
                      <div className="p-2.5 rounded-2xl border border-white/[0.06] bg-white/[0.02] text-center">
                        <div className="text-[9px] text-white/30 font-mono uppercase tracking-wider mb-1">Panels</div>
                        <div className="text-xs font-bold text-white font-mono">{scan.solar_reports.panel_count}</div>
                      </div>
                      <div className="p-2.5 rounded-2xl border border-white/[0.06] bg-white/[0.02] text-center">
                        <div className="text-[9px] text-white/30 font-mono uppercase tracking-wider mb-1">Area</div>
                        <div className="text-xs font-bold text-white font-mono">{scan.solar_reports.total_roof_area_sqm}m²</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* CTA — transitions to orange on card hover */}
                <button
                  onClick={() => handleOpenScan(scan)}
                  className="w-full h-11 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer border border-white/10 text-white/60 bg-white/5 group-hover:bg-[#FF6600] group-hover:text-black group-hover:border-transparent group-hover:shadow-lg group-hover:shadow-[#FF6600]/20"
                  style={{ transition: `all 250ms ${EASING}` }}
                >
                  Open Analysis Studio <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
