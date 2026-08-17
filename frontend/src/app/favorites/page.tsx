"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { addToWatchlist, FavoriteItem, getAllFavorites, getFavoritesScanStatus, triggerFavoritesScan } from "@/lib/api";

function parseEndTime(t: string): Date {
  if (t.endsWith("Z") || t.includes("+") || t.includes("-0")) return new Date(t);
  const isDST = new Date().getTimezoneOffset() < new Date(new Date().getFullYear(), 0, 1).getTimezoneOffset();
  return new Date(t + (isDST ? "-07:00" : "-08:00"));
}

function timeUntil(endTime: string | null): { label: string; urgency: "normal" | "soon" | "urgent" } {
  if (!endTime) return { label: "—", urgency: "normal" };
  const diff = parseEndTime(endTime).getTime() - Date.now();
  if (diff < 0) return { label: "Ended", urgency: "urgent" };
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 48) return { label: `${Math.floor(h / 24)}d`, urgency: "normal" };
  if (h > 24) return { label: `${Math.floor(h / 24)}d ${h % 24}h`, urgency: "normal" };
  if (h >= 4) return { label: `${h}h ${m}m`, urgency: "soon" };
  return { label: `${h}h ${m}m`, urgency: "urgent" };
}

function FavCard({ item, onSnipe }: { item: FavoriteItem; onSnipe: (item: FavoriteItem, maxBid: number) => void }) {
  const [maxBid, setMaxBid] = useState("");
  const [sniping, setSniping] = useState(false);
  const { label: timeLabel, urgency } = timeUntil(item.end_time);
  const totalCost = item.current_bid + (item.shipping_est ?? 12);

  const urgencyColor = { normal: "text-zinc-400", soon: "text-amber-400", urgent: "text-red-400" }[urgency];
  const urgencyDot = { normal: "bg-zinc-500", soon: "bg-amber-400", urgent: "bg-red-500 animate-pulse" }[urgency];

  const handleSnipe = () => {
    const bid = parseFloat(maxBid);
    if (!bid || bid <= item.current_bid) {
      toast.error(`Max bid must be > $${item.current_bid.toFixed(2)}`);
      return;
    }
    onSnipe(item, bid);
  };

  return (
    <div className="group bg-zinc-900 border border-zinc-800/80 hover:border-zinc-600 rounded-2xl overflow-hidden flex flex-col transition-all duration-200 hover:shadow-2xl hover:shadow-black/50">
      {/* Image */}
      <div className="relative h-44 bg-zinc-800 overflow-hidden flex-shrink-0">
        {item.image_url ? (
          <>
            <img src={item.image_url} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent opacity-70" />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center opacity-20 text-4xl">📦</div>
        )}
        {/* Time badge */}
        <div className={`absolute top-3 left-3 flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 ${urgencyColor}`}>
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${urgencyDot}`} />
          {timeLabel}
        </div>
        {/* Status badge */}
        {item.is_deal && item.profit != null ? (
          <div className="absolute top-3 right-3 text-[11px] font-bold px-2.5 py-1 rounded-full border bg-green-500/10 text-green-400 border-green-500/30 backdrop-blur-md">
            +${item.profit.toFixed(0)} profit
          </div>
        ) : item.analyzed ? (
          <div
            className="absolute top-3 right-3 text-[11px] font-medium px-2.5 py-1 rounded-full border bg-zinc-800/80 text-zinc-400 border-zinc-700/50 backdrop-blur-md max-w-[160px] truncate"
            title={item.skip_reason ?? "Checked — not a deal"}
          >
            {item.skip_reason ?? "Not a deal"}
          </div>
        ) : (
          <div className="absolute top-3 right-3 text-[11px] font-medium px-2.5 py-1 rounded-full border bg-zinc-800/80 text-zinc-500 border-zinc-700/50 backdrop-blur-md">
            Not analyzed
          </div>
        )}

        {/* Bottom overlay — only for confirmed deals */}
        {item.is_deal && item.profit != null && (
          <div className="absolute bottom-0 left-0 right-0 px-4 py-3">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-[10px] text-zinc-400 uppercase tracking-widest font-semibold mb-0.5">Est. Profit</div>
                <div className="text-2xl font-black text-white leading-none drop-shadow-lg">+${item.profit.toFixed(0)}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-zinc-500 mb-0.5">{item.ebay_sold_count} comps</div>
                <div className="text-sm font-semibold text-green-400">${item.ebay_median?.toFixed(0)} eBay</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col gap-3 flex-1">
        <a
          href={item.sgw_url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-[13px] text-zinc-100 hover:text-white line-clamp-2 leading-snug block"
        >
          {item.title}
        </a>

        {/* Price row */}
        {item.is_deal && item.ebay_median != null ? (
          <div className="flex items-center gap-2 text-xs">
            <div className="flex-1 rounded-xl bg-zinc-800/70 border border-zinc-700/50 px-3 py-2">
              <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold mb-1">You Pay</div>
              <div className="font-bold text-white text-[14px]">${totalCost.toFixed(2)}</div>
              <div className="text-[10px] text-zinc-600 mt-0.5">${item.current_bid.toFixed(2)} bid</div>
            </div>
            <svg className="w-4 h-4 text-zinc-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            <div className="flex-1 rounded-xl bg-zinc-800/70 border border-zinc-700/50 px-3 py-2">
              <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold mb-1">eBay Value</div>
              <div className="font-bold text-white text-[14px]">${item.ebay_median.toFixed(2)}</div>
              <div className="text-[10px] text-zinc-600 mt-0.5">${item.ebay_low?.toFixed(0)}–${item.ebay_high?.toFixed(0)}</div>
            </div>
          </div>
        ) : item.analyzed && item.skip_reason ? (
          <div className="text-xs bg-zinc-800/50 rounded-xl px-3 py-2.5">
            <div className="flex items-center gap-3">
              <span className="text-zinc-500">Current bid:</span>
              <span className="text-zinc-200 font-semibold">${item.current_bid.toFixed(2)}</span>
            </div>
            <p className="text-zinc-500 mt-1">{item.skip_reason}</p>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-xs bg-zinc-800/50 rounded-xl px-3 py-2.5">
            <span className="text-zinc-500">Current bid:</span>
            <span className="text-zinc-200 font-semibold">${item.current_bid.toFixed(2)}</span>
            <span className="ml-auto text-zinc-600 italic">Run "Check eBay Prices" to analyze</span>
          </div>
        )}

        {/* Snipe */}
        <div className="mt-auto">
          {sniping ? (
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">$</span>
                <input
                  type="number"
                  value={maxBid}
                  onChange={e => setMaxBid(e.target.value)}
                  placeholder={`>${item.current_bid.toFixed(2)}`}
                  className="w-full bg-zinc-800 border border-zinc-600 focus:border-green-500 rounded-xl pl-6 pr-3 py-2.5 text-sm text-white focus:outline-none transition-colors"
                  step="0.50"
                  min={item.current_bid + 0.5}
                  autoFocus
                />
              </div>
              <button onClick={handleSnipe} className="bg-green-600 hover:bg-green-500 text-white text-xs px-4 py-2.5 rounded-xl font-bold transition-all">
                Snipe
              </button>
              <button onClick={() => setSniping(false)} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs px-3 py-2.5 rounded-xl">
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => setSniping(true)}
              className="w-full bg-zinc-800/80 hover:bg-green-900/30 border border-zinc-700 hover:border-green-700/60 text-zinc-400 hover:text-green-300 text-sm py-2.5 rounded-xl font-semibold transition-all"
            >
              + Add to Sniper
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const firstLoad = useRef(true);

  const fetchFavorites = async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const data = await getAllFavorites();
      setFavorites(data.favorites);
    } catch {
      setError("Cannot reach backend — make sure it's running on port 8000.");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      fetchFavorites();
    }
  }, []);

  useEffect(() => {
    const poll = async () => {
      const status = await getFavoritesScanStatus().catch(() => ({ running: false }));
      const wasRunning = scanning;
      setScanning(status.running);
      if (wasRunning && !status.running) fetchFavorites(true);
    };
    poll();
    const interval = setInterval(poll, 10000);
    return () => clearInterval(interval);
  }, [scanning]);

  const handleScan = async () => {
    try {
      await triggerFavoritesScan();
      setScanning(true);
      toast("Scanning your SGW favorites for deals…", { icon: "⭐" });
    } catch {
      toast.error("Failed to start favorites scan");
    }
  };

  const handleSnipe = async (item: FavoriteItem, maxBid: number) => {
    try {
      await addToWatchlist(item.item_id, maxBid);
      toast.success(`Queued! Sniper will bid up to $${maxBid.toFixed(2)}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error adding to watchlist");
    }
  };

  const analyzed = favorites.filter(f => f.analyzed);
  const deals = analyzed.filter(f => f.is_deal);

  return (
    <div className="min-h-screen">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-3xl font-black text-white tracking-tight">Favorites</h1>
          <button
            onClick={handleScan}
            disabled={scanning}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-amber-900/30"
          >
            {scanning ? (
              <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Scanning…</>
            ) : (
              <>⭐ Check eBay Prices</>
            )}
          </button>
        </div>
        <p className="text-zinc-500 text-sm">
          All items on your SGW favorites list — click "Check eBay Prices" to analyze them
        </p>
      </div>

      {scanning && (
        <div className="flex items-center gap-3 bg-amber-950/30 border border-amber-800/40 text-amber-300 rounded-xl px-4 py-3 mb-5 text-sm">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
          Fetching your SGW favorites and checking eBay prices — takes 1–3 min. Page updates automatically.
        </div>
      )}

      {!loading && favorites.length > 0 && (
        <div className="flex items-center gap-2 mb-5">
          <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2">
            <span className="text-zinc-500 text-xs">Total</span>
            <span className="text-white font-bold text-sm">{favorites.length}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2">
            <span className="text-zinc-500 text-xs">Analyzed</span>
            <span className="text-white font-bold text-sm">{analyzed.length}</span>
          </div>
          {deals.length > 0 && (
            <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2">
              <span className="text-zinc-500 text-xs">Deals</span>
              <span className="text-green-400 font-bold text-sm">{deals.length}</span>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-950/50 border border-red-800/50 text-red-300 rounded-xl p-4 mb-6 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden animate-pulse">
              <div className="h-44 bg-zinc-800" />
              <div className="p-4 space-y-3">
                <div className="h-4 bg-zinc-800 rounded-lg w-3/4" />
                <div className="h-10 bg-zinc-800 rounded-xl" />
                <div className="h-10 bg-zinc-800 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : favorites.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-40 text-center">
          <div className="text-5xl mb-4 opacity-30">⭐</div>
          <h2 className="text-base font-semibold text-zinc-300 mb-1">No favorites found</h2>
          <p className="text-sm text-zinc-600 max-w-xs">
            Star items on ShopGoodwill.com and they'll appear here. Then hit "Check eBay Prices" to find deals.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {favorites.map(item => (
            <FavCard key={item.item_id} item={item} onSnipe={handleSnipe} />
          ))}
        </div>
      )}
    </div>
  );
}
