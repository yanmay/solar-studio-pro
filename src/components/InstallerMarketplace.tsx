import { ExternalLink, Star, MapPin, ShieldCheck } from "lucide-react";

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
      `https://www.loomsolar.com/pages/contact-us?utm_source=sunpowerlink&utm_medium=lead&utm_campaign=quote&kw=${kw}${city ? `&city=${encodeURIComponent(city)}` : ""}`,
    badges: ["MNRE Channel Partner", "ALMM Listed"],
  },
  {
    name: "Fenice Energy",
    tagline: "20+ years · 65,000+ rooftops installed in India",
    rating: 4.4,
    reviews: 1230,
    cities: ["Maharashtra", "Karnataka", "Tamil Nadu", "Gujarat", "Delhi NCR"],
    affiliate: (kw, city) =>
      `https://www.feniceenergy.com/get-quote?ref=sunpowerlink&kw=${kw}${city ? `&city=${encodeURIComponent(city)}` : ""}`,
    badges: ["MNRE Empanelled", "ISO 9001"],
  },
  {
    name: "Tata Power Solar",
    tagline: "Tata trust · End-to-end EPC · 25-yr warranty",
    rating: 4.5,
    reviews: 5670,
    cities: ["All India"],
    affiliate: (kw, city) =>
      `https://www.tatapowersolar.com/rooftop-solar-solutions/?source=sunpowerlink&kw=${kw}${city ? `&city=${encodeURIComponent(city)}` : ""}`,
    badges: ["BEE Star", "MNRE Channel Partner"],
  },
];

interface InstallerMarketplaceProps {
  installedKw: number;
  city?: string;
}

const InstallerMarketplace = ({ installedKw, city }: InstallerMarketplaceProps) => {
  return (
    <div className="bg-sunpower-bg-card rounded-2xl shadow-card p-5 sm:p-8 mt-8" role="region" aria-label="Solar installer marketplace">
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck className="w-5 h-5 text-sunpower-accent" />
        <h2 className="text-xl font-medium text-sunpower-text-primary">Compare verified installers</h2>
      </div>
      <p className="text-sm text-sunpower-text-muted mb-5">
        MNRE-empanelled partners that handle PM Surya Ghar paperwork & subsidy disbursal end-to-end.
      </p>

      <div className="space-y-3">
        {PARTNERS.map((p) => (
          <div
            key={p.name}
            className="border border-foreground/[0.08] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 hover:border-sunpower-accent/30 hover:shadow-md transition-all"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sunpower-text-primary">{p.name}</span>
                <span className="flex items-center gap-1 text-xs text-amber-500">
                  <Star className="w-3.5 h-3.5 fill-amber-500" />
                  <span className="font-semibold">{p.rating}</span>
                  <span className="text-sunpower-text-muted">({p.reviews.toLocaleString()})</span>
                </span>
              </div>
              <div className="text-xs text-sunpower-text-muted mt-0.5">{p.tagline}</div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                <span className="flex items-center gap-1 text-[11px] text-sunpower-text-muted">
                  <MapPin className="w-3 h-3" /> {p.cities.join(" · ")}
                </span>
                {p.badges?.map((b) => (
                  <span
                    key={b}
                    className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 bg-sunpower-accent/10 text-sunpower-accent rounded"
                  >
                    {b}
                  </span>
                ))}
              </div>
            </div>
            <a
              href={p.affiliate(installedKw, city)}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="shrink-0 inline-flex items-center justify-center gap-1.5 bg-sunpower-accent hover:bg-sunpower-accent-hover text-sunpower-accent-text text-sm font-medium px-4 py-2 rounded-lg active:scale-95 transition-all"
            >
              Get quote <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        ))}
      </div>

      <div className="text-[11px] text-sunpower-text-muted text-center mt-4">
        Sponsored partners · SUNPOWER LINK earns a referral fee at no extra cost to you.
      </div>
    </div>
  );
};

export default InstallerMarketplace;
