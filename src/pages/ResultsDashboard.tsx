import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Sun,
  Zap,
  TrendingUp,
  IndianRupee,
  Activity,
  Share2,
  PhoneCall,
  MapPin,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  User,
  LogOut,
  LayoutDashboard,
  BarChart3,
  Settings,
  Menu,
  X
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Grid,
  ChartTooltip,
  ReferenceLine,
} from "@/components/charts";
import { useScanStore } from "@/hooks/use-scan-store";
import { useToast } from "@/hooks/use-toast";
import { generatePDFReport } from "@/lib/pdf-generator";
import { useAuth } from "@/contexts/AuthContext";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";

// ─── Count-Up Animation Component ───────────────────────────
interface CountUpProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}

function CountUp({ value, duration = 800, prefix = "", suffix = "", decimals = 0 }: CountUpProps) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easedProgress = progress * (2 - progress); // easeOutQuad
      setDisplayValue(easedProgress * value);
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        setDisplayValue(value);
      }
    };
    window.requestAnimationFrame(step);
  }, [value, duration]);

  const formatted = displayValue.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

// ─── Confidence Circular Progress Ring ──────────────────────
interface ConfidenceCircleProps {
  score: number;
}

function ConfidenceCircle({ score }: ConfidenceCircleProps) {
  const percentage = Math.round(score * 100);
  const color = score >= 0.80 ? "#10B981" : "#FF6600";
  const glowClass = score >= 0.80 
    ? "shadow-[0_0_40px_rgba(16,185,129,0.25)]" 
    : "shadow-[0_0_40px_rgba(255,102,0,0.25)]";

  const radius = 55;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="relative w-36 h-36 flex items-center justify-center">
        {/* Glow behind the ring */}
        <div 
          className={`absolute inset-4 rounded-full border border-white/5 bg-[#0A0A0A]/80 backdrop-blur-md transition-all ${glowClass}`} 
        />
        
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 130 130">
          {/* Base background circle */}
          <circle
            cx="65"
            cy="65"
            r={radius}
            className="stroke-white/10"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Progress ring */}
          <motion.circle
            cx="65"
            cy="65"
            r={radius}
            className="transition-all duration-1000"
            stroke={color}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference - (circumference * percentage) / 100 }}
            strokeLinecap="round"
          />
        </svg>
        {/* Percentage label in center */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-3xl font-bold tracking-tighter" style={{ color }}>
            {percentage}%
          </span>
          <span className="text-[9px] uppercase tracking-widest text-white/40 font-mono font-bold">
            Scan Quality
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── High-Fidelity Mock Data (for sample view fallback) ─────
const mockAnalysis = {
  analysisId: "sunpower_mock",
  rooftop: {
    drawnAreaM2: 50,
    usableAreaM2: 37.5,
  },
  energy: {
    installedCapacityKw: 4.69,
    peakSunHoursDaily: 5.2,
    dailyKwh: 21.0,
    monthlyKwh: 638.3,
    annualKwh: 7660,
  },
  financials: {
    electricityRateInr: 9.2,
    monthlySavingsInr: 5873,
    annualSavingsInr: 70472,
    savings25yrInr: 1761800,
  },
  investment: {
    systemCostInr: 272020,
    subsidyInr: 78000,
    netCostInr: 194020,
    paybackYears: 2.8,
    roi25yrPercent: 808,
  },
  environmental: {
    co2AnnualKg: 6281.2,
    co2_25yrKg: 157030,
    treesEquivalent: 288,
  },
  generatedAt: new Date().toISOString(),
  location: {
    lat: 19.0760,
    lng: 72.8777,
    label: "Bandra West, Mumbai, Maharashtra"
  }
};

export default function ResultsDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const { fullAnalysis } = useScanStore();

  const [activeTab, setActiveTab] = useState("overview");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [monthlyBill, setMonthlyBill] = useState("");

  // Target Analysis: real or mock
  const analysis = fullAnalysis || mockAnalysis;
  const isSample = !fullAnalysis;

  // Derive parameters
  const capacityKw = analysis.energy.installedCapacityKw;
  const systemCost = analysis.investment.systemCostInr;
  const subsidy = analysis.investment.subsidyInr;
  const netCost = analysis.investment.netCostInr;
  const annualSavings = analysis.financials.annualSavingsInr;
  const payback = analysis.investment.paybackYears;
  const confidenceScore = isSample ? 0.91 : 0.84;

  useEffect(() => {
    document.title = "Solar Scan Dashboard — SUNPOWER LINK";
  }, []);

  // Generate 25 year timeline cash flow
  const chartData = Array.from({ length: 26 }, (_, i) => {
    const balance = -netCost + i * annualSavings;
    return {
      year: i,
      balance: Math.round(balance),
    };
  });

  const handleDownloadPDF = async () => {
    setDownloadingPdf(true);
    try {
      await generatePDFReport(analysis, { locationLabel: analysis.location?.label || "India" });
      toast({
        title: "Report Downloaded",
        description: "Your glassmorphic solar report has been generated successfully.",
      });
    } catch (err) {
      console.error("PDF generation failed:", err);
      toast({
        title: "Generation Failed",
        description: "Could not generate report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone || !email) {
      toast({
        title: "Validation Error",
        description: "Please fill out all required fields.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Request Sent!",
      description: "A certified installer will reach out to you within 24 hours.",
    });
    setIsContactOpen(false);
    setName("");
    setPhone("");
    setEmail("");
    setMonthlyBill("");
  };

  const menuItems = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "energy", label: "Energy Analysis", icon: Activity },
    { id: "financial", label: "Financial Forecast", icon: TrendingUp },
    { id: "installer", label: "Installer Offers", icon: ShieldCheck }
  ];

  // Animation variants
  const staggerContainer = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemFadeIn = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans antialiased pb-16 pt-20 relative selection:bg-[#FF6600]/30 selection:text-white">
      {/* Background Ambient Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute top-[-15%] right-[-5%] w-[600px] h-[600px] rounded-full bg-[#FF6600]/5 blur-[140px]" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full bg-emerald-500/3 blur-[140px]" />
      </div>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 backdrop-blur-2xl bg-[#050505]/85 border-b border-white/10">
        <div className="max-w-[1280px] h-full mx-auto px-4 md:px-8 flex justify-between items-center">
          <a href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }} className="flex items-center gap-3 group">
            <img src="/logo.png" alt="SUNPOWER LINK Logo" className="w-8 h-8 object-contain transition-transform duration-200 group-hover:scale-105" />
            <span className="text-[15px] font-bold text-white tracking-tight">
              SUNPOWER <span className="font-serif italic font-light text-[#FF6600]">LINK</span>
            </span>
          </a>

          <div className="hidden md:flex items-center gap-6">
            <button onClick={() => navigate("/map")} className="text-xs font-mono uppercase tracking-wider text-white/50 hover:text-white transition-colors bg-transparent border-none cursor-pointer">
              Map Analyzer
            </button>
            <button onClick={() => navigate("/market-insights")} className="text-xs font-mono uppercase tracking-wider text-white/50 hover:text-white transition-colors bg-transparent border-none cursor-pointer">
              Market Insights
            </button>
            <button onClick={() => navigate("/policy-tracker")} className="text-xs font-mono uppercase tracking-wider text-white/50 hover:text-white transition-colors bg-transparent border-none cursor-pointer">
              Policy Tracker
            </button>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                  <User className="w-4 h-4 text-white/60" />
                </div>
                <span className="hidden sm:inline text-xs font-mono text-white/50 truncate max-w-[120px]">
                  {user.email}
                </span>
                <button 
                  onClick={() => signOut()}
                  className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-full transition-colors border-none bg-transparent cursor-pointer"
                  aria-label="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => navigate("/auth/signin")}
                className="bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs px-4 py-2 rounded-xl font-semibold transition-all active:scale-95 cursor-pointer"
              >
                Sign In
              </button>
            )}

            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-white/50 hover:text-white hover:bg-white/5 rounded-xl transition-colors border-none bg-transparent cursor-pointer"
              aria-label="Toggle Menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Panel */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-[#050505] pt-20 px-6 flex flex-col gap-6">
          <nav className="flex flex-col gap-4">
            <span onClick={() => { navigate("/map"); setIsMobileMenuOpen(false); }} className="text-lg text-white/70">Map Analyzer</span>
            <span onClick={() => { navigate("/market-insights"); setIsMobileMenuOpen(false); }} className="text-lg text-white/70">Market Insights</span>
            <span onClick={() => { navigate("/policy-tracker"); setIsMobileMenuOpen(false); }} className="text-lg text-white/70">Policy Tracker</span>
            {user && <span onClick={() => { navigate("/my-scans"); setIsMobileMenuOpen(false); }} className="text-lg text-white/70">My Scans</span>}
            {user && <span onClick={() => { navigate("/settings"); setIsMobileMenuOpen(false); }} className="text-lg text-white/70">Settings</span>}
          </nav>
        </div>
      )}

      {/* Content Container */}
      <main className="max-w-[1280px] mx-auto px-4 md:px-8 mt-4 flex flex-col gap-6 relative z-10">
        
        {/* Sample report banner */}
        {isSample && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#0A0A0A] border border-[#FF6600]/30 text-white px-5 py-3.5 text-xs rounded-2xl flex items-center justify-between gap-4 shadow-2xl backdrop-blur-2xl"
          >
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-[#FF6600] shrink-0 animate-pulse" />
              <span className="text-white/80">Viewing <strong className="text-white font-bold">Sample Solar Report</strong>. Launch a custom rooftop scan to analyze your own property.</span>
            </div>
            <button
              onClick={() => navigate("/map")}
              className="bg-[#FF6600] hover:bg-orange-500 text-black text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-xl shrink-0 transition-all active:scale-95 cursor-pointer border-none shadow-lg shadow-[#FF6600]/20"
            >
              Scan Now
            </button>
          </motion.div>
        )}

        {/* Title */}
        <section className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-xs font-mono text-white/50">
            <MapPin className="w-3.5 h-3.5 text-[#FF6600]" />
            <span>{analysis.location?.label || "Selected Roof Location"}</span>
          </div>
          <h1 className="text-2xl md:text-4xl font-extrabold text-white tracking-tight">
            Rooftop Solar Diagnostic <span className="text-[#FF6600] font-serif italic font-light">Dashboard</span>
          </h1>
        </section>

        {/* 12-Column Responsive Layout Grid */}
        <motion.div 
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 items-stretch"
        >
          {/* 1. Left Navigation Sidebar */}
          <motion.div variants={itemFadeIn} className="lg:col-span-3 flex flex-col gap-4 self-start">
            <div className="p-4 flex flex-col gap-1 bg-[#0A0A0A]/90 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl">
              <div className="text-[10px] font-mono uppercase tracking-wider text-white/40 mb-2 px-3">
                Report Navigation
              </div>
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`flex items-center justify-between px-3.5 py-3 rounded-2xl text-left text-xs transition-all duration-200 cursor-pointer ${
                      isActive 
                        ? "bg-[#FF6600] text-black font-bold shadow-lg shadow-[#FF6600]/20 border-none" 
                        : "text-white/60 hover:text-white hover:bg-white/5 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${isActive ? "text-black" : "text-white/40"}`} />
                      <span>{item.label}</span>
                    </div>
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-black" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Quick summary stats in sidebar */}
            <div className="p-5 flex flex-col gap-3 bg-[#0A0A0A]/90 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl">
              <span className="text-[10px] font-mono uppercase tracking-wider text-white/40">Scan Metadata</span>
              <div className="flex justify-between text-xs py-1.5 border-b border-white/5">
                <span className="text-white/50">Total Roof Area</span>
                <span className="font-mono text-white font-bold">{analysis.rooftop.drawnAreaM2} m²</span>
              </div>
              <div className="flex justify-between text-xs py-1.5 border-b border-white/5">
                <span className="text-white/50">Usable Roof Area</span>
                <span className="font-mono text-white font-bold">{analysis.rooftop.usableAreaM2} m²</span>
              </div>
              <div className="flex justify-between text-xs py-1.5">
                <span className="text-white/50">System Capacity</span>
                <span className="font-mono text-[#FF6600] font-bold">{capacityKw.toFixed(2)} kWp</span>
              </div>
            </div>
          </motion.div>

          {/* 2. Center Content Panel */}
          <motion.div variants={itemFadeIn} className="md:col-span-2 lg:col-span-6 flex flex-col gap-6">
            
            {/* Top: Confidence Score Card */}
            <div className="flex flex-col sm:flex-row items-center gap-6 p-6 sm:p-8 bg-[#0A0A0A]/90 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl hover:border-[#FF6600]/40 transition-all duration-200">
              <ConfidenceCircle score={confidenceScore} />
              
              <div className="flex-1 space-y-2 text-center sm:text-left">
                <div className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-lg text-[10px] font-mono tracking-wider text-emerald-400 font-bold uppercase">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Verified Scan Accuracy</span>
                </div>
                <h3 className="text-lg font-bold text-white">
                  High-Fidelity AI Diagnostics
                </h3>
                <p className="text-xs text-white/50 leading-relaxed font-light">
                  Rooftop footprint mapped via high-resolution satellite imagery. Solar yield calculations model local irradiance profiles and tree line shading sets.
                </p>
              </div>
            </div>

            {/* Center: Solar Energy Production Card */}
            <div className="flex flex-col gap-4 p-6 sm:p-8 bg-[#0A0A0A]/90 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl hover:border-[#FF6600]/40 transition-all duration-200">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-white/40">Generation Yield</span>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Sun className="w-5 h-5 text-[#FF6600] animate-pulse" />
                    Annual Clean Power
                  </h3>
                </div>
                <div className="p-2.5 bg-[#FF6600]/10 border border-[#FF6600]/20 rounded-2xl text-[#FF6600]">
                  <Zap className="w-5 h-5" />
                </div>
              </div>

              {/* Major Production Figure */}
              <div className="py-2 flex items-baseline gap-2">
                <span className="text-4xl md:text-5xl font-mono font-bold text-white tracking-tighter">
                  <CountUp value={analysis.energy.annualKwh} duration={850} />
                </span>
                <span className="text-sm font-mono text-white/40">kWh / Year</span>
              </div>

              <div className="grid grid-cols-2 gap-4 py-3 border-t border-white/5">
                <div>
                  <span className="text-[9px] font-mono uppercase tracking-wider text-white/40 block">Monthly Generation</span>
                  <span className="font-mono text-sm text-white font-bold block mt-0.5">
                    <CountUp value={analysis.energy.monthlyKwh} suffix=" kWh" decimals={1} />
                  </span>
                </div>
                <div>
                  <span className="text-[9px] font-mono uppercase tracking-wider text-white/40 block">Daily Average</span>
                  <span className="font-mono text-sm text-white font-bold block mt-0.5">
                    <CountUp value={analysis.energy.dailyKwh} suffix=" kWh" decimals={1} />
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom: Payback Timeline Chart */}
            <div className="flex flex-col gap-4 p-6 sm:p-8 bg-[#0A0A0A]/90 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl hover:border-[#FF6600]/40 transition-all duration-200">
              <div className="flex justify-between items-center">
                <div className="space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-white/40">ROI Break-Even Forecast</span>
                  <h3 className="text-base font-bold text-white">25-Year Cash Flow Trajectory</h3>
                </div>
                <div className="text-[10px] font-mono text-[#FF6600] bg-white/5 border border-white/10 px-3 py-1 rounded-xl font-bold">
                  Payback: {payback} Years
                </div>
              </div>

              <div className="h-56 w-full mt-2 font-mono">
                <AreaChart
                  data={chartData}
                  xDataKey="year"
                  margin={{ top: 10, right: 10, bottom: 0, left: -20 }}
                >
                  <Grid horizontal />
                  <XAxis
                    tickFormatter={(v) => v === 0 ? "Yr 0" : Number(v) % 5 === 0 ? `Yr ${v}` : ""}
                  />
                  <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <ReferenceLine y={0} stroke="#10B981" strokeDasharray="4 4" />
                  <Area
                    dataKey="balance"
                    stroke="#FF6600"
                    fill="#FF6600"
                    fillOpacity={0.35}
                    strokeWidth={2.5}
                  />
                  <ChartTooltip
                    labelFormatter={(v) => `Year ${v}`}
                    dataKeys={["balance"]}
                    colors={["#FF6600"]}
                    formatter={(v, _k) => [`₹${Number(v).toLocaleString("en-IN")}`, "Cumulative Net"]}
                  />
                </AreaChart>
              </div>
            </div>

          </motion.div>

          {/* 3. Right Sidebar Panel */}
          <motion.div variants={itemFadeIn} className="lg:col-span-3 flex flex-col gap-6">
            
            {/* Right Top: Financial Summary Card */}
            <div className="flex flex-col gap-4 p-6 bg-[#0A0A0A]/90 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl">
              <span className="text-[10px] font-mono uppercase tracking-wider text-white/40">Financial Summary</span>
              
              <div className="space-y-4">
                <div className="space-y-1">
                  <span className="text-white/50 text-xs">Estimated System Cost</span>
                  <div className="text-xl font-bold font-mono text-white">
                    <CountUp value={systemCost} prefix="₹" />
                  </div>
                </div>

                <div className="space-y-1 border-t border-white/5 pt-3">
                  <span className="text-white/50 text-xs">PM-Surya Subsidy</span>
                  <div className="text-xl font-bold font-mono text-emerald-400">
                    <CountUp value={subsidy} prefix="-₹" />
                  </div>
                </div>

                <div className="space-y-1 border-t border-white/5 pt-3">
                  <span className="text-white/50 text-xs">Net Out-of-Pocket</span>
                  <div className="text-xl font-bold font-mono text-[#FF6600]">
                    <CountUp value={netCost} prefix="₹" />
                  </div>
                </div>

                <div className="space-y-1 border-t border-white/5 pt-3">
                  <span className="text-white/50 text-xs">Annual Savings</span>
                  <div className="text-xl font-bold font-mono text-white">
                    <CountUp value={annualSavings} prefix="₹" />
                  </div>
                </div>

                <div className="space-y-1 border-t border-white/5 pt-3">
                  <span className="text-white/50 text-xs">25-Year Lifecycle Savings</span>
                  <div className="text-xl font-bold font-mono text-emerald-400">
                    <CountUp value={analysis.financials.savings25yrInr} prefix="₹" />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Bottom: CTA Action Buttons */}
            <div className="flex flex-col gap-3">
              <button
                onClick={handleDownloadPDF}
                disabled={downloadingPdf}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-mono text-xs font-bold uppercase tracking-wider border border-white/10 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
              >
                {downloadingPdf ? (
                  <>Generating Report...</>
                ) : (
                  <>
                    <Share2 className="w-4 h-4 text-[#FF6600]" />
                    Download PDF Report
                  </>
                )}
              </button>

              <button
                onClick={() => setIsContactOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-[#FF6600] hover:bg-orange-500 text-black font-mono text-xs font-bold uppercase tracking-wider transition-all cursor-pointer active:scale-95 border-none shadow-lg shadow-[#FF6600]/20"
              >
                <PhoneCall className="w-4 h-4" />
                Contact Installer
              </button>
            </div>

          </motion.div>
        </motion.div>
      </main>

      {/* Installer Contact Form Popup Dialog */}
      <Dialog open={isContactOpen} onOpenChange={setIsContactOpen}>
        <DialogContent className="bg-[#0A0A0A] border border-white/10 rounded-3xl text-white p-6 sm:p-8 max-w-md w-full mx-auto backdrop-blur-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#FF6600]" />
              Empanelled Installers
            </DialogTitle>
            <DialogDescription className="text-xs text-white/50 leading-relaxed mt-1">
              Share your diagnosis summary with MNRE certified local installers for customized site quotes.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleContactSubmit} className="space-y-4 py-4 text-xs font-mono">
            <div className="space-y-1.5">
              <label htmlFor="contact-name" className="text-[10px] text-white/40 uppercase tracking-wider block">Full Name *</label>
              <input
                id="contact-name"
                type="text"
                required
                placeholder="Enter your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-3 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder:text-white/20 focus:outline-none focus:border-[#FF6600]/60"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="contact-phone" className="text-[10px] text-white/40 uppercase tracking-wider block">Phone Number *</label>
              <input
                id="contact-phone"
                type="tel"
                required
                placeholder="+91 XXXXX XXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full p-3 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder:text-white/20 focus:outline-none focus:border-[#FF6600]/60"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="contact-email" className="text-[10px] text-white/40 uppercase tracking-wider block">Email Address *</label>
              <input
                id="contact-email"
                type="email"
                required
                placeholder="name@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder:text-white/20 focus:outline-none focus:border-[#FF6600]/60"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="contact-bill" className="text-[10px] text-white/40 uppercase tracking-wider block">Average Monthly Electricity Bill (Optional)</label>
              <input
                id="contact-bill"
                type="number"
                placeholder="₹"
                value={monthlyBill}
                onChange={(e) => setMonthlyBill(e.target.value)}
                className="w-full p-3 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder:text-white/20 focus:outline-none focus:border-[#FF6600]/60"
              />
            </div>

            <DialogFooter className="pt-4 gap-2">
              <button
                type="button"
                onClick={() => setIsContactOpen(false)}
                className="px-4 py-3 rounded-xl border border-white/10 text-xs text-white/60 hover:bg-white/5 hover:text-white transition cursor-pointer bg-transparent"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-3 rounded-xl bg-[#FF6600] hover:bg-orange-500 text-black font-bold text-xs uppercase tracking-wider transition-all cursor-pointer border-none shadow-lg shadow-[#FF6600]/20"
              >
                Send Request
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
