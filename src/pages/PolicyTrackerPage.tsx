import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  Search,
  CheckCircle2,
  AlertTriangle,
  IndianRupee,
  Activity,
  Globe,
  ExternalLink,
  Info,
} from "lucide-react";
import { SiteNavbar } from "@/components/ui/site-navbar";

interface StatePolicy {
  state: string;
  netMeteringLimitKw: number | string;
  grossMeteringThresholdKw: number | string;
  nationalSubsidy: string;
  stateSubsidy: string;
  exportTariff: string;
  processingTime: string;
  discoms: string[];
  policySummary: string;
  easeScore: number;
  officialPortal: string;
}

export default function PolicyTrackerPage() {
  const navigate = useNavigate();
  const [states, setStates] = useState<StatePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "ease" | "tariff">("name");

  // Comparison State
  const [compareA, setCompareA] = useState("Gujarat");
  const [compareB, setCompareB] = useState("Maharashtra");

  useEffect(() => {
    document.title = "Policy Tracker — SUNPOWER LINK";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute(
        "content",
        "Track net metering regulations, PM-Surya Ghar subsidies, DISCOM feed-in rates, and grid approval timelines across all major Indian states."
      );
    }

    async function fetchPolicies() {
      try {
        const res = await fetch("/api/policy-tracker");
        if (!res.ok) throw new Error("Failed to fetch state policies");
        const json = await res.json();
        setStates(json.states || []);
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Failed to load state policies database");
      } finally {
        setLoading(false);
      }
    }
    fetchPolicies();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center text-white font-mono">
        <div className="flex flex-col items-center gap-4 bg-[#0A0A0A]/80 border border-white/10 p-10 rounded-3xl backdrop-blur-2xl">
          <div className="w-10 h-10 border-2 border-t-transparent border-[#FF6600] animate-spin rounded-full"></div>
          <span className="text-xs uppercase tracking-widest text-white/50">Fetching Policy Databases...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center text-white font-mono">
        <div className="text-center space-y-4 bg-[#0A0A0A]/80 border border-white/10 p-10 rounded-3xl backdrop-blur-2xl">
          <p className="text-red-400 text-sm">Error: {error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2 text-xs font-bold bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Filtered and Sorted States
  const filteredStates = states
    .filter((s) => {
      const query = searchQuery.toLowerCase();
      return (
        s.state.toLowerCase().includes(query) ||
        s.policySummary.toLowerCase().includes(query) ||
        s.discoms.some((d) => d.toLowerCase().includes(query))
      );
    })
    .sort((a, b) => {
      if (sortBy === "ease") {
        return b.easeScore - a.easeScore;
      }
      if (sortBy === "tariff") {
        const valA = parseFloat(a.exportTariff.replace("₹", "")) || 0;
        const valB = parseFloat(b.exportTariff.replace("₹", "")) || 0;
        return valB - valA;
      }
      return a.state.localeCompare(b.state);
    });

  const stateA = states.find((s) => s.state === compareA) || states[0];
  const stateB = states.find((s) => s.state === compareB) || states[1] || states[0];

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans antialiased overflow-x-hidden relative selection:bg-[#FF6600]/30 selection:text-white">
      {/* Background Glow Blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute top-[-15%] right-[-5%] w-[600px] h-[600px] rounded-full bg-[#FF6600]/5 blur-[140px]" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full bg-emerald-500/3 blur-[140px]" />
      </div>

      {/* Shared dark-glass top navigation */}
      <SiteNavbar />

      {/* Main Layout */}
      <main className="max-w-[1280px] mx-auto px-4 md:px-12 py-10 flex flex-col gap-10 relative z-10">

        {/* Title & Intro */}
        <section className="flex flex-col gap-3 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-[#FF6600] text-[10px] font-mono font-bold uppercase tracking-[0.12em] w-fit">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Regulatory & Incentive Registry</span>
          </div>
          <h1
            className="text-3xl md:text-5xl text-white leading-tight"
            style={{ fontFamily: "'Calistoga', serif", fontWeight: 400 }}
          >
            State Solar Subsidies & <br className="hidden md:block" />
            <span className="text-[#FF6600]">Policy Tracker</span>
          </h1>
          <p className="text-sm md:text-base leading-relaxed text-white/50 font-light">
            Track and compare state-level grid parameters, export tariffs, and application requirements under India's PM-Surya Ghar Muft Bijli Yojana framework.
          </p>
        </section>

        {/* National Policy Focus (PM Surya Ghar) */}
        <section className="p-6 sm:p-8 rounded-3xl border border-white/10 bg-[#0A0A0A]/90 backdrop-blur-2xl flex flex-col md:flex-row gap-8 items-center shadow-2xl">
          <div className="flex-1 space-y-4">
            <div className="flex items-center gap-2">
              <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg border border-emerald-500/20 uppercase tracking-wider">National Flagship Scheme</span>
              <h2 className="text-lg font-bold text-white">PM-Surya Ghar: Muft Bijli Yojana</h2>
            </div>
            <p className="text-xs leading-relaxed text-white/50 font-light">
              Direct central government subsidies for residential rooftop solar installations. Financial assistance is credited directly to the homeowner’s linked bank account within 30 days of DISCOM commissioning.
            </p>
            <div className="space-y-2.5">
              {[
                { cap: "Up to 1 kW capacity", sub: "₹30,000 direct subsidy" },
                { cap: "Up to 2 kW capacity", sub: "₹60,000 direct subsidy" },
                { cap: "3 kW capacity or more", sub: "₹78,000 maximum capping" },
              ].map((tier, idx) => (
                <div key={idx} className="flex justify-between items-center bg-white/[0.02] p-3 px-4 rounded-xl border border-white/5 text-xs font-mono">
                  <span className="font-semibold text-white">{tier.cap}</span>
                  <span className="font-bold text-emerald-400">{tier.sub}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="w-full md:w-[350px] p-6 rounded-2xl bg-white/[0.02] border border-white/10 space-y-4 shrink-0">
            <div className="flex items-center gap-2 text-[#FF6600] text-xs font-mono font-bold">
              <Info className="w-4 h-4" /> Eligibility Requirements
            </div>
            <ul className="space-y-3 text-xs list-none p-0 text-white/60">
              <li className="flex gap-2.5 items-start"><CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" /> Registered residential electricity connection</li>
              <li className="flex gap-2.5 items-start"><CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" /> Unshaded, accessible rooftop surface</li>
              <li className="flex gap-2.5 items-start"><CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" /> Sanctioned Load approval from state DISCOM</li>
              <li className="flex gap-2.5 items-start"><CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" /> DCR-compliant solar PV modules & inverter</li>
            </ul>
            <a 
              href="https://pmsuryaghar.gov.in" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 text-white font-bold font-mono text-xs uppercase tracking-wider rounded-xl border border-white/10 transition-all cursor-pointer"
            >
              National Portal <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </section>

        {/* Search & Filter Controls */}
        <section className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              placeholder="Search state, DISCOM, or regulations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0A0A0A] text-white pl-11 pr-4 py-3 text-xs rounded-xl focus:outline-none focus:border-[#FF6600]/60 focus:ring-2 focus:ring-[#FF6600]/20 border border-white/10 transition-all"
            />
          </div>

          <div className="flex gap-2 shrink-0 items-center">
            <span className="text-[10px] font-mono uppercase tracking-wider text-white/40 mr-1">Sort by</span>
            {[
              { id: "name", label: "Alphabetical" },
              { id: "ease", label: "Ease Score" },
              { id: "tariff", label: "Export Tariff" },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setSortBy(opt.id as any)}
                className={`px-3.5 py-1.5 rounded-xl border text-xs font-mono transition-all cursor-pointer ${
                  sortBy === opt.id
                    ? "bg-[#FF6600] text-black border-transparent font-bold"
                    : "bg-white/5 text-white/60 border-white/10 hover:text-white"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        {/* State Policy Cards */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStates.map((s, idx) => (
            <div
              key={idx}
              className="p-6 rounded-3xl border border-white/10 bg-[#0A0A0A]/90 backdrop-blur-2xl flex flex-col justify-between gap-5 hover:border-[#FF6600]/40 hover:scale-[1.01] transition-all duration-200 shadow-2xl"
            >
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-white/5 pb-3">
                  <div>
                    <h3 className="text-lg font-bold text-white">{s.state}</h3>
                    <span className="text-[10px] font-mono text-white/40">DISCOMs: {s.discoms.slice(0, 3).join(", ")}{s.discoms.length > 3 ? "..." : ""}</span>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <span className="text-base font-bold text-white font-mono">{s.easeScore}</span>
                    <span className="text-[9px] font-mono uppercase tracking-wider text-[#FF6600]">Ease Score</span>
                  </div>
                </div>

                <p className="text-xs leading-relaxed text-white/60 line-clamp-3">
                  {s.policySummary}
                </p>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="bg-white/[0.02] p-3 rounded-2xl border border-white/5">
                    <span className="text-[9px] font-mono uppercase tracking-wider text-white/40 block mb-0.5">Net Metering Cap</span>
                    <span className="text-xs text-white font-bold font-mono">{s.netMeteringLimitKw} kW</span>
                  </div>
                  <div className="bg-white/[0.02] p-3 rounded-2xl border border-white/5">
                    <span className="text-[9px] font-mono uppercase tracking-wider text-white/40 block mb-0.5">Export Rate</span>
                    <span className="text-xs text-[#FF6600] font-bold font-mono">{s.exportTariff} <span className="text-[9px] text-white/30 font-normal">/ kWh</span></span>
                  </div>
                </div>

                <div className="space-y-1 pt-1">
                  <span className="text-[9px] font-mono uppercase tracking-wider text-white/40 block">State Boosters</span>
                  <p className="text-xs text-emerald-400 font-mono font-medium">{s.stateSubsidy}</p>
                </div>
              </div>

              <div className="flex justify-between items-center border-t border-white/5 pt-4 text-xs font-mono">
                <span className="text-white/40">Timeline: <strong className="text-white font-semibold">{s.processingTime}</strong></span>
                <a
                  href={s.officialPortal}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[#FF6600] hover:underline font-bold"
                >
                  DISCOM Portal <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ))}

          {filteredStates.length === 0 && (
            <div className="col-span-full py-16 text-center text-white/40 font-mono text-xs bg-[#0A0A0A]/60 border border-white/10 rounded-3xl">
              No state policies matching search criteria.
            </div>
          )}
        </section>

        {/* State Comparison Interface */}
        <section className="p-6 sm:p-8 rounded-3xl border border-white/10 bg-[#0A0A0A]/90 backdrop-blur-2xl space-y-6 shadow-2xl">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-lg font-bold text-white">Compare Regional Solar Policies</h2>
              <p className="text-xs text-white/40 font-mono">Side-by-side analysis of metering rules, feed-in rates, and approval timelines.</p>
            </div>
            
            <div className="flex items-center gap-3">
              <select
                value={compareA}
                onChange={(e) => setCompareA(e.target.value)}
                className="p-2.5 bg-[#050505] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-[#FF6600]/60 cursor-pointer"
              >
                {states.map((s) => (
                  <option key={s.state} value={s.state}>{s.state}</option>
                ))}
              </select>
              <span className="text-xs text-white/30 font-mono font-bold">VS</span>
              <select
                value={compareB}
                onChange={(e) => setCompareB(e.target.value)}
                className="p-2.5 bg-[#050505] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-[#FF6600]/60 cursor-pointer"
              >
                {states.map((s) => (
                  <option key={s.state} value={s.state} disabled={s.state === compareA}>{s.state}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-white/40 font-mono">
                  <th className="py-3 px-4 uppercase text-[10px] tracking-wider">Parameter</th>
                  <th className="py-3 px-4 font-bold text-white text-sm" style={{ width: "40%" }}>{stateA.state}</th>
                  <th className="py-3 px-4 font-bold text-white text-sm" style={{ width: "40%" }}>{stateB.state}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <tr>
                  <td className="py-3.5 px-4 font-semibold text-white/80">Grid Connection Ease</td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-white">{stateA.easeScore} / 100</span>
                      <div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${stateA.easeScore}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-white">{stateB.easeScore} / 100</span>
                      <div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${stateB.easeScore}%` }} />
                      </div>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold text-white/80">Net Metering Capacity Cap</td>
                  <td className="py-3.5 px-4 font-mono text-white">{stateA.netMeteringLimitKw} kW limit</td>
                  <td className="py-3.5 px-4 font-mono text-white">{stateB.netMeteringLimitKw} kW limit</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold text-white/80">Export Feed-in Tariff</td>
                  <td className="py-3.5 px-4 font-mono text-[#FF6600] font-bold">{stateA.exportTariff} / kWh</td>
                  <td className="py-3.5 px-4 font-mono text-[#FF6600] font-bold">{stateB.exportTariff} / kWh</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold text-white/80">Approval Timeline</td>
                  <td className="py-3.5 px-4 font-mono text-white">{stateA.processingTime} typical</td>
                  <td className="py-3.5 px-4 font-mono text-white">{stateB.processingTime} typical</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold text-white/80">State Subsidy Boosters</td>
                  <td className="py-3.5 px-4 text-emerald-400 font-mono font-medium">{stateA.stateSubsidy}</td>
                  <td className="py-3.5 px-4 text-emerald-400 font-mono font-medium">{stateB.stateSubsidy}</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold text-white/80">DISCOM Networks</td>
                  <td className="py-3.5 px-4 text-white/50">{stateA.discoms.join(", ")}</td>
                  <td className="py-3.5 px-4 text-white/50">{stateB.discoms.join(", ")}</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold text-white/80">DISCOM Portal</td>
                  <td className="py-3.5 px-4">
                    <a
                      href={stateA.officialPortal}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[#FF6600] hover:underline font-bold font-mono"
                    >
                      Apply Online <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </td>
                  <td className="py-3.5 px-4">
                    <a
                      href={stateB.officialPortal}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[#FF6600] hover:underline font-bold font-mono"
                    >
                      Apply Online <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="mt-20 py-8 text-center border-t border-white/10 text-xs font-mono text-white/40 bg-[#050505]">
        <div className="max-w-[1280px] mx-auto px-4 md:px-12 flex flex-col md:flex-row justify-between items-center gap-4">
          <span>© {new Date().getFullYear()} SUNPOWER LINK. Rooftop solar analysis for India. All Rights Reserved.</span>
          <div className="flex gap-6">
            <button onClick={() => navigate("/privacy")} className="hover:text-white transition-colors bg-transparent border-none cursor-pointer">Privacy Policy</button>
            <button onClick={() => navigate("/market-insights")} className="hover:text-white transition-colors bg-transparent border-none cursor-pointer">Market Insights</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
