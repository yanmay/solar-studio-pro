"use client";

import { useEffect, useState, useRef } from "react";
import { Shield, Lock, Eye, FileCheck } from "lucide-react";

const securityFeatures = [
  {
    icon: Shield,
    title: "IS 875 Wind Compliance",
    description: "Evaluates panel packing structural safety against localized wind pressure margins (IS 875 Part 3).",
  },
  {
    icon: Lock,
    title: "DISCOM-Certified ledgers",
    description: "Generates payback cashflows that align strictly with active electricity slab tariff schedules.",
  },
  {
    icon: Eye,
    title: "NASA Meteorological archives",
    description: "Pulls interannual solar radiation data sets directly for your coordinates to calculate P50/P90 variance.",
  },
  {
    icon: FileCheck,
    title: "SolarNet AI neural tracing",
    description: "Identifies setbacks and excludes chimneys, foliage shading, and wiring paths down to 10cm precision.",
  },
];

const certifications = ["IS 875 Wind Code", "NASA POWER API", "MNRE Subsidy Slabs", "GIS Satellite Precision", "pvlib Core"];

export function SecuritySection() {
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
    <section id="security" ref={sectionRef} className="relative py-24 lg:py-32 bg-white/[0.01] border-t border-white/5 overflow-hidden z-30">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24">
          {/* Left: Content */}
          <div
            className={`transition-all duration-700 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <span className="inline-flex items-center gap-3 text-sm font-mono text-neutral-500 mb-6">
              <span className="w-8 h-px bg-white/30" />
              Engineering Standards
            </span>
            <h2 className="text-4xl lg:text-6xl font-display tracking-tight text-white mb-8">
              Accuracy is
              <br />
              non-negotiable.
            </h2>
            <p className="text-lg text-neutral-400 leading-relaxed mb-12 max-w-xl">
              Professional solar proposals shouldn't be guesswork. We align estimates with active 
              meteorological, structural, and financial policy rules to ensure bankable metrics.
            </p>

            {/* Certifications */}
            <div className="flex flex-wrap gap-3">
              {certifications.map((cert, index) => (
                <span
                  key={cert}
                  className={`px-4 py-2 border border-white/10 text-xs font-mono text-neutral-400 bg-white/5 transition-all duration-500 rounded-lg ${
                    isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                  }`}
                  style={{ transitionDelay: `${index * 50 + 200}ms` }}
                >
                  {cert}
                </span>
              ))}
            </div>
          </div>

          {/* Right: Features */}
          <div className="grid gap-6">
            {securityFeatures.map((feature, index) => (
              <div
                key={feature.title}
                className={`p-6 border border-white/10 bg-[#070708]/40 hover:border-[#FF6600]/30 hover:bg-white/[0.01] transition-all duration-500 group rounded-xl ${
                  isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
                }`}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <div className="flex items-start gap-4">
                  <div className="shrink-0 w-10 h-10 flex items-center justify-center border border-white/10 text-neutral-400 group-hover:bg-[#FF6600] group-hover:text-black group-hover:border-transparent transition-all duration-300 rounded-lg">
                    <feature.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1 group-hover:translate-x-1 group-hover:text-[#FF6600] transition-all duration-300">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-neutral-400 leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
