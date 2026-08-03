"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { getSniperStatus, getWatchlist, removeFromWatchlist, startSniper, stopSniper, WatchlistItem } from "@/lib/api";

function parseEndTime(endTime: string): Date {
  if (endTime.endsWith("Z") || endTime.includes("+")) {
    return new Date(endTime);
  }
  return new Date(endTime + "-08:00");
}

function countdown(endTime: string | null): string {
  if (!endTime) return "—";
  const diff = parseEndTime(endTime).getTime() - Date.now();
  if (diff < 0) return "Ended";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return `${h}h ${m}m ${s}s`;
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-900 text-blue-300",
  bid_placed: "bg-emerald-900 text-emerald-300",
  won: "bg-green-900 text-green-300",
  lost: "bg-zinc-800 text-zinc-400",
  error: "bg-red-900 text-red-300",
};

export default function WatchlistPage() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [sniperRunning, setSniperRunning] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const load = async () => {
      const [wl, sniper] = await Promise.all([
        getWatchlist().catch(() => ({ watchlist: [] })),
        getSniperStatus().catch(() => ({ running: false })),
      ]);
      setWatchlist(wl.watchlist);
      setSniperRunning(sniper.running);
    };
    load();
    const tickInterval = setInterval(() => setTick(t => t + 1), 1000);
    const pollInterval = setInterval(load, 15000);
    return () => { clearInterval(tickInterval); clearInterval(pollInterval); };
  }, []);

  // suppress unused-variable lint; tick drives countdown re-renders
  void tick;

  const handleRemove = async (item_id: number) => {
    await removeFromWatchlist(item_id);
    setWatchlist(prev => prev.filter(i => i.item_id !== item_id));
    toast.success("Removed from watchlist");
  };

  const handleSniper = async () => {
    try {
      if (sniperRunning) {
        await stopSniper();
        setSniperRunning(false);
        toast("Sniper stopped");
      } else {
        await startSniper();
        setSniperRunning(true);
        toast.success("Sniper started — watching favorites for bids");
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to toggle sniper");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Watchlist</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{watchlist.length} items queued for sniping</p>
        </div>
        <button
          onClick={handleSniper}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            sniperRunning
              ? "bg-red-900 hover:bg-red-800 text-red-200 border border-red-700"
              : "bg-emerald-800 hover:bg-emerald-700 text-emerald-200 border border-emerald-600"
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${sniperRunning ? "bg-red-400 animate-pulse" : "bg-emerald-500"}`} />
          {sniperRunning ? "Stop Sniper" : "Start Sniper"}
        </button>
      </div>

      {watchlist.length === 0 ? (
        <div className="text-center py-24 text-zinc-600">
          <div className="text-5xl mb-4">🎯</div>
          <div className="text-lg font-medium">No items in watchlist</div>
          <div className="text-sm mt-2">Go to the Deals feed and click "+ Add to Sniper" on an item</div>
        </div>
      ) : (
        <div className="space-y-3">
          {watchlist.map(item => (
            <div
              key={item.item_id}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-4"
            >
              {item.image_url && (
                <img
                  src={item.image_url}
                  alt={item.title}
                  className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <a
                  href={item.sgw_url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-sm text-zinc-100 hover:text-white line-clamp-1"
                >
                  {item.title}
                </a>
                <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                  <span>Current: ${item.current_bid?.toFixed(2) ?? "—"}</span>
                  <span>eBay: ${item.ebay_median?.toFixed(2) ?? "—"}</span>
                  {item.profit && <span className="text-emerald-400">+${item.profit.toFixed(2)} est.</span>}
                </div>
              </div>

              {/* Countdown */}
              <div className="text-center flex-shrink-0">
                <div className="text-sm font-mono font-bold text-zinc-200">{countdown(item.end_time)}</div>
                <div className="text-xs text-zinc-600 mt-0.5">remaining</div>
              </div>

              {/* Max bid */}
              <div className="text-center flex-shrink-0">
                <div className="text-sm font-bold text-emerald-400">${item.max_bid.toFixed(2)}</div>
                <div className="text-xs text-zinc-600 mt-0.5">max bid</div>
              </div>

              {/* Status */}
              <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${STATUS_COLORS[item.sniper_status] ?? STATUS_COLORS.scheduled}`}>
                {item.sniper_status}
              </span>

              {/* Remove */}
              <button
                onClick={() => handleRemove(item.item_id)}
                className="text-zinc-600 hover:text-zinc-400 transition-colors flex-shrink-0"
                title="Remove from watchlist"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
