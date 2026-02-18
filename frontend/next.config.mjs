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

export default nextConfig;
