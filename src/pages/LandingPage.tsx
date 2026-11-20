import React from "react";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Menu,
  X,
  ArrowRight,
  ChevronDown,
  Search,
  Check,
  Minus,
  Plus,
  Instagram,
  Linkedin,
  Twitter,
  Cpu,
  Play,
  Brain,
} from "lucide-react";
import {
  AIIcon,
  SunPulseIcon,
  ChartIcon,
  LocationPinIcon,
  ZapIcon,
  FileIcon,
} from "@/components/ui/animated-state-icons";
import { CTASection } from "@/components/ui/cta-with-glow";
import { ParallaxComponent } from "@/components/ui/parallax-scrolling";
import { Header } from "@/components/ui/header-3";


const LandingPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [platformOpen, setPlatformOpen] = useState(false);
  const [heroSearchQuery, setHeroSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState("");
  const [showMobileCta, setShowMobileCta] = useState(false);

  const progressBarRef = useRef<HTMLDivElement>(null);
  const platformRef = useRef<HTMLDivElement>(null);

  // Rotating placeholder typing effect for Hero search
  const placeholders = [
    "Enter your address, city, or pincode...",
    "Try 'Kothrud, Pune'...",
    "Try 'Indiranagar, Bangalore'...",
    "Try 'Connaught Place, Delhi'...",
    "Try 'Gachibowli, Hyderabad'...",
    "Try 'Andheri, Mumbai'..."
  ];
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [currentPlaceholder, setCurrentPlaceholder] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [typingSpeed, setTypingSpeed] = useState(80);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const fullText = placeholders[placeholderIndex];

    if (!isDeleting) {
      timer = setTimeout(() => {
        setCurrentPlaceholder(fullText.substring(0, currentPlaceholder.length + 1));
        setTypingSpeed(80);
      }, typingSpeed);

      if (currentPlaceholder === fullText) {
        timer = setTimeout(() => {
          setIsDeleting(true);
        }, 2500);
      }
    } else {
      timer = setTimeout(() => {
        setCurrentPlaceholder(fullText.substring(0, currentPlaceholder.length - 1));
        setTypingSpeed(40);
      }, typingSpeed);

      if (currentPlaceholder === "") {
        setIsDeleting(false);
        setPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
      }
    }

    return () => clearTimeout(timer);
  }, [currentPlaceholder, isDeleting, placeholderIndex]);

  // SEO
  useEffect(() => {
    document.title = "SolarScan AI - India's Rooftop Solar Potential Estimator";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute("content", "SolarScan AI maps your rooftop solar potential with satellite-precision, instantly computing grid savings, panel geometry layouts, and PM scheme subsidies.");
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (platformRef.current && !platformRef.current.contains(e.target as Node)) {
        setPlatformOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Scroll tracking (Optimized to prevent frequent React re-renders)
  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      
      setIsScrolled((prev) => {
        const next = y > 50;
        return prev === next ? prev : next;
      });

      setShowMobileCta((prev) => {
        const next = y > 300;
        return prev === next ? prev : next;
      });

      if (progressBarRef.current) {
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = docHeight > 0 ? Math.min(1, y / docHeight) : 0;
        progressBarRef.current.style.width = `${progress * 100}%`;
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);


  // Active section tracking for nav
  useEffect(() => {
    const sectionIds = ["technology", "about", "workflow", "faq"];
    const observers: IntersectionObserver[] = [];
    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveSection(id); },
        { threshold: 0.3 }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  // Scroll reveal (Optimized with positive rootMargin to trigger fade-in before entering viewport)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("is-visible");
        });
      },
      { threshold: 0.01, rootMargin: "0px 0px 100px 0px" }
    );
    const elements = document.querySelectorAll(
      ".reveal-on-scroll, .slide-in-left, .slide-in-right, .grow-line, .reveal-scale"
    );
    elements.forEach((el) => observer.observe(el));
    return () => elements.forEach((el) => observer.unobserve(el));
  }, []);

  const handleHeroSearch = () => {
    if (heroSearchQuery.trim()) {
      navigate(`/map?q=${encodeURIComponent(heroSearchQuery.trim())}`);
    }
  };

  const isNavActive = isScrolled || mobileMenuOpen;

  const sectionLabels: Record<string, string> = {
    technology: "Technology",
    about: "Architecture",
    workflow: "Process",
    faq: "FAQ",
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white antialiased selection:bg-[#FF6600]/30 selection:text-white overflow-x-hidden">

      {/* ── Nav ──────────────────────────────────────────────── */}
      <Header />
      <header
        className="hidden"
      >
        <nav
          className={`mx-auto transition-all duration-500 relative ${
            isScrolled || mobileMenuOpen
              ? "bg-[#050505] backdrop-blur-xl border border-white/10 rounded-2xl shadow-lg max-w-[1200px]"
              : "bg-transparent max-w-[1400px]"
          }`}
        >


          <div 
            className={`transition-all duration-500 px-6 lg:px-8 flex justify-between items-center relative z-50 ${
              isScrolled ? "h-14" : "h-20"
            }`}
          >
            <a href="#" className="flex items-center gap-2.5 group">
              <img 
                src="/logo.png" 
                alt="SolarScan AI Logo" 
                className={`object-contain transition-all duration-500 group-hover:scale-105 ${
                  isScrolled ? "w-9 h-9" : "w-12 h-12"
                }`} 
              />
              <span className="text-lg font-bold tracking-tight text-white transition-all duration-500">
                SUNPOWER <span className="font-serif italic font-light">LINK</span>
              </span>
            </a>

          {/* Active section breadcrumb removed to prevent overlap with links */}

          {/* Desktop links */}
          <div className="hidden md:flex items-center space-x-7 text-sm font-medium h-full">
            <div
              ref={platformRef}
              className="relative h-10 flex items-center"
            >
              <button
                onClick={() => setPlatformOpen(!platformOpen)}
                className="group cursor-pointer flex items-center gap-1.5 transition-colors text-neutral-300 hover:text-[#FF6600] bg-transparent border-none p-0 text-sm font-medium focus:outline-none"
                aria-expanded={platformOpen}
              >
                <span>Platform</span>
                <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${platformOpen ? "rotate-180 text-[#FF6600]" : "text-neutral-400"}`} />
              </button>

              {platformOpen && (
                <div className="absolute left-0 top-full mt-3 w-[580px] bg-[#0A0A0A]/95 backdrop-blur-3xl border border-white/15 rounded-3xl p-6 shadow-[0_25px_60px_rgba(0,0,0,0.9),0_0_40px_rgba(255,102,0,0.15)] z-[100] transition-all duration-200 animate-in fade-in-0 slide-in-from-top-2">
                  {/* Top glowing hair line */}
                  <div
                    className="absolute top-0 left-6 right-6 h-px pointer-events-none"
                    style={{ background: "linear-gradient(90deg, transparent, rgba(255,102,0,0.5), transparent)" }}
                    aria-hidden="true"
                  />

                  <div className="grid grid-cols-2 gap-6">
                    {/* Left Column: Core Capabilities */}
                    <div className="space-y-4">
                      <p className="text-[10px] font-mono font-bold text-[#FF6600] uppercase tracking-[0.18em]">
                        Core Capabilities
                      </p>
                      <div className="space-y-2">
                        <a
                          href="#"
                          onClick={(e) => { e.preventDefault(); setPlatformOpen(false); navigate("/map"); }}
                          className="group flex items-start gap-3 p-2.5 rounded-2xl hover:bg-white/5 transition-all border border-transparent hover:border-white/10"
                        >
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#FF6600]/10 text-[#FF6600] border border-[#FF6600]/20 shrink-0 group-hover:scale-105 group-hover:bg-[#FF6600] group-hover:text-black transition-all">
                            <Brain className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-white group-hover:text-[#FF6600] transition-colors leading-tight">
                              Spatial Tracing
                            </div>
                            <div className="text-xs text-white/50 leading-normal mt-0.5">
                              Satellite roof boundary tracing & geometry
                            </div>
                          </div>
                        </a>

                        <a
                          href="#"
                          onClick={(e) => { e.preventDefault(); setPlatformOpen(false); navigate("/map"); }}
                          className="group flex items-start gap-3 p-2.5 rounded-2xl hover:bg-white/5 transition-all border border-transparent hover:border-white/10"
                        >
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#FF6600]/10 text-[#FF6600] border border-[#FF6600]/20 shrink-0 group-hover:scale-105 group-hover:bg-[#FF6600] group-hover:text-black transition-all">
                            <Cpu className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-white group-hover:text-[#FF6600] transition-colors leading-tight">
                              Yield Simulator
                            </div>
                            <div className="text-xs text-white/50 leading-normal mt-0.5">
                              NASA POWER irradiance & temperature models
                            </div>
                          </div>
                        </a>
                      </div>
                    </div>

                    {/* Right Column: Insights & Ecosystem */}
                    <div className="space-y-4">
                      <p className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-[0.18em]">
                        Insights & Ecosystem
                      </p>
                      <div className="space-y-2">
                        <a
                          href="#"
                          onClick={(e) => { e.preventDefault(); setPlatformOpen(false); navigate("/market-insights"); }}
                          className="group flex items-start gap-3 p-2.5 rounded-2xl hover:bg-white/5 transition-all border border-transparent hover:border-white/10"
                        >
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0 group-hover:scale-105 group-hover:bg-emerald-400 group-hover:text-black transition-all">
                            <ChartIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-white group-hover:text-emerald-400 transition-colors leading-tight">
                              Market Insights
                            </div>
                            <div className="text-xs text-white/50 leading-normal mt-0.5">
                              Tariff trends, DISCOM rates & payback benchmarks
                            </div>
                          </div>
                        </a>

                        <a
                          href="#"
                          onClick={(e) => { e.preventDefault(); setPlatformOpen(false); navigate("/policy-tracker"); }}
                          className="group flex items-start gap-3 p-2.5 rounded-2xl hover:bg-white/5 transition-all border border-transparent hover:border-white/10"
                        >
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0 group-hover:scale-105 group-hover:bg-amber-400 group-hover:text-black transition-all">
                            <FileIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-white group-hover:text-amber-400 transition-colors leading-tight">
                              Policy Tracker
                            </div>
                            <div className="text-xs text-white/50 leading-normal mt-0.5">
                              PM Surya Ghar subsidies & net-metering state rules
                            </div>
                          </div>
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Quick Action Banner */}
                  <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between">
                    <span className="text-xs text-white/60 font-mono">
                      Ready to analyze your roof?
                    </span>
                    <button
                      onClick={() => { setPlatformOpen(false); navigate("/map"); }}
                      className="px-4 py-2 text-xs font-bold rounded-xl bg-[#FF6600] text-black hover:bg-orange-500 transition-all active:scale-95 flex items-center gap-1.5 border-none cursor-pointer shadow-md shadow-[#FF6600]/20"
                    >
                      <span>{t("landing.launchSpatialScan")}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {[
              { href: "#about", label: "Architecture", id: "about" },
              { href: "#technology", label: "Technology", id: "technology" },
              { href: "#workflow", label: "Process", id: "workflow" },
              { href: "#faq", label: "FAQ", id: "faq" },
            ].map(({ href, label, id }) => (
              <a
                key={id}
                href={href}
                className={`transition-colors relative ${activeSection === id && isScrolled ? "text-[#FF6600]" : "text-neutral-400 hover:text-white"}`}
              >
                {label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center space-x-3">
            <button
              onClick={() => navigate("/installer/signup")}
              className="group relative px-4 h-9 text-xs font-semibold rounded-full transition-all duration-300 border border-amber-500/40 text-amber-300 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-amber-500/10 hover:bg-amber-500/20 hover:border-amber-400 hover:text-amber-200 hover:shadow-[0_0_20px_rgba(245,158,11,0.35)] flex items-center gap-2 cursor-pointer backdrop-blur-md overflow-hidden active:scale-95"
            >
              {/* Light sweep animation on hover */}
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-400/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out pointer-events-none" />

              <span className="tracking-wide font-semibold">{t("landing.forInstallers")}</span>

              <ArrowRight className="w-3.5 h-3.5 text-amber-400/80 group-hover:text-amber-300 group-hover:translate-x-0.5 transition-all duration-300" />
            </button>

            <button
              onClick={() => navigate("/map")}
              className="btn-primary px-5 h-10 text-sm font-bold rounded-xl active:scale-[0.98] transition-all border-none cursor-pointer bg-[#FF6600] text-black hover:bg-orange-500 shadow-lg shadow-[#FF6600]/20 hover:shadow-[#FF6600]/40"
            >
              {t("landing.launchAnalyzer")}
            </button>
          </div>

          <div className="md:hidden flex items-center space-x-2">
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 active:scale-90 transition-transform text-white">
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Horizontal Scrollable Tabs */}
        <div className="md:hidden flex items-center overflow-x-auto whitespace-nowrap scrollbar-none py-2 px-4 mt-2 gap-4 bg-black/40">
          {[
            { href: "#about", label: "Architecture", id: "about" },
            { href: "#technology", label: "Technology", id: "technology" },
            { href: "#workflow", label: "Process", id: "workflow" },
            { href: "#faq", label: "FAQ", id: "faq" },
          ].map(({ href, label, id }) => (
            <a
              key={id}
              href={href}
              className={`transition-colors relative text-xs font-medium px-3 py-1.5 rounded-lg ${activeSection === id ? "text-[#FF6600] bg-white/5 font-semibold" : "text-neutral-400 hover:text-white"}`}
            >
              {label}
            </a>
          ))}
          <a
            onClick={() => navigate("/market-insights")}
            className="transition-colors text-xs font-medium px-3 py-1.5 text-neutral-400 hover:text-white cursor-pointer"
          >
            Market Insights
          </a>
          <a
            onClick={() => navigate("/policy-tracker")}
            className="transition-colors text-xs font-medium px-3 py-1.5 text-neutral-400 hover:text-white cursor-pointer"
          >
            Policy Tracker
          </a>
        </div>

        {/* Mobile menu */}
        <div className={`fixed inset-0 bg-[#050505]/[0.98] backdrop-blur-3xl z-40 transition-all duration-300 ease-out md:hidden flex flex-col pt-24 px-6 ${mobileMenuOpen ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-4 pointer-events-none"}`}>
          <div className="flex flex-col space-y-5 text-lg font-medium tracking-tight text-neutral-300 overflow-y-auto max-h-[80vh] pb-8">
            {[
              { href: "#about", label: "Architecture" },
              { href: "#technology", label: "Technology" },
              { href: "#workflow", label: "Process" },
              { href: "#faq", label: "FAQ" },
            ].map(({ href, label }) => (
              <a key={href} href={href} onClick={() => setMobileMenuOpen(false)} className="border-b border-white/8 pb-3 hover:text-[#FF6600] transition-colors flex justify-between group">
                <span>{label}</span>
                <span className="text-white/20 group-hover:text-[#FF6600]">→</span>
              </a>
            ))}
            <a onClick={() => { setMobileMenuOpen(false); navigate("/market-insights"); }} className="border-b border-white/8 pb-3 hover:text-[#FF6600] transition-colors flex justify-between group cursor-pointer">
              <span>Market Insights</span>
              <span className="text-white/20 group-hover:text-[#FF6600]">→</span>
            </a>
            <a onClick={() => { setMobileMenuOpen(false); navigate("/installer/signup"); }} className="border-b border-amber-500/20 pb-3 text-amber-400 hover:text-amber-300 transition-colors flex justify-between items-center group cursor-pointer">
              <span>Installer Partner Portal</span>
              <span className="text-amber-400/50 group-hover:text-amber-400">→</span>
            </a>
            <button
              onClick={() => { setMobileMenuOpen(false); navigate("/map"); }}
              className="btn-primary bg-[#FF6600] text-black hover:bg-orange-500 w-full py-4 text-base mt-2 rounded-xl flex items-center justify-center gap-2 border-none cursor-pointer font-bold"
            >
              {t("landing.launchAnalyzer")}
            </button>
          </div>
        </div>
        </nav>
      </header>

      {/* ── Hero — Optimized Scroll & Copy ─────────── */}
      <section
        id="hero"
        className="relative flex min-h-screen flex-col justify-center items-center text-center overflow-hidden bg-black"
        style={{ minHeight: "100dvh" }}
        aria-label="Hero — Calculate Your Solar Potential"
      >
        <div id="hero-bg" className="absolute inset-0 z-0 scale-110">
          <img
            src="/hero-bg.webp"
            alt="Dusk Hills Landscape"
            className="w-full h-full object-cover object-[center_60%] md:object-center opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/20 to-black z-10" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-10" />
        </div>


        <div
          id="hero-content"
          className="relative z-10 max-w-5xl mx-auto px-5 md:px-6 w-full flex flex-col items-center justify-center h-full pb-20 md:pb-0"
        >

          <h1 className="text-[2.5rem] leading-[1.15] sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6 md:mb-8 animate-fade-in-up font-display text-white">
            {t("landing.heroHeading1")}<br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-500 italic font-medium block md:inline mt-2 md:mt-0">
              {" "}{t("landing.heroHeadingHighlight")}
            </span>
          </h1>

          <p className="text-base md:text-xl text-neutral-300 max-w-xl md:max-w-2xl mx-auto mb-10 md:mb-12 font-light leading-relaxed px-4 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
            Generate your own power and claim up to <strong className="text-emerald-400 font-semibold">₹78,000 in national subsidies</strong>. No engineering degrees or manual grid utility rate sheets required.
          </p>

          {/* Glowing Search Box Container */}
          <div
            className="relative w-full max-w-xl mx-auto mb-8 animate-fade-in-up"
            style={{ animationDelay: "200ms" }}
          >
            {/* Ambient behind-glow */}
            <div
              className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-[#FF6600]/30 via-amber-500/20 to-[#059669]/30 blur-xl opacity-75 group-hover:opacity-100 transition-opacity pointer-events-none"
              aria-hidden="true"
            />
            
            <div className="relative w-full p-2 bg-[#0A0A0A]/90 backdrop-blur-2xl border border-white/15 rounded-2xl flex items-center shadow-2xl focus-within:border-[#FF6600]/60 focus-within:ring-2 focus-within:ring-[#FF6600]/30 transition-all duration-300">
              <Search className="w-5 h-5 text-[#FF6600] ml-3.5 shrink-0" />
              <input
                type="text"
                placeholder={currentPlaceholder}
                value={heroSearchQuery}
                onChange={(e) => setHeroSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleHeroSearch(); }}
                className="flex-1 bg-transparent border-none outline-none px-3 py-2.5 text-sm text-white placeholder:text-neutral-500 font-sans"
              />
              <button
                onClick={handleHeroSearch}
                className="btn-primary bg-gradient-to-r from-[#FF6600] to-amber-500 text-black hover:brightness-110 active:scale-[0.98] px-6 h-11 text-xs rounded-xl font-bold transition-all shrink-0 border-none cursor-pointer shadow-lg shadow-[#FF6600]/25 flex items-center gap-2"
              >
                <span>{t("landing.heroSearchCta")}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-xs text-neutral-500 animate-fade-in-up" style={{ animationDelay: "250ms" }}>
            <span className="flex items-center gap-2">
              <Check className="w-3 h-3 text-[#FF6600] shrink-0" />
              {t("landing.trustScan")}
            </span>
            <span className="hidden sm:block w-px h-3 bg-white/10" />
            <span className="flex items-center gap-2">
              <Check className="w-3 h-3 text-emerald-500 shrink-0" />
              {t("landing.trustSubsidy")}
            </span>
            <span className="hidden sm:block w-px h-3 bg-white/10" />
            <span className="flex items-center gap-2">
              <Check className="w-3 h-3 text-emerald-500 shrink-0" />
              {t("landing.trustNoSignup")}
            </span>
          </div>
        </div>

        {/* Scroll cue */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1 opacity-40 animate-bounce">
          <div className="w-px h-6 bg-white/60" />
          <ChevronDown className="w-4 h-4 text-white" />
        </div>
      </section>

      <ParallaxComponent />

      {/* ── Content ──────────────────────────────────────────── */}
      <main className="bg-[#050505]">

        {/* ── Data Standards Strip ─────────────────────────── */}
        <section className="border-b border-white/5 py-14 bg-[#050505] text-center">
          <div className="max-w-[1200px] mx-auto px-6">
            <p className="text-[11px] font-mono text-neutral-700 uppercase tracking-[0.2em] mb-8">
              {t("landing.dataSectionLabel")}
            </p>
            <div className="flex flex-wrap justify-center items-center gap-x-12 gap-y-5">
              <span className="font-mono font-bold text-sm tracking-wider text-neutral-300">NASA POWER API</span>
              <span className="w-px h-4 bg-white/8 hidden sm:block" />
              <span className="font-mono text-sm text-neutral-600">ISRO Bhuvan</span>
              <span className="w-px h-4 bg-white/8 hidden sm:block" />
              <span className="font-mono font-bold text-sm text-[#FFAA00] tracking-[0.14em]">SOLARNET AI</span>
              <span className="w-px h-4 bg-white/8 hidden sm:block" />
              <span className="font-mono text-sm text-neutral-500 uppercase">MSEDCL Rates</span>
              <span className="w-px h-4 bg-white/8 hidden sm:block" />
              <span className="font-mono text-sm text-neutral-600">BESCOM Tariff</span>
            </div>
          </div>
        </section>

        {/* ── SolarNet Technology ──────────────────────────── */}
        <section className="py-24 md:py-36 bg-[#0a0a0a] border-b border-white/5 relative overflow-hidden reveal-on-scroll" id="technology">
          <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "radial-gradient(ellipse at 80% 50%, rgba(255,102,0,0.05) 0%, transparent 55%)" }} />
          
          <style>{`
            @keyframes flowLine {
              0% { transform: translateX(-120%); }
              100% { transform: translateX(600%); }
            }
            .animate-flow-line {
              animation: flowLine 3s cubic-bezier(0.4, 0, 0.2, 1) infinite;
            }
          `}</style>

          <div className="max-w-[1200px] mx-auto px-6 flex flex-col lg:flex-row gap-16 items-center justify-between relative z-10">
            <div className="w-full lg:w-[35%] flex flex-col gap-3 slide-in-left">
              {/* Plain text label — no capsule */}
              <p className="text-[#FF6600] font-mono text-[11px] uppercase tracking-[0.2em]">{t("landing.techLabel")}</p>
              <h2 className="text-3xl md:text-4xl font-extrabold text-white mt-2 tracking-tight">
                {t("landing.techHeading").replace(".", "")}<span className="text-[#FF6600] font-extrabold">.</span>
              </h2>
              
              {/* Animated scanner/data lines */}
              <div className="mt-8 space-y-3.5 relative">
                {[
                  100, 82, 64, 46, 30, 16
                ].map((w, i) => (
                  <div key={i} className="relative h-px bg-white/10 overflow-hidden" style={{ width: `${w}%` }}>
                    <div 
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-transparent via-[#FF6600]/65 to-transparent w-24 h-full animate-flow-line"
                      style={{
                        animationDelay: `${i * 120}ms`,
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="w-full lg:w-[60%] flex flex-col slide-in-right">
              <h3 className="text-3xl md:text-[2.6rem] font-light text-white leading-[1.25] tracking-[-0.025em]">
                {t("landing.techBody").split("SolarScan AI")[0]}<span className="text-[#FF6600] font-semibold transition-all duration-300 hover:text-orange-400">SolarScan AI</span>{t("landing.techBody").split("SolarScan AI")[1]}</h3>
            </div>
          </div>
        </section>

        {/* ── AI Feature Grid ──────────────────────────────── */}
        <section className="py-24 md:py-32 bg-[#050505] border-b border-white/5 reveal-on-scroll" id="about">
          <div className="max-w-[1200px] mx-auto px-6">
            <div className="mb-20 text-center">
              {/* Plain text label */}
              <p className="text-[#FFAA00] font-mono text-[11px] uppercase tracking-[0.2em] mb-4">{t("landing.aboutLabel")}</p>
              <h2 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-[1.1] max-w-2xl mx-auto">
                {t("landing.aboutHeading").replace("for Indian rooftops.", "")}<span className="text-[#FF6600]">for Indian rooftops.</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-0 max-w-4xl mx-auto">
              {[
                { Icon: AIIcon,          text: t("landing.feature1") },
                { Icon: SunPulseIcon,    text: t("landing.feature2") },
                { Icon: ChartIcon,       text: t("landing.feature3") },
                { Icon: LocationPinIcon, text: t("landing.feature4") },
                { Icon: ZapIcon,         text: t("landing.feature5") },
                { Icon: FileIcon,        text: t("landing.feature6") },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="flex gap-5 items-start py-6 border-b border-white/5 reveal-on-scroll"
                  style={{ transitionDelay: `${idx * 60}ms` }}
                >
                  <div className="w-10 h-10 flex items-center justify-center text-[#FF6600] shrink-0 mt-0.5">
                    <item.Icon size={20} color="#FF6600" />
                  </div>
                  <p className="text-[15px] text-neutral-400 font-light leading-relaxed pt-1.5">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Stats ────────────────────────────────────────── */}
        <section className="py-24 md:py-32 bg-[#0a0a0a] border-b border-white/5 text-center reveal-on-scroll">
          <div className="max-w-[1200px] mx-auto px-6">
            <p className="text-sm text-neutral-400 mb-2">{t("landing.statsHeadingLabel")}</p>
            <p className="text-[11px] font-mono text-neutral-700 uppercase tracking-[0.2em] mb-16">{t("landing.statsHeadingCaption")}</p>
            <div className="flex flex-col md:flex-row justify-center items-center gap-16 md:gap-0">
              <div className="flex-1 reveal-on-scroll">
                <p className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-br from-[#FF6600] to-[#FFAA00] tracking-[-3px] leading-none">₹84K</p>
                <p className="text-sm text-neutral-400 mt-3">{t("landing.statsSavingsLabel")}</p>
                <p className="text-[11px] text-neutral-700 mt-1">{t("landing.statsSavingsCaption")}</p>
              </div>
              <div className="hidden md:block w-px h-24 bg-white/5 mx-8" />
              <div className="flex-1 reveal-on-scroll" style={{ transitionDelay: "80ms" }}>
                <p className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-br from-[#FFAA00] to-[#FFD600] tracking-[-3px] leading-none">{t("landing.statsCo2Value")}</p>
                <p className="text-[11px] text-neutral-600 font-mono uppercase tracking-[0.16em] mt-5">CO₂ tons avoided annually</p>
              </div>
              <div className="hidden md:block w-px h-24 bg-white/5 mx-8" />
              <div className="flex-1 reveal-on-scroll" style={{ transitionDelay: "160ms" }}>
                <p className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-br from-[#FF6600] to-amber-300 tracking-[-3px] leading-none">{t("landing.statsTimeValue")}</p>
                <p className="text-sm text-neutral-400 mt-3">{t("landing.statsTimeLabel")}</p>
                <p className="text-[11px] text-neutral-700 mt-1">{t("landing.statsTimeCaption")}</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── How It Works ─────────────────────────────────── */}
        <section className="py-24 md:py-32 bg-[#050505] border-b border-white/5 reveal-on-scroll" id="workflow">
          <div className="max-w-[1200px] mx-auto px-6">
            <div className="mb-20 text-center">
              {/* Plain text label */}
              <p className="text-neutral-500 font-mono text-[11px] uppercase tracking-[0.2em] mb-4">{t("landing.howLabel")}</p>
              <h2 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-[1.1] max-w-lg mx-auto">
                {t("landing.howHeading")}
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
              {[
                { step: "01", title: t("landing.step1Title"), desc: t("landing.step1Desc"), Icon: LocationPinIcon },
                { step: "02", title: t("landing.step2Title"), desc: t("landing.step2Desc"), Icon: AIIcon },
                { step: "03", title: t("landing.step3Title"), desc: t("landing.step3Desc"), Icon: FileIcon },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="reveal-on-scroll bg-[#0f0f0f] border border-white/5 rounded-2xl p-8 group hover:border-[#FF6600]/25 transition-all duration-500 cursor-pointer"
                  style={{ transitionDelay: `${idx * 100}ms` }}
                  onClick={() => navigate("/map")}
                >
                  <div className="flex items-start justify-between mb-8">
                    <span className="text-6xl font-mono font-black text-white/4 group-hover:text-[#FF6600]/10 transition-colors leading-none">{item.step}</span>
                    <div className="text-[#FF6600] flex items-center justify-center transition-colors duration-300">
                      <item.Icon size={28} color="currentColor" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3 tracking-tight">{item.title}</h3>
                  <p className="text-sm text-neutral-600 leading-relaxed font-light">{item.desc}</p>
                  <div className="mt-6 flex items-center gap-2 text-xs text-[#FF6600]/0 group-hover:text-[#FF6600] transition-all duration-300 font-mono uppercase tracking-widest">
                    <span>{t("landing.stepStartHere")}</span>
                    <ArrowRight className="w-3.5 h-3.5 -translate-x-1 group-hover:translate-x-0 transition-transform" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── City Navigator ────────────────────────────────── */}
        <section className="py-24 bg-[#0a0a0a] border-b border-white/5 reveal-on-scroll">
          <div className="max-w-[1200px] mx-auto px-6 grid grid-cols-1 md:grid-cols-12 gap-12">
            <div className="md:col-span-4 flex flex-col gap-3 slide-in-left">
              {/* Plain text label */}
              <p className="text-[#FF6600] font-mono text-[11px] uppercase tracking-[0.2em]">{t("landing.citiesLabel")}</p>
              <h3 className="text-2xl md:text-3xl font-bold text-white mt-2 leading-tight max-w-xs">
                {t("landing.citiesHeading")}
              </h3>
              <p className="text-sm text-neutral-600 font-light leading-relaxed mt-3 max-w-xs">
                City-specific irradiance data, utility tariffs, and state incentive schemes — pre-loaded for accurate local analysis.
              </p>
            </div>
            <div className="md:col-span-8 flex flex-col gap-0 slide-in-right">
              {["Pune, Maharashtra", "Bangalore, Karnataka", "Delhi National Capital Region", "Hyderabad, Telangana", "Mumbai Municipal Region"].map((city, idx) => (
                <div
                  key={idx}
                  onClick={() => navigate("/map")}
                  className="group flex items-baseline justify-between border-b border-white/5 py-5 hover:border-[#FF6600]/25 transition-all cursor-pointer"
                >
                  <span className="text-xl sm:text-2xl font-light text-neutral-600 group-hover:text-white transition-colors duration-300">{city}</span>
                  <ArrowRight className="w-5 h-5 text-neutral-800 group-hover:text-[#FF6600] transition-all transform group-hover:translate-x-1 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </section>

      </main>

      {/* ── FAQ & Footer ─────────────────────────────────────── */}
      <footer className="bg-[#050505] pt-24 relative overflow-hidden border-t border-white/5 reveal-on-scroll" id="faq">
        <div className="max-w-[1200px] mx-auto px-6 relative z-10">

          <div className="mb-24">
            <div className="mb-12">
              {/* Plain text label */}
              <p className="text-[#FFAA00] font-mono text-[11px] uppercase tracking-[0.2em] mb-5">{t("landing.faqLabel")}</p>
              <h2 className="text-3xl md:text-5xl font-extrabold text-white leading-[1.1] tracking-tight">
                {t("landing.faqHeading")}
              </h2>
            </div>
            <div className="border-t border-white/5">
              {[
                { q: t("landing.faq1Q"), a: t("landing.faq1A") },
                { q: t("landing.faq2Q"), a: t("landing.faq2A") },
                { q: t("landing.faq3Q"), a: t("landing.faq3A") },
                { q: t("landing.faq4Q"), a: t("landing.faq4A") },
              ].map((faq, index) => (
                <div className="border-b border-white/5" key={index}>
                  <button
                    onClick={() => setOpenFaq(openFaq === index ? null : index)}
                    className="w-full py-7 flex justify-between items-center text-left px-2 cursor-pointer border-none bg-transparent"
                  >
                    <span className={`text-lg md:text-xl font-light transition-colors ${openFaq === index ? "text-[#FF6600]" : "text-white/75 hover:text-white"}`}>{faq.q}</span>
                    <span className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-all shrink-0 ml-4 ${openFaq === index ? "bg-[#FF6600] text-black border-[#FF6600]" : "border-white/10 text-neutral-600"}`}>
                      <Plus className={`w-4 h-4 transition-transform duration-300 ${openFaq === index ? "rotate-45" : ""}`} />
                    </span>
                  </button>
                  <div className={`transition-all duration-300 overflow-hidden ${openFaq === index ? "max-h-48 opacity-100 pb-7" : "max-h-0 opacity-0"}`}>
                    <div className="px-2 text-neutral-500 max-w-2xl text-sm leading-relaxed font-light">{faq.a}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── CTA Section with Ambient Glow ─────────────────── */}
        <CTASection
          title={t("landing.ctaHeroTitle")}
          action={{
            text: t("landing.cta") + " \u2192",
            href: "/map",
            variant: "glow"
          }}
          className="border-t border-b border-white/5 bg-[#050505] py-20 sm:py-24"
        />

        <div className="max-w-[1200px] mx-auto px-6 relative z-10 pt-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 pb-20 border-b border-white/5">
            <div className="lg:col-span-4 space-y-6">
              <div className="flex items-center gap-2">
                <img src="/logo.png" alt="SolarScan AI Logo" className="w-12 h-12 object-contain" />
                <span className="text-lg font-bold text-white">SUNPOWER <span className="font-serif italic font-light">LINK</span></span>
              </div>
              <p className="text-neutral-600 text-sm leading-relaxed max-w-xs">{t("landing.footerTagline")}</p>
              <div className="flex space-x-4 text-neutral-700">
                <a href="#" className="hover:text-[#FF6600] transition-colors"><Instagram className="w-5 h-5" /></a>
                <a href="#" className="hover:text-[#FF6600] transition-colors"><Linkedin className="w-5 h-5" /></a>
                <a href="#" className="hover:text-[#FF6600] transition-colors"><Twitter className="w-5 h-5" /></a>
              </div>
            </div>
            <div className="lg:col-span-8 grid grid-cols-2 md:grid-cols-5 gap-8">
              {[
                { title: "Product", links: [{ label: "Analyze Rooftop", action: () => navigate("/map") }, { label: "View Sample Map", action: () => navigate("/map") }] },
                { title: "Resources", links: [{ label: "Market Insights", action: () => navigate("/market-insights") }, { label: "Policy Tracker", action: () => navigate("/policy-tracker") }] },
                { title: "Company", links: [{ label: "About Us", action: () => {} }, { label: "Contact", action: () => {} }] },
                { title: "Technology", links: [{ label: "SolarNet AI", action: () => {} }, { label: "NASA Integration", action: () => {} }] },
                { title: "Legal", links: [{ label: "Privacy Policy", action: () => navigate("/privacy") }, { label: "Terms of Service", action: () => {} }] },
              ].map((col) => (
                <div key={col.title}>
                  <h4 className="text-neutral-500 font-mono mb-5 text-[11px] uppercase tracking-[0.14em]">{col.title}</h4>
                  <ul className="space-y-3 text-sm text-neutral-700 list-none p-0">
                    {col.links.map((link) => (
                      <li key={link.label}>
                        <button onClick={link.action} className="hover:text-[#FF6600] transition-colors cursor-pointer bg-transparent border-none p-0 text-left">
                          {link.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="py-8 flex flex-col md:flex-row justify-between items-center gap-6 text-xs text-neutral-700 font-mono">
            <span>© {new Date().getFullYear()} SolarScan AI. Rooftop solar analysis for India. All Rights Reserved.</span>
            <div className="flex space-x-6">
              <button onClick={() => navigate("/privacy")} className="hover:text-[#FF6600] transition-colors bg-transparent border-none cursor-pointer p-0">{t("landing.footerPrivacy")}</button>
              <button className="hover:text-[#FF6600] transition-colors bg-transparent border-none cursor-pointer p-0">{t("landing.footerSitemap")}</button>
            </div>
          </div>

        </div>

        <div className="absolute bottom-0 left-0 right-0 overflow-hidden pointer-events-none select-none flex justify-center opacity-[0.018]">
          <h1 className="text-[18vw] font-black leading-[0.75] tracking-tighter text-white">SUNPOWER</h1>
        </div>
      </footer>

      {/* Mobile Sticky CTA */}
      {showMobileCta && (
        <div className="fixed bottom-0 left-0 right-0 z-40 p-4 bg-[#050505]/95 backdrop-blur-md border-t border-white/8 md:hidden animate-in slide-in-from-bottom duration-300">
          <button
            onClick={() => navigate("/map")}
            className="btn-primary w-full py-3.5 bg-[#FF6600] text-black font-bold text-sm rounded-xl hover:bg-orange-500 transition-all active:scale-[0.98] border-none cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>{t("landing.mobileCta")}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}


    </div>
  );
};

export default LandingPage;


