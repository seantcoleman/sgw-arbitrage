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
  SITE_NAME,
  SITE_URL,
  STANDARD_FEE_LABEL,
  STANDARD_SUCCESS_FEE_PCT,
} from "@/lib/seo";
import { BidStrategyCalculator } from "./BidStrategyCalculator";

const meta = getContentMeta("/tools/bid-strategy-calculator")!;

export const metadata: Metadata = {
  title: "ShopGoodwill Bid Strategy Calculator",
  description: meta.description,
  keywords: meta.keywords,
  alternates: { canonical: meta.href },
  openGraph: {
    title: meta.title,
    description: meta.description,
    url: absoluteUrl(meta.href),
  },
};

const FAQS: Faq[] = [
  {
    q: "What is a ShopGoodwill bid strategy calculator?",
    a: "It turns eBay sold comps, fees, shipping, and the current bid into a max bid plus a simple snipe / skip recommendation — and compares Standard vs Pro fees at your monthly win volume.",
  },
  {
    q: "How is this different from the max bid calculator?",
    a: "The max bid tool focuses on the dollar ceiling. This bid strategy calculator also factors current bid (chase risk), a snipe-vs-skip verdict, and whether Standard or Pro is cheaper for your volume.",
  },
  {
    q: "Should I bid early or snipe?",
    a: "If comps support your max and the current bid is still under it, sniping near close usually keeps your ceiling quieter than early bidding. If the current bid already exceeds your max, skip — do not escalate.",
  },
  {
    q: "Does BuzzerBidder guarantee a win at this max?",
    a: "No. A snipe only submits your max near the end. A higher proxy max, site issues, or network failures can still miss. Use the calculator as a money decision, not a win promise.",
  },
];

const webAppLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "ShopGoodwill bid strategy calculator",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: absoluteUrl(meta.href),
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  datePublished: meta.datePublished,
  dateModified: meta.dateModified,
};

export default function BidStrategyCalculatorPage() {
  return (
    <article className="max-w-3xl mx-auto">
      <JsonLd data={webAppLd} />
      <JsonLd data={articleJsonLd(meta)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", href: "/" },
          { name: "Guides", href: "/guides" },
          { name: "Bid strategy calculator", href: meta.href },
        ])}
      />

      <ArticleHeader meta={meta} sectionLabel="Free tool" title="ShopGoodwill bid strategy calculator">
        <p>
          Free{" "}
          <strong className="font-medium text-zinc-300">bid strategy calculator</strong> for
          ShopGoodwill: set a max from eBay comps, decide whether to snipe or skip based on the
          current bid, and see if Standard ({STANDARD_FEE_LABEL} on wins) or Pro ($
          {PRO_MONTHLY_USD}/mo) fits your volume. No login required.
        </p>
      </ArticleHeader>

      <KeyTakeaways
        items={[
          "Max bid comes from sold comps minus fees, shipping, and the profit you need.",
          "If the current bid is already above your max, skip — chasing kills strategy.",
          "Sniping near close keeps your ceiling quieter than early bids.",
          `Compare Standard (${STANDARD_SUCCESS_FEE_PCT}% on wins) vs Pro ($${PRO_MONTHLY_USD}/mo) at your win rate.`,
        ]}
      />

      <BidStrategyCalculator />

      <h2 className="mt-10 text-xl font-bold text-zinc-100">How the strategy works</h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-zinc-400">
        <li>Price the exit with realistic sold comps (not listing asks).</li>
        <li>Subtract marketplace fees, outbound shipping, inbound ShopGoodwill shipping, and profit.</li>
        <li>Compare that ceiling to the current bid — skip if you are already out.</li>
        <li>
          If the lot still makes sense,{" "}
          <Link href="/guides/shopgoodwill-sniping" className="text-emerald-400 hover:underline">
            snipe
          </Link>{" "}
          near close instead of advertising an early high max.
        </li>
        <li>Use monthly wins × average hammer to pick Standard vs Pro on pricing.</li>
      </ol>

      <p className="mt-6 text-sm text-zinc-500">
        Need only the ceiling math? Use the{" "}
        <Link href="/tools/max-bid-calculator" className="text-emerald-400 hover:underline">
          max bid calculator
        </Link>
        . Deeper tactics:{" "}
        <Link
          href="/guides/shopgoodwill-bidding-strategy"
          className="text-emerald-400 hover:underline"
        >
          bidding strategy guide
        </Link>
        .
      </p>

      <p className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/signup"
          className="inline-block rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          Queue snipes with live comps
        </Link>
        <Link
          href="/guides/shopgoodwill-bidding-strategy"
          className="inline-block rounded-xl border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-200 hover:border-zinc-500"
        >
          Bidding strategy guide
        </Link>
      </p>

      <FaqSection faqs={FAQS} />
      <RelatedGuides currentHref={meta.href} />
    </article>
  );
}
