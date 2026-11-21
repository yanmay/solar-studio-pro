import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import App from "./App.tsx";
import "./index.css";
import { initSentry, SentryErrorBoundary } from "./lib/sentry";
import "./i18n";

initSentry();

if ("serviceWorker" in navigator) {
  // Never let a production PWA worker mask the live Vite bundle during local development.
  if (import.meta.env.DEV) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => registration.unregister());
    }).catch(() => undefined);
  }
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
}

function FallbackScreen() {
  return (
    <div className="min-h-screen bg-[#050505] px-6 text-white">
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center text-center">
        <img src="/logo.png" alt="SUNPOWER LINK" className="h-14 w-14 object-contain" />
        <p className="mt-6 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#FF6600]">Application recovery</p>
        <h1 className="mt-3 text-2xl font-semibold">This view could not be displayed.</h1>
        <p className="mt-3 text-sm leading-relaxed text-white/55">
          Your work has not been intentionally cleared. Try loading the view again, or return to the homepage.
        </p>
        <div className="mt-7 flex w-full flex-col gap-3 sm:flex-row">
          <button onClick={() => window.location.reload()} className="h-11 flex-1 rounded-xl bg-[#FF6600] px-5 text-sm font-bold text-black transition-[background-color,transform] duration-150 hover:bg-[#FF7A1A] active:scale-[0.97]">
            Try again
          </button>
          <button onClick={() => { window.location.href = "/"; }} className="h-11 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-5 text-sm font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-white/[0.08] active:scale-[0.97]">
            Return home
          </button>
        </div>
      </div>
    </div>
  );
}

try {
  document.documentElement.classList.add("dark");
  localStorage.removeItem("sunpower-theme");
  localStorage.removeItem("theme");
} catch {
  // Local storage can be unavailable in restricted browser contexts.
}

createRoot(document.getElementById("root")!).render(
  <>
    <SentryErrorBoundary fallback={<FallbackScreen />} showDialog={false}>
      <App />
    </SentryErrorBoundary>
    <Analytics />
  </>,
);
