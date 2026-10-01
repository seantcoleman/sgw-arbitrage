import Link from "next/link";
import type { Metadata } from "next";
import { FaqSection } from "@/components/FaqSection";
import { JsonLd } from "@/components/JsonLd";
import { RelatedGuides } from "@/components/RelatedGuides";
import { absoluteUrl } from "@/lib/guides";
import type { Faq } from "@/lib/seo";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "How ShopGoodwill Sniping Works",
  description:
    "How last-second ShopGoodwill bidding works, how to use eBay comps before you bid, and how a 2% win fee compares with paying per snipe.",
  alternates: { canonical: "/guides/shopgoodwill-sniping" },
  openGraph: {
    title: "How ShopGoodwill sniping works",
    description:
      "Last-second bids, eBay comps, and pay-when-you-win pricing for ShopGoodwill auctions.",
    url: absoluteUrl("/guides/shopgoodwill-sniping"),
  },
};

const FAQS: Faq[] = [
  {
    q: "Does sniping guarantee a win?",
    a: "No. A snipe only submits your max bid near the end. Someone else can still have a higher proxy max, and ShopGoodwill or network issues can cause a missed bid.",
  },
  {
    q: "Should I bid early on ShopGoodwill?",
    a: "Early bids can raise the visible price and attract other bidders. A last-second bid keeps your max hidden until the auction is almost over.",
  },
  {
    q: "How is BuzzerBidder priced versus a per-snipe tool?",
    a: "Some desktop snipers charge a flat amount for every snipe, win or lose. BuzzerBidder Standard charges 2% of the hammer only on confirmed wins. Pro is $10/month with no success fee.",
  },
  {
    q: "What is ShopGoodwill proxy bidding?",
    a: "You enter a max. ShopGoodwill bids on your behalf in increments only as needed to stay ahead, up to that max. Other bidders never see your full max until competition forces the price up.",
  },
  {
    q: "Can a scheduled snipe miss?",
    a: "Yes. Misses can happen if ShopGoodwill is slow, login fails, the network drops, or the current minimum is already above your max (we skip instead of overpaying).",
  },
];

const howToLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to snipe a ShopGoodwill auction with BuzzerBidder",
  description:
    "Connect your ShopGoodwill account, check eBay comps, set a max bid, and schedule a last-second snipe.",
  step: [
    {
      "@type": "HowToStep",
      name: "Create a BuzzerBidder account",
      text: "Sign up and save a payment method on Standard, or start a Pro subscription.",
    },
    {
      "@type": "HowToStep",
      name: "Connect ShopGoodwill",
      text: "Link your own ShopGoodwill login. Credentials are encrypted at rest with AES-256-GCM.",
    },
    {
      "@type": "HowToStep",
      name: "Add an auction and check eBay comps",
      text: "Paste a ShopGoodwill URL or sync Favorites, then review recent eBay sales net of fees and shipping.",
    },
    {
      "@type": "HowToStep",
      name: "Set a max bid and queue the snipe",
      text: "Choose a max under your net resale estimate. BuzzerBidder schedules the bid for the final seconds.",
    },
  ],
};

const articleLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "How ShopGoodwill sniping works",
  description:
    "How last-second ShopGoodwill bidding works, eBay comps, and pay-when-you-win pricing.",
  author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  mainEntityOfPage: absoluteUrl("/guides/shopgoodwill-sniping"),
  datePublished: "2026-09-30",
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
      name: "ShopGoodwill sniping",
      item: absoluteUrl("/guides/shopgoodwill-sniping"),
    },
  ],
};

