import type { NextConfig } from "next";

/** Oracle FastAPI origin via Cloudflare tunnel — used only for server-side rewrites.
 *  Quick tunnels change hostname when sgw-tunnel restarts.
 *  Do not read BACKEND_URL here until Vercel env can be updated (stale trycloudflare
 *  hostnames override a good default and break production). */
const BACKEND_URL =
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
