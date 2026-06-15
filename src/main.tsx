import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import { Analytics } from '@vercel/analytics/react'
import App from './App.tsx'
import './index.css'

// Initialize Sentry error monitoring
const dsn = import.meta.env.VITE_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
    integrations: [Sentry.browserTracingIntegration()],
  });
}

// Apply stored theme immediately to prevent flash
try {
  const stored = localStorage.getItem('sunpower-theme');
  if (stored === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
} catch (error) {
  console.warn("localStorage theme read failed in entrypoint:", error);
}

createRoot(document.getElementById("root")!).render(
  <>
    {dsn ? (
      <Sentry.ErrorBoundary fallback={<p className="p-4 text-sm text-muted-foreground text-center">Something went wrong.</p>}>
        <App />
      </Sentry.ErrorBoundary>
    ) : (
      <App />
    )}
    <Analytics />
  </>
);

