// Next.js instrumentation hook — registers Sentry on the server side.
// Required for App Router (Next.js 13+) to capture server-component errors.
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  // Edge runtime (middleware, edge API routes)
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
