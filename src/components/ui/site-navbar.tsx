import type { ReactNode } from "react";
import { Menu } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export interface SiteNavLink {
  title: string;
  to: string;
}

interface SiteNavbarProps {
  actions?: ReactNode;
  links?: SiteNavLink[];
  cta?: { label: string; to: string } | null;
  className?: string;
}

const DEFAULT_LINKS: SiteNavLink[] = [
  { title: "Map", to: "/map" },
  { title: "Sample Report", to: "/dashboard" },
  { title: "Market Insights", to: "/market-insights" },
  { title: "Policy Tracker", to: "/policy-tracker" },
  { title: "API Docs", to: "/developers/docs" },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "relative flex h-10 items-center rounded-md px-3 text-sm font-medium",
    "transition-[color,background-color,transform] duration-200 ease-emil active:scale-[0.98]",
    isActive
      ? "bg-white/[0.08] text-white after:absolute after:inset-x-3 after:-bottom-[13px] after:h-0.5 after:bg-[#ff6600]"
      : "text-white/60 hover:bg-white/[0.04] hover:text-white",
  );

export function SiteNavbar({
  actions,
  links = DEFAULT_LINKS,
  cta = { label: "Launch Analyzer", to: "/map" },
  className,
}: SiteNavbarProps) {
  return (
    <nav
      className={cn(
        "sticky top-0 z-50 border-b border-white/[0.08] bg-[#050505]/88 backdrop-blur-2xl",
        className,
      )}
      aria-label="Primary navigation"
    >
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 md:px-8">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex h-10 items-center gap-2.5" aria-label="SUNPOWER LINK home">
            <img src="/logo.png" alt="" className="h-7 w-7 object-contain" />
            <span className="text-[15px] font-semibold text-white">
              SUNPOWER <span className="text-[#FF6600]">LINK</span>
            </span>
          </Link>

          <div className="hidden items-center gap-1 lg:flex">
            {links.map((link) => (
              <NavLink key={link.to} to={link.to} className={navLinkClass}>
                {link.title}
              </NavLink>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {actions}
          {cta && (
            <Link
              to={cta.to}
              className="hidden h-10 items-center rounded-lg bg-[#FF6600] px-4 text-sm font-semibold text-black transition-[background-color,transform] duration-150 ease-emil hover:bg-[#FF7A1A] active:scale-[0.97] sm:flex"
            >
              {cta.label}
            </Link>
          )}

          <Sheet>
            <SheetTrigger asChild>
              <button
                className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-white/75 transition-[color,background-color,transform] duration-150 ease-emil hover:text-white active:scale-[0.97] lg:hidden"
                aria-label="Open navigation"
              >
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="border-white/10 bg-[#070707] text-white">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2.5 text-white">
                  <img src="/logo.png" alt="" className="h-8 w-8 object-contain" />
                  SUNPOWER <span className="text-[#FF6600]">LINK</span>
                </SheetTitle>
              </SheetHeader>
              <div className="mt-8 flex flex-col gap-1">
                {links.map((link) => (
                  <NavLink key={link.to} to={link.to} className={navLinkClass}>
                    {link.title}
                  </NavLink>
                ))}
                {cta && (
                  <Link
                    to={cta.to}
                    className="mt-4 flex h-10 items-center justify-center rounded-lg bg-[#FF6600] font-semibold text-black transition-transform duration-150 ease-emil active:scale-[0.97]"
                  >
                    {cta.label}
                  </Link>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}

export default SiteNavbar;
