import { useLayoutEffect, useRef } from "react";
import { ArrowRight, Check, MapPin, MousePointer2, SlidersHorizontal } from "lucide-react";
import gsap from "gsap";
import { cn } from "@/lib/utils";

interface GisGuideProps {
  currentStep: 1 | 2 | 3 | 4;
  onOpenWorkspace: () => void;
  compact?: boolean;
}

const steps = [
  { label: "Find the roof", detail: "Search an address or use your location.", icon: MapPin },
  { label: "Trace the boundary", detail: "Click each corner, then close the polygon.", icon: MousePointer2 },
  { label: "Tune the layout", detail: "Set tilt, setbacks, walkways, and shade.", icon: SlidersHorizontal },
  { label: "Run the model", detail: "Generate yield, savings, and payback.", icon: Check },
];

export function GisGuide({ currentStep, onOpenWorkspace, compact = false }: GisGuideProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!rootRef.current) return;
    gsap.fromTo(rootRef.current.querySelectorAll("[data-guide-item]"), { y: 10, opacity: 0 }, {
      y: 0, opacity: 1, duration: 0.55, stagger: 0.07, ease: "power3.out",
    });
  }, [currentStep]);

  return (
    <div ref={rootRef} className={cn("pointer-events-auto rounded-2xl border border-white/12 bg-[#070707]/88 p-4 text-white shadow-[0_18px_55px_rgba(0,0,0,0.42)] backdrop-blur-2xl", compact ? "w-[min(320px,calc(100vw-32px))]" : "w-full")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#ff8b3d]">Solar workspace</p>
          <h2 className="mt-1 text-sm font-semibold text-white">Map a roof in four moves</h2>
        </div>
        {compact && <button type="button" onClick={onOpenWorkspace} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-white/70 transition hover:bg-white/10 hover:text-white" aria-label="Open workspace controls" title="Open workspace controls"><ArrowRight className="h-4 w-4" /></button>}
      </div>
      <div className="mt-4 grid gap-2">
        {steps.map(({ label, detail, icon: Icon }, index) => {
          const step = index + 1;
          const active = step === currentStep;
          const complete = step < currentStep;
          return (
            <div key={label} data-guide-item className={cn("flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors", active ? "border-[#ff6600]/55 bg-[#ff6600]/10" : "border-white/8 bg-white/[0.025]", complete && "border-emerald-400/25 bg-emerald-400/[0.06]")}>
              <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg border text-[11px] font-mono", active ? "border-[#ff6600] text-[#ff9a55]" : complete ? "border-emerald-400/50 text-emerald-300" : "border-white/12 text-white/45")}>
                {complete ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
              </span>
              <span className="min-w-0"><span className={cn("block text-xs font-semibold", active ? "text-white" : "text-white/70")}>{label}</span><span className="mt-0.5 block truncate text-[10px] text-white/40">{detail}</span></span>
            </div>
          );
        })}
      </div>
      {!compact && <button type="button" onClick={onOpenWorkspace} className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#ff6600] text-xs font-bold text-black transition hover:bg-[#ff7a1a] active:scale-[0.98]">Open mapping controls <ArrowRight className="h-3.5 w-3.5" /></button>}
    </div>
  );
}
