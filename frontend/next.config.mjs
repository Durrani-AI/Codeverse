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

// Wrap with Sentry only when a DSN is present (no-op in local dev without one).
// https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Upload source maps to Sentry during CI/CD builds.
  // Requires SENTRY_AUTH_TOKEN set in the build environment / Vercel settings.
  silent: !process.env.CI,

  // Wider client-side source-map upload for better stack traces.
  widenClientFileUpload: true,

  // Route browser-side Sentry requests through the Next.js server to avoid
  // ad-blockers stripping the DSN request.
  tunnelRoute: "/monitoring",

  // Hide generated source maps from the deployed bundle.
  hideSourceMaps: true,

  // Remove Sentry's own debug logging from the production bundle.
  disableLogger: true,
});
