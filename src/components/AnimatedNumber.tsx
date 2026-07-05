import { useEffect, useRef, useState } from "react";

interface AnimatedNumberProps {
  value: number;
  /** decimal places */
  decimals?: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  /** thousands separator using en-IN grouping */
  group?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Counts up to `value` on mount using requestAnimationFrame (opacity/text only —
 * no layout thrash). Renders the final value immediately when the user prefers
 * reduced motion.
 */
export function AnimatedNumber({
  value,
  decimals = 0,
  duration = 1100,
  prefix = "",
  suffix = "",
  group = false,
  className,
  style,
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced || duration <= 0) {
      setDisplay(value);
      return;
    }
    let start: number | null = null;
    const from = 0;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3); // easeOutCubic
    const step = (ts: number) => {
      if (start === null) start = ts;
      const p = Math.min(1, (ts - start) / duration);
      setDisplay(from + (value - from) * ease(p));
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [value, duration]);

  const fixed = display.toFixed(decimals);
  const formatted = group
    ? Number(fixed).toLocaleString("en-IN", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : fixed;

  return (
    <span className={className} style={style}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

export default AnimatedNumber;
