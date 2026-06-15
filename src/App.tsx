import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import LandingPage from "./pages/LandingPage";
import MapPage from "./pages/MapPage";
import ResultsPage from "./pages/ResultsPage";
import PrivacyPage from "./pages/PrivacyPage";
import MarketInsightsPage from "./pages/MarketInsightsPage";
import PolicyTrackerPage from "./pages/PolicyTrackerPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/market-insights" element={<MarketInsightsPage />} />
          <Route path="/policy-tracker" element={<PolicyTrackerPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);


export default App;
