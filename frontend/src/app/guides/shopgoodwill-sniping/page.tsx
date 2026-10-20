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

const meta = getContentMeta("/guides/shopgoodwill-sniping")!;

export const metadata: Metadata = {
  title: "How ShopGoodwill Sniping Works",
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
    q: "Does sniping guarantee a win?",
    a: "No. A snipe only submits your max bid near the end. Someone else can still have a higher proxy max, and ShopGoodwill or network issues can cause a missed bid.",
  },
  {
    q: "Should I bid early on ShopGoodwill?",
    a: "Early bids can raise the visible price and attract other bidders. A last-second bid keeps your max hidden until the auction is almost over.",
  },
  {
    q: "Does BuzzerBidder have a pay-per-win option?",
    a: `Yes. Standard charges ${STANDARD_FEE_LABEL} of the hammer only on confirmed wins (no monthly fee). Pro is $${PRO_MONTHLY_USD}/month with no success fee if you prefer a flat bill.`,
  },
  {
    q: "What is ShopGoodwill proxy bidding?",
    a: "You enter a max. ShopGoodwill bids on your behalf in increments only as needed to stay ahead, up to that max. Other bidders never see your full max until competition forces the price up.",
  },
  {
    q: "Can a scheduled snipe miss?",
    a: "Yes. Misses can happen if ShopGoodwill is slow, login fails, the network drops, or the current minimum is already above your max (we skip instead of overpaying).",
  },
];

const howToLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to snipe a ShopGoodwill auction with BuzzerBidder",
  description:
    "Connect your ShopGoodwill account, check eBay comps, set a max bid, and schedule a last-second snipe.",
  step: [
    {
      "@type": "HowToStep",
      name: "Create a BuzzerBidder account",
      text: "Sign up and save a payment method on Standard, or start a Pro subscription.",
    },
    {
      "@type": "HowToStep",
      name: "Connect ShopGoodwill",
      text: "Link your own ShopGoodwill login. Credentials are encrypted at rest with AES-256-GCM.",
    },
    {
      "@type": "HowToStep",
      name: "Add an auction and check eBay comps",
      text: "Paste a ShopGoodwill URL or sync Favorites, then review recent eBay sales net of fees and shipping.",
    },
    {
      "@type": "HowToStep",
      name: "Set a max bid and queue the snipe",
      text: "Choose a max under your net resale estimate. BuzzerBidder schedules the bid for the final seconds.",
    },
  ],
};

const TOC = [
  { id: "proxy-bidding", label: "Proxy bidding on ShopGoodwill" },
  { id: "early-bids", label: "Why early bids raise prices" },
  { id: "last-second", label: "What a last-second bid does" },
  { id: "what-we-see", label: "What we see when sniping (experience)" },
  { id: "ebay-comps", label: "Using eBay sold comps" },
  { id: "max-bid-math", label: "Max bid math / ROI checklist" },
  { id: "manual-vs-hosted", label: "Manual vs hosted vs desktop" },
  { id: "pricing", label: "Pricing: Standard vs Pro" },
  { id: "get-started", label: "How to start" },
];

