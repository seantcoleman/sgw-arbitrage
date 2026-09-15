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
    setLoading(true);
    try {
      const supabase = createClient();
      const origin = window.location.origin;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${origin}/auth/callback` },
      });
      if (error) throw error;
      if (data.session) {
        toast.success("Account created");
        router.replace("/deals");
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
        <p className="text-xs text-zinc-600">
          By signing up you agree we may store and use your ShopGoodwill credentials solely to place
          bids you schedule.
        </p>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors"
        >
          {loading ? "Creating…" : "Create account"}
        </button>
      </form>
    </div>
  );
}
