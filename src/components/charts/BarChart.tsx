/**
 * BarChart — visx-powered bar chart to replace recharts BarChart.
 */
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
} from "react";
import { ParentSize } from "@visx/responsive";
import { scaleLinear, scaleBand } from "@visx/scale";
import { Bar as VisxBar } from "@visx/shape";
import { GridRows } from "@visx/grid";
import { LinearGradient } from "@visx/gradient";
import { localPoint } from "@visx/event";
import { max } from "d3-array";
import { motion } from "framer-motion";

// ─── context ─────────────────────────────────────────────────────────────────
interface BarChartCtx {
  width: number;
  height: number;
  margin: { top: number; right: number; bottom: number; left: number };
  data: Record<string, unknown>[];
  xDataKey: string;
  xScale: ReturnType<typeof scaleBand>;
  yScale: ReturnType<typeof scaleLinear>;
  innerWidth: number;
  innerHeight: number;
  tooltip: { barIndex: number; x: number; y: number } | null;
  setTooltip: (t: { barIndex: number; x: number; y: number } | null) => void;
}

const BarCtx = createContext<BarChartCtx | null>(null);
const useBarChart = () => {
  const c = useContext(BarCtx);
  if (!c) throw new Error("Must be inside BarChart");
  return c;
};

// ─── BarChart root ────────────────────────────────────────────────────────────
interface BarChartProps {
  data: Record<string, unknown>[];
  xDataKey?: string;
  margin?: { top?: number; right?: number; bottom?: number; left?: number };
  width?: number;
  height?: number;
  className?: string;
  children: React.ReactNode;
}

export function BarChartComp({
  data,
  xDataKey = "date",
  margin: marginProp,
  width: fixedWidth,
  height: fixedHeight,
  className,
  children,
}: BarChartProps) {
  const margin = {
    top: marginProp?.top ?? 16,
    right: marginProp?.right ?? 16,
    bottom: marginProp?.bottom ?? 36,
    left: marginProp?.left ?? 12,
  };
  const [tooltip, setTooltip] = useState<{
    barIndex: number;
    x: number;
    y: number;
  } | null>(null);

  const render = (width: number, rawHeight: number) => {
    const height = rawHeight > 50 ? rawHeight : (fixedHeight ?? 240);
    const innerWidth = Math.max(100, width - margin.left - margin.right);
    const innerHeight = Math.max(100, height - margin.top - margin.bottom);

    const keys = data.map((d) => String(d[xDataKey]));
    const xScale = scaleBand({ range: [0, innerWidth], domain: keys, padding: 0.3 });

    // collect all bar series keys
    const seriesKeys: string[] = [];
    React.Children.forEach(children, (child) => {
      if (React.isValidElement(child) && child.props.dataKey) {
        seriesKeys.push(child.props.dataKey);
      }
    });
    const allVals = data.flatMap((d) =>
      seriesKeys.map((k) => Number(d[k] ?? 0))
    );
    const yScale = scaleLinear({
      range: [innerHeight, 0],
      domain: [0, (max(allVals) ?? 1) * 1.15],
      nice: true,
    });

    const ctx: BarChartCtx = {
      width,
      height,
      margin,
      data,
      xDataKey,
      xScale,
      yScale,
      innerWidth,
      innerHeight,
      tooltip,
      setTooltip,
    };

    return (
      <BarCtx.Provider value={ctx}>
        <svg
          width={width}
          height={height}
          className="overflow-visible"
          onMouseLeave={() => setTooltip(null)}
        >
          <g transform={`translate(${margin.left},${margin.top})`}>
            {children}
          </g>
        </svg>
      </BarCtx.Provider>
    );
  };

  if (fixedWidth && fixedHeight) {
    return (
      <div className={className} style={{ width: fixedWidth, height: fixedHeight }}>
        {render(fixedWidth, fixedHeight)}
      </div>
    );
  }
  return (
    <div className={`w-full h-full min-h-[200px] ${className ?? ""}`}>
      <ParentSize>{({ width, height }) => render(width || 400, height || 240)}</ParentSize>
    </div>
  );
}

// ─── Grid (reused from bar context) ──────────────────────────────────────────
export function BarGrid({ stroke = "rgba(255,255,255,0.06)" }: { stroke?: string }) {
  const { yScale, innerWidth } = useBarChart();
  return <GridRows scale={yScale} width={innerWidth} numTicks={5} stroke={stroke} strokeDasharray="3,4" />;
}

