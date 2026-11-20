/**
 * SVG chart primitives for @react-pdf/renderer.
 *
 * Rules:
 * - All charts are pure SVG via react-pdf's <Svg>, <Rect>, <Line>, <Path>, <Text> etc.
 * - NO Recharts, NO Chart.js — they cannot render inside react-pdf.
 * - Each component takes a simple data prop and renders vector SVG.
 * - Width/height are explicit numbers (pt), not percentages.
 */
import React from "react";
import { Svg, Rect, Line, Path, Text as SvgText, G, Circle } from "@react-pdf/renderer";
import { C } from "./tokens";

// ─── BarChart ─────────────────────────────────────────────────────────────────
interface BarChartDatum {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: BarChartDatum[];
  width: number;
  height: number;
  showLabels?: boolean;
  showValues?: boolean;
}

export function BarChart({ data, width, height, showLabels = true, showValues = true }: BarChartProps) {
  const paddingBottom = showLabels ? 18 : 4;
  const paddingTop = showValues ? 14 : 4;
  const paddingLeft = 4;
  const paddingRight = 4;
  const chartH = height - paddingTop - paddingBottom;
  const chartW = width - paddingLeft - paddingRight;

  const max = Math.max(...data.map((d) => d.value), 1);
  const barW = Math.max(2, (chartW / data.length) * 0.6);
  const gap  = chartW / data.length;

  return (
    <Svg width={width} height={height}>
      {/* Grid line at top */}
      <Line
        x1={paddingLeft} y1={paddingTop}
        x2={width - paddingRight} y2={paddingTop}
        strokeWidth={0.5} stroke={C.border}
      />
      {/* Bars */}
      {data.map((d, i) => {
        const barH = Math.max(1, (d.value / max) * chartH);
        const x = paddingLeft + i * gap + (gap - barW) / 2;
        const y = paddingTop + chartH - barH;
        const fill = d.color ?? C.chartBar;
        return (
          <G key={i}>
            <Rect x={x} y={y} width={barW} height={barH} fill={fill} rx={2} />
            {showValues && (
              <SvgText
                x={x + barW / 2} y={y - 3}
                fontSize={6} fill={C.muted} textAnchor="middle"
              >
                {d.value.toFixed(0)}
              </SvgText>
            )}
            {showLabels && (
              <SvgText
                x={x + barW / 2} y={height - 4}
                fontSize={6} fill={C.muted} textAnchor="middle"
              >
                {d.label}
              </SvgText>
            )}
          </G>
        );
      })}
    </Svg>
  );
}

// ─── LineChart ─────────────────────────────────────────────────────────────────
interface LineChartDatum {
  label: string;
  value: number;
}

interface LineChartProps {
  data: LineChartDatum[];
  width: number;
  height: number;
  color?: string;
  showArea?: boolean;
  zeroLine?: boolean; // draw a horizontal line at y=0 (for cashflow charts)
}

