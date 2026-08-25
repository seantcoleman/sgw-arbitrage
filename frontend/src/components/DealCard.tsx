"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Deal, repriceItem } from "@/lib/api";

interface DealCardProps {
  deal: Deal;
  isWatching: boolean;
  maxBid: string;
  onMaxBidChange: (v: string) => void;
  onWatchClick: () => void;
  onConfirmWatch: () => void;
  onRepriced?: (itemId: number, update: Partial<Deal>) => void;
}

function parseEndTime(endTime: string): Date {
  if (endTime.endsWith("Z") || endTime.includes("+") || endTime.includes("-0")) return new Date(endTime);
  // SGW times are America/Los_Angeles — approximate with current offset
  const isDST = new Date().getTimezoneOffset() < new Date(new Date().getFullYear(), 0, 1).getTimezoneOffset();
  return new Date(endTime + (isDST ? "-07:00" : "-08:00"));
}

function timeUntil(endTime: string | null): { label: string; urgency: "normal" | "soon" | "urgent" } {
  if (!endTime) return { label: "Unknown", urgency: "normal" };
  const diff = parseEndTime(endTime).getTime() - Date.now();
  if (diff < 0) return { label: "Ended", urgency: "urgent" };
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 48) return { label: `${Math.floor(h / 24)}d left`, urgency: "normal" };
  if (h > 24) return { label: `${Math.floor(h / 24)}d ${h % 24}h`, urgency: "normal" };
  if (h >= 4) return { label: `${h}h ${m}m`, urgency: "soon" };
  return { label: `${h}h ${m}m`, urgency: "urgent" };
}

function formatRoi(margin: number): string {
  const pct = margin * 100;
  if (pct >= 1000) return `${(margin).toFixed(0)}x ROI`;
  return `${Math.round(pct)}% ROI`;
}

function ebaySearchUrl(term: string): string {
  return `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(term)}`;
}

