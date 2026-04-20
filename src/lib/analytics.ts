// Privacy-friendly analytics via Plausible.
// Set VITE_PLAUSIBLE_DOMAIN in .env (e.g. "sunpowerlink.in") to enable.
// When unset, track() is a no-op (dev / preview environments).

type PlausibleFn = (event: string, opts?: { props?: Record<string, string | number | boolean> }) => void;

declare global {
  interface Window {
    plausible?: PlausibleFn;
  }
}

export type FunnelEvent =
  | "Landing View"
  | "CTA Analyze Click"
  | "Map View"
  | "Location Found"            // geolocation success
  | "Search Submitted"
  | "Auto-Detect Roof"
  | "Roof Section Added"
  | "Drawing Complete"
  | "Calculate Click"
  | "Results View"
  | "PDF Download"
  | "WhatsApp Share"
  | "Installer Quote Click"
  | "Lead Submitted"
  | "PWA Install Shown"
  | "PWA Install Accepted"
  | "Language Changed"
  | "Error";

export function track(event: FunnelEvent, props?: Record<string, string | number | boolean>): void {
  try {
    if (typeof window === "undefined") return;
    window.plausible?.(event, props ? { props } : undefined);
  } catch {
    // Never let analytics errors bubble to user
  }
}

/** Track page view (SPA navigations) */
export function trackPageView(path: string): void {
  try {
    window.plausible?.("pageview", { props: { path } });
  } catch { /* noop */ }
}
