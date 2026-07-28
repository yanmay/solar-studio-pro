"use client";

import { useState, useEffect, useRef } from "react";
import { Copy, Check } from "lucide-react";

const codeExamples = [
  {
    label: "Install",
    code: `npm install @sunpowerlink/sdk

# or
yarn add @sunpowerlink/sdk
pnpm add @sunpowerlink/sdk`,
  },
  {
    label: "Initialize",
    code: `import { Sunpower } from '@sunpowerlink/sdk'

const api = new Sunpower({
  apiKey: process.env.SUNPOWER_API_KEY
})`,
  },
  {
    label: "Analyze",
    code: `const ledger = await api.analyze({
  lat: 18.5204,
  lng: 73.8567,
  polygon: roofVertices,
  discom: 'MSEDCL'
})

console.log('Annual Yield:', ledger.annualKwh)
console.log('PM Subsidy:', ledger.subsidyInr)`,
  },
];

const features = [
  { 
    title: "TypeScript Native", 
    description: "Full type safety with auto-generated interface definitions."
  },
  { 
    title: "DISCOM Slabs Pre-loaded", 
    description: "Active tariff ledgers for over 32 regional utilities."
  },
  { 
    title: "NASA Weather Feeds", 
    description: "Automated retrieval of historical irradiance models."
  },
  { 
    title: "JSON-RPC & REST", 
    description: "Integrate scan modules directly into existing CRMs."
  },
];

const codeAnimationStyles = `
  .dev-code-line {
    opacity: 0;
    transform: translateX(-8px);
    animation: devLineReveal 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }
  
  @keyframes devLineReveal {
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  
  .dev-code-char {
    opacity: 0;
    filter: blur(8px);
    animation: devCharReveal 0.3s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }
  
  @keyframes devCharReveal {
    to {
      opacity: 1;
      filter: blur(0);
    }
  }
`;

export function DevelopersSection() {
  const [activeTab, setActiveTab] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(codeExamples[activeTab].code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
    <section id="developers" ref={sectionRef} className="relative py-24 lg:py-32 overflow-hidden bg-black border-t border-white/5 z-30">
      <style dangerouslySetInnerHTML={{ __html: codeAnimationStyles }} />
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-start">
          {/* Left: Content */}
          <div
            className={`transition-all duration-700 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <span className="inline-flex items-center gap-3 text-sm font-mono text-neutral-500 mb-6">
              <span className="w-8 h-px bg-white/30" />
              For Installers & Partner Teams
            </span>
            <h2 className="text-4xl lg:text-6xl font-display tracking-tight text-white mb-8">
              Built for installers.
              <br />
              <span className="text-[#FF6600]">Calibrated for devs.</span>
            </h2>
            <p className="text-lg text-neutral-400 mb-12 leading-relaxed max-w-xl">
              An API and SDK designed to query roof coordinates, calculate PM Surya Ghar subsidies, 
              and route installer leads directly into your internal CRM dashboard.
            </p>
            
            {/* Features */}
            <div className="grid grid-cols-2 gap-6">
              {features.map((feature, index) => (
                <div
                  key={feature.title}
                  className={`transition-all duration-500 ${
                    isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                  }`}
                  style={{ transitionDelay: `${index * 50 + 200}ms` }}
                >
                  <h3 className="font-semibold text-white mb-1 text-base">{feature.title}</h3>
                  <p className="text-xs text-neutral-400 leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
          
          {/* Right: Code Console */}
          <div
            className={`transition-all duration-700 delay-200 ${
              isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
            }`}
          >
            <div className="border border-white/10 bg-[#070708] rounded-2xl overflow-hidden shadow-2xl">
              {/* Window Header */}
              <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-[#050506]">
                <div className="flex gap-4">
                  {codeExamples.map((example, idx) => (
                    <button
                      key={example.label}
                      onClick={() => {
                        setActiveTab(idx);
                        setCopied(false);
                      }}
                      className={`text-xs font-mono font-medium transition-colors ${
                        activeTab === idx ? "text-[#FF6600]" : "text-neutral-500 hover:text-neutral-300"
                      }`}
                    >
                      {example.label}
                    </button>
                  ))}
                </div>
                
                <button
                  onClick={handleCopy}
                  className="text-neutral-500 hover:text-neutral-300 transition-colors p-1"
                  aria-label="Copy code"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              
              {/* Code Panel */}
              <div className="p-8 font-mono text-xs md:text-sm min-h-[220px] bg-[#050506]">
                <pre className="text-neutral-300">
                  {codeExamples[activeTab].code.split("\n").map((line, lineIndex) => (
                    <div
                      key={`${activeTab}-${lineIndex}`}
                      className="dev-code-line leading-relaxed"
                      style={{
                        animationDelay: `${lineIndex * 60}ms`,
                      }}
                    >
                      <span className="text-neutral-600 select-none w-6 inline-block">{lineIndex + 1}</span>
                      <span className="inline-flex text-[#e2e8f0]">
                        {line.split("").map((char, charIndex) => {
                          let colorClass = "";
                          // Visual colors
                          if (line.includes('const') && charIndex < 5 && line.startsWith('const')) colorClass = "text-[#FF6600]";
                          if (line.includes('import') && charIndex < 6 && line.startsWith('import')) colorClass = "text-[#FF6600]";
                          if (line.includes('await') && line.indexOf('await') <= charIndex && charIndex < line.indexOf('await') + 5) colorClass = "text-amber-400";
                          if (line.startsWith('#') || (line.includes('//') && charIndex >= line.indexOf('//'))) colorClass = "text-neutral-500 italic";
                          return (
                            <span
                              key={`${activeTab}-${lineIndex}-${charIndex}`}
                              className={`dev-code-char ${colorClass}`}
                              style={{
                                animationDelay: `${lineIndex * 60 + charIndex * 12}ms`,
                              }}
                            >
                              {char === " " ? "\u00A0" : char}
                            </span>
                          );
                        })}
                      </span>
                    </div>
                  ))}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
