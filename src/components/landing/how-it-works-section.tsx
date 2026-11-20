"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, ScanLine, FileText, ArrowRight, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";

const EASING = "cubic-bezier(0.16,1,0.3,1)";

const STEPS = [
  {
    num: "01",
    icon: MapPin,
    color: "#FF6600",
    title: "Find your roof",
    desc: "Enter your address or pincode. Satellite tiles load in seconds — pan and zoom to your exact property.",
    code: `// Locate rooftop from address
const roof = await sunpower.locate({
  address: "Kothrud, Pune",
  resolution: "satellite-high"
})
// → { lat: 18.5074, lng: 73.8077 }`,
    pill: "Satellite GIS",
  },
  {
    num: "02",
    icon: ScanLine,
    color: "#FBBF24",
    title: "Trace & model geometry",
    desc: "Draw your rooftop boundary. Configure setbacks, obstacles, and panel pitch angles to calculate optimal packing density.",
    code: `// Analyze boundary & model panels
const analysis = await roof.analyze({
  boundary: polygonPoints,
  tiltAngle: 15, // degrees
  discom: "MSEDCL",
  shadingLoss: "none"
})
// yieldKwP: 8.4, panelCount: 18`,
    pill: "Panel Simulation",
  },
  {
    num: "03",
    icon: FileText,
    color: "#10B981",
    title: "Export your solar ledger",
    desc: "Get a full financial model: PM Surya Ghar subsidy estimate, 25-yr ROI projection, and a downloadable PDF report.",
    code: `// Generate bankable PDF report
const report = await analysis.report({
  subsidyScheme: "PM-Surya-Ghar",
  netMetering: true,
  exportFormat: "PDF"
})
await report.download()
// ✓ Report downloaded — 847 KB`,
    pill: "PDF Report",
  },
];

