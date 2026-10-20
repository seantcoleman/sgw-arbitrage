import Link from "next/link";
import type { Metadata } from "next";
import { ArticleHeader } from "@/components/ArticleHeader";
import { EditorialDisclosure } from "@/components/EditorialDisclosure";
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

const meta = getContentMeta("/guides/shopgoodwill-bidding-strategy")!;

export const metadata: Metadata = {
  title: "ShopGoodwill Bidding Strategy & Tips",
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
    q: "Should I bid early on ShopGoodwill?",
    a: "Usually no if you care about keeping the visible price down. Early bids can attract competition. Sniping places your max near the end instead.",
  },
  {
    q: "How do I pick a max bid?",
    a: "Start from recent eBay sold comps, subtract marketplace fees and shipping both ways, then leave profit margin. Use our free max bid calculator, then queue in BuzzerBidder with live comps.",
  },
  {
    q: "When should I skip an auction?",
    a: "Thin or messy comps, damaged-item risk you cannot price, shipping that kills margin, or a current bid already above your max after fees.",
  },
];

const TOC = [
  { id: "price-exit", label: "Price the exit before the bid" },
  { id: "last-second", label: "Prefer last-second over early bids" },
  { id: "written-max", label: "Cap emotion with a written max" },
  { id: "when-not", label: "When not to snipe" },
  { id: "track", label: "Track outcomes, not just wins" },
];

export default function BiddingStrategyGuidePage() {
  return (
    <article className="max-w-3xl mx-auto">
      <JsonLd data={articleJsonLd(meta)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", href: "/" },
          { name: "Guides", href: "/guides" },
          { name: "Bidding strategy", href: meta.href },
        ])}
      />

      <ArticleHeader meta={meta} sectionLabel="Bidding strategy" title="ShopGoodwill bidding strategy & tips">
        <p>
          Winning more auctions is not the goal —{" "}
          <strong className="font-medium text-zinc-300">
            winning lots that still profit after fees and shipping
          </strong>{" "}
          is. These ShopGoodwill bidding tips assume you may resell (often on eBay) and that you use
          last-second{" "}
          <Link href="/guides/shopgoodwill-sniping" className="text-emerald-400 hover:underline">
            sniping
          </Link>{" "}
          instead of early proxy wars.
        </p>
      </ArticleHeader>

      <KeyTakeaways
        items={[
          "Decide max from net comps, not auction adrenaline.",
          "Last-second bids reduce the signal early high bids create.",
          "Write the max before the final minute — then honor it.",
          "Skip thin comps, freight killers, and lots you cannot price from photos.",
          "Track full P&L; win rate alone is a vanity metric.",
        ]}
      />
      <GuideToc items={TOC} />

      <h2 id="price-exit" className="mt-10 scroll-mt-24 text-xl font-bold text-zinc-100">
        1. Price the exit before the bid
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        Pull recent sold comps for the same model/condition. Net out marketplace fees and shipping
        to the buyer (and from ShopGoodwill to you). Only then set a max. Our{" "}
        <Link href="/tools/max-bid-calculator" className="text-emerald-400 hover:underline">
          max bid calculator
        </Link>{" "}
        and{" "}
        <Link
          href="/guides/shopgoodwill-ebay-arbitrage"
          className="text-emerald-400 hover:underline"
        >
          arbitrage guide
        </Link>{" "}
        walk through the math. BuzzerBidder also surfaces comps when you queue.
      </p>

      <h2 id="last-second" className="mt-10 scroll-mt-24 text-xl font-bold text-zinc-100">
        2. Prefer last-second over early bids
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        Early bids raise the visible price and invite snipers. Scheduling a max near close keeps
        your interest quieter. Hosted{" "}
        <Link href="/guides/shopgoodwill-auto-bid" className="text-emerald-400 hover:underline">
          auto bid
        </Link>{" "}
        tools do that while you sleep — with the caveat that misses still happen.
      </p>

      <h2 id="written-max" className="mt-10 scroll-mt-24 text-xl font-bold text-zinc-100">
        3. Cap emotion with a written max
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        Decide the number before the final minute. If the auction is already above your max after
        fees, skip. “I almost had it” is how margins die.
      </p>

      <h2 id="when-not" className="mt-10 scroll-mt-24 text-xl font-bold text-zinc-100">
        4. When not to snipe
      </h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-400">
        <li>Comps are old, mixed condition, or too few to trust</li>
        <li>Photos hide damage you cannot price</li>
        <li>Shipping from a distant seller destroys the spread</li>
        <li>You would need a heroic sell-through speed to free cash</li>
      </ul>

      <h2 id="track" className="mt-10 scroll-mt-24 text-xl font-bold text-zinc-100">
        5. Track outcomes, not just wins
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        Log hammer, shipping in, sell price, fees, and days to sell. A 60% win rate with thin
        margins can lose to a 20% win rate with fat spreads. Adjust maxes from that data, not from
        auction adrenaline.
      </p>

      <p className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/tools/max-bid-calculator"
          className="inline-block rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          Open max bid calculator
        </Link>
        <Link
          href="/signup"
          className="inline-block rounded-xl border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-200 hover:border-zinc-500"
        >
          Queue snipes with comps
        </Link>
      </p>

      <EditorialDisclosure />
      <FaqSection faqs={FAQS} />
      <RelatedGuides currentHref={meta.href} />
    </article>
  );
}
