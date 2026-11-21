import { useEffect, useRef, useState } from "react";
import { Activity, ArrowUpRight, Leaf, Timer, TrendingUp } from "lucide-react";

const EASING = "cubic-bezier(0.16,1,0.3,1)";

const SIGNALS = [
  {
    icon: Activity,
    value: "284,739 m2",
    label: "Roof area modeled",
    source: "Satellite geometry",
    detail: "Surface area is reduced for setbacks, obstructions, and maintenance clearance before capacity is estimated.",
  },
  {
    icon: TrendingUp,
    value: "Rs 84,000 / yr",
    label: "Illustrative annual savings",
    source: "Tariff + subsidy model",
    detail: "The estimate combines local electricity rates, PM Surya Ghar eligibility, degradation, and operating costs.",
  },
  {
    icon: Leaf,
    value: "182 t",
    label: "Avoided emissions",
    source: "Grid displacement model",
    detail: "Carbon impact is derived from modeled generation and the regional grid factor, not a generic offset claim.",
  },
];

export function MetricsSection() {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.18 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="metrics" ref={ref} className="relative overflow-hidden bg-[#050505] px-4 py-28 sm:px-6 lg:px-12">
      <div className="pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" style={{ background: "radial-gradient(ellipse 60% 45% at 12% 30%, rgba(255,102,0,0.08), transparent 70%)" }} />
      <div className="relative mx-auto max-w-7xl">
        <div className="max-w-2xl" data-reveal>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#ff8b3d]">What the model returns</p>
          <h2 className="mt-4 max-w-xl text-4xl font-semibold leading-[1.02] tracking-[-0.04em] text-white sm:text-6xl">
            A clearer read on the value of your roof.
          </h2>
          <p className="mt-5 max-w-[58ch] text-base leading-relaxed text-white/58">
            Every result is tied to geometry, local rates, policy rules, and the assumptions you can change.
          </p>
        </div>

        <div className="mt-16 grid gap-4 lg:grid-cols-12" aria-label="Solar model outputs">
          <article className={`group relative overflow-hidden rounded-2xl border border-white/12 bg-white/[0.035] p-7 transition duration-700 hover:-translate-y-1 hover:border-[#ff6600]/50 lg:col-span-5 lg:min-h-[330px] ${visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`} style={{ transitionTimingFunction: EASING }} data-reveal>
            <div className="flex items-center justify-between">
              <Activity className="h-5 w-5 text-[#ff8b3d]" aria-hidden="true" />
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/35">{SIGNALS[0].source}</span>
            </div>
            <div className="mt-20">
              <p className="font-mono text-4xl font-semibold tracking-[-0.04em] text-white sm:text-6xl">{SIGNALS[0].value}</p>
              <h3 className="mt-3 text-lg font-semibold text-white">{SIGNALS[0].label}</h3>
              <p className="mt-2 max-w-[42ch] text-sm leading-relaxed text-white/50">{SIGNALS[0].detail}</p>
            </div>
          </article>

          <div className="grid gap-4 lg:col-span-7">
            {SIGNALS.slice(1).map((signal, index) => {
              const Icon = signal.icon;
              return (
                <article key={signal.label} data-reveal className={`group grid gap-5 rounded-2xl border border-white/12 bg-white/[0.025] p-6 transition duration-700 hover:-translate-y-1 hover:border-[#ff6600]/50 sm:grid-cols-[auto_1fr_auto] sm:items-start ${visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`} style={{ transitionDelay: `${(index + 1) * 90}ms`, transitionTimingFunction: EASING }}>
                  <span className="grid h-10 w-10 place-items-center rounded-xl border border-[#ff6600]/30 bg-[#ff6600]/10 text-[#ff8b3d]"><Icon className="h-5 w-5" aria-hidden="true" /></span>
                  <div>
                    <p className="font-mono text-2xl font-semibold tracking-[-0.03em] text-white">{signal.value}</p>
                    <h3 className="mt-1 text-base font-semibold text-white">{signal.label}</h3>
                    <p className="mt-2 max-w-[52ch] text-sm leading-relaxed text-white/48">{signal.detail}</p>
                  </div>
                  <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/35"><span>{signal.source}</span><ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /></span>
                </article>
              );
            })}
            <div data-reveal className="grid gap-4 rounded-2xl border border-dashed border-white/15 bg-transparent p-6 sm:grid-cols-[auto_1fr] sm:items-center">
              <Timer className="h-5 w-5 text-[#ff8b3d]" aria-hidden="true" />
              <p className="text-sm leading-relaxed text-white/55"><span className="font-semibold text-white">A report is ready in minutes, not hours.</span> The map, panel layout, financial model, and PDF report use the same assumptions from one saved scan.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
