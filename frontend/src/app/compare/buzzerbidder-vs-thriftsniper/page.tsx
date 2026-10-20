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

const meta = getContentMeta("/compare/buzzerbidder-vs-thriftsniper")!;

export const metadata: Metadata = {
  title: "BuzzerBidder vs ThriftSniper",
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
    q: "Is BuzzerBidder a ThriftSniper alternative?",
    a: `Yes if you want hosted last-second bidding plus eBay sold comps when you queue. Pricing differs: ThriftSniper publicly markets a flat fee per win; BuzzerBidder Standard is ${STANDARD_FEE_LABEL} of hammer on confirmed wins, or Pro at ${PRO_PRICE_LABEL} with ${PRO_SUCCESS_FEE_PCT}% success fee.`,
  },
  {
    q: "Do both tools snipe ShopGoodwill?",
    a: "Both are third-party ShopGoodwill bidding tools (neither is affiliated with ShopGoodwill). Always verify current features and pricing on each vendor’s site.",
  },
];

export default function VsThriftSniperPage() {
  return (
    <article className="max-w-3xl mx-auto">
      <JsonLd data={articleJsonLd(meta)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", href: "/" },
          { name: "Guides", href: "/guides" },
          { name: "vs ThriftSniper", href: meta.href },
        ])}
      />

      <ArticleHeader meta={meta} sectionLabel="Compare">
        <p>
          Looking for a <strong className="font-medium text-zinc-300">ThriftSniper alternative</strong>
          — or deciding between flat per-win fees and a percentage / subscription? This page compares
          public positioning. Competitor facts last checked{" "}
          <strong className="font-medium text-zinc-300">2026-10-06</strong>; always confirm on their
          site before you buy.
        </p>
      </ArticleHeader>

      <KeyTakeaways
        items={[
          "ThriftSniper markets a flat fee per win; BuzzerBidder Standard is % of hammer on wins.",
          "BuzzerBidder adds eBay comps in the queue / Favorites flow.",
          "High hammer + flat per-win can beat a percentage — model your own numbers.",
          "Neither tool is affiliated with ShopGoodwill.",
        ]}
      />

      <h2 className="mt-10 text-xl font-bold text-zinc-100">Side-by-side</h2>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-800">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead className="bg-zinc-900 text-zinc-300">
            <tr>
              <th className="px-4 py-3 font-medium">Factor</th>
              <th className="px-4 py-3 font-medium">ThriftSniper</th>
              <th className="px-4 py-3 font-medium">BuzzerBidder</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800 text-zinc-400">
            <tr>
              <td className="px-4 py-3 text-zinc-200">Pricing (public)</td>
              <td className="px-4 py-3">50¢ per win; no monthly / % fee marketed</td>
              <td className="px-4 py-3">
                Standard {STANDARD_FEE_LABEL} on confirmed wins; Pro ${PRO_MONTHLY_USD}/mo at{" "}
                {PRO_SUCCESS_FEE_PCT}%
              </td>
            </tr>
            <tr>
              <td className="px-4 py-3 text-zinc-200">When you pay</td>
              <td className="px-4 py-3">On wins (flat)</td>
              <td className="px-4 py-3">Standard: wins only (%). Pro: monthly</td>
            </tr>
            <tr>
              <td className="px-4 py-3 text-zinc-200">eBay comps</td>
              <td className="px-4 py-3">Not their core marketed wedge</td>
              <td className="px-4 py-3">Built into queue / Favorites flow</td>
            </tr>
            <tr>
              <td className="px-4 py-3 text-zinc-200">Hosting</td>
              <td className="px-4 py-3">Web bid manager</td>
              <td className="px-4 py-3">Hosted durable snipe queue</td>
            </tr>
            <tr>
              <td className="px-4 py-3 text-zinc-200">Affiliation</td>
              <td className="px-4 py-3">Independent (their disclaimer)</td>
              <td className="px-4 py-3">Independent — not affiliated with ShopGoodwill</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 text-xl font-bold text-zinc-100">Who each fits</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-400">
        <li>
          <strong className="font-medium text-zinc-300">ThriftSniper</strong> can be simple if you
          want a tiny flat fee per win and already know your max bids.
        </li>
        <li>
          <strong className="font-medium text-zinc-300">BuzzerBidder</strong> fits if you want eBay
          sold comps in the same flow, hosted workers, and either {STANDARD_FEE_LABEL} on wins or a
          flat Pro month when volume is high.
        </li>
      </ul>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        On high hammer prices, a flat 50¢/win can beat a percentage. On many small wins or heavy
        testing, model the total: percentage scales with hammer; Pro caps tool cost at $
        {PRO_MONTHLY_USD}/mo.
      </p>

      <p className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/signup"
          className="inline-block rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          Try BuzzerBidder
        </Link>
        <Link
          href="/alternatives/shopgoodwill-snipers"
          className="inline-block rounded-xl border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-200 hover:border-zinc-500"
        >
          All sniper alternatives
        </Link>
      </p>
      <FaqSection faqs={FAQS} />
      <RelatedGuides currentHref={meta.href} />
    </article>
  );
}
