"use client";

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";

export function PricingSection() {
  const navigate = useNavigate();
  const [isAnnual, setIsAnnual] = useState(true);

  const plans = [
    {
      name: "Starter Preview",
      description: "For individual homeowners looking for quick estimates",
      price: { monthly: 0, annual: 0 },
      features: [
        "1-minute satellite map lookup",
        "Basic panel capacity estimate (kWp)",
        "NASA solar irradiance validation",
        "Estimated PM Surya Ghar subsidy slab check",
      ],
      cta: "Analyze My Roof",
      popular: false,
      onClick: () => navigate("/map"),
    },
    {
      name: "Single Report",
      description: "For detailed residential & commercial single roof analyses",
      price: { monthly: 149, annual: 149 },
      features: [
        "Everything in Preview",
        "Detailed monthly cashflow projections",
        "Custom setbacks & panel tilt angle editing",
        "DISCOM net metering tariff validation",
        "High-fidelity PDF report download",
      ],
      cta: "Unlock Report",
      popular: true,
      onClick: () => navigate("/map"),
    },
    {
      name: "Pro Installer",
      description: "For solar EPC installers and engineering teams",
      price: { monthly: 999, annual: 849 },
      features: [
        "Everything in Single Report",
        "Unlimited rooftop scanning & modeling",
        "Customer lead routing & email dispatcher",
        "Custom-branded PDF proposal templates",
        "API access for external software",
        "24/7 Priority support & SLA guarantee",
      ],
      cta: "Subscribe Pro",
      popular: false,
      onClick: () => navigate("/auth/signup"),
    },
  ];

  return (
    <section id="pricing" className="relative py-24 lg:py-32 border-t border-white/10 bg-black z-30">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        {/* Header */}
        <div className="max-w-3xl mb-20">
          <span className="font-mono text-xs tracking-widest text-neutral-500 uppercase block mb-6">
            Pricing Slabs
          </span>
          <h2 className="font-display text-5xl md:text-6xl lg:text-7xl tracking-tight text-white mb-6">
            Simple, transparent
            <br />
            <span className="text-[#FF6600]">pricing</span>
          </h2>
          <p className="text-lg text-neutral-400 max-w-xl">
            Start modeling for free. Unlock granular audits individually or subscribe for unlimited commercial pipelines.
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex items-center gap-4 mb-16">
          <span
            className={`text-sm transition-colors ${
              !isAnnual ? "text-white font-semibold" : "text-neutral-500"
            }`}
          >
            Monthly
          </span>
          <button
            onClick={() => setIsAnnual(!isAnnual)}
            className="relative w-14 h-7 bg-white/10 rounded-full p-1 transition-colors hover:bg-white/20"
            aria-label="Toggle billing duration"
          >
            <div
              className={`w-5 h-5 bg-[#FF6600] rounded-full transition-transform duration-300 ${
                isAnnual ? "translate-x-7" : "translate-x-0"
              }`}
            />
          </button>
          <span
            className={`text-sm transition-colors ${
              isAnnual ? "text-white font-semibold" : "text-neutral-500"
            }`}
          >
            Annual Billing
          </span>
          {isAnnual && (
            <span className="ml-2 px-2.5 py-1 bg-emerald-950 text-emerald-400 text-[10px] font-mono rounded-full font-bold uppercase">
              Save 15% on Pro
            </span>
          )}
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-px bg-white/10 rounded-2xl overflow-hidden border border-white/10">
          {plans.map((plan, idx) => (
            <div
              key={plan.name}
              className={`relative p-8 lg:p-12 bg-[#050505] flex flex-col justify-between ${
                plan.popular ? "md:border-2 md:border-[#FF6600]/80 md:-my-px z-10" : ""
              }`}
            >
              {plan.popular && (
                <span className="absolute top-0 right-8 -translate-y-1/2 px-3.5 py-1 bg-[#FF6600] text-black text-[10px] font-mono uppercase tracking-widest font-bold rounded-full">
                  Recommended
                </span>
              )}

              <div>
                {/* Plan Header */}
                <div className="mb-8">
                  <span className="font-mono text-xs text-neutral-600">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <h3 className="font-display text-2xl text-white mt-2 font-bold">{plan.name}</h3>
                  <p className="text-xs text-neutral-400 mt-2">{plan.description}</p>
                </div>

                {/* Price */}
                <div className="mb-8 pb-8 border-b border-white/5">
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-4xl lg:text-5xl text-white font-black">
                      ₹{idx === 0 ? "0" : idx === 1 ? plan.price.monthly : isAnnual ? plan.price.annual : plan.price.monthly}
                    </span>
                    <span className="text-neutral-500 text-xs font-mono uppercase">
                      {idx === 0 ? "" : idx === 1 ? "/ scan" : "/ month"}
                    </span>
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-4 mb-10">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className="w-4 h-4 text-[#FF6600] mt-0.5 shrink-0" />
                      <span className="text-xs text-neutral-400 leading-relaxed">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* CTA */}
              <button
                onClick={plan.onClick}
                className={`w-full py-3.5 flex items-center justify-center gap-2 text-xs font-bold transition-all rounded-xl cursor-pointer group ${
                  plan.popular
                    ? "bg-[#FF6600] text-black hover:bg-orange-500"
                    : "border border-white/10 text-white hover:border-[#FF6600]/30 hover:bg-white/[0.02]"
                }`}
              >
                {plan.cta}
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          ))}
        </div>

        {/* Bottom Note */}
        <p className="mt-12 text-center text-xs text-neutral-500 font-mono">
          All financial calculations match regulatory slabs for financial year 2026.{" "}
          <a onClick={() => navigate("/policy-tracker")} className="underline underline-offset-4 text-neutral-400 hover:text-white transition-colors cursor-pointer">
            View active policy trackers
          </a>
        </p>
      </div>
    </section>
  );
}
