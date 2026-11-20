"use client";

import { useEffect, useState, useRef } from "react";

const locations = [
  { city: "Pune, Maharashtra", discom: "MSEDCL", irradiance: "5.1 kWh/m²/day", netMetering: "Active" },
  { city: "Bangalore, Karnataka", discom: "BESCOM", irradiance: "5.2 kWh/m²/day", netMetering: "Active" },
  { city: "Delhi NCR", discom: "BSES / BYPL / TPDDL", irradiance: "4.9 kWh/m²/day", netMetering: "Active" },
  { city: "Hyderabad, Telangana", discom: "TSSPDCL", irradiance: "5.3 kWh/m²/day", netMetering: "Active" },
  { city: "Mumbai, Maharashtra", discom: "Tata Power / Adani", irradiance: "5.0 kWh/m²/day", netMetering: "Active" },
  { city: "Chennai, Tamil Nadu", discom: "TANGEDCO", irradiance: "5.4 kWh/m²/day", netMetering: "Active" },
];

export function InfrastructureSection() {
  const [isVisible, setIsVisible] = useState(false);
  const [activeLocation, setActiveLocation] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveLocation((prev) => (prev + 1) % locations.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <section ref={sectionRef} id="regional-db" className="relative py-24 lg:py-32 bg-[#050505] border-t border-white/5 overflow-hidden z-30">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          {/* Left: Content */}
          <div
            className={`transition-all duration-700 ${
              isVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"
            }`}
          >
            <span className="inline-flex items-center gap-3 text-sm font-mono text-neutral-500 mb-6">
              <span className="w-8 h-px bg-white/30" />
              Regional Tariffs
            </span>
            <h2 className="text-4xl lg:text-6xl font-display tracking-tight text-white mb-8">
              Local rates.
              <br />
              <span className="text-[#FF6600]">Precise savings.</span>
            </h2>
            <p className="text-lg text-neutral-400 leading-relaxed mb-12 max-w-xl">
              Solar feasibility in India depends on local weather patterns and utility slab charges. 
              Our engine is calibrated with regional NASA irradiance figures and active state DISCOM net-metering formulas.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 border-l border-[#FF6600]/35 pl-6">
              <div>
                <div className="text-4xl lg:text-5xl font-display text-[#FF6600] mb-2">32+</div>
                <div className="text-xs text-neutral-500 font-mono uppercase tracking-wider">DISCOMs Configured</div>
              </div>
              <div>
                <div className="text-4xl lg:text-5xl font-display text-white mb-2">28</div>
                <div className="text-xs text-neutral-500 font-mono uppercase tracking-wider">States Covered</div>
              </div>
              <div>
                <div className="text-4xl lg:text-5xl font-display text-white mb-2">1</div>
                <div className="text-xs text-neutral-500 font-mono uppercase tracking-wider">Shared Model</div>
              </div>
            </div>
          </div>

          {/* Right: Location list */}
          <div
            className={`transition-all duration-700 delay-200 ${
              isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
            }`}
          >
            <div className="border border-white/10 bg-[#070708] rounded-2xl overflow-hidden shadow-2xl">
              {/* Header */}
              <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-[#050506]">
                <span className="text-xs font-mono text-neutral-500">Tariff ledgers pre-loaded</span>
                <span className="text-[10px] font-mono text-[#ff8b3d]">Published tariff inputs</span>
              </div>

              {/* Locations */}
              <div className="divide-y divide-white/5">
                {locations.map((location, index) => (
                  <div
                    key={location.city}
                    className={`px-6 py-4 flex items-center justify-between transition-all duration-300 ${
                      activeLocation === index ? "bg-white/[0.02]" : "bg-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span className={`w-6 font-mono text-[10px] transition-colors duration-300 ${activeLocation === index ? "text-[#FF6600]" : "text-white/20"}`}>
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <div className="font-semibold text-white text-sm">{location.city}</div>
                        <div className="text-xs text-neutral-500">{location.discom}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-xs text-neutral-400 block">{location.irradiance}</span>
                      <span className="text-[10px] font-mono text-white/35 uppercase">{location.netMetering}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
