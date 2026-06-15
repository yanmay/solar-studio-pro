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
    icon: <Satellite className="w-5 h-5" />,
    title: "NASA satellite data",
    desc: "Live irradiance from NASA POWER per location.",
    tint: "from-sky-500/10 to-sky-500/0 border-sky-500/20 text-sky-500",
  },
  {
    icon: <Sparkles className="w-5 h-5" />,
    title: "One-tap roof detection",
    desc: "Fetches your building outline from OpenStreetMap.",
    tint: "from-orange-500/10 to-orange-500/0 border-orange-500/20 text-orange-500",
  },
  {
    icon: <BatteryCharging className="w-5 h-5" />,
    title: "Battery + off-grid sizing",
    desc: "LFP Li-ion recommendation with 25-yr cost.",
    tint: "from-indigo-500/10 to-indigo-500/0 border-indigo-500/20 text-indigo-500",
  },
  {
    icon: <Clock className="w-5 h-5" />,
    title: "Time-of-use scheduling",
    desc: "Know when to run AC, washer, EV for max self-use.",
    tint: "from-emerald-500/10 to-emerald-500/0 border-emerald-500/20 text-emerald-500",
  },
  {
    icon: <Box className="w-5 h-5" />,
    title: "3D + AR rooftop preview",
    desc: "See panels arranged on your roof. WebXR on Android.",
    tint: "from-violet-500/10 to-violet-500/0 border-violet-500/20 text-violet-500",
  },
  {
    icon: <Globe2 className="w-5 h-5" />,
    title: "5 Indian languages",
    desc: "English, हिन्दी, मराठी, தமிழ், বাংলা.",
    tint: "from-amber-500/10 to-amber-500/0 border-amber-500/20 text-amber-500",
  },
  {
    icon: <Mic className="w-5 h-5" />,
    title: "Voice search",
    desc: "Speak your address — Indian English + regional.",
    tint: "from-rose-500/10 to-rose-500/0 border-rose-500/20 text-rose-500",
  },
  {
    icon: <FileBadge className="w-5 h-5" />,
    title: "PM Surya Ghar built-in",
    desc: "Auto-calculates your ₹30k–₹78k govt subsidy.",
    tint: "from-green-500/10 to-green-500/0 border-green-500/20 text-green-500",
  },
];

const CREDENTIALS = [
  {
    icon: <Satellite className="w-4 h-4" />,
    label: "NASA POWER",
    sub: "Satellite-derived irradiance · open data",
  },
  {
    icon: <ShieldCheck className="w-4 h-4" />,
    label: "MNRE-empanelled partners",
    sub: "PM Surya Ghar end-to-end paperwork",
  },
  {
    icon: <Lock className="w-4 h-4" />,
    label: "TRAI-compliant",
    sub: "No spam · Your number stays private",
  },
  {
    icon: <FileBadge className="w-4 h-4" />,
    label: "OpenStreetMap",
    sub: "Building footprints · open geospatial data",
  },
];

const Testimonials = () => {
  return (
    <section className="py-14 sm:py-20 px-4 bg-background" aria-label="Features and trust credentials">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10 sm:mb-12">
          <h2 className="font-display text-3xl sm:text-4xl gradient-text mb-2 leading-tight">
            Everything a rooftop needs
          </h2>
          <p className="text-sm text-sunpower-text-muted max-w-xl mx-auto">
            Built on open satellite data and verified installer networks — no guesswork, no vendor lock-in.
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className={`bg-gradient-to-br ${f.tint} border rounded-2xl p-4 sm:p-5 hover:shadow-float transition-shadow`}
            >
              <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg bg-current/10 mb-2.5 ${f.tint.split(" ").find((c) => c.startsWith("text-")) || ""}`}>
                {f.icon}
              </div>
              <div className="text-[15px] font-medium text-sunpower-text-primary mb-1 leading-tight">
                {f.title}
              </div>
              <div className="text-xs text-sunpower-text-muted leading-relaxed">{f.desc}</div>
            </div>
          ))}
        </div>

        {/* Security + credentials strip */}
        <div className="mt-10 sm:mt-14">
          <div className="text-center mb-5">
            <div className="inline-flex items-center gap-2 text-xs font-medium text-sunpower-text-muted tracking-wide uppercase">
              <ShieldCheck className="w-3.5 h-3.5" /> Trust & Compliance
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {CREDENTIALS.map((c) => (
              <div
                key={c.label}
                className="bg-sunpower-bg-card border border-foreground/[0.06] rounded-xl px-4 py-3 flex items-start gap-3 hover:border-sunpower-accent/30 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-sunpower-accent/10 text-sunpower-accent flex items-center justify-center shrink-0">
                  {c.icon}
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-sunpower-text-primary leading-tight">
                    {c.label}
                  </div>
                  <div className="text-[11px] text-sunpower-text-muted leading-snug mt-0.5">{c.sub}</div>
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
