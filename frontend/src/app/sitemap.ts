import type { MetadataRoute } from "next";
import { allContentPages } from "@/lib/guides";
import { SITE_URL } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const marketing: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/pricing`, lastModified, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/guides`, lastModified, changeFrequency: "weekly", priority: 0.85 },
    { url: `${SITE_URL}/terms`, lastModified, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/privacy`, lastModified, changeFrequency: "yearly", priority: 0.3 },
  ];

  const content = allContentPages().map((page) => ({
    url: `${SITE_URL}${page.href}`,
    lastModified,
    changeFrequency: "monthly" as const,
    priority: page.priority ?? 0.8,
  }));

  return [...marketing, ...content];
}
