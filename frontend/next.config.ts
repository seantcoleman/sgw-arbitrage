import type { NextConfig } from "next";

/** Oracle FastAPI origin via Cloudflare tunnel — used only for server-side rewrites.
 *  Quick tunnels change hostname when sgw-tunnel restarts; set BACKEND_URL to the new https URL.
 *  Ignore stale http://public-ip:8000 values (Oracle firewall blocks direct access). */
const TUNNEL_BACKEND =
  "https://overcome-tries-jacob-steering.trycloudflare.com";
const rawBackend = process.env.BACKEND_URL?.trim() ?? "";
const BACKEND_URL =
  rawBackend.startsWith("https://") ? rawBackend : TUNNEL_BACKEND;

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
