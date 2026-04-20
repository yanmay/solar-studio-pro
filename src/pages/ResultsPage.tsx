import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  Square,
  Zap,
  IndianRupee,
  Leaf,
  AlertTriangle,
  MapPin,
  TreeDeciduous,
  RefreshCw,
  ArrowRight,
  TrendingDown,
  Wallet,
  Calendar,
  BadgePercent,
  Share2,
  PhoneCall,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ThemeToggle";
import MetricCard from "@/components/MetricCard";
import { useEffect, useState, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import type { SolarAnalysis } from "@/lib/solar-calc";
import { generatePDFReport } from "@/lib/pdf-generator";
import LeadCaptureForm from "@/components/LeadCaptureForm";
import InstallerMarketplace from "@/components/InstallerMarketplace";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface FullResult extends SolarAnalysis {
  location?: {
    lat: number;
    lng: number;
    label: string;
  };
  panelCount?: number;
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_KEYS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

// ─── Animated count-up hook ─────────────────────────────────
function useCountUp(target: number, duration: number = 1200, delay: number = 0): number {
  const [value, setValue] = useState(0);
  const startTimeRef = useRef<number>(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      startTimeRef.current = performance.now();

      const animate = (now: number) => {
        const elapsed = now - startTimeRef.current;
        const progress = Math.min(elapsed / duration, 1);
        // Ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(Math.round(target * eased));

        if (progress < 1) {
          rafRef.current = requestAnimationFrame(animate);
        } else {
          setValue(target);
        }
      };

      rafRef.current = requestAnimationFrame(animate);
    }, delay);

    return () => {
      clearTimeout(timeoutId);
      cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, delay]);

  return value;
}

