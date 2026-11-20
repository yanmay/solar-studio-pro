"use client";

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Zap, BarChart3, ArrowRight, Check, MapPin, ShieldCheck, Sun } from "lucide-react";

const EASING = "cubic-bezier(0.16,1,0.3,1)";

const BENEFITS = [
  "No credit card for preview estimates",
  "PM Surya Ghar subsidy calculator built-in",
  "PDF export ready in 3 minutes",
  "Works for any Indian state & DISCOM",
];

export function CtaSection() {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [mouse, setMouse] = useState({ x: 50, y: 50 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.15 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMouse({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  };

  return (
    <section className="relative py-24 bg-[#050505] overflow-hidden px-4 sm:px-6 lg:px-12">
      {/* Section ambient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 60% 60% at 50% 100%, rgba(255,102,0,0.06), transparent)" }}
        aria-hidden="true"
      />

      <div
        className="max-w-7xl mx-auto"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(32px)",
          transition: `opacity 0.8s ${EASING}, transform 0.8s ${EASING}`,
        }}
      >
        {/* Main CTA card */}
        <div
          ref={ref}
          className="relative rounded-[32px] border border-white/10 overflow-hidden"
          style={{
            background: "rgba(10,10,10,0.95)",
            backdropFilter: "blur(40px)",
            boxShadow: "0 0 80px rgba(255,102,0,0.08), 0 32px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
          onMouseMove={handleMouseMove}
        >
          {/* Mouse spotlight */}
          <div
            className="absolute inset-0 pointer-events-none transition-opacity duration-300"
            style={{
              background: `radial-gradient(400px circle at ${mouse.x}% ${mouse.y}%, rgba(255,102,0,0.08), transparent 60%)`,
            }}
            aria-hidden="true"
          />

          {/* Top edge glow */}
          <div
            className="absolute top-0 left-0 right-0 h-px"
            style={{ background: "linear-gradient(90deg,transparent,rgba(255,102,0,0.4),rgba(255,102,0,0.4),transparent)" }}
            aria-hidden="true"
          />

          {/* Decorative grid lines */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.025]" aria-hidden="true">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="absolute h-px bg-white w-full" style={{ top: `${12.5 * (i + 1)}%` }} />
            ))}
          </div>

          <div className="relative z-10 grid lg:grid-cols-5 gap-0">
            {/* Left — main content */}
            <div className="lg:col-span-3 p-10 sm:p-14 flex flex-col justify-between gap-10">
              <div className="space-y-6">
                {/* Eyebrow */}
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-[#FF6600]/10 border border-[#FF6600]/25 text-[10px] font-mono font-bold text-[#FF6600] uppercase tracking-[0.12em]">
                  <Sun className="w-3 h-3" /> Free Rooftop Analysis
                </div>

                {/* Headline */}
                <h2
                  className="text-4xl sm:text-6xl text-white leading-[1.0]"
                  style={{ fontFamily: "'Outfit', system-ui, sans-serif", fontWeight: 600 }}
                >
                  Ready to scan<br />your rooftop?
                </h2>

                <p className="text-base text-white/50 leading-relaxed max-w-md font-light">
                  Join thousands of Indian homeowners and installers using satellite-precision GIS to model rooftops, calculate subsidies, and generate bankable solar reports.
                </p>

                {/* Benefit list */}
                <ul className="space-y-2.5">
                  {BENEFITS.map((b) => (
                    <li key={b} className="flex items-center gap-3 text-sm text-white/60">
                      <div className="w-5 h-5 rounded-lg bg-[#ff6600]/15 border border-[#ff6600]/30 flex items-center justify-center shrink-0">
                        <Check className="w-2.5 h-2.5 text-[#ff8b3d]" />
                      </div>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>

              {/* CTAs */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => navigate("/map")}
                  className="flex items-center gap-2.5 h-13 px-7 rounded-2xl text-sm font-bold text-black cursor-pointer border-none group"
                  style={{
                    background: "linear-gradient(135deg,#FF6600,#FF8C38)",
                    boxShadow: "0 0 28px rgba(255,102,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)",
                    height: "52px",
                    transition: `all 200ms ${EASING}`,
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.boxShadow = "0 0 48px rgba(255,102,0,0.5), inset 0 1px 0 rgba(255,255,255,0.2)";
                    (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.boxShadow = "0 0 28px rgba(255,102,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)";
                    (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                  }}
                >
                  <Zap className="w-4 h-4 fill-current" />
                  Launch Analyzer
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" style={{ transition: `transform 200ms ${EASING}` }} />
                </button>
                <button
                  onClick={() => navigate("/market-insights")}
                  className="flex items-center gap-2 h-[52px] px-6 rounded-2xl text-sm font-semibold text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 cursor-pointer transition-all"
                  style={{ transition: `all 200ms ${EASING}` }}
                >
                  <BarChart3 className="w-4 h-4" />
                  Explore Insights
                </button>
              </div>
            </div>

            {/* Right — bento stat cards */}
            <div className="lg:col-span-2 border-t lg:border-t-0 lg:border-l border-white/[0.08] p-8 flex flex-col gap-4">
              <p className="text-[10px] font-mono font-bold text-white/30 uppercase tracking-[0.15em] mb-2">Platform at a glance</p>

              {[
                { icon: MapPin, label: "States supported", value: "28+", color: "#FF6600" },
                { icon: ShieldCheck, label: "Subsidy schemes tracked", value: "3 active", color: "#10B981" },
                { icon: Zap, label: "System accuracy", value: "±2%", color: "#FBBF24" },
                { icon: BarChart3, label: "DISCOMs integrated", value: "12+", color: "#818CF8" },
              ].map((stat, i) => (
                <div
                  key={stat.label}
                  className="flex items-center gap-4 p-4 rounded-2xl border border-white/[0.07] group hover:border-white/15 transition-all"
                  style={{
                    background: "rgba(255,255,255,0.025)",
                    transition: `all 200ms ${EASING}`,
                    opacity: visible ? 1 : 0,
                    transform: visible ? "translateX(0)" : "translateX(16px)",
                    transitionDelay: `${i * 80 + 300}ms`,
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center border border-white/10 shrink-0"
                    style={{ background: `${stat.color}12` }}
                  >
                    <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-mono text-white/40">{stat.label}</div>
                    <div className="text-sm font-bold font-mono text-white">{stat.value}</div>
                  </div>
                </div>
              ))}

              {/* Bottom note */}
              <div className="mt-auto pt-2 border-t border-white/[0.06]">
                <p className="text-[10px] font-mono text-white/25 leading-relaxed">
                  Data sourced from NASA POWER API, MNRE, and DISCOM published tariff schedules
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
