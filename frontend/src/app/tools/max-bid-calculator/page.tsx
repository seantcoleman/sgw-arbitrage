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
import { SITE_NAME, SITE_URL } from "@/lib/seo";
import { MaxBidCalculator } from "./MaxBidCalculator";

const meta = getContentMeta("/tools/max-bid-calculator")!;

export const metadata: Metadata = {
  title: "ShopGoodwill Max Bid Calculator",
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
    q: "How do I calculate a ShopGoodwill max bid?",
    a: "Start with expected sale price, subtract marketplace fees and shipping to the buyer, subtract inbound shipping from ShopGoodwill, then subtract the profit you need. The remainder is your max bid ceiling.",
  },
  {
    q: "Does this match BuzzerBidder’s comps?",
    a: "It uses the same style of fee-and-shipping math. In the app, comps are pulled from recent eBay solds when you queue — use this tool to explore scenarios before you connect an account.",
  },
];

const webAppLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "ShopGoodwill max bid calculator",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: absoluteUrl(meta.href),
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  datePublished: meta.datePublished,
  dateModified: meta.dateModified,
};

export default function MaxBidCalculatorPage() {
  return (
    <article className="max-w-3xl mx-auto">
      <JsonLd data={webAppLd} />
      <JsonLd data={articleJsonLd(meta)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", href: "/" },
          { name: "Guides", href: "/guides" },
          { name: "Max bid calculator", href: meta.href },
        ])}
      />

      <ArticleHeader meta={meta} sectionLabel="Free tool">
        <p>
          Turn an expected eBay sale, fees, and shipping into a{" "}
          <strong className="font-medium text-zinc-300">ShopGoodwill max bid</strong> that still
          leaves profit. No login required — then queue the lot in BuzzerBidder with live comps if
          you want the sniper to fire.
        </p>
      </ArticleHeader>

      <KeyTakeaways
        items={[
          "Use sold comps, not listing asks.",
          "Max bid = net after fees & shipping − the profit you need.",
          "Negative result means skip the lot or lower your profit target.",
          "In-app comps use the same style of math when you queue a snipe.",
        ]}
      />

      <MaxBidCalculator />

      <h2 className="mt-10 text-xl font-bold text-zinc-100">How to use it</h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-zinc-400">
        <li>Enter a realistic sold comp (not the listing ask).</li>
        <li>Set your fee % (many sellers use ~13% as a rough all-in starting point — adjust).</li>
        <li>Add outbound shipping you will charge/pay and inbound ShopGoodwill shipping.</li>
        <li>Set the profit you actually need after time and risk.</li>
        <li>
          Use the result as a ceiling in a{" "}
          <Link href="/guides/shopgoodwill-sniping" className="text-emerald-400 hover:underline">
            snipe
          </Link>
          , not a target to stretch past.
        </li>
      </ol>

      <p className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/signup"
          className="inline-block rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          Snipe with eBay comps
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
