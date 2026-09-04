"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { WatchlistCard } from "@/components/WatchlistCard";
import { TERMINAL_SNIPER_STATUSES, displaySniperStatus, parseEndTime } from "@/components/listingCard";
import { getSettings, getSniperLogs, getSniperStatus, getWatchlist, removeFromWatchlist, repriceItem, SniperLogEntry, WatchlistItem } from "@/lib/api";

function countdown(endTime: string | null): { label: string; urgency: "normal" | "soon" | "urgent" } {
  if (!endTime) return { label: "—", urgency: "normal" };
  const diff = parseEndTime(endTime).getTime() - Date.now();
  if (diff < 0) return { label: "Ended", urgency: "urgent" };
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const urgency = h >= 2 ? "normal" : h >= 1 ? "soon" : "urgent";
  if (h > 24) return { label: `${Math.floor(h / 24)}d ${h % 24}h`, urgency: "normal" };
  return { label: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`, urgency };
}

function trackingUrl(shipper: string | null, tracking: string): string {
  const s = (shipper ?? "").toLowerCase();
  const t = encodeURIComponent(tracking);
  if (s.includes("fedex") || s.includes("federal express")) {
    return `https://www.fedex.com/fedextrack/?trknbr=${t}`;
  }
  if (s.includes("ups") || s.includes("united parcel")) {
    return `https://www.ups.com/track?tracknum=${t}`;
  }
  if (s.includes("usps") || s.includes("postal") || s.includes("post office")) {
    return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${t}`;
  }
  if (s.includes("dhl")) {
    return `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${t}`;
  }
  return `https://www.google.com/search?q=${encodeURIComponent((shipper ?? "") + " tracking " + tracking)}`;
}

function ebaySearchUrl(term: string): string {
  return `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(term)}`;
}

const STATUS_LABEL: Record<string, string> = {
  scheduled:          "Ready to snipe",
  bid_placed:         "Bid placed",
  won:                "Won",
  awaiting_payment:   "Pay now",
  shipped:            "Shipped",
  lost:               "Lost",
  error:              "Error",
};
const STATUS_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  scheduled:        { bg: "bg-blue-950/40 light:bg-blue-50",       text: "text-blue-300 light:text-blue-700",       dot: "bg-blue-500 animate-pulse" },
  bid_placed:       { bg: "bg-amber-950/40 light:bg-amber-50",     text: "text-amber-300 light:text-amber-800",     dot: "bg-amber-500 animate-pulse" },
  won:              { bg: "bg-emerald-950/40 light:bg-emerald-50", text: "text-emerald-300 light:text-emerald-800", dot: "bg-emerald-400" },
  awaiting_payment: { bg: "bg-green-950/40 light:bg-green-50",     text: "text-green-300 light:text-green-800",     dot: "bg-green-400 animate-pulse" },
  shipped:          { bg: "bg-sky-950/40 light:bg-sky-50",         text: "text-sky-300 light:text-sky-800",         dot: "bg-sky-400" },
  lost:             { bg: "bg-zinc-800/40",                       text: "text-zinc-500",                           dot: "bg-zinc-600" },
  error:            { bg: "bg-red-950/40 light:bg-red-50",         text: "text-red-400 light:text-red-700",         dot: "bg-red-500" },
};

