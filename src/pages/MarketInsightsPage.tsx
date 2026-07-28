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
  Zap,
  BarChart3,
  ShieldCheck,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Grid,
  ChartTooltip,
} from "@/components/charts";
import {
  BarChartComp as BarChart,
  Bar,
  BarXAxis,
  BarYAxis,
  BarGrid,
} from "@/components/charts/BarChart";
import {
  calcInstalledCapacity,
  calcAnnualEnergy,
  calcSystemCost,
  calcSubsidyInr,
  calcAnnualSavings,
  calcPaybackYears,
  calcROI
} from '@/lib/solar-calc';
import { getDiscomRate } from '@/lib/discom-rates';
import { ELECTRICITY_RATE_INR } from '@/lib/solar-defaults';

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
      <div className="min-h-screen bg-[#050505] flex items-center justify-center text-white font-mono">
        <div className="flex flex-col items-center gap-4 bg-[#0A0A0A]/80 border border-white/10 p-10 rounded-3xl backdrop-blur-2xl">
          <div className="w-10 h-10 border-2 border-t-transparent border-[#FF6600] animate-spin rounded-full"></div>
          <span className="text-xs uppercase tracking-widest text-white/50">Analyzing India's Solar Market...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center text-white font-mono">
        <div className="text-center space-y-4 bg-[#0A0A0A]/80 border border-white/10 p-10 rounded-3xl backdrop-blur-2xl">
          <p className="text-red-400 text-sm">Error: {error || "No market data received"}</p>
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

  // Cost & Savings Calculations for Estimator
  const calculateEstimate = () => {
    const usableAreaM2 = calcCapacity * 8;
    const installedKw = calcInstalledCapacity(usableAreaM2);
    const systemCost = calcSystemCost(installedKw);

    const annualKwh = calcAnnualEnergy(installedKw, 5.0);
    const electricityRate = getDiscomRate(calcState) || ELECTRICITY_RATE_INR;
    const annualSavings = calcAnnualSavings(annualKwh, electricityRate);

    const netCost = systemCost - calcSubsidyInr(installedKw);
    const paybackYears = calcPaybackYears(netCost, annualSavings);

    return {
      baseCost: systemCost,
      centralSubsidy: calcSubsidyInr(installedKw),
      stateSubsidy: 0,
      netCost,
      annualGeneration: annualKwh,
      annualSavings,
      paybackYears,
    };
  };

  const estimate = calculateEstimate();

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans antialiased overflow-x-hidden relative selection:bg-[#FF6600]/30 selection:text-white">
      {/* Background Ambient Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute top-[-15%] right-[-5%] w-[600px] h-[600px] rounded-full bg-[#FF6600]/5 blur-[140px]" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full bg-emerald-500/3 blur-[140px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-2xl bg-[#050505]/85 border-b border-white/10">
        <div className="flex justify-between items-center px-4 md:px-12 py-3 mx-auto max-w-[1280px]">
          <a href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }} className="flex items-center gap-3 group">
            <img src="/logo.png" alt="SUNPOWER LINK Logo" className="w-8 h-8 object-contain transition-transform duration-200 group-hover:scale-105" />
            <span className="text-[15px] font-bold text-white tracking-tight">
              SUNPOWER <span className="font-serif italic font-light text-[#FF6600]">LINK</span>
            </span>
          </a>
          <nav className="hidden md:flex gap-6">
            <button onClick={() => navigate("/")} className="text-xs font-mono uppercase tracking-wider text-white/50 hover:text-white transition-colors bg-transparent border-none cursor-pointer">Home</button>
            <button onClick={() => navigate("/market-insights")} className="text-xs font-mono uppercase tracking-wider text-[#FF6600] font-bold bg-transparent border-none cursor-pointer">Market Insights</button>
            <button onClick={() => navigate("/policy-tracker")} className="text-xs font-mono uppercase tracking-wider text-white/50 hover:text-white transition-colors bg-transparent border-none cursor-pointer">Policy Tracker</button>
          </nav>
          <div className="flex items-center gap-2 md:gap-3">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all active:scale-95 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
            <button
              onClick={() => navigate("/map")}
              className="hidden md:flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-black bg-[#FF6600] hover:bg-orange-500 rounded-xl transition-all active:scale-95 cursor-pointer border-none shadow-lg shadow-[#FF6600]/20"
            >
              Launch Studio <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <main className="max-w-[1280px] mx-auto px-4 md:px-12 py-10 flex flex-col gap-10 relative z-10">

        {/* Title & Intro */}
        <section className="flex flex-col gap-3 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-[#FF6600] text-[10px] font-mono font-bold uppercase tracking-[0.12em] w-fit">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>National Solar Intelligence Dashboard</span>
          </div>
          <h1
            className="text-3xl md:text-5xl text-white leading-tight"
            style={{ fontFamily: "'Calistoga', serif", fontWeight: 400 }}
          >
            India's Rooftop Solar <br className="hidden md:block" />
            <span className="text-[#FF6600]">Market Insights</span>
          </h1>
          <p className="text-sm md:text-base leading-relaxed text-white/50 font-light">
            Real-time diagnostics of cost structures, installation trajectories, and state capacity rankings derived from aggregated national solar telemetry.
          </p>
        </section>

        {/* Top-level Metrics */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "National Capacity", value: `${data.nationalStats.cumulativeCapacityGw} GW`, sub: `+${data.nationalStats.yoyGrowthPct}% YoY Growth`, icon: Layers, color: "text-[#FF6600]" },
            { label: "Avg. Residential Payback", value: `${data.nationalStats.avgPaybackYears} Years`, sub: "PM Surya Subsidized", icon: Calendar, color: "text-emerald-400" },
            { label: "Avg. Base Cost / kW", value: `₹${data.nationalStats.avgCostPerKw.toLocaleString("en-IN")}`, sub: "Retail CapEx before subsidy", icon: IndianRupee, color: "text-[#FF6600]" },
            { label: "Est. Installations", value: "475,000+", sub: "Active deployments", icon: MapPin, color: "text-emerald-400" },
          ].map((m, idx) => (
            <div key={idx} className="p-6 rounded-3xl border border-white/10 bg-[#0A0A0A]/90 backdrop-blur-2xl hover:border-[#FF6600]/40 transition-all duration-200 shadow-2xl">
              <div className="flex justify-between items-start mb-4">
                <span className="text-[10px] font-mono uppercase tracking-wider text-white/40">{m.label}</span>
                <m.icon className={`w-4 h-4 ${m.color}`} />
              </div>
              <div className="text-2xl md:text-3xl font-extrabold text-white tracking-tight mb-1 font-mono">
                {m.value}
              </div>
              <div className={`text-[10px] font-mono font-medium ${m.color}`}>
                {m.sub}
              </div>
            </div>
          ))}
        </section>

        {/* Charts Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Area Chart: Yearly Cumulative Capacity */}
          <div className="lg:col-span-8 p-6 sm:p-8 rounded-3xl border border-white/10 bg-[#0A0A0A]/90 backdrop-blur-2xl flex flex-col gap-6 shadow-2xl">
            <div>
              <h3 className="text-lg font-bold text-white mb-1">National Growth Trajectory</h3>
              <p className="text-xs text-white/40 font-mono">Cumulative installed rooftop solar capacity in Gigawatts (GW) (2018 - 2026 Projection)</p>
            </div>
            <div className="h-[280px] w-full">
              <AreaChart
                data={data.yearlyGrowth}
                xDataKey="year"
                margin={{ top: 10, right: 10, bottom: 0, left: -20 }}
              >
                <Grid horizontal />
                <XAxis />
                <YAxis tickFormatter={(v) => `${v}GW`} />
                <Area dataKey="capacityGw" stroke="#FF6600" fill="#FF6600" fillOpacity={0.35} strokeWidth={2.5} />
                <ChartTooltip dataKeys={["capacityGw"]} colors={["#FF6600"]} />
              </AreaChart>
            </div>
          </div>

          {/* Sector Share & Cost Breakdown */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            
            {/* Sector Split */}
            <div className="p-6 rounded-3xl border border-white/10 bg-[#0A0A0A]/90 backdrop-blur-2xl flex flex-col gap-4 flex-1 shadow-2xl">
              <div>
                <h3 className="text-base font-bold text-white">Market Sector Distribution</h3>
                <p className="text-xs text-white/40 font-mono">Breakdown by usage type and capacity</p>
              </div>
              <div className="flex flex-col gap-4">
                {data.sectorSplit.map((sec, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-white">{sec.name}</span>
                      <span className="font-mono text-[#FF6600] font-bold">{sec.percentage}%</span>
                    </div>
                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-[#FF6600]" style={{ width: `${sec.percentage}%`, opacity: 1 - idx * 0.25 }} />
                    </div>
                    <div className="text-[10px] font-mono flex justify-between text-white/40">
                      <span>Cumulative Capacity</span>
                      <span>{(sec.capacityMw / 1000).toFixed(2)} GW</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Average Cost Trends */}
            <div className="p-6 rounded-3xl border border-white/10 bg-[#0A0A0A]/90 backdrop-blur-2xl flex flex-col gap-4 flex-1 shadow-2xl">
              <div>
                <h3 className="text-base font-bold text-white">Pricing Ranges by System Size</h3>
                <p className="text-xs text-white/40 font-mono">Retail installation costs</p>
              </div>
              <div className="flex flex-col gap-3">
                {data.costTrends.map((c, idx) => (
                  <div key={idx} className="flex justify-between items-center py-2 border-b border-white/5 last:border-none">
                    <span className="text-xs text-white/80 font-medium">{c.size}</span>
                    <span className="text-xs font-mono text-white font-bold">
                      ₹{(c.pricePerKwMin/1000).toFixed(0)}k - ₹{(c.pricePerKwMax/1000).toFixed(0)}k <span className="text-[10px] text-white/40 font-normal">/ kW</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </section>

        {/* State Rankings Bar Chart */}
        <section className="p-6 sm:p-8 rounded-3xl border border-white/10 bg-[#0A0A0A]/90 backdrop-blur-2xl flex flex-col gap-6 shadow-2xl">
          <div>
            <h3 className="text-lg font-bold text-white mb-1">Top Solar States Ranking</h3>
            <p className="text-xs text-white/40 font-mono">Installed capacity in Megawatts (MW) across leading Indian states</p>
          </div>
          <div className="h-[250px] w-full">
            <BarChart
              data={data.stateRankings}
              xDataKey="state"
              margin={{ top: 10, right: 10, bottom: 0, left: -20 }}
            >
              <BarGrid />
              <BarXAxis />
              <BarYAxis tickFormatter={(v) => `${v}MW`} />
              <Bar
                dataKey="capacityMw"
                radius={[6, 6, 0, 0]}
                fills={data.stateRankings.map((_, i) => i % 2 === 0 ? "#FF6600" : "#10B981")}
              />
            </BarChart>
          </div>
        </section>

        {/* Cost, Subsidies & Payback Calculator */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          
          {/* Controls Panel */}
          <div className="lg:col-span-5 p-6 sm:p-8 rounded-3xl border border-white/10 bg-[#0A0A0A]/90 backdrop-blur-2xl flex flex-col justify-between gap-6 shadow-2xl">
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#FF6600] animate-pulse"></div>
                <h3 className="text-lg font-bold text-white">Rooftop Investment Simulator</h3>
              </div>
              <p className="text-xs text-white/50 leading-relaxed">Select your state and target capacity to compute PM-Surya Ghar subsidy eligibility, net capital expense, and payback timeline.</p>

              {/* State Selection */}
              <div className="space-y-2">
                <label className="text-[10px] font-mono uppercase tracking-wider text-white/40">State Jurisdiction</label>
                <select 
                  value={calcState}
                  onChange={(e) => setCalcState(e.target.value)}
                  className="w-full p-3 bg-white/[0.04] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-[#FF6600]/60 focus:ring-2 focus:ring-[#FF6600]/20 transition-all cursor-pointer"
                >
                  <option value="Gujarat" className="bg-[#050505]">Gujarat (Surya Gujarat Scheme)</option>
                  <option value="Uttar Pradesh" className="bg-[#050505]">Uttar Pradesh (State Booster Bonus)</option>
                  <option value="Delhi" className="bg-[#050505]">Delhi (Generation Incentive GBI)</option>
                  <option value="Maharashtra" className="bg-[#050505]">Maharashtra (Electricity Duty Waiver)</option>
                  <option value="Karnataka" className="bg-[#050505]">Karnataka (Exempted Entry Taxes)</option>
                  <option value="Rajasthan" className="bg-[#050505]">Rajasthan (Standard National Subsidy)</option>
                </select>
              </div>

              {/* Capacity Slider */}
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-white/40">Target Capacity</span>
                  <span className="font-mono text-[#FF6600] font-bold text-base">{calcCapacity} kW</span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="15" 
                  step="1"
                  value={calcCapacity}
                  onChange={(e) => setCalcCapacity(Number(e.target.value))}
                  className="w-full accent-[#FF6600] cursor-pointer bg-white/10 h-2 rounded-lg"
                />
                <div className="flex justify-between text-[10px] font-mono text-white/40">
                  <span>1 kW (Compact Home)</span>
                  <span>15 kW (Villa / Commercial)</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-white/[0.03] rounded-2xl flex gap-3 border border-white/5">
              <Info className="w-4 h-4 shrink-0 text-[#FF6600] mt-0.5" />
              <p className="text-[11px] leading-relaxed text-white/40">
                Simulations assume 1,386 kWh annual yield per kW capacity offset against standard local utility tariff slabs.
              </p>
            </div>
          </div>

          {/* Results Summary Card */}
          <div className="lg:col-span-7 p-6 sm:p-8 rounded-3xl border border-white/10 bg-[#0A0A0A]/90 backdrop-blur-2xl flex flex-col justify-between gap-6 shadow-2xl">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-white/40">Gross Project Cost</span>
                <div className="text-xl md:text-2xl font-bold font-mono text-white">₹{estimate.baseCost.toLocaleString("en-IN")}</div>
                <div className="text-[10px] text-white/30">Retail turnkey setup</div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-white/40">PM-Surya Subsidy</span>
                <div className="text-xl md:text-2xl font-bold font-mono text-emerald-400">-₹{estimate.centralSubsidy.toLocaleString("en-IN")}</div>
                <div className="text-[10px] text-emerald-400/80 font-mono font-bold">Direct Benefit Credit</div>
              </div>

              <div className="space-y-1 col-span-2 md:col-span-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-white/40">Net Investment</span>
                <div className="text-xl md:text-2xl font-bold font-mono text-[#FF6600]">₹{estimate.netCost.toLocaleString("en-IN")}</div>
                <div className="text-[10px] text-white/30">Out-of-pocket CapEx</div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-white/40">Annual Generation</span>
                <div className="text-xl md:text-2xl font-bold font-mono text-white">{estimate.annualGeneration.toLocaleString("en-IN")} <span className="text-xs font-normal text-white/40">kWh</span></div>
                <div className="text-[10px] text-white/30">Clean energy yield</div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-white/40">Annual Bill Savings</span>
                <div className="text-xl md:text-2xl font-bold font-mono text-white">₹{estimate.annualSavings.toLocaleString("en-IN")}</div>
                <div className="text-[10px] text-white/30">Offset from utility bills</div>
              </div>

              <div className="space-y-1 col-span-2 md:col-span-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-white/40">Payback Period</span>
                <div className="text-xl md:text-2xl font-bold font-mono text-emerald-400">{estimate.paybackYears} Years</div>
                <div className="text-[10px] text-emerald-400/80 font-mono font-bold">100% Amortization</div>
              </div>

            </div>

            {/* Visual payback progress visualization */}
            <div className="space-y-3 pt-4 border-t border-white/5">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-white">Solar Lifetime Amortization Curve</span>
                <span className="font-mono text-[#FF6600] font-bold">{Math.round((estimate.paybackYears / 25) * 100)}% of 25-Year Life</span>
              </div>
              <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden relative flex">
                <div className="h-full rounded-l-full bg-gradient-to-r from-red-500 to-[#FF6600]" style={{ width: `${Math.min(100, (estimate.paybackYears / 25) * 100)}%` }} />
                <div className="h-full rounded-r-full bg-emerald-500" style={{ width: `${Math.max(0, 100 - (estimate.paybackYears / 25) * 100)}%` }} />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-white/40">
                <span className="text-red-400 font-bold">0 yr (Initial CapEx)</span>
                <span className="text-[#FF6600] font-bold">{estimate.paybackYears} yr (Break-even)</span>
                <span className="text-emerald-400 font-bold">25 yr (Warranted Yield)</span>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="mt-20 py-8 text-center border-t border-white/10 text-xs font-mono text-white/40 bg-[#050505]">
        <div className="max-w-[1280px] mx-auto px-4 md:px-12 flex flex-col md:flex-row justify-between items-center gap-4">
          <span>© {new Date().getFullYear()} SUNPOWER LINK. Rooftop solar analysis for India. All Rights Reserved.</span>
          <div className="flex gap-6">
            <button onClick={() => navigate("/privacy")} className="hover:text-white transition-colors bg-transparent border-none cursor-pointer">Privacy Policy</button>
            <button onClick={() => navigate("/policy-tracker")} className="hover:text-white transition-colors bg-transparent border-none cursor-pointer">Policy Tracker</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
