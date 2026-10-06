import type { NextConfig } from "next";

/** Oracle FastAPI origin — server-side rewrites only.
 * Quick tunnels mint a new hostname on restart. Keep this in sync with the
 * live `sgw-tunnel` URL (and set Vercel BACKEND_URL to the same value).
 * Prefer a named host (api.buzzerbidder.com) when available. */
const BACKEND_URL =
  // Prefer env when set, but never leave production on a dead quick-tunnel host.
  process.env.BACKEND_URL &&
  !process.env.BACKEND_URL.includes("overcome-tries-jacob-steering")
    ? process.env.BACKEND_URL
    : "https://liver-departmental-cable-prophet.trycloudflare.com";

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
      // Retired misleading slug — Standard is already pay-per-win / per successful snipe
      {
        source: "/compare/buzzerbidder-vs-per-snipe-tools",
        destination: "/guides/shopgoodwill-sniper-pricing",
        permanent: true,
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