export function DealCard({
  deal,
  isWatching,
  maxBid,
  onMaxBidChange,
  onWatchClick,
  onConfirmWatch,
  onRepriced,
}: DealCardProps) {
  const [showRecheck, setShowRecheck] = useState(false);
  const [searchTerm, setSearchTerm] = useState(deal.ebay_search ?? "");
  const [rechecking, setRechecking] = useState(false);

  const { label: timeLabel, urgency } = timeUntil(deal.end_time);
  const totalCost = deal.current_bid + (deal.shipping_est ?? 0);
  const roiLabel = formatRoi(deal.margin);

  const roiBadgeCls =
    deal.margin >= 3
      ? "bg-green-600 text-white border-green-500"
      : deal.margin >= 1
      ? "bg-emerald-600 text-white border-emerald-500"
      : "bg-amber-500 text-zinc-950 border-amber-400";

  const urgencyCls = {
    normal: "text-zinc-400 bg-black/50",
    soon: "text-amber-300 bg-amber-950/70",
    urgent: "text-red-300 bg-red-950/70",
  }[urgency];

  const urgencyDot = {
    normal: "bg-zinc-500",
    soon: "bg-amber-400",
    urgent: "bg-red-500 animate-pulse",
  }[urgency];

  const handleRecheck = async () => {
    const term = searchTerm.trim();
    if (!term) {
      toast.error("Enter a search term");
      return;
    }
    setRechecking(true);
    try {
      const result = await repriceItem(deal.item_id, term);
      onRepriced?.(deal.item_id, {
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
      toast.success(`Updated: $${result.ebay_median.toFixed(0)} eBay · +$${result.profit.toFixed(0)}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Recheck failed");
    } finally {
      setRechecking(false);
    }
  };

  return (
    <div className="group relative bg-zinc-900 border border-zinc-800/80 hover:border-zinc-600 rounded-2xl overflow-hidden flex flex-col transition-all duration-200 hover:shadow-2xl hover:shadow-black/50">
      {/* Image */}
      <div className="relative h-48 bg-zinc-800 overflow-hidden">
        {deal.image_url ? (
          <>
            <img
              src={deal.image_url}
              alt={deal.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent opacity-80" />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-4xl opacity-20">📦</span>
          </div>
        )}

        {/* Top badges */}
        <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-2">
          <span className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full backdrop-blur-md border border-white/10 ${urgencyCls}`}>
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${urgencyDot}`} />
            {timeLabel}
          </span>
          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border backdrop-blur-md ${roiBadgeCls}`}>
            {roiLabel}
          </span>
        </div>

        {/* Profit overlaid at bottom of image */}
        <div className="absolute bottom-0 left-0 right-0 px-3 py-3">
          <div className="flex items-end justify-between gap-2">
            <div className="rounded-xl bg-black/70 backdrop-blur-md border border-white/10 px-3 py-2">
              <div className="text-[10px] text-zinc-300 uppercase tracking-widest font-semibold mb-0.5">Est. Profit</div>
              <div className="text-3xl font-black text-white leading-none">
                +${deal.profit.toFixed(0)}
              </div>
            </div>
            <div className="rounded-xl bg-black/70 backdrop-blur-md border border-white/10 px-3 py-2 text-right">
              <div className="text-[10px] text-zinc-400 mb-0.5">{deal.ebay_sold_count} comps</div>
              <div className="text-sm font-semibold text-green-400">${deal.ebay_median.toFixed(0)} eBay</div>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Title + keyword */}
        <div>
          <a
            href={deal.sgw_url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[13px] text-zinc-100 hover:text-white line-clamp-2 leading-snug block"
          >
            {deal.title}
          </a>
          <span className="inline-block mt-1.5 text-[10px] font-medium text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full border border-zinc-700">
            {deal.keyword}
          </span>
        </div>

        {/* Price row */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex-1 rounded-xl bg-zinc-800/70 border border-zinc-700/50 px-3 py-2.5">
            <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold mb-1">You Pay</div>
            <div className="font-bold text-white text-[15px]">${totalCost.toFixed(2)}</div>
            <div className="text-[10px] text-zinc-600 mt-0.5">
              ${deal.current_bid.toFixed(2)} + ${(deal.shipping_est ?? 0).toFixed(2)} ship
            </div>
          </div>

          <svg className="w-4 h-4 text-zinc-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>

          <div className="flex-1 rounded-xl bg-zinc-800/70 border border-zinc-700/50 px-3 py-2.5">
            <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold mb-1">eBay Value</div>
            <div className="font-bold text-white text-[15px]">${deal.ebay_median.toFixed(2)}</div>
            <div className="text-[10px] text-zinc-600 mt-0.5">
              ${deal.ebay_low.toFixed(0)}–${deal.ebay_high.toFixed(0)} range
            </div>
          </div>
        </div>

        {/* Search term + wrong item */}
        <div className="text-[11px]">
          {deal.ebay_search && !showRecheck && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-zinc-600">Searched:</span>
              <a
                href={ebaySearchUrl(deal.ebay_search)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-400 hover:text-sky-400 underline underline-offset-2 truncate max-w-[160px]"
                title={deal.ebay_search}
              >
                {deal.ebay_search}
              </a>
              <button
                type="button"
                onClick={() => { setSearchTerm(deal.ebay_search); setShowRecheck(true); }}
                className="text-zinc-600 hover:text-zinc-300 transition-colors"
              >
                Wrong item?
              </button>
            </div>
          )}
          {(!deal.ebay_search || showRecheck) && (
            <div className="flex gap-2 mt-1">
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
                className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors"
              >
                {rechecking ? "…" : "Recheck"}
              </button>
              {showRecheck && (
                <button
                  type="button"
                  onClick={() => setShowRecheck(false)}
                  className="text-zinc-600 hover:text-zinc-400 text-xs px-1"
                >
                  ✕
                </button>
              )}
            </div>
          )}
        </div>

        {/* Snipe section */}
        <div className="mt-auto">
          {isWatching ? (
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm font-medium">$</span>
                <input
                  type="number"
                  value={maxBid}
                  onChange={e => onMaxBidChange(e.target.value)}
                  placeholder={`>${deal.current_bid.toFixed(2)}`}
                  className="w-full bg-zinc-800 border border-zinc-600 focus:border-green-500 rounded-xl pl-6 pr-3 py-2.5 text-sm text-white focus:outline-none transition-colors"
                  step="0.50"
                  min={deal.current_bid + 0.5}
                  autoFocus
                />
              </div>
              <button
                onClick={onConfirmWatch}
                className="bg-green-600 hover:bg-green-500 active:scale-95 text-white text-xs px-4 py-2.5 rounded-xl font-bold transition-all"
              >
                Snipe
              </button>
              <button
                onClick={onWatchClick}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs px-3 py-2.5 rounded-xl transition-colors"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={onWatchClick}
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