export default function SnipingGuidePage() {
  return (
    <article className="max-w-3xl mx-auto">
      <JsonLd data={howToLd} />
      <JsonLd data={articleLd} />
      <JsonLd data={breadcrumbLd} />

      <p className="text-xs font-medium uppercase tracking-wider text-emerald-400">
        <Link href="/guides" className="hover:underline">
          Guides
        </Link>
        {" / Sniping"}
      </p>
      <h1 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight text-zinc-100">
        How ShopGoodwill sniping works
      </h1>
      <p className="mt-4 text-base text-zinc-400">
        ShopGoodwill sniping means submitting your max bid in the final seconds of an auction —
        not hours early. A{" "}
        <strong className="font-medium text-zinc-300">ShopGoodwill sniper</strong> schedules that
        last-second bid so you are not advertising a high max while the listing is still open.
        BuzzerBidder is a hosted sniper: the queue lives on our workers, you bid with your own
        ShopGoodwill account, and you can check eBay comps before you commit.
      </p>

      <h2 className="mt-10 text-xl font-bold text-zinc-100">
        Proxy bidding on ShopGoodwill, explained
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        ShopGoodwill uses proxy bidding. You enter a maximum. The site advances the visible price
        in increments only as far as needed to keep you ahead of other bidders, up to your max.
        Other people do not see your full ceiling unless competition forces the price there.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        That design is why early high bids hurt. If you manually bid a large max early, you can
        lift the hammer and draw attention. A last-second bid keeps your intention quiet until
        there is little time left for others to respond.
      </p>

      <h2 className="mt-10 text-xl font-bold text-zinc-100">Why early bids raise prices</h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        Resellers watch activity. A climbing bid history, or a sudden jump, signals that someone
        thinks the lot is worth more. Sniping does not remove competition that already has a
        higher proxy max, but it reduces the chance that <em>you</em> create that signal.
      </p>

      <h2 className="mt-10 text-xl font-bold text-zinc-100">What a last-second bid does</h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        You pick an item and a max you will pay. BuzzerBidder stores that as a scheduled job. A
        worker places the bid a few seconds before close, using the ShopGoodwill account you
        connected. If the current minimum is already above your max, the bid is skipped instead of
        overpaying.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        That does not lock in a win. Another bidder can have a higher max, and a ShopGoodwill
        outage or network failure can still cause a miss. Be honest with yourself about those
        limits — tools that promise “never miss” are selling you a story.
      </p>

      <h2 className="mt-10 text-xl font-bold text-zinc-100">
        Using eBay sold comps (fees and shipping)
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        A low ShopGoodwill hammer is only a deal if you can resell it. When you queue an auction —
        from a pasted URL or from Favorites — BuzzerBidder compares the listing to recent eBay
        sales and subtracts an assumed eBay fee and outbound shipping cost. Use that{" "}
        <Link href="/guides/shopgoodwill-ebay-arbitrage" className="text-emerald-400 hover:underline">
          net arbitrage number
        </Link>
        , not the raw eBay median, when you set a max bid.
      </p>

      <h2 className="mt-10 text-xl font-bold text-zinc-100">Max bid math / ROI checklist</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-400">
        <li>Median or recent sold comps that match condition and model</li>
        <li>eBay fees (or your channel’s fees) on the expected sale</li>
        <li>Outbound shipping and packaging</li>
        <li>ShopGoodwill buyer premium / shipping / tax on the win</li>
        <li>Your time and return risk</li>
        <li>BuzzerBidder Standard 2% on the hammer (or Pro at $10/mo with 0% fee)</li>
      </ul>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        Max bid ≈ expected net resale − costs − margin you actually want. If the math is thin,
        skip the lot. Sniping does not fix a bad purchase.
      </p>

      <h2 className="mt-10 text-xl font-bold text-zinc-100">
        Manual vs hosted sniper vs desktop
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        <strong className="font-medium text-zinc-300">Manual:</strong> you watch the clock and click.
        Fine for one auction; brittle when you have many ending at once.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        <strong className="font-medium text-zinc-300">Desktop sniper:</strong> software on your
        machine fires near close. Often priced per bid attempt. Your PC must be online.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        <strong className="font-medium text-zinc-300">Hosted sniper (BuzzerBidder):</strong> the
        queue lives on a server with durable jobs and leases, so a laptop sleep does not wipe your
        schedule. You still need a valid ShopGoodwill session and realistic expectations about
        misses.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        For more on{" "}
        <Link href="/guides/shopgoodwill-auto-bid" className="text-emerald-400 hover:underline">
          auto bid / scheduled sniping
        </Link>
        , see the dedicated guide. For pricing models, see{" "}
        <Link
          href="/compare/buzzerbidder-vs-per-snipe-tools"
          className="text-emerald-400 hover:underline"
        >
          BuzzerBidder vs per-snipe tools
        </Link>
        .
      </p>

      <h2 className="mt-10 text-xl font-bold text-zinc-100">Pay when you win, not per click</h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        Some sniper tools charge a fixed fee every time they fire a bid, including losses.{" "}
        <Link href="/pricing" className="text-emerald-400 hover:underline">
          BuzzerBidder Standard
        </Link>{" "}
        charges 2% of the hammer on confirmed wins and nothing when you lose. Fees can batch until
        they reach Stripe&apos;s minimum charge. Pro is $10 per month with a 0% success fee while
        the subscription is active. ShopGoodwill still invoices you separately for the item,
        shipping, and tax.
      </p>

      <h2 className="mt-10 text-xl font-bold text-zinc-100">Safety and trust</h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        You bid with <em>your</em> ShopGoodwill account. Credentials are encrypted at rest
        (AES-256-GCM); the decryption key stays on the bidding server and is used to place bids you
        schedule and to check outcomes. BuzzerBidder is not affiliated with ShopGoodwill or
        Goodwill Industries.
      </p>

      <h2 className="mt-10 text-xl font-bold text-zinc-100">What you need to start</h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-zinc-400">
        <li>A BuzzerBidder account and a card on file, or an active Pro plan.</li>
        <li>Your own ShopGoodwill login, stored encrypted at rest.</li>
        <li>An auction URL or a Favorites sync, plus a max bid under the eBay net.</li>
        <li>A clear margin after fees, shipping, and the 2% success fee (unless on Pro).</li>
      </ol>
      <p className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/signup"
          className="inline-block rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          Get started
        </Link>
        <Link
          href="/pricing"
          className="inline-block rounded-xl border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-200 hover:border-zinc-500"
        >
          See pricing
        </Link>
      </p>

      <FaqSection faqs={FAQS} />
      <RelatedGuides currentHref="/guides/shopgoodwill-sniping" />
    </article>
  );
}
