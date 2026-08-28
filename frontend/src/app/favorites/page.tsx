"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  addToWatchlist,
  FavoriteItem,
  getAllFavorites,
  getFavoritesScanStatus,
  getWatchlist,
  repriceItem,
  triggerFavoritesScan,
} from "@/lib/api";
import {
  CardImage,
  CardTopBadges,
  DealImageOverlay,
  LISTING_CARD_SHELL,
  PriceCompareRow,
  RoiBadge,
  StatPill,
  StatusPill,
  timeUntil,
  UrgencyBadge,
} from "@/components/listingCard";

function ebaySearchUrl(term: string): string {
  return `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(term)}`;
}

function FavCard({
  item,
  isOnWatchlist,
  onSnipe,
  onUpdated,
}: {
  item: FavoriteItem;
  isOnWatchlist: boolean;
  onSnipe: (item: FavoriteItem, maxBid: number) => Promise<boolean>;
  onUpdated: (itemId: number, update: Partial<FavoriteItem>) => void;
}) {
  const [maxBid, setMaxBid] = useState("");
  const [sniping, setSniping] = useState(false);
  const [showRecheck, setShowRecheck] = useState(false);
  const [searchTerm, setSearchTerm] = useState(item.ebay_search ?? "");
  const [rechecking, setRechecking] = useState(false);
  const { label: timeLabel, urgency } = timeUntil(item.end_time);
  const totalCost = item.current_bid + (item.shipping_est ?? 12);
  const hasEbay = item.ebay_median != null;

  const handleSnipe = async () => {
    const bid = parseFloat(maxBid);
    if (!bid || bid <= item.current_bid) {
      toast.error(`Max bid must be > $${item.current_bid.toFixed(2)}`);
      return;
    }
    const ok = await onSnipe(item, bid);
    if (ok) setSniping(false);
  };

  const handleRecheck = async () => {
    const term = searchTerm.trim();
    if (!term) {
      toast.error("Enter a search term");
      return;
    }
    setRechecking(true);
    try {
      const result = await repriceItem(item.item_id, term);
      onUpdated(item.item_id, {
        analyzed: true,
        is_deal: true,
        skip_reason: null,
        ebay_search: result.ebay_search,
        ebay_median: result.ebay_median,
        ebay_low: result.ebay_low,
        ebay_high: result.ebay_high,
        ebay_sold_count: result.ebay_sold_count,
        profit: result.profit,
        margin: result.margin,
      });
      setSearchTerm(result.ebay_search);
      setShowRecheck(false);
      toast.success(`Updated: $${result.ebay_median.toFixed(0)} eBay · ${result.profit >= 0 ? "+" : ""}$${result.profit.toFixed(0)}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Recheck failed");
    } finally {
      setRechecking(false);
    }
  };

  const rightBadge =
    item.is_deal && item.margin != null ? (
      <RoiBadge margin={item.margin} profit={item.profit} />
    ) : item.profit != null && item.profit > 0 ? (
      <RoiBadge margin={item.margin} profit={item.profit} />
    ) : item.analyzed ? (
      <StatusPill
        label={item.skip_reason ?? "Not a deal"}
        tone="muted"
        title={item.skip_reason ?? "Checked — not a deal"}
      />
    ) : (
      <StatusPill label="Not analyzed" tone="muted" />
    );

  return (
    <div className={LISTING_CARD_SHELL}>
      <CardImage src={item.image_url} alt={item.title} heightClass="h-44">
        <CardTopBadges
          left={<UrgencyBadge label={timeLabel} urgency={urgency} />}
          right={rightBadge}
        />
        {hasEbay && item.profit != null ? (
          <DealImageOverlay
            profit={item.profit}
            ebayMedian={item.ebay_median!}
            comps={item.ebay_sold_count}
            size="md"
          />
        ) : hasEbay ? (
          <div className="absolute bottom-0 left-0 right-0 px-3 py-3">
            <div className="flex items-end justify-between gap-2">
              <StatPill
                label={item.ebay_sold_count != null ? `${item.ebay_sold_count} comps` : "eBay Est."}
                value={`$${item.ebay_median!.toFixed(0)}`}
                size="md"
              />
            </div>
          </div>
        ) : null}
      </CardImage>

      <div className="p-4 flex flex-col gap-3 flex-1">
        <a
          href={item.sgw_url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-[13px] text-zinc-100 hover:text-white line-clamp-2 leading-snug block"
        >
          {item.title}
        </a>

        {hasEbay ? (
          <div className="space-y-1.5">
            <PriceCompareRow
              youPay={`$${totalCost.toFixed(2)}`}
              youPayDetail={`$${item.current_bid.toFixed(2)} bid`}
              ebayValue={`$${item.ebay_median!.toFixed(2)}`}
              ebayDetail={
                item.ebay_low != null && item.ebay_high != null
                  ? `$${item.ebay_low.toFixed(0)}–$${item.ebay_high.toFixed(0)}`
                  : item.ebay_sold_count != null
                  ? `${item.ebay_sold_count} comps`
                  : undefined
              }
            />
            {!item.is_deal && item.skip_reason && (
              <p className="text-[11px] text-zinc-500">{item.skip_reason}</p>
            )}
          </div>
        ) : item.analyzed ? (
          <div className="text-xs bg-zinc-800/50 rounded-xl px-3 py-2.5">
            <div className="flex items-center gap-3">
              <span className="text-zinc-500">Current bid:</span>
              <span className="text-zinc-200 font-semibold">${item.current_bid.toFixed(2)}</span>
            </div>
            {item.skip_reason && <p className="text-zinc-500 mt-1">{item.skip_reason}</p>}
          </div>
        ) : (
          <div className="flex items-center gap-3 text-xs bg-zinc-800/50 rounded-xl px-3 py-2.5">
            <span className="text-zinc-500">Current bid:</span>
            <span className="text-zinc-200 font-semibold">${item.current_bid.toFixed(2)}</span>
            <span className="ml-auto text-zinc-600 italic">Run &quot;Check eBay Prices&quot; to analyze</span>
          </div>
        )}

        <div className="text-[11px]">
          {showRecheck ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleRecheck()}
                placeholder="Better eBay search term…"
                className="flex-1 bg-zinc-800 border border-zinc-700 focus:border-zinc-500 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleRecheck}
                disabled={rechecking}
                className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded-lg font-semibold"
              >
                {rechecking ? "…" : "Recheck"}
              </button>
              <button type="button" onClick={() => setShowRecheck(false)} className="text-zinc-600 hover:text-zinc-400 text-xs px-1">
                ✕
              </button>
            </div>
          ) : item.analyzed ? (
            <div className="flex items-center gap-2 flex-wrap">
              {item.ebay_search ? (
                <>
                  <span className="text-zinc-600">Searched:</span>
                  <a
                    href={ebaySearchUrl(item.ebay_search)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-400 hover:text-sky-400 underline underline-offset-2 truncate max-w-[160px]"
                    title={item.ebay_search}
                  >
                    {item.ebay_search}
                  </a>
                </>
              ) : (
                <span className="text-zinc-600">No eBay estimate yet</span>
              )}
              <button
                type="button"
                onClick={() => {
                  setSearchTerm(item.ebay_search ?? item.title);
                  setShowRecheck(true);
                }}
                className="text-zinc-600 hover:text-zinc-300 transition-colors"
              >
                Wrong item?
              </button>
            </div>
          ) : null}
        </div>

        <div className="mt-auto">
          {isOnWatchlist ? (
            <div className="w-full bg-zinc-800/50 border border-zinc-800 text-zinc-500 text-sm py-2.5 rounded-xl font-semibold text-center cursor-default">
              On Sniper
            </div>
          ) : sniping ? (
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
  const [watchedIds, setWatchedIds] = useState<Set<number>>(new Set());
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
      getWatchlist()
        .then(data => setWatchedIds(new Set(data.watchlist.map(w => w.item_id))))
        .catch(() => {});
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

  const handleSnipe = async (item: FavoriteItem, maxBid: number): Promise<boolean> => {
    try {
      await addToWatchlist(item.item_id, maxBid);
      setWatchedIds(prev => new Set(prev).add(item.item_id));
      toast.success(`Queued! Sniper will bid up to $${maxBid.toFixed(2)}`);
      return true;
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error adding to watchlist");
      return false;
    }
  };

  const handleUpdated = (itemId: number, update: Partial<FavoriteItem>) => {
    setFavorites(prev => prev.map(f => (f.item_id === itemId ? { ...f, ...update } : f)));
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
            <FavCard
              key={item.item_id}
              item={item}
              isOnWatchlist={watchedIds.has(item.item_id)}
              onSnipe={handleSnipe}
              onUpdated={handleUpdated}
            />
          ))}
        </div>
      )}
    </div>
  );
}
