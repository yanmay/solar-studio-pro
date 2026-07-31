/**
 * Gauge — Notch-based radial gauge with animated fill, center label, and gradient support.
 * Inspired by bklitui Gauge API.
 */
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface GaugeProps {
  value: number; // 0–100
  centerValue?: number;
  defaultLabel?: string;
  totalNotches?: number;
  spacing?: number; // gap percentage between notches
  startAngle?: number;
  endAngle?: number;
  activeFill?: string;
  inactiveFill?: string;
  activeFillOpacity?: number;
  inactiveFillOpacity?: number;
  useGradient?: boolean;
  activeGradient?: [string, string];
  inactiveGradient?: [string, string];
  notchCornerRadius?: number;
  prefix?: string;
  suffix?: string;
  formatOptions?: Intl.NumberFormatOptions;
  width?: number;
  height?: number;
  minWidth?: number;
  className?: string;
}

const DEG2RAD = Math.PI / 180;

function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return null;
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

function interpolateColor(from: string, to: string, t: number): string {
  const a = hexToRgb(from) ?? [255, 102, 0];
  const b = hexToRgb(to) ?? [16, 185, 129];
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

export function Gauge({
  value,
  centerValue,
  defaultLabel = "Total",
  totalNotches = 40,
  spacing = 25,
  startAngle = 135,
  endAngle = 405,
  activeFill = "#FF6600",
  inactiveFill = "rgba(255,255,255,0.08)",
  activeFillOpacity = 1,
  inactiveFillOpacity = 0.4,
  useGradient = false,
  activeGradient = ["#FF6600", "#10B981"],
  inactiveGradient,
  notchCornerRadius = 4,
  prefix = "",
  suffix = "",
  formatOptions,
  width = 280,
  height = 280,
  className,
}: GaugeProps) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 80);
    return () => clearTimeout(t);
  }, []);

  const cx = width / 2;
  const cy = height / 2;
  const outerR = Math.min(cx, cy) - 10;
  const notchDepth = outerR * 0.18;
  const innerR = outerR - notchDepth;

  const sweep = endAngle - startAngle; // 270 degrees typically
  const activeCount = Math.round((value / 100) * totalNotches);

  const notches = Array.from({ length: totalNotches }, (_, i) => {
    const angleStep = sweep / totalNotches;
    const gapDeg = (angleStep * spacing) / 100;
    const fillDeg = angleStep - gapDeg;

    const startDeg = startAngle + i * angleStep + gapDeg / 2;
    const endDeg = startDeg + fillDeg;

    const s = startDeg * DEG2RAD;
    const e = endDeg * DEG2RAD;

    const isActive = i < (animated ? activeCount : 0);
    const t = totalNotches > 1 ? i / (totalNotches - 1) : 0;

    let fill: string;
    if (isActive) {
      fill = useGradient
        ? interpolateColor(activeGradient[0], activeGradient[1], t)
        : activeFill;
    } else {
      fill = useGradient && inactiveGradient
        ? interpolateColor(inactiveGradient[0], inactiveGradient[1], t)
        : inactiveFill;
    }

    const opacity = isActive ? activeFillOpacity : inactiveFillOpacity;

    // Build rounded trapezoid path using 4 arc points
    const or = outerR;
    const ir = innerR;
    const ox1 = cx + or * Math.cos(s);
    const oy1 = cy + or * Math.sin(s);
    const ox2 = cx + or * Math.cos(e);
    const oy2 = cy + or * Math.sin(e);
    const ix1 = cx + ir * Math.cos(s);
    const iy1 = cy + ir * Math.sin(s);
    const ix2 = cx + ir * Math.cos(e);
    const iy2 = cy + ir * Math.sin(e);

    const sweepRad = e - s;
    const large = sweepRad > Math.PI ? 1 : 0;

    const d = [
      `M ${ox1} ${oy1}`,
      `A ${or} ${or} 0 ${large} 1 ${ox2} ${oy2}`,
      `L ${ix2} ${iy2}`,
      `A ${ir} ${ir} 0 ${large} 0 ${ix1} ${iy1}`,
      "Z",
    ].join(" ");

    return { d, fill, opacity, isActive, delay: i * 0.018 };
  });

  // formatted center value
  const formattedVal = centerValue !== undefined
    ? formatOptions
      ? new Intl.NumberFormat("en-IN", formatOptions).format(centerValue)
      : centerValue.toLocaleString("en-IN")
    : null;

  return (
    <div className={`flex flex-col items-center justify-center ${className ?? ""}`}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {notches.map((n, i) => (
          <motion.path
            key={i}
            d={n.d}
            fill={n.fill}
            fillOpacity={n.opacity}
            rx={notchCornerRadius}
            initial={{ opacity: 0 }}
            animate={{ opacity: n.opacity }}
            transition={{ delay: n.delay, duration: 0.25 }}
          />
        ))}

        {/* center label */}
        {centerValue !== undefined && (
          <>
            <text
              x={cx}
              y={cy - 8}
              textAnchor="middle"
              fill="white"
              fontSize={height * 0.115}
              fontWeight="700"
              fontFamily="monospace"
            >
              {prefix}{formattedVal}{suffix}
            </text>
            <text
              x={cx}
              y={cy + height * 0.09}
              textAnchor="middle"
              fill="rgba(255,255,255,0.45)"
              fontSize={height * 0.05}
              fontFamily="monospace"
            >
              {defaultLabel}
            </text>
          </>
        )}

        {/* value percentage */}
        <text
          x={cx}
          y={cy + (centerValue !== undefined ? height * 0.18 : height * 0.06)}
          textAnchor="middle"
          fill={activeFill}
          fontSize={height * 0.048}
          fontWeight="700"
          fontFamily="monospace"
        >
          {Math.round(value)}%
        </text>
      </svg>
    </div>
  );
}