function CodeBlock({ code }: { code: string }) {
  const tokens = code.split("\n").map((line, i) => ({
    line,
    num: String(i + 1).padStart(2, " "),
  }));

  return (
    <div
      className="rounded-2xl border border-white/[0.08] overflow-hidden font-mono text-xs leading-relaxed"
      style={{ background: "rgba(5,5,6,0.8)", backdropFilter: "blur(20px)" }}
    >
      {/* Editor chrome */}
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/[0.06]">
        <div className="w-3 h-3 rounded-full bg-red-500/60" />
        <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
        <div className="w-3 h-3 rounded-full bg-green-500/60" />
        <span className="ml-3 text-[10px] text-white/25 tracking-wider">sunpower-sdk.ts</span>
      </div>
      {/* Code lines */}
      <div className="p-4 space-y-0.5">
        {tokens.map(({ line, num }) => (
          <div key={num} className="flex gap-3">
            <span className="text-white/20 w-5 text-right shrink-0">{num.trim()}</span>
            <span
              className={
                line.trim().startsWith("//")
                  ? "text-white/30"
                  : line.includes("await") || line.includes("const")
                  ? "text-[#FF6600]/90"
                  : line.includes("→") || line.includes("//")
                  ? "text-emerald-400/80"
                  : "text-white/70"
              }
            >
              {line}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HowItWorksSection() {
  const navigate = useNavigate();
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  // Auto-advance
  useEffect(() => {
    const interval = setInterval(() => setActive(p => (p + 1) % STEPS.length), 5000);
    return () => clearInterval(interval);
  }, []);

  const step = STEPS[active];
  const StepIcon = step.icon;

  return (
    <section
      id="workflow"
      ref={ref}
      className="relative py-24 bg-[#050505] overflow-hidden px-4 sm:px-6 lg:px-12"
    >
      {/* Ambient glow */}
      <div
        className="absolute right-0 top-1/2 -translate-y-1/2 w-[500px] h-[500px] blur-[160px] pointer-events-none"
        style={{ background: "rgba(255,102,0,0.04)" }}
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-14 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-[10px] font-mono font-bold text-[#FF6600] uppercase tracking-[0.12em]">
            <Check className="w-3 h-3" /> How It Works
          </div>
          <h2
            className="text-4xl sm:text-5xl text-white leading-tight"
            style={{ fontFamily: "'Outfit', system-ui, sans-serif", fontWeight: 600 }}
          >
            From address to<br />
            <span className="text-[#FF6600]">bankable report in 3 steps.</span>
          </h2>
        </div>

        {/* Main grid: step selectors + code panel */}
        <div className="grid lg:grid-cols-2 gap-6">

          {/* Left — step cards */}
          <div className="flex flex-col gap-3">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isActive = i === active;
              return (
                <button
                  key={s.num}
                  onClick={() => setActive(i)}
                  className="group relative rounded-3xl border p-5 text-left cursor-pointer w-full overflow-hidden transition-all"
                  style={{
                    background: isActive ? "rgba(10,10,10,0.95)" : "rgba(10,10,10,0.50)",
                    borderColor: isActive ? `${s.color}35` : "rgba(255,255,255,0.08)",
                    boxShadow: isActive ? `0 0 30px ${s.color}10, 0 16px 40px rgba(0,0,0,0.5)` : "none",
                    transition: `all 350ms ${EASING}`,
                    opacity: visible ? 1 : 0,
                    transform: visible ? "translateX(0)" : "translateX(-24px)",
                    transitionDelay: `${i * 100}ms`,
                  }}
                >
                  {/* Active progress bar at top */}
                  {isActive && (
                    <div
                      className="absolute top-0 left-0 right-0 h-0.5 rounded-t-3xl"
                      style={{ background: `linear-gradient(90deg,transparent,${s.color},transparent)` }}
                      aria-hidden="true"
                    />
                  )}

                  <div className="flex items-start gap-4">
                    {/* Step number + icon */}
                    <div
                      className="shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center border border-white/10 transition-all"
                      style={{
                        background: isActive ? `${s.color}20` : "rgba(255,255,255,0.05)",
                        borderColor: isActive ? `${s.color}30` : "rgba(255,255,255,0.08)",
                        transition: `all 300ms ${EASING}`,
                      }}
                    >
                      <Icon className="w-5 h-5" style={{ color: isActive ? s.color : "rgba(255,255,255,0.3)" }} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-[9px] font-mono font-bold tracking-[0.15em] uppercase"
                          style={{ color: isActive ? s.color : "rgba(255,255,255,0.2)" }}
                        >
                          STEP {s.num}
                        </span>
                        {isActive && (
                          <span
                            className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-md border"
                            style={{ color: s.color, background: `${s.color}15`, borderColor: `${s.color}30` }}
                          >
                            {s.pill}
                          </span>
                        )}
                      </div>
                      <h3
                        className="text-sm font-bold mb-1.5 transition-colors"
                        style={{ color: isActive ? "#fff" : "rgba(255,255,255,0.45)", transition: `color 200ms ${EASING}` }}
                      >
                        {s.title}
                      </h3>
                      {isActive && (
                        <p className="text-xs text-white/45 leading-relaxed font-light">{s.desc}</p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}

            {/* CTA below steps */}
            <button
              onClick={() => navigate("/map")}
              className="mt-2 flex items-center justify-center gap-2 h-12 rounded-2xl text-xs font-bold text-black cursor-pointer border-none group"
              style={{
                background: "linear-gradient(135deg,#FF6600,#FF8C38)",
                boxShadow: "0 0 24px rgba(255,102,0,0.2)",
                transition: `all 200ms ${EASING}`,
                opacity: visible ? 1 : 0,
                transform: visible ? "translateX(0)" : "translateX(-24px)",
                transitionDelay: "350ms",
              }}
            >
              Try It Free <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" style={{ transition: `transform 200ms ${EASING}` }} />
            </button>
          </div>

          {/* Right — code preview */}
          <div
            className="flex flex-col gap-4"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? "translateX(0)" : "translateX(24px)",
              transition: `all 600ms ${EASING} 200ms`,
            }}
          >
            {/* Step indicator header */}
            <div
              className="flex items-center gap-3 p-4 rounded-2xl border border-white/[0.08]"
              style={{ background: "rgba(10,10,10,0.6)", backdropFilter: "blur(16px)" }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center border border-white/10"
                style={{ background: `${step.color}20`, borderColor: `${step.color}30` }}
              >
                <StepIcon className="w-4 h-4" style={{ color: step.color }} />
              </div>
              <div>
                <div className="text-xs font-bold text-white">{step.title}</div>
                <div className="text-[10px] font-mono text-white/35">Step {step.num} of {STEPS.length}</div>
              </div>
              {/* Progress dots */}
              <div className="ml-auto flex gap-1.5">
                {STEPS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActive(i)}
                    className="w-2 h-2 rounded-full transition-all cursor-pointer border-none"
                    style={{
                      background: i === active ? step.color : "rgba(255,255,255,0.15)",
                      transform: i === active ? "scale(1.3)" : "scale(1)",
                      transition: `all 200ms ${EASING}`,
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Code block — animates on step change */}
            <div
              key={active}
              style={{ animation: `fadeCodeIn 400ms ${EASING} both` }}
            >
              <CodeBlock code={step.code} />
            </div>

            {/* SDK note */}
            <div
              className="flex items-center gap-3 p-4 rounded-2xl border border-white/[0.06]"
              style={{ background: "rgba(255,255,255,0.02)" }}
            >
              <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <Check className="w-3 h-3 text-emerald-400" />
              </div>
              <p className="text-[10px] font-mono text-white/30 leading-relaxed">
                Code samples are illustrative. Analysis runs entirely in-browser via REST + GIS APIs.
              </p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeCodeIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}
