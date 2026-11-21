import { useState } from "react";
import { ArrowRight, Check, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function HeroSection() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const analyze = () => {
    const trimmed = query.trim();
    navigate(trimmed ? `/map?q=${encodeURIComponent(trimmed)}` : "/map");
  };

  return (
    <section className="relative flex min-h-[min(900px,100svh)] items-center overflow-hidden bg-black px-5 pb-20 pt-28 sm:px-8">
      <img src="/hero-bg.webp" alt="Sunlit Indian terrain" className="absolute inset-0 h-full w-full object-cover object-center opacity-45" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-black/35 to-black" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/25 to-black/50" />

      <div className="relative z-10 mx-auto w-full max-w-[1240px] animate-fade-slide-up">
        <div className="max-w-6xl">
          <p className="mb-6 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-[#FF8C38]">
            Rooftop solar intelligence for India
          </p>
          <h1 className="font-display max-w-6xl text-balance text-[clamp(3.2rem,7vw,7rem)] leading-[0.94] text-white">
            Calculate your rooftop <span className="font-light italic leading-[1.1] pb-1 text-[#FF6600]">solar potential</span> in 60 seconds.
          </h1>
          <p className="mt-7 max-w-2xl text-base leading-relaxed text-white/70 sm:text-xl">
            Trace your roof, model panel layouts, compare local tariffs, and estimate PM Surya Ghar subsidies from one spatial workspace.
          </p>

          <div className="mt-9 flex max-w-2xl flex-col gap-3 rounded-2xl border border-white/15 bg-black/60 p-2 shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:flex-row">
            <label className="flex min-h-12 flex-1 items-center gap-3 px-3">
              <Search className="h-5 w-5 shrink-0 text-white/40" />
              <span className="sr-only">Address, city, or pincode</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && analyze()}
                placeholder="Enter an address, city, or pincode"
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/35"
              />
            </label>
            <button
              onClick={analyze}
              className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#FF6600] px-5 text-sm font-bold text-black transition-[background-color,transform] duration-150 hover:bg-[#FF7A1A] active:scale-[0.97]"
            >
              Calculate savings
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-xs text-white/55">
            <span className="flex items-center gap-2"><Check className="h-4 w-4 text-[#ff8b3d]" /> No signup required for preview</span>
            <span className="flex items-center gap-2"><Check className="h-4 w-4 text-[#ff8b3d]" /> Subsidy and tariff estimates included</span>
          </div>
        </div>
      </div>
    </section>
  );
}
