import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceArea,
} from "recharts";
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
    <div className="bg-sunpower-bg-card rounded-2xl shadow-card p-5 sm:p-8 mb-8 hover:shadow-float transition-shadow duration-300" role="region" aria-label="Time-of-use scheduling">
      <div className="flex items-center gap-2 mb-1">
        <Clock className="w-5 h-5 text-sunpower-accent" />
        <h2 className="text-xl font-medium text-sunpower-text-primary">When to use your power</h2>
      </div>
      <p className="text-sm text-sunpower-text-muted mb-5">
        24-hour forecast: generation vs typical home load. Run heavy appliances during the
        green overlap to maximize self-consumption.
      </p>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="rounded-xl bg-sunpower-success/10 border border-sunpower-success/20 p-3">
          <div className="flex items-center gap-1 text-[11px] text-sunpower-success"><TrendingUp className="w-3 h-3" /> Self-use</div>
          <div className="font-mono text-xl font-semibold text-sunpower-success">{result.selfConsumptionPct}%</div>
          <div className="text-[10px] text-sunpower-text-muted">of generation</div>
        </div>
        <div className="rounded-xl bg-sky-500/10 border border-sky-500/20 p-3">
          <div className="flex items-center gap-1 text-[11px] text-sky-500"><ArrowUpFromLine className="w-3 h-3" /> Export</div>
          <div className="font-mono text-xl font-semibold text-sky-500">{result.gridExportKwh} kWh</div>
          <div className="text-[10px] text-sunpower-text-muted">to grid / day</div>
        </div>
        <div className="rounded-xl bg-orange-500/10 border border-orange-500/20 p-3">
          <div className="flex items-center gap-1 text-[11px] text-orange-500"><ArrowDownToLine className="w-3 h-3" /> Import</div>
          <div className="font-mono text-xl font-semibold text-orange-500">{result.gridImportKwh} kWh</div>
          <div className="text-[10px] text-sunpower-text-muted">from grid / day</div>
        </div>
      </div>

      {/* Chart */}
      <div className="w-full h-[220px] sm:h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 4, left: -24, bottom: 0 }}>
            <defs>
              <linearGradient id="genGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(38, 92%, 55%)" stopOpacity={0.6} />
                <stop offset="100%" stopColor="hsl(38, 92%, 55%)" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="loadGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(0, 70%, 55%)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="hsl(0, 70%, 55%)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(0,0%,50%,0.12)" />
            <XAxis
              dataKey="label"
              interval={5}
              tick={{ fontSize: 10, fill: "hsl(0,0%,55%)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "hsl(0,0%,55%)" }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <ReferenceArea
              x1={chartData[peakStart]?.label}
              x2={chartData[peakEnd]?.label}
              fill="hsl(122,46%,40%)"
              fillOpacity={0.08}
              label={{ value: "Peak self-use", position: "top", fill: "hsl(122,46%,40%)", fontSize: 10 }}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(v: number, name: string) => [`${v.toFixed(2)} kW`, name]}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area type="monotone" dataKey="gen"  name="Generation" stroke="hsl(38, 92%, 55%)" fill="url(#genGrad)" strokeWidth={2} />
            <Area type="monotone" dataKey="load" name="Home load"  stroke="hsl(0, 70%, 55%)"  fill="url(#loadGrad)" strokeWidth={1.5} />
            <Area type="monotone" dataKey="self" name="Self-used"  stroke="hsl(122, 46%, 40%)" fill="hsl(122, 46%, 40%)" fillOpacity={0.35} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Suggestions */}
      <div className="mt-5 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-sunpower-text-primary mb-2">
          <Lightbulb className="w-4 h-4 text-amber-500" />
          Smart scheduling tips
        </div>
        {result.suggestions.map((s, i) => (
          <div key={i} className="text-xs text-sunpower-text-secondary leading-relaxed flex items-start gap-2 py-1 border-b border-foreground/[0.04] last:border-0">
            <span>{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TimeOfUseCard;
