import { SITE_NAME, SITE_URL } from "@/lib/seo";

export type GuideMeta = {
  href: string;
  title: string;
  description: string;
  keywords: string;
  priority?: number;
  /** ISO date YYYY-MM-DD — first publish */
  datePublished: string;
  /** ISO date YYYY-MM-DD — bump only on substantive edits */
  dateModified: string;
};

/** Single registry for guides hub + sitemap so new posts cannot be forgotten. */
export const GUIDES: GuideMeta[] = [
  {
    href: "/guides/shopgoodwill-sniping",
    title: "How ShopGoodwill sniping works",
    description:
      "What a last-second bid does, how eBay comps fit in, and how Standard pay-per-win pricing compares with monthly Pro.",
    keywords: "shopgoodwill sniping, shopgoodwill sniper, last-second bid",
    priority: 0.9,
    datePublished: "2026-09-30",
    dateModified: "2026-10-20",
  },
  {
    href: "/guides/shopgoodwill-ebay-arbitrage",
    title: "ShopGoodwill to eBay arbitrage",
    description:
      "How to use eBay sold comps, fees, and shipping to set max bids on ShopGoodwill auctions without overpaying.",
    keywords: "shopgoodwill ebay arbitrage, goodwill auction flipping",
    priority: 0.85,
    datePublished: "2026-10-01",
    dateModified: "2026-10-20",
  },
  {
    href: "/guides/shopgoodwill-auto-bid",
    title: "ShopGoodwill auto bid & scheduled sniping",
    description:
      "How automatic last-second bidding works on ShopGoodwill, what can miss, and how hosted snipers compare to manual bidding.",
    keywords: "shopgoodwill auto bid, automatic bidding, scheduled snipe",
    priority: 0.85,
    datePublished: "2026-10-01",
    dateModified: "2026-10-20",
  },
  {
    href: "/guides/best-shopgoodwill-sniper",
    title: "Best ShopGoodwill sniper: what to look for",
    description:
      "A buyer’s guide to ShopGoodwill snipers — timing, comps, pricing models, hosted vs desktop, and when BuzzerBidder fits.",
    keywords: "best shopgoodwill sniper, shopgoodwill auction sniper",
    priority: 0.85,
    datePublished: "2026-10-01",
    dateModified: "2026-10-20",
  },
  {
    href: "/guides/shopgoodwill-bidding-strategy",
    title: "ShopGoodwill bidding strategy & tips",
    description:
      "When to snipe, how to set max bids from comps, and when to walk away — practical ShopGoodwill bidding tips.",
    keywords: "shopgoodwill bidding tips, shopgoodwill bidding strategy",
    priority: 0.85,
    datePublished: "2026-10-06",
    dateModified: "2026-10-20",
  },
];

export const COMPARE_PAGES: GuideMeta[] = [
  {
    href: "/compare/buzzerbidder-vs-thriftsniper",
    title: "BuzzerBidder vs ThriftSniper",
    description:
      "Hosted ShopGoodwill sniping with eBay comps and pay-when-you-win plans versus ThriftSniper’s per-win flat fee — factual comparison.",
    keywords: "thriftsniper alternative, buzzerbidder vs thriftsniper",
    priority: 0.8,
    datePublished: "2026-10-06",
    dateModified: "2026-10-20",
  },
  {
    href: "/compare/buzzerbidder-vs-bidpulse",
    title: "BuzzerBidder vs BidPulse",
    description:
      "Compare BuzzerBidder’s win-fee / Pro pricing and eBay comps with BidPulse’s subscription-style ShopGoodwill sniping.",
    keywords: "bidpulse alternative, buzzerbidder vs bidpulse",
    priority: 0.8,
    datePublished: "2026-10-06",
    dateModified: "2026-10-20",
  },
];

export const ALTERNATIVES_PAGES: GuideMeta[] = [
  {
    href: "/alternatives/shopgoodwill-snipers",
    title: "ShopGoodwill sniper alternatives (2026)",
    description:
      "Criteria-led roundup of ShopGoodwill sniping tools — pricing models, hosted vs desktop, comps, and when each fits.",
    keywords: "shopgoodwill sniper alternatives, thriftsniper alternative",
    priority: 0.8,
    datePublished: "2026-10-06",
    dateModified: "2026-10-20",
  },
];

export const TOOL_PAGES: GuideMeta[] = [
  {
    href: "/tools/max-bid-calculator",
    title: "ShopGoodwill max bid calculator",
    description:
      "Free calculator: turn eBay sold comps, fees, shipping, and target profit into a ShopGoodwill max bid.",
    keywords: "shopgoodwill max bid calculator, ebay profit calculator",
    priority: 0.85,
    datePublished: "2026-10-06",
    dateModified: "2026-10-20",
  },
];

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function allContentPages(): GuideMeta[] {
  return [...GUIDES, ...COMPARE_PAGES, ...ALTERNATIVES_PAGES, ...TOOL_PAGES];
}

export function getContentMeta(href: string): GuideMeta | undefined {
  return allContentPages().find((p) => p.href === href);
}

export function relatedGuides(currentHref: string, limit = 3): GuideMeta[] {
  return allContentPages()
    .filter((g) => g.href !== currentHref)
    .slice(0, limit);
}

/** UTC calendar date for display (avoids timezone day-shift). */
export function formatGuideDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function articleJsonLd(meta: GuideMeta, headline?: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: headline ?? meta.title,
    description: meta.description,
    author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    mainEntityOfPage: absoluteUrl(meta.href),
    datePublished: meta.datePublished,
    dateModified: meta.dateModified,
  };
}

export function breadcrumbJsonLd(
  crumbs: { name: string; href: string }[]
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: absoluteUrl(c.href),
    })),
  };
}
