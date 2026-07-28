import {
  ShieldCheck,
  Satellite,
  Sparkles,
  BatteryCharging,
  Globe2,
  Mic,
  Box,
  Clock,
  FileBadge,
  Lock,
} from "lucide-react";

const FEATURES = [
  {
    icon: <Satellite className="w-5 h-5 text-sky-400" />,
    title: "NASA Satellite Data",
    desc: "Live irradiance & solar flux from NASA POWER per location.",
    glow: "hover:border-sky-500/40 hover:shadow-[0_0_24px_rgba(56,189,248,0.15)]",
    iconBg: "bg-sky-500/10 border-sky-500/20",
  },
  {
    icon: <Sparkles className="w-5 h-5 text-[#FF6600]" />,
    title: "One-Tap Roof Detection",
    desc: "Auto-detects building footprints & solar area from satellite GIS.",
    glow: "hover:border-[#FF6600]/40 hover:shadow-[0_0_24px_rgba(255,102,0,0.15)]",
    iconBg: "bg-[#FF6600]/10 border-[#FF6600]/20",
  },
  {
    icon: <BatteryCharging className="w-5 h-5 text-indigo-400" />,
    title: "Battery & Off-Grid Sizing",
    desc: "LFP Li-ion storage optimization with 25-yr lifecycle modeling.",
    glow: "hover:border-indigo-500/40 hover:shadow-[0_0_24px_rgba(129,140,248,0.15)]",
    iconBg: "bg-indigo-500/10 border-indigo-500/20",
  },
  {
    icon: <Clock className="w-5 h-5 text-emerald-400" />,
    title: "Time-of-Use Scheduling",
    desc: "DISCOM peak-hour load shifting for maximum net-metering ROI.",
    glow: "hover:border-emerald-500/40 hover:shadow-[0_0_24px_rgba(52,211,153,0.15)]",
    iconBg: "bg-emerald-500/10 border-emerald-500/20",
  },
  {
    icon: <Box className="w-5 h-5 text-violet-400" />,
    title: "3D & AR Rooftop Preview",
    desc: "Arrange solar geometry on your roof in real time.",
    glow: "hover:border-violet-500/40 hover:shadow-[0_0_24px_rgba(167,139,250,0.15)]",
    iconBg: "bg-violet-500/10 border-violet-500/20",
  },
  {
    icon: <Globe2 className="w-5 h-5 text-amber-400" />,
    title: "5 Indian Languages",
    desc: "Full localization in English, हिन्दी, मराठी, தமிழ், & বাংলা.",
    glow: "hover:border-amber-500/40 hover:shadow-[0_0_24px_rgba(251,191,36,0.15)]",
    iconBg: "bg-amber-500/10 border-amber-500/20",
  },
  {
    icon: <Mic className="w-5 h-5 text-rose-400" />,
    title: "Voice-Powered Search",
    desc: "Speak your pincode or city name with regional accent support.",
    glow: "hover:border-rose-500/40 hover:shadow-[0_0_24px_rgba(251,113,133,0.15)]",
    iconBg: "bg-rose-500/10 border-rose-500/20",
  },
  {
    icon: <FileBadge className="w-5 h-5 text-emerald-400" />,
    title: "PM Surya Ghar Subsidy",
    desc: "Auto-calculates ₹30,000–₹78,000 national direct transfer.",
    glow: "hover:border-emerald-500/40 hover:shadow-[0_0_24px_rgba(52,211,153,0.15)]",
    iconBg: "bg-emerald-500/10 border-emerald-500/20",
  },
];

const CREDENTIALS = [
  {
    icon: <Satellite className="w-4 h-4 text-sky-400" />,
    label: "NASA POWER API",
    sub: "Satellite solar irradiance & climate data",
  },
  {
    icon: <ShieldCheck className="w-4 h-4 text-emerald-400" />,
    label: "MNRE Empannelled",
    sub: "PM Surya Ghar paperwork verification",
  },
  {
    icon: <Lock className="w-4 h-4 text-[#FF6600]" />,
    label: "Zero Spam Privacy",
    sub: "Encrypted details · No unrequested calls",
  },
  {
    icon: <FileBadge className="w-4 h-4 text-amber-400" />,
    label: "OpenStreetMap GIS",
    sub: "Satellite building footprint boundary data",
  },
];

const Testimonials = () => {
  return (
    <section className="py-20 px-4 sm:px-6 bg-[#050505] border-b border-white/5 relative overflow-hidden" aria-label="Features and trust credentials">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-[#FF6600] uppercase tracking-wider mb-4">
            <Sparkles className="w-3.5 h-3.5" /> High Precision Platform
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-4">
            Everything Your Rooftop Needs
          </h2>
          <p className="text-sm sm:text-base text-white/60 max-w-2xl mx-auto font-light leading-relaxed">
            Built on open satellite data and verified installer networks — zero guesswork, accurate ROI calculations, and complete transparency.
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className={`relative bg-[#0A0A0A]/90 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 transition-all duration-300 ease-out hover:-translate-y-1 group ${f.glow}`}
            >
              {/* Highlight top line */}
              <div
                className="absolute top-0 left-0 right-0 h-px rounded-t-3xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)" }}
                aria-hidden="true"
              />

              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border mb-4 ${f.iconBg} transition-transform group-hover:scale-110`}>
                {f.icon}
              </div>
              <h3 className="text-base font-bold text-white mb-1.5 leading-snug group-hover:text-white transition-colors">
                {f.title}
              </h3>
              <p className="text-xs text-white/50 leading-relaxed font-light group-hover:text-white/70 transition-colors">
                {f.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Security + credentials strip */}
        <div className="mt-14 sm:mt-20">
          <div className="text-center mb-6">
            <span className="text-xs font-mono font-bold text-white/40 uppercase tracking-[0.2em] flex items-center justify-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#FF6600]" /> Verified Data Standards & Compliance
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {CREDENTIALS.map((c) => (
              <div
                key={c.label}
                className="bg-[#0A0A0A]/90 border border-white/10 rounded-2xl p-4 flex items-center gap-3.5 hover:border-white/20 transition-all hover:-translate-y-0.5"
              >
                <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                  {c.icon}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white leading-tight">
                    {c.label}
                  </div>
                  <div className="text-[11px] font-mono text-white/40 leading-tight mt-1 truncate">
                    {c.sub}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Testimonials;

