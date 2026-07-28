"use client";

import { useEffect, useState, useRef } from "react";
import { Activity, TrendingUp, Leaf, Timer } from "lucide-react";

const EASING = "cubic-bezier(0.16,1,0.3,1)";

function useCounter(end: number, trigger: boolean, duration = 2000) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!trigger) return;
    let startTime: number | null = null;
    const animate = (ts: number) => {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      // Expo ease out
      const eased = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(eased * end));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [trigger, end, duration]);
  return count;
}

const METRICS = [
  {
    icon: Activity,
    iconColor: "#FF6600",
    bgGlow: "rgba(255,102,0,0.12)",
    prefix: "",
    end: 284739,
    suffix: " m²",
    label: "Rooftop area analyzed",
    sub: "Satellite-resolution GIS",
    accent: "#FF6600",
  },
  {
    icon: TrendingUp,
    iconColor: "#10B981",
    bgGlow: "rgba(16,185,129,0.12)",
    prefix: "₹",
    end: 84000,
    suffix: "/yr",
    label: "Avg. annual savings",
    sub: "Post-subsidy residential",
    accent: "#10B981",
  },
  {
    icon: Leaf,
    iconColor: "#34D399",
    bgGlow: "rgba(52,211,153,0.10)",
    prefix: "",
    end: 182,
    suffix: " Tons",
    label: "CO₂ emissions avoided",
    sub: "Monthly carbon offset",
    accent: "#34D399",
  },
  {
    icon: Timer,
    iconColor: "#FBBF24",
    bgGlow: "rgba(251,191,36,0.10)",
    prefix: "",
    end: 180,
    suffix: "s",
    label: "Avg. report speed",
    sub: "From map to full PDF",
    accent: "#FBBF24",
  },
];

function MetricTile({
  metric,
  index,
  visible,
}: {
  metric: (typeof METRICS)[number];
  index: number;
  visible: boolean;
}) {
  const count = useCounter(metric.end, visible, 2200);
  const Icon = metric.icon;

  return (
    <div
      className="relative rounded-3xl border border-white/10 bg-[#0A0A0A]/90 backdrop-blur-2xl p-7 flex flex-col justify-between gap-6 overflow-hidden group"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(28px)",
        transition: `opacity 0.6s ${EASING} ${index * 80}ms, transform 0.6s ${EASING} ${index * 80}ms, border-color 0.3s ${EASING}, box-shadow 0.3s ${EASING}`,
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        minHeight: "200px",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = `${metric.accent}40`;
        (e.currentTarget as HTMLElement).style.transform = "translateY(-4px)";
        (e.currentTarget as HTMLElement).style.boxShadow = `0 0 32px ${metric.bgGlow}, 0 24px 60px rgba(0,0,0,0.5)`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.10)";
        (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
        (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 32px rgba(0,0,0,0.4)";
      }}
    >
      {/* Top-edge accent */}
      <div
        className="absolute top-0 left-0 right-0 h-px rounded-t-3xl opacity-0 group-hover:opacity-100 pointer-events-none"
        style={{
          background: `linear-gradient(90deg,transparent,${metric.accent}60,transparent)`,
          transition: `opacity 300ms ${EASING}`,
        }}
        aria-hidden="true"
      />

      {/* Ambient glow behind icon */}
      <div
        className="absolute top-0 left-0 w-32 h-32 blur-3xl opacity-0 group-hover:opacity-100 pointer-events-none"
        style={{ background: metric.bgGlow, transition: `opacity 400ms ${EASING}`, borderRadius: "24px 0 0 0" }}
        aria-hidden="true"
      />

      {/* Icon badge */}
      <div
        className="w-10 h-10 rounded-2xl flex items-center justify-center border border-white/10"
        style={{ background: `${metric.iconColor}18` }}
        aria-hidden="true"
      >
        <Icon className="w-5 h-5" style={{ color: metric.iconColor }} />
      </div>

      {/* Big counter value */}
      <div>
        <div
          className="text-4xl sm:text-5xl font-mono font-bold leading-none mb-2"
          style={{ color: metric.accent }}
        >
          {metric.prefix}{count.toLocaleString("en-IN")}{metric.suffix}
        </div>
        <div className="text-sm font-semibold text-white">{metric.label}</div>
        <div className="text-[10px] font-mono text-white/30 mt-0.5">{metric.sub}</div>
      </div>
    </div>
  );
}

export function MetricsSection() {
  const [time, setTime] = useState(new Date());
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="metrics"
      ref={ref}
      className="relative py-24 bg-[#050505] overflow-hidden"
    >
      {/* Section ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 80% 50% at 50% 100%, rgba(255,102,0,0.05), transparent)" }}
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-14">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-[10px] font-mono font-bold text-[#FF6600] uppercase tracking-[0.12em]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF6600] animate-pulse" />
              Live Impact Metrics
            </div>
            <h2
              className="text-4xl sm:text-5xl text-white leading-tight"
              style={{ fontFamily: "'Calistoga', serif", fontWeight: 400 }}
            >
              Performance you<br />
              <span className="text-[#FF6600]">can verify.</span>
            </h2>
          </div>

          {/* Live clock badge */}
          <div
            className="flex items-center gap-3 px-4 py-2.5 rounded-2xl border border-white/10"
            style={{ background: "rgba(255,255,255,0.03)", backdropFilter: "blur(12px)" }}
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-mono text-white/50 uppercase tracking-wider">System Active</span>
            </div>
            <div className="w-px h-4 bg-white/10" />
            <span className="text-[10px] font-mono text-white/70 tabular-nums">
              {time.toLocaleTimeString("en-IN", { hour12: false })} IST
            </span>
          </div>
        </div>

        {/* Metrics grid — 4 col bento */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {METRICS.map((metric, i) => (
            <MetricTile key={metric.label} metric={metric} index={i} visible={visible} />
          ))}
        </div>
      </div>
    </section>
  );
}
