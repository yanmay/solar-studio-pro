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
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import { captureReferrerCode } from "./lib/referrals";

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
  useEffect(() => {
    trackPageView(loc.pathname);
    
    // Capture referral query parameter
    const params = new URLSearchParams(loc.search);
    captureReferrerCode(params);
  }, [loc]);
  return null;
}

// Code-split the heavy routes
const MapPage = lazy(() => import("./pages/MapPage"));
const ResultsPage = lazy(() => import("./pages/ResultsPage"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const MarketInsightsPage = lazy(() => import("./pages/MarketInsightsPage"));
const PolicyTrackerPage = lazy(() => import("./pages/PolicyTrackerPage"));
const SignInPage = lazy(() => import("./pages/auth/SignInPage"));
const SignUpPage = lazy(() => import("./pages/auth/SignUpPage"));
const ForgotPasswordPage = lazy(() => import("./pages/auth/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/auth/ResetPasswordPage"));
const MyScansPage = lazy(() => import("./pages/MyScansPage"));
const AccountSettingsPage = lazy(() => import("./pages/AccountSettingsPage"));
const ResultsDashboard = lazy(() => import("./pages/ResultsDashboard"));
const InstallerSignup = lazy(() => import("./pages/installer/Signup"));
const InstallerDashboard = lazy(() => import("./pages/installer/Dashboard"));
const InstallerLeadDetail = lazy(() => import("./pages/installer/LeadDetail"));
const ApiDocs = lazy(() => import("./pages/ApiDocs"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
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
    <AuthProvider>
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
              <Route path="/auth/signin" element={<SignInPage />} />
              <Route path="/auth/signup" element={<SignUpPage />} />
              <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
              <Route path="/my-scans" element={<ProtectedRoute><MyScansPage /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><AccountSettingsPage /></ProtectedRoute>} />
              <Route path="/dashboard" element={<ResultsDashboard />} />
              <Route path="/installer/signup" element={<InstallerSignup />} />
              <Route path="/installer/dashboard" element={<InstallerDashboard />} />
              <Route path="/installer/lead/:leadId" element={<InstallerLeadDetail />} />
              <Route path="/api/docs" element={<ApiDocs />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          <PwaInstallPrompt />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
