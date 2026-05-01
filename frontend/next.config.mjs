import { withSentryConfig } from "@sentry/nextjs";

const backendApiBase = (
  process.env.RENDER_API_BASE_URL ??
  (process.env.NODE_ENV === "production"
    ? "https://ai-interview-backend-3agx.onrender.com/api/v1"
    : "http://127.0.0.1:8001/api/v1")
).replace(/\/+$/, "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* Always proxy API requests through Next.js so users only use one public URL.
     Vercel serves frontend and forwards /api/v1/* to Render backend. */
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backendApiBase}/:path*`,
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
