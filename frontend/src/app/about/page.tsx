import Link from "next/link";
import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { absoluteUrl } from "@/lib/guides";
import {
  PRO_MONTHLY_USD,
  PRO_SUCCESS_FEE_PCT,
  SITE_NAME,
  SITE_URL,
  STANDARD_FEE_LABEL,
} from "@/lib/seo";

export const metadata: Metadata = {
  title: "About BuzzerBidder",
  description:
    "BuzzerBidder is an independent hosted ShopGoodwill sniper with eBay comps. Not affiliated with ShopGoodwill. Learn how we bid, price, and handle credentials.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About BuzzerBidder",
    description:
      "Independent ShopGoodwill sniper — hosted last-second bids, eBay comps, clear pricing.",
    url: absoluteUrl("/about"),
  },
};

const aboutLd = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  name: "About BuzzerBidder",
  url: absoluteUrl("/about"),
  mainEntity: {
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    description:
      "Hosted ShopGoodwill sniper with eBay comps and last-second bidding.",
  },
};

export default function AboutPage() {
  return (
    <article className="max-w-3xl mx-auto">
      <JsonLd data={aboutLd} />

      <p className="text-xs font-medium uppercase tracking-wider text-emerald-400">About</p>
      <h1 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight text-zinc-100">
        About {SITE_NAME}
      </h1>
      <p className="mt-4 text-base text-zinc-400">
        {SITE_NAME} is a hosted{" "}
        <strong className="font-medium text-zinc-300">ShopGoodwill sniper</strong>: you queue
        auctions, check eBay sold comps, and we place your max bid in the final seconds using your
        own ShopGoodwill account.
      </p>

      <h2 className="mt-10 text-xl font-bold text-zinc-100">Independent — not ShopGoodwill</h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        We are not affiliated with, endorsed by, or sponsored by ShopGoodwill or Goodwill
        Industries. Follow ShopGoodwill’s terms and your local laws when you bid.
      </p>

      <h2 className="mt-10 text-xl font-bold text-zinc-100">How we approach the product</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-400">
        <li>Hosted durable snipe queue so your laptop does not need to stay awake</li>
        <li>eBay comps (fees + shipping estimates) when you queue from a URL or Favorites</li>
        <li>
          Clear pricing: Standard {STANDARD_FEE_LABEL} on confirmed wins, or Pro $
          {PRO_MONTHLY_USD}/mo with {PRO_SUCCESS_FEE_PCT}% success fee — see{" "}
          <Link href="/pricing" className="text-emerald-400 hover:underline">
            Pricing
          </Link>
        </li>
        <li>
          Honest about misses: site outages, network issues, or a minimum already above your max can
          skip a bid
        </li>
        <li>Credentials encrypted at rest (AES-256-GCM); decryption stays on the bidding server</li>
      </ul>

      <h2 className="mt-10 text-xl font-bold text-zinc-100">Editorial on this site</h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        Guides and comparisons are written by the {SITE_NAME} team. We disclose that we build the
        product. We do not invent competitor pricing — tables are dated and you should verify on
        their sites. Pages show an Updated date when content changes.
      </p>

      <h2 className="mt-10 text-xl font-bold text-zinc-100">Learn more</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-zinc-400">
        <li>
          <Link href="/guides" className="text-emerald-400 hover:underline">
            Guides hub
          </Link>
        </li>
        <li>
          <Link
            href="/guides/shopgoodwill-sniping"
            className="text-emerald-400 hover:underline"
          >
            How ShopGoodwill sniping works
          </Link>
        </li>
        <li>
          <Link href="/tools/max-bid-calculator" className="text-emerald-400 hover:underline">
            Max bid calculator
          </Link>
        </li>
        <li>
          <Link href="/terms" className="text-emerald-400 hover:underline">
            Terms
          </Link>{" "}
          ·{" "}
          <Link href="/privacy" className="text-emerald-400 hover:underline">
            Privacy
          </Link>
        </li>
      </ul>

      <p className="mt-10">
        <Link
          href="/signup"
          className="inline-block rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          Get started
        </Link>
      </p>
    </article>
  );
}
