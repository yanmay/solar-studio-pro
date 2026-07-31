"use client";

import { useEffect, useState } from "react";

const testimonials = [
  {
    quote: "SUNPOWER LINK saved us lakhs in solar installations. The layout calculations and PM Surya Ghar subsidy estimations matched our final vendor quote to the rupee.",
    author: "Ramesh Sharma",
    role: "Homeowner",
    company: "Pune, MH",
    metric: "₹84,000 annual savings",
  },
  {
    quote: "For our solar EPC business, this is the ultimate client onboarding companion. We can trace a roof and send a premium PDF proposal in front of the customer in under 3 minutes.",
    author: "Kunal Deshmukh",
    role: "Managing Director",
    company: "SuryaTech Solar Solutions",
    metric: "3x faster client conversions",
  },
  {
    quote: "The NASA POWER solar radiation irradiance accuracy is incredibly precise. We cross-checked it with localized meters in South India and it has a negligible delta.",
    author: "Dr. Ananya Rao",
    role: "Renewable Energy Researcher",
    company: "IISc Bangalore",
    metric: "98% solar yield accuracy",
  },
  {
    quote: "Our cooperative housing society unlocked net metering savings for 40 apartments. The tariff models pre-loaded for MSEDCL made calculations foolproof.",
    author: "Col. Vikram Singh (Retd)",
    role: "Society President",
    company: "Delhi NCR",
    metric: "₹4.2L collective annual savings",
  },
];

const partners = ["MSEDCL", "BESCOM", "TATA POWER SOLAR", "FENICE ENERGY", "LOOM SOLAR", "SU-KAM", "ISRO BHUVAN", "NASA POWER"];

export function TestimonialsSection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setActiveIndex((prev) => (prev + 1) % testimonials.length);
        setIsAnimating(false);
      }, 300);
    }, 5500);
    return () => clearInterval(interval);
  }, []);

  const activeTestimonial = testimonials[activeIndex];

  return (
    <section className="relative py-32 lg:py-40 border-t border-white/10 bg-black z-30">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        {/* Section Label */}
        <div className="flex items-center gap-4 mb-16">
          <span className="font-mono text-xs tracking-widest text-neutral-500 uppercase">
            What people say
          </span>
          <div className="flex-1 h-px bg-white/10" />
          <span className="font-mono text-xs text-neutral-500">
            {String(activeIndex + 1).padStart(2, "0")} / {String(testimonials.length).padStart(2, "0")}
          </span>
        </div>

        {/* Main Quote */}
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-20">
          <div className="lg:col-span-8">
            <blockquote
              className={`transition-all duration-300 ${
                isAnimating ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"
              }`}
            >
              <p className="font-display text-3xl md:text-4xl lg:text-5xl leading-[1.1] tracking-tight text-white">
                "{activeTestimonial.quote}"
              </p>
            </blockquote>

            {/* Author */}
            <div
              className={`mt-12 flex items-center gap-6 transition-all duration-300 delay-100 ${
                isAnimating ? "opacity-0" : "opacity-100"
              }`}
            >
              <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                <span className="font-display text-2xl text-[#FF6600]">
                  {activeTestimonial.author.charAt(0)}
                </span>
              </div>
              <div>
                <p className="text-lg font-semibold text-white">{activeTestimonial.author}</p>
                <p className="text-sm text-neutral-500">
                  {activeTestimonial.role}, {activeTestimonial.company}
                </p>
              </div>
            </div>
          </div>

          {/* Metric Highlight */}
          <div className="lg:col-span-4 flex flex-col justify-center">
            <div
              className={`p-8 border border-white/10 bg-[#070708]/30 rounded-xl transition-all duration-300 ${
                isAnimating ? "opacity-0 scale-95" : "opacity-100 scale-100"
              }`}
            >
              <span className="font-mono text-xs tracking-widest text-neutral-500 uppercase block mb-4">
                Key Result
              </span>
              <p className="font-display text-2xl md:text-3xl text-[#FF6600] font-bold">
                {activeTestimonial.metric}
              </p>
            </div>

            {/* Navigation Dots */}
            <div className="flex gap-2 mt-8">
              {testimonials.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setIsAnimating(true);
                    setTimeout(() => {
                      setActiveIndex(idx);
                      setIsAnimating(false);
                    }, 300);
                  }}
                  className={`h-2 transition-all duration-300 ${
                    idx === activeIndex
                      ? "w-8 bg-[#FF6600]"
                      : "w-2 bg-white/25 hover:bg-white/40"
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Company Logos Marquee Label */}
        <div className="mt-24 pt-12 border-t border-white/10">
          <p className="font-mono text-xs tracking-widest text-neutral-500 uppercase mb-8 text-center">
            Calibrated with trusted energy networks
          </p>
        </div>
      </div>
      
      {/* Full-width marquee outside container */}
      <div className="w-full relative z-10 overflow-hidden py-4 border-y border-white/5 bg-black/40">
        <div className="flex gap-16 items-center marquee">
          {[...Array(2)].map((_, setIdx) => (
            <div key={setIdx} className="flex gap-16 items-center shrink-0">
              {partners.map(
                (company, idx) => (
                  <span
                    key={`${setIdx}-${company}-${idx}`}
                    className="font-display text-xl md:text-2xl text-neutral-500 whitespace-nowrap hover:text-white transition-colors duration-300"
                  >
                    {company}
                  </span>
                )
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
