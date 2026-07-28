"use client";

import { useEffect, useState, useRef } from "react";

const integrations = [
  { name: "NASA POWER", category: "Irradiance Weather API" },
  { name: "ISRO Bhuvan", category: "Geographic Cartography" },
  { name: "OpenStreetMap", category: "Building GIS Vectors" },
  { name: "Leaflet Map", category: "Dynamic Drawing Canvas" },
  { name: "MSEDCL Maharashtra", category: "DISCOM Tariff Slabs" },
  { name: "BESCOM Karnataka", category: "DISCOM Tariff Slabs" },
  { name: "BSES Yamuna", category: "DISCOM Tariff Slabs" },
  { name: "TSSPDCL Telangana", category: "DISCOM Tariff Slabs" },
  { name: "PM Surya Ghar", category: "National Subsidy Ledger" },
  { name: "Razorpay Payments", category: "Instant Order Verification" },
  { name: "Resend Emailer", category: "Installer Lead Dispatcher" },
  { name: "Hugging Face APIs", category: "AI Roof Image Segmentation" },
];

export function IntegrationsSection() {
  const [isVisible, setIsVisible] = useState(false);
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

  return (
    <section id="integrations" ref={sectionRef} className="relative py-24 lg:py-32 overflow-hidden bg-black z-30">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        {/* Header */}
        <div
          className={`text-center max-w-3xl mx-auto mb-16 lg:mb-24 transition-all duration-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <span className="inline-flex items-center gap-3 text-sm font-mono text-neutral-500 mb-6">
            <span className="w-8 h-px bg-white/30" />
            Integrations & APIs
            <span className="w-8 h-px bg-white/30" />
          </span>
          <h2 className="text-4xl lg:text-6xl font-display tracking-tight text-white mb-6">
            Connected to the
            <br />
            energy ecosystem.
          </h2>
          <p className="text-lg text-neutral-400 max-w-xl mx-auto">
            Directly maps satellite grids, meteorological archives, state tariffs, and payment gateways.
          </p>
        </div>
      </div>
      
      {/* Full-width marquees outside container */}
      <div className="w-full mb-6 relative z-10">
        <div className="flex gap-6 marquee">
          {[...Array(2)].map((_, setIndex) => (
            <div key={setIndex} className="flex gap-6 shrink-0">
              {integrations.map((integration, idx) => (
                <div
                  key={`${integration.name}-${setIndex}-${idx}`}
                  className="shrink-0 px-8 py-6 border border-white/10 bg-[#070708]/40 hover:border-[#FF6600]/30 hover:bg-white/[0.02] transition-all duration-300 group rounded-xl"
                >
                  <div className="text-lg font-bold text-white group-hover:translate-x-1 group-hover:text-[#FF6600] transition-all">
                    {integration.name}
                  </div>
                  <div className="text-xs text-neutral-500 font-mono mt-1 uppercase tracking-wider">{integration.category}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      
      {/* Reverse marquee */}
      <div className="w-full relative z-10">
        <div className="flex gap-6 marquee-reverse">
          {[...Array(2)].map((_, setIndex) => (
            <div key={setIndex} className="flex gap-6 shrink-0">
              {[...integrations].reverse().map((integration, idx) => (
                <div
                  key={`${integration.name}-reverse-${setIndex}-${idx}`}
                  className="shrink-0 px-8 py-6 border border-white/10 bg-[#070708]/40 hover:border-[#FF6600]/30 hover:bg-white/[0.02] transition-all duration-300 group rounded-xl"
                >
                  <div className="text-lg font-bold text-white group-hover:translate-x-1 group-hover:text-[#FF6600] transition-all">
                    {integration.name}
                  </div>
                  <div className="text-xs text-neutral-500 font-mono mt-1 uppercase tracking-wider">{integration.category}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
