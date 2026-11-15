import Link from "next/link";
import type { Metadata } from "next";
import { ArticleHeader } from "@/components/ArticleHeader";
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
import { SITE_NAME, SITE_URL } from "@/lib/seo";

const meta = getContentMeta("/guides/auction-item-terms")!;

export const metadata: Metadata = {
  title: "Auction Item Terms: NIB, NWT & More",
  description: meta.description,
  keywords: meta.keywords,
  alternates: { canonical: meta.href },
  openGraph: {
    title: meta.title,
    description: meta.description,
    url: absoluteUrl(meta.href),
  },
};

type Term = { abbr: string; name: string; meaning: string; tip?: string };

const CONDITION: Term[] = [
  {
    abbr: "NIB",
    name: "New In Box",
    meaning:
      "Seller claims the item is new and still in its original packaging. Box condition varies — photos matter.",
    tip: "On ShopGoodwill, “new” is often unverified. Price as if you may open it and find wear.",
  },
  {
    abbr: "BNIB",
    name: "Brand New In Box",
    meaning: "Same idea as NIB, with extra emphasis that it is unused.",
  },
  {
    abbr: "MIB",
    name: "Mint In Box",
    meaning:
      "Unused (or near-mint) and boxed. “Mint” is subjective — check for crushed corners and missing inserts.",
  },
  {
    abbr: "NRFB",
    name: "Never Removed From Box",
    meaning: "Claimed sealed / unopened since packaging. Still not a factory guarantee.",
  },
  {
    abbr: "NWT",
    name: "New With Tags",
    meaning: "Apparel or soft goods that still have original retail tags attached.",
    tip: "Confirm size tags in photos. Tagged ≠ current season or complete set.",
  },
  {
    abbr: "NWOT",
    name: "New Without Tags",
    meaning: "Appears unused but tags are gone — common for returns and thrift “new.”",
  },
  {
    abbr: "NOS",
    name: "New Old Stock",
    meaning:
      "Unused inventory that sat in storage (often older packaging). May have yellowing, dry rot, or dead batteries.",
  },
  {
    abbr: "OB / Open Box",
    name: "Open Box",
    meaning: "Packaging opened; item may be unused, returned, or incomplete. Assume risk until photos prove otherwise.",
  },
  {
    abbr: "EUC",
    name: "Excellent Used Condition",
    meaning: "Lightly used with minimal wear per the seller’s judgment — still verify.",
  },
  {
    abbr: "GUC",
    name: "Good Used Condition",
    meaning: "Normal wear; expect scuffs, fading, or light defects.",
  },
  {
    abbr: "AS-IS",
    name: "As-is / Sold as-is",
    meaning:
      "No returns for condition surprises. On thrift auctions this is the default mindset even when not spelled out.",
    tip: "Build returns and dead-on-arrival risk into your max bid.",
  },
];

const LISTING: Term[] = [
  {
    abbr: "NR",
    name: "No Reserve",
    meaning: "No hidden reserve price — the high bid at close can win (subject to site rules).",
  },
  {
    abbr: "BIN",
    name: "Buy It Now",
    meaning: "Fixed-price purchase option (more common on eBay than classic ShopGoodwill timed auctions).",
  },
  {
    abbr: "HTF / VHTF",
    name: "Hard / Very Hard To Find",
    meaning: "Seller marketing for scarcity. Comps still decide value — rarity claims are not comps.",
  },
  {
    abbr: "OEM",
    name: "Original Equipment Manufacturer",
    meaning: "Maker’s original part or product, not aftermarket.",
  },
  {
    abbr: "COA",
    name: "Certificate of Authenticity",
    meaning: "Paper claiming authenticity. Treat as weak proof unless you trust the issuer.",
  },
  {
    abbr: "Lot",
    name: "Lot / estate lot",
    meaning:
      "Multiple items sold together. Value the worst pieces and shipping weight, not the hero item alone.",
  },
  {
    abbr: "Untested",
    name: "Untested / powers on / for parts",
    meaning:
      "No working guarantee. “Powers on” ≠ fully functional. Price like repair inventory unless photos prove more.",
  },
];

const RESELLER: Term[] = [
  {
    abbr: "FS / F/S",
    name: "For Sale",
    meaning: "Listing is a sale (vs trade). Mostly forum shorthand; less common in SGW titles.",
  },
  {
    abbr: "FSOT",
    name: "For Sale Or Trade",
    meaning: "Seller will sell or trade. Rare on ShopGoodwill; common in collector forums.",
  },
  {
    abbr: "PPV / pay-per-win",
    name: "Pay when you win (sniper billing)",
    meaning:
      "Some sniper tools bill only on confirmed wins (e.g. a % of hammer) instead of per bid fire or only a flat monthly fee.",
  },
];

const FAQS: Faq[] = [
  {
    q: "What does NIB mean on ShopGoodwill?",
    a: "NIB usually means New In Box — the seller claims the item is new and boxed. On thrift auctions that claim is often unverified, so use photos and price with return risk in mind.",
  },
  {
    q: "What does NWT mean?",
    a: "NWT means New With Tags — typically clothing or soft goods that still have original retail tags. Confirm size and completeness in the listing photos.",
  },
  {
    q: "Is NWOT the same as NWT?",
    a: "No. NWOT is New Without Tags: it may look unused, but tags are missing. That often means a return, thrift “new,” or incomplete retail presentation.",
  },
  {
    q: "Should I pay more for NIB or MIB listings?",
    a: "Only if comps support sealed/new solds and photos back the claim. Abbreviations are marketing shorthand, not a condition report. When unsure, bid as used/open-box.",
  },
];

