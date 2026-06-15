import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
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
import LanguageSwitcher from "@/components/LanguageSwitcher";

const LandingPage = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [platformOpen, setPlatformOpen] = useState(false);
  const [heroSearchQuery, setHeroSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState("");
  const [showMobileCta, setShowMobileCta] = useState(false);

  const progressBarRef = useRef<HTMLDivElement>(null);

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
    document.title = "SUNPOWER LINK - India's Rooftop Solar Potential Estimator";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute("content", "SUNPOWER LINK maps your rooftop solar potential with satellite-precision, instantly computing grid savings, panel geometry layouts, and PM scheme subsidies.");
    }
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
      <nav className={`fixed w-full z-[1000] transition-all duration-300 ${isNavActive ? "bg-[#050505]/[0.97] backdrop-blur-xl py-3 border-b border-white/8" : "bg-transparent py-5"}`}>
        {/* Scroll progress line — visible only when scrolled */}
        <div
          ref={progressBarRef}
          className="absolute bottom-0 left-0 h-px bg-[#FF6600] transition-all duration-150 ease-out"
          style={{ width: "0%" }}
        />


        <div className="max-w-7xl mx-auto px-5 md:px-6 flex justify-between items-center relative z-50">
          <a href="#" className="flex items-center gap-2 group">
            <img src="/logo.png" alt="SUNPOWER LINK Logo" className="w-8 h-8 object-contain transition-all duration-300 group-hover:scale-105" />
            <span className="text-lg font-bold tracking-tight text-white">
              SUNPOWER <span className="font-serif italic font-light">LINK</span>
            </span>
          </a>

          {/* Active section breadcrumb removed to prevent overlap with links */}

          {/* Desktop links */}
          <div className="hidden md:flex items-center space-x-7 text-sm font-medium h-full">
            <div
              className="group cursor-pointer flex items-center gap-1 transition-colors h-10 text-neutral-400 hover:text-[#FF6600]"
              onMouseEnter={() => setPlatformOpen(true)}
              onMouseLeave={() => setPlatformOpen(false)}
            >
              <span>Platform</span>
              <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${platformOpen ? "rotate-180" : ""}`} />

              {platformOpen && (
                <div className="absolute left-0 top-full w-full border-b border-white/8 backdrop-blur-3xl bg-[#050505]/[0.97] z-50">
                  <div className="max-w-7xl mx-auto px-6 py-12">
                    <div className="grid grid-cols-12 gap-12">
                      <div className="col-span-4 space-y-8">
                        <div>
                          <p className="text-[11px] font-mono text-neutral-600 uppercase tracking-[0.18em] mb-4">Core Capabilities</p>
                          <ul className="space-y-4 list-none p-0">
                            <li>
                              <a href="#" onClick={(e) => { e.preventDefault(); setPlatformOpen(false); navigate("/map"); }} className="group flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-white/4 transition-colors">
                                <div className="w-8 h-8 rounded flex items-center justify-center bg-[#FF6600]/10 text-[#FF6600] group-hover:bg-[#FF6600] group-hover:text-black transition-colors">
                                  <Brain className="w-4 h-4" />
                                </div>
                                <div>
                                  <div className="font-medium text-white">Spatial Tracing</div>
                                  <div className="text-xs text-neutral-600">Trace roof boundaries and setbacks</div>
                                </div>
                              </a>
                            </li>
                            <li>
                              <a href="#" onClick={(e) => { e.preventDefault(); setPlatformOpen(false); navigate("/map"); }} className="group flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-white/4 transition-colors">
                                <div className="w-8 h-8 rounded flex items-center justify-center bg-[#FF6600]/10 text-[#FF6600] group-hover:bg-[#FF6600] group-hover:text-black transition-colors">
                                  <Cpu className="w-4 h-4" />
                                </div>
                                <div>
                                  <div className="font-medium text-white">Yield Simulator</div>
                                  <div className="text-xs text-neutral-600">Calculate NASA Power generation yields</div>
                                </div>
                              </a>
                            </li>
                          </ul>
                        </div>
                      </div>
                      <div className="col-span-4 space-y-6">
                        <div>
                          <p className="text-[11px] font-mono text-neutral-600 uppercase tracking-[0.18em] mb-3">Use Cases</p>
                          <ul className="space-y-2.5 text-sm list-none p-0">
                            <li><a href="#" onClick={(e) => { e.preventDefault(); setPlatformOpen(false); navigate("/map"); }} className="text-neutral-500 hover:text-[#FF6600] transition-colors flex items-center gap-2 group"><span>Residential Homes</span><ArrowRight className="w-3 h-3 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" /></a></li>
                            <li><a href="#" onClick={(e) => { e.preventDefault(); setPlatformOpen(false); navigate("/map"); }} className="text-neutral-500 hover:text-[#FF6600] transition-colors flex items-center gap-2 group"><span>Commercial Properties</span><ArrowRight className="w-3 h-3 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" /></a></li>
                          </ul>
                        </div>
                        <div>
                          <p className="text-[11px] font-mono text-neutral-600 uppercase tracking-[0.18em] mb-3">Insights & Policies</p>
                          <ul className="space-y-2.5 text-sm list-none p-0">
                            <li><a href="#" onClick={(e) => { e.preventDefault(); setPlatformOpen(false); navigate("/market-insights"); }} className="text-neutral-500 hover:text-[#FF6600] transition-colors flex items-center gap-2 group"><span>Market Insights</span><ArrowRight className="w-3 h-3 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" /></a></li>
                            <li><a href="#" onClick={(e) => { e.preventDefault(); setPlatformOpen(false); navigate("/policy-tracker"); }} className="text-neutral-500 hover:text-[#FF6600] transition-colors flex items-center gap-2 group"><span>Policy Tracker</span><ArrowRight className="w-3 h-3 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" /></a></li>
                          </ul>
                        </div>
                      </div>
                      <div className="col-span-4">
                        <div className="bg-neutral-900 rounded-xl overflow-hidden border border-white/8 relative group cursor-pointer h-full min-h-[180px]" onClick={() => { setPlatformOpen(false); navigate("/map"); }}>
                          <img src="https://images.unsplash.com/photo-1509391366360-2e959784a276?q=80&w=2070&auto=format&fit=crop" className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700" alt="Solar Farm" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-12 h-12 rounded-xl bg-white/8 backdrop-blur-md border border-white/15 flex items-center justify-center group-hover:bg-[#FF6600] group-hover:text-black group-hover:border-transparent transition-all shadow-xl">
                              <Play className="w-5 h-5 fill-current ml-0.5" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
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
                {activeSection === id && isScrolled && (
                  <span className="absolute -bottom-1 left-0 right-0 h-px bg-[#FF6600]" />
                )}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center space-x-4">
            <LanguageSwitcher />
            <button
              onClick={() => navigate("/map")}
              className="btn-primary px-5 h-10 text-sm font-bold rounded-xl active:scale-[0.98] transition-all border-none cursor-pointer bg-[#FF6600] text-black hover:bg-orange-500 shadow-lg shadow-[#FF6600]/20 hover:shadow-[#FF6600]/40"
            >
              Launch Analyzer
            </button>
          </div>

          <div className="md:hidden flex items-center space-x-2">
            <LanguageSwitcher />
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 active:scale-90 transition-transform text-white">
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
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
            <a onClick={() => { setMobileMenuOpen(false); navigate("/policy-tracker"); }} className="border-b border-white/8 pb-3 hover:text-[#FF6600] transition-colors flex justify-between group cursor-pointer">
              <span>Policy Tracker</span>
              <span className="text-white/20 group-hover:text-[#FF6600]">→</span>
            </a>
            <button
              onClick={() => { setMobileMenuOpen(false); navigate("/map"); }}
              className="btn-primary bg-[#FF6600] text-black hover:bg-orange-500 w-full py-4 text-base mt-2 rounded-xl flex items-center justify-center gap-2 border-none cursor-pointer font-bold"
            >
              Launch Analyzer
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero — Optimized Scroll & Copy ─────────── */}
      <section
        id="hero"
        className="relative h-[100dvh] flex flex-col justify-center items-center text-center overflow-hidden bg-black"
        aria-label="Hero — Calculate Your Solar Potential"
      >
        <div id="hero-bg" className="absolute inset-0 z-0 scale-110">
          <img
            src="https://i.postimg.cc/nFT9Rhzw/hf-20260129-171005-8aec9a7d-9d5e-48c9-a88c-0728bf22e731.webp"
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
            Calculate Your Rooftop<br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-500 italic font-medium block md:inline mt-2 md:mt-0">
              {" "}Solar Potential in 60 Seconds
            </span>
          </h1>

          <p className="text-base md:text-xl text-neutral-300 max-w-xl md:max-w-2xl mx-auto mb-10 md:mb-12 font-light leading-relaxed px-4 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
            Generate your own power and claim up to <strong className="text-emerald-400 font-semibold">₹78,000 in national subsidies</strong>. No engineering degrees or manual grid utility rate sheets required.
          </p>

          <div
            className="w-full max-w-lg mx-auto mb-6 p-1.5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl flex items-center shadow-2xl focus-within:border-[#FF6600]/40 focus-within:ring-2 focus-within:ring-[#FF6600]/20 transition-all duration-300 animate-fade-in-up"
            style={{ animationDelay: "200ms" }}
          >
            <Search className="w-5 h-5 text-neutral-400 ml-3.5 shrink-0" />
            <input
              type="text"
              placeholder={currentPlaceholder}
              value={heroSearchQuery}
              onChange={(e) => setHeroSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleHeroSearch(); }}
              className="flex-1 bg-transparent border-none outline-none px-3 py-3 text-sm text-white placeholder:text-neutral-500 font-sans"
            />
            <button
              onClick={handleHeroSearch}
              className="btn-primary bg-[#FF6600] text-black hover:bg-orange-500 px-6 h-10 text-xs rounded-xl font-bold transition-all shrink-0 border-none cursor-pointer"
            >
              Calculate My Savings →
            </button>
          </div>


          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-neutral-400 animate-fade-in-up" style={{ animationDelay: "250ms" }}>
            <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-[#FF6600]" /> Instant GIS scan</span>
            <span>•</span>
            <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-[#FF6600]" /> PM scheme subsidy estimator</span>
          </div>
        </div>

        {/* Scroll cue */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1 opacity-40 animate-bounce">
          <div className="w-px h-6 bg-white/60" />
          <ChevronDown className="w-4 h-4 text-white" />
        </div>
      </section>

      {/* ── Content ──────────────────────────────────────────── */}
      <main className="bg-[#050505]">

        {/* ── Data Standards Strip ─────────────────────────── */}
        <section className="border-b border-white/5 py-14 bg-[#050505] text-center">
          <div className="max-w-[1200px] mx-auto px-6">
            <p className="text-[11px] font-mono text-neutral-700 uppercase tracking-[0.2em] mb-8">
              Empowered by leading data standards &amp; systems
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
              <p className="text-[#FF6600] font-mono text-[11px] uppercase tracking-[0.2em]">The Technology</p>
              <h2 className="text-3xl md:text-4xl font-extrabold text-white mt-2 tracking-tight">
                SolarNet<span className="text-[#FF6600] font-extrabold">.</span>
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
                Instead of bouncing between complex engineering calculators, mapping software, and utility rate sheets,{" "}
                <span className="text-[#FF6600] font-semibold transition-all duration-300 hover:text-orange-400">SUNPOWER LINK</span>{" "}
                provides a single AI-powered canvas for rooftop detection, layout design, and financial mapping.
              </h3>
            </div>
          </div>
        </section>

        {/* ── AI Feature Grid ──────────────────────────────── */}
        <section className="py-24 md:py-32 bg-[#050505] border-b border-white/5 reveal-on-scroll" id="about">
          <div className="max-w-[1200px] mx-auto px-6">
            <div className="mb-20 text-center">
              {/* Plain text label */}
              <p className="text-[#FFAA00] font-mono text-[11px] uppercase tracking-[0.2em] mb-4">AI at the Core</p>
              <h2 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-[1.1] max-w-2xl mx-auto">
                SUNPOWER LINK is built from the ground up{" "}
                <span className="text-[#FF6600]">for Indian rooftops.</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-0 max-w-4xl mx-auto">
              {[
                { Icon: AIIcon, text: "Automated rooftop identification and boundary tracing via SolarNet AI neural networks" },
                { Icon: SunPulseIcon, text: "Direct integration with NASA POWER database for geographical solar irradiance mapping" },
                { Icon: ChartIcon, text: "Localized net metering utility tariff algorithms configured for Indian distribution licensees" },
                { Icon: LocationPinIcon, text: "Automatic panel layout generation optimized to minimize shaded areas" },
                { Icon: ZapIcon, text: "Real-time offset equations to gauge immediate CO₂ and environmental impacts" },
                { Icon: FileIcon, text: "One-click exports for comprehensive PDF solar capability reports" },
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
            <p className="text-[11px] font-mono text-neutral-700 uppercase tracking-[0.2em] mb-16">Real impact. Real numbers.</p>
            <div className="flex flex-col md:flex-row justify-center items-center gap-16 md:gap-0">
              <div className="flex-1 reveal-on-scroll">
                <p className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-br from-[#FF6600] to-[#FFAA00] tracking-[-3px] leading-none">₹84K</p>
                <p className="text-[11px] text-neutral-600 font-mono uppercase tracking-[0.16em] mt-5">average annual savings per home</p>
              </div>
              <div className="hidden md:block w-px h-24 bg-white/5 mx-8" />
              <div className="flex-1 reveal-on-scroll" style={{ transitionDelay: "80ms" }}>
                <p className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-br from-[#FFAA00] to-[#FFD600] tracking-[-3px] leading-none">18.2T</p>
                <p className="text-[11px] text-neutral-600 font-mono uppercase tracking-[0.16em] mt-5">CO₂ tons avoided annually</p>
              </div>
              <div className="hidden md:block w-px h-24 bg-white/5 mx-8" />
              <div className="flex-1 reveal-on-scroll" style={{ transitionDelay: "160ms" }}>
                <p className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-br from-[#FF6600] to-amber-300 tracking-[-3px] leading-none">3min</p>
                <p className="text-[11px] text-neutral-600 font-mono uppercase tracking-[0.16em] mt-5">full roof analysis time</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── How It Works ─────────────────────────────────── */}
        <section className="py-24 md:py-32 bg-[#050505] border-b border-white/5 reveal-on-scroll" id="workflow">
          <div className="max-w-[1200px] mx-auto px-6">
            <div className="mb-20 text-center">
              {/* Plain text label */}
              <p className="text-neutral-500 font-mono text-[11px] uppercase tracking-[0.2em] mb-4">How It Works</p>
              <h2 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-[1.1] max-w-lg mx-auto">
                Three steps to your solar future.
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
              {[
                { step: "01", title: "Find Your Roof", desc: "Enter your address or pincode. Our satellite imagery engine locates your property on the map instantly.", Icon: LocationPinIcon },
                { step: "02", title: "Trace & Analyze", desc: "Draw your rooftop boundary. SolarNet AI computes panel geometry, shading losses, and solar yield from NASA irradiance data.", Icon: AIIcon },
                { step: "03", title: "Get Your Report", desc: "Receive a detailed savings projection, PM Surya Ghar subsidy estimate, and payback period — all in under 3 minutes.", Icon: FileIcon },
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
                    <span>Start here</span>
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
              <p className="text-[#FF6600] font-mono text-[11px] uppercase tracking-[0.2em]">Regional Databases</p>
              <h3 className="text-2xl md:text-3xl font-bold text-white mt-2 leading-tight max-w-xs">
                Solar models calibrated for major Indian urban centers.
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
              <p className="text-[#FFAA00] font-mono text-[11px] uppercase tracking-[0.2em] mb-5">Knowledge Base</p>
              <h2 className="text-3xl md:text-5xl font-extrabold text-white leading-[1.1] tracking-tight">
                Common queries from <br />
                <span className="text-neutral-600 italic font-light">homeowners &amp; developers.</span>
              </h2>
            </div>
            <div className="border-t border-white/5">
              {[
                { q: "How does SolarNet analyze my roof?", a: "Our deep learning neural networks analyze geographic coordinate tiles to identify boundaries, slopes, and shading from surrounding foliage or buildings, generating a high-fidelity rendering of your usable solar surface area." },
                { q: "What is NASA POWER data?", a: "The NASA Prediction of Worldwide Energy Resources (POWER) project distributes solar irradiance data. We integrate this to assess localized daily and yearly solar radiation based on GPS coordinates." },
                { q: "Are the savings calculations accurate?", a: "Calculations match local electricity utility tariff schedules (slab charges, fixed fees, and taxes) against net energy production predictions, making final estimations highly realistic." },
                { q: "What is the PM Surya Ghar scheme?", a: "PM Surya Ghar: Muft Bijli Yojana is the Government of India's flagship rooftop solar subsidy scheme offering up to ₹78,000 for residential installations. SUNPOWER LINK automatically calculates your applicable subsidy based on system capacity." },
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
          title="Your rooftop is an untapped power station."
          action={{
            text: "Analyze Your Rooftop →",
            href: "/map",
            variant: "glow"
          }}
          className="border-t border-b border-white/5 bg-[#050505] py-20 sm:py-24"
        />

        <div className="max-w-[1200px] mx-auto px-6 relative z-10 pt-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 pb-20 border-b border-white/5">
            <div className="lg:col-span-4 space-y-6">
              <div className="flex items-center gap-2">
                <img src="/logo.png" alt="SUNPOWER LINK Logo" className="w-8 h-8 object-contain" />
                <span className="text-lg font-bold text-white">SUNPOWER <span className="font-serif italic font-light">LINK</span></span>
              </div>
              <p className="text-neutral-600 text-sm leading-relaxed max-w-xs">The AI-native solar intelligence system for modern energy planning in India.</p>
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
            <span>© {new Date().getFullYear()} SUNPOWER LINK. Rooftop solar analysis for India. All Rights Reserved.</span>
            <div className="flex space-x-6">
              <button onClick={() => navigate("/privacy")} className="hover:text-[#FF6600] transition-colors bg-transparent border-none cursor-pointer p-0">Privacy Policy</button>
              <button className="hover:text-[#FF6600] transition-colors bg-transparent border-none cursor-pointer p-0">Sitemap</button>
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
            <span>Analyze My Rooftop</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}


    </div>
  );
};

export default LandingPage;
