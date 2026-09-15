"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getScanStatus } from "@/lib/api";
import { useTheme } from "@/components/ThemeProvider";
import { authConfigured, createClient } from "@/lib/supabase/client";

export function Nav() {
  const path = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [scanRunning, setScanRunning] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const poll = async () => {
      const scan = await getScanStatus().catch(() => ({ running: false }));
      setScanRunning(scan.running);
    };
    poll();
    const interval = setInterval(poll, 8000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setUserMenuOpen(false);
  }, [path]);

  useEffect(() => {
    if (!authConfigured()) return;
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (!cancelled) setEmail(data.user?.email ?? null);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [path]);

  useEffect(() => {
    if (!userMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!userMenuRef.current?.contains(e.target as Node)) setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [userMenuOpen]);

  const signOut = async () => {
    if (!authConfigured()) return;
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const links = [
    { href: "/", label: "Deals" },
    { href: "/favorites", label: "Favorites" },
    { href: "/watchlist", label: "Watchlist" },
    { href: "/settings", label: "Settings" },
  ];

  const linkClass = (href: string) => {
    const active = path === href;
    return `px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
      active
        ? "bg-zinc-800 text-zinc-100"
        : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900"
    }`;
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-zinc-800/80 bg-zinc-950/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 flex items-center gap-2 sm:gap-4 min-w-0">
        <Link href="/" className="flex items-center gap-2 shrink-0" onClick={() => setMenuOpen(false)}>
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-md shadow-green-900/50">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="hidden sm:inline font-bold text-sm text-zinc-100">SGW Arb</span>
        </Link>

        <div className="hidden md:flex items-center gap-1 min-w-0">
          {links.map(({ href, label }) => (
            <Link key={href} href={href} className={linkClass(href)}>
              {label}
            </Link>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-3 shrink-0">
          {scanRunning && (
            <span className="flex items-center gap-1.5 text-xs text-amber-400">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="hidden sm:inline">Scanning</span>
            </span>
          )}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Light mode" : "Dark mode"}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors"
          >
            {theme === "dark" ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1.5M12 19.5V21M4.22 4.22l1.06 1.06M18.72 18.72l1.06 1.06M3 12h1.5M19.5 12H21M4.22 19.78l1.06-1.06M18.72 5.28l1.06-1.06M16.5 12a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
              </svg>
            )}
          </button>

          <div className="relative hidden md:block" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setUserMenuOpen((o) => !o)}
              aria-expanded={userMenuOpen}
              aria-haspopup="menu"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors"
            >
              <span className="w-6 h-6 rounded-full bg-zinc-800 text-zinc-300 flex items-center justify-center text-xs font-semibold">
                {(email?.[0] || "U").toUpperCase()}
              </span>
              <span className="max-w-[9rem] truncate hidden lg:inline">{email || "Account"}</span>
            </button>
            {userMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-1.5 w-48 rounded-xl border border-zinc-800 bg-zinc-950 shadow-xl py-1 z-50"
              >
                <Link
                  href="/account"
                  role="menuitem"
                  className="block px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900"
                  onClick={() => setUserMenuOpen(false)}
                >
                  Account
                </Link>
                {authConfigured() ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={signOut}
                    className="w-full text-left px-3 py-2 text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                  >
                    Sign out
                  </button>
                ) : (
                  <Link
                    href="/login"
                    role="menuitem"
                    className="block px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-900"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    Sign in
                  </Link>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-zinc-800/80 px-3 py-2 flex flex-col gap-1">
          {links.map(({ href, label }) => (
            <Link key={href} href={href} className={`${linkClass(href)} w-full`}>
              {label}
            </Link>
          ))}
          <Link href="/account" className={`${linkClass("/account")} w-full`}>
            Account
          </Link>
          {authConfigured() && (
            <button
              type="button"
              onClick={signOut}
              className="px-3 py-1.5 rounded-lg text-sm text-left text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900"
            >
              Sign out
            </button>
          )}
        </div>
      )}
    </nav>
  );
}
