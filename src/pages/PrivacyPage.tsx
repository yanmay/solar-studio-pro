import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Zap, ArrowLeft, Shield, Lock, FileText, Eye } from "lucide-react";

export default function PrivacyPage() {
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
    <div className="min-h-screen bg-[#050505] text-white antialiased selection:bg-[#FF6600]/30 selection:text-white overflow-x-hidden relative font-sans">
      {/* Dynamic Background Gradients */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute top-[-15%] right-[-5%] w-[600px] h-[600px] rounded-full bg-[#FF6600]/5 blur-[140px]" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full bg-emerald-500/3 blur-[140px]" />
      </div>

      {/* Nav */}
      <nav className="fixed w-full z-50 bg-[#050505]/85 backdrop-blur-2xl py-3 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex justify-between items-center relative z-50">
          <a href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }} className="flex items-center gap-3 group">
            <img src="/logo.png" alt="SUNPOWER LINK Logo" className="w-8 h-8 object-contain transition-transform duration-200 group-hover:scale-105" />
            <span className="text-[15px] font-bold tracking-tight text-white">
              SUNPOWER <span className="font-serif italic font-light text-[#FF6600]">LINK</span>
            </span>
          </a>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all cursor-pointer active:scale-95"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Home
            </button>
          </div>
        </div>
      </nav>

      {/* Content Area */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-28 pb-24 relative z-10">
        
        {/* Header Block */}
        <div className="mb-12 text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-white/5 border border-white/10 text-[#FF6600] text-xs font-mono mb-4">
            <Shield className="w-3.5 h-3.5" />
            <span>LEGAL COMPLIANCE</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-4 leading-tight">
            Privacy Policy
          </h1>
          <p className="text-white/50 text-sm md:text-base font-light max-w-xl">
            Last updated: June 8, 2026. This policy describes how SUNPOWER LINK handles spatial query inputs and location data on our platform.
          </p>
        </div>

        {/* Feature Cards Grid (Why privacy is core) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="p-6 rounded-3xl bg-[#0A0A0A]/90 border border-white/10 backdrop-blur-2xl flex flex-col gap-3 shadow-2xl hover:border-[#FF6600]/40 transition-all">
            <Lock className="w-6 h-6 text-[#FF6600]" />
            <h3 className="font-bold text-white text-base">No Personal Tracking</h3>
            <p className="text-white/50 text-xs leading-relaxed font-light">
              We do not track your name, identity, or contact details during the solar rooftop analysis calculations.
            </p>
          </div>
          <div className="p-6 rounded-3xl bg-[#0A0A0A]/90 border border-white/10 backdrop-blur-2xl flex flex-col gap-3 shadow-2xl hover:border-[#FF6600]/40 transition-all">
            <Eye className="w-6 h-6 text-emerald-400" />
            <h3 className="font-bold text-white text-base">Transparent GIS Audits</h3>
            <p className="text-white/50 text-xs leading-relaxed font-light">
              Rooftop coordinates are resolved strictly via geocoding API providers and never stored permanently on our database.
            </p>
          </div>
          <div className="p-6 rounded-3xl bg-[#0A0A0A]/90 border border-white/10 backdrop-blur-2xl flex flex-col gap-3 shadow-2xl hover:border-[#FF6600]/40 transition-all">
            <FileText className="w-6 h-6 text-[#FF6600]" />
            <h3 className="font-bold text-white text-base">Secure Local PDF Export</h3>
            <p className="text-white/50 text-xs leading-relaxed font-light">
              Rooftop dimensions, capacity values, and financial projections are compiled locally inside your browser session.
            </p>
          </div>
        </div>

        {/* Main Terms Document Panel */}
        <div className="p-6 md:p-10 rounded-3xl bg-[#0A0A0A]/90 border border-white/10 backdrop-blur-2xl shadow-2xl space-y-10">
          
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-[#FF6600] font-mono">1.</span> Information We Collect
            </h2>
            <p className="text-white/70 text-sm leading-relaxed font-light">
              SUNPOWER LINK operates as a client-side utility application. When you analyze a roof, the location text you search is resolved to latitudinal and longitudinal coordinates via geocoding proxies. These spatial variables are sent securely to open API weather databases (like NASA POWER) to calculate historical solar radiance metrics for that region.
            </p>
          </section>

          <hr className="border-white/5" />

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-[#FF6600] font-mono">2.</span> Cookies and Local Data Storage
            </h2>
            <p className="text-white/70 text-sm leading-relaxed font-light">
              We utilize browser <code className="font-mono text-[#FF6600] bg-white/5 px-1.5 py-0.5 rounded">sessionStorage</code> and <code className="font-mono text-[#FF6600] bg-white/5 px-1.5 py-0.5 rounded">localStorage</code> to cache your drawn polygon coordinates, area dimensions, and yield calculations. This allows you to navigate back and forth between the mapping view and the detailed results charts without losing your work. This cached state is stored entirely on your local machine and can be cleared at any time by clearing your browser cache.
            </p>
          </section>

          <hr className="border-white/5" />

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-[#FF6600] font-mono">3.</span> Third-Party Service Providers
            </h2>
            <p className="text-white/70 text-sm leading-relaxed font-light">
              We interact with the following third-party components to deliver core solar estimates:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-white/70 text-sm font-light">
              <li><strong className="text-white">OpenStreetMap (Nominatim API)</strong>: For address-to-coordinate lookup.</li>
              <li><strong className="text-white">Google Map Tiles</strong>: To render satellite imagery for rooftop identification.</li>
              <li><strong className="text-white">NASA POWER solar database</strong>: To retrieve geographical solar irradiance coordinates.</li>
            </ul>
          </section>

          <hr className="border-white/5" />

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-[#FF6600] font-mono">4.</span> Compliance and PM Scheme Subsidies
            </h2>
            <p className="text-white/70 text-sm leading-relaxed font-light">
              The calculations, rates, and subsidy parameters presented on this website are estimates modeled according to the guidelines of the <em>PM Surya Ghar Muft Bijli Yojana</em>. These values are illustrative and do not constitute legal contracts or official approvals from state utility distribution companies (DISCOMs).
            </p>
          </section>

          <hr className="border-white/5" />

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-[#FF6600] font-mono">5.</span> Contact and Inquiries
            </h2>
            <p className="text-white/70 text-sm leading-relaxed font-light">
              For any questions regarding how we process spatial dimensions, GIS data, or local tariffs, please contact us at:
              <br />
              <span className="text-[#FF6600] font-semibold font-mono mt-2 block">
                legal@sunpowerlink.in
              </span>
            </p>
          </section>
        </div>

        {/* Footer info inside content */}
        <div className="mt-12 text-center text-xs font-mono text-white/40">
          <p>&copy; {new Date().getFullYear()} SUNPOWER LINK. All Rights Reserved.</p>
        </div>
      </main>
    </div>
  );
}
