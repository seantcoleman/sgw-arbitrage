import Link from "next/link";
import type { Metadata } from "next";
import { FaqSection } from "@/components/FaqSection";
import { JsonLd } from "@/components/JsonLd";
import { RelatedGuides } from "@/components/RelatedGuides";
import { absoluteUrl } from "@/lib/guides";
import type { Faq } from "@/lib/seo";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "ShopGoodwill to eBay Arbitrage",
  description:
    "How to use eBay sold comps, fees, and shipping to set max bids on ShopGoodwill auctions without overpaying.",
  alternates: { canonical: "/guides/shopgoodwill-ebay-arbitrage" },
  openGraph: {
    title: "ShopGoodwill to eBay arbitrage",
    description:
      "Price ShopGoodwill lots against eBay sold comps before you snipe — fees, shipping, and max-bid math.",
    url: absoluteUrl("/guides/shopgoodwill-ebay-arbitrage"),
  },
};

const FAQS: Faq[] = [
  {
    q: "What is ShopGoodwill to eBay arbitrage?",
    a: "Buying underpriced lots on ShopGoodwill and reselling them on eBay (or another channel) after fees, shipping, and your time. The edge is information: sold comps before you bid.",
  },
  {
    q: "Should I use asking prices or sold comps?",
    a: "Sold comps. Asking prices are wishful. Recent completed sales are closer to what cash actually clears.",
  },
  {
    q: "Does BuzzerBidder guarantee profit?",
    a: "No. Comps are estimates. Condition, returns, and shipping can erase a paper margin. Always leave room.",
  },
];

const articleLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "ShopGoodwill to eBay arbitrage",
  description:
    "How to use eBay sold comps, fees, and shipping to set max bids on ShopGoodwill auctions.",
  author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  mainEntityOfPage: absoluteUrl("/guides/shopgoodwill-ebay-arbitrage"),
  datePublished: "2026-10-01",
  dateModified: "2026-10-01",
};

const breadcrumbLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Guides", item: absoluteUrl("/guides") },
    {
      "@type": "ListItem",
      position: 3,
      name: "eBay arbitrage",
      item: absoluteUrl("/guides/shopgoodwill-ebay-arbitrage"),
    },
  ],
};

export default function ArbitrageGuidePage() {
  return (
    <article className="max-w-3xl mx-auto">
      <JsonLd data={articleLd} />
      <JsonLd data={breadcrumbLd} />

      <p className="text-xs font-medium uppercase tracking-wider text-emerald-400">
        <Link href="/guides" className="hover:underline">
          Guides
        </Link>
        {" / Arbitrage"}
      </p>
      <h1 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight text-zinc-100">
        ShopGoodwill to eBay arbitrage
      </h1>
      <p className="mt-4 text-base text-zinc-400">
        Goodwill auction flipping only works when the hammer plus fees still leaves room after
        resale costs. This guide is the practical side of{" "}
        <strong className="font-medium text-zinc-300">ShopGoodwill eBay arbitrage</strong>: how to
        read sold comps, what BuzzerBidder shows you, and how to set a max bid before you{" "}
        <Link href="/guides/shopgoodwill-sniping" className="text-emerald-400 hover:underline">
          snipe
        </Link>
        .
      </p>

      <h2 className="mt-10 text-xl font-bold text-zinc-100">Start from sold comps, not hope</h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        Match brand, model, condition, and accessories. Ignore outliers (bulk lots, damaged “as
        is” that do not match your listing). Prefer recent sales over year-old peaks. If comps are
        sparse, treat the deal as higher risk — or skip it.
      </p>

      <h2 className="mt-10 text-xl font-bold text-zinc-100">What “net” really means</h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        When you queue a ShopGoodwill auction in BuzzerBidder — from a URL or Favorites — we
        compare the listing to recent eBay sales and subtract an assumed eBay fee and outbound
        shipping. That net is closer to cash-in-pocket than a raw median.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        Still subtract ShopGoodwill shipping, tax, and any buyer costs on the win. Then subtract{" "}
        <Link href="/pricing" className="text-emerald-400 hover:underline">
          BuzzerBidder&apos;s 2% success fee
        </Link>{" "}
        on Standard (or use Pro at $10/mo if you snipe enough that 0% fee is cheaper).
      </p>

      <h2 className="mt-10 text-xl font-bold text-zinc-100">A simple max-bid formula</h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-zinc-400">
        <li>Expected eBay sold price (conservative)</li>
        <li>Minus eBay fees</li>
        <li>Minus outbound shipping / packaging</li>
        <li>Minus ShopGoodwill shipping + tax estimate</li>
        <li>Minus success fee (2% of hammer) or Pro allocation</li>
        <li>Minus the profit margin you actually want</li>
      </ol>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        That remainder is your max snipe. If it is below the current bid, walk away. Winning a
        bad lot is worse than missing a good one.
      </p>

      <h2 className="mt-10 text-xl font-bold text-zinc-100">Where Favorites help</h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        Star items on ShopGoodwill, sync Favorites in BuzzerBidder, run the eBay price check, then
        queue only the lots that clear your formula. That loop is the product wedge: comps next to
        the snipe, not in a separate spreadsheet you forget at 11:58pm.
      </p>

      <h2 className="mt-10 text-xl font-bold text-zinc-100">Common mistakes</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-400">
        <li>Using “Buy It Now” asking prices as if they were solds</li>
        <li>Ignoring weight / freight on bulky wins</li>
        <li>Forgetting returns and dead stock</li>
        <li>Bidding early and bidding up your own exit</li>
        <li>Treating sniping as a substitute for sourcing discipline</li>
      </ul>

      <p className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/signup"
          className="inline-block rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          Get started
        </Link>
        <Link
          href="/guides/best-shopgoodwill-sniper"
          className="inline-block rounded-xl border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-200 hover:border-zinc-500"
        >
          Buyer&apos;s guide
        </Link>
      </p>

      <FaqSection faqs={FAQS} />
      <RelatedGuides currentHref="/guides/shopgoodwill-ebay-arbitrage" />
    </article>
  );
}
