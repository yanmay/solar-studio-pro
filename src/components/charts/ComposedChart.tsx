/**
 * ComposedChart — visx-powered ComposedChart for Bar+Line combinations.
 */
import React, {
  createContext,
  useContext,
  useState,
} from "react";
import { ParentSize } from "@visx/responsive";
import { scaleLinear, scaleBand } from "@visx/scale";
import { Bar as VisxBar } from "@visx/shape";
import { LinePath } from "@visx/shape";
import { curveMonotoneX } from "@visx/curve";
import { GridRows } from "@visx/grid";
import { max } from "d3-array";
import { motion } from "framer-motion";

// ─── context ──────────────────────────────────────────────────────────────────
interface ComposedCtx {
  width: number;
  height: number;
  margin: { top: number; right: number; bottom: number; left: number };
  data: Record<string, unknown>[];
  xDataKey: string;
  xScale: ReturnType<typeof scaleBand>;
  yScale: ReturnType<typeof scaleLinear>;
  innerWidth: number;
  innerHeight: number;
  tooltip: { index: number; x: number } | null;
  setTooltip: (t: { index: number; x: number } | null) => void;
}

const ComposedCtxRef = createContext<ComposedCtx | null>(null);
const useComposed = () => {
  const c = useContext(ComposedCtxRef);
  if (!c) throw new Error("Must be inside ComposedChart");
  return c;
};

// ─── ComposedChart root ───────────────────────────────────────────────────────
interface ComposedChartProps {
  data: Record<string, unknown>[];
  xDataKey?: string;
  margin?: { top?: number; right?: number; bottom?: number; left?: number };
  width?: number;
  height?: number;
  className?: string;
  children: React.ReactNode;
}

