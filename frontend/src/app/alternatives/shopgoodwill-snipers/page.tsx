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
  SITE_NAME,
  SITE_URL,
  STANDARD_FEE_LABEL,
} from "@/lib/seo";

export const metadata: Metadata = {
  title: "ShopGoodwill Sniper Alternatives (2026)",
  description:
    "Criteria-led roundup of ShopGoodwill sniping tools — pricing models, hosted vs desktop, eBay comps, and when each fits. Includes BuzzerBidder.",
  alternates: { canonical: "/alternatives/shopgoodwill-snipers" },
  openGraph: {
    title: "ShopGoodwill sniper alternatives",
    description:
      "Compare ThriftSniper, BidPulse, AuctionBotPro, desktop snipers, and BuzzerBidder by criteria — not hype.",
    url: absoluteUrl("/alternatives/shopgoodwill-snipers"),
  },
};

const FAQS: Faq[] = [
  {
    q: "What should I look for in a ShopGoodwill sniper?",
    a: "Timing reliability, honest miss disclosure, pricing that matches your win rate, whether you get sold comps, and a credential model you accept. See our buyer’s guide for the full checklist.",
  },
  {
    q: "Is BuzzerBidder affiliated with ShopGoodwill?",
    a: "No. None of the tools on this page are ShopGoodwill or Goodwill Industries products unless they say otherwise — treat them as independent software.",
  },
];

const articleLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "ShopGoodwill sniper alternatives (2026)",
  description: "Criteria-led roundup of ShopGoodwill sniping tools.",
  author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  mainEntityOfPage: absoluteUrl("/alternatives/shopgoodwill-snipers"),
  datePublished: "2026-10-06",
  dateModified: "2026-10-06",
};

const breadcrumbLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    {
      "@type": "ListItem",
      position: 2,
      name: "Alternatives",
      item: absoluteUrl("/alternatives/shopgoodwill-snipers"),
    },
  ],
};

const OPTIONS = [
  {
    name: "ThriftSniper",
    summary: "Web bid manager; publicly markets 50¢ per win with no monthly or percentage fee.",
    bestFor: "Simple flat per-win cost if you already know max bids.",
    href: "/compare/buzzerbidder-vs-thriftsniper",
  },
  {
    name: "BidPulse",
    summary:
      "Hosted sniping with subscription-style Pro marketing (verify live price) and alert features called out in community posts.",
    bestFor: "Buyers who prefer a monthly plan and SMS/email alerts.",
    href: "/compare/buzzerbidder-vs-bidpulse",
  },
  {
    name: "AuctionBotPro",
    summary: "Credit packs (e.g. $10 / 10 snipes) plus a self-host option; strong public docs.",
    bestFor: "Credit-based or self-hosted Cloudflare setups.",
    href: "/guides/best-shopgoodwill-sniper",
  },
  {
    name: "Desktop snipers (e.g. shopgoodwillsniper.com)",
    summary:
      "Local apps; some use success-fee or monthly Pro. Compare fee models (pay-per-win vs pay-per-attempt vs monthly) before you pick.",
    bestFor: "Keeping credentials on your machine if you accept babysitting a desktop.",
    href: "/pricing",
  },
  {
    name: "BuzzerBidder",
    summary: `Hosted queue + eBay comps. Standard ${STANDARD_FEE_LABEL} on confirmed wins, or Pro at ${PRO_PRICE_LABEL} with 0% success fee.`,
    bestFor: "Resellers who want comps in the sniping flow and pay-when-you-win Standard.",
    href: "/pricing",
  },
];

export default function AlternativesPage() {
  return (
    <article className="max-w-3xl mx-auto">
      <JsonLd data={articleLd} />
      <JsonLd data={breadcrumbLd} />

      <p className="text-xs font-medium uppercase tracking-wider text-emerald-400">Alternatives</p>
      <h1 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight text-zinc-100">
        ShopGoodwill sniper alternatives
      </h1>
      <p className="mt-4 text-base text-zinc-400">
        A criteria-led roundup — not a hit piece. Pricing and features below were checked against
        public pages and marketing on{" "}
        <strong className="font-medium text-zinc-300">2026-10-06</strong>. Confirm before you pay.
        We build BuzzerBidder; that bias is disclosed.
      </p>

      <h2 className="mt-10 text-xl font-bold text-zinc-100">Decision criteria</h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-zinc-400">
        <li>Pricing: per-win flat, % of hammer, per-snipe credit, or subscription</li>
        <li>Hosted workers vs desktop / local credentials</li>
        <li>Whether sold comps (eBay) are in the product</li>
        <li>Honest talk about missed snipes</li>
        <li>Support, docs, and community signal</li>
      </ol>

      <h2 className="mt-10 text-xl font-bold text-zinc-100">Options</h2>
      <ul className="mt-6 space-y-6">
        {OPTIONS.map((opt) => (
          <li key={opt.name} className="border-b border-zinc-800/80 pb-6 last:border-0">
            <h3 className="text-lg font-semibold text-zinc-100">{opt.name}</h3>
            <p className="mt-2 text-sm text-zinc-400">{opt.summary}</p>
            <p className="mt-2 text-sm text-zinc-500">
              <span className="text-zinc-300">Best for:</span> {opt.bestFor}
            </p>
            <Link href={opt.href} className="mt-3 inline-block text-sm text-emerald-400 hover:underline">
              Related page →
            </Link>
          </li>
        ))}
      </ul>

      <h2 className="mt-10 text-xl font-bold text-zinc-100">Quick pick</h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        Want comps + hosted snipes with {STANDARD_FEE_LABEL} only on wins (or ${PRO_MONTHLY_USD}/mo
        Pro)? Start with BuzzerBidder. Want a tiny flat per-win fee? Look at ThriftSniper. Prefer
        credits or self-host? AuctionBotPro. Prefer subscription + alerts? Evaluate BidPulse on
        their current pricing page.
      </p>

      <p className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/signup"
          className="inline-block rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          Get started with BuzzerBidder
        </Link>
        <Link
          href="/tools/max-bid-calculator"
          className="inline-block rounded-xl border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-200 hover:border-zinc-500"
        >
          Free max bid calculator
        </Link>
      </p>

      <FaqSection faqs={FAQS} />
      <RelatedGuides currentHref="/alternatives/shopgoodwill-snipers" />
    </article>
  );
}
