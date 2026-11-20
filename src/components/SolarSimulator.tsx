import { useState, useEffect, useRef } from "react";
import { TrendingUp, Clock, Wallet, Loader2, Sun } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { GlassCard } from "@/components/GlassCard";
import { useScanStore } from "@/hooks/use-scan-store";
import { getDiscomRate } from "@/lib/discom-rates";
import { useToast } from "@/hooks/use-toast";
import {
  calcAnnualEnergy,
  calcAnnualSavings,
  calcSystemCost,
  calcSubsidyInr,
  calcPaybackYears,
  calcFinancials
} from "@/lib/solar-calc";
import { ELECTRICITY_RATE_INR } from "@/lib/solar-defaults";

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

export default function SolarSimulator() {
  const { fullAnalysis } = useScanStore();
  const { toast } = useToast();

  // Extract initial values from the scan report if available, otherwise default
  const defaultCapacity = fullAnalysis?.energy.installedCapacityKw || 5;
  const defaultRate = fullAnalysis?.financials.electricityRateInr || ELECTRICITY_RATE_INR;
  const defaultShading = fullAnalysis?.computedShadingLoss ? Math.round(fullAnalysis.computedShadingLoss * 100) : 10;
  const peakSunHours = fullAnalysis?.energy.peakSunHoursDaily || 5.0;

  // Slider States
  const [capacity, setCapacity] = useState(defaultCapacity);
  const [rate, setRate] = useState(defaultRate);
  const [shading, setShading] = useState(defaultShading);

  // Result States
  const [annualSavings, setAnnualSavings] = useState(0);
  const [paybackYears, setPaybackYears] = useState(0);
  const [totalSavings25Yr, setTotalSavings25Yr] = useState(0);
  const [calculating, setCalculating] = useState(false);

  // Reference state rate
  const stateLabel = fullAnalysis?.location?.label || "India";
  const stateName = fullAnalysis?.location?.label
    ? (fullAnalysis.location.label.split(",").slice(-2, -1)[0]?.trim() || "India")
    : "India";
  const stateRate = getDiscomRate(stateName) || ELECTRICITY_RATE_INR;

  // Debounced execution ref
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Run calculation logic
  const runSimulationCalculation = (capVal: number, rateVal: number, shadVal: number) => {
    setCalculating(true);
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      try {
        // Shading adjust maps 0%-40% to 0.0-0.4 shading loss factor
        const annualKwh = calcAnnualEnergy(capVal, peakSunHours, "auto", shadVal / 100);
        const savings = calcAnnualSavings(annualKwh, rateVal);
        const cost = calcSystemCost(capVal);
        const subsidy = calcSubsidyInr(capVal);
        const netCost = Math.max(0, cost - subsidy);
        
        const payback = calcPaybackYears(netCost, savings);
        const financials = calcFinancials(annualKwh, rateVal);

        setAnnualSavings(savings);
        setPaybackYears(payback);
        setTotalSavings25Yr(financials.yr25);
      } catch (err: any) {
        toast({
          title: "Calculation Error",
          description: err.message || "Failed to update financial estimates.",
          variant: "destructive"
        });
      } finally {
        setCalculating(false);
      }
    }, 150); // 150ms debounce
  };

  // Trigger calculations when sliders values stabilize
  useEffect(() => {
    runSimulationCalculation(capacity, rate, shading);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [capacity, rate, shading]);

  // Clean values for reference line calculation
  const rateMin = 4;
  const rateMax = 15;
  const stateRatePercent = Math.max(0, Math.min(100, ((stateRate - rateMin) / (rateMax - rateMin)) * 100));

  // Determine shading sun brightness icon class
  const getSunColor = () => {
    if (shading <= 10) return "text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]";
    if (shading <= 25) return "text-amber-600 opacity-80";
    return "text-neutral-600 opacity-50";
  };

  return (
    <GlassCard className="w-full p-6 md:p-8 bg-white/5 border border-white/10 rounded-2xl">
      <div className="flex flex-col gap-6">
        
        {/* Header Title with loading status */}
        <div className="flex justify-between items-center pb-4 border-b border-white/5">
          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">Interactive Tool</span>
            <h2 className="text-xl font-display font-medium text-white tracking-tight">
              Solar Financial <span className="text-[#FF6600] font-serif italic">Simulator</span>
            </h2>
          </div>
          {calculating && (
            <div className="flex items-center gap-2 text-xs font-mono text-[#FF6600]">
              <Loader2 className="w-4 h-4 animate-spin text-[#FF6600]" />
              <span>Simulating...</span>
            </div>
          )}
        </div>

        {/* ── Desktop Row Layout / Mobile Stack ──────────────── */}
        <div className="flex flex-col lg:flex-row gap-8 items-stretch">
          
          {/* Sliders Container (w-1/2 on desktop) */}
          <div className="flex-1 flex flex-col gap-8">
            
            {/* A. System Size (kW) */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label htmlFor="sim-size" className="text-xs font-medium text-neutral-300">System Size</label>
                <span className="font-mono text-sm text-[#FFB800] font-bold">
                  {capacity.toFixed(1)} kW
                </span>
              </div>
              <div className="relative pt-1 px-1">
                <Slider
                  id="sim-size"
                  aria-label="System Size in Kilowatts"
                  min={1}
                  max={15}
                  step={0.5}
                  value={[capacity]}
                  onValueChange={(val) => setCapacity(val[0])}
                  className="cursor-pointer"
                />
                {/* Tooltip on active hover / slide */}
                <div 
                  style={{ left: `${((capacity - 1) / 14) * 100}%` }}
                  className="absolute -top-7 -translate-x-1/2 bg-[#FF6600] text-white text-[9px] font-mono px-1.5 py-0.5 rounded shadow opacity-0 group-hover/slider:opacity-100 transition-opacity pointer-events-none"
                >
                  {capacity} kW
                </div>
              </div>
              <div className="flex justify-between text-[9px] font-mono text-neutral-500">
                <span>1 kW</span>
                <span>8 kW</span>
                <span>15 kW</span>
              </div>
            </div>

            {/* B. Electricity Rate (₹/kWh) */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label htmlFor="sim-rate" className="text-xs font-medium text-neutral-300">Your Electricity Rate</label>
                <span className="font-mono text-sm text-[#FFB800] font-bold">
                  ₹{rate.toFixed(1)} / kWh
                </span>
              </div>
              <div className="relative pt-1 px-1">
                {/* State Average Reference Marker Line */}
                <div 
                  style={{ left: `${stateRatePercent}%` }}
                  className="absolute top-2 w-0.5 h-3 bg-[#FFB800] z-10 pointer-events-none group"
                  title={`${stateName} Average: ₹${stateRate}`}
                >
                  <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[8px] font-mono text-[#FFB800] whitespace-nowrap opacity-60 group-hover:opacity-100 transition-opacity">
                    Avg (₹{stateRate})
                  </span>
                </div>
                
                <Slider
                  id="sim-rate"
                  aria-label="Electricity tariff rate in Rupees per Kilowatt hour"
                  min={rateMin}
                  max={rateMax}
                  step={0.5}
                  value={[rate]}
                  onValueChange={(val) => setRate(val[0])}
                  className="cursor-pointer"
                />
                <div 
                  style={{ left: `${((rate - rateMin) / (rateMax - rateMin)) * 100}%` }}
                  className="absolute -top-7 -translate-x-1/2 bg-[#FF6600] text-white text-[9px] font-mono px-1.5 py-0.5 rounded shadow opacity-0 group-hover/slider:opacity-100 transition-opacity pointer-events-none"
                >
                  ₹{rate}
                </div>
              </div>
              <div className="flex justify-between text-[9px] font-mono text-neutral-500 pt-2">
                <span>₹{rateMin}</span>
                <span>₹10</span>
                <span>₹{rateMax}</span>
              </div>
            </div>

            {/* C. Shading Adjustment */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5">
                  <Sun className={`w-4 h-4 transition-all duration-300 ${getSunColor()}`} />
                  <label htmlFor="sim-shading" className="text-xs font-medium text-neutral-300">Shading/Loss Estimate</label>
                </div>
                <span className="font-mono text-sm text-[#FFB800] font-bold">
                  {shading}% Loss
                </span>
              </div>
              <div className="relative pt-1 px-1">
                <Slider
                  id="sim-shading"
                  aria-label="Shading and system power loss estimate percentage"
                  min={0}
                  max={40}
                  step={5}
                  value={[shading]}
                  onValueChange={(val) => setShading(val[0])}
                  className="cursor-pointer"
                />
                <div 
                  style={{ left: `${(shading / 40) * 100}%` }}
                  className="absolute -top-7 -translate-x-1/2 bg-[#FF6600] text-white text-[9px] font-mono px-1.5 py-0.5 rounded shadow opacity-0 group-hover/slider:opacity-100 transition-opacity pointer-events-none"
                >
                  {shading}%
                </div>
              </div>
              <div className="flex justify-between text-[9px] font-mono text-neutral-500">
                <span>0% (Full Sun)</span>
                <span>20% (Partial Shade)</span>
                <span>40% (Heavy Shade)</span>
              </div>
            </div>

          </div>

          {/* Results Cards (w-1/2 on desktop, stacks / sticky on mobile) */}
          <div className="flex-1 flex flex-col md:flex-row lg:flex-col gap-4 justify-between">
            
            {/* Card 1: Annual Savings */}
            <div className="flex-1 p-5 rounded-3xl border border-white/10 bg-[#0A0A0A]/90 backdrop-blur-2xl flex flex-col gap-2 relative overflow-hidden group hover:border-[#FF6600]/40 hover:shadow-[0_0_30px_rgba(255,102,0,0.15)] transition-all duration-300">
              <div className="absolute top-4 right-4 text-[#FF6600] bg-[#FF6600]/10 border border-[#FF6600]/20 p-2.5 rounded-2xl group-hover:scale-110 transition-transform">
                <TrendingUp className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-white/40">Annual Savings</span>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-emerald-400 mt-2 tracking-tight">
                <CountUp value={annualSavings} prefix="₹" suffix=" / yr" />
              </div>
              <span className="text-[10px] font-mono text-white/40 mt-1">Offset utility bill cash flow</span>
            </div>

            {/* Card 2: Payback Period */}
            <div className="flex-1 p-5 rounded-3xl border border-white/10 bg-[#0A0A0A]/90 backdrop-blur-2xl flex flex-col gap-2 relative overflow-hidden group hover:border-amber-500/40 hover:shadow-[0_0_30px_rgba(245,158,11,0.15)] transition-all duration-300">
              <div className="absolute top-4 right-4 text-amber-400 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-2xl group-hover:scale-110 transition-transform">
                <Clock className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-white/40">Payback Period</span>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-amber-400 mt-2 tracking-tight">
                <CountUp value={paybackYears} suffix=" Years" decimals={1} />
              </div>
              <span className="text-[10px] font-mono text-white/40 mt-1">CapEx amortization speed</span>
            </div>

            {/* Card 3: 25-Year Total */}
            <div className="flex-1 p-5 rounded-3xl border border-white/10 bg-[#0A0A0A]/90 backdrop-blur-2xl flex flex-col gap-2 relative overflow-hidden group hover:border-[#FF6600]/40 hover:shadow-[0_0_30px_rgba(255,102,0,0.15)] transition-all duration-300">
              <div className="absolute top-4 right-4 text-white bg-white/10 border border-white/15 p-2.5 rounded-2xl group-hover:scale-110 transition-transform">
                <Wallet className="w-4 h-4 text-[#FF6600]" />
              </div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-white/40">25-Year Total Dividend</span>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-white mt-2 tracking-tight">
                <CountUp value={totalSavings25Yr} prefix="₹" />
              </div>
              <span className="text-[10px] font-mono text-white/40 mt-1">Lifecycle system net dividend</span>
            </div>

          </div>

        </div>

      </div>
    </GlassCard>
  );
}
