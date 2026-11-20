import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useInstallerAuth } from "@/hooks/use-installer-auth";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowRight, ShieldCheck, Zap, Building2, CheckCircle2, AlertCircle, Phone, Mail, Lock, Star } from "lucide-react";

const INDIAN_STATES = [
  { name: "Maharashtra", cities: ["Mumbai", "Pune", "Nagpur", "Thane", "Nashik"] },
  { name: "Karnataka", cities: ["Bengaluru", "Mysore", "Hubli", "Mangalore"] },
  { name: "Delhi", cities: ["New Delhi", "Dwarka", "Rohini", "Noida"] },
  { name: "Gujarat", cities: ["Ahmedabad", "Surat", "Vadodara", "Rajkot"] },
  { name: "Tamil Nadu", cities: ["Chennai", "Coimbatore", "Madurai", "Salem"] },
  { name: "Telangana", cities: ["Hyderabad", "Warangal", "Nizamabad"] },
  { name: "Rajasthan", cities: ["Jaipur", "Jodhpur", "Udaipur", "Kota"] },
  { name: "Uttar Pradesh", cities: ["Lucknow", "Kanpur", "Agra", "Varanasi"] },
];

export default function Signup() {
  const navigate = useNavigate();
  const { signUp } = useInstallerAuth();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [gstin, setGstin] = useState("");
  const [phone, setPhone] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [mnre, setMnre] = useState("");

  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState("");

  const availableCities = INDIAN_STATES.find((s) => s.name === state)?.cities || [];

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError("");

    if (!email.includes("@")) { setValidationError("Please enter a valid email address."); return; }
    if (password.length < 6) { setValidationError("Password must be at least 6 characters."); return; }

    const cleanGstin = gstin.trim().toUpperCase();
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (cleanGstin.length !== 15 || !gstinRegex.test(cleanGstin)) {
      setValidationError("Invalid GSTIN — must be 15 chars matching the Indian GST format (e.g. 27AAAAA0000A1Z5).");
      return;
    }
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length !== 10 || !/^[6789]/.test(cleanPhone)) {
      setValidationError("Phone must be 10 digits starting with 6, 7, 8, or 9.");
      return;
    }
    if (!state || !city) { setValidationError("Please select your operating State and City."); return; }

    setLoading(true);
    try {
      await signUp(email, companyName, cleanGstin, cleanPhone, city, state, mnre);
      toast({ title: "Partner Account Activated", description: "Welcome to the SUNPOWER LINK Partner Network!" });
      navigate("/installer/dashboard?tour=true");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign up failed. Please try again.";
      setValidationError(msg);
      toast({ title: "Registration Failed", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="professional-product-ui min-h-screen text-white flex flex-col antialiased overflow-x-hidden"
      style={{ background: "#050505" }}
    >
      {/* ── Cinematic Ambient Blobs ────────────────────────────── */}
      <div className="hidden" aria-hidden="true">
        <div className="absolute top-[-15%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-[0.07] blur-[120px]"
          style={{ background: "#FF6600", animation: "blob1 18s ease-in-out infinite alternate" }} />
        <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full opacity-[0.05] blur-[100px]"
          style={{ background: "#10B981", animation: "blob2 22s ease-in-out infinite alternate" }} />
        <div className="absolute top-[40%] right-[20%] w-[300px] h-[300px] rounded-full opacity-[0.04] blur-[80px]"
          style={{ background: "#FF6600", animation: "blob1 14s ease-in-out infinite alternate-reverse" }} />
      </div>

      <style>{`
        @keyframes blob1 { 0% { transform: translate(0,0) scale(1); } 100% { transform: translate(40px, 60px) scale(1.15); } }
        @keyframes blob2 { 0% { transform: translate(0,0) scale(1); } 100% { transform: translate(-50px, -30px) scale(1.1); } }
      `}</style>

      {/* ── Top Nav ───────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#020203]/80 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group" aria-label="SUNPOWER LINK home">
            <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain transition-transform duration-200 group-hover:scale-105" />
            <span className="text-[15px] font-bold text-white tracking-tight">
              SUNPOWER <span className="font-['Calistoga',serif] italic font-normal text-[#FF6600]">LINK</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-[12px] text-white/40 hidden sm:block">Already a partner?</span>
            <Link
              to="/auth/signin"
              className="h-8 px-4 rounded-lg border border-white/[0.12] text-white/70 hover:text-white hover:border-white/25 text-[12px] font-medium transition-all duration-150 flex items-center"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Content ──────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-12 lg:py-16 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">

          {/* Left: Hero Copy + Bento Feature Grid */}
          <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-8">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#FF6600]/25 bg-[#FF6600]/10 text-[#FF6600] text-[11px] font-semibold tracking-wide mb-4">
                <Star className="w-3.5 h-3.5" />
                Verified Installer Network
              </div>
              <h1 className="font-['Calistoga',serif] text-4xl sm:text-5xl text-white leading-[1.1] tracking-tight mb-4">
                Win More <span className="text-[#FF6600]">Solar</span> Contracts
              </h1>
              <p className="text-[14px] text-white/50 leading-relaxed max-w-[360px]">
              Connect with homeowners who've already analysed their own rooftop on SUNPOWER LINK - these are warm, high-intent leads, not cold lists.
              </p>
            </div>

            {/* Bento Grid Feature Cards */}
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  icon: <Zap className="w-5 h-5 text-[#FF6600]" />,
                  title: "Instant Rooftop Data",
                  desc: "Pre-scanned GHI, roof area, kWp yield, PM Surya subsidy — ready when you call.",
                  accent: "#FF6600",
                },
                {
                  icon: <Building2 className="w-5 h-5 text-emerald-400" />,
                  title: "GSTIN Auto-Verify",
                  desc: "Onboard in under 2 minutes with instant GSTIN validation.",
                  accent: "#10B981",
                },
                {
                  icon: <CheckCircle2 className="w-5 h-5 text-blue-400" />,
                  title: "Live Lead Pipeline",
                  desc: "Real-time Kanban board synced with Supabase database.",
                  accent: "#3B82F6",
                },
                {
                  icon: <ShieldCheck className="w-5 h-5 text-violet-400" />,
                  title: "Zero Lead Leakage",
                  desc: "Exclusive city-level territory lock — no shared leads.",
                  accent: "#8B5CF6",
                },
              ].map((f, i) => (
                <div
                  key={i}
                  className="p-4 rounded-2xl border border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.12] transition-all duration-200 group cursor-default"
                  style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.3)" }}
                >
                  <div className="mb-3">{f.icon}</div>
                  <div className="text-[12px] font-semibold text-white mb-1">{f.title}</div>
                  <div className="text-[11px] text-white/40 leading-snug">{f.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Registration Form */}
          <div className="lg:col-span-7">
            <div
              className="rounded-3xl border border-white/[0.08] p-7 sm:p-9 space-y-6"
              style={{
                background: "rgba(255,255,255,0.03)",
                backdropFilter: "blur(32px)",
                boxShadow: "0 24px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
              }}
            >
              <div>
                <h2 className="font-['Calistoga',serif] text-2xl text-white tracking-tight">Register as Partner</h2>
                <p className="text-[12px] text-white/40 mt-1">All fields required unless marked optional.</p>
              </div>

              <form onSubmit={handleSignup} className="space-y-4" noValidate>
                {/* Error Alert */}
                {validationError && (
                  <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-500/[0.08] border border-red-500/20 text-red-400 text-[12px] leading-snug animate-in fade-in duration-200">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{validationError}</span>
                  </div>
                )}

                {/* Company Name */}
                <fieldset className="space-y-1.5">
                  <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-widest">
                    Company / Firm Name <span className="text-[#FF6600]">*</span>
                  </label>
                  <input
                    type="text" required placeholder="e.g. Apex Solar Solutions Pvt Ltd"
                    value={companyName} onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-[13px] text-white placeholder:text-white/25 border border-white/[0.08] bg-white/[0.04] focus:outline-none focus:border-[#FF6600]/60 focus:ring-2 focus:ring-[#FF6600]/20 transition-all duration-150"
                  />
                </fieldset>

                {/* GSTIN + Phone */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <fieldset className="space-y-1.5">
                    <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-widest">
                      GSTIN <span className="text-[#FF6600]">*</span>
                    </label>
                    <input
                      type="text" required maxLength={15} placeholder="27AAAAA0000A1Z5"
                      value={gstin} onChange={(e) => setGstin(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-[13px] text-white uppercase placeholder:normal-case placeholder:text-white/25 border border-white/[0.08] bg-white/[0.04] focus:outline-none focus:border-[#FF6600]/60 focus:ring-2 focus:ring-[#FF6600]/20 transition-all duration-150 font-['JetBrains_Mono',monospace] tracking-wider"
                    />
                  </fieldset>
                  <fieldset className="space-y-1.5">
                    <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-widest flex items-center gap-1">
                      <Phone className="w-3 h-3" /> Phone <span className="text-[#FF6600]">*</span>
                    </label>
                    <input
                      type="tel" required maxLength={10} placeholder="9820012345"
                      value={phone} onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-[13px] text-white placeholder:text-white/25 border border-white/[0.08] bg-white/[0.04] focus:outline-none focus:border-[#FF6600]/60 focus:ring-2 focus:ring-[#FF6600]/20 transition-all duration-150 font-['JetBrains_Mono',monospace] tracking-wider"
                    />
                  </fieldset>
                </div>

                {/* State + City */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <fieldset className="space-y-1.5">
                    <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-widest">
                      State <span className="text-[#FF6600]">*</span>
                    </label>
                    <select
                      required value={state} onChange={(e) => { setState(e.target.value); setCity(""); }}
                      className="w-full px-4 py-3 rounded-xl text-[13px] text-white border border-white/[0.08] bg-[#0a0a0c] focus:outline-none focus:border-[#FF6600]/60 focus:ring-2 focus:ring-[#FF6600]/20 transition-all duration-150 cursor-pointer"
                    >
                      <option value="" className="text-white/30">Select state</option>
                      {INDIAN_STATES.map((s) => (
                        <option key={s.name} value={s.name} className="bg-[#0a0a0c] text-white">{s.name}</option>
                      ))}
                    </select>
                  </fieldset>
                  <fieldset className="space-y-1.5">
                    <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-widest">
                      City <span className="text-[#FF6600]">*</span>
                    </label>
                    <select
                      required disabled={!state} value={city} onChange={(e) => setCity(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-[13px] text-white border border-white/[0.08] bg-[#0a0a0c] focus:outline-none focus:border-[#FF6600]/60 focus:ring-2 focus:ring-[#FF6600]/20 transition-all duration-150 cursor-pointer disabled:opacity-30"
                    >
                      <option value="">Select city</option>
                      {availableCities.map((c) => (
                        <option key={c} value={c} className="bg-[#0a0a0c] text-white">{c}</option>
                      ))}
                    </select>
                  </fieldset>
                </div>

                {/* MNRE */}
                <fieldset className="space-y-1.5">
                  <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-widest">
                    MNRE Empanelment ID <span className="text-white/25 font-normal normal-case tracking-normal text-[10px]">(Optional)</span>
                  </label>
                  <input
                    type="text" placeholder="e.g. MNRE-KA-2026-889"
                    value={mnre} onChange={(e) => setMnre(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-[13px] text-white placeholder:text-white/25 border border-white/[0.08] bg-white/[0.04] focus:outline-none focus:border-[#FF6600]/60 focus:ring-2 focus:ring-[#FF6600]/20 transition-all duration-150"
                  />
                </fieldset>

                {/* Credentials */}
                <div className="pt-4 border-t border-white/[0.06] space-y-4">
                  <p className="text-[11px] text-white/30 font-semibold uppercase tracking-widest">Login Credentials</p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <fieldset className="space-y-1.5">
                      <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-widest flex items-center gap-1">
                        <Mail className="w-3 h-3" /> Email <span className="text-[#FF6600]">*</span>
                      </label>
                      <input
                        type="email" required placeholder="installer@firm.com"
                        value={email} onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl text-[13px] text-white placeholder:text-white/25 border border-white/[0.08] bg-white/[0.04] focus:outline-none focus:border-[#FF6600]/60 focus:ring-2 focus:ring-[#FF6600]/20 transition-all duration-150"
                      />
                    </fieldset>
                    <fieldset className="space-y-1.5">
                      <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-widest flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Password <span className="text-[#FF6600]">*</span>
                      </label>
                      <input
                        type="password" required placeholder="Min. 6 characters"
                        value={password} onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl text-[13px] text-white placeholder:text-white/25 border border-white/[0.08] bg-white/[0.04] focus:outline-none focus:border-[#FF6600]/60 focus:ring-2 focus:ring-[#FF6600]/20 transition-all duration-150"
                      />
                    </fieldset>
                  </div>
                </div>

                {/* Submit */}
                <button
                  type="submit" disabled={loading}
                  className="w-full mt-2 h-12 rounded-xl font-bold text-[13px] text-black flex items-center justify-center gap-2.5 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 cursor-pointer border-none"
                  style={{
                    background: loading ? "#E05800" : "linear-gradient(135deg, #FF6600 0%, #FF8C38 100%)",
                    boxShadow: "0 0 32px rgba(255,102,0,0.25), inset 0 1px 0 rgba(255,255,255,0.15)",
                  }}
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Verifying GSTIN & Creating Account…</>
                  ) : (
                    <><span>Register & Enter Partner Portal</span><ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>

              <p className="text-center text-[12px] text-white/30 pt-2 border-t border-white/[0.05]">
                Already registered?{" "}
                <Link to="/auth/signin" className="text-[#FF6600] hover:text-orange-400 font-semibold transition-colors duration-150">
                  Sign In
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-white/[0.04] py-5 text-center text-[11px] text-white/20 relative z-10">
        © 2026 SUNPOWER LINK Partner Network · All rights reserved
      </footer>
    </div>
  );
}
