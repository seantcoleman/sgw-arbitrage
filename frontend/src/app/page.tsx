import Link from "next/link";
import type { Metadata } from "next";
import { FaqSection } from "@/components/FaqSection";
import { HOME_FAQS, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "ShopGoodwill Sniper — Last-Second Bids",
  description:
    "Queue ShopGoodwill auctions, compare them to eBay comps, and snipe in the final seconds. Pay 2% only when you win, or go Pro for $15/month.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "ShopGoodwill Sniper — Last-Second Bids",
    description:
      "Queue ShopGoodwill auctions, compare them to eBay comps, and snipe in the final seconds.",
    url: SITE_URL,
  },
};

const softwareLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "BuzzerBidder",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: SITE_URL,
  description:
    "ShopGoodwill sniper that compares auctions to eBay comps and places last-second bids.",
  offers: [
    {
      "@type": "Offer",
      name: "Standard",
      price: "0",
      priceCurrency: "USD",
      description: "2% success fee on confirmed wins. No monthly fee.",
    },
    {
      "@type": "Offer",
      name: "Pro",
      price: "15",
      priceCurrency: "USD",
      description: "$15 per month with 0% success fee.",
    },
  ],
};

const STEPS = [
  {
    title: "Connect ShopGoodwill",
    body: "Link your ShopGoodwill account once. Credentials are encrypted at rest (AES-256-GCM); the decryption key stays on our bidding server.",
  },
  {
    title: "Add auctions & check eBay",
    body: "Paste a ShopGoodwill item or pull from your Favorites. We compare it to recent eBay sales, net of fees and shipping, so you see estimated profit before you snipe.",
  },
  {
    title: "Snipe automatically",
    body: "Set your max bid and walk away. Our workers place the bid in the last seconds of the auction so you are not bidding early and driving the price up.",
  },
];

const FEATURES = [
  {
    title: "eBay comps on every snipe",
    body: "When you queue an auction, we price it against recent eBay sales with fees and shipping baked in.",
  },
  {
    title: "Last-second bidding",
    body: "Bids fire seconds before close from a pre-warmed session, reducing the chance of an early bidding war.",
  },
  {
    title: "ShopGoodwill Favorites",
    body: "Items you star on ShopGoodwill sync here. Run an eBay price check, then queue a snipe with one click.",
  },
  {
    title: "Durable snipe queue",
    body: "Scheduled bids live in the database with leases, so a worker restart does not wipe your queue. Missed snipes can still happen if ShopGoodwill or the network fails.",
  },
];

export default function LandingPage() {
  return (
    <div className="-mt-6 sm:-mt-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareLd) }}
      />
      <section className="py-20 sm:py-28 text-center">
        <p className="text-4xl sm:text-5xl font-black tracking-tight text-zinc-100">
          BuzzerBidder
        </p>
        <h1 className="mt-5 text-2xl sm:text-4xl font-bold tracking-tight text-zinc-300">
          Buy underpriced auctions.
          <br />
          <span className="bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
            Win them at the last second.
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-base sm:text-lg text-zinc-400">
          Queue ShopGoodwill auctions from a URL or your Favorites, compare them to eBay
          comps, and let us place your bid in the final seconds of the auction.
        </p>
        <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/signup"
            className="w-full sm:w-auto rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 transition-colors hover:bg-emerald-500"
          >
            Get started
          </Link>
          <Link
            href="/pricing"
            className="w-full sm:w-auto rounded-xl border border-zinc-800 bg-zinc-900 px-6 py-3 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-700"
          >
            See pricing
          </Link>
        </div>
        <p className="mt-4 text-xs text-zinc-600">
          Pay only when you win on Standard. You bid with your own ShopGoodwill account.
        </p>
      </section>

      <section className="border-t border-zinc-800/80 py-16">
        <h2 className="text-center text-2xl font-black tracking-tight text-zinc-100">
          How it works
        </h2>
        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <div
              key={step.title}
              className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-sm font-bold text-emerald-400">
                {i + 1}
              </span>
              <h3 className="mt-4 font-semibold text-zinc-100">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-zinc-800/80 py-16">
        <h2 className="text-center text-2xl font-black tracking-tight text-zinc-100">
          What you get
        </h2>
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
            >
              <h3 className="font-semibold text-zinc-100">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                {feature.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="border-t border-zinc-800/80 py-16">
        <h2 className="text-center text-2xl font-black tracking-tight text-zinc-100">
          Pay only when you win
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-center text-sm text-zinc-500">
          Standard charges 2% of the hammer on confirmed wins (fees may batch until they reach
          Stripe&apos;s charge minimum). Pro is $15/month with 0% commission.
        </p>
        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <h3 className="font-semibold text-zinc-100">Standard</h3>
            <p className="mt-1 text-xs text-zinc-500">2% success fee · No monthly fee</p>
            <p className="mt-4 text-3xl font-black text-zinc-100">2%</p>
            <ul className="mt-4 space-y-1.5 text-sm text-zinc-500">
              <li>Pay only when you win</li>
              <li>Unlimited snipes</li>
              <li>No win, no charge</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-emerald-800/50 bg-zinc-900 p-6">
            <h3 className="font-semibold text-zinc-100">Pro</h3>
            <p className="mt-1 text-xs text-zinc-500">0% success fee · Monthly</p>
            <p className="mt-4 text-3xl font-black text-zinc-100">
              $15<span className="text-base font-medium text-zinc-500">/mo</span>
            </p>
            <ul className="mt-4 space-y-1.5 text-sm text-zinc-500">
              <li>0% commission on wins</li>
              <li>Unlimited snipes</li>
              <li>Cancel anytime</li>
            </ul>
          </div>
        </div>
        <div className="mt-8 text-center">
          <Link
            href="/pricing"
            className="inline-block rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Choose a plan
          </Link>
        </div>
      </section>

      <FaqSection faqs={HOME_FAQS} />

      <section className="border-t border-zinc-800/80 py-20 text-center">
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-100">
          Queue your first snipe tonight
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-zinc-500">
          Create an account, connect ShopGoodwill, save a card, and add an auction from a URL or
          Favorites.
        </p>
        <Link
          href="/signup"
          className="mt-8 inline-block rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 transition-colors hover:bg-emerald-500"
        >
          Get started
        </Link>
        <p className="mt-8 text-xs text-zinc-600">
          © {new Date().getFullYear()} BuzzerBidder
          {" · "}
          <Link href="/guides/shopgoodwill-sniping" className="hover:text-zinc-400">
            Guide
          </Link>
          {" · "}
          <Link href="/terms" className="hover:text-zinc-400">
            Terms
          </Link>
          {" · "}
          <Link href="/privacy" className="hover:text-zinc-400">
            Privacy
          </Link>
        </p>
      </section>
    </div>
  );
}
