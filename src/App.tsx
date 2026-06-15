import { lazy, Suspense, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";
import LandingPage from "./pages/LandingPage";
import PwaInstallPrompt from "./components/PwaInstallPrompt";
import { trackPageView } from "./lib/analytics";

// Load Plausible script once (guarded by env var)
const PLAUSIBLE_DOMAIN = import.meta.env.VITE_PLAUSIBLE_DOMAIN;
function loadPlausible() {
  if (!PLAUSIBLE_DOMAIN || typeof document === "undefined") return;
  if (document.querySelector("script[data-plausible]")) return;
  const s = document.createElement("script");
  s.defer = true;
  s.setAttribute("data-domain", PLAUSIBLE_DOMAIN);
  s.setAttribute("data-plausible", "1");
  s.src = "https://plausible.io/js/script.js";
  document.head.appendChild(s);
  // Proxy queue until script loads
  // @ts-expect-error — stub matches upstream Plausible bootstrap
  window.plausible = window.plausible || function () { (window.plausible.q = window.plausible.q || []).push(arguments); };
}
loadPlausible();

// SPA page-view tracker
function RouteTracker() {
  const loc = useLocation();
  useEffect(() => { trackPageView(loc.pathname); }, [loc.pathname]);
  return null;
}

// Code-split the heavy routes
const MapPage = lazy(() => import("./pages/MapPage"));
const ResultsPage = lazy(() => import("./pages/ResultsPage"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const MarketInsightsPage = lazy(() => import("./pages/MarketInsightsPage"));
const PolicyTrackerPage = lazy(() => import("./pages/PolicyTrackerPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background" role="status" aria-label="Loading">
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="w-8 h-8 text-sunpower-accent animate-spin" />
      <span className="text-sm text-sunpower-text-muted">Loading…</span>
    </div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <RouteTracker />
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/results" element={<ResultsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/market-insights" element={<MarketInsightsPage />} />
            <Route path="/policy-tracker" element={<PolicyTrackerPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        <PwaInstallPrompt />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);


export default App;
