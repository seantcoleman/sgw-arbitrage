"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getScanStatus, getSniperStatus, startSniper, stopSniper, triggerScan } from "@/lib/api";

export function Nav() {
  const path = usePathname();
  const [scanRunning, setScanRunning] = useState(false);
  const [sniperRunning, setSniperRunning] = useState(false);

  useEffect(() => {
    const poll = async () => {
      const [scan, sniper] = await Promise.all([
        getScanStatus().catch(() => ({ running: false })),
        getSniperStatus().catch(() => ({ running: false })),
      ]);
      setScanRunning(scan.running);
      setSniperRunning(sniper.running);
    };
    poll();
    const interval = setInterval(poll, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleScan = async () => {
    await triggerScan();
    setScanRunning(true);
  };

  const handleSniper = async () => {
    if (sniperRunning) {
      await stopSniper();
      setSniperRunning(false);
    } else {
      await startSniper();
      setSniperRunning(true);
    }
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
        {/* Sniper toggle */}
        <button
          onClick={handleSniper}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
            sniperRunning
              ? "bg-emerald-900 text-emerald-300 border border-emerald-700"
              : "bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600"
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${sniperRunning ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"}`} />
          {sniperRunning ? "Sniper ON" : "Sniper OFF"}
        </button>

        {/* Scan button */}
        <button
          onClick={handleScan}
          disabled={scanRunning}
          className="bg-emerald-700 hover:bg-emerald-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-xs px-3 py-1.5 rounded-md font-medium transition-colors"
        >
          {scanRunning ? "Scanning..." : "Scan Now"}
        </button>
      </div>
    </nav>
  );
}
