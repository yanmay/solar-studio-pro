import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";
import LandingPage from "./pages/LandingPage";
import PwaInstallPrompt from "./components/PwaInstallPrompt";

// Code-split the heavy routes — MapPage pulls Three.js + Leaflet (~1.5MB),
// ResultsPage pulls jsPDF + html2canvas + recharts (~400KB).
// Landing stays eager so first paint is instant.
const MapPage = lazy(() => import("./pages/MapPage"));
const ResultsPage = lazy(() => import("./pages/ResultsPage"));
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
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/results" element={<ResultsPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        <PwaInstallPrompt />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
