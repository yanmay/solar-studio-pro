import { Link } from "react-router-dom";

const footerLinks = [
  {
    title: "Product",
    links: [
      { label: "Launch Analyzer", to: "/map" },
      { label: "Sample Report", to: "/dashboard" },
      { label: "Pricing", to: "#pricing" },
    ],
  },
  {
    title: "Intelligence",
    links: [
      { label: "Market Insights", to: "/market-insights" },
      { label: "Policy Tracker", to: "/policy-tracker" },
      { label: "API Documentation", to: "/developers/docs" },
    ],
  },
  {
    title: "Technology",
    links: [
      { label: "SolarNet AI", to: "#technology" },
      { label: "Regional Database", to: "#regional-db" },
      { label: "Security", to: "#security" },
    ],
  },
  {
    title: "Legal",
    links: [{ label: "Privacy Policy", to: "/privacy" }],
  },
];

export function FooterSection() {
  return (
    <footer className="border-t border-white/10 bg-black">
      <div className="mx-auto max-w-[1240px] px-6 py-16">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-[2fr_repeat(4,1fr)]">
          <div>
            <Link to="/" className="inline-flex h-11 items-center gap-2.5">
              <img src="/logo.png" alt="" className="h-9 w-9 object-contain" />
              <span className="text-base font-bold text-white">
                SUNPOWER <span className="font-medium italic text-[#FF6600]">LINK</span>
              </span>
            </Link>
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-white/50">
              Spatial solar analysis, tariffs, subsidies, and investment-grade rooftop reports for India.
            </p>
          </div>

          {footerLinks.map((group) => (
            <div key={group.title}>
              <h2 className="mb-4 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-white/35">{group.title}</h2>
              <ul className="space-y-1">
                {group.links.map((link) => (
                  <li key={link.label}>
                    {link.to.startsWith("#") ? (
                      <a href={link.to} className="flex min-h-10 items-center text-sm text-white/55 transition-colors duration-150 hover:text-white">{link.label}</a>
                    ) : (
                      <Link to={link.to} className="flex min-h-10 items-center text-sm text-white/55 transition-colors duration-150 hover:text-white">{link.label}</Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-white/10 pt-7 text-xs text-white/35 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} SUNPOWER LINK. All rights reserved.</span>
          <span>Rooftop solar analysis for India</span>
        </div>
      </div>
    </footer>
  );
}
