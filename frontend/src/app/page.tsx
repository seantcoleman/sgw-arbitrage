"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { addToWatchlist, Deal, getDeals, getScanStatus, triggerScan } from "@/lib/api";
import { DealCard } from "@/components/DealCard";

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [minProfit, setMinProfit] = useState(0);
  const [minMargin, setMinMargin] = useState(0);
  const [watchingId, setWatchingId] = useState<number | null>(null);
  const [maxBidInput, setMaxBidInput] = useState<Record<number, string>>({});
  const [error, setError] = useState("");
  const [scanRunning, setScanRunning] = useState(false);
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);
  const firstLoad = useRef(true);

  const fetchDeals = async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const data = await getDeals({ min_profit: minProfit || 0, min_margin: minMargin || 0 });
      setDeals(data.deals);
    } catch {
      setError("Cannot reach backend — make sure it's running on port 8000.");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      fetchDeals();
    }
  }, []);

  useEffect(() => {
    fetchDeals();
  }, [minProfit, minMargin]);

  useEffect(() => {
    const poll = async () => {
      const scan = await getScanStatus().catch(() => ({ running: false, recent_scans: [] }));
      const wasRunning = scanRunning;
      setScanRunning(scan.running);
      const scans = (scan as { recent_scans?: { finished_at?: string }[] }).recent_scans;
      if (scans?.length) setLastScanTime(scans[0].finished_at ?? null);
      if (wasRunning && !scan.running) fetchDeals(true);
    };
    poll();
    const interval = setInterval(poll, 20000);
    return () => clearInterval(interval);
  }, [scanRunning]);

  const handleWatch = async (deal: Deal) => {
    const maxBid = parseFloat(maxBidInput[deal.item_id] ?? "0");
    if (!maxBid || maxBid <= deal.current_bid) {
      toast.error(`Max bid must be > $${deal.current_bid.toFixed(2)}`);
      return;
    }
    try {
      await addToWatchlist(deal.item_id, maxBid);
      setWatchingId(null);
      toast.success(`Queued! Sniper will bid up to $${maxBid.toFixed(2)}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error adding to watchlist");
    }
  };

  const handleScanNow = async () => {
    try {
      await triggerScan();
      setScanRunning(true);
      toast("Scan started — checking SGW for deals...", { icon: "🔍" });
    } catch {
      toast.error("Failed to start scan");
    }
  };

  const totalProfit = deals.reduce((s, d) => s + d.profit, 0);
  const bestDeal = deals.length ? deals.reduce((best, d) => d.profit > best.profit ? d : best) : null;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-3xl font-black text-white tracking-tight">Deals</h1>
          <button
            onClick={handleScanNow}
            disabled={scanRunning}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-500 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-green-900/30"
          >
            {scanRunning ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Scanning…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Scan Now
              </>
            )}
          </button>
        </div>
        <p className="text-zinc-500 text-sm">
          ShopGoodwill listings with eBay arbitrage potential
          {lastScanTime && (
            <span className="text-zinc-600"> · last scan {new Date(lastScanTime).toLocaleTimeString()}</span>
          )}
        </p>
      </div>

      {/* Scan running banner */}
      {scanRunning && (
        <div className="flex items-center gap-3 bg-amber-950/30 border border-amber-800/40 text-amber-300 rounded-xl px-4 py-3 mb-5 text-sm">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
          Scanning ShopGoodwill — this takes 1–2 minutes. Page updates automatically.
        </div>
      )}

      {/* Stats + Filters row */}
      {!loading && deals.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {/* Stats pills */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2">
              <span className="text-zinc-500 text-xs">Deals</span>
              <span className="text-white font-bold text-sm">{deals.length}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2">
              <span className="text-zinc-500 text-xs">Potential</span>
              <span className="text-green-400 font-bold text-sm">${totalProfit.toFixed(0)}</span>
            </div>
            {bestDeal && (
              <div className="hidden sm:flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2">
                <span className="text-zinc-500 text-xs">Best</span>
                <span className="text-white font-bold text-sm">+${bestDeal.profit.toFixed(0)}</span>
              </div>
            )}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Filters */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <span className="text-zinc-500 text-xs pl-3">$</span>
              <input
                type="number"
                value={minProfit || ""}
                onChange={e => setMinProfit(Number(e.target.value))}
                placeholder="Min profit"
                className="w-24 bg-transparent py-2 px-2 text-sm text-zinc-100 focus:outline-none placeholder:text-zinc-700"
                min={0}
                step={5}
              />
            </div>
            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <input
                type="number"
                value={minMargin || ""}
                onChange={e => setMinMargin(Number(e.target.value))}
                placeholder="Min ROI %"
                className="w-24 bg-transparent py-2 px-3 text-sm text-zinc-100 focus:outline-none placeholder:text-zinc-700"
                min={0}
                max={100}
                step={10}
              />
              <span className="text-zinc-500 text-xs pr-3">%</span>
            </div>
            {(minProfit > 0 || minMargin > 0) && (
              <button
                onClick={() => { setMinProfit(0); setMinMargin(0); }}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-950/50 border border-red-800/50 text-red-300 rounded-xl p-4 mb-6 text-sm flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden animate-pulse">
              <div className="h-48 bg-zinc-800" />
              <div className="p-4 space-y-3">
                <div className="h-4 bg-zinc-800 rounded-lg w-3/4" />
                <div className="h-3 bg-zinc-800 rounded-lg w-1/4" />
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="h-16 bg-zinc-800 rounded-xl" />
                  <div className="h-16 bg-zinc-800 rounded-xl" />
                </div>
                <div className="h-10 bg-zinc-800 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : deals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-40 text-center">
          <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-zinc-300 mb-1">No deals yet</h2>
          <p className="text-sm text-zinc-600 max-w-xs mb-5">
            Scan ShopGoodwill to find items priced below eBay resale value.
          </p>
          <button
            onClick={handleScanNow}
            disabled={scanRunning}
            className="bg-green-600 hover:bg-green-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors"
          >
            {scanRunning ? "Scanning…" : "Run First Scan"}
          </button>
          <p className="text-xs text-zinc-700 mt-3">
            Configure search keywords in Settings first
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {deals.map(deal => (
            <DealCard
              key={deal.item_id}
              deal={deal}
              isWatching={watchingId === deal.item_id}
              maxBid={maxBidInput[deal.item_id] ?? ""}
              onMaxBidChange={v => setMaxBidInput(prev => ({ ...prev, [deal.item_id]: v }))}
              onWatchClick={() => setWatchingId(watchingId === deal.item_id ? null : deal.item_id)}
              onConfirmWatch={() => handleWatch(deal)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
