import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* Proxy /api requests to the FastAPI backend during LOCAL development.
     In production (Vercel), NEXT_PUBLIC_API_URL points directly to Render. */
  async rewrites() {
    // Only apply proxy in development (Vercel sets VERCEL env var)
    if (process.env.VERCEL) return [];
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:8001/api/:path*",
      },
    ];
  },
};

const hasAuthToken = Boolean(process.env.SENTRY_AUTH_TOKEN);

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Skip source-map upload when no auth token is present (avoids build failure).
  disableSourceMapUpload: !hasAuthToken,

  silent: true,

  // Route browser-side Sentry requests through the Next.js server.
  tunnelRoute: "/monitoring",

  // Hide generated source maps from the deployed bundle.
  hideSourceMaps: true,

  // Remove Sentry's own debug logging from the production bundle.
  disableLogger: true,
});