export default function SnipingGuidePage() {
  return (
    <article className="max-w-3xl mx-auto">
      <JsonLd data={howToLd} />
      <JsonLd data={articleJsonLd(meta)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", href: "/" },
          { name: "Guides", href: "/guides" },
          { name: "ShopGoodwill sniping", href: meta.href },
        ])}
      />

      <ArticleHeader meta={meta} sectionLabel="Sniping">
        <p>
          ShopGoodwill sniping means submitting your max bid in the final seconds of an auction —
          not hours early. A{" "}
          <strong className="font-medium text-zinc-300">ShopGoodwill sniper</strong> schedules that
          last-second bid so you are not advertising a high max while the listing is still open.
          BuzzerBidder is a hosted sniper: the queue lives on our workers, you bid with your own
          ShopGoodwill account, and you can check eBay comps before you commit.
        </p>
      </ArticleHeader>

      <KeyTakeaways
        items={[
          "Sniping places your max near close so early bids do not advertise your ceiling.",
          "Wins are never guaranteed — higher proxy maxes and site/network failures still happen.",
          "Price the exit with eBay sold comps minus fees and shipping before you set a max.",
          `BuzzerBidder Standard is pay-per-win (${STANDARD_FEE_LABEL} on confirmed wins); Pro is $${PRO_MONTHLY_USD}/mo.`,
          "Hosted queues help when many lots end while you sleep — they do not eliminate misses.",
        ]}
      />
      <GuideToc items={TOC} />

      <h2 id="proxy-bidding" className="mt-10 scroll-mt-24 text-xl font-bold text-zinc-100">
        Proxy bidding on ShopGoodwill, explained
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        ShopGoodwill uses proxy bidding. You enter a maximum. The site advances the visible price
        in increments only as far as needed to keep you ahead of other bidders, up to your max.
        Other people do not see your full ceiling unless competition forces the price there.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        That design is why early high bids hurt. If you manually bid a large max early, you can
        lift the hammer and draw attention. A last-second bid keeps your intention quiet until
        there is little time left for others to respond.
      </p>

      <h2 id="early-bids" className="mt-10 scroll-mt-24 text-xl font-bold text-zinc-100">
        Why early bids raise prices
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        Resellers watch activity. A climbing bid history, or a sudden jump, signals that someone
        thinks the lot is worth more. Sniping does not remove competition that already has a
        higher proxy max, but it reduces the chance that <em>you</em> create that signal.
      </p>

      <h2 id="last-second" className="mt-10 scroll-mt-24 text-xl font-bold text-zinc-100">
        What a last-second bid does
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        You pick an item and a max you will pay. BuzzerBidder stores that as a scheduled job. A
        worker places the bid a few seconds before close, using the ShopGoodwill account you
        connected. If the current minimum is already above your max, the bid is skipped instead of
        overpaying.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        That does not lock in a win. Another bidder can have a higher max, and a ShopGoodwill
        outage or network failure can still cause a miss. Be honest with yourself about those
        limits — tools that promise “never miss” are selling you a story.
      </p>

      <h2 id="what-we-see" className="mt-10 scroll-mt-24 text-xl font-bold text-zinc-100">
        What we see when sniping (experience)
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        Building a hosted sniper means living with ShopGoodwill’s real failure modes — not a demo
        happy path. In practice:
      </p>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-400">
        <li>
          <strong className="font-medium text-zinc-300">Session / login friction</strong> — stale
          credentials or site challenges can prevent a fire even when the job is scheduled.
        </li>
        <li>
          <strong className="font-medium text-zinc-300">Already above max</strong> — if the minimum
          to bid is past your ceiling, we skip rather than overbid. That is a “miss” relative to
          winning, and the correct money decision.
        </li>
        <li>
          <strong className="font-medium text-zinc-300">Latency near close</strong> — the last
          seconds are crowded; workers pre-warm, but the auction site still has the final say.
        </li>
        <li>
          <strong className="font-medium text-zinc-300">Comps are estimates</strong> — eBay solds
          help set a ceiling; condition, shipping, and sell-through still move the real P&amp;L.
        </li>
      </ul>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        We document those constraints on purpose. Trustworthy sniper content does not sell magic.
      </p>

      <h2 id="ebay-comps" className="mt-10 scroll-mt-24 text-xl font-bold text-zinc-100">
        Using eBay sold comps (fees and shipping)
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        A low ShopGoodwill hammer is only a deal if you can resell it. When you queue an auction —
        from a pasted URL or from Favorites — BuzzerBidder compares the listing to recent eBay
        sales and subtracts an assumed eBay fee and outbound shipping cost. Use that{" "}
        <Link href="/guides/shopgoodwill-ebay-arbitrage" className="text-emerald-400 hover:underline">
          net arbitrage number
        </Link>
        , not the raw eBay median, when you set a max bid. For quick scenarios without an account,
        use the{" "}
        <Link href="/tools/max-bid-calculator" className="text-emerald-400 hover:underline">
          max bid calculator
        </Link>
        .
      </p>

      <h2 id="max-bid-math" className="mt-10 scroll-mt-24 text-xl font-bold text-zinc-100">
        Max bid math / ROI checklist
      </h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-400">
        <li>Median or recent sold comps that match condition and model</li>
        <li>eBay fees (or your channel’s fees) on the expected sale</li>
        <li>Outbound shipping and packaging</li>
        <li>ShopGoodwill buyer premium / shipping / tax on the win</li>
        <li>Your time and return risk</li>
        <li>
          BuzzerBidder Standard {STANDARD_FEE_LABEL} on the hammer (or Pro at $
          {PRO_MONTHLY_USD}/mo with 0% fee)
        </li>
      </ul>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        Max bid ≈ expected net resale − costs − margin you actually want. If the math is thin,
        skip the lot. Sniping does not fix a bad purchase. More tactics in{" "}
        <Link
          href="/guides/shopgoodwill-bidding-strategy"
          className="text-emerald-400 hover:underline"
        >
          bidding strategy
        </Link>
        .
      </p>

      <h2 id="manual-vs-hosted" className="mt-10 scroll-mt-24 text-xl font-bold text-zinc-100">
        Manual vs hosted sniper vs desktop
      </h2>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-800">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead className="bg-zinc-900 text-zinc-300">
            <tr>
              <th className="px-4 py-3 font-medium">Approach</th>
              <th className="px-4 py-3 font-medium">Strength</th>
              <th className="px-4 py-3 font-medium">Weakness</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800 text-zinc-400">
            <tr>
              <td className="px-4 py-3 text-zinc-200">Manual</td>
              <td className="px-4 py-3">No tool fee</td>
              <td className="px-4 py-3">Fails when many lots end at once</td>
            </tr>
            <tr>
              <td className="px-4 py-3 text-zinc-200">Desktop sniper</td>
              <td className="px-4 py-3">Credentials often stay local</td>
              <td className="px-4 py-3">PC must be online; some bill per fire</td>
            </tr>
            <tr>
              <td className="px-4 py-3 text-zinc-200">Hosted (BuzzerBidder)</td>
              <td className="px-4 py-3">Durable queue + comps in flow</td>
              <td className="px-4 py-3">Cloud credential storage; misses still possible</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        Criteria checklist:{" "}
        <Link href="/guides/best-shopgoodwill-sniper" className="text-emerald-400 hover:underline">
          best ShopGoodwill sniper guide
        </Link>
        . Auto-bid detail:{" "}
        <Link href="/guides/shopgoodwill-auto-bid" className="text-emerald-400 hover:underline">
          ShopGoodwill auto bid
        </Link>
        .
      </p>

      <h2 id="pricing" className="mt-10 scroll-mt-24 text-xl font-bold text-zinc-100">
        Pricing: Standard vs Pro
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        <Link href="/pricing" className="text-emerald-400 hover:underline">
          Standard
        </Link>{" "}
        is already pay-per-win: {STANDARD_FEE_LABEL} of the hammer on confirmed wins and nothing
        when you lose. Fees can batch until they reach Stripe&apos;s minimum charge. Pro is $
        {PRO_MONTHLY_USD} per month with a 0% success fee while active — usually better when
        monthly {STANDARD_FEE_LABEL} fees would exceed that flat amount.
      </p>

      <h2 id="get-started" className="mt-10 scroll-mt-24 text-xl font-bold text-zinc-100">
        How to start
      </h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-zinc-400">
        <li>Create a BuzzerBidder account and choose Standard (card) or Pro.</li>
        <li>Connect your ShopGoodwill login (encrypted at rest).</li>
        <li>Paste an auction URL or pull from Favorites; review eBay comps.</li>
        <li>Set a max under your net resale estimate and queue the snipe.</li>
      </ol>

      <p className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/signup"
          className="inline-block rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          Get started
        </Link>
        <Link
          href="/pricing"
          className="inline-block rounded-xl border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-200 hover:border-zinc-500"
        >
          See pricing
        </Link>
      </p>

      <EditorialDisclosure />
      <FaqSection faqs={FAQS} />
      <RelatedGuides currentHref={meta.href} />
    </article>
  );
}
