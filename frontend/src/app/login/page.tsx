"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import toast from "react-hot-toast";
import { authConfigured, createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/deals";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  if (!authConfigured()) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center space-y-3">
        <h1 className="text-2xl font-black text-zinc-100">Auth not configured</h1>
        <p className="text-sm text-zinc-500">
          Set <code className="text-zinc-300">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code className="text-zinc-300">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to enable sign-in.
        </p>
        <Link href="/deals" className="text-sm text-emerald-400 hover:underline">
          Continue without auth →
        </Link>
      </div>
    );
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Signed in");
      router.replace(next);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12">
      <h1 className="text-3xl font-black text-zinc-100 tracking-tight mb-2">Sign in</h1>
      <p className="text-sm text-zinc-500 mb-8">
        New here?{" "}
        <Link href="/signup" className="text-emerald-400 hover:underline">
          Create an account
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
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-zinc-600"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-6 text-center text-xs text-zinc-600">
        <Link href="/reset-password" className="hover:text-zinc-400">
          Forgot password?
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
