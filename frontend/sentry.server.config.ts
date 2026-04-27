// Sentry — server-side (Node.js runtime) initialisation.
// This file is loaded automatically by @sentry/nextjs via withSentryConfig.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV,

    // Capture 20 % of server-side transactions for performance tracing.
    tracesSampleRate: 0.2,

    // Strip auth headers before sending events.
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers["Authorization"];
        delete event.request.headers["Cookie"];
        delete event.request.headers["cookie"];
      }
      return event;
    },
  });
}
