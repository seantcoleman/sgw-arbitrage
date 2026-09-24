"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  connectSgwAccount,
  getMe,
  MeResponse,
  verifySgwAccount,
} from "@/lib/api";
import { authConfigured, createClient } from "@/lib/supabase/client";

async function openPortal() {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in");
  const res = await fetch("/api/stripe/portal", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "Could not open billing portal");
  if (body.url) window.location.href = body.url;
}

export default function AccountPage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [booting, setBooting] = useState(true);

  const refresh = async () => {
    try {
      const data = await getMe();
      setMe(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    (async () => {
      if (authConfigured()) {
        try {
          const supabase = createClient();
          const { data } = await supabase.auth.getUser();
          setEmail(data.user?.email ?? null);
        } catch {
          /* ignore */
        }
      }
      await refresh();
      setBooting(false);
    })();
  }, []);

  const connect = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await connectSgwAccount(username, password);
      setPassword("");
      toast.success("ShopGoodwill connected");
      await refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Connect failed");
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    if (!authConfigured()) return;
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  if (booting) {
    return <div className="animate-pulse h-40 bg-zinc-900 rounded-2xl max-w-xl" />;
  }

  const account = me?.sgw_accounts?.find((a) => a.auth_source === "user") || me?.sgw_accounts?.[0];
  const billing = me?.billing;
  const isPro =
    billing?.plan === "pro" &&
    ["active", "trialing"].includes(billing.stripe_subscription_status || "");
  const hasCard = Boolean(billing?.has_payment_method);

  return (
    <div className="max-w-xl">
      <h1 className="text-3xl font-black text-zinc-100 tracking-tight mb-1">Account</h1>
      <p className="text-sm text-zinc-500 mb-8">
        {email || me?.email || "Signed in"} · billing & ShopGoodwill credentials
      </p>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl mb-4 overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-100">Billing</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Pay only when you win — or go Pro for 0%.</p>
        </div>
        <div className="px-5 py-4 space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-zinc-200 font-medium">
                {isPro ? "Pro" : "Standard"}
              </div>
              <div className="text-xs text-zinc-500 mt-0.5">
                {isPro
                  ? "0% success fee · monthly subscription"
                  : "2% success fee on each win · no monthly fee"}
              </div>
              {billing?.billing_blocked && (
                <div className="text-xs text-red-400 mt-1">
                  New snipes blocked — update your payment method
                </div>
              )}
              {!billing?.can_snipe && !billing?.billing_blocked && (
                <div className="text-xs text-amber-400 mt-1">
                  {billing?.can_snipe_reason || "Save a card or upgrade to Pro to queue snipes"}
                </div>
              )}
              {billing?.has_payment_method && !isPro && (
                <div className="text-xs text-emerald-500/80 mt-1">Card on file for success fees</div>
              )}
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <Link
                href="/pricing"
                className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold text-center hover:bg-emerald-500"
              >
                {isPro ? "Change plan" : hasCard ? "View plans" : "Set up billing"}
              </Link>
              <button
                type="button"
                disabled={portalLoading}
                onClick={async () => {
                  setPortalLoading(true);
                  try {
                    await openPortal();
                  } catch (err: unknown) {
                    toast.error(err instanceof Error ? err.message : "Portal failed");
                    setPortalLoading(false);
                  }
                }}
                className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:text-zinc-100 disabled:opacity-50"
              >
                {portalLoading ? "Opening…" : "Manage billing"}
              </button>
            </div>
          </div>

          {(me?.win_fees?.length ?? 0) > 0 && (
            <div className="pt-3 border-t border-zinc-800">
              <div className="text-xs font-medium text-zinc-400 mb-2">Recent success fees</div>
              <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                {me!.win_fees!.slice(0, 10).map((f) => (
                  <li
                    key={f.id}
                    className="flex justify-between gap-2 text-xs text-zinc-500"
                  >
                    <span>
                      Item {f.item_id} · hammer ${(f.hammer_cents / 100).toFixed(2)}
                    </span>
                    <span className="text-zinc-300">
                      ${(f.fee_cents / 100).toFixed(2)}{" "}
                      <span className="text-zinc-600">{f.status}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl mb-4 overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-100">ShopGoodwill login</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Stored encrypted on the sniper server. Never sent to the browser after save.
          </p>
        </div>
        <div className="px-5 py-4 space-y-4">
          {account ? (
            <div className="flex items-center justify-between gap-3 text-sm">
              <div>
                <div className="text-zinc-200 font-medium">{account.label}</div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  Status:{" "}
                  <span
                    className={
                      account.status === "active" ? "text-emerald-400" : "text-amber-400"
                    }
                  >
                    {account.status}
                  </span>
                  {account.last_verified_at
                    ? ` · verified ${new Date(account.last_verified_at).toLocaleString()}`
                    : ""}
                </div>
                {account.last_error && (
                  <div className="text-xs text-red-400 mt-1">{account.last_error}</div>
                )}
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await verifySgwAccount(account.id);
                    toast.success("Still valid");
                    await refresh();
                  } catch (err: unknown) {
                    toast.error(err instanceof Error ? err.message : "Verify failed");
                    await refresh();
                  }
                }}
                className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:text-zinc-100"
              >
                Re-check
              </button>
            </div>
          ) : (
            <p className="text-sm text-amber-400/90">
              Connect SGW before adding watchlist snipes.{" "}
              <Link href="/watchlist" className="underline">
                Watchlist
              </Link>
            </p>
          )}

          <form onSubmit={connect} className="space-y-3 pt-2 border-t border-zinc-800">
            <p className="text-xs text-zinc-500">
              {account ? "Update credentials" : "Add credentials"}
            </p>
            <input
              type="text"
              required
              autoComplete="username"
              placeholder="ShopGoodwill username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100"
            />
            <input
              type="password"
              required
              autoComplete="current-password"
              placeholder="ShopGoodwill password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl px-4 py-2"
            >
              {loading ? "Testing login…" : account ? "Update & verify" : "Connect account"}
            </button>
          </form>
        </div>
      </div>

      <p className="text-xs text-zinc-600 mb-4">
        <Link href="/terms" className="hover:text-zinc-400">
          Terms
        </Link>
        {" · "}
        <Link href="/privacy" className="hover:text-zinc-400">
          Privacy
        </Link>
      </p>

      {authConfigured() && (
        <button
          type="button"
          onClick={signOut}
          className="text-sm text-zinc-500 hover:text-zinc-300"
        >
          Sign out
        </button>
      )}
    </div>
  );
}
