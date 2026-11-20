import { ExternalLink, Star, MapPin, ShieldCheck } from "lucide-react";
import { track } from "@/lib/analytics";

// Curated affiliate partners — replace `affiliate` URLs with real tracking links
// once partner agreements are signed. `tag` query param lets you attribute leads.
const PARTNERS: {
  name: string;
  tagline: string;
  rating: number;
  reviews: number;
  cities: string[];
  affiliate: (kw: number, city?: string) => string;
  badges?: string[];
}[] = [
  {
    name: "Loom Solar",
    tagline: "AC modules · Lithium batteries · Pan-India installation",
    rating: 4.6,
    reviews: 2840,
    cities: ["All India"],
    affiliate: (kw, city) =>
      `https://www.loomsolar.com/pages/contact-us?utm_source=solarscan&utm_medium=lead&utm_campaign=quote&kw=${kw}${city ? `&city=${encodeURIComponent(city)}` : ""}`,
    badges: ["MNRE Channel Partner", "ALMM Listed"],
  },
  {
    name: "Fenice Energy",
    tagline: "20+ years · 65,000+ rooftops installed in India",
    rating: 4.4,
    reviews: 1230,
    cities: ["Maharashtra", "Karnataka", "Tamil Nadu", "Gujarat", "Delhi NCR"],
    affiliate: (kw, city) =>
      `https://www.feniceenergy.com/get-quote?ref=solarscan&kw=${kw}${city ? `&city=${encodeURIComponent(city)}` : ""}`,
    badges: ["MNRE Empanelled", "ISO 9001"],
  },
  {
    name: "Tata Power Solar",
    tagline: "Tata trust · End-to-end EPC · 25-yr warranty",
    rating: 4.5,
    reviews: 5670,
    cities: ["All India"],
    affiliate: (kw, city) =>
      `https://www.tatapowersolar.com/rooftop-solar-solutions/?source=solarscan&kw=${kw}${city ? `&city=${encodeURIComponent(city)}` : ""}`,
    badges: ["BEE Star", "MNRE Channel Partner"],
  },
];

interface InstallerMarketplaceProps {
  installedKw: number;
  city?: string;
}

const InstallerMarketplace = ({ installedKw, city }: InstallerMarketplaceProps) => {
  return (
    <div className="bg-[#0A0A0A]/90 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl p-6 sm:p-8 mt-8 text-white relative overflow-hidden" role="region" aria-label="Solar installer marketplace">
      {/* Top ambient line */}
      <div
        className="absolute top-0 left-0 right-0 h-px rounded-t-3xl opacity-60 pointer-events-none"
        style={{ background: "linear-gradient(90deg, transparent, rgba(255,102,0,0.5), transparent)" }}
        aria-hidden="true"
      />

      <div className="flex items-center gap-2.5 mb-1.5">
        <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">Compare Verified Installers</h2>
          <p className="text-xs text-white/50 font-light">
            MNRE-empanelled partners that handle PM Surya Ghar paperwork & subsidy disbursal end-to-end.
          </p>
        </div>
      </div>

      <div className="space-y-3.5 mt-6">
        {PARTNERS.map((p) => (
          <div
            key={p.name}
            className="border border-white/10 bg-white/[0.02] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:border-[#FF6600]/40 hover:bg-white/[0.04] transition-all duration-300 group"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-white text-base group-hover:text-[#FF6600] transition-colors">{p.name}</span>
                <span className="flex items-center gap-1 text-xs text-amber-400 font-mono">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span className="font-bold">{p.rating}</span>
                  <span className="text-white/40">({p.reviews.toLocaleString()})</span>
                </span>
              </div>
              <div className="text-xs text-white/60 mt-1 font-light">{p.tagline}</div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-3">
                <span className="flex items-center gap-1 text-[11px] font-mono text-white/40">
                  <MapPin className="w-3 h-3 text-[#FF6600]" /> {p.cities.join(" · ")}
                </span>
                {p.badges?.map((b) => (
                  <span
                    key={b}
                    className="text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md"
                  >
                    {b}
                  </span>
                ))}
              </div>
            </div>
            <a
              href={p.affiliate(installedKw, city)}
              onClick={() => track("Installer Quote Click", { partner: p.name, kw: installedKw })}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="shrink-0 inline-flex items-center justify-center gap-2 bg-[#FF6600] hover:bg-orange-500 text-black text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl active:scale-95 transition-all border-none shadow-lg shadow-[#FF6600]/20 cursor-pointer"
            >
              <span>Get Quote</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        ))}
      </div>

      <div className="text-[10px] font-mono text-white/30 text-center mt-5">
          Empanelled Partner Network · SUNPOWER LINK direct referral system with zero hidden markups.
      </div>
    </div>
  );
};

export default InstallerMarketplace;

