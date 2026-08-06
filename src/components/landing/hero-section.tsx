"use client";

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Search, Check, ChevronDown } from "lucide-react";
import { AnimatedSphere } from "./animated-sphere";

const words = ["detect", "model", "calculate", "save"];

export function HeroSection() {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);
  const [wordIndex, setWordIndex] = useState(0);
  const [heroSearchQuery, setHeroSearchQuery] = useState("");

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
    setIsVisible(true);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % words.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  // Typing effect
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

  const handleHeroSearch = () => {
    if (heroSearchQuery.trim()) {
      navigate(`/map?q=${encodeURIComponent(heroSearchQuery.trim())}`);
    }
  };

  return (
    <section className="relative min-h-[100dvh] flex flex-col justify-center overflow-hidden bg-black pt-16">
      {/* Background Image with Dark Gradients */}
      <div className="absolute inset-0 z-0 scale-110">
        <img
          src="https://i.postimg.cc/nFT9Rhzw/hf-20260129-171005-8aec9a7d-9d5e-48c9-a88c-0728bf22e731.webp"
          alt="Solar Studio Pro Background Landscape"
          className="w-full h-full object-cover object-[center_60%] md:object-center opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/90 via-black/30 to-black z-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-10" />
      </div>

      {/* Animated sphere background */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[600px] h-[600px] lg:w-[800px] lg:h-[800px] opacity-40 pointer-events-none z-20">
        <AnimatedSphere />
      </div>
      
      {/* Subtle grid lines */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20 z-10">
        {[...Array(8)].map((_, i) => (
          <div
            key={`h-${i}`}
            className="absolute h-px bg-white/10"
            style={{
              top: `${12.5 * (i + 1)}%`,
              left: 0,
              right: 0,
            }}
          />
        ))}
        {[...Array(12)].map((_, i) => (
          <div
            key={`v-${i}`}
            className="absolute w-px bg-white/10"
            style={{
              left: `${8.33 * (i + 1)}%`,
              top: 0,
              bottom: 0,
            }}
          />
        ))}
      </div>
      
      <div className="relative z-30 max-w-[1400px] mx-auto px-6 lg:px-12 py-32 lg:py-40">
        {/* Eyebrow */}
        <div 
          className={`mb-8 transition-all duration-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <span className="inline-flex items-center gap-3 text-sm font-mono text-neutral-400">
            <span className="w-8 h-px bg-[#FF6600]/50" />
            Autonomous Solar Intelligence
          </span>
        </div>
        
        {/* Main headline */}
        <div className="mb-12">
          <h1 
            className={`text-[clamp(2.5rem,8vw,6.5rem)] font-display leading-[1.0] tracking-tight transition-all duration-1000 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <span className="block text-white">The platform</span>
            <span className="block text-white">
              to{" "}
              <span className="relative inline-block text-[#FF6600]">
                <span 
                  key={wordIndex}
                  className="inline-flex"
                >
                  {words[wordIndex].split("").map((char, i) => (
                    <span
                      key={`${wordIndex}-${i}`}
                      className="inline-block animate-char-in"
                      style={{
                        animationDelay: `${i * 50}ms`,
                      }}
                    >
                      {char}
                    </span>
                  ))}
                </span>
                <span className="absolute -bottom-2 left-0 right-0 h-2 bg-[#FF6600]/20" />
              </span>{" "}
              rooftop solar.
            </span>
          </h1>
        </div>
        
        {/* Description & Search */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-end">
          <div
            className={`space-y-8 transition-all duration-700 delay-200 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            <p className="text-lg lg:text-xl text-neutral-300 leading-relaxed max-w-xl">
              Calculate your rooftop solar potential with satellite-precision. 
              Instantly compute grid savings, panel geometry layouts, and claim up to 
              <strong className="text-emerald-400 font-semibold"> ₹78,000 in national subsidies</strong>.
            </p>
            
            {/* Search Input Box */}
            <div className="w-full max-w-lg p-1.5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl flex items-center shadow-2xl focus-within:border-white/30 focus-within:ring-2 focus-within:ring-white/10 transition-all duration-300">
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
                Calculate Savings →
              </button>
            </div>
            
            {/* Mini details list */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-neutral-400">
              <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-[#FF6600]" /> Instant GIS scan</span>
              <span>•</span>
              <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-[#FF6600]" /> PM Surya Ghar estimator</span>
            </div>
          </div>
          
          {/* CTAs */}
          <div 
            className={`flex flex-col sm:flex-row items-start gap-4 transition-all duration-700 delay-300 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            <Button 
              size="lg" 
              onClick={() => navigate("/map")}
              className="bg-[#FF6600] hover:bg-[#FF6600]/90 text-black px-8 h-14 text-base rounded-full font-bold shadow-lg shadow-[#FF6600]/20 hover:shadow-[#FF6600]/40 group"
            >
              Start Free Scan
              <Search className="w-4 h-4 ml-2 transition-transform group-hover:scale-110" />
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              onClick={() => navigate("/market-insights")}
              className="h-14 px-8 text-base rounded-full border-white/20 hover:bg-white/5 text-white"
            >
              Market Insights
            </Button>
          </div>
        </div>
      </div>
      
      {/* Stats marquee - full width outside container */}
      <div 
        className={`absolute bottom-12 left-0 right-0 transition-all duration-700 delay-500 z-30 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="flex gap-16 marquee whitespace-nowrap bg-black/40 backdrop-blur-md py-4 border-y border-white/5">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex gap-16">
              {[
                { value: "₹84,000", label: "average annual savings", company: "MSEDCL" },
                { value: "18.2 Tons", label: "CO₂ emissions avoided", company: "NASA POWER" },
                { value: "₹78,000", label: "max central subsidy", company: "PM SURYA GHAR" },
                { value: "3 mins", label: "average roof audit time", company: "SOLARNET AI" },
              ].map((stat, idx) => (
                <div key={`${stat.company}-${idx}`} className="flex items-baseline gap-4">
                  <span className="text-4xl lg:text-5xl font-display font-black text-[#FF6600]">{stat.value}</span>
                  <span className="text-sm text-neutral-300">
                    {stat.label}
                    <span className="block font-mono text-xs text-neutral-500 mt-1">{stat.company}</span>
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      
      {/* Scroll indicator */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1 opacity-40 animate-bounce">
        <ChevronDown className="w-4 h-4 text-white" />
      </div>
    </section>
  );
}
