import Link from "next/link";
import type { Metadata } from "next";
import { ArticleHeader } from "@/components/ArticleHeader";
import { FaqSection } from "@/components/FaqSection";
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
import {
  PRO_MONTHLY_USD,
  PRO_PRICE_LABEL,
  PRO_SUCCESS_FEE_PCT,
  STANDARD_FEE_LABEL,
} from "@/lib/seo";

const meta = getContentMeta("/compare/buzzerbidder-vs-bidpulse")!;

export const metadata: Metadata = {
  title: "BuzzerBidder vs BidPulse",
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
    q: "Is BuzzerBidder a BidPulse alternative?",
    a: `If you want last-second ShopGoodwill bidding with eBay comps and pay-when-you-win Standard pricing (${STANDARD_FEE_LABEL} on confirmed wins) or Pro at ${PRO_PRICE_LABEL}, yes. Confirm BidPulse’s current plans on their site — public marketing has described a monthly Pro tier.`,
  },
  {
    q: "Do you store ShopGoodwill credentials?",
    a: "BuzzerBidder stores credentials encrypted at rest (AES-256-GCM) on the bidding server so hosted snipes can fire. Some competitors emphasize device-local storage. Pick the trust model you accept.",
  },
];

export default function VsBidPulsePage() {
  return (
    <article className="max-w-3xl mx-auto">
      <JsonLd data={articleJsonLd(meta)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", href: "/" },
          { name: "Guides", href: "/guides" },
          { name: "vs BidPulse", href: meta.href },
        ])}
      />

      <ArticleHeader meta={meta} sectionLabel="Compare">
        <p>
          Both target resellers who want{" "}
          <strong className="font-medium text-zinc-300">ShopGoodwill auto bidding</strong> without
          watching the clock. The tradeoffs are pricing shape, comps, and where credentials live.
          BidPulse plan details below reflect public community marketing (e.g. Reddit) as of{" "}
          <strong className="font-medium text-zinc-300">2026-10-06</strong> — verify live pricing on
          bidpulse.app.
        </p>
      </ArticleHeader>

      <KeyTakeaways
        items={[
          "BidPulse has been marketed as a monthly Pro plan — confirm current price on their site.",
          `BuzzerBidder offers Standard (${STANDARD_FEE_LABEL}/win) or Pro ($${PRO_MONTHLY_USD}/mo).`,
          "Credential models differ: hosted encrypted vs device-local claims — pick what you trust.",
          "eBay comps in-queue are a BuzzerBidder wedge for flippers.",
        ]}
      />

      <h2 className="mt-10 text-xl font-bold text-zinc-100">Side-by-side</h2>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-800">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead className="bg-zinc-900 text-zinc-300">
            <tr>
              <th className="px-4 py-3 font-medium">Factor</th>
              <th className="px-4 py-3 font-medium">BidPulse (public)</th>
              <th className="px-4 py-3 font-medium">BuzzerBidder</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800 text-zinc-400">
            <tr>
              <td className="px-4 py-3 text-zinc-200">Pricing model</td>
              <td className="px-4 py-3">Subscription Pro marketed ~$29/mo with simultaneous snipe caps</td>
              <td className="px-4 py-3">
                Standard {STANDARD_FEE_LABEL}/win or Pro ${PRO_MONTHLY_USD}/mo (
                {PRO_SUCCESS_FEE_PCT}% fee)
              </td>
            </tr>
            <tr>
              <td className="px-4 py-3 text-zinc-200">Pay if you lose?</td>
              <td className="px-4 py-3">Subscription still due (typical)</td>
              <td className="px-4 py-3">Standard: no success fee on losses</td>
            </tr>
            <tr>
              <td className="px-4 py-3 text-zinc-200">eBay comps</td>
              <td className="px-4 py-3">Not their primary marketed hook</td>
              <td className="px-4 py-3">Comps + fees/shipping in queue flow</td>
            </tr>
            <tr>
              <td className="px-4 py-3 text-zinc-200">Credentials</td>
              <td className="px-4 py-3">Community posts emphasize device-local login</td>
              <td className="px-4 py-3">Encrypted at rest for hosted workers</td>
            </tr>
            <tr>
              <td className="px-4 py-3 text-zinc-200">Alerts</td>
              <td className="px-4 py-3">SMS/email called out in marketing</td>
              <td className="px-4 py-3">In-app watchlist / queue status</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 text-xl font-bold text-zinc-100">Cost intuition</h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        A fixed monthly Pro bill can be cheaper than a percentage if you win a lot of high-hammer
        lots. BuzzerBidder Pro is ${PRO_MONTHLY_USD}/mo; if public BidPulse Pro is ~$29/mo, that is
        the subscription comparison — but only after you confirm their current price. Occasional
        winners often prefer Standard {STANDARD_FEE_LABEL} with no monthly floor.
      </p>

      <p className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/pricing"
          className="inline-block rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          See BuzzerBidder pricing
        </Link>
        <Link
          href="/guides/best-shopgoodwill-sniper"
          className="inline-block rounded-xl border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-200 hover:border-zinc-500"
        >
          Buyer&apos;s guide
        </Link>
      </p>
      <FaqSection faqs={FAQS} />
      <RelatedGuides currentHref={meta.href} />
    </article>
  );
}
