import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.shopgoodwill.com" },
      { protocol: "https", hostname: "shopgoodwillimages.azureedge.net" },
      { protocol: "https", hostname: "**.azureedge.net" },
    ],
  },
};

export default nextConfig;
