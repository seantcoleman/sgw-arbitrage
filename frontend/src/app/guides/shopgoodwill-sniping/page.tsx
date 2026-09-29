import Link from "next/link";
import type { Metadata } from "next";
import { FaqSection } from "@/components/FaqSection";
import type { Faq } from "@/lib/seo";

export const metadata: Metadata = {
  title: "How ShopGoodwill Sniping Works",
  description:
    "How last-second ShopGoodwill bidding works, how to use eBay comps before you bid, and how a 2% win fee compares with paying per snipe.",
  alternates: { canonical: "/guides/shopgoodwill-sniping" },
  openGraph: {
    title: "How ShopGoodwill sniping works",
    description:
      "Last-second bids, eBay comps, and pay-when-you-win pricing for ShopGoodwill auctions.",
    url: "https://buzzerbidder.com/guides/shopgoodwill-sniping",
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
    a: "Some desktop snipers charge a flat amount for every snipe, win or lose. BuzzerBidder Standard charges 2% of the hammer only on confirmed wins. Pro is $15/month with no success fee.",
  },
];

export default function SnipingGuidePage() {
  return (
    <article className="max-w-3xl mx-auto">
      <p className="text-xs font-medium uppercase tracking-wider text-emerald-400">Guide</p>
      <h1 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight text-zinc-100">
        How ShopGoodwill sniping works
      </h1>
      <p className="mt-4 text-base text-zinc-400">
        ShopGoodwill auctions use proxy bidding: the site bids up to each person&apos;s max, one
        increment at a time. A sniper waits until the last seconds, then submits your max so you
        are not advertising a high bid while the auction is still open.
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
        outage can still cause a miss. The point is to avoid bidding early and lifting the price
        yourself.
      </p>

      <h2 className="mt-10 text-xl font-bold text-zinc-100">Check eBay before you snipe</h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        A low ShopGoodwill bid is only a deal if you can resell it. When you queue an auction —
        from a pasted URL or from Favorites — BuzzerBidder compares the listing to recent eBay
        sales and subtracts an assumed eBay fee and outbound shipping cost. Use that net number,
        not the raw eBay median, when you set a max bid.
      </p>

      <h2 className="mt-10 text-xl font-bold text-zinc-100">Pay when you win, not per click</h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        Some sniper tools charge a fixed fee every time they fire a bid, including losses.{" "}
        <Link href="/pricing" className="text-emerald-400 hover:underline">
          BuzzerBidder Standard
        </Link>{" "}
        charges 2% of the hammer on confirmed wins and nothing when you lose. Fees can batch until
        they reach Stripe&apos;s minimum charge. Pro is $15 per month with a 0% success fee while
        the subscription is active. ShopGoodwill still invoices you separately for the item,
        shipping, and tax.
      </p>

      <h2 className="mt-10 text-xl font-bold text-zinc-100">What you need to start</h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-zinc-400">
        <li>A BuzzerBidder account and a card on file, or an active Pro plan.</li>
        <li>Your own ShopGoodwill login, stored encrypted at rest.</li>
        <li>An auction URL or a Favorites sync, plus a max bid under the eBay net.</li>
      </ol>
      <p className="mt-6">
        <Link
          href="/signup"
          className="inline-block rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          Get started
        </Link>
      </p>

      <FaqSection faqs={FAQS} />
    </article>
  );
}
