"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import toast from "react-hot-toast";
import { authConfigured, createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTos, setAcceptedTos] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!authConfigured()) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center space-y-3">
        <h1 className="text-2xl font-black text-zinc-100">Auth not configured</h1>
        <Link href="/deals" className="text-sm text-emerald-400 hover:underline">
          Back to app →
        </Link>
      </div>
    );
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!acceptedTos) {
      toast.error("Please accept the Terms of Service");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const origin = window.location.origin;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${origin}/auth/callback`,
          data: { tos_accepted: true, tos_accepted_at: new Date().toISOString() },
        },
      });
      if (error) throw error;

      // Best-effort: stamp tos_accepted_at on profile via backend when session exists
      if (data.session) {
        try {
          await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "/backend"}/me/tos`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${data.session.access_token}`,
            },
            body: JSON.stringify({ accepted: true }),
          });
        } catch {
          /* profile trigger still creates the row; tos stamped on next /me */
        }
        toast.success("Account created");
        router.replace("/pricing");
        router.refresh();
      } else {
        toast.success("Check your email to confirm your account");
        router.replace("/login");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12">
      <h1 className="text-3xl font-black text-zinc-100 tracking-tight mb-2">Create account</h1>
      <p className="text-sm text-zinc-500 mb-8">
        Already have one?{" "}
        <Link href="/login" className="text-emerald-400 hover:underline">
          Sign in
        </Link>
      </p>
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
        <label className="block">
          <span className="text-xs text-zinc-500 font-medium">Password</span>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-zinc-600"
          />
        </label>
        <label className="flex items-start gap-3 text-xs text-zinc-500 cursor-pointer">
          <input
            type="checkbox"
            checked={acceptedTos}
            onChange={(e) => setAcceptedTos(e.target.checked)}
            className="mt-0.5 rounded border-zinc-700 bg-zinc-900"
            required
          />
          <span>
            I agree to the{" "}
            <Link href="/terms" className="text-emerald-400 hover:underline" target="_blank">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-emerald-400 hover:underline" target="_blank">
              Privacy Policy
            </Link>
            . I understand ShopGoodwill credentials are stored encrypted on the bidding server to
            place bids I schedule.
          </span>
        </label>
        <button
          type="submit"
          disabled={loading || !acceptedTos}
          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors"
        >
          {loading ? "Creating…" : "Create account"}
        </button>
      </form>
    </div>
  );
}
