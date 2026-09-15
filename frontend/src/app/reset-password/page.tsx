"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import toast from "react-hot-toast";
import { authConfigured, createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!authConfigured()) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center">
        <Link href="/" className="text-sm text-emerald-400 hover:underline">
          Back →
        </Link>
      </div>
    );
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/account`,
      });
      if (error) throw error;
      setSent(true);
      toast.success("Reset email sent");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not send reset email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12">
      <h1 className="text-3xl font-black text-zinc-100 tracking-tight mb-2">Reset password</h1>
      <p className="text-sm text-zinc-500 mb-8">
        <Link href="/login" className="text-emerald-400 hover:underline">
          Back to sign in
        </Link>
      </p>
      {sent ? (
        <p className="text-sm text-zinc-300">
          If an account exists for that email, a reset link is on its way.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="text-xs text-zinc-500 font-medium">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-zinc-600"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-xl py-2.5 text-sm"
          >
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
    </div>
  );
}
