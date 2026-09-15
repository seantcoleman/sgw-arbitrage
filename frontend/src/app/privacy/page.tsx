import Link from "next/link";

export const metadata = {
  title: "Privacy Policy · SGW Arb",
};

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-black text-zinc-100 tracking-tight mb-2">Privacy Policy</h1>
      <p className="text-sm text-zinc-500 mb-10">Last updated: September 15, 2026</p>

      <div className="space-y-8 text-sm leading-relaxed text-zinc-400">
        <section>
          <h2 className="text-base font-semibold text-zinc-100 mb-2">1. What we collect</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong className="text-zinc-200">Account:</strong> email address and authentication
              data via Supabase Auth.
            </li>
            <li>
              <strong className="text-zinc-200">ShopGoodwill credentials:</strong> username and
              password, stored encrypted (AES-256-GCM) on our bidding server. We do not display
              your password after save.
            </li>
            <li>
              <strong className="text-zinc-200">App data:</strong> watchlist items, max bids, deal
              scans, sniper activity logs, and auction outcomes.
            </li>
            <li>
              <strong className="text-zinc-200">Billing:</strong> Stripe customer ID and payment
              method references. We never store full card numbers — Stripe does.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-100 mb-2">2. How we use data</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Operate the sniper and deal scanner</li>
            <li>Place bids you schedule and check win/loss results</li>
            <li>Charge success fees or subscriptions</li>
            <li>Provide support and prevent abuse</li>
          </ul>
          <p className="mt-3">
            We do not sell your personal data. We do not use ShopGoodwill credentials for any
            purpose other than bidding and outcome checks you authorize by using the Service.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-100 mb-2">3. Processors</h2>
          <p>We rely on:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Supabase — authentication and database</li>
            <li>Vercel — frontend hosting</li>
            <li>Oracle Cloud — bidding/API servers</li>
            <li>Stripe — payments</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-100 mb-2">4. Retention</h2>
          <p>
            Account and billing records are kept while your account is active and as needed for
            accounting, fraud prevention, and legal compliance. Encrypted ShopGoodwill credentials
            are deleted when you disconnect them or delete your account. You may request account
            deletion by contacting us with the email on your account.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-100 mb-2">5. Security</h2>
          <p>
            Credentials are encrypted at rest with a key held only on the bidding server. Access
            to production systems is restricted. No method of transmission or storage is 100%
            secure.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-100 mb-2">6. Cookies</h2>
          <p>
            We use session cookies for authentication (Supabase). We do not use third-party
            advertising trackers on the app.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-100 mb-2">7. Changes</h2>
          <p>
            We may update this policy by posting a new version here. Material changes will be
            noted by updating the date above.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-100 mb-2">8. Contact</h2>
          <p>
            Privacy questions: use the email on your SGW Arb account. See also our{" "}
            <Link href="/terms" className="text-emerald-400 hover:underline">
              Terms of Service
            </Link>
            .
          </p>
        </section>
      </div>

      <p className="mt-12 text-xs text-zinc-600">
        <Link href="/" className="text-emerald-400 hover:underline">
          Back home
        </Link>
      </p>
    </div>
  );
}
