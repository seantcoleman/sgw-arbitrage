import type { NextConfig } from "next";

/** Oracle FastAPI origin — server-side rewrites only.
 * Prefer a stable named host (api.buzzerbidder.com). Fall back to the current
 * quick-tunnel URL until the named Cloudflare tunnel is live. */
const BACKEND_URL =
  process.env.BACKEND_URL ||
  "https://overcome-tries-jacob-steering.trycloudflare.com";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.shopgoodwill.com" },
      { protocol: "https", hostname: "shopgoodwillimages.azureedge.net" },
      { protocol: "https", hostname: "**.azureedge.net" },
    ],
  },
  async redirects() {
    return [
      {
        source: "/deals",
        destination: "/watchlist",
        permanent: false,
      },
      {
        source: "/deals/:path*",
        destination: "/watchlist",
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/backend/:path*",
        destination: `${BACKEND_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
