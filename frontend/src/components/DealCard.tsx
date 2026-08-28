"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Category, Deal, repriceItem } from "@/lib/api";
import {
  CardImage,
  CardTopBadges,
  DealImageOverlay,
  LISTING_CARD_SHELL,
  PriceCompareRow,
  RoiBadge,
  timeUntil,
  UrgencyBadge,
} from "@/components/listingCard";

interface DealCardProps {
  deal: Deal;
  isWatching: boolean;
  isOnWatchlist: boolean;
  maxBid: string;
  onMaxBidChange: (v: string) => void;
  onWatchClick: () => void;
  onConfirmWatch: () => void;
  onRepriced?: (itemId: number, update: Partial<Deal>) => void;
  categories?: Category[];
}

/** Turn raw scanner tags like category:[13] into readable labels. */
export function formatDealKeyword(keyword: string, categories: Category[] = []): string {
  if (!keyword) return "";
  const match =
    keyword.match(/^category:\[([^\]]*)\]$/i) ||
    keyword.match(/^category:([\d,\s]+)$/i);
  if (!match) return keyword;
  const ids = match[1]
    .split(",")
    .map(s => Number(s.trim()))
    .filter(n => Number.isFinite(n) && n > 0);
  if (!ids.length) return "Category browse";
  return ids
    .map(id => categories.find(c => c.id === id)?.name ?? `Category ${id}`)
    .join(", ");
}

function ebaySearchUrl(term: string): string {
  return `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(term)}`;
}

export function DealCard({
  deal,
  isWatching,
  isOnWatchlist,
  maxBid,
  onMaxBidChange,
  onWatchClick,
  onConfirmWatch,
  onRepriced,
  categories = [],
}: DealCardProps) {
  const [showRecheck, setShowRecheck] = useState(false);
  const [searchTerm, setSearchTerm] = useState(deal.ebay_search ?? "");
  const [rechecking, setRechecking] = useState(false);

  const { label: timeLabel, urgency } = timeUntil(deal.end_time);
  const totalCost = deal.current_bid + (deal.shipping_est ?? 0);

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
    <div className={LISTING_CARD_SHELL}>
      <CardImage src={deal.image_url} alt={deal.title}>
        <CardTopBadges
          left={<UrgencyBadge label={timeLabel} urgency={urgency} />}
          right={<RoiBadge margin={deal.margin} />}
        />
        <DealImageOverlay
          profit={deal.profit}
          ebayMedian={deal.ebay_median}
          comps={deal.ebay_sold_count}
        />
      </CardImage>

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
            {formatDealKeyword(deal.keyword, categories)}
          </span>
        </div>

        <PriceCompareRow
          youPay={`$${totalCost.toFixed(2)}`}
          youPayDetail={`$${deal.current_bid.toFixed(2)} + $${(deal.shipping_est ?? 0).toFixed(2)} ship`}
          ebayValue={`$${deal.ebay_median.toFixed(2)}`}
          ebayDetail={`$${deal.ebay_low.toFixed(0)}–$${deal.ebay_high.toFixed(0)} range`}
        />

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
          {isOnWatchlist ? (
            <div className="w-full bg-zinc-800/50 border border-zinc-800 text-zinc-500 text-sm py-2.5 rounded-xl font-semibold text-center cursor-default">
              On Sniper
            </div>
          ) : isWatching ? (
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
