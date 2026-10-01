import Link from "next/link";
import type { Metadata } from "next";
import { COMPARE_PAGES, GUIDES } from "@/lib/guides";

export const metadata: Metadata = {
  title: "Guides",
  description:
    "Guides on ShopGoodwill sniping, auto bidding, eBay arbitrage, and how to choose a sniper — plus pricing comparisons.",
  alternates: { canonical: "/guides" },
  openGraph: {
    title: "ShopGoodwill sniping guides",
    description:
      "Practical guides on last-second bids, eBay comps, auto bidding, and sniper pricing.",
    url: "https://buzzerbidder.com/guides",
  },
};

export default function GuidesPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <p className="text-xs font-medium uppercase tracking-wider text-emerald-400">Guides</p>
      <h1 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight text-zinc-100">
        ShopGoodwill sniping guides
      </h1>
      <p className="mt-4 text-sm sm:text-base text-zinc-400 max-w-2xl">
        Practical notes on bidding ShopGoodwill auctions in the final seconds, pricing flips
        against eBay sold comps, and choosing between pay-when-you-win and per-snipe tools.
        BuzzerBidder is an independent ShopGoodwill sniper — not affiliated with ShopGoodwill.
      </p>

      <ul className="mt-10 space-y-4">
        {GUIDES.map((guide) => (
          <li key={guide.href}>
            <Link
              href={guide.href}
              className="block rounded-2xl border border-zinc-800 bg-zinc-900 p-6 hover:border-zinc-700"
            >
              <h2 className="font-semibold text-zinc-100">{guide.title}</h2>
              <p className="mt-2 text-sm text-zinc-500">{guide.description}</p>
            </Link>
          </li>
        ))}
      </ul>

      <h2 className="mt-14 text-xl font-bold text-zinc-100">Comparisons</h2>
      <p className="mt-2 text-sm text-zinc-500">
        Honest pricing and feature tradeoffs — not hit pieces.
      </p>
      <ul className="mt-6 space-y-4">
        {COMPARE_PAGES.map((page) => (
          <li key={page.href}>
            <Link
              href={page.href}
              className="block rounded-2xl border border-zinc-800 bg-zinc-900 p-6 hover:border-zinc-700"
            >
              <h3 className="font-semibold text-zinc-100">{page.title}</h3>
              <p className="mt-2 text-sm text-zinc-500">{page.description}</p>
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-10 text-sm text-zinc-500">
        Ready to queue a snipe?{" "}
        <Link href="/pricing" className="text-emerald-400 hover:underline">
          See pricing
        </Link>{" "}
        or{" "}
        <Link href="/signup" className="text-emerald-400 hover:underline">
          get started
        </Link>
        .
      </p>
    </div>
  );
}
