"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { repriceItem, updateWatchlistMaxBid, WatchlistItem } from "@/lib/api";
import {
  CardImage,
  CardTopBadges,
  LISTING_CARD_SHELL,
  PRICE_WELL,
  StatPill,
  StatusPill,
  TERMINAL_SNIPER_STATUSES,
  auctionHasEnded,
  displaySniperStatus,
  timeUntil,
  UrgencyBadge,
} from "@/components/listingCard";

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
  ended: "Ended",
  error: "Error",
};

const STATUS_TONE: Record<string, "blue" | "amber" | "emerald" | "green" | "sky" | "neutral" | "red"> = {
  scheduled: "blue",
  bid_placed: "amber",
  won: "emerald",
  awaiting_payment: "green",
  shipped: "sky",
  lost: "neutral",
  ended: "neutral",
  error: "red",
};

/** Max bid can change until the auction ends and before the sniper places a bid. */
export function canEditMaxBid(item: Pick<WatchlistItem, "end_time" | "sniper_status">): boolean {
  if (auctionHasEnded(item.end_time)) return false;
  const status = displaySniperStatus(item.sniper_status, item.end_time);
  return status === "scheduled" || status === "error";
}

export function EditableMaxBid({
  item,
  onUpdated,
  compact = false,
}: {
  item: WatchlistItem;
  onUpdated: (itemId: number, maxBid: number) => void;
  compact?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(item.max_bid));
  const [saving, setSaving] = useState(false);
  const editable = canEditMaxBid(item);

  const startEdit = () => {
    setValue(String(item.max_bid));
    setEditing(true);
  };

  const cancel = () => {
    setEditing(false);
    setValue(String(item.max_bid));
  };

  const save = async () => {
    const bid = parseFloat(value);
    if (!Number.isFinite(bid) || bid <= (item.current_bid ?? 0)) {
      toast.error(`Max bid must be > $${(item.current_bid ?? 0).toFixed(2)}`);
      return;
    }
    setSaving(true);
    try {
      const result = await updateWatchlistMaxBid(item.item_id, bid);
      onUpdated(item.item_id, result.max_bid);
      setEditing(false);
      toast.success(`Max bid updated to $${result.max_bid.toFixed(2)}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to update max bid");
    } finally {
      setSaving(false);
    }
  };

  if (!editable) {
    return compact ? (
      <span className="text-zinc-500">
        Max bid: <span className="text-green-400 font-semibold">${item.max_bid.toFixed(2)}</span>
      </span>
    ) : (
      <div className={`flex-1 ${PRICE_WELL}`}>
        <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold mb-1">Max bid</div>
        <div className="font-bold text-green-400 text-[15px]">${item.max_bid.toFixed(2)}</div>
      </div>
    );
  }

  if (editing) {
    return compact ? (
      <span className="inline-flex items-center gap-1.5">
        <span className="text-zinc-500">Max bid:</span>
        <span className="relative">
          <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-zinc-500 text-[11px]">$</span>
          <input
            type="number"
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") cancel();
            }}
            min={(item.current_bid ?? 0) + 0.5}
            step="0.50"
            autoFocus
            className="w-20 bg-zinc-800 border border-zinc-600 focus:border-green-500 rounded-md pl-4 pr-1.5 py-0.5 text-xs text-green-400 font-semibold focus:outline-none"
          />
        </span>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="text-green-400 hover:text-green-300 text-[11px] font-semibold disabled:opacity-50"
        >
          {saving ? "…" : "Save"}
        </button>
        <button type="button" onClick={cancel} className="text-zinc-600 hover:text-zinc-400 text-[11px]">
          ✕
        </button>
      </span>
    ) : (
      <div className={`flex-1 ${PRICE_WELL}`}>
        <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold mb-1">Max bid</div>
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <span className="absolute left-0 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
            <input
              type="number"
              value={value}
              onChange={e => setValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") save();
                if (e.key === "Escape") cancel();
              }}
              min={(item.current_bid ?? 0) + 0.5}
              step="0.50"
              autoFocus
              className="w-full bg-transparent border-b border-zinc-600 focus:border-green-500 pl-3.5 pr-1 py-0.5 text-[15px] font-bold text-green-400 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="text-[11px] font-semibold text-green-400 hover:text-green-300 disabled:opacity-50"
          >
            {saving ? "…" : "Save"}
          </button>
          <button type="button" onClick={cancel} className="text-zinc-600 hover:text-zinc-400 text-xs px-0.5">
            ✕
          </button>
        </div>
      </div>
    );
  }

  return compact ? (
    <span className="text-zinc-500">
      Max bid:{" "}
      <button
        type="button"
        onClick={startEdit}
        className="text-green-400 font-semibold hover:text-green-300 underline underline-offset-2 decoration-green-700/60"
        title="Edit max bid"
      >
        ${item.max_bid.toFixed(2)}
      </button>
    </span>
  ) : (
    <button
      type="button"
      onClick={startEdit}
      className={`flex-1 ${PRICE_WELL} text-left hover:border-zinc-500 transition-colors group`}
      title="Edit max bid"
    >
      <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold mb-1 flex items-center justify-between">
        Max bid
        <span className="normal-case tracking-normal font-medium text-zinc-600 group-hover:text-zinc-400">Edit</span>
      </div>
      <div className="font-bold text-green-400 text-[15px]">${item.max_bid.toFixed(2)}</div>
    </button>
  );
}

interface WatchlistCardProps {
  item: WatchlistItem;
  onRemove: (itemId: number) => void;
  onRepriced: (itemId: number, update: Partial<WatchlistItem>) => void;
  onMaxBidUpdated?: (itemId: number, maxBid: number) => void;
}

export function WatchlistCard({ item, onRemove, onRepriced, onMaxBidUpdated }: WatchlistCardProps) {
  const [showRecheck, setShowRecheck] = useState(false);
  const [searchTerm, setSearchTerm] = useState(item.ebay_search ?? "");
  const [rechecking, setRechecking] = useState(false);

  const { label: timeLabel, urgency } = timeUntil(item.end_time);
  const status = displaySniperStatus(item.sniper_status, item.end_time);
  const terminal = (TERMINAL_SNIPER_STATUSES as readonly string[]).includes(status);
  const statusLabel = STATUS_LABEL[status] ?? status;
  const statusTone = STATUS_TONE[status] ?? "blue";

  const paidTotal =
    (item.final_price ?? 0) +
    (item.final_shipping ?? 0) +
    (item.handling_price ?? 0) +
    (item.tax ?? 0);

  const shippedProfit =
    item.you_get != null && item.final_price != null
      ? item.you_get - paidTotal
      : item.ebay_median != null && item.final_price != null
      ? item.ebay_median - paidTotal
      : null;

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
        you_get: result.you_get,
        profit: result.profit,
        ebay_fee_pct: result.ebay_fee_pct,
        ebay_resale_shipping: result.ebay_resale_shipping,
      });
      setSearchTerm(result.ebay_search);
      setShowRecheck(false);
      toast.success(`Updated: $${result.ebay_median.toFixed(0)} eBay · +$${result.profit.toFixed(0)} net`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Recheck failed");
    } finally {
      setRechecking(false);
    }
  };

  return (
    <div className={LISTING_CARD_SHELL}>
      <CardImage src={item.image_url} alt={item.title}>
        <CardTopBadges
          left={
            !terminal ? (
              <UrgencyBadge
                label={timeLabel === "Ended" ? "Ended" : `Ends ${timeLabel}`}
                urgency={urgency}
              />
            ) : undefined
          }
          right={
            <StatusPill label={statusLabel} tone={statusTone} />
          }
        />

        <div className="absolute bottom-0 left-0 right-0 px-3 py-3">
          <div className="flex items-end justify-between gap-2">
            {item.ebay_median != null ? (
              <StatPill label="eBay Est." value={`$${item.ebay_median.toFixed(0)}`} size="md" />
            ) : (
              <div className="rounded-xl bg-black/70 backdrop-blur-md border border-white/10 px-3 py-2 text-sm text-white">
                No eBay estimate
              </div>
            )}
            {status === "shipped" && shippedProfit != null && (
              <StatPill
                label="vs paid"
                value={`${shippedProfit > 0 ? "+" : ""}$${shippedProfit.toFixed(0)}`}
                align="right"
                valueClassName={shippedProfit > 0 ? "text-green-400" : "text-red-400"}
                size="sm"
              />
            )}
            {status !== "shipped" && item.profit != null && item.profit > 0 && (
              <StatPill
                label="Net profit"
                value={`+$${item.profit.toFixed(0)}`}
                align="right"
                valueClassName="text-green-400"
                size="sm"
              />
            )}
          </div>
        </div>
      </CardImage>

      <div className="p-4 flex flex-col gap-3 flex-1">
        <a
          href={item.sgw_url ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-[13px] text-zinc-100 hover:text-zinc-50 line-clamp-2 leading-snug block"
        >
          {item.title}
        </a>

        {status === "awaiting_payment" ? (
          <div className="text-xs space-y-1.5">
            <div className={PRICE_WELL}>
              <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold mb-1">Won for</div>
              <div className="font-bold text-zinc-100 text-[15px]">${item.final_price?.toFixed(2) ?? "—"}</div>
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
        ) : status === "shipped" ? (
          <div className="text-xs space-y-1.5">
            <div className={PRICE_WELL}>
              <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold mb-1">Total paid</div>
              <div className="font-bold text-zinc-100 text-[15px]">${paidTotal.toFixed(2)}</div>
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
        ) : status === "lost" ? (
          <div className="text-xs text-zinc-500 rounded-xl bg-zinc-800/50 px-3 py-2.5">
            Outbid — max was ${item.max_bid.toFixed(2)}
          </div>
        ) : status === "ended" ? (
          <div className="text-xs text-zinc-500 rounded-xl bg-zinc-800/50 px-3 py-2.5">
            Auction ended — waiting for win/loss from ShopGoodwill
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs">
            <div className={`flex-1 ${PRICE_WELL}`}>
              <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold mb-1">Current</div>
              <div className="font-bold text-zinc-100 text-[15px]">${item.current_bid?.toFixed(2) ?? "—"}</div>
            </div>
            <EditableMaxBid
              item={item}
              onUpdated={(id, maxBid) => onMaxBidUpdated?.(id, maxBid)}
            />
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
                className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-zinc-100 text-xs px-3 py-1.5 rounded-lg font-semibold"
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
