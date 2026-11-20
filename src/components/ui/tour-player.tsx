import { Pause, Play, SkipForward } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface TourPlayerProps {
  active: boolean;
  title: string;
  step: number;
  totalSteps: number;
  durationMs: number;
  onAdvance: () => void;
  onSkip: () => void;
}

export function TourPlayer({ active, title, step, totalSteps, durationMs, onAdvance, onSkip }: TourPlayerProps) {
  const reducedMotion = useMemo(() => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches, []);
  const [paused, setPaused] = useState(reducedMotion);
  const [elapsed, setElapsed] = useState(0);
  const effectiveDuration = reducedMotion ? Math.min(durationMs, 1800) : durationMs;

  useEffect(() => {
    if (!active) return;
    setPaused(reducedMotion);
    setElapsed(0);
  }, [active, step, reducedMotion]);

  useEffect(() => {
    if (!active || paused) return;
    const timer = window.setInterval(() => {
      setElapsed((current) => {
        const nextElapsed = current + 100;
        if (nextElapsed >= effectiveDuration) {
          window.clearInterval(timer);
          onAdvance();
        }
        return nextElapsed;
      });
    }, 100);
    return () => window.clearInterval(timer);
  }, [active, effectiveDuration, onAdvance, paused]);

  if (!active) return null;
  const progress = Math.min(100, (elapsed / effectiveDuration) * 100);

  return (
    <div className="pointer-events-auto absolute bottom-20 left-1/2 z-[1100] w-[min(360px,calc(100vw-32px))] -translate-x-1/2 rounded-2xl border border-white/15 bg-[#080808]/90 p-3.5 text-white shadow-[0_18px_55px_rgba(0,0,0,.5)] backdrop-blur-2xl" role="status" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-[#ff8b3d]">Guided rooftop tour</p>
          <p className="mt-1 truncate text-xs font-semibold text-white">{title}</p>
        </div>
        <span className="shrink-0 font-mono text-[10px] text-white/45">{step} / {totalSteps}</span>
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#ff6600] transition-[width] duration-100" style={{ width: `${progress}%` }} /></div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <button type="button" onClick={() => setPaused((value) => !value)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] font-semibold text-white/70 transition hover:bg-white/10 hover:text-white" aria-label={paused ? "Resume guided tour" : "Pause guided tour"}>
          {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}{paused ? "Resume" : "Pause"}
        </button>
        <button type="button" onClick={onSkip} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold text-white/50 transition hover:bg-white/10 hover:text-white" aria-label="Skip guided tour">
          <SkipForward className="h-3 w-3" /> Skip tour
        </button>
      </div>
    </div>
  );
}
