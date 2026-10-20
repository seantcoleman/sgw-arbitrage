import Link from "next/link";
import type { Metadata } from "next";
import { ArticleHeader } from "@/components/ArticleHeader";
import { FaqSection } from "@/components/FaqSection";
import { GuideToc } from "@/components/GuideToc";
import { JsonLd } from "@/components/JsonLd";
import { KeyTakeaways } from "@/components/KeyTakeaways";
import { RelatedGuides } from "@/components/RelatedGuides";
import {
  absoluteUrl,
  articleJsonLd,
  breadcrumbJsonLd,
  getContentMeta,
} from "@/lib/guides";
import type { Faq } from "@/lib/seo";
import { PRO_MONTHLY_USD, STANDARD_FEE_LABEL } from "@/lib/seo";

const meta = getContentMeta("/guides/shopgoodwill-ebay-arbitrage")!;

export const metadata: Metadata = {
  title: "ShopGoodwill to eBay Arbitrage",
  description: meta.description,
  alternates: { canonical: meta.href },
  openGraph: {
    title: meta.title,
    description: meta.description,
    url: absoluteUrl(meta.href),
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

const TOC = [
  { id: "sold-comps", label: "Start from sold comps" },
  { id: "net", label: "What net really means" },
  { id: "formula", label: "Max-bid formula" },
  { id: "favorites", label: "Where Favorites help" },
  { id: "mistakes", label: "Common mistakes" },
];

export default function ArbitrageGuidePage() {
  return (
    <article className="max-w-3xl mx-auto">
      <JsonLd data={articleJsonLd(meta)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", href: "/" },
          { name: "Guides", href: "/guides" },
          { name: "eBay arbitrage", href: meta.href },
        ])}
      />

      <ArticleHeader meta={meta} sectionLabel="Arbitrage">
        <p>
          Goodwill auction flipping only works when the hammer plus fees still leaves room after
          resale costs. This guide is the practical side of{" "}
          <strong className="font-medium text-zinc-300">ShopGoodwill eBay arbitrage</strong>: how to
          read sold comps, what BuzzerBidder shows you, and how to set a max bid before you{" "}
          <Link href="/guides/shopgoodwill-sniping" className="text-emerald-400 hover:underline">
            snipe
          </Link>
          .
        </p>
      </ArticleHeader>

      <KeyTakeaways
        items={[
          "Use recent sold comps that match condition — not Buy It Now asks.",
          "Net = sale − marketplace fees − outbound ship − SGW costs − tool fee − your margin.",
          "Queue comps next to the snipe (URL or Favorites) so you do not guess at 11:58pm.",
          "Thin or messy comps → skip; sniping does not fix bad sourcing.",
        ]}
      />
      <GuideToc items={TOC} />

      <h2 id="sold-comps" className="mt-10 scroll-mt-24 text-xl font-bold text-zinc-100">
        Start from sold comps, not hope
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        Match brand, model, condition, and accessories. Ignore outliers (bulk lots, damaged “as
        is” that do not match your listing). Prefer recent sales over year-old peaks. If comps are
        sparse, treat the deal as higher risk — or skip it.
      </p>

      <h2 id="net" className="mt-10 scroll-mt-24 text-xl font-bold text-zinc-100">
        What “net” really means
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        When you queue a ShopGoodwill auction in BuzzerBidder — from a URL or Favorites — we
        compare the listing to recent eBay sales and subtract an assumed eBay fee and outbound
        shipping. That net is closer to cash-in-pocket than a raw median.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        Still subtract ShopGoodwill shipping, tax, and any buyer costs on the win. Then subtract{" "}
        <Link href="/pricing" className="text-emerald-400 hover:underline">
          BuzzerBidder&apos;s {STANDARD_FEE_LABEL} success fee
        </Link>{" "}
        on Standard (or use Pro at ${PRO_MONTHLY_USD}/mo if you snipe enough that 0% fee is cheaper).
      </p>

      <h2 id="formula" className="mt-10 scroll-mt-24 text-xl font-bold text-zinc-100">
        A simple max-bid formula
      </h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-zinc-400">
        <li>Expected eBay sold price (conservative)</li>
        <li>Minus eBay fees</li>
        <li>Minus outbound shipping / packaging</li>
        <li>Minus ShopGoodwill shipping + tax estimate</li>
        <li>Minus success fee ({STANDARD_FEE_LABEL} of hammer) or Pro allocation</li>
        <li>Minus the profit margin you actually want</li>
      </ol>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        That remainder is your max snipe. If it is below the current bid, walk away. Try the{" "}
        <Link href="/tools/max-bid-calculator" className="text-emerald-400 hover:underline">
          free calculator
        </Link>{" "}
        for what-if math.
      </p>

      <h2 id="favorites" className="mt-10 scroll-mt-24 text-xl font-bold text-zinc-100">
        Where Favorites help
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        Star items on ShopGoodwill, sync Favorites in BuzzerBidder, run the eBay price check, then
        queue only the lots that clear your formula. That loop is the product wedge: comps next to
        the snipe, not in a separate spreadsheet you forget at close.
      </p>

      <h2 id="mistakes" className="mt-10 scroll-mt-24 text-xl font-bold text-zinc-100">
        Common mistakes
      </h2>
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
          href="/tools/max-bid-calculator"
          className="inline-block rounded-xl border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-200 hover:border-zinc-500"
        >
          Max bid calculator
        </Link>
      </p>
      <FaqSection faqs={FAQS} />
      <RelatedGuides currentHref={meta.href} />
    </article>
  );
}
