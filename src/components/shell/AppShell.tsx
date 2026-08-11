import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { AppSidebar } from "./AppSidebar";
import type { NavGroup } from "@/lib/nav-registry";

interface AppShellProps {
  /** Sidebar nav groups (APP_NAV for the Supabase app, INSTALLER_NAV for the portal). */
  nav: NavGroup[];
  /** Top-bar profile slot — real Supabase UserMenu, or the installer's own. */
  profile: React.ReactNode;
  /** Optional sidebar footer. */
  sidebarFooter?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * AppShell — reusable layout chrome for app-like routes: collapsible sidebar
 * left, a sticky top bar (trigger + palette launcher + New Scan + profile),
 * then the routed content. Generic over `nav`/`profile` so both the Supabase
 * app cluster and the installer portal share one shell with different data.
 *
 * Always-on dark: the host pins documentElement.dark + #050505 in index.css;
 * no theme toggle lives here.
 */
export function AppShell({ nav, profile, sidebarFooter, children }: AppShellProps) {
  return (
    <SidebarProvider>
      <AppSidebar nav={nav} footer={sidebarFooter} />
      <SidebarInset className="bg-[#050505]">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-white/[0.06] bg-[#050505]/85 px-3 backdrop-blur-md sm:px-4">
          <SidebarTrigger className="text-white/70 hover:text-white" />
          <button
            type="button"
            data-solar-open-palette
            className="group flex flex-1 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-white/40 transition-colors hover:border-[#FF6600]/40 hover:bg-white/[0.06] hover:text-white/70 sm:max-w-xs"
            aria-label="Search or jump to…"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="truncate">Search or jump to…</span>
            <kbd className="ml-auto hidden items-center gap-0.5 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-white/40 sm:flex">
              ⌘K
            </kbd>
          </button>
          <Button asChild size="sm" className="ml-auto sm:ml-0" variant="outline">
            <Link to="/map">New Scan</Link>
          </Button>
          {profile}
        </header>
        {/* Neutral landmark/scroll container — each page owns its own
            max-width and padding, so the shell imposes none. */}
        <main className="flex-1 overflow-x-hidden">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
