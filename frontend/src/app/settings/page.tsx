"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Category, getCategories, getSettings, Settings, updateSetting } from "@/lib/api";

// ── Standalone components (defined OUTSIDE SettingsPage to prevent re-mounting) ──

function Section({ title, description, children }: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden mb-4">
      <div className="px-5 py-4 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {description && <p className="text-xs text-zinc-500 mt-0.5">{description}</p>}
      </div>
      <div className="px-5">{children}</div>
    </div>
  );
}

function NumField({ label, description, value, onChange, onSave, suffix = "", min = 0, step = 1 }: {
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
    <div className="flex items-center justify-between py-4 border-b border-zinc-800/60 last:border-0">
      <div>
        <div className="text-sm font-medium text-zinc-200">{label}</div>
        {description && <div className="text-xs text-zinc-600 mt-0.5">{description}</div>}
      </div>
      <div className="flex items-center bg-zinc-800 border border-zinc-700 rounded-lg overflow-hidden focus-within:border-zinc-500 transition-colors">
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

// ── Main page ──────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [settings, setSettings] = useState<Partial<Settings>>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyword, setNewKeyword] = useState("");
  const [zipValue, setZipValue] = useState("");

  useEffect(() => {
    Promise.all([
      getSettings(),
      getCategories().catch(() => ({ categories: [] })),
    ]).then(([s, c]) => {
      setSettings(s);
      setZipValue(s.your_zip_code ?? "");
      setCategories(c.categories);
      setLoading(false);
    });
  }, []);

  const save = async (key: string, value: unknown) => {
    await updateSetting(key, value);
    toast.success("Saved");
  };

  const addKeyword = async () => {
    const kw = newKeyword.trim().toLowerCase();
    if (!kw) return;
    if ((settings.scan_keywords ?? []).includes(kw)) {
      toast.error("Keyword already exists");
      return;
    }
    const keywords = [...(settings.scan_keywords ?? []), kw];
    setSettings(prev => ({ ...prev, scan_keywords: keywords }));
    await save("scan_keywords", keywords);
    setNewKeyword("");
  };

  const removeKeyword = async (kw: string) => {
    const keywords = (settings.scan_keywords ?? []).filter(k => k !== kw);
    setSettings(prev => ({ ...prev, scan_keywords: keywords }));
    await updateSetting("scan_keywords", keywords);
  };

  const toggleCategory = async (id: number) => {
    const current = settings.scan_category_ids ?? [];
    const updated = current.includes(id)
      ? current.filter(c => c !== id)
      : [...current, id];
    setSettings(prev => ({ ...prev, scan_category_ids: updated }));
    await updateSetting("scan_category_ids", updated);
  };

  if (loading) return (
    <div className="max-w-2xl">
      <div className="h-8 bg-zinc-800 rounded-xl w-32 mb-6 animate-pulse" />
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl h-48 mb-4 animate-pulse" />
      ))}
    </div>
  );

  const selectedCatIds = settings.scan_category_ids ?? [];

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white tracking-tight">Settings</h1>
        <p className="text-zinc-500 text-sm mt-1">Configure keywords, thresholds, and sniper timing</p>
      </div>

      {/* Keywords */}
      <Section
        title="Search Keywords"
        description="Each keyword is searched on ShopGoodwill every scan. Be specific — 'sony wh-1000xm4' beats 'headphones'."
      >
        <div className="py-4">
          <div className="flex flex-wrap gap-2 mb-4">
            {(settings.scan_keywords ?? []).map(kw => (
              <div key={kw} className="flex items-center gap-1.5 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-1.5 group">
                <span className="text-sm text-zinc-300">{kw}</span>
                <button
                  onClick={() => removeKeyword(kw)}
                  className="text-zinc-600 hover:text-zinc-300 transition-colors text-xs ml-0.5 opacity-0 group-hover:opacity-100"
                >
                  ✕
                </button>
              </div>
            ))}
            {(settings.scan_keywords ?? []).length === 0 && (
              <p className="text-sm text-zinc-600">No keywords yet — add one below.</p>
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
              onClick={addKeyword}
              className="bg-zinc-700 hover:bg-zinc-600 text-white text-sm px-5 py-2.5 rounded-xl font-semibold transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      </Section>

      {/* Categories */}
      <Section
        title="Category Filter"
        description={`Limit scans to specific SGW categories. ${selectedCatIds.length === 0 ? "Currently scanning all categories." : `${selectedCatIds.length} selected.`}`}
      >
        <div className="py-4">
          {categories.length === 0 ? (
            <p className="text-sm text-zinc-600">Could not load categories from SGW.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 mb-3">
                {categories.map(cat => {
                  const selected = selectedCatIds.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      onClick={() => toggleCategory(cat.id)}
                      className={`text-xs px-3 py-1.5 rounded-xl border font-medium transition-all ${
                        selected
                          ? "bg-green-900/40 border-green-700 text-green-300"
                          : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {cat.name}
                    </button>
                  );
                })}
              </div>
              {selectedCatIds.length > 0 && (
                <button
                  onClick={() => {
                    setSettings(prev => ({ ...prev, scan_category_ids: [] }));
                    updateSetting("scan_category_ids", []);
                  }}
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Clear all (scan everything)
                </button>
              )}
            </>
          )}
        </div>
      </Section>

      {/* Deal thresholds */}
      <Section title="Deal Thresholds" description="Items must meet both criteria to surface as a deal.">
        <NumField
          label="Minimum profit" description="Skip items below this profit estimate"
          value={settings.min_profit_usd ?? 15}
          onChange={v => setSettings(prev => ({ ...prev, min_profit_usd: v }))}
          onSave={v => save("min_profit_usd", v)}
          suffix="$" min={0} step={5}
        />
        <NumField
          label="Minimum margin" description="Profit as a % of total cost"
          value={settings.min_margin_pct ?? 25}
          onChange={v => setSettings(prev => ({ ...prev, min_margin_pct: v }))}
          onSave={v => save("min_margin_pct", v)}
          suffix="%" min={0} step={5}
        />
        <NumField
          label="Min eBay comps" description="Need at least this many matching eBay listings"
          value={settings.min_sold_comps ?? 5}
          onChange={v => setSettings(prev => ({ ...prev, min_sold_comps: v }))}
          onSave={v => save("min_sold_comps", v)}
          min={1} step={1}
        />
      </Section>

      {/* Bid range */}
      <Section title="Bid Range" description="Items outside this price range are skipped before any eBay lookup.">
        <NumField
          label="Min bid"
          value={settings.min_bid_floor ?? 3}
          onChange={v => setSettings(prev => ({ ...prev, min_bid_floor: v }))}
          onSave={v => save("min_bid_floor", v)}
          suffix="$" min={0} step={1}
        />
        <NumField
          label="Max bid cap"
          value={settings.max_bid_cap ?? 300}
          onChange={v => setSettings(prev => ({ ...prev, max_bid_cap: v }))}
          onSave={v => save("max_bid_cap", v)}
          suffix="$" min={0} step={25}
        />
      </Section>

      {/* Scanner & sniper */}
      <Section title="Scanner & Sniper">
        <NumField
          label="Scan interval" description="How often to auto-scan in the background"
          value={settings.scan_interval_minutes ?? 15}
          onChange={v => setSettings(prev => ({ ...prev, scan_interval_minutes: v }))}
          onSave={v => save("scan_interval_minutes", v)}
          suffix="min" min={5} step={5}
        />
        <NumField
          label="Snipe timing" description="Place bid this many seconds before auction ends"
          value={settings.snipe_seconds_before ?? 30}
          onChange={v => setSettings(prev => ({ ...prev, snipe_seconds_before: v }))}
          onSave={v => save("snipe_seconds_before", v)}
          suffix="sec" min={10} step={5}
        />
        <NumField
          label="eBay lookback" description="Days of eBay listing history to use for pricing"
          value={settings.ebay_days_back ?? 90}
          onChange={v => setSettings(prev => ({ ...prev, ebay_days_back: v }))}
          onSave={v => save("ebay_days_back", v)}
          suffix="days" min={7} step={7}
        />
        <div className="flex items-center justify-between py-4">
          <div>
            <div className="text-sm font-medium text-zinc-200">ZIP code</div>
            <div className="text-xs text-zinc-600 mt-0.5">Used for shipping estimates</div>
          </div>
          <div className="flex items-center bg-zinc-800 border border-zinc-700 rounded-lg overflow-hidden focus-within:border-zinc-500 transition-colors">
            <input
              type="text"
              value={zipValue}
              onChange={e => setZipValue(e.target.value)}
              onBlur={() => save("your_zip_code", zipValue)}
              className="w-24 bg-transparent px-3 py-2 text-sm text-zinc-100 text-center focus:outline-none"
              placeholder="90210"
              maxLength={10}
            />
          </div>
        </div>
      </Section>

      {/* Credentials */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800">
          <h2 className="text-sm font-semibold text-white">Credentials</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Set in <code className="text-zinc-400 bg-zinc-800 px-1 py-0.5 rounded">backend/.env</code> — restart the server after changes
          </p>
        </div>
        <div className="px-5 py-4 space-y-3">
          {[
            { key: "SGW_USERNAME", desc: "ShopGoodwill username" },
            { key: "SGW_PASSWORD", desc: "ShopGoodwill password" },
            { key: "EBAY_APP_ID", desc: "eBay Developer App ID" },
            { key: "EBAY_CERT_ID", desc: "eBay Cert ID (Client Secret)" },
          ].map(({ key, desc }) => (
            <div key={key} className="flex items-center gap-3 text-xs">
              <code className="text-zinc-300 bg-zinc-800 px-2 py-1 rounded-lg font-mono w-40 flex-shrink-0">{key}</code>
              <span className="text-zinc-600">{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
