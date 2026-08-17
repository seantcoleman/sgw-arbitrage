"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { getScanStatus, triggerScan } from "@/lib/api";

export function Nav() {
  const path = usePathname();
  const [scanRunning, setScanRunning] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);

  useEffect(() => {
    const poll = async () => {
      const scan = await getScanStatus().catch(() => ({ running: false, recent_scans: [] }));
      setScanRunning(scan.running);
      const scans = (scan as { recent_scans?: { finished_at?: string }[] }).recent_scans;
      if (scans?.length) setLastScan(scans[0].finished_at ?? null);
    };
    poll();
    const interval = setInterval(poll, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleScan = async () => {
    try {
      await triggerScan();
      setScanRunning(true);
      toast("Scanning ShopGoodwill…", { icon: "🔍" });
    } catch {
      toast.error("Failed to start scan");
    }
  };

  function minutesAgo(ts: string | null) {
    if (!ts) return null;
    const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
    if (diff < 1) return "just now";
    if (diff < 60) return `${diff}m ago`;
    return `${Math.floor(diff / 60)}h ago`;
  }

  const links = [
    { href: "/", label: "Deals" },
    { href: "/favorites", label: "Favorites" },
    { href: "/watchlist", label: "Watchlist" },
    { href: "/settings", label: "Settings" },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-zinc-800/80 bg-zinc-950/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-6">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-md shadow-green-900/50">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="font-bold text-sm text-white">SGW Arb</span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {links.map(({ href, label }) => {
            const active = path === href;
            return (
              <Link
                key={href}
                href={href}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>

        {/* Right */}
        <div className="ml-auto flex items-center gap-3">
          {lastScan && (
            <span className="hidden md:block text-xs text-zinc-600">
              scanned {minutesAgo(lastScan)}
            </span>
          )}
          {scanRunning && (
            <span className="flex items-center gap-1.5 text-xs text-amber-400">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Scanning
            </span>
          )}
          <button
            onClick={handleScan}
            disabled={scanRunning}
            className="flex items-center gap-1.5 bg-green-700 hover:bg-green-600 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-white text-xs px-3.5 py-2 rounded-lg font-semibold transition-all"
          >
            {scanRunning ? (
              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            {scanRunning ? "Scanning" : "Scan"}
          </button>
        </div>
      </div>
    </nav>
  );
}
