"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { authConfigured, createClient } from "@/lib/supabase/client";

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);

  useEffect(() => {
    if (!authConfigured()) return;
    const supabase = createClient();
    // Recovery links land with a session after /auth/callback?next=/reset-password
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setRecoveryMode(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!authConfigured()) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center">
        <Link href="/" className="text-sm text-emerald-400 hover:underline">
          Back →
        </Link>
      </div>
    );
  }

  const onRequestReset = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
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

  const onSetPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated");
      router.replace(params.get("next") || "/account");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12">
      <h1 className="text-3xl font-black text-zinc-100 tracking-tight mb-2">
        {recoveryMode ? "Choose a new password" : "Reset password"}
      </h1>
      <p className="text-sm text-zinc-500 mb-8">
        <Link href="/login" className="text-emerald-400 hover:underline">
          Back to sign in
        </Link>
      </p>

      {recoveryMode ? (
        <form onSubmit={onSetPassword} className="space-y-4">
          <label className="block">
            <span className="text-xs text-zinc-500 font-medium">New password</span>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-zinc-600"
            />
          </label>
          <label className="block">
            <span className="text-xs text-zinc-500 font-medium">Confirm password</span>
            <input
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1 w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-zinc-600"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-xl py-2.5 text-sm"
          >
            {loading ? "Saving…" : "Update password"}
          </button>
        </form>
      ) : sent ? (
        <p className="text-sm text-zinc-300">
          If an account exists for that email, a reset link is on its way.
        </p>
      ) : (
        <form onSubmit={onRequestReset} className="space-y-4">
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="max-w-md mx-auto mt-12 text-sm text-zinc-500">Loading…</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
