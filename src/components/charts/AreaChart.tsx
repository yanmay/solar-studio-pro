/**
 * AreaChart — visx-powered area chart to replace recharts AreaChart.
 * Matches the core API surface used throughout this app.
 */
import React, {
  createContext,
  useContext,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { ParentSize } from "@visx/responsive";
import { scaleLinear, scaleTime, scaleBand } from "@visx/scale";
import { AreaClosed, LinePath, Bar as VisxBar } from "@visx/shape";
import { curveMonotoneX } from "@visx/curve";
import { GridRows } from "@visx/grid";
import { LinearGradient } from "@visx/gradient";
import { localPoint } from "@visx/event";
import { bisector, extent, max, min } from "d3-array";
import { motion, AnimatePresence } from "framer-motion";

// ─── context ────────────────────────────────────────────────────────────────
interface ChartCtx {
  width: number;
  height: number;
  margin: { top: number; right: number; bottom: number; left: number };
  data: Record<string, unknown>[];
  xDataKey: string;
  xScale: ReturnType<typeof scaleTime>;
  yScale: ReturnType<typeof scaleLinear>;
  innerWidth: number;
  innerHeight: number;
  tooltip: { x: number; y: number; index: number } | null;
  setTooltip: (t: { x: number; y: number; index: number } | null) => void;
}

const ChartContext = createContext<ChartCtx | null>(null);
const useChart = () => {
  const ctx = useContext(ChartContext);
  if (!ctx) throw new Error("Must be inside AreaChart");
  return ctx;
};

// ─── AreaChart (root) ────────────────────────────────────────────────────────
interface AreaChartProps {
  data: Record<string, unknown>[];
  xDataKey?: string;
  margin?: { top?: number; right?: number; bottom?: number; left?: number };
  width?: number;
  height?: number;
  className?: string;
  children: React.ReactNode;
}

export function AreaChart({
  data,
  xDataKey = "date",
  margin: marginProp,
  width: fixedWidth,
  height: fixedHeight,
  className,
  children,
}: AreaChartProps) {
  const margin = {
    top: marginProp?.top ?? 20,
    right: marginProp?.right ?? 16,
    bottom: marginProp?.bottom ?? 36,
    left: marginProp?.left ?? 12,
  };
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    index: number;
  } | null>(null);

  const render = (width: number, rawHeight: number) => {
    const height = rawHeight > 50 ? rawHeight : (fixedHeight ?? 240);
    const innerWidth = Math.max(100, width - margin.left - margin.right);
    const innerHeight = Math.max(100, height - margin.top - margin.bottom);

    // X scale — supports Date and number
    const xs = data.map((d) => d[xDataKey]);
    const isDate = xs[0] instanceof Date;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const xScale: any = isDate
      ? scaleTime({
          range: [0, innerWidth],
          domain: extent(data, (d) => d[xDataKey] as Date) as [Date, Date],
        })
      : scaleLinear({
          range: [0, innerWidth],
          domain: extent(data, (d) => Number(d[xDataKey])) as [number, number],
        });

    // Collect all numeric series keys from children to determine y-domain
    const numericKeys: string[] = [];
    React.Children.forEach(children, (child) => {
      if (React.isValidElement(child) && child.props.dataKey) {
        numericKeys.push(child.props.dataKey);
      }
    });
    const allValues = data.flatMap((d) =>
      numericKeys.map((k) => Number(d[k] ?? 0))
    );
    const yMin = Math.min(...allValues);
    const yMax = Math.max(...allValues);
    const yPad = (yMax - yMin) * 0.1 || 10;
    const yScale = scaleLinear({
      range: [innerHeight, 0],
      domain: [yMin - yPad, yMax + yPad],
      nice: true,
    });

    const ctx: ChartCtx = {
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
      <ChartContext.Provider value={ctx}>
        <svg
          width={width}
          height={height}
          className="overflow-visible"
          onMouseLeave={() => setTooltip(null)}
        >
          <defs>
            {/* clip path */}
            <clipPath id="chart-area-clip">
              <rect x={0} y={-4} width={innerWidth} height={innerHeight + 8} />
            </clipPath>
          </defs>
          <g transform={`translate(${margin.left},${margin.top})`}>
            {children}
          </g>
        </svg>
      </ChartContext.Provider>
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
      <ParentSize>
        {({ width, height }) => render(width || 400, height || 240)}
      </ParentSize>
    </div>
  );
}

// ─── Grid ────────────────────────────────────────────────────────────────────
interface GridProps {
  horizontal?: boolean;
  vertical?: boolean;
  stroke?: string;
  strokeDasharray?: string;
  numTicksRows?: number;
}

export function Grid({
  horizontal = true,
  stroke = "rgba(255,255,255,0.06)",
  strokeDasharray = "3,4",
  numTicksRows = 5,
}: GridProps) {
  const { yScale, innerWidth, innerHeight } = useChart();
  return (
    <>
      {horizontal && (
        <GridRows
          scale={yScale}
          width={innerWidth}
          numTicks={numTicksRows}
          stroke={stroke}
          strokeDasharray={strokeDasharray}
        />
      )}
      {/* bottom baseline */}
      <line
        x1={0}
        y1={innerHeight}
        x2={innerWidth}
        y2={innerHeight}
        stroke={stroke}
      />
    </>
  );
}

// ─── XAxis ───────────────────────────────────────────────────────────────────
interface XAxisProps {
  dataKey?: string;
  numTicks?: number;
  tickFormatter?: (v: unknown) => string;
  stroke?: string;
  fontSize?: number;
}

export function XAxis({
  numTicks = 5,
  tickFormatter,
  stroke = "rgba(255,255,255,0.35)",
  fontSize = 10,
}: XAxisProps) {
  const { xScale, innerHeight, data, xDataKey } = useChart();
  const ticks = xScale.ticks ? xScale.ticks(numTicks) : (xScale as ReturnType<typeof scaleLinear>).ticks(numTicks);

  return (
    <g transform={`translate(0,${innerHeight})`}>
      {ticks.map((tick: unknown, i: number) => {
        const x = xScale(tick as Date & number);
        const label = tickFormatter
          ? tickFormatter(tick)
          : tick instanceof Date
          ? tick.toLocaleDateString("en-IN", { month: "short", day: "numeric" })
          : String(tick);
        return (
          <g key={i} transform={`translate(${x},0)`}>
            <text
              dy="1.2em"
              textAnchor="middle"
              fill={stroke}
              fontSize={fontSize}
              fontFamily="monospace"
            >
              {label}
            </text>
          </g>
        );
      })}
    </g>
  );
}

// ─── YAxis ───────────────────────────────────────────────────────────────────
interface YAxisProps {
  tickFormatter?: (v: number) => string;
  stroke?: string;
  fontSize?: number;
  width?: number;
  orientation?: "left" | "right";
}

export function YAxis({
  tickFormatter,
  stroke = "rgba(255,255,255,0.35)",
  fontSize = 10,
  orientation = "left",
}: YAxisProps) {
  const { yScale, innerWidth } = useChart();
  const ticks = yScale.ticks(5);
  return (
    <g>
      {ticks.map((tick, i) => {
        const y = yScale(tick);
        const label = tickFormatter ? tickFormatter(tick) : String(Math.round(tick));
        const x = orientation === "right" ? innerWidth + 6 : -6;
        return (
          <text
            key={i}
            x={x}
            y={y}
            dy="0.35em"
            textAnchor={orientation === "right" ? "start" : "end"}
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

// ─── Area ────────────────────────────────────────────────────────────────────
interface AreaProps {
  dataKey: string;
  stroke?: string;
  fill?: string;
  fillOpacity?: number;
  strokeWidth?: number;
  fadeEdges?: boolean;
  gradientId?: string;
  animated?: boolean;
  curve?: typeof curveMonotoneX;
}

export function Area({
  dataKey,
  stroke,
  fill,
  fillOpacity = 0.35,
  strokeWidth = 2.5,
  animated = true,
}: AreaProps) {
  const { data, xDataKey, xScale, yScale, innerHeight, innerWidth, setTooltip } = useChart();
  const gradId = `area-grad-${dataKey}-${Math.abs(
    dataKey.split("").reduce((a, c) => a + c.charCodeAt(0), 0)
  )}`;
  const color = stroke ?? fill ?? "#FF6600";

  const x = (d: Record<string, unknown>) => xScale(d[xDataKey] as Date & number) ?? 0;
  const y = (d: Record<string, unknown>) => yScale(Number(d[dataKey] ?? 0));
  const y0 = () => yScale(yScale.domain()[0]);

  // hover handler
  const bisectX = bisector((d: Record<string, unknown>) => d[xDataKey]).left;
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGRectElement>) => {
      const point = localPoint(e.target as SVGElement, e);
      if (!point) return;
      const x0 = xScale.invert ? xScale.invert(point.x) : point.x;
      const index = bisectX(data, x0 as Date & number, 1);
      const d = data[Math.min(index, data.length - 1)];
      setTooltip({ x: xScale(d[xDataKey] as Date & number) ?? 0, y: yScale(Number(d[dataKey] ?? 0)), index: Math.min(index, data.length - 1) });
    },
    [xScale, yScale, data, xDataKey, dataKey, bisectX, setTooltip]
  );

  return (
    <>
      <defs>
        <LinearGradient
          id={gradId}
          from={color}
          to={color}
          fromOpacity={fillOpacity}
          toOpacity={0}
          vertical
        />
      </defs>
      <motion.g
        clipPath="url(#chart-area-clip)"
        initial={animated ? { clipPath: "inset(0 100% 0 0)" } : {}}
        animate={animated ? { clipPath: "inset(0 0% 0 0)" } : {}}
        transition={{ duration: 1.1, ease: [0.85, 0, 0.15, 1] }}
      >
        <AreaClosed
          data={data}
          x={x}
          y={y}
          y0={y0}
          yScale={yScale}
          curve={curveMonotoneX}
          fill={`url(#${gradId})`}
          stroke="none"
        />
        <LinePath
          data={data}
          x={x}
          y={y}
          curve={curveMonotoneX}
          stroke={color}
          strokeWidth={strokeWidth}
        />
      </motion.g>
      {/* transparent overlay for mouse events */}
      <VisxBar
        x={0}
        y={0}
        width={innerWidth}
        height={innerHeight}
        fill="transparent"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      />
    </>
  );
}

// ─── ReferenceLine helper ────────────────────────────────────────────────────
export function ReferenceLine({
  y: yVal,
  stroke = "rgba(255,255,255,0.3)",
  strokeDasharray = "4 4",
  x: xVal,
}: {
  y?: number;
  x?: number | Date;
  stroke?: string;
  strokeDasharray?: string;
  label?: Record<string, unknown>;
}) {
  const { yScale, xScale, innerWidth, innerHeight } = useChart();
  if (yVal !== undefined) {
    const yPos = yScale(yVal);
    return (
      <line
        x1={0}
        y1={yPos}
        x2={innerWidth}
        y2={yPos}
        stroke={stroke}
        strokeDasharray={strokeDasharray}
        strokeWidth={1.5}
      />
    );
  }
  if (xVal !== undefined) {
    const xPos = xScale(xVal as Date & number);
    return (
      <line
        x1={xPos}
        y1={0}
        x2={xPos}
        y2={innerHeight}
        stroke={stroke}
        strokeDasharray={strokeDasharray}
        strokeWidth={1.5}
      />
    );
  }
  return null;
}

// ─── ChartTooltip ────────────────────────────────────────────────────────────
interface TooltipRow {
  color: string;
  label: string;
  value: string | number;
}

interface ChartTooltipProps {
  labelFormatter?: (v: unknown) => string;
  formatter?: (v: unknown, key: string) => [string, string];
  rows?: (point: Record<string, unknown>) => TooltipRow[];
  content?: (point: Record<string, unknown>) => React.ReactNode;
  dataKeys?: string[];
  colors?: string[];
}

export function ChartTooltip({
  labelFormatter,
  formatter,
  rows,
  content,
  dataKeys,
  colors = ["#FF6600", "#10B981", "#38bdf8", "#a78bfa"],
}: ChartTooltipProps) {
  const { tooltip, data, xDataKey, innerHeight, margin } = useChart();
  if (!tooltip) return null;

  const point = data[tooltip.index];
  const label = labelFormatter
    ? labelFormatter(point[xDataKey])
    : point[xDataKey] instanceof Date
    ? (point[xDataKey] as Date).toLocaleDateString("en-IN", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : String(point[xDataKey]);

  const tooltipX = tooltip.x + margin.left;
  const tooltipY = margin.top;

  return (
    <g>
      {/* crosshair */}
      <line
        x1={tooltip.x}
        y1={0}
        x2={tooltip.x}
        y2={innerHeight}
        stroke="rgba(255,255,255,0.2)"
        strokeWidth={1}
        strokeDasharray="4 4"
      />
      <circle cx={tooltip.x} cy={tooltip.y} r={4} fill="#FF6600" stroke="#fff" strokeWidth={1.5} />
      {/* tooltip panel rendered as foreignObject */}
      <foreignObject
        x={tooltipX > 200 ? tooltipX - 170 : tooltipX + 12}
        y={tooltipY}
        width={160}
        height={120}
        style={{ overflow: "visible" }}
      >
        <div
          style={{ all: "initial" }}
          className="font-mono text-[11px] bg-[#0A0A0A] border border-white/15 rounded-2xl p-3 shadow-2xl text-white leading-relaxed"
        >
          <div className="font-bold text-[#FF6600] mb-2 text-[10px]">{label}</div>
          {content ? (
            content(point)
          ) : rows ? (
            rows(point).map((r, i) => (
              <div key={i} className="flex justify-between gap-2">
                <span style={{ color: r.color }}>{r.label}</span>
                <span className="font-bold">{r.value}</span>
              </div>
            ))
          ) : (
            dataKeys?.map((k, i) => {
              const raw = point[k];
              const [val, name] = formatter
                ? formatter(raw, k)
                : [String(raw), k];
              return (
                <div key={k} className="flex justify-between gap-2">
                  <span style={{ color: colors[i % colors.length] }}>{name}</span>
                  <span className="font-bold">{val}</span>
                </div>
              );
            })
          )}
        </div>
      </foreignObject>
    </g>
  );
}
