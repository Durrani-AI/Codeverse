// Sentry — client-side initialisation (browser).
// This file is loaded automatically by @sentry/nextjs via withSentryConfig.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Only initialise when a DSN is provided (no-op in local dev without one).
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV,

    // Capture 10 % of page-load/navigation transactions for performance tracing.
    tracesSampleRate: 0.1,

    // Replay 1 % of normal sessions and 100 % of sessions with an error.
    replaysSessionSampleRate: 0.01,
    replaysOnErrorSampleRate: 1.0,

    // Load the Session Replay integration lazily to keep the initial bundle small.
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,       // mask PII in text nodes
        blockAllMedia: true,     // block screenshots of media elements
      }),
    ],

    // Strip sensitive headers/cookies from captured events.
    beforeSend(event) {
      if (event.request?.cookies) {
        event.request.cookies = "[Filtered]";
      }
      if (event.request?.headers) {
        delete event.request.headers["Authorization"];
        delete event.request.headers["Cookie"];
      }
      return event;
    },
  });
}
