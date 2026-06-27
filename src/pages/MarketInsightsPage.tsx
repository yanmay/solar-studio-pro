import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp,
  ArrowLeft,
  ArrowRight,
  TrendingDown,
  Percent,
  Layers,
  MapPin,
  IndianRupee,
  Calendar,
  Sparkles,
  Info,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
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

interface MarketData {
  nationalStats: {
    cumulativeCapacityGw: number;
    avgCostPerKw: number;
    avgPaybackYears: number;
    yoyGrowthPct: number;
  };
  yearlyGrowth: Array<{ year: number; capacityGw: number; installations: number }>;
  stateRankings: Array<{ state: string; capacityMw: number; projectsCount: number; avgYield: number }>;
  sectorSplit: Array<{ name: string; percentage: number; capacityMw: number }>;
  costTrends: Array<{ size: string; pricePerKwMin: number; pricePerKwMax: number }>;
}

export default function MarketInsightsPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Calculator State
  const [calcState, setCalcState] = useState("Gujarat");
  const [calcCapacity, setCalcCapacity] = useState(3); // kW

  useEffect(() => {
    document.title = "Market Insights — SUNPOWER LINK";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute(
        "content",
        "Explore rooftop solar market capacity trends, YoY growth rates, cost trajectories, and leading states in India's booming residential and C&I solar sectors."
      );
    }

    async function fetchInsights() {
      try {
        const res = await fetch("/api/market-insights");
        if (!res.ok) throw new Error("Failed to fetch market insights data");
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Something went wrong fetching data");
      } finally {
        setLoading(false);
      }
    }
    fetchInsights();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white font-mono" style={{ background: C.background }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-2 border-t-transparent animate-spin rounded-full" style={{ borderColor: `${C.primary} transparent transparent transparent` }}></div>
          <span className="text-xs uppercase tracking-widest" style={{ color: C.mutedSand }}>Analyzing India's Solar Market...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white font-mono" style={{ background: C.background }}>
        <div className="text-center space-y-4">
          <p className="text-red-400">Error: {error || "No data received"}</p>
          <button onClick={() => window.location.reload()} className="px-4 py-2 border rounded hover:bg-white/10" style={{ borderColor: C.outlineVariant }}>Retry</button>
        </div>
      </div>
    );
  }

  // Cost & Savings Calculations for Estimator
  const getSubsidies = (capacity: number, state: string) => {
    // 1. Central Subsidy (PM Surya Ghar)
    // 1 kW = 30,000; 2 kW = 60,000; >= 3 kW = 78,000
    let central = 0;
    if (capacity <= 1) {
      central = 30000 * capacity;
    } else if (capacity <= 2) {
      central = 60000;
    } else {
      central = 78000;
    }

    // 2. State Subsidy Booster
    let stateBoost = 0;
    if (state === "Gujarat") {
      stateBoost = capacity <= 3 ? 20000 : 0;
    } else if (state === "Uttar Pradesh") {
      stateBoost = Math.min(30000, 15000 * capacity);
    } else if (state === "Delhi") {
      stateBoost = 10000; // Mock average Delhi GBI benefit upfront
    }

    return { central, stateBoost, total: central + stateBoost };
  };

  const calculateEstimate = () => {
    // Average base cost is ~₹50,000 per kW (slight scaling factor for smaller/larger systems)
    let baseRate = 52000;
    if (calcCapacity < 3) baseRate = 58000;
    else if (calcCapacity > 10) baseRate = 45000;

    const baseCost = baseRate * calcCapacity;
    const { central, stateBoost, total: subsidyTotal } = getSubsidies(calcCapacity, calcState);
    const netCost = Math.max(10000, baseCost - subsidyTotal);

    // Assume average 4.2 units/kW/day yield * 330 days = 1386 units/kW/year.
    const annualGeneration = Math.round(calcCapacity * 4.2 * 330);
    // Typical electricity slab cost in India (average tier + tax) = ₹8.20/kWh
    const annualSavings = Math.round(annualGeneration * 8.20);
    const paybackYears = Number((netCost / annualSavings).toFixed(1));

    return {
      baseCost,
      centralSubsidy: central,
      stateSubsidy: stateBoost,
      netCost,
      annualGeneration,
      annualSavings,
      paybackYears,
    };
  };

  const estimate = calculateEstimate();

  return (
    <div className="min-h-screen text-[#eae0dd] font-sans antialiased overflow-x-hidden" style={{ background: C.background }}>
      {/* ── CSS Animations Inline ─────────────────────────── */}
      <style>{`
        .font-mono-numbers { font-variant-numeric: tabular-nums; }
        .gradient-glow {
          box-shadow: 0 0 40px -10px rgba(255, 143, 0, 0.1);
        }
        .gradient-glow-mint {
          box-shadow: 0 0 40px -10px rgba(65, 225, 180, 0.1);
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
            <a style={{ color: C.primary }} className="text-[10px] font-bold uppercase tracking-wider font-mono cursor-pointer" onClick={() => navigate("/market-insights")}>Market Insights</a>
            <a style={{ color: C.mutedSand }} className="text-[10px] font-bold uppercase tracking-wider font-mono hover:text-white transition-colors cursor-pointer" onClick={() => navigate("/policy-tracker")}>Policy Tracker</a>
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

        {/* Mobile Page Switching Tabs */}
        <div className="md:hidden flex items-center justify-center py-2.5 px-4 border-t border-white/5 bg-black/10 gap-3 text-[10px] font-bold uppercase tracking-wider font-mono">
          <a
            onClick={() => navigate("/")}
            className="text-neutral-400 hover:text-white cursor-pointer px-2 py-1 transition-colors"
          >
            Home
          </a>
          <span className="text-white/10 select-none">•</span>
          <a
            onClick={() => navigate("/market-insights")}
            className="px-2 py-1 transition-colors cursor-pointer"
            style={{ color: C.primary }}
          >
            Market Insights
          </a>
          <span className="text-white/10 select-none">•</span>
          <a
            onClick={() => navigate("/policy-tracker")}
            className="text-neutral-400 hover:text-white cursor-pointer px-2 py-1 transition-colors"
          >
            Policy Tracker
          </a>
        </div>
      </header>

      {/* ── Main Layout ─────────────────────────────────────── */}
      <main className="max-w-[1280px] mx-auto px-4 md:px-16 py-8 flex flex-col gap-10">

        {/* ── Title & Intro ── */}
        <section className="flex flex-col gap-3 max-w-3xl">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.2em]" style={{ color: C.primary }}>
            <TrendingUp className="w-4 h-4 animate-pulse" /> National Solar Intelligence Dashboard
          </div>
          <h1 className="text-3xl md:text-5xl font-semibold tracking-tight text-white font-display" style={{ fontFamily: "Sora, sans-serif" }}>
            India’s Rooftop Solar <br className="hidden md:block" />
            <span className="text-[#ffb87b] italic font-serif font-light">Market Insights</span>
          </h1>
          <p className="text-sm md:text-base leading-relaxed" style={{ color: C.onSurfaceVariant }}>
            Real-time diagnostics of cost structures, installation curves, and state efficiency profiles. Driven by national data aggregation mapping India's solar potential.
          </p>
        </section>

        {/* ── Top-level Metrics ── */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "National Rooftop Capacity", value: `${data.nationalStats.cumulativeCapacityGw} GW`, sub: `+${data.nationalStats.yoyGrowthPct}% YoY Growth`, icon: Layers, accent: C.primary },
            { label: "Avg. Residential Payback", value: `${data.nationalStats.avgPaybackYears} Years`, sub: "Subsidized systems", icon: Calendar, accent: C.secondary },
            { label: "Avg. Cost / kW (Base)", value: `₹${data.nationalStats.avgCostPerKw.toLocaleString("en-IN")}`, sub: "Before central subsidies", icon: IndianRupee, accent: C.primary },
            { label: "Estimated Installations", value: "475,000+", sub: "Across all states", icon: MapPin, accent: C.secondary },
          ].map((m, idx) => (
            <div key={idx} className="p-5 rounded-2xl border" style={{ background: C.charcoal, borderColor: C.outlineVariant }}>
              <div className="flex justify-between items-start mb-4">
                <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: C.mutedSand }}>{m.label}</span>
                <m.icon className="w-4 h-4" style={{ color: m.accent }} />
              </div>
              <div className="text-2xl md:text-3xl font-semibold text-white tracking-tight mb-1" style={{ fontFamily: "Sora, sans-serif" }}>
                {m.value}
              </div>
              <div className="text-[10px] font-mono font-medium" style={{ color: m.accent === C.secondary ? C.secondary : C.onSurfaceVariant }}>
                {m.sub}
              </div>
            </div>
          ))}
        </section>

        <hr className="h-px border-none" style={{ background: C.outlineVariant }} />

        {/* ── Charts Grid ── */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Area Chart: Yearly Cumulative Capacity */}
          <div className="lg:col-span-8 p-6 rounded-2xl border flex flex-col gap-6" style={{ background: C.charcoal, borderColor: C.outlineVariant }}>
            <div>
              <h3 className="text-base font-semibold text-white mb-1 font-display" style={{ fontFamily: "Sora, sans-serif" }}>National Growth Trajectory</h3>
              <p className="text-xs" style={{ color: C.mutedSand }}>Cumulative installed rooftop solar capacity in Gigawatts (GW) (2018 - 2026 Projection)</p>
            </div>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.yearlyGrowth} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCapacity" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C.primaryContainer} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={C.primaryContainer} stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#26201C" vertical={false} />
                  <XAxis dataKey="year" stroke={C.mutedSand} fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke={C.mutedSand} fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}GW`} />
                  <ChartTooltip
                    contentStyle={{ background: C.charcoal, border: `1px solid ${C.outlineVariant}`, borderRadius: "8px", fontSize: "11px", fontFamily: "Inter, sans-serif" }}
                    labelStyle={{ color: C.onSurface, fontWeight: "bold" }}
                  />
                  <Area type="monotone" dataKey="capacityGw" stroke={C.primary} strokeWidth={2} fillOpacity={1} fill="url(#colorCapacity)" name="Installed Capacity" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Sector Share & Cost Breakdown */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            
            {/* Sector Split */}
            <div className="p-6 rounded-2xl border flex flex-col gap-4 flex-1" style={{ background: C.charcoal, borderColor: C.outlineVariant }}>
              <div>
                <h3 className="text-sm font-semibold text-white font-display" style={{ fontFamily: "Sora, sans-serif" }}>Market Sector Distribution</h3>
                <p className="text-[10px]" style={{ color: C.mutedSand }}>Breakdown by usage type and cumulative output</p>
              </div>
              <div className="flex flex-col gap-3.5">
                {data.sectorSplit.map((sec, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-white/90">{sec.name}</span>
                      <span className="font-mono text-white font-bold">{sec.percentage}%</span>
                    </div>
                    {/* Visual Bar */}
                    <div className="w-full h-1.5 bg-[#171210] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${sec.percentage}%`, background: idx === 0 ? C.primary : idx === 1 ? C.secondary : C.onSurfaceVariant }} />
                    </div>
                    <div className="text-[9px] font-mono flex justify-between" style={{ color: C.mutedSand }}>
                      <span>Cumulative Output</span>
                      <span className="font-mono-numbers">{(sec.capacityMw / 1000).toFixed(2)} GW</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Average Cost Trends */}
            <div className="p-6 rounded-2xl border flex flex-col gap-4 flex-1" style={{ background: C.charcoal, borderColor: C.outlineVariant }}>
              <div>
                <h3 className="text-sm font-semibold text-white font-display" style={{ fontFamily: "Sora, sans-serif" }}>Pricing Ranges by Size</h3>
                <p className="text-[10px]" style={{ color: C.mutedSand }}>National average pricing limits (excluding solar grid offsets)</p>
              </div>
              <div className="flex flex-col gap-3">
                {data.costTrends.map((c, idx) => (
                  <div key={idx} className="flex justify-between items-center py-1.5 border-b border-white/5 last:border-none">
                    <span className="text-xs text-white/80 font-medium">{c.size}</span>
                    <span className="text-xs font-mono text-white font-bold font-mono-numbers">
                      ₹{(c.pricePerKwMin/1000).toFixed(0)}k - ₹{(c.pricePerKwMax/1000).toFixed(0)}k <span className="text-[10px] text-neutral-500 font-light">/ kW</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </section>

        {/* ── State Rankings Bar Chart ── */}
        <section className="p-6 rounded-2xl border flex flex-col gap-6" style={{ background: C.charcoal, borderColor: C.outlineVariant }}>
          <div>
            <h3 className="text-base font-semibold text-white mb-1 font-display" style={{ fontFamily: "Sora, sans-serif" }}>Top State Solar Rankings</h3>
            <p className="text-xs" style={{ color: C.mutedSand }}>Capacity distribution in Megawatts (MW) and relative project densities across leading Indian states</p>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.stateRankings} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#26201C" vertical={false} />
                <XAxis dataKey="state" stroke={C.mutedSand} fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke={C.mutedSand} fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}MW`} />
                <ChartTooltip
                  contentStyle={{ background: C.charcoal, border: `1px solid ${C.outlineVariant}`, borderRadius: "8px", fontSize: "11px" }}
                  labelStyle={{ color: C.onSurface, fontWeight: "bold" }}
                />
                <Bar dataKey="capacityMw" fill={C.secondary} radius={[4, 4, 0, 0]}>
                  {data.stateRankings.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index % 2 === 0 ? C.secondary : C.primary} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* ── Cost, Subsidies & Payback Calculator ── */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          
          {/* Controls Panel */}
          <div className="lg:col-span-5 p-6 rounded-2xl border flex flex-col justify-between gap-6" style={{ background: C.charcoal, borderColor: C.outlineVariant }}>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#ffb87b] animate-pulse"></div>
                <h3 className="text-base font-semibold text-white font-display" style={{ fontFamily: "Sora, sans-serif" }}>Rooftop Investment Estimator</h3>
              </div>
              <p className="text-xs" style={{ color: C.mutedSand }}>Select target solar capacity and installation region to simulate PM scheme subsidies, net expenses, and payback periods.</p>

              {/* State Selection */}
              <div className="space-y-2">
                <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">Target State</label>
                <select 
                  value={calcState}
                  onChange={(e) => setCalcState(e.target.value)}
                  className="w-full p-3 bg-[#171210] border rounded-lg text-sm text-white focus:outline-none focus:border-[#ff8f00]"
                  style={{ borderColor: C.outlineVariant }}
                >
                  <option value="Gujarat">Gujarat (Surya Gujarat incentive)</option>
                  <option value="Uttar Pradesh">Uttar Pradesh (₹30k extra incentive)</option>
                  <option value="Delhi">Delhi (Generation-Based Incentive)</option>
                  <option value="Maharashtra">Maharashtra (Duty Waiver)</option>
                  <option value="Karnataka">Karnataka (Exempted Entry Taxes)</option>
                  <option value="Rajasthan">Rajasthan (Standard National)</option>
                </select>
              </div>

              {/* Capacity Slider */}
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">System Capacity</span>
                  <span className="font-mono text-white font-bold text-sm font-mono-numbers">{calcCapacity} kW</span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="15" 
                  step="1"
                  value={calcCapacity}
                  onChange={(e) => setCalcCapacity(Number(e.target.value))}
                  className="w-full accent-[#ff8f00] cursor-pointer bg-neutral-800"
                />
                <div className="flex justify-between text-[9px] font-mono" style={{ color: C.mutedSand }}>
                  <span>1 kW (Small Home)</span>
                  <span>15 kW (Large Villa)</span>
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-[#171210] rounded-xl flex gap-2 border border-white/5">
              <Info className="w-4 h-4 shrink-0 text-[#ffb87b]" />
              <p className="text-[10px] leading-relaxed text-neutral-400">
                Calculations based on an average yield profile of 1,386 kWh per kW annually, offset against local DISCOM tier pricing averages.
              </p>
            </div>
          </div>

          {/* Results Summary Card */}
          <div className="lg:col-span-7 p-7 rounded-2xl border flex flex-col justify-between gap-6 gradient-glow" style={{ background: C.charcoal, borderColor: C.outlineVariant }}>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: C.mutedSand }}>Est. Project Cost</span>
                <div className="text-xl md:text-2xl font-bold font-mono-numbers text-white">₹{estimate.baseCost.toLocaleString("en-IN")}</div>
                <div className="text-[9px] text-neutral-500 font-light">Retail installation rates</div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: C.mutedSand }}>Government Subsidy</span>
                <div className="text-xl md:text-2xl font-bold font-mono-numbers text-[#41e1b4]">-₹{(estimate.centralSubsidy + estimate.stateSubsidy).toLocaleString("en-IN")}</div>
                <div className="text-[9px] text-[#41e1b4]/80 font-mono text-[8px] font-bold">National + State booster</div>
              </div>

              <div className="space-y-1 col-span-2 md:col-span-1">
                <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: C.mutedSand }}>Net Out-of-Pocket</span>
                <div className="text-xl md:text-2xl font-bold font-mono-numbers text-[#ffb87b]">₹{estimate.netCost.toLocaleString("en-IN")}</div>
                <div className="text-[9px] text-neutral-500 font-light">Your actual capital cost</div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: C.mutedSand }}>Annual Production</span>
                <div className="text-xl md:text-2xl font-bold font-mono-numbers text-white">{estimate.annualGeneration.toLocaleString("en-IN")} <span className="text-xs text-neutral-500">kWh</span></div>
                <div className="text-[9px] text-neutral-500 font-light">Yearly clean electricity</div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: C.mutedSand }}>Annual Utility Savings</span>
                <div className="text-xl md:text-2xl font-bold font-mono-numbers text-white">₹{estimate.annualSavings.toLocaleString("en-IN")}</div>
                <div className="text-[9px] text-neutral-500 font-light">Subtracted from bill slabs</div>
              </div>

              <div className="space-y-1 col-span-2 md:col-span-1">
                <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: C.mutedSand }}>Amortization Timeline</span>
                <div className="text-xl md:text-2xl font-bold font-mono-numbers text-[#41e1b4]">{estimate.paybackYears} Years</div>
                <div className="text-[9px] text-[#41e1b4]/80 font-mono font-bold">Payback / ROI break-even</div>
              </div>

            </div>

            {/* Visual pay back progress visualization */}
            <div className="space-y-2 pt-4 border-t border-white/5">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-white/90">Break-even Payback Comparison</span>
                <span className="font-mono text-[#ffb87b] font-bold">{Math.round((estimate.paybackYears / 25) * 100)}% of Solar Lifecycle</span>
              </div>
              <div className="w-full h-3 bg-[#171210] rounded-full overflow-hidden relative flex">
                {/* Payback duration */}
                <div className="h-full rounded-l-full bg-gradient-to-r from-red-500 to-amber-500" style={{ width: `${Math.min(100, (estimate.paybackYears / 25) * 100)}%` }} />
                {/* Remaining lifecycle */}
                <div className="h-full rounded-r-full bg-emerald-500" style={{ width: `${Math.max(0, 100 - (estimate.paybackYears / 25) * 100)}%` }} />
              </div>
              <div className="flex justify-between text-[8px] font-mono" style={{ color: C.mutedSand }}>
                <span className="text-red-400 font-bold">0 yr (CapEx outlay)</span>
                <span className="text-amber-400 font-bold font-mono-numbers">{estimate.paybackYears} yr (Break-even)</span>
                <span className="text-emerald-400 font-bold">25 yr (Warranted Output Period)</span>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="mt-20 py-8 text-center border-t text-xs font-mono" style={{ borderColor: C.outlineVariant, color: C.mutedSand }}>
        <div className="max-w-[1280px] mx-auto px-4 md:px-16 flex flex-col md:flex-row justify-between items-center gap-4">
          <span>© {new Date().getFullYear()} SUNPOWER LINK. Rooftop solar analysis for India. All Rights Reserved.</span>
          <div className="flex gap-4">
            <button onClick={() => navigate("/privacy")} className="hover:text-white transition-colors bg-transparent border-none cursor-pointer">Privacy Policy</button>
            <button onClick={() => navigate("/policy-tracker")} className="hover:text-white transition-colors bg-transparent border-none cursor-pointer">Policy Tracker</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
