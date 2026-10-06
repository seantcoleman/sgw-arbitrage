import Link from "next/link";
import type { Metadata } from "next";
import { FaqSection } from "@/components/FaqSection";
import { JsonLd } from "@/components/JsonLd";
import { RelatedGuides } from "@/components/RelatedGuides";
import { absoluteUrl } from "@/lib/guides";
import type { Faq } from "@/lib/seo";
import {
  PRO_MONTHLY_USD,
  PRO_PRICE_LABEL,
  PRO_SUCCESS_FEE_PCT,
  SITE_NAME,
  SITE_URL,
  STANDARD_FEE_LABEL,
} from "@/lib/seo";

export const metadata: Metadata = {
  title: "ShopGoodwill Sniper Pricing Models Compared",
  description: `BuzzerBidder includes a pay-per-win plan (${STANDARD_FEE_LABEL} on confirmed wins) and Pro at ${PRO_PRICE_LABEL}. Compare those with flat per-win fees and tools that bill every bid attempt.`,
  alternates: { canonical: "/guides/shopgoodwill-sniper-pricing" },
  openGraph: {
    title: "ShopGoodwill sniper pricing models compared",
    description:
      "Pay-per-win, pay-per-attempt, and monthly sniper pricing — including BuzzerBidder Standard and Pro.",
    url: absoluteUrl("/guides/shopgoodwill-sniper-pricing"),
  },
};

const FAQS: Faq[] = [
  {
    q: "Does BuzzerBidder have a per-snipe / pay-as-you-go option?",
    a: `Yes. Standard has no monthly fee — you pay ${STANDARD_FEE_LABEL} of the hammer only on confirmed wins. That is our pay-per-win plan. Pro is optional: ${PRO_PRICE_LABEL} with ${PRO_SUCCESS_FEE_PCT}% success fee if you prefer a flat bill.`,
  },
  {
    q: "What is the difference between pay-per-win and pay-per-attempt?",
    a: "Pay-per-win (BuzzerBidder Standard, and some flat-fee tools) bills only when you win. Pay-per-attempt tools charge a credit or fee when a bid fires, including many losses. Those add up when you test a lot of lots.",
  },
  {
    q: "When is Pro cheaper than Standard?",
    a: `Roughly when ${STANDARD_FEE_LABEL} of your monthly hammer wins exceeds $${PRO_MONTHLY_USD}. High win volume favors Pro; occasional wins often favor Standard.`,
  },
];

const articleLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "ShopGoodwill sniper pricing models compared",
  description:
    "Pay-per-win, pay-per-attempt, and monthly pricing for ShopGoodwill snipers — including BuzzerBidder Standard and Pro.",
  author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  mainEntityOfPage: absoluteUrl("/guides/shopgoodwill-sniper-pricing"),
  datePublished: "2026-10-01",
  dateModified: "2026-10-06",
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
      name: "Sniper pricing",
      item: absoluteUrl("/guides/shopgoodwill-sniper-pricing"),
    },
  ],
};

