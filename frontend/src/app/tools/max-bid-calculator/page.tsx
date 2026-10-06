import Link from "next/link";
import type { Metadata } from "next";
import { FaqSection } from "@/components/FaqSection";
import { JsonLd } from "@/components/JsonLd";
import { RelatedGuides } from "@/components/RelatedGuides";
import { absoluteUrl } from "@/lib/guides";
import type { Faq } from "@/lib/seo";
import { SITE_NAME, SITE_URL } from "@/lib/seo";
import { MaxBidCalculator } from "./MaxBidCalculator";

export const metadata: Metadata = {
  title: "ShopGoodwill Max Bid Calculator",
  description:
    "Free ShopGoodwill max bid calculator — turn eBay sold comps, fees, shipping, and target profit into a max bid you can snipe with.",
  alternates: { canonical: "/tools/max-bid-calculator" },
  openGraph: {
    title: "ShopGoodwill max bid calculator",
    description:
      "Estimate a profitable ShopGoodwill max bid from eBay sold prices, fees, and shipping.",
    url: absoluteUrl("/tools/max-bid-calculator"),
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
  url: absoluteUrl("/tools/max-bid-calculator"),
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
};

const breadcrumbLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Tools", item: absoluteUrl("/tools/max-bid-calculator") },
    {
      "@type": "ListItem",
      position: 3,
      name: "Max bid calculator",
      item: absoluteUrl("/tools/max-bid-calculator"),
    },
  ],
};

export default function MaxBidCalculatorPage() {
  return (
    <article className="max-w-3xl mx-auto">
      <JsonLd data={webAppLd} />
      <JsonLd data={breadcrumbLd} />

      <p className="text-xs font-medium uppercase tracking-wider text-emerald-400">Free tool</p>
      <h1 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight text-zinc-100">
        ShopGoodwill max bid calculator
      </h1>
      <p className="mt-4 text-base text-zinc-400">
        Turn an expected eBay sale, fees, and shipping into a{" "}
        <strong className="font-medium text-zinc-300">ShopGoodwill max bid</strong> that still
        leaves profit. No login required — then queue the lot in BuzzerBidder with live comps if you
        want the sniper to fire.
      </p>

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
      <RelatedGuides currentHref="/tools/max-bid-calculator" />
    </article>
  );
}
