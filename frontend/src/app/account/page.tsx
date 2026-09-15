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

export default function AccountPage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
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

  const account = me?.sgw_accounts?.[0];

  return (
    <div className="max-w-xl">
      <h1 className="text-3xl font-black text-zinc-100 tracking-tight mb-1">Account</h1>
      <p className="text-sm text-zinc-500 mb-8">
        {email || me?.email || "Signed in"} · manage ShopGoodwill bidding credentials
      </p>

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