export default function SniperPricingModelsPage() {
  return (
    <article className="max-w-3xl mx-auto">
      <JsonLd data={articleLd} />
      <JsonLd data={breadcrumbLd} />

      <p className="text-xs font-medium uppercase tracking-wider text-emerald-400">
        <Link href="/guides" className="hover:underline">
          Guides
        </Link>
        {" / Pricing models"}
      </p>
      <h1 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight text-zinc-100">
        ShopGoodwill sniper pricing models compared
      </h1>
      <p className="mt-4 text-base text-zinc-400">
        BuzzerBidder is{" "}
        <strong className="font-medium text-zinc-300">not “anti per-snipe”</strong> — Standard{" "}
        <em>is</em> our pay-as-you-go plan:{" "}
        <strong className="font-medium text-zinc-300">
          {STANDARD_FEE_LABEL} of the hammer only on confirmed wins
        </strong>
        , no monthly fee. Pro is the other option: {PRO_PRICE_LABEL} with {PRO_SUCCESS_FEE_PCT}%
        success fee. This page compares those models with flat per-win fees and tools that bill{" "}
        <em>every bid attempt</em> (win or lose).
      </p>

      <h2 className="mt-10 text-xl font-bold text-zinc-100">Three common models</h2>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-800">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="bg-zinc-900 text-zinc-300">
            <tr>
              <th className="px-4 py-3 font-medium">Model</th>
              <th className="px-4 py-3 font-medium">When you pay</th>
              <th className="px-4 py-3 font-medium">Example</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800 text-zinc-400">
            <tr>
              <td className="px-4 py-3 text-zinc-200">Pay per win (%)</td>
              <td className="px-4 py-3">Only confirmed wins; scales with hammer</td>
              <td className="px-4 py-3">BuzzerBidder Standard ({STANDARD_FEE_LABEL})</td>
            </tr>
            <tr>
              <td className="px-4 py-3 text-zinc-200">Pay per win (flat)</td>
              <td className="px-4 py-3">Only wins; fixed cents/dollars per win</td>
              <td className="px-4 py-3">
                e.g.{" "}
                <Link
                  href="/compare/buzzerbidder-vs-thriftsniper"
                  className="text-emerald-400 hover:underline"
                >
                  ThriftSniper
                </Link>{" "}
                (publicly 50¢/win)
              </td>
            </tr>
            <tr>
              <td className="px-4 py-3 text-zinc-200">Pay per attempt / credit</td>
              <td className="px-4 py-3">Often when a bid fires — including many losses</td>
              <td className="px-4 py-3">Credit packs / some desktop snipers</td>
            </tr>
            <tr>
              <td className="px-4 py-3 text-zinc-200">Monthly subscription</td>
              <td className="px-4 py-3">Flat fee for the period; tool fee does not scale with hammer</td>
              <td className="px-4 py-3">
                BuzzerBidder Pro (${PRO_MONTHLY_USD}/mo, {PRO_SUCCESS_FEE_PCT}% success fee)
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 text-xl font-bold text-zinc-100">BuzzerBidder’s two options</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-400">
        <li>
          <strong className="font-medium text-zinc-300">Standard</strong> — per successful snipe /
          win: {STANDARD_FEE_LABEL} of hammer. Lose or skip → no success fee. Best when you snipe
          occasionally or want no monthly floor.
        </li>
        <li>
          <strong className="font-medium text-zinc-300">Pro</strong> — {PRO_PRICE_LABEL},{" "}
          {PRO_SUCCESS_FEE_PCT}% success fee while active. Best when {STANDARD_FEE_LABEL} of your
          monthly wins would exceed ${PRO_MONTHLY_USD}.
        </li>
      </ul>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        Both include unlimited snipes, eBay comps in the queue flow, and hosted last-second
        bidding. You still pay ShopGoodwill for the item, shipping, and tax.
      </p>

      <h2 className="mt-10 text-xl font-bold text-zinc-100">Where pay-per-attempt hurts</h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        If a tool charges every time a bid fires, testing 40 lots in a month can cost more than the
        wins justify — even when most auctions lose. Pay-per-win plans (our Standard, or a flat
        per-win competitor) do not bill those losses as tool fees. That is the useful contrast — not
        “BuzzerBidder vs having a per-snipe plan,” because we already offer one.
      </p>

      <h2 className="mt-10 text-xl font-bold text-zinc-100">A quick cost example</h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        Forty snipes, eight wins, $2,000 total hammer. A $0.50-per-attempt tool might bill ~$20 for
        the fires. Standard success fees would be {STANDARD_FEE_LABEL} × $2,000 = $40 (wins only). A
        flat 50¢-per-win tool would be ~$4 on those eight wins. If your monthly{" "}
        {STANDARD_FEE_LABEL} fees exceed ${PRO_MONTHLY_USD},{" "}
        <Link href="/pricing" className="text-emerald-400 hover:underline">
          Pro
        </Link>{" "}
        may be cheaper than Standard. Numbers are illustrative — use your own win rate and hammers.
      </p>

      <p className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/pricing"
          className="inline-block rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          See Standard &amp; Pro
        </Link>
        <Link
          href="/guides/best-shopgoodwill-sniper"
          className="inline-block rounded-xl border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-200 hover:border-zinc-500"
        >
          Full buyer&apos;s guide
        </Link>
      </p>

      <FaqSection faqs={FAQS} />
      <RelatedGuides currentHref="/guides/shopgoodwill-sniper-pricing" />
    </article>
  );
}
