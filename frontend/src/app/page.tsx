"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  addToWatchlist,
  Category,
  Deal,
  getCategories,
  getDeals,
  getScanStatus,
  getSettings,
  triggerScan,
  updateSetting,
} from "@/lib/api";
import { CategoryFilter } from "@/components/CategoryFilter";
import { DealCard } from "@/components/DealCard";

function ScanNumField({
  label,
  description,
  value,
  onChange,
  onSave,
  suffix = "",
  min = 0,
  step = 1,
}: {
  label: string;
  description?: string;
  value: number;
  onChange: (v: number) => void;
  onSave: (v: number) => void;
  suffix?: string;
  min?: number;
  step?: number;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-zinc-800/60 last:border-0">
      <div className="pr-4">
        <div className="text-sm font-medium text-zinc-200">{label}</div>
        {description && <div className="text-xs text-zinc-600 mt-0.5">{description}</div>}
      </div>
      <div className="flex items-center bg-zinc-800 border border-zinc-700 focus-within:border-zinc-500 rounded-lg overflow-hidden transition-colors flex-shrink-0">
        <input
          type="number"
          value={value}
          min={min}
          step={step}
          onChange={e => onChange(Number(e.target.value))}
          onBlur={e => onSave(Number(e.target.value))}
          className="w-20 bg-transparent px-3 py-2 text-sm text-zinc-100 text-right focus:outline-none"
        />
        {suffix && <span className="text-zinc-500 text-xs pr-3">{suffix}</span>}
      </div>
    </div>
  );
}

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [totalDeals, setTotalDeals] = useState(0);
  const [loading, setLoading] = useState(true);
  const [minProfit, setMinProfit] = useState(0);
  const [minMargin, setMinMargin] = useState(0);
  const [watchingId, setWatchingId] = useState<number | null>(null);
  const [maxBidInput, setMaxBidInput] = useState<Record<number, string>>({});
  const [error, setError] = useState("");
  const [scanRunning, setScanRunning] = useState(false);
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);
  const [lastScanItems, setLastScanItems] = useState<number | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCatIds, setSelectedCatIds] = useState<number[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [showScanFilters, setShowScanFilters] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [scanMinProfit, setScanMinProfit] = useState(15);
  const [scanMinMargin, setScanMinMargin] = useState(25);
  const [minSoldComps, setMinSoldComps] = useState(5);
  const [minBidFloor, setMinBidFloor] = useState(3);
  const [maxBidCap, setMaxBidCap] = useState(300);

  const fetchDeals = async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const data = await getDeals({ min_profit: minProfit || 0, min_margin: minMargin || 0 });
      setDeals(data.deals);
      setTotalDeals(data.count);
    } catch {
      setError("Cannot reach backend — make sure it's running on port 8000.");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const saveScanSetting = async (key: string, value: unknown) => {
    try {
      await updateSetting(key, value);
    } catch {
      toast.error("Failed to save setting");
    }
  };

  const loadScanSettings = async () => {
    setCategoriesLoading(true);
    try {
      const [s, c] = await Promise.all([
        getSettings().catch(() => null),
        getCategories(),
      ]);
      if (s) {
        setSelectedCatIds(s.scan_category_ids ?? []);
        setKeywords(s.scan_keywords ?? []);
        setScanMinProfit(s.min_profit_usd ?? 15);
        setScanMinMargin(s.min_margin_pct ?? 25);
        setMinSoldComps(s.min_sold_comps ?? 5);
        setMinBidFloor(s.min_bid_floor ?? 3);
        setMaxBidCap(s.max_bid_cap ?? 300);
      }
      setCategories(c.categories);
    } catch {
      // keep existing; CategoryFilter shows empty-state message
    } finally {
      setCategoriesLoading(false);
    }
  };

  useEffect(() => {
    loadScanSettings();
  }, []);

  useEffect(() => {
    fetchDeals();
  }, [minProfit, minMargin]);

  useEffect(() => {
    const poll = async () => {
      const scan = await getScanStatus().catch(() => ({ running: false, recent_scans: [] }));
      const wasRunning = scanRunning;
      setScanRunning(scan.running);
      const scans = (scan as { recent_scans?: { finished_at?: string; items_scanned?: number }[] }).recent_scans;
      if (scans?.length) {
        setLastScanTime(scans[0].finished_at ?? null);
        setLastScanItems(scans[0].items_scanned ?? null);
      }
      if (wasRunning && !scan.running) fetchDeals(true);
    };
    poll();
    const interval = setInterval(poll, 20000);
    return () => clearInterval(interval);
  }, [scanRunning]);

  const openScanFilters = () => {
    setShowScanFilters(v => {
      const next = !v;
      if (next && categories.length === 0) loadScanSettings();
      return next;
    });
  };

  const toggleCategory = async (id: number) => {
    const updated = selectedCatIds.includes(id)
      ? selectedCatIds.filter(c => c !== id)
      : [...selectedCatIds, id];
    setSelectedCatIds(updated);
    try {
      await updateSetting("scan_category_ids", updated);
    } catch {
      toast.error("Failed to save category filter");
    }
  };

  const clearCategories = async () => {
    setSelectedCatIds([]);
    try {
      await updateSetting("scan_category_ids", []);
    } catch {
      toast.error("Failed to clear category filter");
    }
  };

  const addKeyword = async () => {
    const kw = newKeyword.trim().toLowerCase();
    if (!kw) return;
    if (keywords.includes(kw)) {
      toast.error("Keyword already exists");
      return;
    }
    const updated = [...keywords, kw];
    setKeywords(updated);
    setNewKeyword("");
    try {
      await updateSetting("scan_keywords", updated);
    } catch {
      toast.error("Failed to save keyword");
    }
  };

  const removeKeyword = async (kw: string) => {
    const updated = keywords.filter(k => k !== kw);
    setKeywords(updated);
    try {
      await updateSetting("scan_keywords", updated);
    } catch {
      toast.error("Failed to remove keyword");
    }
  };

  const handleWatch = async (deal: Deal) => {
    const maxBid = parseFloat(maxBidInput[deal.item_id] ?? "0");
    if (!maxBid || maxBid <= deal.current_bid) {
      toast.error(`Max bid must be > $${deal.current_bid.toFixed(2)}`);
      return;
    }
    try {
      await addToWatchlist(deal.item_id, maxBid);
      setWatchingId(null);
      toast.success(`Queued! Sniper will bid up to $${maxBid.toFixed(2)}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error adding to watchlist");
    }
  };

  const handleScanNow = async () => {
    try {
      await triggerScan();
      setScanRunning(true);
      toast("Scan started — checking SGW for deals...", { icon: "🔍" });
    } catch {
      toast.error("Failed to start scan");
    }
  };

  const totalProfit = deals.reduce((s, d) => s + d.profit, 0);
  const bestDeal = deals.length ? deals.reduce((best, d) => d.profit > best.profit ? d : best) : null;
  const scanFilterCount = keywords.length + selectedCatIds.length;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-3xl font-black text-white tracking-tight">Deals</h1>
          <button
            onClick={handleScanNow}
            disabled={scanRunning}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-500 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-green-900/30"
          >
            {scanRunning ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Scanning…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Scan Now
              </>
            )}
          </button>
        </div>
        <p className="text-zinc-500 text-sm">
          ShopGoodwill listings with eBay arbitrage potential
          {lastScanTime && (
            <span className="text-zinc-600"> · last scan {new Date(lastScanTime).toLocaleTimeString()}</span>
          )}
          {lastScanItems !== null && (
            <span className="text-zinc-600"> · {lastScanItems} items checked</span>
          )}
        </p>
        {lastScanItems !== null && lastScanItems >= 200 && (
          <p className="text-xs text-zinc-600 mt-1">
            Only the first {lastScanItems} SGW listings were scanned. Raise{" "}
            <a href="/settings" className="text-zinc-400 underline underline-offset-2 hover:text-zinc-200">
              Max items per scan
            </a>{" "}
            in Settings to cover more — or use Browse to see all listings.
          </p>
        )}
      </div>

      {/* Scan running banner */}
      {scanRunning && (
        <div className="flex items-center gap-3 bg-amber-950/30 border border-amber-800/40 text-amber-300 rounded-xl px-4 py-3 mb-5 text-sm">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
          Scanning ShopGoodwill — this takes 1–2 minutes. Page updates automatically.
        </div>
      )}

      {/* Stats + Filters row */}
      {!loading && (
        <div className="mb-6 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            {deals.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2">
                  <span className="text-zinc-500 text-xs">Deals</span>
                  <span className="text-white font-bold text-sm">{deals.length}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2">
                  <span className="text-zinc-500 text-xs">Potential</span>
                  <span className="text-green-400 font-bold text-sm">${totalProfit.toFixed(0)}</span>
                </div>
                {bestDeal && (
                  <div className="hidden sm:flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2">
                    <span className="text-zinc-500 text-xs">Best</span>
                    <span className="text-white font-bold text-sm">+${bestDeal.profit.toFixed(0)}</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex-1" />

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={openScanFilters}
                className={`flex items-center gap-2 text-sm px-3.5 py-2 rounded-xl border font-medium transition-all ${
                  showScanFilters || scanFilterCount > 0
                    ? "bg-green-950/40 border-green-800/60 text-green-300"
                    : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                Scan filters
                {scanFilterCount > 0 && (
                  <span className="bg-green-700 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md min-w-[1.25rem] text-center">
                    {scanFilterCount}
                  </span>
                )}
              </button>
              <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <span className="text-zinc-500 text-xs pl-3">$</span>
                <input
                  type="number"
                  value={minProfit || ""}
                  onChange={e => setMinProfit(Number(e.target.value))}
                  placeholder="Min profit"
                  className="w-24 bg-transparent py-2 px-2 text-sm text-zinc-100 focus:outline-none placeholder:text-zinc-700"
                  min={0}
                  step={5}
                />
              </div>
              <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <input
                  type="number"
                  value={minMargin || ""}
                  onChange={e => setMinMargin(Number(e.target.value))}
                  placeholder="Min ROI %"
                  className="w-24 bg-transparent py-2 px-3 text-sm text-zinc-100 focus:outline-none placeholder:text-zinc-700"
                  min={0}
                  max={100}
                  step={10}
                />
                <span className="text-zinc-500 text-xs pr-3">%</span>
              </div>
              {(minProfit > 0 || minMargin > 0) && (
                <button
                  onClick={() => { setMinProfit(0); setMinMargin(0); }}
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {showScanFilters && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-4 space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-zinc-200">Scan filters</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Controls what the next scan looks for and which items qualify as deals.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowScanFilters(false)}
                  className="text-zinc-600 hover:text-zinc-300 text-sm px-1"
                >
                  ✕
                </button>
              </div>

              <div>
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Keywords</p>
                <p className="text-xs text-zinc-600 mb-3">
                  Each keyword is searched on ShopGoodwill. Be specific — &apos;sony wh-1000xm4&apos; beats &apos;headphones&apos;.
                </p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {keywords.map(kw => (
                    <div key={kw} className="flex items-center gap-1.5 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-1.5 group">
                      <span className="text-sm text-zinc-300">{kw}</span>
                      <button
                        type="button"
                        onClick={() => removeKeyword(kw)}
                        className="text-zinc-600 hover:text-zinc-300 transition-colors text-xs ml-0.5 opacity-0 group-hover:opacity-100"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {keywords.length === 0 && (
                    <p className="text-sm text-zinc-600">No keywords yet — add one below, or rely on categories alone.</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newKeyword}
                    onChange={e => setNewKeyword(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addKeyword()}
                    placeholder="e.g. sony wh-1000xm4"
                    className="flex-1 bg-zinc-800 border border-zinc-700 focus:border-zinc-500 rounded-xl px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={addKeyword}
                    className="bg-zinc-700 hover:bg-zinc-600 text-white text-sm px-5 py-2.5 rounded-xl font-semibold transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="border-t border-zinc-800 pt-5">
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Categories</p>
                <p className="text-xs text-zinc-600 mb-3">
                  {selectedCatIds.length === 0
                    ? "Scanning all categories when no filter is set."
                    : `${selectedCatIds.length} selected.`}
                </p>
                <CategoryFilter
                  categories={categories}
                  selectedIds={selectedCatIds}
                  onToggle={toggleCategory}
                  onClear={clearCategories}
                  loading={categoriesLoading}
                />
              </div>

              <div className="border-t border-zinc-800 pt-5">
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Deal thresholds</p>
                <p className="text-xs text-zinc-600 mb-3">Items must meet both criteria to surface as a deal.</p>
                <div className="space-y-0">
                  <ScanNumField
                    label="Minimum profit"
                    description="Skip items below this profit estimate"
                    value={scanMinProfit}
                    onChange={setScanMinProfit}
                    onSave={v => saveScanSetting("min_profit_usd", v)}
                    suffix="$"
                    step={5}
                  />
                  <ScanNumField
                    label="Minimum margin"
                    description="Profit as a % of total cost"
                    value={scanMinMargin}
                    onChange={setScanMinMargin}
                    onSave={v => saveScanSetting("min_margin_pct", v)}
                    suffix="%"
                    step={5}
                  />
                  <ScanNumField
                    label="Min eBay comps"
                    description="Need at least this many matching eBay listings"
                    value={minSoldComps}
                    onChange={setMinSoldComps}
                    onSave={v => saveScanSetting("min_sold_comps", v)}
                    min={1}
                  />
                </div>
              </div>

              <div className="border-t border-zinc-800 pt-5">
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Bid range</p>
                <p className="text-xs text-zinc-600 mb-3">Items outside this price range are skipped before any eBay lookup.</p>
                <div className="space-y-0">
                  <ScanNumField
                    label="Min bid"
                    value={minBidFloor}
                    onChange={setMinBidFloor}
                    onSave={v => saveScanSetting("min_bid_floor", v)}
                    suffix="$"
                  />
                  <ScanNumField
                    label="Max bid cap"
                    value={maxBidCap}
                    onChange={setMaxBidCap}
                    onSave={v => saveScanSetting("max_bid_cap", v)}
                    suffix="$"
                    step={25}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-950/50 border border-red-800/50 text-red-300 rounded-xl p-4 mb-6 text-sm flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden animate-pulse">
              <div className="h-48 bg-zinc-800" />
              <div className="p-4 space-y-3">
                <div className="h-4 bg-zinc-800 rounded-lg w-3/4" />
                <div className="h-3 bg-zinc-800 rounded-lg w-1/4" />
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="h-16 bg-zinc-800 rounded-xl" />
                  <div className="h-16 bg-zinc-800 rounded-xl" />
                </div>
                <div className="h-10 bg-zinc-800 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : deals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-40 text-center">
          <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-zinc-300 mb-1">No deals yet</h2>
          <p className="text-sm text-zinc-600 max-w-xs mb-5">
            Add keywords or categories under Scan filters, then run a scan.
          </p>
          <button
            onClick={handleScanNow}
            disabled={scanRunning}
            className="bg-green-600 hover:bg-green-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors"
          >
            {scanRunning ? "Scanning…" : "Run First Scan"}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowScanFilters(true);
              if (categories.length === 0) loadScanSettings();
            }}
            className="text-xs text-zinc-500 hover:text-zinc-300 mt-3 transition-colors"
          >
            Open scan filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {deals.map(deal => (
            <DealCard
              key={deal.item_id}
              deal={deal}
              isWatching={watchingId === deal.item_id}
              maxBid={maxBidInput[deal.item_id] ?? ""}
              onMaxBidChange={v => setMaxBidInput(prev => ({ ...prev, [deal.item_id]: v }))}
              onWatchClick={() => setWatchingId(watchingId === deal.item_id ? null : deal.item_id)}
              onConfirmWatch={() => handleWatch(deal)}
              onRepriced={(itemId, update) => {
                setDeals(prev => prev.map(d => d.item_id === itemId ? { ...d, ...update } : d));
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
