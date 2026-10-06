import Link from "next/link";
import type { Metadata } from "next";
import {
  ALTERNATIVES_PAGES,
  COMPARE_PAGES,
  GUIDES,
  TOOL_PAGES,
} from "@/lib/guides";

export const metadata: Metadata = {
  title: "Guides",
  description:
    "Guides on ShopGoodwill sniping, auto bidding, eBay arbitrage, bidding strategy, sniper comparisons, and free max-bid tools.",
  alternates: { canonical: "/guides" },
  openGraph: {
    title: "ShopGoodwill sniping guides",
    description:
      "Practical guides on last-second bids, eBay comps, auto bidding, comparisons, and calculators.",
    url: "https://buzzerbidder.com/guides",
  },
};

function CardList({
  items,
  heading: Heading = "h2",
}: {
  items: { href: string; title: string; description: string }[];
  heading?: "h2" | "h3";
}) {
  return (
    <ul className="mt-6 space-y-4">
      {items.map((item) => (
        <li key={item.href}>
          <Link
            href={item.href}
            className="block rounded-2xl border border-zinc-800 bg-zinc-900 p-6 hover:border-zinc-700"
          >
            <Heading className="font-semibold text-zinc-100">{item.title}</Heading>
            <p className="mt-2 text-sm text-zinc-500">{item.description}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function GuidesPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <p className="text-xs font-medium uppercase tracking-wider text-emerald-400">Guides</p>
      <h1 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight text-zinc-100">
        ShopGoodwill sniping guides
      </h1>
      <p className="mt-4 text-sm sm:text-base text-zinc-400 max-w-2xl">
        Practical notes on bidding ShopGoodwill auctions in the final seconds, pricing flips
        against eBay sold comps, and how pay-per-win vs monthly sniper pricing compares.
        BuzzerBidder is an independent ShopGoodwill sniper — not affiliated with ShopGoodwill.
      </p>

      <CardList items={GUIDES} />

      <h2 className="mt-14 text-xl font-bold text-zinc-100">Comparisons</h2>
      <p className="mt-2 text-sm text-zinc-500">
        Honest pricing and feature tradeoffs — not hit pieces.
      </p>
      <CardList items={COMPARE_PAGES} heading="h3" />

      <h2 className="mt-14 text-xl font-bold text-zinc-100">Alternatives</h2>
      <p className="mt-2 text-sm text-zinc-500">Criteria-led roundups of ShopGoodwill snipers.</p>
      <CardList items={ALTERNATIVES_PAGES} heading="h3" />

      <h2 className="mt-14 text-xl font-bold text-zinc-100">Free tools</h2>
      <p className="mt-2 text-sm text-zinc-500">
        Calculators you can use without an account — then queue snipes when ready.
      </p>
      <CardList items={TOOL_PAGES} heading="h3" />

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
