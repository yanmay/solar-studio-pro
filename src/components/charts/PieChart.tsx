/**
 * PieChart — visx-powered composable pie/donut chart.
 * Matches bklitui PieChart API.
 */
import React, {
  createContext,
  useContext,
  useState,
} from "react";
import { Pie } from "@visx/shape";
import { Group } from "@visx/group";
import { ParentSize } from "@visx/responsive";
import { motion, AnimatePresence } from "framer-motion";

// ─── types ────────────────────────────────────────────────────────────────────
export interface PieData {
  label: string;
  value: number;
  color?: string;
  fill?: string;
}

interface PieCtxType {
  data: PieData[];
  innerRadius: number;
  outerRadius: number;
  hoveredIndex: number | null;
  setHoveredIndex: (i: number | null) => void;
  palette: string[];
}

const DEFAULT_PALETTE = [
  "#FF6600",
  "#10B981",
  "#38bdf8",
  "#a78bfa",
  "#f59e0b",
  "#ec4899",
];

const PieCtx = createContext<PieCtxType | null>(null);
const usePieCtx = () => {
  const c = useContext(PieCtx);
  if (!c) throw new Error("Must be inside PieChart");
  return c;
};

// ─── PieChart root ────────────────────────────────────────────────────────────
interface PieChartProps {
  data: PieData[];
  size?: number;
  innerRadius?: number;
  padAngle?: number;
  cornerRadius?: number;
  startAngle?: number;
  endAngle?: number;
  hoveredIndex?: number | null;
  onHoverChange?: (i: number | null) => void;
  className?: string;
  children: React.ReactNode;
}

export function PieChart({
  data,
  size,
  innerRadius: innerRProp = 0,
  padAngle = 0.015,
  cornerRadius = 4,
  hoveredIndex: controlledHovered,
  onHoverChange,
  className,
  children,
}: PieChartProps) {
  const [internalHovered, setInternalHovered] = useState<number | null>(null);
  const hoveredIndex = controlledHovered ?? internalHovered;
  const setHoveredIndex = onHoverChange ?? setInternalHovered;

  const render = (width: number, height: number) => {
    const dim = Math.min(width, height);
    const outerRadius = dim / 2 - 4;
    const innerRadius = innerRProp > 0 ? (innerRProp < 1 ? innerRProp * outerRadius : innerRProp) : 0;

    const ctx: PieCtxType = {
      data,
      innerRadius,
      outerRadius,
      hoveredIndex,
      setHoveredIndex,
      palette: DEFAULT_PALETTE,
    };

    return (
      <PieCtx.Provider value={ctx}>
        <svg width={width} height={height}>
          <Group top={height / 2} left={width / 2}>
            <Pie
              data={data}
              pieValue={(d) => d.value}
              outerRadius={outerRadius}
              innerRadius={innerRadius}
              padAngle={padAngle}
              cornerRadius={cornerRadius}
            >
              {(pie) =>
                pie.arcs.map((arc, i) => {
                  const hovered = hoveredIndex === i;
                  const dimmed = hoveredIndex !== null && !hovered;
                  const fill =
                    data[i].color ??
                    data[i].fill ??
                    DEFAULT_PALETTE[i % DEFAULT_PALETTE.length];
                  const [pathData] = pie.path.radius(
                    outerRadius + (hovered ? 8 : 0)
                  )(arc) ? [pie.path.radius(outerRadius + (hovered ? 8 : 0))(arc)] : [pie.path(arc)];

                  return (
                    <motion.path
                      key={i}
                      d={pie.path(arc) ?? ""}
                      fill={fill}
                      fillOpacity={dimmed ? 0.35 : 1}
                      stroke={hovered ? "#fff" : "transparent"}
                      strokeWidth={hovered ? 1.5 : 0}
                      style={{
                        filter: hovered
                          ? `drop-shadow(0 0 12px ${fill}99)`
                          : undefined,
                        cursor: "pointer",
                        transformOrigin: "center",
                        transformBox: "fill-box",
                      }}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{
                        scale: hovered ? 1.06 : 1,
                        opacity: 1,
                        fillOpacity: dimmed ? 0.35 : 1,
                      }}
                      transition={{
                        scale: { type: "spring", stiffness: 300, damping: 25 },
                        opacity: { delay: i * 0.06, duration: 0.4 },
                        fillOpacity: { duration: 0.2 },
                      }}
                      onMouseEnter={() => setHoveredIndex(i)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    />
                  );
                })
              }
            </Pie>
            {children}
          </Group>
        </svg>
      </PieCtx.Provider>
    );
  };

  if (size) {
    return (
      <div className={className} style={{ width: size, height: size }}>
        {render(size, size)}
      </div>
    );
  }

  return (
    <div className={`w-full h-full ${className ?? ""}`}>
      <ParentSize>{({ width, height }) => render(width, height || width)}</ParentSize>
    </div>
  );
}

// ─── PieSlice — individual slice (declarative, rendered by PieChart context) ──
export function PieSlice({
  index: _index,
  color: _color,
}: {
  index: number;
  color?: string;
  fill?: string;
  animate?: boolean;
  showGlow?: boolean;
  hoverEffect?: string;
  hoverOffset?: number;
}) {
  // Rendering is handled by PieChart; this component is for API compatibility
  return null;
}

// ─── PieCenter — center label for donut charts ────────────────────────────────
interface PieCenterProps {
  defaultLabel?: string;
  formatOptions?: Intl.NumberFormatOptions;
  prefix?: string;
  suffix?: string;
  children?: (props: {
    hoveredIndex: number | null;
    data: PieData[];
  }) => React.ReactNode;
  className?: string;
}

export function PieCenter({
  defaultLabel = "Total",
  formatOptions,
  prefix = "",
  suffix = "",
  children,
  className,
}: PieCenterProps) {
  const { data, hoveredIndex, innerRadius } = usePieCtx();
  if (innerRadius <= 0) return null;

  if (children) {
    return <>{children({ hoveredIndex, data })}</>;
  }

  const activeItem = hoveredIndex !== null ? data[hoveredIndex] : null;
  const total = data.reduce((s, d) => s + d.value, 0);
  const displayVal = activeItem ? activeItem.value : total;
  const label = activeItem ? activeItem.label : defaultLabel;

  const formatted = formatOptions
    ? new Intl.NumberFormat("en-IN", formatOptions).format(displayVal)
    : displayVal.toLocaleString("en-IN");

  return (
    <AnimatePresence mode="wait">
      <motion.g
        key={hoveredIndex ?? "total"}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.2 }}
      >
        <text
          textAnchor="middle"
          dominantBaseline="middle"
          y={-10}
          fill="white"
          fontSize={innerRadius * 0.38}
          fontWeight="700"
          fontFamily="monospace"
        >
          {prefix}{formatted}{suffix}
        </text>
        <text
          textAnchor="middle"
          dominantBaseline="middle"
          y={innerRadius * 0.22}
          fill="rgba(255,255,255,0.5)"
          fontSize={innerRadius * 0.2}
          fontFamily="monospace"
        >
          {label}
        </text>
      </motion.g>
    </AnimatePresence>
  );
}
