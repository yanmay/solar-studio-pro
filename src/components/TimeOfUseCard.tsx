import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Grid,
  ChartTooltip,
} from "@/components/charts";
import { Clock, Lightbulb, TrendingUp, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { buildTimeOfUse } from "@/lib/time-of-use";

interface Props {
  dailyGenKwh: number;
  dailyLoadKwh?: number;
  lat?: number;
}

const TimeOfUseCard = ({ dailyGenKwh, dailyLoadKwh, lat }: Props) => {
  const load = dailyLoadKwh ?? dailyGenKwh; // Assume correctly-sized system: load == gen
  const result = useMemo(() => buildTimeOfUse(dailyGenKwh, load, lat ?? 20), [dailyGenKwh, load, lat]);

  const chartData = result.curve
    .filter((_, i) => i % 2 === 0) // Downsample to 30-min for chart readability
    .map((c) => ({
      hour: c.hour,
      label: `${Math.floor(c.hour).toString().padStart(2, "0")}:${(c.hour % 1) * 60 === 30 ? "30" : "00"}`,
      gen: c.genKwh * 2,    // back to kW (hourly rate) since we kept 30-min buckets
      load: c.loadKwh * 2,
      self: c.selfKwh * 2,
    }));

  // Find peak self-use window for reference shading
  const peakIdx = chartData.reduce((best, d, i) => (d.self > chartData[best].self ? i : best), 0);
  const peakStart = Math.max(0, peakIdx - 2);
  const peakEnd = Math.min(chartData.length - 1, peakIdx + 2);

  return (
    <div className="bg-[#0A0A0A]/90 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 sm:p-8 mb-8 text-white shadow-2xl hover:border-white/20 transition-all duration-300 relative overflow-hidden" role="region" aria-label="Time-of-use scheduling">
      {/* Top accent highlight */}
      <div
        className="absolute top-0 left-0 right-0 h-px rounded-t-3xl opacity-60 pointer-events-none"
        style={{ background: "linear-gradient(90deg, transparent, rgba(255,102,0,0.5), transparent)" }}
        aria-hidden="true"
      />

      <div className="flex items-center gap-2.5 mb-1.5">
        <div className="w-9 h-9 rounded-2xl bg-[#FF6600]/10 border border-[#FF6600]/20 text-[#FF6600] flex items-center justify-center">
          <Clock className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">When To Use Your Power</h2>
          <p className="text-xs text-white/50 font-light">
            24-hour load vs generation curve. Shift heavy appliances (AC, EV, Geyser) into peak hours.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-6">
        <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4">
          <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-emerald-400">
            <TrendingUp className="w-3.5 h-3.5" /> Self-Use Ratio
          </div>
          <div className="font-mono text-2xl font-bold text-emerald-400 mt-1">{result.selfConsumptionPct}%</div>
          <div className="text-[10px] font-mono text-white/40 mt-0.5">Of total solar generation</div>
        </div>

        <div className="rounded-2xl bg-sky-500/10 border border-sky-500/20 p-4">
          <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-sky-400">
            <ArrowUpFromLine className="w-3.5 h-3.5" /> Grid Export
          </div>
          <div className="font-mono text-2xl font-bold text-sky-400 mt-1">{result.gridExportKwh} kWh</div>
          <div className="text-[10px] font-mono text-white/40 mt-0.5">Surplus sent to DISCOM / day</div>
        </div>

        <div className="rounded-2xl bg-[#FF6600]/10 border border-[#FF6600]/20 p-4">
          <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-[#FF6600]">
            <ArrowDownToLine className="w-3.5 h-3.5" /> Grid Import
          </div>
          <div className="font-mono text-2xl font-bold text-[#FF6600] mt-1">{result.gridImportKwh} kWh</div>
          <div className="text-[10px] font-mono text-white/40 mt-0.5">Night/cloudy draw / day</div>
        </div>
      </div>

      {/* Chart */}
      <div className="w-full h-[230px] sm:h-[270px]">
        <AreaChart
          data={chartData}
          xDataKey="label"
          margin={{ top: 10, right: 4, bottom: 0, left: -24 }}
        >
          <Grid horizontal />
          <XAxis />
          <YAxis />
          <Area
            dataKey="gen"
            stroke="#FF6600"
            fill="#FF6600"
            fillOpacity={0.4}
            strokeWidth={2}
          />
          <Area
            dataKey="load"
            stroke="#38bdf8"
            fill="#38bdf8"
            fillOpacity={0.25}
            strokeWidth={2}
          />
          <ChartTooltip
            dataKeys={["gen", "load"]}
            colors={["#FF6600", "#38bdf8"]}
            formatter={(v, k) => [
              `${Number(v).toFixed(1)} kW`,
              k === "gen" ? "Solar Generation" : "Home Load",
            ]}
          />
        </AreaChart>
      </div>

      {/* Recommendation Footer */}
      <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-2 text-xs text-emerald-400 font-mono">
        <Lightbulb className="w-4 h-4 shrink-0 text-emerald-400" />
        <span>
          Optimal window: Run Heavy loads between {chartData[peakStart]?.label} – {chartData[peakEnd]?.label} for maximum self-consumption.
        </span>
      </div>
    </div>
  );
};

export default TimeOfUseCard;

