"use client";

import Image from "next/image";
import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import { addToWatchlist, BrowseItem, getCategories, getBrowseItems, Category } from "@/lib/api";

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

function BrowseCard({ item }: { item: BrowseItem }) {
  const [maxBid, setMaxBid] = useState("");
  const [adding, setAdding] = useState(false);
  const { label: timeLabel, urgency } = timeUntil(item.endTime);

  const handleSnipe = async () => {
    const bid = parseFloat(maxBid);
    if (!bid || bid <= 0) { toast.error("Enter a valid max bid"); return; }
    setAdding(true);
    try {
      await addToWatchlist(item.itemId, bid);
      toast.success("Added to watchlist");
      setMaxBid("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add");
    } finally {
      setAdding(false);
    }
  };

  const urgencyColor = urgency === "urgent" ? "text-red-400" : urgency === "soon" ? "text-amber-400" : "text-zinc-500";

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col hover:border-zinc-700 transition-colors">
      <a href={item.sgwUrl} target="_blank" rel="noopener noreferrer" className="block relative bg-zinc-800 aspect-video overflow-hidden">
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={item.title}
            fill
            className="object-cover hover:scale-105 transition-transform duration-300"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-600">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </a>

      <div className="p-4 flex flex-col gap-3 flex-1">
        <div>
          <a href={item.sgwUrl} target="_blank" rel="noopener noreferrer"
            className="text-sm font-medium text-white leading-snug hover:text-green-400 transition-colors line-clamp-2">
            {item.title}
          </a>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">{item.categoryName}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-bold text-white">${item.currentPrice.toFixed(2)}</div>
            <div className="text-xs text-zinc-500">current bid</div>
          </div>
          <div className="text-right">
            <div className={`text-sm font-semibold ${urgencyColor}`}>{timeLabel}</div>
            <div className="text-xs text-zinc-600">ends</div>
          </div>
        </div>

        <div className="flex gap-2 mt-auto">
          <input
            type="number"
            placeholder="Max bid $"
            value={maxBid}
            onChange={e => setMaxBid(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSnipe()}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-green-600"
          />
          <button
            onClick={handleSnipe}
            disabled={adding}
            className="bg-green-700 hover:bg-green-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-white text-sm px-3 py-2 rounded-lg font-semibold transition-all"
          >
            {adding ? "…" : "Snipe"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BrowsePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [items, setItems] = useState<BrowseItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getCategories().then(d => setCategories(d.categories)).catch(() => {});
  }, []);

  const load = useCallback(async (ids: number[], pg: number) => {
    if (!ids.length) { setItems([]); setTotal(0); return; }
    setLoading(true);
    try {
      const d = await getBrowseItems(ids, pg);
      setItems(d.items);
      setTotal(d.total);
    } catch {
      toast.error("Failed to load items");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(selectedIds, page);
  }, [selectedIds, page, load]);

  const toggleCategory = (id: number) => {
    setPage(1);
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const totalPages = Math.ceil(total / 40);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Browse</h1>
        <p className="text-sm text-zinc-500 mt-1">Browse all SGW listings by category — no profit filter applied</p>
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {categories.map(cat => {
          const active = selectedIds.includes(cat.id);
          return (
            <button
              key={cat.id}
              onClick={() => toggleCategory(cat.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
                active
                  ? "bg-green-700 border-green-600 text-white"
                  : "bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
              }`}
            >
              {cat.name}
            </button>
          );
        })}
      </div>

      {selectedIds.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-zinc-600">
          <svg className="w-12 h-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h7" />
          </svg>
          <p className="text-lg font-medium">Select a category to browse</p>
          <p className="text-sm mt-1">Pick one or more categories above</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-32 text-zinc-500">
          <span className="w-6 h-6 border-2 border-zinc-600 border-t-green-500 rounded-full animate-spin mr-3" />
          Loading…
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-zinc-500">
              {total.toLocaleString()} items · page {page} of {totalPages || 1}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-zinc-300 transition-all"
              >
                ← Prev
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-zinc-300 transition-all"
              >
                Next →
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map(item => (
              <BrowseCard key={item.itemId} item={item} />
            ))}
          </div>

          {items.length > 0 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-zinc-300 transition-all"
              >
                ← Previous
              </button>
              <span className="text-sm text-zinc-500 px-3">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-zinc-300 transition-all"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