export function LineChart({ data, width, height, color = C.chartLine, showArea = true, zeroLine = false }: LineChartProps) {
  const padL = 4; const padR = 4;
  const padT = 8; const padB = 8;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;

  const vals = data.map((d) => d.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;

  const toX = (i: number) => padL + (i / (data.length - 1)) * chartW;
  const toY = (v: number) => padT + (1 - (v - min) / range) * chartH;

  const points = data.map((d, i) => `${toX(i)},${toY(d.value)}`).join(" ");
  const polyline = `M ${data.map((d, i) => `${toX(i)} ${toY(d.value)}`).join(" L ")}`;
  const areaPath = `${polyline} L ${toX(data.length - 1)} ${padT + chartH} L ${toX(0)} ${padT + chartH} Z`;

  const zeroY = padT + (1 - (0 - min) / range) * chartH;

  return (
    <Svg width={width} height={height}>
      {showArea && (
        <Path d={areaPath} fill={color} fillOpacity={0.12} />
      )}
      {zeroLine && min < 0 && max > 0 && (
        <Line x1={padL} y1={zeroY} x2={width - padR} y2={zeroY}
          strokeWidth={0.75} stroke={C.muted} strokeDasharray="3 2" />
      )}
      <Path d={polyline} stroke={color} strokeWidth={1.5} fill="none" />
      {/* Dot at last point */}
      <Circle
        cx={toX(data.length - 1)} cy={toY(data[data.length - 1].value)}
        r={3} fill={color}
      />
    </Svg>
  );
}

// ─── WaterfallChart ────────────────────────────────────────────────────────────
interface WaterfallDatum {
  label: string;
  value: number;   // positive = gain, negative = cost
  isTotal?: boolean;
}

interface WaterfallProps {
  data: WaterfallDatum[];
  width: number;
  height: number;
}

export function WaterfallChart({ data, width, height }: WaterfallProps) {
  const padB = 20; const padT = 14; const padL = 4; const padR = 4;
  const chartH = height - padT - padB;
  const chartW = width - padL - padR;

  // Compute running totals for stacking
  let running = 0;
  const processed = data.map((d) => {
    const start = d.isTotal ? 0 : running;
    const end   = d.isTotal ? d.value : running + d.value;
    if (!d.isTotal) running = end;
    return { ...d, start, end };
  });

  const allVals = processed.flatMap((d) => [d.start, d.end]);
  const min = Math.min(0, ...allVals);
  const max = Math.max(0, ...allVals);
  const range = max - min || 1;

  const barW = Math.max(2, (chartW / data.length) * 0.55);
  const gap  = chartW / data.length;

  const toY = (v: number) => padT + (1 - (v - min) / range) * chartH;
  const zeroY = toY(0);

  return (
    <Svg width={width} height={height}>
      <Line x1={padL} y1={zeroY} x2={width - padR} y2={zeroY}
        strokeWidth={0.5} stroke={C.border} />
      {processed.map((d, i) => {
        const x = padL + i * gap + (gap - barW) / 2;
        const yTop  = toY(Math.max(d.start, d.end));
        const yBot  = toY(Math.min(d.start, d.end));
        const barH  = Math.max(1, yBot - yTop);
        const fill  = d.isTotal ? C.chartBar
                    : d.value >= 0 ? C.chartLine
                    : C.chartNeg;
        return (
          <G key={i}>
            <Rect x={x} y={yTop} width={barW} height={barH} fill={fill} rx={1} />
            <SvgText x={x + barW / 2} y={height - 5}
              fontSize={5.5} fill={C.muted} textAnchor="middle">
              {d.label}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

// ─── DonutChart ────────────────────────────────────────────────────────────────
interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

interface DonutProps {
  data: DonutSlice[];
  size: number;      // outer diameter
  thickness?: number; // ring thickness
}

export function DonutChart({ data, size, thickness = size * 0.28 }: DonutProps) {
  const r = size / 2;
  const innerR = r - thickness;
  const cx = r; const cy = r;
  const total = data.reduce((s, d) => s + d.value, 0) || 1;

  let startAngle = -Math.PI / 2; // start at top

  const slices = data.map((d) => {
    const angle = (d.value / total) * 2 * Math.PI;
    const endAngle = startAngle + angle;

    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const ix1 = cx + innerR * Math.cos(endAngle);
    const iy1 = cy + innerR * Math.sin(endAngle);
    const ix2 = cx + innerR * Math.cos(startAngle);
    const iy2 = cy + innerR * Math.sin(startAngle);

    const large = angle > Math.PI ? 1 : 0;

    const path = [
      `M ${x1} ${y1}`,
      `A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`,
      `L ${ix1} ${iy1}`,
      `A ${innerR} ${innerR} 0 ${large} 0 ${ix2} ${iy2}`,
      "Z",
    ].join(" ");

    const result = { ...d, path, angle };
    startAngle = endAngle;
    return result;
  });

  return (
    <Svg width={size} height={size}>
      {slices.map((s, i) => (
        <Path key={i} d={s.path} fill={s.color} />
      ))}
      {/* White inner circle punch-out */}
      <Circle cx={cx} cy={cy} r={innerR - 1} fill="white" />
    </Svg>
  );
}
