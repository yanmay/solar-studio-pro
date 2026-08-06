"use client";

import { useNavigate } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { AnimatedWave } from "./animated-wave";

export function FooterSection() {
  const navigate = useNavigate();

  const footerLinks = {
    Product: [
      { name: "Launch Analyzer", action: () => navigate("/map") },
      { name: "Market Insights", action: () => navigate("/market-insights") },
      { name: "Policy Tracker", action: () => navigate("/policy-tracker") },
      { name: "Pricing Slabs", href: "#pricing" },
    ],
    Technology: [
      { name: "SolarNet AI Model", href: "#technology" },
      { name: "NASA Irradiance", href: "#regional-db" },
      { name: "DISCOM Slabs", href: "#regional-db" },
      { name: "Wind Load Limits", href: "#security" },
    ],
    Company: [
      { name: "About SolarScan", href: "#" },
      { name: "Careers", href: "#", badge: "Hiring" },
      { name: "Engineering Blog", href: "#" },
      { name: "Contact Support", href: "#" },
    ],
    Legal: [
      { name: "Privacy Policy", action: () => navigate("/privacy") },
      { name: "Terms of Service", href: "#" },
      { name: "MNRE Guidelines", href: "#" },
    ],
  };

  const socialLinks = [
    { name: "Twitter", href: "#" },
    { name: "GitHub", href: "#" },
    { name: "LinkedIn", href: "#" },
  ];

  return (
    <footer className="relative border-t border-white/10 bg-black z-30 pt-20">
      {/* Animated wave background */}
      <div className="absolute inset-x-0 bottom-0 h-64 opacity-25 pointer-events-none overflow-hidden">
        <AnimatedWave />
      </div>
      
      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12">
        {/* Main Footer */}
        <div className="py-16 lg:py-24">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-12 lg:gap-8">
            {/* Brand Column */}
            <div className="col-span-2 space-y-6">
              <a href="#" className="inline-flex items-center gap-2.5">
                <img src="/logo.svg" alt="SUNPOWER LINK Logo" className="w-10 h-10 object-contain" />
                <span className="text-lg font-bold text-white">
                  SUNPOWER <span className="font-serif italic font-light text-[#FF6600]">LINK</span>
                </span>
              </a>

              <p className="text-neutral-400 text-sm leading-relaxed max-w-xs">
                The AI-native solar intelligence system for modern energy planning in India.
              </p>

              {/* Social Links */}
              <div className="flex gap-6">
                {socialLinks.map((link) => (
                  <a
                    key={link.name}
                    href={link.href}
                    className="text-xs font-mono text-neutral-500 hover:text-[#FF6600] transition-colors flex items-center gap-1 group"
                  >
                    {link.name}
                    <ArrowUpRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                  </a>
                ))}
              </div>
            </div>

            {/* Link Columns */}
            {Object.entries(footerLinks).map(([title, links]) => (
              <div key={title}>
                <h3 className="text-xs font-mono text-neutral-500 uppercase tracking-widest mb-6">{title}</h3>
                <ul className="space-y-4 list-none p-0">
                  {links.map((link, idx) => (
                    <li key={`${link.name}-${idx}`}>
                      {link.action ? (
                        <button
                          onClick={link.action}
                          className="text-sm text-neutral-400 hover:text-[#FF6600] transition-colors inline-flex items-center gap-2 bg-transparent border-none p-0 cursor-pointer text-left"
                        >
                          {link.name}
                          {"badge" in link && link.badge && (
                            <span className="text-[10px] px-2 py-0.5 bg-[#FF6600] text-black rounded-full font-bold uppercase">
                              {link.badge}
                            </span>
                          )}
                        </button>
                      ) : (
                        <a
                          href={link.href}
                          className="text-sm text-neutral-400 hover:text-[#FF6600] transition-colors inline-flex items-center gap-2"
                        >
                          {link.name}
                          {"badge" in link && link.badge && (
                            <span className="text-[10px] px-2 py-0.5 bg-[#FF6600] text-black rounded-full font-bold uppercase">
                              {link.badge}
                            </span>
                          )}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="py-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-neutral-500 font-mono">
            © {new Date().getFullYear()} SUNPOWER LINK. All rights reserved.
          </p>

          <div className="flex items-center gap-4 text-xs text-neutral-500 font-mono">
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              All databases & geocoders active
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
