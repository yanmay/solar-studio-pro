import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  ScanLine,
  Settings,
  Shield,
  Map as MapIcon,
  FileText,
  TrendingUp,
  Landmark,
  Home,
} from "lucide-react";

/**
 * nav-registry — single source of truth for navigable destinations.
 *
 * The sidebar (AppSidebar) and the global command palette (CommandPalette) both
 * read from here so the two never drift. Everything in this module is pure data
 * plus one pure helper (`filterRoutes`) — no React, no side effects — so it is
 * trivially unit-testable.
 */
export interface NavItem {
  title: string;
  path: string;
  icon: LucideIcon;
  /** Extra terms the palette also matches against (aliases, synonyms). */
  keywords?: string[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** Sidebar groups for the Supabase-auth app cluster (dashboard/scans/settings/admin). */
export const APP_NAV: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { title: "Dashboard", path: "/dashboard", icon: LayoutDashboard, keywords: ["home", "overview"] },
      { title: "My Scans", path: "/my-scans", icon: ScanLine, keywords: ["reports", "history", "analyses"] },
    ],
  },
  {
    label: "Account",
    items: [
      { title: "Settings", path: "/settings", icon: Settings, keywords: ["account", "profile", "preferences"] },
      { title: "Admin", path: "/admin", icon: Shield, keywords: ["console", "management"] },
    ],
  },
];

/** Sidebar nav for the installer portal (separate, localStorage-backed auth). */
export const INSTALLER_NAV: NavGroup[] = [
  {
    label: "Installer",
    items: [
      {
        title: "Dashboard",
        path: "/installer/dashboard",
        icon: LayoutDashboard,
        keywords: ["leads", "pipeline", "crm"],
      },
    ],
  },
];

/** Flat destination list the command palette can jump to (public + app routes). */
export const PALETTE_ROUTES: NavItem[] = [
  { title: "Home", path: "/", icon: Home, keywords: ["landing", "start"] },
  { title: "Map", path: "/map", icon: MapIcon, keywords: ["analyzer", "scan", "rooftop", "geospatial"] },
  { title: "Report", path: "/results", icon: FileText, keywords: ["results", "analysis"] },
  { title: "Market Insights", path: "/market-insights", icon: TrendingUp, keywords: ["market", "trends", "pricing"] },
  { title: "Policy Tracker", path: "/policy-tracker", icon: Landmark, keywords: ["policy", "subsidy", "regulation", "pm surya"] },
  { title: "Dashboard", path: "/dashboard", icon: LayoutDashboard, keywords: ["overview"] },
  { title: "My Scans", path: "/my-scans", icon: ScanLine, keywords: ["reports", "history"] },
  { title: "Settings", path: "/settings", icon: Settings, keywords: ["account", "profile"] },
];

/**
 * Case-insensitive filter over each item's title + keywords.
 * An empty (or whitespace-only) query returns the list unchanged.
 */
export function filterRoutes(routes: NavItem[], query: string): NavItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return routes;
  return routes.filter((route) => {
    const haystack = [route.title, ...(route.keywords ?? [])].join(" ").toLowerCase();
    return haystack.includes(q);
  });
}
