import React, { useState } from "react";
import { Menu, Sun as SunIcon, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/**
 * SiteNavbar — shared dark-luxury glass top navigation for content pages
 * (Report, Market Insights, Policy Tracker, CRM). Adapted from a 21st.dev
 * Magic component into this project's stack: react-router navigation,
 * framer-motion, Tailwind v3, project amber accent.
 *
 * The home page is intentionally NOT a consumer of this component.
 */
export interface SiteNavLink {
  title: string;
  to: string;
}

interface SiteNavbarProps {
  /** Extra controls rendered on the right (e.g. a Download / Back button). */
  actions?: React.ReactNode;
  /** Override the default link set. */
  links?: SiteNavLink[];
  /** Right-side primary CTA. Defaults to "Launch Analyzer" → /map. */
  cta?: { label: string; to: string } | null;
  className?: string;
}

const DEFAULT_LINKS: SiteNavLink[] = [
  { title: "Map", to: "/map" },
  { title: "Report", to: "/results" },
  { title: "Market Insights", to: "/market-insights" },
  { title: "Policy Tracker", to: "/policy-tracker" },
];

export function SiteNavbar({
  actions,
  links = DEFAULT_LINKS,
  cta = { label: "Launch Analyzer", to: "/map" },
  className,
}: SiteNavbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const go = (to: string) => {
    setMobileOpen(false);
    navigate(to);
  };

  return (
    <nav
      className={cn(
        "sticky top-0 z-50 border-b border-white/[0.07]",
        "supports-[backdrop-filter]:bg-black/40 bg-black/70",
        "backdrop-blur-xl backdrop-saturate-150",
        className,
      )}
      style={{ WebkitBackdropFilter: "blur(16px) saturate(150%)" }}
    >
      {/* hairline amber glow under the bar */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#FF7A1A]/40 to-transparent" />
      <div className="mx-auto flex h-16 max-w-[1320px] items-center justify-between px-4 md:px-8">
        {/* Left: logo + desktop links */}
        <div className="flex items-center gap-8">
          <button
            onClick={() => go("/")}
            className="flex items-center gap-2.5 outline-none"
            aria-label="Sunpower Link home"
          >
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-[#FFB87B] to-[#FF7A1A] shadow-[0_0_18px_rgba(255,122,26,0.45)]">
              <SunIcon className="h-[18px] w-[18px] text-black" strokeWidth={2.5} />
            </span>
            <span className="text-[15px] font-bold tracking-tight text-white">
              SUNPOWER<span className="text-[#FF9D4D]"> LINK</span>
            </span>
          </button>

          <div className="hidden items-center gap-1 lg:flex">
            {links.map((link) => {
              const active = location.pathname === link.to;
              return (
                <button
                  key={link.to}
                  onClick={() => go(link.to)}
                  className={cn(
                    "relative rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                    active
                      ? "text-white"
                      : "text-white/60 hover:text-white hover:bg-white/[0.04]",
                  )}
                >
                  {link.title}
                  {active && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute inset-x-2 -bottom-px h-px bg-[#FF7A1A]"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: actions + CTA + mobile menu */}
        <div className="flex items-center gap-2.5">
          {actions}
          {cta && (
            <button
              onClick={() => go(cta.to)}
              className="hidden h-9 items-center gap-2 rounded-xl bg-gradient-to-r from-[#FFB87B] to-[#FF7A1A] px-4 text-sm font-bold text-black shadow-[0_0_18px_rgba(255,122,26,0.35)] transition-all hover:shadow-[0_0_28px_rgba(255,122,26,0.55)] active:scale-[0.97] sm:inline-flex"
            >
              {cta.label}
            </button>
          )}

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button
                className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-white/80 transition-colors hover:text-white lg:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="border-white/10 bg-black/95 text-white backdrop-blur-xl"
            >
              <SheetHeader>
                <SheetTitle className="text-white">
                  SUNPOWER<span className="text-[#FF9D4D]"> LINK</span>
                </SheetTitle>
              </SheetHeader>
              <div className="mt-8 flex flex-col gap-1">
                {links.map((link) => (
                  <button
                    key={link.to}
                    onClick={() => go(link.to)}
                    className="rounded-lg px-3 py-2.5 text-left text-base font-medium text-white/80 transition-colors hover:bg-white/[0.05] hover:text-white"
                  >
                    {link.title}
                  </button>
                ))}
                {cta && (
                  <button
                    onClick={() => go(cta.to)}
                    className="mt-4 h-11 rounded-xl bg-gradient-to-r from-[#FFB87B] to-[#FF7A1A] font-bold text-black"
                  >
                    {cta.label}
                  </button>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}

export { ArrowLeft as NavBackIcon };
export default SiteNavbar;
