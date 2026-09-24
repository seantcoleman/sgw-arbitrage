"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { getMe, MeResponse } from "@/lib/api";
import { authConfigured, createClient } from "@/lib/supabase/client";

async function startCheckout(mode: "setup" | "subscription") {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    window.location.href = `/login?next=${encodeURIComponent("/pricing")}`;
    return;
  }
  const res = await fetch("/api/stripe/checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ mode }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || body.detail || "Checkout failed");
  if (body.url) window.location.href = body.url;
  else throw new Error("No checkout URL returned");
}

export default function PricingPage() {
  const [loading, setLoading] = useState<"setup" | "subscription" | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const signedIn = authConfigured();

  useEffect(() => {
    if (!signedIn) return;
    getMe()
      .then(setMe)
      .catch(() => setMe(null));
  }, [signedIn]);

  const billing = me?.billing;
  const isPro =
    billing?.plan === "pro" &&
    ["active", "trialing"].includes(billing.stripe_subscription_status || "");
  const hasCard = Boolean(billing?.has_payment_method);

  const onClick = async (mode: "setup" | "subscription") => {
    if (!signedIn) {
      window.location.href = `/signup`;
      return;
    }
    setLoading(mode);
    try {
      await startCheckout(mode);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Checkout failed");
      setLoading(null);
    }
  };

  return (
    <div className="-mt-2">
      <section className="py-12 sm:py-16 text-center">
        <p className="text-xs font-medium uppercase tracking-wider text-emerald-400">
          Pricing
        </p>
        <h1 className="mt-3 text-3xl sm:text-5xl font-black tracking-tight text-zinc-100">
          Pay only when you win.
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-sm sm:text-base text-zinc-500">
          No upfront cost on Standard. A small success fee only when you win — or go Pro
          and keep 0% commission.
        </p>
        {signedIn && billing && (
          <p className="mx-auto mt-4 max-w-lg text-sm text-zinc-400">
            {isPro ? (
              <>
                You&apos;re on <span className="text-emerald-400 font-medium">Pro</span>.{" "}
                <Link
                  href="/account"
                  className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
                >
                  Manage billing
                </Link>
              </>
            ) : hasCard ? (
              <>
                You&apos;re on <span className="text-zinc-200 font-medium">Standard</span> with a
                card on file.{" "}
                <Link
                  href="/account"
                  className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
                >
                  Account
                </Link>
              </>
            ) : (
              <>
                Save a card to start sniping, or upgrade to Pro.{" "}
                <Link
                  href="/account"
                  className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
                >
                  Account
                </Link>
              </>
            )}
          </p>
        )}
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto pb-16">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 sm:p-8 flex flex-col">
          <h2 className="text-xl font-bold text-zinc-100">Standard</h2>
          <p className="mt-1 text-sm text-zinc-500">2% success fee · No monthly fee</p>
          <p className="mt-6 text-4xl font-black text-zinc-100">
            2%
            <span className="text-base font-medium text-zinc-500"> / win</span>
          </p>
          <ul className="mt-6 space-y-2 text-sm text-zinc-400 flex-1">
            <li>✓ Pay only when you win</li>
            <li>✓ Unlimited auction snipes</li>
            <li>✓ eBay Value Lookup</li>
            <li>✓ Add from ShopGoodwill Favorites</li>
            <li>✓ Automatic last-second bids</li>
            <li>✓ No win, no charge</li>
          </ul>
          <button
            type="button"
            disabled={loading !== null || (hasCard && !isPro)}
            onClick={() => onClick("setup")}
            className="mt-8 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-semibold text-zinc-100 hover:border-zinc-500 disabled:opacity-50"
          >
            {hasCard && !isPro
              ? "Card already on file"
              : loading === "setup"
                ? "Redirecting…"
                : "Save card & start sniping"}
          </button>
        </div>

        <div className="rounded-2xl border border-emerald-700/60 bg-zinc-900 p-6 sm:p-8 flex flex-col relative shadow-lg shadow-emerald-950/40">
          <span className="absolute -top-3 left-6 rounded-full bg-emerald-600 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            Most popular
          </span>
          <h2 className="text-xl font-bold text-zinc-100">Pro</h2>
          <p className="mt-1 text-sm text-zinc-500">0% success fee · Monthly plan</p>
          <p className="mt-6 text-4xl font-black text-zinc-100">
            $15
            <span className="text-base font-medium text-zinc-500"> / month</span>
          </p>
          <ul className="mt-6 space-y-2 text-sm text-zinc-400 flex-1">
            <li>✓ Win auctions with 0% success fee</li>
            <li>✓ Unlimited auction snipes</li>
            <li>✓ eBay Value Lookup</li>
            <li>✓ Add from ShopGoodwill Favorites</li>
            <li>✓ Automatic last-second bids</li>
            <li>✓ Cancel anytime in billing portal</li>
          </ul>
          <button
            type="button"
            disabled={loading !== null || isPro}
            onClick={() => onClick("subscription")}
            className="mt-8 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {isPro
              ? "Current plan"
              : loading === "subscription"
                ? "Redirecting…"
                : "Upgrade to Pro"}
          </button>
        </div>
      </div>

      <p className="text-center text-xs text-zinc-600 pb-12 max-w-xl mx-auto">
        Unlike some tools that charge per snipe whether you win or lose, we only bill a
        success fee on wins (Standard) or a flat monthly fee with 0% commission (Pro).{" "}
        <Link href="/terms" className="text-zinc-500 hover:text-zinc-300">
          Terms
        </Link>
      </p>
    </div>
  );
}
