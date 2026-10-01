import { SITE_URL } from "@/lib/seo";

export type GuideMeta = {
  href: string;
  title: string;
  description: string;
  keywords: string;
  priority?: number;
};

/** Single registry for guides hub + sitemap so new posts cannot be forgotten. */
export const GUIDES: GuideMeta[] = [
  {
    href: "/guides/shopgoodwill-sniping",
    title: "How ShopGoodwill sniping works",
    description:
      "What a last-second bid does, how eBay comps fit in, and how pay-when-you-win pricing compares with per-snipe tools.",
    keywords: "shopgoodwill sniping, shopgoodwill sniper, last-second bid",
    priority: 0.9,
  },
  {
    href: "/guides/shopgoodwill-ebay-arbitrage",
    title: "ShopGoodwill to eBay arbitrage",
    description:
      "How to use eBay sold comps, fees, and shipping to set max bids on ShopGoodwill auctions without overpaying.",
    keywords: "shopgoodwill ebay arbitrage, goodwill auction flipping",
    priority: 0.85,
  },
  {
    href: "/guides/shopgoodwill-auto-bid",
    title: "ShopGoodwill auto bid & scheduled sniping",
    description:
      "How automatic last-second bidding works on ShopGoodwill, what can miss, and how hosted snipers compare to manual bidding.",
    keywords: "shopgoodwill auto bid, automatic bidding, scheduled snipe",
    priority: 0.85,
  },
  {
    href: "/guides/best-shopgoodwill-sniper",
    title: "Best ShopGoodwill sniper: what to look for",
    description:
      "A buyer’s guide to ShopGoodwill snipers — timing, comps, pricing models, hosted vs desktop, and when BuzzerBidder fits.",
    keywords: "best shopgoodwill sniper, shopgoodwill auction sniper",
    priority: 0.85,
  },
];

export const COMPARE_PAGES: GuideMeta[] = [
  {
    href: "/compare/buzzerbidder-vs-per-snipe-tools",
    title: "BuzzerBidder vs per-snipe sniper tools",
    description:
      "Pay 2% only when you win (or $10/mo Pro) versus charging a flat fee every time a bid fires — including losses.",
    keywords: "shopgoodwill sniper pricing, per snipe fee",
    priority: 0.8,
  },
];

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function relatedGuides(currentHref: string, limit = 3): GuideMeta[] {
  return [...GUIDES, ...COMPARE_PAGES]
    .filter((g) => g.href !== currentHref)
    .slice(0, limit);
}
