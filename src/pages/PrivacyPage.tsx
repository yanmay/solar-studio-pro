import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Zap, ArrowLeft, Shield, Lock, FileText, Eye } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

const PrivacyPage = () => {
  const navigate = useNavigate();

  // SEO metadata setup
  useEffect(() => {
    document.title = "Privacy Policy — SUNPOWER LINK";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute(
        "content",
        "Read the Privacy Policy of SUNPOWER LINK to learn how we securely handle rooftop coordinates, NASA Power GIS inputs, and local solar yield queries."
      );
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] text-white antialiased selection:bg-[#FF6600]/30 selection:text-white overflow-x-hidden relative">
      {/* Dynamic Background Gradients */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-[#FF6600]/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-amber-500/3 blur-[100px] pointer-events-none" />

      {/* Nav */}
      <nav className="fixed w-full z-50 transition-all duration-300 bg-[#050505]/90 backdrop-blur-xl py-4 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-5 md:px-6 flex justify-between items-center relative z-50">
          <a href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }} className="flex items-center gap-2 group">
            <img src="/logo.png" alt="SUNPOWER LINK Logo" className="w-8 h-8 object-contain transition-all duration-300 group-hover:scale-105" />
            <span className="text-lg font-bold tracking-tight text-white">
              SUNPOWER <span className="font-serif italic font-light">LINK</span>
            </span>
          </a>

          <div className="flex items-center space-x-4">
            <ThemeToggle />
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all duration-200 border-none cursor-pointer active:scale-95"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Home
            </button>
          </div>
        </div>
      </nav>

      {/* Content Area */}
      <main className="max-w-4xl mx-auto px-5 md:px-6 pt-32 pb-24 relative z-10">
        
        {/* Header Block */}
        <div className="mb-12 text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/5 border border-white/8 text-[#FF6600] text-xs font-mono mb-4">
            <Shield className="w-3.5 h-3.5" />
            <span>LEGAL COMPLIANCE</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-4 leading-tight">
            Privacy Policy
          </h1>
          <p className="text-neutral-400 text-sm md:text-base font-light max-w-xl">
            Last updated: June 8, 2026. This policy describes how SUNPOWER LINK processes location and spatial query inputs on our platform.
          </p>
        </div>

        {/* Feature Cards Grid (Why privacy is core) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="p-6 rounded-2xl bg-white/3 border border-white/5 backdrop-blur-md flex flex-col gap-3">
            <Lock className="w-6 h-6 text-[#FF6600]" />
            <h3 className="font-semibold text-white">No Personal Tracking</h3>
            <p className="text-neutral-400 text-xs leading-relaxed">
              We do not track your name, identity, or contact details during the solar rooftop analysis calculations.
            </p>
          </div>
          <div className="p-6 rounded-2xl bg-white/3 border border-white/5 backdrop-blur-md flex flex-col gap-3">
            <Eye className="w-6 h-6 text-amber-500" />
            <h3 className="font-semibold text-white">Transparent GIS Audits</h3>
            <p className="text-neutral-400 text-xs leading-relaxed">
              Rooftop coordinates are resolved strictly via geocoding API providers and never stored permanently on our database.
            </p>
          </div>
          <div className="p-6 rounded-2xl bg-white/3 border border-white/5 backdrop-blur-md flex flex-col gap-3">
            <FileText className="w-6 h-6 text-orange-400" />
            <h3 className="font-semibold text-white">Secure Local PDF Export</h3>
            <p className="text-neutral-400 text-xs leading-relaxed">
              Rooftop dimensions, capacity values, and financial projections are compiled locally inside your browser session.
            </p>
          </div>
        </div>

        {/* Main Terms Document Panel */}
        <div className="p-6 md:p-10 rounded-3xl bg-neutral-900/60 border border-white/8 backdrop-blur-2xl shadow-xl space-y-10">
          
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-[#FF6600] font-mono">1.</span> Information We Collect
            </h2>
            <p className="text-neutral-300 text-sm leading-relaxed font-light">
              SUNPOWER LINK operates as a client-side utility application. When you analyze a roof, the location text you search is resolved to latitudinal and longitudinal coordinates via geocoding proxies. These spatial variables are sent securely to open API weather databases (like NASA POWER) to calculate historical solar radiance metrics for that region.
            </p>
          </section>

          <hr className="border-white/5" />

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-[#FF6600] font-mono">2.</span> Cookies and Local Data Storage
            </h2>
            <p className="text-neutral-300 text-sm leading-relaxed font-light">
              We utilize browser <code>sessionStorage</code> and <code>localStorage</code> to cache your drawn polygon coordinates, area dimensions, and yield calculations. This allows you to navigate back and forth between the mapping view and the detailed results charts without losing your work. This cached state is stored entirely on your local machine and can be cleared at any time by clearing your browser site cookies/cache.
            </p>
          </section>

          <hr className="border-white/5" />

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-[#FF6600] font-mono">3.</span> Third-Party Service Providers
            </h2>
            <p className="text-neutral-300 text-sm leading-relaxed font-light">
              We interact with the following third-party components to deliver core solar estimates:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-neutral-300 text-sm font-light">
              <li><strong>OpenStreetMap (Nominatim API)</strong>: For address-to-coordinate lookup (resolved through a secure reverse-proxy).</li>
              <li><strong>Google Map Tiles</strong>: To render satellite imagery for rooftop identification.</li>
              <li><strong>NASA POWER solar database</strong>: To retrieve geographical solar irradiance coordinates.</li>
            </ul>
          </section>

          <hr className="border-white/5" />

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-[#FF6600] font-mono">4.</span> Compliance and PM Scheme Subsidies
            </h2>
            <p className="text-neutral-300 text-sm leading-relaxed font-light">
              The calculations, rates, and subsidy parameters presented on this website are estimates modeled according to the guidelines of the <em>PM Surya Ghar Muft Bijli Yojana</em>. These values are illustrative and do not constitute legal contracts or official approvals from state utility distribution companies (DISCOMs).
            </p>
          </section>

          <hr className="border-white/5" />

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-[#FF6600] font-mono">5.</span> Contact and Inquiries
            </h2>
            <p className="text-neutral-300 text-sm leading-relaxed font-light">
              For any questions regarding how we process spatial dimensions, GIS data, or local tariffs, please contact us at:
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-500 font-semibold font-mono mt-2 block">
                legal@sunpowerlink.in
              </span>
            </p>
          </section>
        </div>

        {/* Footer info inside content */}
        <div className="mt-12 text-center text-xs text-neutral-600">
          <p>&copy; 2026 SUNPOWER LINK. Mapped and compiled in India.</p>
        </div>
      </main>
    </div>
  );
};

export default PrivacyPage;
