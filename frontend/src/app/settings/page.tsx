"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { getSettings, Settings, updateSetting } from "@/lib/api";

function Section({ title, description, children }: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden mb-4">
      <div className="px-5 py-4 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
        {description && <p className="text-xs text-zinc-500 mt-0.5">{description}</p>}
      </div>
      <div className="px-5">{children}</div>
    </div>
  );
}

function NumField({ label, description, value, onChange, onSave, suffix = "", min = 0, step = 1, readOnly = false }: {
  label: string;
  description?: string;
  value: number;
  onChange: (v: number) => void;
  onSave: (v: number) => void;
  suffix?: string;
  min?: number;
  step?: number;
  readOnly?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-zinc-800/60 last:border-0">
      <div>
        <div className="text-sm font-medium text-zinc-200">{label}</div>
        {description && <div className="text-xs text-zinc-600 mt-0.5">{description}</div>}
      </div>
      <div className={`flex items-center border rounded-lg overflow-hidden transition-colors ${readOnly ? "bg-zinc-800/50 border-zinc-700/50" : "bg-zinc-800 border-zinc-700 focus-within:border-zinc-500"}`}>
        <input
          type="number"
          value={value}
          min={min}
          step={step}
          readOnly={readOnly}
          onChange={e => !readOnly && onChange(Number(e.target.value))}
          onBlur={e => !readOnly && onSave(Number(e.target.value))}
          className={`w-20 bg-transparent px-3 py-2 text-sm text-right focus:outline-none ${readOnly ? "text-zinc-400 cursor-default" : "text-zinc-100"}`}
        />
        {suffix && <span className="text-zinc-500 text-xs pr-3">{suffix}</span>}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Partial<Settings>>({});
  const [loading, setLoading] = useState(true);
  const [zipValue, setZipValue] = useState("");

  useEffect(() => {
    getSettings().then(s => {
      setSettings(s);
      setZipValue(s.your_zip_code ?? "");
      setLoading(false);
    });
  }, []);

  const save = async (key: string, value: unknown) => {
    await updateSetting(key, value);
    toast.success("Saved");
  };

  if (loading) return (
    <div className="max-w-2xl">
      <div className="h-8 bg-zinc-800 rounded-xl w-32 mb-6 animate-pulse" />
      {[...Array(2)].map((_, i) => (
        <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl h-48 mb-4 animate-pulse" />
      ))}
    </div>
  );

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-zinc-100 tracking-tight">Settings</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Sniper timing and credentials. Scan filters live on the Deals page.
        </p>
      </div>

      <Section title="Scanner & Sniper">
        <NumField
          label="Max items per scan"
          description="Hard-capped at 200 to stay within eBay API limits. ~30s scan time."
          value={200}
          onChange={() => {}}
          onSave={() => {}}
          suffix="items" min={200} step={200}
          readOnly
        />
        <div className="flex items-center justify-between py-4 border-b border-zinc-800/60">
          <div>
            <div className="text-sm font-medium text-zinc-200">Scan interval</div>
            <div className="text-xs text-zinc-600 mt-0.5">
              The backend auto-scans every 2 hours — new deals appear automatically
            </div>
          </div>
          <div className="flex items-center bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 gap-1.5">
            <span className="text-sm text-zinc-400 font-medium">120</span>
            <span className="text-xs text-zinc-600">min</span>
          </div>
        </div>
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

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-100">Credentials</h2>
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
