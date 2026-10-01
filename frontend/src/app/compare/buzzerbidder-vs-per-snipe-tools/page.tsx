import Link from "next/link";
import type { Metadata } from "next";
import { FaqSection } from "@/components/FaqSection";
import { JsonLd } from "@/components/JsonLd";
import { RelatedGuides } from "@/components/RelatedGuides";
import { absoluteUrl } from "@/lib/guides";
import type { Faq } from "@/lib/seo";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "BuzzerBidder vs Per-Snipe Sniper Tools",
  description:
    "Pay 2% only when you win (or $10/mo Pro) versus charging a flat fee every time a ShopGoodwill bid fires — including losses.",
  alternates: { canonical: "/compare/buzzerbidder-vs-per-snipe-tools" },
  openGraph: {
    title: "BuzzerBidder vs per-snipe sniper tools",
    description:
      "Compare pay-when-you-win ShopGoodwill sniping with tools that charge per bid attempt.",
    url: absoluteUrl("/compare/buzzerbidder-vs-per-snipe-tools"),
  },
};

const FAQS: Faq[] = [
  {
    q: "What is a per-snipe fee?",
    a: "A flat charge every time the tool fires a bid, whether you win or lose. Costs add up when you test many lots.",
  },
  {
    q: "When is Pro cheaper than Standard?",
    a: "Roughly when 2% of your monthly hammer wins exceeds $10. High win volume favors Pro; occasional wins often favor Standard.",
  },
];

const articleLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "BuzzerBidder vs per-snipe sniper tools",
  description: "Pay-when-you-win pricing versus per-bid ShopGoodwill sniper fees.",
  author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  mainEntityOfPage: absoluteUrl("/compare/buzzerbidder-vs-per-snipe-tools"),
  datePublished: "2026-10-01",
  dateModified: "2026-10-01",
};

const breadcrumbLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    {
      "@type": "ListItem",
      position: 2,
      name: "Compare",
      item: absoluteUrl("/compare/buzzerbidder-vs-per-snipe-tools"),
    },
  ],
};

export default function PerSnipeComparePage() {
  return (
    <article className="max-w-3xl mx-auto">
      <JsonLd data={articleLd} />
      <JsonLd data={breadcrumbLd} />

      <p className="text-xs font-medium uppercase tracking-wider text-emerald-400">Compare</p>
      <h1 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight text-zinc-100">
        BuzzerBidder vs per-snipe sniper tools
      </h1>
      <p className="mt-4 text-base text-zinc-400">
        Many ShopGoodwill snipers — especially desktop apps — charge a fee{" "}
        <em>every time a bid fires</em>, win or lose. BuzzerBidder Standard charges{" "}
        <strong className="font-medium text-zinc-300">2% of the hammer only on confirmed wins</strong>
        . Pro is $10/month with 0% success fee. This page compares those models so you can pick
        based on how you actually bid.
      </p>

      <h2 className="mt-10 text-xl font-bold text-zinc-100">Side-by-side</h2>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-800">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead className="bg-zinc-900 text-zinc-300">
            <tr>
              <th className="px-4 py-3 font-medium">Factor</th>
              <th className="px-4 py-3 font-medium">Per-snipe tools</th>
              <th className="px-4 py-3 font-medium">BuzzerBidder</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800 text-zinc-400">
            <tr>
              <td className="px-4 py-3 text-zinc-200">When you pay</td>
              <td className="px-4 py-3">Often every bid attempt</td>
              <td className="px-4 py-3">Standard: wins only (2%). Pro: flat $10/mo</td>
            </tr>
            <tr>
              <td className="px-4 py-3 text-zinc-200">Lost auctions</td>
              <td className="px-4 py-3">Still often billed</td>
              <td className="px-4 py-3">No success fee on Standard</td>
            </tr>
            <tr>
              <td className="px-4 py-3 text-zinc-200">Hosting</td>
              <td className="px-4 py-3">Frequently desktop / local</td>
              <td className="px-4 py-3">Hosted queue + workers</td>
            </tr>
            <tr>
              <td className="px-4 py-3 text-zinc-200">eBay comps</td>
              <td className="px-4 py-3">Varies by product</td>
              <td className="px-4 py-3">Built into queue / Favorites flow</td>
            </tr>
            <tr>
              <td className="px-4 py-3 text-zinc-200">Misses possible?</td>
              <td className="px-4 py-3">Yes</td>
              <td className="px-4 py-3">Yes — we say so upfront</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 text-xl font-bold text-zinc-100">A quick cost example</h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        Suppose you fire 40 snipes in a month, win 8 auctions totaling $2,000 hammer, and a
        competing tool charges $0.50 per fire ($20). Standard success fees would be 2% × $2,000 =
        $40. If you lose often while testing, per-snipe fees climb without revenue; Standard does
        not charge those losses. If your monthly 2% fees exceed $10,{" "}
        <Link href="/pricing" className="text-emerald-400 hover:underline">
          Pro
        </Link>{" "}
        may be cheaper.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        Numbers are illustrative — plug in your own win rate and hammer totals.
      </p>

      <h2 className="mt-10 text-xl font-bold text-zinc-100">When per-snipe still makes sense</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-400">
        <li>You refuse any cloud credential storage</li>
        <li>You already own a desktop license and snipe rarely</li>
        <li>You need a niche feature BuzzerBidder does not offer yet</li>
      </ul>

      <p className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/signup"
          className="inline-block rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          Try pay-when-you-win
        </Link>
        <Link
          href="/guides/best-shopgoodwill-sniper"
          className="inline-block rounded-xl border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-200 hover:border-zinc-500"
        >
          Full buyer&apos;s guide
        </Link>
      </p>

      <FaqSection faqs={FAQS} />
      <RelatedGuides currentHref="/compare/buzzerbidder-vs-per-snipe-tools" />
    </article>
  );
}
