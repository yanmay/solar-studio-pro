"use client";

import { useEffect, useRef } from "react";
import {
  Scan, Zap, IndianRupee, MapPin, BarChart3,
  ShieldCheck, TrendingUp, Sun, ArrowRight
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useGsapReveal, useGsapStack } from "@/hooks/use-gsap-motion";

const EASING = "cubic-bezier(0.16,1,0.3,1)";

// ── Individual bento cell configs ───────────────────────────────
const BENTO_CELLS = [
  {
    id: "trace",
    span: "lg:col-span-7",
    icon: Scan,
    iconColor: "#FF6600",
    tag: "CORE — GIS ENGINE",
    headline: "Satellite Rooftop Tracing",
    body: "Draw boundaries on live satellite tiles. AI identifies setbacks, obstructions, and optimal panel zones in seconds. Sub-centimetre precision via Google Maps JS.",
    accentGlow: "rgba(255,102,0,0.15)",
    stat: { value: "< 3 min", label: "avg roof audit time" },
    visual: <TracingVisual />,
  },
  {
    id: "yield",
    span: "lg:col-span-5",
    icon: Sun,
    iconColor: "#FBBF24",
    tag: "NASA POWER",
    headline: "Irradiance Mapping",
    body: "Coordinates-based solar radiation data pulled from NASA POWER API. Accounts for tilt, azimuth, and local weather patterns.",
    accentGlow: "rgba(251,191,36,0.12)",
    stat: { value: "99.2%", label: "irradiance accuracy" },
  },
  {
    id: "discom",
    span: "lg:col-span-4",
    icon: IndianRupee,
    iconColor: "#10B981",
    tag: "DISCOM TARIFFS",
    headline: "Utility Rate Ledgers",
    body: "Slab rates, fixed charges, and net-metering formulas for MSEDCL, BESCOM, TANGEDCO, KSEB, and 12+ more utilities.",
    accentGlow: "rgba(16,185,129,0.12)",
    stat: { value: "12+", label: "DISCOMs integrated" },
  },
  {
    id: "subsidy",
    span: "lg:col-span-4",
    icon: ShieldCheck,
    iconColor: "#10B981",
    tag: "PM SURYA GHAR",
    headline: "₹78K Subsidy Calculator",
    body: "Automatically qualifies and estimates central government subsidy slabs under PM Surya Ghar Muft Bijli Yojana.",
    accentGlow: "rgba(16,185,129,0.12)",
    stat: { value: "₹78,000", label: "max subsidy unlocked" },
  },
  {
    id: "roi",
    span: "lg:col-span-4",
    icon: TrendingUp,
    iconColor: "#FF6600",
    tag: "FINANCIAL MODEL",
    headline: "ROI & Payback Dashboard",
    body: "Full 25-year financial projection including degradation curves, subsidy stacking, state-level export tariffs, and electricity escalation rates. Exportable as PDF.",
    accentGlow: "rgba(255,102,0,0.15)",
    stat: { value: "25yr", label: "financial projection" },
    visual: <RoiVisual />,
  },
  {
    id: "policy",
    span: "lg:col-span-12",
    icon: BarChart3,
    iconColor: "#818CF8",
    tag: "ANALYTICS",
    headline: "Market Intelligence",
    body: "State rankings, national capacity trends, and cost trajectory data to benchmark your solar investment.",
    accentGlow: "rgba(129,140,248,0.12)",
    stat: { value: "28+", label: "states tracked" },
  },
];

function TracingVisual() {
  return (
    <div className="absolute bottom-0 right-0 w-48 h-40 pointer-events-none overflow-hidden rounded-b-3xl" aria-hidden="true">
      <svg viewBox="0 0 200 160" className="w-full h-full" style={{ opacity: 0.25 }}>
        <defs>
          <radialGradient id="traceGrad" cx="50%" cy="50%">
            <stop offset="0%" stopColor="#FF6600" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#FF6600" stopOpacity="0" />
          </radialGradient>
        </defs>
        <polygon points="40,120 80,40 140,60 160,140 100,150" fill="none" stroke="#FF6600" strokeWidth="1.5" strokeDasharray="4,3" opacity="0.6">
          <animate attributeName="stroke-dashoffset" from="0" to="50" dur="3s" repeatCount="indefinite" />
        </polygon>
        <circle cx="40" cy="120" r="4" fill="#FF6600" opacity="0.9"><animate attributeName="opacity" values="0.9;0.3;0.9" dur="2s" repeatCount="indefinite" /></circle>
        <circle cx="80" cy="40" r="4" fill="#FF6600" opacity="0.9"><animate attributeName="opacity" values="0.3;0.9;0.3" dur="2.5s" repeatCount="indefinite" /></circle>
        <circle cx="140" cy="60" r="4" fill="#FF6600" opacity="0.9"><animate attributeName="opacity" values="0.9;0.3;0.9" dur="1.8s" repeatCount="indefinite" /></circle>
        <circle cx="160" cy="140" r="4" fill="#FF6600" opacity="0.9"><animate attributeName="opacity" values="0.3;0.9;0.3" dur="2.2s" repeatCount="indefinite" /></circle>
        <g opacity="0.4">
          {[...Array(6)].map((_, i) => (
            <rect key={i} x={55 + (i % 3) * 20} y={70 + Math.floor(i / 3) * 22} width="14" height="18" rx="2" fill="#FF6600" />
          ))}
        </g>
      </svg>
    </div>
  );
}

