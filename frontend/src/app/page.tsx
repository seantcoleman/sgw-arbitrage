import Link from "next/link";

const STEPS = [
  {
    title: "Connect ShopGoodwill",
    body: "Link your existing ShopGoodwill account once. Credentials are encrypted with AES-256-GCM and the key never leaves our bidding server.",
  },
  {
    title: "Find the spread",
    body: "We scan live auctions and compare them against recent eBay sale prices, net of fees and shipping, so you see real profit instead of a guess.",
  },
  {
    title: "Snipe automatically",
    body: "Set your max bid and walk away. Our workers place the bid in the last seconds of the auction, so you never drive the price up early.",
  },
];

const FEATURES = [
  {
    title: "Profit-first deal feed",
    body: "Every listing is priced against eBay comps with your fee and shipping assumptions baked in.",
  },
  {
    title: "Last-second bidding",
    body: "Bids fire seconds before close from a pre-warmed session, so there's no time for a counter-bid.",
  },
  {
    title: "Your favorites, synced",
    body: "Items you favorite on ShopGoodwill show up here already analyzed and ready to queue.",
  },
  {
    title: "Durable snipe queue",
    body: "Scheduled bids live in the database with leases, so a restart never costs you an auction.",
  },
];

export default function LandingPage() {
  return (
    <div className="-mt-6 sm:-mt-8">
      <section className="py-20 sm:py-28 text-center">
        <p className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs font-medium text-zinc-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          ShopGoodwill arbitrage, automated
        </p>
        <h1 className="mt-6 text-4xl sm:text-6xl font-black tracking-tight text-zinc-100">
          Buy underpriced auctions.
          <br />
          <span className="bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
            Win them at the last second.
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-base sm:text-lg text-zinc-400">
          We watch ShopGoodwill for listings selling well below their eBay resale
          value, then place your bid in the final seconds so you pay as little as
          possible.
        </p>
        <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/signup"
            className="w-full sm:w-auto rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 transition-colors hover:bg-emerald-500"
          >
            Create free account
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto rounded-xl border border-zinc-800 bg-zinc-900 px-6 py-3 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-700"
          >
            Sign in
          </Link>
        </div>
        <p className="mt-4 text-xs text-zinc-600">
          Free to start. You bid with your own ShopGoodwill account.
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

      <section className="border-t border-zinc-800/80 py-20 text-center">
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-100">
          Start finding deals tonight
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-zinc-500">
          Create an account, connect ShopGoodwill, and queue your first snipe in
          a couple of minutes.
        </p>
        <Link
          href="/signup"
          className="mt-8 inline-block rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 transition-colors hover:bg-emerald-500"
        >
          Create free account
        </Link>
      </section>
    </div>
  );
}
