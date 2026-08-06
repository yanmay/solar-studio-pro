import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import { Analytics } from '@vercel/analytics/react'
import App from './App.tsx'
import './index.css'
import { initSentry, SentryErrorBoundary } from './lib/sentry'
import './i18n'

initSentry();

// Force-reload when a fresh service worker activates so users pick up new
// deploys without "all tabs closed" nonsense.
if ("serviceWorker" in navigator) {
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
}

function FallbackScreen() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem", fontFamily: "system-ui", textAlign: "center" }}>
      <div>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>☀️</div>
        <h1 style={{ fontSize: "20px", margin: "0 0 8px" }}>Something went wrong</h1>
        <p style={{ color: "#888", margin: "0 0 20px", maxWidth: "360px" }}>
          Our team has been notified. Refresh to try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{ background: "#F59E0B", color: "white", border: 0, padding: "10px 20px", borderRadius: 8, fontSize: 14, cursor: "pointer" }}
        >
          Reload
        </button>
      </div>
    </div>
  );
}

// Force dark mode permanently — no light mode
try {
  document.documentElement.classList.add('dark');
  localStorage.removeItem('sunpower-theme');
  localStorage.removeItem('theme');
} catch (error) {
  // ignore
}

createRoot(document.getElementById("root")!).render(
  <>
    <SentryErrorBoundary fallback={<FallbackScreen />} showDialog={false}>
      <App />
    </SentryErrorBoundary>
    <Analytics />
  </>
);
