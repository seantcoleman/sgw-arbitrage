"use client";

import { useEffect, useState } from "react";
import { addToWatchlist, Deal, getDeals } from "@/lib/api";
import { DealCard } from "@/components/DealCard";

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [minProfit, setMinProfit] = useState(0);
  const [minMargin, setMinMargin] = useState(0);
  const [watchingId, setWatchingId] = useState<number | null>(null);
  const [maxBidInput, setMaxBidInput] = useState<Record<number, string>>({});
  const [error, setError] = useState("");

  const fetchDeals = async () => {
    setLoading(true);
    try {
      const data = await getDeals({ min_profit: minProfit, min_margin: minMargin });
      setDeals(data.deals);
    } catch {
      setError("Could not connect to backend. Is the API running on port 8000?");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDeals(); }, [minProfit, minMargin]);

  const handleWatch = async (deal: Deal) => {
    const maxBid = parseFloat(maxBidInput[deal.item_id] ?? "0");
    if (!maxBid || maxBid <= deal.current_bid) {
      alert(`Max bid must be greater than current bid ($${deal.current_bid.toFixed(2)})`);
      return;
    }
    try {
      await addToWatchlist(deal.item_id, maxBid);
      setWatchingId(null);
      alert(`Added to watchlist! Sniper will bid up to $${maxBid.toFixed(2)}`);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Error adding to watchlist");
    }
  };

  const totalProfit = deals.reduce((s, d) => s + d.profit, 0);
  const avgMargin = deals.length ? deals.reduce((s, d) => s + d.margin, 0) / deals.length : 0;

  return (
    <div>
      {/* Stats */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Deal Feed</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {deals.length} deals found — avg margin {(avgMargin * 100).toFixed(0)}%
          </p>
        </div>
        <div className="flex gap-6 text-right">
          <div>
            <div className="text-2xl font-bold text-emerald-400">{deals.length}</div>
            <div className="text-xs text-zinc-500">Active Deals</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-400">${totalProfit.toFixed(0)}</div>
            <div className="text-xs text-zinc-500">Total Potential Profit</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6 p-4 bg-zinc-900 rounded-xl border border-zinc-800">
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-400 whitespace-nowrap">Min Profit</label>
          <div className="flex items-center gap-1">
            <span className="text-zinc-500 text-sm">$</span>
            <input
              type="number"
              value={minProfit}
              onChange={e => setMinProfit(Number(e.target.value))}
              className="w-20 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
              min={0}
              step={5}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-400 whitespace-nowrap">Min Margin</label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={minMargin}
              onChange={e => setMinMargin(Number(e.target.value))}
              className="w-20 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
              min={0}
              max={100}
              step={5}
            />
            <span className="text-zinc-500 text-sm">%</span>
          </div>
        </div>
        <button
          onClick={fetchDeals}
          className="ml-auto text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 px-3 py-1.5 rounded transition-colors"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-950 border border-red-800 text-red-300 rounded-xl p-4 mb-6 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-zinc-500 text-sm">Loading deals...</div>
      ) : deals.length === 0 ? (
        <div className="text-center py-24 text-zinc-600">
          <div className="text-5xl mb-4">🔍</div>
          <div className="text-lg font-medium">No deals yet</div>
          <div className="text-sm mt-2">Click "Scan Now" in the top bar to find deals</div>
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
