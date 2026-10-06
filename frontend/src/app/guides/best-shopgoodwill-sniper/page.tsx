import Link from "next/link";
import type { Metadata } from "next";
import { FaqSection } from "@/components/FaqSection";
import { JsonLd } from "@/components/JsonLd";
import { RelatedGuides } from "@/components/RelatedGuides";
import { absoluteUrl } from "@/lib/guides";
import type { Faq } from "@/lib/seo";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Best ShopGoodwill Sniper: What to Look For",
  description:
    "A buyer’s guide to ShopGoodwill snipers — timing, comps, pricing models, hosted vs desktop, and when BuzzerBidder fits.",
  alternates: { canonical: "/guides/best-shopgoodwill-sniper" },
  openGraph: {
    title: "Best ShopGoodwill sniper: what to look for",
    description:
      "Criteria for choosing a ShopGoodwill auction sniper: timing, comps, pricing, and hosted vs desktop.",
    url: absoluteUrl("/guides/best-shopgoodwill-sniper"),
  },
};

const FAQS: Faq[] = [
  {
    q: "What is the best ShopGoodwill sniper?",
    a: "The best tool depends on your volume and pricing preference. Look for reliable last-second timing, honest miss disclosure, eBay comps if you flip, and a fee model that matches how often you lose vs win. BuzzerBidder is a hosted option with comps and 2%-on-wins or $10/mo Pro.",
  },
  {
    q: "Hosted or desktop?",
    a: "Desktop tools run on your PC and often charge per fire. Hosted tools keep the queue on a server so sleep mode is less of a problem. Both can miss if ShopGoodwill is unreachable.",
  },
];

const articleLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Best ShopGoodwill sniper: what to look for",
  description: "Buyer’s guide to ShopGoodwill auction snipers.",
  author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  mainEntityOfPage: absoluteUrl("/guides/best-shopgoodwill-sniper"),
  datePublished: "2026-10-01",
  dateModified: "2026-10-01",
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
      name: "Best sniper",
      item: absoluteUrl("/guides/best-shopgoodwill-sniper"),
    },
  ],
};

export default function BestSniperGuidePage() {
  return (
    <article className="max-w-3xl mx-auto">
      <JsonLd data={articleLd} />
      <JsonLd data={breadcrumbLd} />

      <p className="text-xs font-medium uppercase tracking-wider text-emerald-400">
        <Link href="/guides" className="hover:underline">
          Guides
        </Link>
        {" / Buyer’s guide"}
      </p>
      <h1 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight text-zinc-100">
        Best ShopGoodwill sniper: what to look for
      </h1>
      <p className="mt-4 text-base text-zinc-400">
        Searching for the{" "}
        <strong className="font-medium text-zinc-300">best ShopGoodwill sniper</strong> usually
        means comparing timing, pricing, and whether you get resale comps. This is a criteria
        guide — not a fake “#1 forever” list. We build BuzzerBidder; we will say where it fits and
        where you should stay skeptical of any tool (including ours).
      </p>

      <h2 className="mt-10 text-xl font-bold text-zinc-100">1. Last-second timing you can explain</h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        The product should place your max near close, not hours early. Ask how failures are
        handled. Anyone claiming zero misses is ignoring the internet.
      </p>

      <h2 className="mt-10 text-xl font-bold text-zinc-100">2. Pricing that matches your win rate</h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        Prefer pay-per-win (only bill confirmed wins) or a clear monthly cap over tools that charge
        every bid attempt.{" "}
        <Link
          href="/compare/buzzerbidder-vs-per-snipe-tools"
          className="text-emerald-400 hover:underline"
        >
          BuzzerBidder Standard
        </Link>{" "}
        is 2% of hammer on wins; Pro is $10/mo with 0% fee — pick based on your volume.
      </p>

      <h2 className="mt-10 text-xl font-bold text-zinc-100">3. eBay comps next to the bid</h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        Flippers need sold comps net of fees and shipping. A sniper that only clicks is half the
        job. See{" "}
        <Link href="/guides/shopgoodwill-ebay-arbitrage" className="text-emerald-400 hover:underline">
          ShopGoodwill to eBay arbitrage
        </Link>
        .
      </p>

      <h2 className="mt-10 text-xl font-bold text-zinc-100">4. Hosted vs desktop</h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        Desktop: full control on your machine; you keep the PC awake. Hosted: queue survives
        sleep; you trust a vendor with encrypted credentials. Both need your own ShopGoodwill
        account.
      </p>

      <h2 className="mt-10 text-xl font-bold text-zinc-100">5. Security and independence</h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        Prefer tools that encrypt credentials at rest, document what the key is used for, and
        clearly state they are not affiliated with ShopGoodwill. Read the privacy policy before
        you paste a password into anything.
      </p>

      <h2 className="mt-10 text-xl font-bold text-zinc-100">Where BuzzerBidder fits</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-400">
        <li>Hosted last-second snipes with a durable queue</li>
        <li>eBay comps on queue / Favorites</li>
        <li>Standard 2% on wins or Pro $10/mo with 0% fee</li>
        <li>AES-256-GCM credential storage; independent of ShopGoodwill</li>
      </ul>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        It is not the right fit if you refuse cloud credential storage, or if you only need one
        manual bid a month.
      </p>

      <p className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/pricing"
          className="inline-block rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          See BuzzerBidder pricing
        </Link>
        <Link
          href="/guides/shopgoodwill-auto-bid"
          className="inline-block rounded-xl border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-200 hover:border-zinc-500"
        >
          How auto bid works
        </Link>
      </p>

      <FaqSection faqs={FAQS} />
      <RelatedGuides currentHref="/guides/best-shopgoodwill-sniper" />
    </article>
  );
}