const TOC = [
  { id: "condition", label: "Condition & packaging" },
  { id: "listing", label: "Listing & auction shorthand" },
  { id: "reseller", label: "Reseller / tool shorthand" },
  { id: "how-to-use", label: "How to use terms when bidding" },
];

function TermList({ terms }: { terms: Term[] }) {
  return (
    <dl className="mt-4 divide-y divide-zinc-800 rounded-2xl border border-zinc-800 bg-zinc-900/40">
      {terms.map((t) => (
        <div key={t.abbr} id={t.abbr.toLowerCase().replace(/[^a-z0-9]+/g, "-")} className="scroll-mt-24 px-5 py-4">
          <dt className="text-base font-semibold text-zinc-100">
            <span className="text-emerald-400">{t.abbr}</span>
            <span className="text-zinc-500"> — </span>
            {t.name}
          </dt>
          <dd className="mt-1.5 text-sm leading-relaxed text-zinc-400">{t.meaning}</dd>
          {t.tip ? (
            <dd className="mt-2 text-sm leading-relaxed text-zinc-500">
              <span className="font-medium text-zinc-400">Bidder tip:</span> {t.tip}
            </dd>
          ) : null}
        </div>
      ))}
    </dl>
  );
}

const definedTermSetLd = {
  "@context": "https://schema.org",
  "@type": "DefinedTermSet",
  name: "Auction and ShopGoodwill listing abbreviations",
  description: meta.description,
  url: absoluteUrl(meta.href),
  publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  hasDefinedTerm: [...CONDITION, ...LISTING, ...RESELLER].map((t) => ({
    "@type": "DefinedTerm",
    name: t.abbr,
    description: `${t.name}: ${t.meaning}`,
    inDefinedTermSet: absoluteUrl(meta.href),
  })),
};

export default function AuctionItemTermsPage() {
  return (
    <article className="max-w-3xl mx-auto">
      <JsonLd data={articleJsonLd(meta)} />
      <JsonLd data={definedTermSetLd} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", href: "/" },
          { name: "Guides", href: "/guides" },
          { name: "Auction item terms", href: meta.href },
        ])}
      />

      <ArticleHeader
        meta={meta}
        sectionLabel="Glossary"
        title="Auction item terms: NIB, NWT, and more"
      >
        <p>
          ShopGoodwill and reseller listings are packed with shorthand —{" "}
          <strong className="font-medium text-zinc-300">NIB</strong>,{" "}
          <strong className="font-medium text-zinc-300">NWT</strong>, NWOT, MIB, as-is, and more.
          This glossary explains the common{" "}
          <strong className="font-medium text-zinc-300">auction item terms</strong> so you can set a
          sane max bid instead of trusting title hype.
        </p>
      </ArticleHeader>

      <KeyTakeaways
        items={[
          "NIB = New In Box; NWT = New With Tags; NWOT = New Without Tags.",
          "Abbreviations are claims, not guarantees — photos and comps decide value.",
          "As-is / untested means bake failure risk into your max.",
          "Use a calculator before you snipe lots marketed as NIB or HTF.",
        ]}
      />

      <GuideToc items={TOC} />

      <h2 id="condition" className="mt-10 scroll-mt-24 text-xl font-bold text-zinc-100">
        Condition &amp; packaging
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        These show up most in titles and photo captions. On thrift auctions, treat every “new”
        claim as unverified until the photos force you to believe it.
      </p>
      <TermList terms={CONDITION} />

      <h2 id="listing" className="mt-10 scroll-mt-24 text-xl font-bold text-zinc-100">
        Listing &amp; auction shorthand
      </h2>
      <TermList terms={LISTING} />

      <h2 id="reseller" className="mt-10 scroll-mt-24 text-xl font-bold text-zinc-100">
        Reseller / tool shorthand
      </h2>
      <TermList terms={RESELLER} />

      <h2 id="how-to-use" className="mt-10 scroll-mt-24 text-xl font-bold text-zinc-100">
        How to use terms when bidding
      </h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-zinc-400">
        <li>Read the abbreviation, then ignore the hype and open every photo.</li>
        <li>
          Price from{" "}
          <Link
            href="/guides/shopgoodwill-ebay-arbitrage"
            className="text-emerald-400 hover:underline"
          >
            eBay sold comps
          </Link>{" "}
          that match the <em>real</em> condition you can prove — not the acronym.
        </li>
        <li>
          Run the numbers in the{" "}
          <Link href="/tools/bid-strategy-calculator" className="text-emerald-400 hover:underline">
            bid strategy calculator
          </Link>{" "}
          (or{" "}
          <Link href="/tools/max-bid-calculator" className="text-emerald-400 hover:underline">
            max bid calculator
          </Link>
          ).
        </li>
        <li>
          If the lot still clears your max,{" "}
          <Link href="/guides/shopgoodwill-sniping" className="text-emerald-400 hover:underline">
            snipe near close
          </Link>{" "}
          instead of advertising an early high bid.
        </li>
      </ol>

      <p className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/tools/bid-strategy-calculator"
          className="inline-block rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          Open bid strategy calculator
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