// ─── Before/After Comparison Component ──────────────────────
function SavingsComparison({ annualBill, annualSavings, annualWithSolar }: {
  annualBill: number;
  annualSavings: number;
  annualWithSolar: number;
}) {
  const savingsPercent = Math.round((annualSavings / annualBill) * 100);
  const animatedBill = useCountUp(annualBill, 1200, 200);
  const animatedWithSolar = useCountUp(annualWithSolar, 1200, 400);
  const animatedPercent = useCountUp(savingsPercent, 1000, 600);

  return (
    <div className="bg-sunpower-bg-card rounded-2xl shadow-card p-5 sm:p-8 mb-8 hover:shadow-float transition-shadow duration-300" role="region" aria-label="Before and after savings comparison">
      <div className="flex items-center gap-2 mb-6">
        <TrendingDown className="w-5 h-5 text-sunpower-success" aria-hidden="true" />
        <h2 className="text-xl font-medium text-sunpower-text-primary">Your Savings at a Glance</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
        {/* Without Solar */}
        <div className="bg-gradient-to-br from-destructive/10 to-destructive/5 border border-destructive/10 rounded-2xl p-5 text-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]">
          <div className="text-xs font-medium text-destructive/70 uppercase tracking-wider mb-2">Without Solar</div>
          <div className="font-mono text-2xl sm:text-3xl font-semibold text-destructive">
            ₹{animatedBill.toLocaleString()}
          </div>
          <div className="text-xs text-sunpower-text-muted mt-1">per year</div>
        </div>

        {/* Arrow + savings pill */}
        <div className="flex flex-col items-center gap-2 py-2">
          <div className="w-10 h-10 rounded-full bg-sunpower-success/10 flex items-center justify-center">
            <ArrowRight className="w-5 h-5 text-sunpower-success" />
          </div>
          <div className="bg-gradient-to-r from-sunpower-success to-emerald-500 text-white text-sm font-semibold px-4 py-1.5 rounded-full shadow-md">
            Save {animatedPercent}%
          </div>
          <div className="text-xs text-sunpower-text-muted">
            ₹{annualSavings.toLocaleString()}/year saved
          </div>
        </div>

        {/* With Solar */}
        <div className="bg-gradient-to-br from-sunpower-success/15 to-sunpower-success/5 border border-sunpower-success/20 rounded-2xl p-5 text-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
          <div className="text-xs font-medium text-sunpower-success/70 uppercase tracking-wider mb-2">With Solar</div>
          <div className="font-mono text-2xl sm:text-3xl font-semibold text-sunpower-success">
            ₹{animatedWithSolar.toLocaleString()}
          </div>
          <div className="text-xs text-sunpower-text-muted mt-1">per year</div>
        </div>
      </div>

      {/* Visual comparison bar */}
      <div className="mt-6 space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-xs text-sunpower-text-muted w-20 text-right shrink-0">Current bill</span>
          <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-red-400 to-red-500 rounded-full transition-all duration-1000" style={{ width: "100%" }} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-sunpower-text-muted w-20 text-right shrink-0">With solar</span>
          <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-1500 ease-out"
              style={{ width: `${100 - savingsPercent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Results Page
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const ResultsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [data, setData] = useState<FullResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [noData, setNoData] = useState(false);
  const [leadFormOpen, setLeadFormOpen] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem("sunpower-results");
    if (stored) {
      try {
        setData(JSON.parse(stored));
      } catch {
        setNoData(true);
        return;
      }
    } else {
      setNoData(true);
      return;
    }
    setTimeout(() => setLoading(false), 500);
  }, []);

  const handleBackToMap = () => navigate("/map");

  const handleNewAnalysis = () => {
    sessionStorage.removeItem("sunpower-results");
    navigate("/map");
  };

  const handleWhatsAppShare = () => {
    if (!data) return;
    const loc = data.location?.label || "my rooftop";
    const text =
      `☀️ My Solar Potential Report — SUNPOWER LINK\n\n` +
      `📍 Location: ${loc}\n` +
      `🏠 Roof area: ${data.rooftop.drawnAreaM2} m²\n` +
      `⚡ System size: ${data.energy.installedCapacityKw} kWp\n` +
      `🔋 Annual generation: ${data.energy.annualKwh.toLocaleString()} kWh\n` +
      `💰 Yearly savings: ₹${data.financials.annualSavingsInr.toLocaleString()}\n` +
      (data.investment ? `💸 You pay (after PM Surya Ghar subsidy): ₹${data.investment.netCostInr.toLocaleString()}\n` : "") +
      (data.investment ? `📅 Payback: ${data.investment.paybackYears} years\n` : "") +
      `🌳 CO₂ saved/yr: ${data.environmental.co2AnnualKg.toLocaleString()} kg\n\n` +
      `Calculate yours: ${window.location.origin}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleDownload = () => {
    if (!data) return;
    setDownloading(true);
    setDownloadError(null);

    try {
      generatePDFReport(data, {
        locationLabel: data.location?.label || "India",
      });

      toast({ title: "Report Downloaded", description: "Your solar analysis report has been saved." });
    } catch (error) {
      const msg = (error as Error).message === "REPORT_TIMEOUT"
        ? "Report generation timed out. Please try again."
        : "Failed to generate report. Please try again.";
      setDownloadError(msg);
      toast({ title: "Download Failed", description: msg, variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  if (noData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4" role="main">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-sunpower-accent/10 flex items-center justify-center mx-auto mb-4">
            <MapPin className="w-8 h-8 text-sunpower-accent" />
          </div>
          <h1 className="font-display text-2xl text-sunpower-text-primary mb-2">No Analysis Found</h1>
          <p className="text-sunpower-text-secondary mb-6">Draw your rooftop on the map first to generate a solar potential analysis report.</p>
          <Button variant="cta" onClick={() => navigate("/map")}>Go to Map →</Button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // ── Before/after data ──────────────────────────────────
  // Assume average Indian household: 300 kWh/month baseline usage
  const estimatedMonthlyUsageKwh = Math.max(data.energy.monthlyKwh * 1.2, 300);
  const annualBill = Math.round(estimatedMonthlyUsageKwh * 12 * data.financials.electricityRateInr);
  const annualWithSolar = Math.max(0, annualBill - data.financials.annualSavingsInr);

  // ── Monthly chart ──────────────────────────────────────
  const hasMonthlyData = data.monthlyIrradiance && Object.keys(data.monthlyIrradiance).length > 0;
  const monthlyChartData = hasMonthlyData
    ? MONTH_KEYS.map((key, i) => ({
        label: MONTH_LABELS[i],
        psh: data.monthlyIrradiance?.[key] ?? 0,
        kwh: Math.round(
          (data.energy.installedCapacityKw *
            (data.monthlyIrradiance?.[key] ?? data.energy.peakSunHoursDaily) *
            (i === 1 ? 28 : [3, 5, 8, 10].includes(i) ? 30 : 31) *
            0.86 * 10) / 10
        ),
      }))
    : null;
  const maxKwh = monthlyChartData ? Math.max(...monthlyChartData.map((d) => d.kwh)) : 0;

  return (
    <div className="min-h-screen bg-background" role="main" aria-label="Solar analysis results">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-8">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl gradient-text leading-tight">Solar Potential Analysis</h1>
            {data.location?.label && (
              <div className="flex items-center gap-2 mt-1.5" aria-label={`Location: ${data.location.label}`}>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sunpower-success opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sunpower-success" />
                </span>
                <span className="text-sm text-sunpower-text-secondary flex items-center gap-1">
                  <MapPin className="w-3 h-3" aria-hidden="true" />
                  {data.location.label}
                </span>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
              <span className="text-xs text-sunpower-text-muted">ID: {data.analysisId}</span>
              <span className="text-xs text-sunpower-text-muted">•</span>
              <span className="text-xs text-sunpower-text-muted">Source: {data.irradianceSource === "NASA_POWER" ? "NASA POWER Satellite" : "Regional Lookup"}</span>
              {data.panelCount && data.panelCount > 0 && (
                <>
                  <span className="text-xs text-sunpower-text-muted">•</span>
                  <span className="text-xs text-sunpower-info font-medium">{data.panelCount} panels</span>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <ThemeToggle />
            <Button variant="ghost" onClick={handleBackToMap} aria-label="Go back to map" className="flex-1 sm:flex-none justify-center">
              <ArrowLeft className="w-4 h-4 mr-1 shrink-0" aria-hidden="true" />
              <span>Back <span className="hidden sm:inline">to Map</span></span>
            </Button>
            <Button
              variant="ghost"
              onClick={handleWhatsAppShare}
              aria-label="Share on WhatsApp"
              className="flex-1 sm:flex-none justify-center bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366]"
            >
              <Share2 className="w-4 h-4 mr-1 shrink-0" aria-hidden="true" />
              <span className="sm:inline">Share</span>
            </Button>
            <Button variant="cta" onClick={handleDownload} loading={downloading} aria-label="Download PDF report" className="flex-1 sm:flex-none justify-center">
              <Download className="w-4 h-4 mr-1 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">Download Report</span>
              <span className="sm:hidden">Download</span>
            </Button>
          </div>
        </header>

        {downloadError && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive flex items-center gap-2" role="alert">
            <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="flex-1">{downloadError}</span>
            <Button variant="ghost" size="sm" onClick={handleDownload}>Retry</Button>
          </div>
        )}

        {/* 4-Card Summary Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8" role="region" aria-label="Key metrics summary">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-sunpower-bg-card rounded-lg shadow-card p-5 animate-pulse" aria-hidden="true">
                <div className="flex items-center gap-3 mb-3"><div className="w-9 h-9 rounded-md bg-muted" /><div className="h-4 w-20 bg-muted rounded" /></div>
                <div className="h-8 w-28 bg-muted rounded mb-2" /><div className="h-3 w-24 bg-muted rounded" />
              </div>
            ))
          ) : (
            <>
              <MetricCard icon={<Square className="w-5 h-5 text-sunpower-info" />} iconBg="hsl(211 68% 94%)" label="Roof Area" value={`${data.rooftop.drawnAreaM2} m²`} subLabel={`Usable: ${data.rooftop.usableAreaM2} m² (75%)`} valueColor="hsl(211 79% 42%)" delay={0} />
              <MetricCard icon={<Zap className="w-5 h-5" style={{ color: "#E65100" }} />} iconBg="#FFF3E0" label="Installed Capacity" value={`${data.energy.installedCapacityKw} kWp`} subLabel={`Annual: ${data.energy.annualKwh.toLocaleString()} kWh`} valueColor="#E65100" delay={80} />
              <MetricCard icon={<IndianRupee className="w-5 h-5 text-sunpower-success" />} iconBg="hsl(88 44% 91%)" label="Yearly Savings" value={`₹${data.financials.annualSavingsInr.toLocaleString()}`} subLabel={`@ ₹${data.financials.electricityRateInr}/kWh rate`} valueColor="hsl(122 46% 33%)" delay={160} />
              <MetricCard icon={<Leaf className="w-5 h-5 text-sunpower-success" />} iconBg="hsl(88 44% 91%)" label="CO₂ Saved" value={`${data.environmental.co2AnnualKg.toLocaleString()} kg`} subLabel="Environmental impact / year" valueColor="hsl(122 46% 33%)" delay={240} />
            </>
          )}
        </div>

        {/* ━━ Investment + Subsidy + Payback ━━━━━━━━━━━━━━━━ */}
        {!loading && data.investment && (
          <div className="bg-sunpower-bg-card rounded-2xl shadow-card p-5 sm:p-8 mb-8 hover:shadow-float transition-shadow duration-300" role="region" aria-label="Investment & payback">
            <div className="flex items-center gap-2 mb-5">
              <Wallet className="w-5 h-5 text-sunpower-accent" aria-hidden="true" />
              <h2 className="text-xl font-medium text-sunpower-text-primary">Investment & Payback</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
              {/* System cost */}
              <div className="rounded-xl bg-foreground/[0.03] border border-foreground/[0.06] p-4">
                <div className="flex items-center gap-2 text-xs text-sunpower-text-muted mb-1">
                  <Wallet className="w-3.5 h-3.5" /> System Cost (turn-key)
                </div>
                <div className="font-mono text-2xl font-semibold text-sunpower-text-primary">
                  ₹{data.investment.systemCostInr.toLocaleString()}
                </div>
                <div className="text-xs text-sunpower-text-muted mt-1">
                  ~₹{Math.round(data.investment.systemCostInr / data.energy.installedCapacityKw).toLocaleString()}/kW installed
                </div>
              </div>

              {/* Subsidy */}
              <div className="rounded-xl bg-gradient-to-br from-sunpower-success/10 to-sunpower-success/5 border border-sunpower-success/20 p-4">
                <div className="flex items-center gap-2 text-xs text-sunpower-success mb-1">
                  <BadgePercent className="w-3.5 h-3.5" /> PM Surya Ghar Subsidy
                </div>
                <div className="font-mono text-2xl font-semibold text-sunpower-success">
                  −₹{data.investment.subsidyInr.toLocaleString()}
                </div>
                <div className="text-xs text-sunpower-text-muted mt-1">
                  Govt of India direct benefit transfer
                </div>
              </div>

              {/* Net cost */}
              <div className="rounded-xl bg-gradient-to-br from-sunpower-accent/10 to-sunpower-accent/5 border border-sunpower-accent/20 p-4">
                <div className="flex items-center gap-2 text-xs text-sunpower-accent mb-1">
                  <IndianRupee className="w-3.5 h-3.5" /> You Pay
                </div>
                <div className="font-mono text-2xl font-semibold text-sunpower-accent">
                  ₹{data.investment.netCostInr.toLocaleString()}
                </div>
                <div className="text-xs text-sunpower-text-muted mt-1">
                  Net of subsidy
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-foreground/[0.06]">
              <div className="text-center">
                <div className="flex items-center gap-1.5 justify-center text-xs text-sunpower-text-muted mb-1">
                  <Calendar className="w-3.5 h-3.5" /> Payback Period
                </div>
                <div className="font-mono text-3xl font-semibold text-sunpower-accent">
                  {data.investment.paybackYears}
                  <span className="text-base font-normal text-sunpower-text-muted ml-1">years</span>
                </div>
              </div>
              <div className="text-center">
                <div className="flex items-center gap-1.5 justify-center text-xs text-sunpower-text-muted mb-1">
                  <TrendingDown className="w-3.5 h-3.5" /> 25-Year ROI
                </div>
                <div className="font-mono text-3xl font-semibold text-sunpower-success">
                  {data.investment.roi25yrPercent}%
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ━━ Before/After Savings Comparison ━━━━━━━━━━━━━━ */}
        {!loading && (
          <SavingsComparison
            annualBill={annualBill}
            annualSavings={data.financials.annualSavingsInr}
            annualWithSolar={annualWithSolar}
          />
        )}

        {/* System Details Panel */}
        <div className="bg-sunpower-bg-card rounded-2xl shadow-card p-5 sm:p-8 mb-8 hover:shadow-float transition-shadow duration-300" role="region" aria-label="System details">
          <h2 className="text-xl font-medium text-sunpower-text-primary mb-6">System Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-5 h-5 text-sunpower-accent" aria-hidden="true" />
                <span className="text-[15px] font-medium text-sunpower-text-primary">Energy Production</span>
              </div>
              {[
                { label: "Peak Sun Hours", value: `${data.energy.peakSunHoursDaily} hrs/day` },
                { label: "Daily Average", value: `${data.energy.dailyKwh} kWh` },
                { label: "Monthly Average", value: `${data.energy.monthlyKwh.toLocaleString()} kWh` },
                { label: "Annual Total", value: `${data.energy.annualKwh.toLocaleString()} kWh` },
              ].map((row, i, arr) => (
                <div key={row.label} className={`flex justify-between items-center py-3 ${i < arr.length - 1 ? "border-b border-dashed border-foreground/[0.08]" : ""}`}>
                  <span className="text-sm text-sunpower-text-secondary">{row.label}</span>
                  <span className="font-mono font-medium text-sunpower-text-primary">{row.value}</span>
                </div>
              ))}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-4">
                <IndianRupee className="w-5 h-5 text-sunpower-success" aria-hidden="true" />
                <span className="text-[15px] font-medium text-sunpower-text-primary">Financial Impact</span>
              </div>
              {[
                { label: "Electricity Rate", value: `₹${data.financials.electricityRateInr}/kWh` },
                { label: "Monthly Savings", value: `₹${data.financials.monthlySavingsInr.toLocaleString()}` },
                { label: "Annual Savings", value: `₹${data.financials.annualSavingsInr.toLocaleString()}` },
                { label: "25-Year Savings", value: `₹${data.financials.savings25yrInr.toLocaleString()}`, highlight: true },
              ].map((row, i, arr) => (
                <div key={row.label} className={`flex justify-between items-center py-3 ${row.highlight ? "bg-sunpower-success-light rounded-md px-3 -mx-3 mt-1" : i < arr.length - 1 ? "border-b border-dashed border-foreground/[0.08]" : ""}`}>
                  <span className={`text-sm ${row.highlight ? "font-medium text-sunpower-success" : "text-sunpower-text-secondary"}`}>{row.label}</span>
                  <span className={`font-mono font-medium ${row.highlight ? "text-sunpower-success text-lg" : "text-sunpower-success"}`}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Monthly Generation Chart */}
        {monthlyChartData && (
          <div className="bg-sunpower-bg-card rounded-2xl shadow-card p-5 sm:p-8 mb-8 hover:shadow-float transition-shadow duration-300" role="region" aria-label="Monthly energy generation chart">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-xl font-medium text-sunpower-text-primary">Monthly Generation Estimate</h2>
              <div className="text-sm font-mono text-sunpower-accent font-semibold">
                {data.energy.annualKwh.toLocaleString()} kWh/yr
              </div>
            </div>
            <p className="text-sm text-sunpower-text-muted mb-4">Estimated monthly energy output based on NASA satellite irradiance data</p>
            <div className="w-full h-[220px] sm:h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={monthlyChartData}
                  margin={{ top: 10, right: 4, left: -20, bottom: 0 }}
                  barCategoryGap="16%"
                >
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(38, 92%, 55%)" stopOpacity={1} />
                      <stop offset="100%" stopColor="hsl(30, 85%, 48%)" stopOpacity={0.7} />
                    </linearGradient>
                    <linearGradient id="barGradientHigh" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(38, 95%, 60%)" stopOpacity={1} />
                      <stop offset="100%" stopColor="hsl(30, 90%, 52%)" stopOpacity={0.85} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 6"
                    vertical={false}
                    stroke="var(--foreground)"
                    strokeOpacity={0.06}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "var(--sunpower-text-muted, #94a3b8)", fontSize: 11, fontWeight: 500 }}
                    tickLine={false}
                    axisLine={{ stroke: "var(--foreground)", strokeOpacity: 0.08 }}
                  />
                  <YAxis
                    tick={{ fill: "var(--sunpower-text-muted, #94a3b8)", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--foreground)", fillOpacity: 0.04 }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-sunpower-bg-card border border-foreground/10 rounded-lg shadow-float px-4 py-3 min-w-[140px]">
                          <div className="text-xs text-sunpower-text-muted font-medium mb-1">{d.label}</div>
                          <div className="text-lg font-mono font-semibold text-sunpower-accent">{d.kwh.toLocaleString()} kWh</div>
                          <div className="text-[10px] text-sunpower-text-muted mt-1">Peak Sun: {d.psh.toFixed(2)} hrs/day</div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="kwh" radius={[4, 4, 0, 0]} animationDuration={1200} animationEasing="ease-out">
                    {monthlyChartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.kwh === maxKwh ? "url(#barGradientHigh)" : "url(#barGradient)"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-4 mt-3 text-xs text-sunpower-text-muted">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "hsl(38, 92%, 55%)" }} />
                kWh / month
              </span>
              <span>•</span>
              <span>Hover bars for details</span>
            </div>
          </div>
        )}

        {/* Environmental Impact Card */}
        <div className="bg-gradient-to-br from-sunpower-success-light to-sunpower-success/10 border border-sunpower-success/20 rounded-2xl p-5 sm:p-8 hover:shadow-float transition-shadow duration-300" role="region" aria-label="Environmental impact">
          <div className="flex items-center gap-2 mb-3">
            <Leaf className="w-5 h-5 text-sunpower-success" aria-hidden="true" />
            <h2 className="text-xl font-medium text-sunpower-text-primary">Environmental Impact</h2>
          </div>
          <p className="text-[15px] text-sunpower-text-secondary mb-6">
            Your solar installation will offset approximately{" "}
            <span className="font-semibold text-sunpower-success">{data.environmental.co2AnnualKg.toLocaleString()} kg</span>{" "}
            of CO₂ per year, equivalent to planting{" "}
            <span className="font-semibold text-sunpower-success">{data.environmental.treesEquivalent}</span> trees over 25 years.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="text-center sm:text-left">
              <div className="text-sm text-sunpower-text-secondary mb-1">Annual CO₂ Reduction</div>
              <div className="font-mono text-2xl font-semibold text-sunpower-success">{data.environmental.co2AnnualKg.toLocaleString()} kg</div>
            </div>
            <div className="text-center sm:text-left">
              <div className="text-sm text-sunpower-text-secondary mb-1">25-Year CO₂ Reduction</div>
              <div className="font-mono text-2xl font-semibold text-sunpower-success">{data.environmental.co2_25yrKg.toLocaleString()} kg</div>
            </div>
            <div className="text-center sm:text-left">
              <div className="text-sm text-sunpower-text-secondary mb-1 flex items-center gap-1 justify-center sm:justify-start">
                <TreeDeciduous className="w-3.5 h-3.5" aria-hidden="true" /> Equivalent Trees
              </div>
              <div className="font-mono text-2xl font-semibold text-sunpower-success">{data.environmental.treesEquivalent} trees</div>
            </div>
          </div>
        </div>

        {/* Source note */}
        <div className="mt-6 text-center text-xs text-sunpower-text-muted">
          Data source: {data.irradianceSource === "NASA_POWER" ? "NASA POWER API (satellite-derived irradiance)" : "Regional PSH lookup table (MNRE)"}{" "}
          · System losses: 14% · Usable area: 75% of drawn area
        </div>

        {/* ━━ Lead capture CTA card ━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {!loading && (
          <div className="mt-8 bg-gradient-to-br from-sunpower-accent to-orange-600 rounded-2xl p-6 sm:p-8 shadow-float text-center text-white">
            <div className="max-w-xl mx-auto">
              <div className="inline-flex items-center gap-2 bg-white/15 px-3 py-1 rounded-full text-xs font-medium mb-3">
                <CheckCircle2 className="w-3.5 h-3.5" /> Verified MNRE installers
              </div>
              <h2 className="font-display text-2xl sm:text-3xl mb-2 leading-tight">
                Ready to install? Get a free quote.
              </h2>
              <p className="text-sm sm:text-base text-white/90 mb-5 max-w-md mx-auto">
                A solar installer in your city will call you within 24 hours with a
                tailored quote — including PM Surya Ghar paperwork.
              </p>
              <button
                onClick={() => setLeadFormOpen(true)}
                className="inline-flex items-center gap-2 bg-white text-sunpower-accent font-semibold px-6 py-3 rounded-full hover:bg-white/95 active:scale-95 transition-all shadow-lg"
              >
                <PhoneCall className="w-4 h-4" />
                Talk to an installer →
              </button>
              <div className="text-xs text-white/70 mt-3">No spam · No obligation · Your number stays private</div>
            </div>
          </div>
        )}

        {/* Installer marketplace */}
        {!loading && (
          <InstallerMarketplace
            installedKw={data.energy.installedCapacityKw}
            city={data.location?.label?.split(",")[0]?.trim()}
          />
        )}

        {/* Analyze Another Roof */}
        <div className="mt-8 text-center border-t border-foreground/[0.06] pt-8 pb-4">
          <Button variant="ghost" className="text-sunpower-accent hover:text-sunpower-accent-hover" onClick={handleNewAnalysis} aria-label="Analyze another rooftop">
            <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
            Analyze Another Roof
          </Button>
        </div>
      </div>

      {/* Lead capture modal */}
      <LeadCaptureForm
        open={leadFormOpen}
        onOpenChange={setLeadFormOpen}
        context={{
          analysisId: data.analysisId,
          kw: data.energy.installedCapacityKw,
          location: data.location?.label,
        }}
      />
    </div>
  );
};

export default ResultsPage;
