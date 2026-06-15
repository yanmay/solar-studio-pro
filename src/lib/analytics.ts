import { track as vercelTrack } from '@vercel/analytics'

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

export function track(event: string, props?: Record<string, string | number | boolean>): void {
  try {
    if (typeof window !== "undefined") {
      window.plausible?.(event, props ? { props } : undefined);
    }
  } catch {
    // Never let analytics errors bubble to user
  }
  try {
    vercelTrack(event, props);
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

export const trackAddressSearched = () => track('address_searched')

export const trackPolygonCompleted = (areaMq: number) => 
  track('polygon_completed', { area_m2: Math.round(areaMq) })

export const trackConfigStepCompleted = (step: 1 | 2 | 3) => 
  track('config_step_completed', { step })

export const trackResultsViewed = (systemKwp: number) => 
  track('results_viewed', { system_kwp: Math.round(systemKwp * 10) / 10 })

export const trackPaywallShown = () => track('paywall_shown')

export const trackPaymentInitiated = (plan: string) => 
  track('payment_initiated', { plan })

export const trackPaymentCompleted = (plan: string) => 
  track('payment_completed', { plan })

export const trackPdfDownloaded = () => track('pdf_downloaded')

