"use client";

import { useEffect, useState } from "react";
import { getSettings, Settings, updateSetting } from "@/lib/api";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Partial<Settings>>({});
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");

  useEffect(() => {
    getSettings().then(s => { setSettings(s); setLoading(false); });
  }, []);

  const save = async (key: string, value: unknown) => {
    await updateSetting(key, value);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addKeyword = async () => {
    if (!newKeyword.trim()) return;
    const keywords = [...(settings.scan_keywords ?? []), newKeyword.trim()];
    setSettings(prev => ({ ...prev, scan_keywords: keywords }));
    await save("scan_keywords", keywords);
    setNewKeyword("");
  };

  const removeKeyword = async (kw: string) => {
    const keywords = (settings.scan_keywords ?? []).filter(k => k !== kw);
    setSettings(prev => ({ ...prev, scan_keywords: keywords }));
    await save("scan_keywords", keywords);
  };

  const NumField = ({
    label, settingKey, suffix = "", min = 0, step = 1,
  }: {
    label: string; settingKey: keyof Settings; suffix?: string; min?: number; step?: number;
  }) => (
    <div className="flex items-center justify-between py-3 border-b border-zinc-800 last:border-0">
      <label className="text-sm text-zinc-300">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={settings[settingKey] as number ?? 0}
          min={min}
          step={step}
          onChange={e => setSettings(prev => ({ ...prev, [settingKey]: Number(e.target.value) }))}
          onBlur={e => save(settingKey, Number(e.target.value))}
          className="w-24 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-sm text-zinc-100 text-right focus:outline-none focus:border-zinc-500"
        />
        {suffix && <span className="text-zinc-500 text-sm">{suffix}</span>}
      </div>
    </div>
  );

  if (loading) return <div className="text-zinc-500 text-sm">Loading settings...</div>;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Settings</h1>
        {saved && <span className="text-xs text-emerald-400">Saved</span>}
      </div>

      {/* Keywords */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-4">
        <h2 className="text-sm font-semibold mb-3">Search Keywords</h2>
        <p className="text-xs text-zinc-500 mb-4">
          Each keyword is searched on ShopGoodwill every scan. Be specific — "sony wh-1000xm4" works better than "headphones".
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          {(settings.scan_keywords ?? []).map(kw => (
            <div key={kw} className="flex items-center gap-1.5 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5">
              <span className="text-sm text-zinc-300">{kw}</span>
              <button
                onClick={() => removeKeyword(kw)}
                className="text-zinc-600 hover:text-zinc-400 transition-colors text-xs"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newKeyword}
            onChange={e => setNewKeyword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addKeyword()}
            placeholder="Add keyword..."
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
          />
          <button
            onClick={addKeyword}
            className="bg-zinc-700 hover:bg-zinc-600 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Add
          </button>
        </div>
      </div>

      {/* Profit thresholds */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-4">
        <h2 className="text-sm font-semibold mb-1">Deal Thresholds</h2>
        <p className="text-xs text-zinc-500 mb-4">Items must meet both criteria to appear as a deal.</p>
        <NumField label="Minimum profit" settingKey="min_profit_usd" suffix="$" min={0} step={5} />
        <NumField label="Minimum margin" settingKey="min_margin_pct" suffix="%" min={0} step={5} />
        <NumField label="Min eBay sold comps" settingKey="min_sold_comps" min={1} step={1} />
      </div>

      {/* Bid filters */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-4">
        <h2 className="text-sm font-semibold mb-1">Bid Range Filter</h2>
        <p className="text-xs text-zinc-500 mb-4">Items outside this range are skipped entirely.</p>
        <NumField label="Min bid (floor)" settingKey="min_bid_floor" suffix="$" min={0} step={1} />
        <NumField label="Max bid (cap)" settingKey="max_bid_cap" suffix="$" min={0} step={25} />
      </div>

      {/* Sniper + scan settings */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-4">
        <h2 className="text-sm font-semibold mb-1">Scanner & Sniper</h2>
        <NumField label="Scan interval" settingKey="scan_interval_minutes" suffix="min" min={5} step={5} />
        <NumField label="Snipe X seconds before end" settingKey="snipe_seconds_before" suffix="sec" min={10} step={5} />
        <NumField label="eBay sold listings lookback" settingKey="ebay_days_back" suffix="days" min={7} step={7} />
        <div className="flex items-center justify-between py-3">
          <label className="text-sm text-zinc-300">Your ZIP code (for shipping estimates)</label>
          <input
            type="text"
            value={settings.your_zip_code ?? ""}
            onChange={e => setSettings(prev => ({ ...prev, your_zip_code: e.target.value }))}
            onBlur={e => save("your_zip_code", e.target.value)}
            className="w-24 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-sm text-zinc-100 text-right focus:outline-none focus:border-zinc-500"
          />
        </div>
      </div>

      {/* Env vars reminder */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold mb-3">Credentials (set as environment variables)</h2>
        <div className="space-y-2 font-mono text-xs text-zinc-400">
          {[
            ["SGW_USERNAME", "Your ShopGoodwill username"],
            ["SGW_PASSWORD", "Your ShopGoodwill password"],
            ["EBAY_APP_ID", "eBay developer App ID (free at developer.ebay.com)"],
            ["OPENAI_API_KEY", "OpenAI key (optional — for GPT title cleaning)"],
          ].map(([k, v]) => (
            <div key={k} className="flex items-start gap-3">
              <span className="text-zinc-200 flex-shrink-0">{k}</span>
              <span className="text-zinc-600">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
