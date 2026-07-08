"use client";

import { Deal } from "@/lib/api";

interface DealCardProps {
  deal: Deal;
  isWatching: boolean;
  maxBid: string;
  onMaxBidChange: (v: string) => void;
  onWatchClick: () => void;
  onConfirmWatch: () => void;
}

function timeUntil(endTime: string | null): string {
  if (!endTime) return "Unknown";
  const end = new Date(endTime + " PST");
  const diff = end.getTime() - Date.now();
  if (diff < 0) return "Ended";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return `${h}h ${m}m`;
}

export function DealCard({
  deal,
  isWatching,
  maxBid,
  onMaxBidChange,
  onWatchClick,
  onConfirmWatch,
}: DealCardProps) {
  const marginPct = (deal.margin * 100).toFixed(0);
  const totalCost = deal.current_bid + (deal.shipping_est ?? 0);
  const marginColor =
    deal.margin >= 0.6 ? "text-emerald-400" :
    deal.margin >= 0.4 ? "text-yellow-400" :
    "text-orange-400";

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-700 transition-colors flex flex-col">
      {/* Image */}
      {deal.image_url ? (
        <div className="h-36 bg-zinc-800 overflow-hidden">
          <img
            src={deal.image_url}
            alt={deal.title}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="h-36 bg-zinc-800 flex items-center justify-center text-zinc-600 text-xs">
          No image
        </div>
      )}

      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Title + keyword */}
        <div>
          <a
            href={deal.sgw_url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-sm text-zinc-100 hover:text-white line-clamp-2 leading-snug"
          >
            {deal.title}
          </a>
          <div className="text-xs text-zinc-600 mt-0.5">#{deal.keyword}</div>
        </div>

        {/* Price breakdown */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-zinc-800 rounded-lg p-2.5">
            <div className="text-zinc-500 mb-0.5">SGW Bid</div>
            <div className="font-semibold text-zinc-100">${deal.current_bid.toFixed(2)}</div>
            {deal.shipping_est && (
              <div className="text-zinc-600 mt-0.5">+${deal.shipping_est.toFixed(2)} ship</div>
            )}
          </div>
          <div className="bg-zinc-800 rounded-lg p-2.5">
            <div className="text-zinc-500 mb-0.5">eBay Sold</div>
            <div className="font-semibold text-zinc-100">${deal.ebay_median.toFixed(2)}</div>
            <div className="text-zinc-600 mt-0.5">{deal.ebay_sold_count} comps</div>
          </div>
        </div>

        {/* Profit highlight */}
        <div className="flex items-center justify-between bg-zinc-800/50 rounded-lg px-3 py-2">
          <div>
            <div className="text-xs text-zinc-500">Est. Profit</div>
            <div className="font-bold text-emerald-400">${deal.profit.toFixed(2)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-zinc-500">Margin</div>
            <div className={`font-bold ${marginColor}`}>{marginPct}%</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-zinc-500">Ends in</div>
            <div className="font-medium text-zinc-300 text-sm">{timeUntil(deal.end_time)}</div>
          </div>
        </div>

        {/* eBay search term */}
        <div className="text-xs text-zinc-600">
          eBay: <span className="text-zinc-500 italic">"{deal.ebay_search}"</span>
        </div>

        {/* Watch / bid section */}
        {isWatching ? (
          <div className="flex gap-2 mt-auto">
            <div className="relative flex-1">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
              <input
                type="number"
                value={maxBid}
                onChange={e => onMaxBidChange(e.target.value)}
                placeholder={`Max bid (>${deal.current_bid.toFixed(2)})`}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-5 pr-2 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-600"
                step="0.50"
                min={deal.current_bid + 0.5}
              />
            </div>
            <button
              onClick={onConfirmWatch}
              className="bg-emerald-700 hover:bg-emerald-600 text-white text-xs px-3 py-2 rounded-lg font-medium transition-colors"
            >
              Snipe
            </button>
            <button
              onClick={onWatchClick}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs px-3 py-2 rounded-lg transition-colors"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={onWatchClick}
            className="mt-auto w-full bg-zinc-800 hover:bg-emerald-900 hover:border-emerald-700 border border-zinc-700 text-zinc-300 hover:text-emerald-300 text-xs py-2 rounded-lg font-medium transition-colors"
          >
            + Add to Sniper
          </button>
        )}
      </div>
    </div>
  );
}
