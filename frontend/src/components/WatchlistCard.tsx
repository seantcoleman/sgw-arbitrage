"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { repriceItem, WatchlistItem } from "@/lib/api";

function parseEndTime(endTime: string): Date {
  if (endTime.endsWith("Z") || endTime.includes("+") || endTime.includes("-0")) return new Date(endTime);
  const isDST = new Date().getTimezoneOffset() < new Date(new Date().getFullYear(), 0, 1).getTimezoneOffset();
  return new Date(endTime + (isDST ? "-07:00" : "-08:00"));
}

function countdown(endTime: string | null): { label: string; urgency: "normal" | "soon" | "urgent" } {
  if (!endTime) return { label: "—", urgency: "normal" };
  const diff = parseEndTime(endTime).getTime() - Date.now();
  if (diff < 0) return { label: "Ended", urgency: "urgent" };
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const urgency = h >= 2 ? "normal" : h >= 1 ? "soon" : "urgent";
  if (h > 24) return { label: `${Math.floor(h / 24)}d ${h % 24}h`, urgency: "normal" };
  return { label: `${h}h ${m}m`, urgency };
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
  scheduled: "Ready to snipe",
  bid_placed: "Bid placed",
  won: "Won",
  awaiting_payment: "Pay now",
  shipped: "Shipped",
  lost: "Lost",
  error: "Error",
};

const STATUS_STYLE: Record<string, string> = {
  scheduled: "bg-blue-600 text-white border-blue-500",
  bid_placed: "bg-amber-500 text-zinc-950 border-amber-400",
  won: "bg-emerald-600 text-white border-emerald-500",
  awaiting_payment: "bg-green-600 text-white border-green-500",
  shipped: "bg-sky-600 text-white border-sky-500",
  lost: "bg-zinc-700 text-zinc-200 border-zinc-600",
  error: "bg-red-600 text-white border-red-500",
};

interface WatchlistCardProps {
  item: WatchlistItem;
  onRemove: (itemId: number) => void;
  onRepriced: (itemId: number, update: Partial<WatchlistItem>) => void;
}

