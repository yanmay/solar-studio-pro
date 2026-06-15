import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
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
import { AnimatedThemeToggleButton } from "@/components/ui/animated-theme-toggle-button";

// ─── Color tokens from DESIGN.md ─────────────────────────────
const C = {
  background:           "#171210",
  charcoal:             "#1F1B18",
  surfaceVariant:       "#393431",
  surfaceContainerHigh: "#2e2927",
  primary:              "#ffb87b",
  primaryContainer:     "#ff8f00",
  secondary:            "#41e1b4",
  onSurface:            "#eae0dd",
  onSurfaceVariant:     "#dcc1ae",
  mutedSand:            "#AD9F92",
  outline:              "#a48c7a",
  outlineVariant:       "#564334",
  error:                "#ffb4ab",
  onPrimary:            "#4c2700",
  onSecondary:          "#00382a",
};

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
      <div className="min-h-screen flex items-center justify-center text-white font-mono" style={{ background: C.background }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-2 border-t-transparent animate-spin rounded-full" style={{ borderColor: `${C.primary} transparent transparent transparent` }}></div>
          <span className="text-xs uppercase tracking-widest" style={{ color: C.mutedSand }}>Fetching Policy Databases...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white font-mono" style={{ background: C.background }}>
        <div className="text-center space-y-4">
          <p className="text-red-400">Error: {error}</p>
          <button onClick={() => window.location.reload()} className="px-4 py-2 border rounded hover:bg-white/10" style={{ borderColor: C.outlineVariant }}>Retry</button>
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
    <div className="min-h-screen text-[#eae0dd] font-sans antialiased overflow-x-hidden" style={{ background: C.background }}>
      <style>{`
        .font-mono-numbers { font-variant-numeric: tabular-nums; }
        .glow-card {
          box-shadow: 0 0 30px -15px rgba(65, 225, 180, 0.05);
        }
      `}</style>

      {/* ── Header ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[#171210]/80" style={{ borderBottom: `1px solid ${C.outlineVariant}` }}>
        <div className="flex justify-between items-center px-4 md:px-16 py-3 mx-auto max-w-[1280px]">
          <div style={{ fontFamily: "Sora, sans-serif", color: C.mutedSand, fontSize: "20px", fontWeight: 500, letterSpacing: "-0.01em" }} className="flex items-center gap-2">
            <span className="text-white">SUNPOWER</span>
            <span className="font-serif italic font-light text-[#ffb87b]">LINK</span>
          </div>
          <nav className="hidden md:flex gap-6">
            <a style={{ color: C.mutedSand }} className="text-[10px] font-bold uppercase tracking-wider font-mono hover:text-white transition-colors cursor-pointer" onClick={() => navigate("/")}>Home</a>
            <a style={{ color: C.mutedSand }} className="text-[10px] font-bold uppercase tracking-wider font-mono hover:text-white transition-colors cursor-pointer" onClick={() => navigate("/market-insights")}>Market Insights</a>
            <a style={{ color: C.primary }} className="text-[10px] font-bold uppercase tracking-wider font-mono cursor-pointer" onClick={() => navigate("/policy-tracker")}>Policy Tracker</a>
          </nav>
          <div className="flex items-center gap-2 md:gap-3">
            <AnimatedThemeToggleButton type="vertical" />
            <button onClick={() => navigate("/map")}
              style={{ background: C.charcoal, border: `1px solid ${C.outlineVariant}`, color: C.onSurface }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider hover:opacity-80 transition-opacity">
              <ArrowLeft className="w-3 h-3" /> Back
            </button>
            <button onClick={() => navigate("/map")}
              style={{ background: C.primaryContainer, color: C.background }}
              className="hidden md:flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-extrabold uppercase tracking-wider rounded-full hover:bg-orange-500 transition-colors">
              Launch Analyzer <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Layout ─────────────────────────────────────── */}
      <main className="max-w-[1280px] mx-auto px-4 md:px-16 py-8 flex flex-col gap-10">

        {/* ── Title & Intro ── */}
        <section className="flex flex-col gap-3 max-w-3xl">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.2em]" style={{ color: C.primary }}>
            <ShieldCheck className="w-4 h-4 text-[#ffb87b] animate-pulse" /> Regulatory & Incentive Registry
          </div>
          <h1 className="text-3xl md:text-5xl font-semibold tracking-tight text-white font-display" style={{ fontFamily: "Sora, sans-serif" }}>
            State Solar Subsidies & <br className="hidden md:block" />
            <span className="text-[#ffb87b] italic font-serif font-light">Policy Tracker</span>
          </h1>
          <p className="text-sm md:text-base leading-relaxed" style={{ color: C.onSurfaceVariant }}>
            Track and compare state-level grid parameters, export tariffs, and application requirements under India's PM-Surya Ghar Muft Bijli Yojana rules.
          </p>
        </section>

        {/* ── National Policy Focus (PM Surya Ghar) ── */}
        <section className="p-6 rounded-2xl border flex flex-col md:flex-row gap-8 items-center" style={{ background: C.charcoal, borderColor: C.outlineVariant }}>
          <div className="flex-1 space-y-4">
            <div className="flex items-center gap-2">
              <span className="bg-[#41e1b4]/10 text-[#41e1b4] text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border border-[#41e1b4]/20">Active Policy</span>
              <h2 className="text-lg font-semibold text-white font-display" style={{ fontFamily: "Sora, sans-serif" }}>PM-Surya Ghar: Muft Bijli Yojana</h2>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: C.onSurfaceVariant }}>
              The central government's flagship scheme provides massive direct subsidies for residential rooftop solar installations. Subsidies are sent directly to the homeowner’s linked bank account within 30 days of DISCOM commissioning.
            </p>
            <div className="space-y-2.5">
              {[
                { cap: "Up to 1 kW capacity", sub: "₹30,000 direct subsidy" },
                { cap: "Up to 2 kW capacity", sub: "₹60,000 direct subsidy" },
                { cap: "3 kW capacity or more", sub: "₹78,000 maximum capping" },
              ].map((tier, idx) => (
                <div key={idx} className="flex justify-between items-center bg-[#171210] p-2.5 px-4 rounded-xl border border-white/5 text-xs">
                  <span className="font-semibold text-white/95">{tier.cap}</span>
                  <span className="font-mono text-[#41e1b4] font-bold">{tier.sub}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="w-full md:w-[350px] p-6 rounded-xl bg-[#171210] border border-white/5 space-y-4 shrink-0">
            <div className="flex items-center gap-2 text-[#ffb87b] text-xs font-mono">
              <Info className="w-4 h-4" /> Eligibility Checklist
            </div>
            <ul className="space-y-3 text-[11px] list-none p-0 text-neutral-400">
              <li className="flex gap-2"><CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" /> Must be a residential electricity consumer</li>
              <li className="flex gap-2"><CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" /> Usable rooftop surface area with minimal shadow</li>
              <li className="flex gap-2"><CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" /> Valid Sanctioned Load with state DISCOM</li>
              <li className="flex gap-2"><CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" /> Certified solar panel & inverter equipment</li>
            </ul>
            <a 
              href="https://pmsuryaghar.gov.in" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-neutral-800 text-white hover:bg-neutral-700 font-bold font-mono text-[10px] uppercase tracking-wider rounded-lg border border-white/8 transition-colors"
            >
              Official National Portal <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </section>

        {/* ── Search & Filter Controls ── */}
        <section className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input
              type="text"
              placeholder="Search state, DISCOM, or regulations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#1F1B18] text-white pl-10 pr-4 py-2.5 text-xs rounded-xl focus:outline-none focus:border-[#ff8f00] border transition-colors"
              style={{ borderColor: C.outlineVariant }}
            />
          </div>

          <div className="flex gap-2 shrink-0">
            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 flex items-center mr-2">Sort by</span>
            {[
              { id: "name", label: "State Alphabetical" },
              { id: "ease", label: "Grid Connection Ease" },
              { id: "tariff", label: "Highest Export Tariff" },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setSortBy(opt.id as any)}
                className="px-3.5 py-1.5 rounded-full border text-[10px] font-mono tracking-wider transition-colors"
                style={{
                  background: sortBy === opt.id ? C.primaryContainer : C.charcoal,
                  color: sortBy === opt.id ? C.background : C.onSurface,
                  borderColor: sortBy === opt.id ? C.primaryContainer : C.outlineVariant,
                  fontWeight: sortBy === opt.id ? 700 : 500
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        {/* ── State Policy Cards ── */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStates.map((s, idx) => (
            <div key={idx} className="p-6 rounded-2xl border flex flex-col justify-between gap-5 transition-transform hover:scale-[1.01] glow-card" style={{ background: C.charcoal, borderColor: C.outlineVariant }}>
              <div className="space-y-3.5">
                <div className="flex justify-between items-center border-b border-white/5 pb-3">
                  <div>
                    <h3 className="text-base font-semibold text-white font-display" style={{ fontFamily: "Sora, sans-serif" }}>{s.state}</h3>
                    <span className="text-[9px] font-mono" style={{ color: C.mutedSand }}>DISCOMS: {s.discoms.slice(0, 3).join(", ")}{s.discoms.length > 3 ? "..." : ""}</span>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <span className="text-[14px] font-bold text-white font-mono-numbers">{s.easeScore}</span>
                    <span className="text-[8px] font-mono uppercase tracking-wider text-neutral-400">Ease Score</span>
                  </div>
                </div>

                <p className="text-[11px] leading-relaxed text-neutral-300 line-clamp-3">
                  {s.policySummary}
                </p>

                <div className="grid grid-cols-2 gap-3.5 pt-2">
                  <div className="bg-[#171210] p-2 rounded-lg border border-white/5">
                    <span className="text-[8px] font-mono uppercase tracking-wider text-neutral-400 block mb-0.5">Net Metering Limit</span>
                    <span className="text-xs text-white font-semibold font-mono-numbers">{s.netMeteringLimitKw} kW</span>
                  </div>
                  <div className="bg-[#171210] p-2 rounded-lg border border-white/5">
                    <span className="text-[8px] font-mono uppercase tracking-wider text-neutral-400 block mb-0.5">DISCOM export rate</span>
                    <span className="text-xs text-[#ffb87b] font-bold font-mono-numbers">{s.exportTariff} <span className="text-[9px] text-neutral-500 font-light">/ kWh</span></span>
                  </div>
                </div>

                <div className="space-y-1 pt-1">
                  <span className="text-[9px] font-mono uppercase tracking-wider text-neutral-400 block">State-specific Subsidies</span>
                  <p className="text-[10px] text-emerald-400 leading-relaxed font-mono font-medium">{s.stateSubsidy}</p>
                </div>
              </div>

              <div className="flex justify-between items-center border-t border-white/5 pt-4 text-[10px] font-mono">
                <span className="text-neutral-400">Timeline: <strong className="text-white font-semibold font-mono-numbers">{s.processingTime}</strong></span>
                <a
                  href={s.officialPortal}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[#ffb87b] hover:text-white transition-colors"
                >
                  DISCOM Portal <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ))}

          {filteredStates.length === 0 && (
            <div className="col-span-full py-12 text-center text-neutral-500 font-mono text-xs">
              No state policies matching your filter parameters.
            </div>
          )}
        </section>

        {/* ── State Comparison Interface ── */}
        <section className="p-6 rounded-2xl border space-y-6" style={{ background: C.charcoal, borderColor: C.outlineVariant }}>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-base font-semibold text-white font-display" style={{ fontFamily: "Sora, sans-serif" }}>Compare Regional Solar Policies</h2>
              <p className="text-xs" style={{ color: C.mutedSand }}>Side-by-side analysis of metering policies, export payouts, and approval schedules.</p>
            </div>
            
            <div className="flex items-center gap-2">
              <select
                value={compareA}
                onChange={(e) => setCompareA(e.target.value)}
                className="p-2.5 bg-[#171210] border rounded-lg text-xs text-white focus:outline-none focus:border-[#ff8f00]"
                style={{ borderColor: C.outlineVariant }}
              >
                {states.map((s) => (
                  <option key={s.state} value={s.state}>{s.state}</option>
                ))}
              </select>
              <span className="text-xs text-neutral-600 font-mono">VS</span>
              <select
                value={compareB}
                onChange={(e) => setCompareB(e.target.value)}
                className="p-2.5 bg-[#171210] border rounded-lg text-xs text-white focus:outline-none focus:border-[#ff8f00]"
                style={{ borderColor: C.outlineVariant }}
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
                <tr className="border-b" style={{ borderColor: C.outlineVariant }}>
                  <th className="py-3 px-4 font-mono uppercase text-[10px] tracking-wider text-neutral-400">Parameter</th>
                  <th className="py-3 px-4 font-display font-semibold text-white text-sm" style={{ width: "40%" }}>{stateA.state}</th>
                  <th className="py-3 px-4 font-display font-semibold text-white text-sm" style={{ width: "40%" }}>{stateB.state}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <tr>
                  <td className="py-3 px-4 font-semibold text-neutral-300">Ease of Grid Connection</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold font-mono-numbers">{stateA.easeScore} / 100</span>
                      <div className="w-24 h-1.5 bg-[#171210] rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${stateA.easeScore}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold font-mono-numbers">{stateB.easeScore} / 100</span>
                      <div className="w-24 h-1.5 bg-[#171210] rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${stateB.easeScore}%` }} />
                      </div>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold text-neutral-300">Net Metering Capacity Cap</td>
                  <td className="py-3 px-4 font-mono-numbers text-white font-medium">{stateA.netMeteringLimitKw} kW limit</td>
                  <td className="py-3 px-4 font-mono-numbers text-white font-medium">{stateB.netMeteringLimitKw} kW limit</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold text-neutral-300">Export Feed-in Tariff</td>
                  <td className="py-3 px-4 font-mono text-[#ffb87b] font-bold">{stateA.exportTariff} / kWh</td>
                  <td className="py-3 px-4 font-mono text-[#ffb87b] font-bold">{stateB.exportTariff} / kWh</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold text-neutral-300">Approval Processing Timeline</td>
                  <td className="py-3 px-4 font-mono-numbers text-white">{stateA.processingTime} typical</td>
                  <td className="py-3 px-4 font-mono-numbers text-white">{stateB.processingTime} typical</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold text-neutral-300">State subsidy options</td>
                  <td className="py-3 px-4 text-emerald-400 leading-relaxed font-mono font-medium">{stateA.stateSubsidy}</td>
                  <td className="py-3 px-4 text-emerald-400 leading-relaxed font-mono font-medium">{stateB.stateSubsidy}</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold text-neutral-300">DISCOM Networks</td>
                  <td className="py-3 px-4 text-neutral-400 leading-normal">{stateA.discoms.join(", ")}</td>
                  <td className="py-3 px-4 text-neutral-400 leading-normal">{stateB.discoms.join(", ")}</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold text-neutral-300">Digital Portal</td>
                  <td className="py-3 px-4">
                    <a
                      href={stateA.officialPortal}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[#ffb87b] hover:text-white transition-colors"
                    >
                      Apply online <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </td>
                  <td className="py-3 px-4">
                    <a
                      href={stateB.officialPortal}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[#ffb87b] hover:text-white transition-colors"
                    >
                      Apply online <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

      </main>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="mt-20 py-8 text-center border-t text-xs font-mono" style={{ borderColor: C.outlineVariant, color: C.mutedSand }}>
        <div className="max-w-[1280px] mx-auto px-4 md:px-16 flex flex-col md:flex-row justify-between items-center gap-4">
          <span>© {new Date().getFullYear()} SUNPOWER LINK. Rooftop solar analysis for India. All Rights Reserved.</span>
          <div className="flex gap-4">
            <button onClick={() => navigate("/privacy")} className="hover:text-white transition-colors bg-transparent border-none cursor-pointer">Privacy Policy</button>
            <button onClick={() => navigate("/market-insights")} className="hover:text-white transition-colors bg-transparent border-none cursor-pointer">Market Insights</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