export function ComposedChartComp({
  data,
  xDataKey = "date",
  margin: marginProp,
  width: fixedWidth,
  height: fixedHeight,
  className,
  children,
}: ComposedChartProps) {
  const margin = {
    top: marginProp?.top ?? 16,
    right: marginProp?.right ?? 16,
    bottom: marginProp?.bottom ?? 36,
    left: marginProp?.left ?? 12,
  };
  const [tooltip, setTooltip] = useState<{ index: number; x: number } | null>(null);

  const render = (width: number, rawHeight: number) => {
    const height = rawHeight > 50 ? rawHeight : (fixedHeight ?? 240);
    const innerWidth = Math.max(100, width - margin.left - margin.right);
    const innerHeight = Math.max(100, height - margin.top - margin.bottom);

    const keys = data.map((d) => String(d[xDataKey]));
    const xScale = scaleBand({ range: [0, innerWidth], domain: keys, padding: 0.35 });

    const numericKeys: string[] = [];
    React.Children.forEach(children, (c) => {
      if (React.isValidElement(c) && c.props.dataKey) numericKeys.push(c.props.dataKey);
    });
    const allVals = data.flatMap((d) => numericKeys.map((k) => Number(d[k] ?? 0)));
    const yScale = scaleLinear({
      range: [innerHeight, 0],
      domain: [0, (max(allVals) ?? 1) * 1.15],
      nice: true,
    });

    const ctx: ComposedCtx = {
      width, height, margin, data, xDataKey, xScale, yScale,
      innerWidth, innerHeight, tooltip, setTooltip,
    };

    return (
      <ComposedCtxRef.Provider value={ctx}>
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
      </ComposedCtxRef.Provider>
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

// ─── CartesianGrid ─────────────────────────────────────────────────────────────
export function CartesianGrid({
  stroke = "rgba(255,255,255,0.06)",
  strokeDasharray = "3 3",
}: {
  stroke?: string;
  strokeDasharray?: string;
  vertical?: boolean;
}) {
  const { yScale, innerWidth } = useComposed();
  return (
    <GridRows
      scale={yScale}
      width={innerWidth}
      numTicks={5}
      stroke={stroke}
      strokeDasharray={strokeDasharray}
    />
  );
}

// ─── XAxis ────────────────────────────────────────────────────────────────────
export function ComposedXAxis({
  stroke = "rgba(255,255,255,0.35)",
  fontSize = 10,
  tickFormatter,
}: {
  stroke?: string;
  fontSize?: number;
  fontFamily?: string;
  tickLine?: boolean;
  axisLine?: boolean;
  dataKey?: string;
  tickFormatter?: (v: string) => string;
}) {
  const { xScale, innerHeight, data, xDataKey } = useComposed();
  return (
    <g transform={`translate(0,${innerHeight})`}>
      {data.map((d, i) => {
        const key = String(d[xDataKey]);
        const x = (xScale(key) ?? 0) + xScale.bandwidth() / 2;
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
            {tickFormatter ? tickFormatter(key) : key}
          </text>
        );
      })}
    </g>
  );
}

// ─── YAxis ────────────────────────────────────────────────────────────────────
export function ComposedYAxis({
  stroke = "rgba(255,255,255,0.35)",
  fontSize = 10,
  tickFormatter,
}: {
  stroke?: string;
  fontSize?: number;
  fontFamily?: string;
  tickLine?: boolean;
  tickFormatter?: (v: number) => string;
}) {
  const { yScale } = useComposed();
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

// ─── Bar (in composed) ────────────────────────────────────────────────────────
export function ComposedBar({
  dataKey,
  fill = "#FF6600",
  opacity = 0.7,
  barSize,
  radius,
}: {
  dataKey: string;
  fill?: string;
  opacity?: number;
  barSize?: number;
  radius?: [number, number, number, number];
  name?: string;
}) {
  const { data, xDataKey, xScale, yScale, innerHeight, setTooltip } = useComposed();
  const bw = barSize ?? xScale.bandwidth();
  const rx = radius?.[0] ?? 4;

  return (
    <g>
      {data.map((d, i) => {
        const key = String(d[xDataKey]);
        const xPos = (xScale(key) ?? 0) + (xScale.bandwidth() - bw) / 2;
        const yVal = Number(d[dataKey] ?? 0);
        const barHeight = innerHeight - yScale(yVal);

        return (
          <motion.rect
            key={i}
            x={xPos}
            width={bw}
            y={yScale(yVal)}
            height={barHeight}
            fill={fill}
            opacity={opacity}
            rx={rx}
            ry={rx}
            initial={{ height: 0, y: innerHeight }}
            animate={{ height: barHeight, y: yScale(yVal) }}
            transition={{ delay: i * 0.04, duration: 0.6, ease: "easeOut" }}
            onMouseEnter={() => setTooltip({ index: i, x: xPos + bw / 2 })}
          />
        );
      })}
    </g>
  );
}

// ─── Line (in composed) ───────────────────────────────────────────────────────
export function Line({
  dataKey,
  stroke = "#60A5FA",
  strokeWidth = 2.5,
  dot = true,
}: {
  dataKey: string;
  stroke?: string;
  strokeWidth?: number;
  dot?: boolean | { r?: number };
  type?: string;
  name?: string;
}) {
  const { data, xDataKey, xScale, yScale } = useComposed();
  const r = typeof dot === "object" ? (dot.r ?? 3) : 3;

  const x = (d: Record<string, unknown>) =>
    (xScale(String(d[xDataKey])) ?? 0) + xScale.bandwidth() / 2;
  const y = (d: Record<string, unknown>) => yScale(Number(d[dataKey] ?? 0));

  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8, delay: 0.3 }}
    >
      <LinePath
        data={data}
        x={x}
        y={y}
        curve={curveMonotoneX}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      {dot !== false &&
        data.map((d, i) => (
          <motion.circle
            key={i}
            cx={x(d)}
            cy={y(d)}
            r={r}
            fill={stroke}
            stroke="#0A0A0A"
            strokeWidth={1.5}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: i * 0.04 + 0.4, duration: 0.3 }}
          />
        ))}
    </motion.g>
  );
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────
export function ComposedTooltip({
  contentStyle,
}: {
  contentStyle?: React.CSSProperties;
  content?: React.ReactNode;
}) {
  const { tooltip, data, xDataKey, margin } = useComposed();
  if (!tooltip) return null;
  const point = data[tooltip.index];

  return (
    <foreignObject
      x={tooltip.x + margin.left - 80}
      y={margin.top + 8}
      width={160}
      height={120}
      style={{ overflow: "visible" }}
    >
      <div
        style={{ all: "initial", ...contentStyle }}
        className="font-mono text-[11px] bg-[#0A0A0A] border border-white/15 rounded-2xl p-3 shadow-2xl text-white"
      >
        <div className="font-bold text-[#FF6600] mb-2 text-[10px]">
          {String(point[xDataKey])}
        </div>
        {Object.entries(point)
          .filter(([k]) => k !== xDataKey)
          .map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2 text-[10px]">
              <span className="text-white/50">{k}</span>
              <span className="font-bold text-white">{String(v)}</span>
            </div>
          ))}
      </div>
    </foreignObject>
  );
}
