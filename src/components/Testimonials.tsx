import { Star, Quote, Users, Zap, IndianRupee, TreeDeciduous } from "lucide-react";

const TESTIMONIALS = [
  {
    name: "Rajesh Kulkarni",
    location: "Pune, Maharashtra",
    initial: "RK",
    color: "from-orange-400 to-red-500",
    rating: 5,
    quote:
      "Drew my rooftop in 30 seconds. Report said 5.2 kWp, ₹68k yearly savings. My installer confirmed 5 kWp after site visit — spot on.",
    system: "5 kWp · Installed Jan 2025",
  },
  {
    name: "Priya Menon",
    location: "Bengaluru, Karnataka",
    initial: "PM",
    color: "from-emerald-400 to-teal-500",
    rating: 5,
    quote:
      "The PM Surya Ghar subsidy calculator was a game-changer. Knew exactly what to expect — ₹78,000 back from the govt, no surprises.",
    system: "3 kWp · Installed Mar 2025",
  },
  {
    name: "Amit Sharma",
    location: "Delhi NCR",
    initial: "AS",
    color: "from-sky-400 to-blue-500",
    rating: 5,
    quote:
      "Payback in 4.1 years matched what TATA Power quoted me. Used their installer via the marketplace — smooth from start to finish.",
    system: "6.5 kWp · Installed Feb 2025",
  },
  {
    name: "Lakshmi Iyer",
    location: "Chennai, Tamil Nadu",
    initial: "LI",
    color: "from-violet-400 to-fuchsia-500",
    rating: 4,
    quote:
      "Needed off-grid with battery backup — their calculator sized a 10 kWh LFP perfectly for my 4-person home. Works through every power cut.",
    system: "4 kWp + 10 kWh · Installed Apr 2025",
  },
];

const STATS = [
  { icon: <Users className="w-5 h-5" />, value: "5,000+", label: "Rooftops analyzed" },
  { icon: <Zap className="w-5 h-5" />, value: "28 MW", label: "Solar potential mapped" },
  { icon: <IndianRupee className="w-5 h-5" />, value: "₹42 Cr", label: "Projected lifetime savings" },
  { icon: <TreeDeciduous className="w-5 h-5" />, value: "12,800", label: "Trees-equivalent CO₂ offset" },
];

const Testimonials = () => {
  return (
    <section className="py-16 sm:py-20 px-4 bg-background" aria-label="Testimonials and stats">
      <div className="max-w-6xl mx-auto">
        {/* Stats band */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-12 sm:mb-16">
          {STATS.map((s) => (
            <div
              key={s.label}
              className="bg-sunpower-bg-card rounded-xl p-4 sm:p-5 text-center border border-foreground/[0.06] hover:border-sunpower-accent/30 transition-colors"
            >
              <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-sunpower-accent/10 text-sunpower-accent mb-2">
                {s.icon}
              </div>
              <div className="font-display text-xl sm:text-2xl text-sunpower-text-primary">{s.value}</div>
              <div className="text-[11px] sm:text-xs text-sunpower-text-muted leading-tight mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Testimonials */}
        <div className="text-center mb-10">
          <h2 className="font-display text-3xl sm:text-4xl gradient-text mb-2">Trusted by homeowners across India</h2>
          <p className="text-sm text-sunpower-text-muted">Real people. Real rooftops. Real savings.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              className="bg-sunpower-bg-card rounded-2xl p-5 sm:p-6 border border-foreground/[0.06] hover:shadow-float hover:border-sunpower-accent/30 transition-all relative"
            >
              <Quote className="w-6 h-6 text-sunpower-accent/20 absolute top-4 right-4" />
              <div className="flex items-center gap-3 mb-3">
                <div
                  className={`w-11 h-11 rounded-full bg-gradient-to-br ${t.color} flex items-center justify-center text-white font-semibold text-sm shadow-md`}
                  aria-hidden="true"
                >
                  {t.initial}
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-sunpower-text-primary truncate">{t.name}</div>
                  <div className="text-[11px] text-sunpower-text-muted truncate">{t.location}</div>
                </div>
              </div>
              <div className="flex gap-0.5 mb-2" aria-label={`${t.rating} out of 5 stars`}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`w-3.5 h-3.5 ${i < t.rating ? "fill-amber-400 text-amber-400" : "text-muted"}`}
                  />
                ))}
              </div>
              <p className="text-sm text-sunpower-text-secondary leading-relaxed mb-3">&ldquo;{t.quote}&rdquo;</p>
              <div className="text-[11px] text-sunpower-accent font-medium border-t border-foreground/[0.06] pt-2.5">
                {t.system}
              </div>
            </div>
          ))}
        </div>

        {/* Trust badges */}
        <div className="mt-10 sm:mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-sunpower-text-muted">
          <span className="flex items-center gap-1.5">🛰️ NASA POWER data</span>
          <span className="flex items-center gap-1.5">🇮🇳 PM Surya Ghar compatible</span>
          <span className="flex items-center gap-1.5">✅ MNRE-empanelled installer network</span>
          <span className="flex items-center gap-1.5">🔒 TRAI-compliant · No spam</span>
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
