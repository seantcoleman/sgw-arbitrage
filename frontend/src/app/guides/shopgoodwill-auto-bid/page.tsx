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
import { PRO_MONTHLY_USD, STANDARD_FEE_LABEL } from "@/lib/seo";

const meta = getContentMeta("/guides/shopgoodwill-auto-bid")!;

export const metadata: Metadata = {
  title: "ShopGoodwill Auto Bid & Scheduled Sniping",
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
    q: "What is ShopGoodwill auto bid?",
    a: "Auto bid (sniping) means software places your max bid in the final seconds instead of you watching the clock. Hosted tools keep the schedule on a server so your laptop does not need to stay awake.",
  },
  {
    q: "Is auto bidding allowed?",
    a: "You are still bidding with your own ShopGoodwill account under their rules. BuzzerBidder is an independent tool and is not affiliated with ShopGoodwill. Follow ShopGoodwill’s terms and local laws.",
  },
  {
    q: "Will every auto bid go through?",
    a: "No. Login issues, site slowness, network failures, or a minimum already above your max can cause a skip or miss. Plan for that.",
  },
];

const howToLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to set up ShopGoodwill auto bidding with BuzzerBidder",
  description: "Schedule a last-second ShopGoodwill bid from a hosted snipe queue.",
  step: [
    {
      "@type": "HowToStep",
      name: "Connect credentials",
      text: "Save your ShopGoodwill login in BuzzerBidder (encrypted at rest).",
    },
    {
      "@type": "HowToStep",
      name: "Queue the auction",
      text: "Paste a URL or pull from Favorites and review eBay comps.",
    },
    {
      "@type": "HowToStep",
      name: "Set max and schedule",
      text: "Enter your max bid. Workers place it in the final seconds before close.",
    },
  ],
};

const TOC = [
  { id: "manual-vs-auto", label: "Manual vs auto bid" },
  { id: "how-scheduled", label: "How BuzzerBidder schedules bids" },
  { id: "what-goes-wrong", label: "What can still go wrong" },
  { id: "pricing", label: "Pricing for automatic bidding" },
];

export default function AutoBidGuidePage() {
  return (
    <article className="max-w-3xl mx-auto">
      <JsonLd data={howToLd} />
      <JsonLd data={articleJsonLd(meta)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", href: "/" },
          { name: "Guides", href: "/guides" },
          { name: "Auto bid", href: meta.href },
        ])}
      />

      <ArticleHeader meta={meta} sectionLabel="Auto bid" title="ShopGoodwill auto bid & scheduled sniping">
        <p>
          <strong className="font-medium text-zinc-300">ShopGoodwill auto bid</strong> is scheduled
          last-second bidding: you set a max once, and software fires near close. That is the core
          of{" "}
          <Link href="/guides/shopgoodwill-sniping" className="text-emerald-400 hover:underline">
            sniping
          </Link>{" "}
          — automatic instead of manual clicking.
        </p>
      </ArticleHeader>

      <KeyTakeaways
        items={[
          "Auto bid queues last-second maxes so you are not watching ten clocks at once.",
          "Hosted queues survive laptop sleep; they do not guarantee every fire succeeds.",
          "Skip when the live minimum is already above your max — that is correct behavior.",
          `Standard: ${STANDARD_FEE_LABEL} on wins only. Pro: $${PRO_MONTHLY_USD}/mo, 0% success fee.`,
        ]}
      />
      <GuideToc items={TOC} />

      <h2 id="manual-vs-auto" className="mt-10 scroll-mt-24 text-xl font-bold text-zinc-100">
        Manual bidding vs auto bid
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        Manual works when you have one ending and a free evening. It falls apart when ten lots end
        in the same minute, or when you are asleep. Auto bid queues those bids ahead of time.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        Auto bid is not “set and forget forever.” You still choose what to buy, set maxes from
        comps, and accept that some fires will miss.
      </p>

      <h2 id="how-scheduled" className="mt-10 scroll-mt-24 text-xl font-bold text-zinc-100">
        How BuzzerBidder schedules bids
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        Each snipe is a durable job in the database with leases. Workers pre-warm a ShopGoodwill
        session and submit your max a few seconds before close. If the minimum is already above
        your max, we skip rather than overbid.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        Because the queue is hosted, closing your laptop does not cancel the schedule the way a
        desktop-only tool can when the machine sleeps.
      </p>

      <h2 id="what-goes-wrong" className="mt-10 scroll-mt-24 text-xl font-bold text-zinc-100">
        What can still go wrong
      </h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-400">
        <li>ShopGoodwill latency or maintenance near close</li>
        <li>Credential / session problems</li>
        <li>Network failures between our workers and ShopGoodwill</li>
        <li>Another bidder with a higher proxy max</li>
        <li>Your max already below the live minimum (intentional skip)</li>
      </ul>

      <h2 id="pricing" className="mt-10 scroll-mt-24 text-xl font-bold text-zinc-100">
        Pricing for automatic bidding
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        Standard: no monthly fee;{" "}
        <Link href="/pricing" className="text-emerald-400 hover:underline">
          {STANDARD_FEE_LABEL} of the hammer on confirmed wins
        </Link>
        . Lose → no success fee. Pro: ${PRO_MONTHLY_USD}/month, 0% success fee while active.
      </p>

      <p className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/signup"
          className="inline-block rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          Set up auto bidding
        </Link>
        <Link
          href="/guides/shopgoodwill-ebay-arbitrage"
          className="inline-block rounded-xl border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-200 hover:border-zinc-500"
        >
          Check comps first
        </Link>
      </p>

      <EditorialDisclosure />
      <FaqSection faqs={FAQS} />
      <RelatedGuides currentHref={meta.href} />
    </article>
  );
}
