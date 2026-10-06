import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

const DISALLOW = [
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
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: DISALLOW,
      },
      // Allow major AI crawlers on public marketing content for AEO citations.
      {
        userAgent: "GPTBot",
        allow: ["/", "/guides", "/pricing", "/compare", "/alternatives", "/tools"],
        disallow: DISALLOW,
      },
      {
        userAgent: "ClaudeBot",
        allow: ["/", "/guides", "/pricing", "/compare", "/alternatives", "/tools"],
        disallow: DISALLOW,
      },
      {
        userAgent: "PerplexityBot",
        allow: ["/", "/guides", "/pricing", "/compare", "/alternatives", "/tools"],
        disallow: DISALLOW,
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