export function WatchlistCard({ item, onRemove, onRepriced }: WatchlistCardProps) {
  const [showRecheck, setShowRecheck] = useState(false);
  const [searchTerm, setSearchTerm] = useState(item.ebay_search ?? "");
  const [rechecking, setRechecking] = useState(false);

  const { label: timeLabel, urgency } = countdown(item.end_time);
  const terminal = ["won", "awaiting_payment", "shipped", "lost"].includes(item.sniper_status);
  const statusLabel = STATUS_LABEL[item.sniper_status] ?? item.sniper_status;
  const statusCls = STATUS_STYLE[item.sniper_status] ?? STATUS_STYLE.scheduled;

  const paidTotal =
    (item.final_price ?? 0) +
    (item.final_shipping ?? 0) +
    (item.handling_price ?? 0) +
    (item.tax ?? 0);

  const shippedProfit =
    item.ebay_median != null && item.final_price != null
      ? item.ebay_median - paidTotal
      : null;

  const urgencyCls = {
    normal: "text-zinc-400 bg-black/50",
    soon: "text-amber-300 bg-amber-950/70",
    urgent: "text-red-300 bg-red-950/70",
  }[urgency];

  const handleRecheck = async () => {
    const term = searchTerm.trim();
    if (!term) {
      toast.error("Enter a search term");
      return;
    }
    setRechecking(true);
    try {
      const result = await repriceItem(item.item_id, term);
      onRepriced(item.item_id, {
        ebay_search: result.ebay_search,
        ebay_median: result.ebay_median,
        profit: result.profit,
      });
      setSearchTerm(result.ebay_search);
      setShowRecheck(false);
      toast.success(`Updated: $${result.ebay_median.toFixed(0)} eBay`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Recheck failed");
    } finally {
      setRechecking(false);
    }
  };

  return (
    <div className="group relative bg-zinc-900 border border-zinc-800/80 hover:border-zinc-600 rounded-2xl overflow-hidden flex flex-col transition-all duration-200 hover:shadow-2xl hover:shadow-black/50">
      <div className="relative h-48 bg-zinc-800 overflow-hidden">
        {item.image_url ? (
          <>
            <img
              src={item.image_url}
              alt={item.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent opacity-80" />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-4xl opacity-20">📦</span>
          </div>
        )}

        <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-2">
          {!terminal ? (
            <span className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full backdrop-blur-md border border-white/10 ${urgencyCls}`}>
              {timeLabel === "Ended" ? "Ended" : `Ends ${timeLabel}`}
            </span>
          ) : (
            <span />
          )}
          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${statusCls}`}>
            {statusLabel}
          </span>
        </div>

        <div className="absolute bottom-0 left-0 right-0 px-3 py-3">
          <div className="flex items-end justify-between gap-2">
            <div className="rounded-xl bg-black/70 backdrop-blur-md border border-white/10 px-3 py-2">
              {item.ebay_median != null ? (
                <>
                  <div className="text-[10px] text-zinc-300 uppercase tracking-widest font-semibold mb-0.5">eBay Est.</div>
                  <div className="text-2xl font-black text-white leading-none">
                    ${item.ebay_median.toFixed(0)}
                  </div>
                </>
              ) : (
                <div className="text-sm text-zinc-400">No eBay estimate</div>
              )}
            </div>
            {item.sniper_status === "shipped" && shippedProfit != null && (
              <div className="rounded-xl bg-black/70 backdrop-blur-md border border-white/10 px-3 py-2 text-right">
                <div className="text-[10px] text-zinc-400 mb-0.5">vs paid</div>
                <div className={`text-sm font-semibold ${shippedProfit > 0 ? "text-green-400" : "text-red-400"}`}>
                  {shippedProfit > 0 ? "+" : ""}${shippedProfit.toFixed(0)}
                </div>
              </div>
            )}
            {item.sniper_status !== "shipped" && item.profit != null && item.profit > 0 && (
              <div className="rounded-xl bg-black/70 backdrop-blur-md border border-white/10 px-3 py-2 text-right">
                <div className="text-[10px] text-zinc-400 mb-0.5">Est. profit</div>
                <div className="text-sm font-semibold text-green-400">+${item.profit.toFixed(0)}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-3 flex-1">
        <a
          href={item.sgw_url ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-[13px] text-zinc-100 hover:text-white line-clamp-2 leading-snug block"
        >
          {item.title}
        </a>

        {item.sniper_status === "awaiting_payment" ? (
          <div className="text-xs space-y-1.5">
            <div className="rounded-xl bg-zinc-800/70 border border-zinc-700/50 px-3 py-2.5">
              <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold mb-1">Won for</div>
              <div className="font-bold text-white text-[15px]">${item.final_price?.toFixed(2) ?? "—"}</div>
              <div className="text-[10px] text-zinc-600 mt-0.5">+ shipping/tax at checkout</div>
            </div>
            {item.due_date && (
              <p className="text-red-400 text-[11px]">
                Pay by {new Date(item.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </p>
            )}
            <a
              href="https://shopgoodwill.com/shopgoodwill/open-orders"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex text-green-400 hover:text-green-300 font-medium text-[11px]"
            >
              Pay on ShopGoodwill →
            </a>
          </div>
        ) : item.sniper_status === "shipped" ? (
          <div className="text-xs space-y-1.5">
            <div className="rounded-xl bg-zinc-800/70 border border-zinc-700/50 px-3 py-2.5">
              <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold mb-1">Total paid</div>
              <div className="font-bold text-white text-[15px]">${paidTotal.toFixed(2)}</div>
              <div className="text-[10px] text-zinc-600 mt-0.5">
                ${item.final_price?.toFixed(2)}
                {item.final_shipping ? ` + $${item.final_shipping.toFixed(2)} ship` : ""}
                {item.handling_price ? ` + $${item.handling_price.toFixed(2)} hndl` : ""}
                {item.tax ? ` + $${item.tax.toFixed(2)} tax` : ""}
              </div>
            </div>
            {item.tracking_number && (
              <a
                href={trackingUrl(item.shipper_name, item.tracking_number)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex text-sky-400 hover:text-sky-300 font-medium text-[11px]"
              >
                {item.shipper_name ?? "Carrier"} #{item.tracking_number} →
              </a>
            )}
          </div>
        ) : item.sniper_status === "lost" ? (
          <div className="text-xs text-zinc-500 rounded-xl bg-zinc-800/50 px-3 py-2.5">
            Outbid — max was ${item.max_bid.toFixed(2)}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs">
            <div className="flex-1 rounded-xl bg-zinc-800/70 border border-zinc-700/50 px-3 py-2.5">
              <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold mb-1">Current</div>
              <div className="font-bold text-white text-[15px]">${item.current_bid?.toFixed(2) ?? "—"}</div>
            </div>
            <div className="flex-1 rounded-xl bg-zinc-800/70 border border-zinc-700/50 px-3 py-2.5">
              <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold mb-1">Max bid</div>
              <div className="font-bold text-green-400 text-[15px]">${item.max_bid.toFixed(2)}</div>
            </div>
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
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              {item.ebay_search && (
                <>
                  <span className="text-zinc-600">Searched:</span>
                  <a
                    href={ebaySearchUrl(item.ebay_search)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-400 hover:text-sky-400 underline underline-offset-2 truncate max-w-[140px]"
                  >
                    {item.ebay_search}
                  </a>
                </>
              )}
              {(item.ebay_search || item.ebay_median != null) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm(item.ebay_search ?? "");
                    setShowRecheck(true);
                  }}
                  className="text-zinc-600 hover:text-zinc-300 transition-colors"
                >
                  Wrong item?
                </button>
              )}
            </div>
          )}
        </div>

        <button
          onClick={() => onRemove(item.item_id)}
          className="mt-auto w-full bg-zinc-800/80 hover:bg-red-950/40 border border-zinc-700 hover:border-red-800/60 text-zinc-400 hover:text-red-300 text-sm py-2.5 rounded-xl font-semibold transition-all"
        >
          Remove
        </button>
      </div>
    </div>
  );
}
