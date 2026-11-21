import * as React from "react";
import { createPortal } from "react-dom";
import { BarChart3, Code2, FileText, Globe2, Layers3, Leaf, Menu, Plug, ShieldCheck, Users, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";

type LinkItem = {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
};

const productLinks: LinkItem[] = [
  { title: "Rooftop Analyzer", href: "/map", icon: Layers3, description: "Trace your roof and calculate solar potential." },
  { title: "Market Insights", href: "/market-insights", icon: BarChart3, description: "Compare capacity, cost and payback benchmarks." },
  { title: "Policy Tracker", href: "/policy-tracker", icon: ShieldCheck, description: "Follow subsidies, tariffs and state regulations." },
  { title: "API Docs", href: "/developers/docs", icon: Code2, description: "Connect solar intelligence to your own workflow." },
];

const companyLinks: LinkItem[] = [
  { title: "Architecture", href: "#about", icon: Globe2, description: "See how SolarNet turns spatial data into decisions." },
  { title: "Process", href: "#workflow", icon: Plug, description: "Three practical steps from address to report." },
  { title: "FAQ", href: "#faq", icon: FileText, description: "Answers for homeowners and solar partners." },
];

const companyLinks2: LinkItem[] = [
  { title: "Installer Partners", href: "/installer/signup", icon: Users },
  { title: "Privacy", href: "/privacy", icon: Leaf },
];

function useScroll(threshold = 10) {
  const [scrolled, setScrolled] = React.useState(false);
  React.useEffect(() => {
    const update = () => setScrolled(window.scrollY > threshold);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [threshold]);
  return scrolled;
}

function ListItem({ title, href, icon: Icon, description }: LinkItem) {
  const isSection = href.startsWith("#");
  const className = "group flex items-start gap-3 rounded-xl border border-transparent p-3 transition-colors hover:border-white/10 hover:bg-white/5";
  const content = (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-[#ff6600]/20 bg-[#ff6600]/10 text-[#ff8b3d] transition-colors group-hover:bg-[#ff6600] group-hover:text-black">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-white">{title}</span>
        {description && <span className="mt-1 block text-xs leading-relaxed text-white/45">{description}</span>}
      </span>
    </>
  );

  return isSection ? <a href={href} className={className}>{content}</a> : <Link to={href} className={className}>{content}</Link>;
}

type MobileMenuProps = React.ComponentProps<"div"> & { open: boolean; onClose: () => void };

function MobileMenu({ open, onClose, className, ...props }: MobileMenuProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || typeof window === "undefined") return null;
  return createPortal(
    <div id="mobile-menu" className={cn("fixed inset-x-0 bottom-0 top-16 z-[90] flex flex-col overflow-y-auto border-y border-white/10 bg-[#070707]/95 p-5 text-white backdrop-blur-xl md:hidden", className)} {...props}>
      <div className="mb-6 flex items-center justify-between border-b border-white/10 pb-4">
        <span className="text-xs font-mono uppercase tracking-[.18em] text-[#ff8b3d]">Solar intelligence</span>
        <button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-xl border border-white/10 text-white/70 hover:bg-white/5 hover:text-white" aria-label="Close navigation">
          <X className="size-5" />
        </button>
      </div>
      <div className="flex flex-col gap-1">
        <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-[.16em] text-white/35">Product</p>
        {productLinks.map((link) => <MobileLink key={link.title} item={link} onClose={onClose} />)}
        <p className="mt-5 px-3 pb-1 text-xs font-semibold uppercase tracking-[.16em] text-white/35">Company</p>
        {companyLinks.map((link) => <MobileLink key={link.title} item={link} onClose={onClose} />)}
        {companyLinks2.map((link) => <MobileLink key={link.title} item={link} onClose={onClose} />)}
      </div>
      <div className="mt-auto grid gap-2 border-t border-white/10 pt-5">
        <Button asChild variant="outline" className="w-full border-white/15 bg-transparent text-white hover:bg-white/5 hover:text-white"><Link to="/auth/signin" onClick={onClose}>Sign In</Link></Button>
        <Button asChild className="w-full bg-[#ff6600] font-bold text-black hover:bg-[#ff7a1a]"><Link to="/map" onClick={onClose}>Launch Analyzer</Link></Button>
      </div>
    </div>,
    document.body,
  );
}

function MobileLink({ item, onClose }: { item: LinkItem; onClose: () => void }) {
  const Icon = item.icon;
  const className = "flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm text-white/75 transition-colors hover:bg-white/5 hover:text-white";
  const children = <><Icon className="size-4 text-[#ff8b3d]" /><span>{item.title}</span></>;
  return item.href.startsWith("#") ? <a href={item.href} onClick={onClose} className={className}>{children}</a> : <Link to={item.href} onClick={onClose} className={className}>{children}</Link>;
}

export function Header() {
  const scrolled = useScroll(10);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <header className={cn("fixed inset-x-0 top-0 z-[100] px-3 pt-3", scrolled && "pt-3")}>
      <nav className={cn("mx-auto flex h-14 w-full max-w-[1240px] items-center justify-between rounded-2xl border px-4 transition-[background-color,border-color,box-shadow] duration-200 md:px-6", scrolled ? "border-white/10 bg-[#070707]/92 shadow-[0_12px_40px_rgba(0,0,0,.35)] backdrop-blur-xl" : "border-transparent bg-black/20")} aria-label="Landing navigation">
        <Link to="/" className="flex items-center gap-2.5" aria-label="SUNPOWER LINK home">
          <img src="/logo.png" alt="" className="size-8 object-contain" />
          <span className="text-[15px] font-bold text-white">SUNPOWER <span className="font-light italic text-[#ff6600]">LINK</span></span>
        </Link>

        <NavigationMenu className="hidden md:flex">
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuTrigger className="bg-transparent text-white/65 hover:bg-white/5 hover:text-white data-[state=open]:bg-white/5 data-[state=open]:text-white">Product</NavigationMenuTrigger>
              <NavigationMenuContent className="border-white/10 bg-[#090909]/98 p-2 shadow-[0_24px_70px_rgba(0,0,0,.65)] backdrop-blur-2xl">
                <ul className="grid w-[430px] grid-cols-2 gap-1 rounded-xl border border-white/10 bg-[#0d0d0d] p-1.5">{productLinks.map((item) => <li key={item.title}><ListItem {...item} /></li>)}</ul>
              </NavigationMenuContent>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuTrigger className="bg-transparent text-white/65 hover:bg-white/5 hover:text-white data-[state=open]:bg-white/5 data-[state=open]:text-white">Company</NavigationMenuTrigger>
              <NavigationMenuContent className="border-white/10 bg-[#090909]/98 p-2 shadow-[0_24px_70px_rgba(0,0,0,.65)] backdrop-blur-2xl">
                <div className="grid w-[520px] grid-cols-[1.3fr_1fr] gap-2">
                  <ul className="rounded-xl border border-white/10 bg-[#0d0d0d] p-1.5">{companyLinks.map((item) => <li key={item.title}><ListItem {...item} /></li>)}</ul>
                  <ul className="rounded-xl border border-white/10 p-1.5">{companyLinks2.map((item) => <li key={item.title}><ListItem {...item} /></li>)}</ul>
                </div>
              </NavigationMenuContent>
            </NavigationMenuItem>
            <NavigationMenuLink asChild className="rounded-md px-4 py-2 text-sm text-white/65 hover:bg-white/5 hover:text-white"><a href="#workflow">Process</a></NavigationMenuLink>
            <NavigationMenuLink asChild className="rounded-md px-4 py-2 text-sm text-white/65 hover:bg-white/5 hover:text-white"><a href="#faq">FAQ</a></NavigationMenuLink>
          </NavigationMenuList>
        </NavigationMenu>

        <div className="hidden items-center gap-2 md:flex">
          <Button asChild variant="outline" className="h-10 border-white/15 bg-transparent text-sm text-white/75 hover:bg-white/5 hover:text-white"><Link to="/auth/signin">Sign In</Link></Button>
          <Button asChild className="h-10 bg-[#ff6600] text-sm font-bold text-black hover:bg-[#ff7a1a]"><Link to="/map">Launch Analyzer</Link></Button>
        </div>
        <button type="button" onClick={() => setOpen((value) => !value)} className="grid size-10 place-items-center rounded-xl border border-white/10 bg-black/40 text-white md:hidden" aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? "Close navigation" : "Open navigation"}>
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </nav>
      <MobileMenu open={open} onClose={() => setOpen(false)} />
    </header>
  );
}
