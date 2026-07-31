"use client";

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Menu, X, ChevronDown, Brain, Cpu, Zap,
  BarChart3, ShieldCheck, BookOpen, Map, ScanLine,
  User, Settings, LogOut, Sparkles
} from "lucide-react";

const EASING = "cubic-bezier(0.16,1,0.3,1)";

const platformItems = [
  {
    category: "Core Tools",
    items: [
      { icon: Map, label: "Rooftop Scanner", desc: "GIS satellite tracing & boundary detection", href: "/map", color: "#FF6600" },
      { icon: ScanLine, label: "Yield Simulator", desc: "NASA irradiance + panel config engine", href: "/map", color: "#FF6600" },
    ]
  },
  {
    category: "Intelligence",
    items: [
      { icon: BarChart3, label: "Market Insights", desc: "National capacity & cost trajectories", href: "/market-insights", color: "#10B981" },
      { icon: ShieldCheck, label: "Policy Tracker", desc: "State subsidies & DISCOM tariffs", href: "/policy-tracker", color: "#10B981" },
    ]
  },
];

export function Navigation() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [platformOpen, setPlatformOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const platformRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 30);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (platformRef.current && !platformRef.current.contains(e.target as Node)) setPlatformOpen(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Lock body scroll when mobile menu open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const goTo = (path: string) => {
    setPlatformOpen(false);
    setUserOpen(false);
    setMobileOpen(false);
    navigate(path);
  };

  return (
    <>
      <style>{`
        @keyframes navDropIn {
          from { opacity: 0; transform: translateY(-8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes mobileSlideIn {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .nav-drop { animation: navDropIn 220ms ${EASING} both; }
        .mobile-link { animation: mobileSlideIn 350ms ${EASING} both; }
      `}</style>

      <header
        className="fixed z-[100] w-full transition-all"
        style={{ transition: `padding 400ms ${EASING}`, padding: isScrolled ? "12px 16px" : "0" }}
      >
        <nav
          className="mx-auto transition-all"
          style={{
            maxWidth: isScrolled ? "1100px" : "100%",
            background: isScrolled
              ? "rgba(5,5,6,0.85)"
              : "transparent",
            backdropFilter: isScrolled ? "blur(24px) saturate(160%)" : "none",
            border: isScrolled ? "1px solid rgba(255,255,255,0.08)" : "none",
            borderRadius: isScrolled ? "20px" : "0",
            boxShadow: isScrolled ? "0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)" : "none",
            transition: `all 400ms ${EASING}`,
          }}
        >
          <div
            className="flex items-center justify-between px-6"
            style={{
              height: isScrolled ? "56px" : "72px",
              transition: `height 300ms ${EASING}`,
            }}
          >
            {/* ── Logo ────────────────────────────────── */}
            <button
              onClick={() => goTo("/")}
              className="flex items-center gap-2.5 group cursor-pointer border-none bg-transparent"
              aria-label="SolarScan AI Home"
            >
              <div className="relative">
                <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain transition-transform group-hover:scale-110" style={{ transition: `transform 250ms ${EASING}` }} />
                <div className="absolute inset-0 rounded-full blur-md bg-[#FF6600]/20 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
              </div>
              <span className="text-[15px] font-bold text-white tracking-tight">
                SUNPOWER <span style={{ fontFamily: "'Calistoga', serif", fontWeight: 400 }} className="text-[#FF6600]">LINK</span>
              </span>
            </button>

            {/* ── Desktop Nav ───────────────────────── */}
            <div className="hidden md:flex items-center gap-1">

              {/* Platform Mega-Dropdown */}
              <div ref={platformRef} className="relative">
                <button
                  onClick={() => { setPlatformOpen(!platformOpen); setUserOpen(false); }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm text-white/60 hover:text-white hover:bg-white/5 border border-transparent transition-all cursor-pointer"
                  style={{ transition: `all 200ms ${EASING}` }}
                >
                  Platform
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${platformOpen ? "rotate-180" : ""}`} style={{ transition: `transform 200ms ${EASING}` }} />
                </button>

                {platformOpen && (
                  <div
                    className="nav-drop absolute top-[calc(100%+8px)] left-0 w-[400px] rounded-2xl overflow-hidden z-50"
                    style={{
                      background: "rgba(8,8,10,0.98)",
                      backdropFilter: "blur(40px) saturate(180%)",
                      border: "1px solid rgba(255,255,255,0.10)",
                      boxShadow: "0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)",
                    }}
                  >
                    {platformItems.map((group) => (
                      <div key={group.category} className="p-4 border-b border-white/[0.06] last:border-0">
                        <p className="text-[9px] font-mono font-bold text-white/30 uppercase tracking-[0.15em] mb-3">{group.category}</p>
                        <div className="space-y-1">
                          {group.items.map((item) => (
                            <button
                              key={item.label}
                              onClick={() => goTo(item.href)}
                              className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-all group/item cursor-pointer border-none text-left"
                              style={{ transition: `all 200ms ${EASING}` }}
                            >
                              <div
                                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border border-white/10"
                                style={{ background: `${item.color}15` }}
                              >
                                <item.icon className="w-4 h-4" style={{ color: item.color }} />
                              </div>
                              <div>
                                <div className="text-xs font-semibold text-white">{item.label}</div>
                                <div className="text-[10px] text-white/40 font-mono mt-0.5">{item.desc}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                    {/* Bottom CTA */}
                    <div className="p-4" style={{ background: "rgba(255,102,0,0.04)", borderTop: "1px solid rgba(255,102,0,0.12)" }}>
                      <button
                        onClick={() => goTo("/map")}
                        className="w-full h-10 rounded-xl text-xs font-bold text-black flex items-center justify-center gap-2 cursor-pointer border-none"
                        style={{ background: "linear-gradient(135deg,#FF6600,#FF8C38)", boxShadow: "0 0 20px rgba(255,102,0,0.25)" }}
                      >
                        <Zap className="w-3.5 h-3.5 fill-current" /> Launch Analyzer Now
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Simple nav links */}
              {[
                { label: "Technology", href: "#technology" },
                { label: "Process", href: "#workflow" },
                { label: "Pricing", href: "#pricing" },
              ].map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="px-4 py-2 rounded-xl text-sm text-white/60 hover:text-white hover:bg-white/5 transition-all border border-transparent"
                  style={{ transition: `all 200ms ${EASING}` }}
                >
                  {link.label}
                </a>
              ))}
            </div>

            {/* ── Desktop Right CTAs ────────────────── */}
            <div className="hidden md:flex items-center gap-2">
              {user ? (
                <div ref={userRef} className="relative">
                  <button
                    onClick={() => { setUserOpen(!userOpen); setPlatformOpen(false); }}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/8 transition-all cursor-pointer"
                    style={{ transition: `all 200ms ${EASING}` }}
                  >
                    <div className="w-6 h-6 rounded-lg bg-[#FF6600]/20 border border-[#FF6600]/30 flex items-center justify-center">
                      <User className="w-3 h-3 text-[#FF6600]" />
                    </div>
                    <span className="text-xs font-medium truncate max-w-[100px]">{user.email?.split("@")[0]}</span>
                    <ChevronDown className={`w-3.5 h-3.5 text-white/40 transition-transform ${userOpen ? "rotate-180" : ""}`} style={{ transition: `transform 200ms ${EASING}` }} />
                  </button>

                  {userOpen && (
                    <div
                      className="nav-drop absolute top-[calc(100%+8px)] right-0 w-52 rounded-2xl overflow-hidden z-50"
                      style={{
                        background: "rgba(8,8,10,0.98)",
                        backdropFilter: "blur(40px)",
                        border: "1px solid rgba(255,255,255,0.10)",
                        boxShadow: "0 24px 80px rgba(0,0,0,0.7)",
                      }}
                    >
                      {[
                        { icon: ScanLine, label: "My Scans", href: "/my-scans" },
                        { icon: Settings, label: "Settings", href: "/settings" },
                        { icon: BookOpen, label: "API Docs", href: "/api-docs" },
                      ].map((item) => (
                        <button
                          key={item.label}
                          onClick={() => goTo(item.href)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-xs text-white/60 hover:text-white hover:bg-white/5 transition-all cursor-pointer border-none text-left border-b border-white/[0.05] last:border-0"
                          style={{ transition: `all 150ms ${EASING}` }}
                        >
                          <item.icon className="w-4 h-4 text-white/40" />
                          {item.label}
                        </button>
                      ))}
                      <button
                        onClick={() => { signOut(); setUserOpen(false); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-xs text-red-400/70 hover:text-red-400 hover:bg-red-500/5 transition-all cursor-pointer border-none text-left border-t border-white/[0.05]"
                        style={{ transition: `all 150ms ${EASING}` }}
                      >
                        <LogOut className="w-4 h-4" /> Sign Out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => goTo("/auth/signin")}
                  className="px-4 py-2 rounded-xl text-sm text-white/60 hover:text-white hover:bg-white/5 border border-transparent transition-all cursor-pointer"
                  style={{ transition: `all 200ms ${EASING}` }}
                >
                  Sign In
                </button>
              )}
              <button
                onClick={() => goTo("/map")}
                className="flex items-center gap-2 h-9 px-5 rounded-xl text-xs font-bold text-black cursor-pointer border-none"
                style={{
                  background: "linear-gradient(135deg,#FF6600,#FF8C38)",
                  boxShadow: "0 0 20px rgba(255,102,0,0.25), inset 0 1px 0 rgba(255,255,255,0.15)",
                  transition: `all 200ms ${EASING}`,
                }}
                onMouseEnter={e => { (e.target as HTMLElement).style.boxShadow = "0 0 32px rgba(255,102,0,0.45), inset 0 1px 0 rgba(255,255,255,0.2)"; (e.target as HTMLElement).style.transform = "translateY(-1px)"; }}
                onMouseLeave={e => { (e.target as HTMLElement).style.boxShadow = "0 0 20px rgba(255,102,0,0.25), inset 0 1px 0 rgba(255,255,255,0.15)"; (e.target as HTMLElement).style.transform = "translateY(0)"; }}
              >
                <Sparkles className="w-3.5 h-3.5" /> Launch Analyzer
              </button>
            </div>

            {/* ── Mobile Hamburger ─────────────────── */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden w-10 h-10 rounded-xl flex items-center justify-center bg-white/5 border border-white/10 text-white cursor-pointer"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </nav>
      </header>

      {/* ── Full-Screen Mobile Menu ─────────────── */}
      <div
        className="md:hidden fixed inset-0 z-[90] flex flex-col"
        style={{
          background: "rgba(5,5,6,0.97)",
          backdropFilter: "blur(40px)",
          opacity: mobileOpen ? 1 : 0,
          pointerEvents: mobileOpen ? "auto" : "none",
          transition: `opacity 300ms ${EASING}`,
        }}
      >
        <div className="flex flex-col h-full px-6 pt-24 pb-8 overflow-y-auto">
          {/* Main nav items */}
          <nav className="flex-1 flex flex-col justify-center gap-1 mb-8">
            {[
              { label: "Launch Analyzer", href: "/map", big: true, accent: true },
              { label: "Market Insights", href: "/market-insights", big: true },
              { label: "Policy Tracker", href: "/policy-tracker", big: true },
              { label: "Technology", href: "#technology", big: false },
              { label: "Process", href: "#workflow", big: false },
              { label: "Pricing", href: "#pricing", big: false },
            ].map((item, i) => (
              <button
                key={item.label}
                onClick={() => { setMobileOpen(false); item.href.startsWith("/") ? navigate(item.href) : undefined; }}
                className={`text-left px-4 py-3 rounded-2xl cursor-pointer border-none font-bold transition-all ${
                  item.accent
                    ? "text-black"
                    : item.big
                    ? "text-white hover:bg-white/5"
                    : "text-white/50 hover:text-white hover:bg-white/5 text-sm"
                }`}
                style={{
                  fontFamily: item.big ? "'Calistoga', serif" : "'Inter', sans-serif",
                  fontSize: item.big ? "clamp(24px, 6vw, 40px)" : "15px",
                  background: item.accent ? "linear-gradient(135deg,#FF6600,#FF8C38)" : "transparent",
                  boxShadow: item.accent ? "0 0 24px rgba(255,102,0,0.25)" : "none",
                  animation: mobileOpen ? `mobileSlideIn 400ms ${EASING} ${i * 50}ms both` : "none",
                  fontWeight: item.big ? 400 : 600,
                  transition: `background 200ms ${EASING}`,
                }}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Bottom auth row */}
          <div
            className="border-t border-white/10 pt-6 flex flex-col gap-3"
            style={{ animation: mobileOpen ? `mobileSlideIn 400ms ${EASING} 400ms both` : "none" }}
          >
            {user ? (
              <>
                <div className="flex gap-3">
                  <button onClick={() => { setMobileOpen(false); navigate("/my-scans"); }} className="flex-1 h-12 rounded-2xl bg-white/5 border border-white/10 text-white text-sm font-semibold cursor-pointer">My Scans</button>
                  <button onClick={() => { setMobileOpen(false); navigate("/settings"); }} className="flex-1 h-12 rounded-2xl bg-white/5 border border-white/10 text-white text-sm font-semibold cursor-pointer">Settings</button>
                </div>
                <button onClick={() => { setMobileOpen(false); signOut(); }} className="h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-semibold cursor-pointer">Sign Out</button>
              </>
            ) : (
              <button onClick={() => { setMobileOpen(false); navigate("/auth/signin"); }} className="h-12 rounded-2xl bg-white/5 border border-white/10 text-white text-sm font-semibold cursor-pointer">Sign In</button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
