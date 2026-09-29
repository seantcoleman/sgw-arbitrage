import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/watchlist",
        "/favorites",
        "/account",
        "/settings",
        "/deals",
        "/login",
        "/signup",
        "/reset-password",
        "/auth",
        "/api",
        "/backend",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
