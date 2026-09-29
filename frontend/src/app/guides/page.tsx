import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Guides",
  description:
    "Guides on ShopGoodwill sniping, last-second bids, and comparing Goodwill auctions to eBay comps.",
  alternates: { canonical: "/guides" },
};

const GUIDES = [
  {
    href: "/guides/shopgoodwill-sniping",
    title: "How ShopGoodwill sniping works",
    body: "What a last-second bid does, how eBay comps fit in, and how pay-when-you-win pricing compares with per-snipe tools.",
  },
];

export default function GuidesPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <p className="text-xs font-medium uppercase tracking-wider text-emerald-400">Guides</p>
      <h1 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight text-zinc-100">
        ShopGoodwill sniping guides
      </h1>
      <p className="mt-4 text-sm sm:text-base text-zinc-400 max-w-2xl">
        Practical notes on bidding ShopGoodwill auctions in the final seconds and pricing flips
        against eBay.
      </p>
      <ul className="mt-10 space-y-4">
        {GUIDES.map((guide) => (
          <li key={guide.href}>
            <Link
              href={guide.href}
              className="block rounded-2xl border border-zinc-800 bg-zinc-900 p-6 hover:border-zinc-700"
            >
              <h2 className="font-semibold text-zinc-100">{guide.title}</h2>
              <p className="mt-2 text-sm text-zinc-500">{guide.body}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