export default function WatchlistPage() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [sniperRunning, setSniperRunning] = useState(false);
  const [snipeSeconds, setSnipeSeconds] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<SniperLogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [recheckId, setRecheckId] = useState<number | null>(null);
  const [recheckTerm, setRecheckTerm] = useState("");
  const [rechecking, setRechecking] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "cards">(() => {
    if (typeof window === "undefined") return "list";
    return (localStorage.getItem("watchlist-view") as "list" | "cards") || "list";
  });
  const logBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      const [wl, sniper, settings] = await Promise.all([
        getWatchlist().catch(() => ({ watchlist: [] })),
        getSniperStatus().catch(() => ({ running: false })),
        getSettings().catch(() => null),
      ]);
      setWatchlist(wl.watchlist);
      setSniperRunning(sniper.running);
      if (settings) setSnipeSeconds(Number(settings.snipe_seconds_before));
      setLoading(false);
    };
    load();
    const tickInterval = setInterval(() => setTick(t => t + 1), 1000);
    const pollInterval = setInterval(load, 15000);
    return () => { clearInterval(tickInterval); clearInterval(pollInterval); };
  }, []);

  useEffect(() => {
    if (!showLogs) return;
    const fetchLogs = async () => {
      const data = await getSniperLogs(200).catch(() => ({ logs: [] }));
      setLogs(data.logs);
      setTimeout(() => logBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    };
    fetchLogs();
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, [showLogs]);

  void tick;

  const handleRemove = async (item_id: number) => {
    await removeFromWatchlist(item_id);
    setWatchlist(prev => prev.filter(i => i.item_id !== item_id));
    toast("Removed from sniper queue");
  };

  const handleRecheck = async (item_id: number) => {
    const term = recheckTerm.trim();
    if (!term) {
      toast.error("Enter a search term");
      return;
    }
    setRechecking(true);
    try {
      const result = await repriceItem(item_id, term);
      setWatchlist(prev => prev.map(i =>
        i.item_id === item_id
          ? { ...i, ebay_median: result.ebay_median, ebay_search: result.ebay_search, profit: result.profit }
          : i
      ));
      setRecheckId(null);
      toast.success(`Updated: $${result.ebay_median.toFixed(0)} eBay`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Recheck failed");
    } finally {
      setRechecking(false);
    }
  };

  const activeItems = watchlist.filter(i => {
    const status = displaySniperStatus(i.sniper_status, i.end_time);
    return status === "scheduled" || status === "bid_placed";
  });

  const setView = (mode: "list" | "cards") => {
    setViewMode(mode);
    localStorage.setItem("watchlist-view", mode);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-black text-zinc-100 tracking-tight">Watchlist</h1>
          <p className="text-zinc-500 text-sm mt-1">
            {watchlist.length} item{watchlist.length !== 1 ? "s" : ""}
            {snipeSeconds != null && ` — sniper bids ${snipeSeconds}s before each auction ends`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* View toggle */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-0.5">
            <button
              type="button"
              onClick={() => setView("list")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                viewMode === "list" ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
              }`}
              title="List view"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setView("cards")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                viewMode === "cards" ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
              }`}
              title="Card view"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
          </div>
          {/* Sniper status indicator */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium ${
            sniperRunning
              ? "bg-green-950/40 border-green-800/50 text-green-400"
              : "bg-red-950/40 border-red-800/50 text-red-400"
          }`}>
            <span className={`w-2 h-2 rounded-full ${sniperRunning ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
            Sniper {sniperRunning ? "active" : "offline"}
          </div>
        </div>
      </div>

      {/* Warning if sniper is offline but has active items */}
      {!sniperRunning && activeItems.length > 0 && (
        <div className="flex items-start gap-3 bg-red-950/30 border border-red-800/40 text-red-300 light:bg-red-50 light:border-red-200 light:text-red-800 rounded-xl px-4 py-3 mb-5 text-sm">
          <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            Sniper is offline — the backend may have restarted. Your {activeItems.length} queued item{activeItems.length !== 1 ? "s" : ""} will not be bid on until it reconnects.
            Restart the backend server to restore the sniper.
          </span>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 animate-pulse">
              <div className="flex gap-4">
                <div className="w-16 h-16 bg-zinc-800 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-zinc-800 rounded w-2/3" />
                  <div className="h-3 bg-zinc-800 rounded w-1/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : watchlist.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-40 text-center">
          <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-zinc-300 mb-1">No items queued</h2>
          <p className="text-sm text-zinc-600 max-w-xs">
            Go to Deals or Favorites and click "+ Add to Sniper" on any auction you want to bid on.
          </p>
        </div>
      ) : viewMode === "cards" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {watchlist.map(item => (
            <WatchlistCard
              key={item.item_id}
              item={item}
              onRemove={handleRemove}
              onRepriced={(itemId, update) => {
                setWatchlist(prev => prev.map(i => i.item_id === itemId ? { ...i, ...update } : i));
              }}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {watchlist.map(item => {
            const { label: timeLabel, urgency } = countdown(item.end_time);
            const displayStatus = displaySniperStatus(item.sniper_status, item.end_time);
            const status = STATUS_STYLE[displayStatus] ?? STATUS_STYLE.scheduled;
            const statusLabel = STATUS_LABEL[displayStatus] ?? displayStatus;
            const timeColor = { urgent: "text-red-400", soon: "text-amber-400", normal: "text-zinc-200" }[urgency];

            return (
              <div
                key={item.item_id}
                className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-4 flex items-center gap-4 transition-colors"
              >
                {item.image_url ? (
                  <img src={item.image_url} alt={item.title} className="w-16 h-16 object-cover rounded-xl flex-shrink-0" />
                ) : (
                  <div className="w-16 h-16 bg-zinc-800 rounded-xl flex items-center justify-center flex-shrink-0 opacity-30 text-2xl">📦</div>
                )}

                <div className="flex-1 min-w-0">
                  <a
                    href={item.sgw_url ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-sm text-zinc-100 hover:text-zinc-50 line-clamp-1 block"
                  >
                    {item.title}
                  </a>

                  {/* Won result — show final price instead of live prices */}
                  {displayStatus === "awaiting_payment" ? (
                    <div className="mt-1.5 text-xs space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-green-400 font-semibold">
                          Won · ${item.final_price?.toFixed(2) ?? "—"}
                        </span>
                        <span className="text-zinc-600">+ shipping/tax at checkout</span>
                        {item.ebay_median != null && (
                          <>
                            <span className="text-zinc-700">·</span>
                            <span className="text-zinc-400">
                              eBay est. <span className="text-zinc-200 font-medium">${item.ebay_median.toFixed(0)}</span>
                            </span>
                          </>
                        )}
                        {item.due_date && (
                          <>
                            <span className="text-zinc-700">·</span>
                            <span className="text-red-400">Pay by {new Date(item.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                          </>
                        )}
                      </div>
                      <a
                        href="https://shopgoodwill.com/shopgoodwill/open-orders"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-green-400 hover:text-green-300 font-medium"
                      >
                        Pay on ShopGoodwill →
                      </a>
                    </div>
                  ) : displayStatus === "shipped" ? (
                    <div className="mt-1.5 text-xs space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap text-zinc-400">
                        {item.final_price != null && (
                          <span>
                            ${item.final_price.toFixed(2)}
                            {item.final_shipping ? ` + $${item.final_shipping.toFixed(2)} ship` : ""}
                            {item.handling_price ? ` + $${item.handling_price.toFixed(2)} handling` : ""}
                            {item.tax ? ` + $${item.tax.toFixed(2)} tax` : ""}
                            {" = "}
                            <span className="text-zinc-200 font-semibold">
                              ${((item.final_price ?? 0) + (item.final_shipping ?? 0) + (item.handling_price ?? 0) + (item.tax ?? 0)).toFixed(2)} total
                            </span>
                          </span>
                        )}
                        {item.ebay_median != null && (
                          <>
                            <span className="text-zinc-700">·</span>
                            <span className="text-zinc-400">
                              eBay est. <span className="text-zinc-200 font-medium">${item.ebay_median.toFixed(0)}</span>
                            </span>
                          </>
                        )}
                        {item.ebay_median != null && item.final_price != null && (() => {
                          const profit = item.ebay_median - (item.final_price ?? 0) - (item.final_shipping ?? 0) - (item.handling_price ?? 0) - (item.tax ?? 0);
                          return (
                            <>
                              <span className="text-zinc-700">·</span>
                              <span className={profit > 0 ? "text-green-400" : "text-red-400"}>
                                {profit > 0 ? "+" : ""}${profit.toFixed(0)} profit
                              </span>
                            </>
                          );
                        })()}
                      </div>
                      {item.tracking_number && (
                        <a
                          href={trackingUrl(item.shipper_name, item.tracking_number)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 font-medium"
                        >
                          {item.shipper_name ?? "Carrier"} #{item.tracking_number} →
                        </a>
                      )}
                    </div>
                  ) : displayStatus === "won" && item.final_price != null ? (
                    <div className="flex items-center gap-3 mt-1.5 text-xs flex-wrap">
                      <span className="text-emerald-400 font-semibold">
                        Won · ${item.final_price.toFixed(2)}
                      </span>
                      {item.ebay_median != null && (
                        <span className="text-zinc-400">
                          eBay est. <span className="text-zinc-200 font-medium">${item.ebay_median.toFixed(0)}</span>
                        </span>
                      )}
                      <span className="text-zinc-600 text-[10px]">Syncing order details…</span>
                    </div>
                  ) : displayStatus === "lost" ? (
                    <div className="mt-1.5 text-xs text-zinc-600 flex items-center gap-2 flex-wrap">
                      <span>Outbid — max was ${item.max_bid.toFixed(2)}</span>
                      {item.ebay_median != null && (
                        <>
                          <span className="text-zinc-700">·</span>
                          <span className="text-zinc-400">
                            eBay est. <span className="text-zinc-300 font-medium">${item.ebay_median.toFixed(0)}</span>
                          </span>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 mt-1.5 text-xs flex-wrap">
                      <span className="text-zinc-500">Current: <span className="text-zinc-300">${item.current_bid?.toFixed(2) ?? "—"}</span></span>
                      <span className="text-zinc-700">·</span>
                      <span className="text-zinc-500">Max bid: <span className="text-green-400 font-semibold">${item.max_bid.toFixed(2)}</span></span>
                      {item.ebay_median != null && (
                        <>
                          <span className="text-zinc-700">·</span>
                          <span className="text-zinc-400">
                            eBay est. <span className="text-zinc-200 font-medium">${item.ebay_median.toFixed(0)}</span>
                          </span>
                        </>
                      )}
                      {item.profit != null && item.profit > 0 && (
                        <>
                          <span className="text-zinc-700">·</span>
                          <span className="text-green-400 font-medium">+${item.profit.toFixed(2)} est.</span>
                        </>
                      )}
                    </div>
                  )}

                  {/* eBay search term + override */}
                  {(item.ebay_search || item.ebay_median != null) && (
                    <div className="mt-1.5 text-[11px]">
                      {recheckId === item.item_id ? (
                        <div className="flex gap-2 items-center">
                          <input
                            type="text"
                            value={recheckTerm}
                            onChange={e => setRecheckTerm(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && handleRecheck(item.item_id)}
                            placeholder="Better eBay search term…"
                            className="flex-1 max-w-xs bg-zinc-800 border border-zinc-700 focus:border-zinc-500 rounded-lg px-2.5 py-1 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleRecheck(item.item_id)}
                            disabled={rechecking}
                            className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-zinc-100 text-xs px-2.5 py-1 rounded-lg font-semibold"
                          >
                            {rechecking ? "…" : "Recheck"}
                          </button>
                          <button type="button" onClick={() => setRecheckId(null)} className="text-zinc-600 hover:text-zinc-400">✕</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                          {item.ebay_search && (
                            <>
                              <span className="text-zinc-600">Searched:</span>
                              <a
                                href={ebaySearchUrl(item.ebay_search)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-zinc-400 hover:text-sky-400 underline underline-offset-2 truncate max-w-[180px]"
                              >
                                {item.ebay_search}
                              </a>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setRecheckId(item.item_id);
                              setRecheckTerm(item.ebay_search ?? "");
                            }}
                            className="text-zinc-600 hover:text-zinc-300 transition-colors"
                          >
                            Wrong item?
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Countdown — only shown while auction is live */}
                {(() => {
                  const terminal = (TERMINAL_SNIPER_STATUSES as readonly string[]).includes(displayStatus);
                  if (terminal) return null;
                  return (
                    <div className="text-center flex-shrink-0">
                      {timeLabel === "Ended" ? (
                        <div className="text-base font-semibold text-zinc-400">Ended</div>
                      ) : (
                        <>
                          <div className="text-[10px] text-zinc-600 uppercase tracking-wide mb-0.5">Ends in</div>
                          <div className={`text-base font-mono font-bold ${timeColor}`}>{timeLabel}</div>
                        </>
                      )}
                    </div>
                  );
                })()}

                {/* Status */}
                <div className={`hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full flex-shrink-0 border border-transparent ${status.bg} ${status.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                  {statusLabel}
                </div>

                <button
                  onClick={() => handleRemove(item.item_id)}
                  className="text-zinc-700 hover:text-zinc-400 hover:bg-zinc-800 w-7 h-7 rounded-lg flex items-center justify-center transition-colors flex-shrink-0 text-sm"
                  title="Remove from sniper"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Sniper activity log */}
      <div className="mt-8">
        <button
          onClick={() => setShowLogs(v => !v)}
          className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors font-medium"
        >
          <svg
            className={`w-3.5 h-3.5 transition-transform ${showLogs ? "rotate-90" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {showLogs ? "Hide" : "Show"} sniper activity log
        </button>

        {showLogs && (
          <div className="mt-3 bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Sniper Log</span>
              <span className="text-[10px] text-zinc-600">live · last 200 lines</span>
            </div>
            <div className="h-72 overflow-y-auto p-3 font-mono text-xs space-y-0.5">
              {logs.length === 0 ? (
                <p className="text-zinc-600 text-center py-8">No log entries yet — sniper will write here when it checks favorites or places a bid.</p>
              ) : (
                logs.map((entry, i) => {
                  const isError = /error|exception|failed/i.test(entry.line);
                  const isBid = /placing bid|bid placed/i.test(entry.line);
                  const isWarn = /warning/i.test(entry.line);
                  const color = isError ? "text-red-400" : isBid ? "text-green-400" : isWarn ? "text-amber-400" : "text-zinc-500";
                  return (
                    <div key={i} className="flex gap-2">
                      <span className="text-zinc-500 flex-shrink-0">{entry.ts}</span>
                      <span className={color}>{entry.line}</span>
                    </div>
                  );
                })
              )}
              <div ref={logBottomRef} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
