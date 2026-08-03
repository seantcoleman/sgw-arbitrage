"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getScanStatus, triggerScan } from "@/lib/api";

export function Nav() {
  const path = usePathname();
  const [scanRunning, setScanRunning] = useState(false);

  useEffect(() => {
    const poll = async () => {
      const scan = await getScanStatus().catch(() => ({ running: false }));
      setScanRunning(scan.running);
    };
    poll();
    const interval = setInterval(poll, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleScan = async () => {
    await triggerScan();
    setScanRunning(true);
  };

  const navLink = (href: string, label: string) => (
    <Link
      href={href}
      className={`text-sm font-medium transition-colors ${
        path === href ? "text-white" : "text-zinc-400 hover:text-zinc-200"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <nav className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-emerald-600 rounded text-xs font-bold flex items-center justify-center">$</div>
          <span className="font-semibold text-sm">SGW Arbitrage</span>
        </div>
        <div className="flex items-center gap-4">
          {navLink("/", "Deals")}
          {navLink("/watchlist", "Watchlist")}
          {navLink("/settings", "Settings")}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {scanRunning && (
          <span className="flex items-center gap-1.5 text-xs text-yellow-400">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
            Scanning...
          </span>
        )}
        <button
          onClick={handleScan}
          disabled={scanRunning}
          className="bg-emerald-700 hover:bg-emerald-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-xs px-3 py-1.5 rounded-md font-medium transition-colors"
        >
          {scanRunning ? "Running..." : "Scan Now"}
        </button>
      </div>
    </nav>
  );
}