function RoiVisual() {
  const bars = [28, 45, 62, 58, 75, 88, 95, 82, 96, 100];
  return (
    <div className="absolute bottom-0 right-0 w-56 h-36 pointer-events-none overflow-hidden rounded-br-3xl flex items-end gap-1.5 px-4 pb-4" aria-hidden="true">
      {bars.map((h, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-sm"
          style={{
            height: `${h}%`,
            background: i === bars.length - 1
              ? "linear-gradient(180deg,#FF6600,#FF8C38)"
              : `rgba(255,102,0,${0.1 + i * 0.08})`,
            animation: `barGrow 0.8s ${EASING} ${i * 60}ms both`,
          }}
        />
      ))}
    </div>
  );
}

export function FeaturesSection() {
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLElement>(null);
  useGsapReveal(sectionRef);
  useGsapStack(sectionRef);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.querySelectorAll<HTMLElement>(".bento-cell").forEach((el, i) => {
              el.style.animationDelay = `${i * 80}ms`;
              el.classList.add("bento-cell-visible");
            });
          }
        });
      },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="technology"
      className="relative bg-[#050505] py-24 px-4 sm:px-6 lg:px-12 overflow-hidden"
    >
      <style>{`
        @keyframes barGrow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
        .bento-cell {
          opacity: 0;
          transform: translateY(24px);
          transition: opacity 0.6s ${EASING}, transform 0.6s ${EASING}, border-color 0.3s ${EASING}, box-shadow 0.3s ${EASING};
        }
        .bento-cell-visible { opacity: 1; transform: translateY(0); }
        .bento-cell:hover {
          border-color: rgba(255,102,0,0.28) !important;
          transform: translateY(-4px) !important;
          box-shadow: 0 0 30px rgba(255,102,0,0.07), 0 24px 60px rgba(0,0,0,0.5) !important;
        }
        .bento-cell:hover .bento-top-line {
          opacity: 1;
        }
        .bento-top-line {
          opacity: 0;
          transition: opacity 0.3s ${EASING};
        }
      `}</style>

      {/* Ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] blur-[150px] pointer-events-none" style={{ background: "rgba(255,102,0,0.04)" }} aria-hidden="true" />

      <div className="mx-auto max-w-7xl">
        {/* Section header */}
        <div className="mb-14 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-[10px] font-mono font-bold text-[#FF6600] uppercase tracking-[0.12em]">
              <Zap className="w-3 h-3" /> Platform Capabilities
            </div>
            <h2
              className="text-4xl sm:text-5xl text-white leading-tight"
              style={{ fontFamily: "'Outfit', system-ui, sans-serif", fontWeight: 600 }}
            >
              Everything you need to<br />
              <span className="text-[#FF6600]">go solar, intelligently.</span>
            </h2>
          </div>
          <button
            onClick={() => navigate("/map")}
            className="shrink-0 flex items-center gap-2 h-11 px-6 rounded-2xl text-xs font-bold text-black cursor-pointer border-none group"
            style={{
              background: "#FF6600",
              boxShadow: "none",
              transition: `all 200ms ${EASING}`,
            }}
          >
            Explore Full Platform
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" style={{ transition: `transform 200ms ${EASING}` }} />
          </button>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-flow-dense grid-cols-1 gap-4 auto-rows-[minmax(210px,auto)] sm:grid-cols-2 lg:grid-cols-12">
          {BENTO_CELLS.map((cell) => {
            const Icon = cell.icon;
            return (
              <div
                key={cell.id}
                data-reveal
                data-stack-card
                className={`bento-cell relative overflow-hidden rounded-3xl border border-white/10 p-6 sm:p-7 flex flex-col justify-between gap-8 group cursor-default ${cell.span}`}
                style={{
                  background: "rgba(10,10,10,0.90)",
                  backdropFilter: "blur(32px)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)",
                  minHeight: cell.span === "lg:col-span-2" ? "240px" : "200px",
                }}
              >
                {/* Orange top-edge accent on hover */}
                <div
                  className="bento-top-line absolute top-0 left-0 right-0 h-px rounded-t-3xl"
                  style={{ background: "linear-gradient(90deg,transparent,rgba(255,102,0,0.45),transparent)" }}
                  aria-hidden="true"
                />

                {/* Ambient glow behind icon */}
                <div
                  className="absolute top-0 left-0 w-40 h-40 blur-3xl opacity-0 group-hover:opacity-100 pointer-events-none rounded-tl-3xl"
                  style={{ background: cell.accentGlow, transition: `opacity 400ms ${EASING}` }}
                  aria-hidden="true"
                />

                {/* Optional decorative visual */}
                {cell.visual}

                {/* Content */}
                <div className="relative z-10 space-y-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center border border-white/10 shrink-0"
                      style={{ background: `${cell.iconColor}15` }}
                    >
                      <Icon className="w-5 h-5" style={{ color: cell.iconColor }} />
                    </div>
                    <span className="text-[9px] font-mono font-bold tracking-[0.15em] text-white/30 uppercase">{cell.tag}</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-2 leading-snug">{cell.headline}</h3>
                    <p className="text-xs text-white/50 leading-relaxed font-light">{cell.body}</p>
                  </div>
                </div>

                {/* Stat chip */}
                <div className="relative z-10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="px-3 py-1.5 rounded-xl border"
                      style={{ background: `${cell.iconColor}10`, borderColor: `${cell.iconColor}30` }}
                    >
                      <span className="text-sm font-mono font-bold" style={{ color: cell.iconColor }}>{cell.stat.value}</span>
                    </div>
                    <span className="text-[10px] text-white/30 font-mono">{cell.stat.label}</span>
                  </div>
                  <MapPin className="w-4 h-4 text-white/10" aria-hidden="true" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
