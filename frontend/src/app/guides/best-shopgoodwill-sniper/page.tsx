import Link from "next/link";
import type { Metadata } from "next";
import { ArticleHeader } from "@/components/ArticleHeader";
import { EditorialDisclosure } from "@/components/EditorialDisclosure";
import { FaqSection } from "@/components/FaqSection";
import { GuideToc } from "@/components/GuideToc";
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
import { PRO_MONTHLY_USD, STANDARD_FEE_LABEL } from "@/lib/seo";

const meta = getContentMeta("/guides/best-shopgoodwill-sniper")!;

export const metadata: Metadata = {
  title: "Best ShopGoodwill Sniper: What to Look For",
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
    q: "What is the best ShopGoodwill sniper?",
    a: `The best tool depends on your volume and pricing preference. Look for reliable last-second timing, honest miss disclosure, eBay comps if you flip, and a fee model that matches how often you lose vs win. BuzzerBidder is a hosted option with comps and ${STANDARD_FEE_LABEL}-on-wins or $${PRO_MONTHLY_USD}/mo Pro.`,
  },
  {
    q: "Hosted or desktop?",
    a: "Desktop tools run on your PC and often charge per fire. Hosted tools keep the queue on a server so sleep mode is less of a problem. Both can miss if ShopGoodwill is unreachable.",
  },
];

const TOC = [
  { id: "timing", label: "Last-second timing" },
  { id: "pricing", label: "Pricing vs win rate" },
  { id: "comps", label: "eBay comps" },
  { id: "hosted-desktop", label: "Hosted vs desktop" },
  { id: "security", label: "Security and independence" },
  { id: "where-we-fit", label: "Where BuzzerBidder fits" },
];

export default function BestSniperGuidePage() {
  return (
    <article className="max-w-3xl mx-auto">
      <JsonLd data={articleJsonLd(meta)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", href: "/" },
          { name: "Guides", href: "/guides" },
          { name: "Best sniper", href: meta.href },
        ])}
      />

      <ArticleHeader meta={meta} sectionLabel="Buyer’s guide">
        <p>
          Searching for the{" "}
          <strong className="font-medium text-zinc-300">best ShopGoodwill sniper</strong> usually
          means comparing timing, pricing, and whether you get resale comps. This is a criteria
          guide — not a fake “#1 forever” list. We build BuzzerBidder; we will say where it fits and
          where you should stay skeptical of any tool (including ours).
        </p>
      </ArticleHeader>

      <KeyTakeaways
        items={[
          "Prefer tools that explain miss modes — “never miss” claims are a red flag.",
          "Match fee model to volume: pay-per-win, flat per-win, credits, or monthly.",
          "Flippers should get sold comps (fees + shipping) next to the bid decision.",
          "Hosted vs desktop is mostly about sleep/credentials tradeoffs.",
          "Independence from ShopGoodwill and clear security docs are non-negotiable.",
        ]}
      />
      <GuideToc items={TOC} />

      <h2 id="timing" className="mt-10 scroll-mt-24 text-xl font-bold text-zinc-100">
        1. Last-second timing you can explain
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        The product should place your max near close, not hours early. Ask how failures are
        handled. Anyone claiming zero misses is ignoring the internet. Background:{" "}
        <Link href="/guides/shopgoodwill-sniping" className="text-emerald-400 hover:underline">
          how sniping works
        </Link>
        .
      </p>

      <h2 id="pricing" className="mt-10 scroll-mt-24 text-xl font-bold text-zinc-100">
        2. Pricing that matches your win rate
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        Prefer pay-per-win (only bill confirmed wins) or a clear monthly cap over tools that charge
        every bid attempt.{" "}
        <Link href="/pricing" className="text-emerald-400 hover:underline">
          BuzzerBidder Standard
        </Link>{" "}
        is {STANDARD_FEE_LABEL} of hammer on wins; Pro is ${PRO_MONTHLY_USD}/mo with 0% fee — pick
        based on your volume. Named competitor pages:{" "}
        <Link
          href="/compare/buzzerbidder-vs-thriftsniper"
          className="text-emerald-400 hover:underline"
        >
          vs ThriftSniper
        </Link>
        ,{" "}
        <Link href="/compare/buzzerbidder-vs-bidpulse" className="text-emerald-400 hover:underline">
          vs BidPulse
        </Link>
        .
      </p>

      <h2 id="comps" className="mt-10 scroll-mt-24 text-xl font-bold text-zinc-100">
        3. eBay comps next to the bid
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        Flippers need sold comps net of fees and shipping. A sniper that only clicks is half the
        job. See{" "}
        <Link href="/guides/shopgoodwill-ebay-arbitrage" className="text-emerald-400 hover:underline">
          ShopGoodwill to eBay arbitrage
        </Link>{" "}
        and the{" "}
        <Link href="/tools/max-bid-calculator" className="text-emerald-400 hover:underline">
          max bid calculator
        </Link>
        .
      </p>

      <h2 id="hosted-desktop" className="mt-10 scroll-mt-24 text-xl font-bold text-zinc-100">
        4. Hosted vs desktop
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        Desktop: full control on your machine; you keep the PC awake. Hosted: queue survives
        sleep; you trust a vendor with encrypted credentials. Both need your own ShopGoodwill
        account. More on scheduling:{" "}
        <Link href="/guides/shopgoodwill-auto-bid" className="text-emerald-400 hover:underline">
          auto bid guide
        </Link>
        .
      </p>

      <h2 id="security" className="mt-10 scroll-mt-24 text-xl font-bold text-zinc-100">
        5. Security and independence
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        Prefer tools that encrypt credentials at rest, document what the key is used for, and
        clearly state they are not affiliated with ShopGoodwill. Read the privacy policy before
        you paste a password into anything. Our posture:{" "}
        <Link href="/about" className="text-emerald-400 hover:underline">
          About BuzzerBidder
        </Link>
        .
      </p>

      <h2 id="where-we-fit" className="mt-10 scroll-mt-24 text-xl font-bold text-zinc-100">
        Where BuzzerBidder fits
      </h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-400">
        <li>Hosted last-second snipes with a durable queue</li>
        <li>eBay comps on queue / Favorites</li>
        <li>
          Standard {STANDARD_FEE_LABEL} on wins or Pro ${PRO_MONTHLY_USD}/mo with 0% fee
        </li>
        <li>AES-256-GCM credential storage; independent of ShopGoodwill</li>
      </ul>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        It is not the right fit if you refuse cloud credential storage, or if you only need one
        manual bid a month. Roundup of options:{" "}
        <Link
          href="/alternatives/shopgoodwill-snipers"
          className="text-emerald-400 hover:underline"
        >
          sniper alternatives
        </Link>
        .
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

      <EditorialDisclosure />
      <FaqSection faqs={FAQS} />
      <RelatedGuides currentHref={meta.href} />
    </article>
  );
}
