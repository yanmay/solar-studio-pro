// Sentry error tracking — initialized only if VITE_SENTRY_DSN is set.
// Captures network-call failures (geocode, NASA POWER, Overpass) with tags.

import * as Sentry from "@sentry/react";

const DSN = import.meta.env.VITE_SENTRY_DSN;
const ENV = import.meta.env.MODE;

let initialized = false;

export function initSentry(): void {
  if (initialized || !DSN) return;
  Sentry.init({
    dsn: DSN,
    environment: ENV,
    integrations: [
      Sentry.browserTracingIntegration(),
      // Replay only in prod to save bandwidth
      ...(ENV === "production"
        ? [Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false })]
        : []),
    ],
    tracesSampleRate: ENV === "production" ? 0.1 : 1.0,
    replaysSessionSampleRate: 0.01,      // 1% of sessions
    replaysOnErrorSampleRate: 1.0,       // always when an error occurs
    beforeSend(event) {
      // Drop noisy HMR + extension errors
      const msg = event.message || event.exception?.values?.[0]?.value || "";
      if (/ResizeObserver|extension|HMR|ChunkLoadError/.test(msg)) return null;
      return event;
    },
  });
  initialized = true;
}

/** Capture a network/API failure with rich context */
export function captureApiError(
  source: string,                         // e.g. "nasa-power" | "overpass" | "nominatim"
  err: unknown,
  extra?: Record<string, unknown>,
): void {
  try {
    if (!initialized) {
      // Still log to console in dev so devs see the error
      if (ENV !== "production") console.warn(`[api:${source}]`, err, extra);
      return;
    }
    Sentry.withScope((scope) => {
      scope.setTag("api", source);
      if (extra) {
        for (const [k, v] of Object.entries(extra)) scope.setExtra(k, v);
      }
      Sentry.captureException(err);
    });
  } catch { /* noop */ }
}

export const SentryErrorBoundary = Sentry.ErrorBoundary;