// ─── XAxis ───────────────────────────────────────────────────────────────────
export function BarXAxis({
  tickFormatter,
  stroke = "rgba(255,255,255,0.35)",
  fontSize = 10,
}: {
  tickFormatter?: (v: string) => string;
  stroke?: string;
  fontSize?: number;
}) {
  const { xScale, innerHeight, data, xDataKey } = useBarChart();
  return (
    <g transform={`translate(0,${innerHeight})`}>
      {data.map((d, i) => {
        const key = String(d[xDataKey]);
        const x = (xScale(key) ?? 0) + xScale.bandwidth() / 2;
        const label = tickFormatter ? tickFormatter(key) : key;
        return (
          <text
            key={i}
            x={x}
            y={0}
            dy="1.2em"
            textAnchor="middle"
            fill={stroke}
            fontSize={fontSize}
            fontFamily="monospace"
          >
            {label}
          </text>
        );
      })}
    </g>
  );
}

// ─── YAxis ───────────────────────────────────────────────────────────────────
export function BarYAxis({
  tickFormatter,
  stroke = "rgba(255,255,255,0.35)",
  fontSize = 10,
}: {
  tickFormatter?: (v: number) => string;
  stroke?: string;
  fontSize?: number;
}) {
  const { yScale } = useBarChart();
  const ticks = yScale.ticks(5);
  return (
    <g>
      {ticks.map((tick, i) => (
        <text
          key={i}
          x={-6}
          y={yScale(tick)}
          dy="0.35em"
          textAnchor="end"
          fill={stroke}
          fontSize={fontSize}
          fontFamily="monospace"
        >
          {tickFormatter ? tickFormatter(tick) : String(Math.round(tick))}
        </text>
      ))}
    </g>
  );
}

// ─── Bar ─────────────────────────────────────────────────────────────────────
interface BarProps {
  dataKey: string;
  fill?: string;
  radius?: [number, number, number, number];
  /** per-bar fill override array */
  fills?: string[];
  opacity?: number;
  barSize?: number;
}

export function Bar({ dataKey, fill = "#FF6600", radius, fills, opacity = 1, barSize }: BarProps) {
  const { data, xDataKey, xScale, yScale, innerHeight, setTooltip } = useBarChart();
  const bw = barSize ?? xScale.bandwidth();

  return (
    <g>
      {data.map((d, i) => {
        const key = String(d[xDataKey]);
        const xPos = (xScale(key) ?? 0) + (xScale.bandwidth() - bw) / 2;
        const yVal = Number(d[dataKey] ?? 0);
        const barHeight = innerHeight - yScale(yVal);
        const barFill = fills ? fills[i % fills.length] : fill;
        const rx = radius?.[0] ?? 6;

        return (
          <motion.rect
            key={i}
            x={xPos}
            width={bw}
            y={yScale(yVal)}
            height={barHeight}
            fill={barFill}
            opacity={opacity}
            rx={rx}
            ry={rx}
            initial={{ height: 0, y: innerHeight }}
            animate={{ height: barHeight, y: yScale(yVal) }}
            transition={{ delay: i * 0.04, duration: 0.6, ease: "easeOut" }}
            onMouseEnter={() =>
              setTooltip({ barIndex: i, x: xPos + bw / 2, y: yScale(yVal) })
            }
            onMouseLeave={() => setTooltip(null)}
          />
        );
      })}
    </g>
  );
}

// ─── Cell (for per-bar coloring, recharts compat) ────────────────────────────
export function Cell({ fill }: { fill?: string; key?: string }) {
  // Used declaratively in recharts; in our impl, fills are passed to Bar
  return null;
}

// ─── BarChartTooltip ──────────────────────────────────────────────────────────
export function BarChartTooltip({
  contentStyle,
  labelStyle,
  formatter,
}: {
  contentStyle?: React.CSSProperties;
  labelStyle?: React.CSSProperties;
  formatter?: (v: unknown, key: string) => [string, string];
}) {
  const { tooltip, data, xDataKey, margin } = useBarChart();
  if (!tooltip) return null;
  const point = data[tooltip.barIndex];
  const label = String(point[xDataKey]);

  return (
    <foreignObject
      x={tooltip.x + margin.left - 80}
      y={tooltip.y + margin.top - 10}
      width={160}
      height={80}
      style={{ overflow: "visible" }}
    >
      <div
        style={{ all: "initial", ...contentStyle }}
        className="font-mono text-[11px] bg-[#0A0A0A] border border-white/15 rounded-2xl p-3 shadow-2xl text-white"
      >
        <div className="font-bold text-[#FF6600] mb-1 text-[10px]" style={labelStyle}>{label}</div>
        {Object.entries(point)
          .filter(([k]) => k !== xDataKey)
          .map(([k, v]) => {
            const [val, name] = formatter ? formatter(v, k) : [String(v), k];
            return (
              <div key={k} className="flex justify-between gap-2">
                <span className="text-white/60">{name}</span>
                <span className="font-bold">{val}</span>
              </div>
            );
          })}
      </div>
    </foreignObject>
  );
}
