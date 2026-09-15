import Link from "next/link";

export const metadata = {
  title: "Terms of Service · SGW Arb",
};

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto prose-invert">
      <h1 className="text-3xl font-black text-zinc-100 tracking-tight mb-2">
        Terms of Service
      </h1>
      <p className="text-sm text-zinc-500 mb-10">Last updated: September 15, 2026</p>

      <div className="space-y-8 text-sm leading-relaxed text-zinc-400">
        <section>
          <h2 className="text-base font-semibold text-zinc-100 mb-2">1. Acceptance</h2>
          <p>
            By creating an account or using SGW Arb (&quot;the Service&quot;), you agree to these
            Terms. If you do not agree, do not use the Service. These Terms are a binding agreement
            between you and the operator of SGW Arb.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-100 mb-2">2. The Service</h2>
          <p>
            SGW Arb is a hosted web application that finds ShopGoodwill auctions with potential
            resale profit and can place last-second bids on your behalf using credentials you
            provide. We are <strong className="text-zinc-200">not</strong> affiliated with,
            endorsed by, or sponsored by ShopGoodwill or Goodwill Industries.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-100 mb-2">
            3. ShopGoodwill credentials
          </h2>
          <p>
            To place bids, you may connect your ShopGoodwill username and password. We store those
            credentials <strong className="text-zinc-200">encrypted (AES-256-GCM)</strong> on our
            bidding servers and use them only to place bids you schedule and to check auction
            outcomes. The encryption key does not leave the bidding server. You are responsible for
            the accuracy of your credentials and for complying with ShopGoodwill&apos;s own terms.
            ShopGoodwill may suspend or ban accounts; we are not liable for that.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-100 mb-2">4. Fees and billing</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong className="text-zinc-200">Standard:</strong> no monthly fee. We charge a{" "}
              <strong className="text-zinc-200">2% success fee</strong> on the hammer price
              (winning bid amount) of each auction you win through the Service. If you do not win,
              you owe no success fee for that auction.
            </li>
            <li>
              <strong className="text-zinc-200">Pro:</strong> a monthly subscription (currently
              $15/month unless we change the price in Stripe) with{" "}
              <strong className="text-zinc-200">0% success fee</strong> while the subscription is
              active.
            </li>
            <li>
              ShopGoodwill&apos;s own invoice (item price, shipping, tax) is separate and paid
              directly to ShopGoodwill.
            </li>
            <li>
              A saved payment method (or active Pro subscription) is required to queue new snipes.
              We may pause new snipes if invoices are unpaid. Already-queued snipes may still fire.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-100 mb-2">5. No guarantees</h2>
          <p>
            We do not guarantee that bids will be placed on time, accepted, or that you will win.
            Network issues, ShopGoodwill outages, credential failures, and platform changes can
            cause missed snipes. The Service is provided{" "}
            <strong className="text-zinc-200">&quot;as is&quot;</strong> without warranties of any
            kind.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-100 mb-2">6. Your responsibilities</h2>
          <p>You agree to:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Use the Service only for lawful purposes</li>
            <li>Comply with ShopGoodwill&apos;s terms of service</li>
            <li>Pay all fees owed under your plan</li>
            <li>Keep your SGW Arb and ShopGoodwill account credentials secure</li>
            <li>Not abuse, reverse engineer, or resell the Service</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-100 mb-2">7. Limitation of liability</h2>
          <p>
            To the maximum extent permitted by law, we are not liable for lost profits, missed
            auctions, account suspensions, or consequential damages. Our total liability for any
            claim is limited to the fees you paid us in the three months before the claim.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-100 mb-2">8. Termination</h2>
          <p>
            You may stop using the Service at any time. We may suspend or terminate access for
            unpaid balances, abuse, or violation of these Terms. On termination, queued snipes may
            be cancelled and credentials removed from our servers.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-100 mb-2">9. Privacy</h2>
          <p>
            Our data practices are described in the{" "}
            <Link href="/privacy" className="text-emerald-400 hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-100 mb-2">10. Changes</h2>
          <p>
            We may update these Terms by posting a new version on this page. Continued use after
            changes constitutes acceptance.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-100 mb-2">11. Contact</h2>
          <p>
            Questions about these Terms: use the email associated with your SGW Arb account or the
            contact method listed on the site.
          </p>
        </section>
      </div>

      <p className="mt-12 text-xs text-zinc-600">
        This is a draft for product launch — have it reviewed by counsel before broad public
        signup.{" "}
        <Link href="/" className="text-emerald-400 hover:underline">
          Back home
        </Link>
      </p>
    </div>
  );
}
