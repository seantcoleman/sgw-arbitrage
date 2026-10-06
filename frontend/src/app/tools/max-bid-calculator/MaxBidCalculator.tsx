"use client";

import { useMemo, useState } from "react";

function num(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function MaxBidCalculator() {
  const [ebaySold, setEbaySold] = useState("80");
  const [ebayFeePct, setEbayFeePct] = useState("13");
  const [shipOut, setShipOut] = useState("12");
  const [shipIn, setShipIn] = useState("15");
  const [targetProfit, setTargetProfit] = useState("20");

  const result = useMemo(() => {
    const sold = num(ebaySold);
    const feePct = num(ebayFeePct) / 100;
    const out = num(shipOut);
    const inn = num(shipIn);
    const profit = num(targetProfit);
    const netFromSale = sold * (1 - feePct) - out;
    const maxBid = netFromSale - inn - profit;
    return { netFromSale, maxBid };
  }, [ebaySold, ebayFeePct, shipOut, shipIn, targetProfit]);

  const field =
    "mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100";

  return (
    <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-zinc-400">
          eBay sold / expected sale ($)
          <input
            className={field}
            inputMode="decimal"
            value={ebaySold}
            onChange={(e) => setEbaySold(e.target.value)}
          />
        </label>
        <label className="block text-sm text-zinc-400">
          Marketplace fees (%)
          <input
            className={field}
            inputMode="decimal"
            value={ebayFeePct}
            onChange={(e) => setEbayFeePct(e.target.value)}
          />
        </label>
        <label className="block text-sm text-zinc-400">
          Shipping to buyer ($)
          <input
            className={field}
            inputMode="decimal"
            value={shipOut}
            onChange={(e) => setShipOut(e.target.value)}
          />
        </label>
        <label className="block text-sm text-zinc-400">
          ShopGoodwill shipping to you ($)
          <input
            className={field}
            inputMode="decimal"
            value={shipIn}
            onChange={(e) => setShipIn(e.target.value)}
          />
        </label>
        <label className="block text-sm text-zinc-400 sm:col-span-2">
          Target profit ($)
          <input
            className={field}
            inputMode="decimal"
            value={targetProfit}
            onChange={(e) => setTargetProfit(e.target.value)}
          />
        </label>
      </div>

      <div className="mt-8 rounded-xl border border-emerald-800/50 bg-zinc-950 px-4 py-5">
        <p className="text-xs uppercase tracking-wider text-emerald-400">Suggested max bid</p>
        <p className="mt-2 text-4xl font-black text-zinc-100">
          {result.maxBid > 0 ? `$${result.maxBid.toFixed(2)}` : "$0.00"}
        </p>
        <p className="mt-2 text-sm text-zinc-500">
          Net after sale fees &amp; outbound ship: ${result.netFromSale.toFixed(2)}. Formula: sale ×
          (1 − fee%) − ship out − SGW ship in − target profit. Tax and returns not included.
        </p>
        {result.maxBid <= 0 && (
          <p className="mt-2 text-sm text-amber-400/90">
            Edge is negative at these inputs — skip the lot or lower your profit target.
          </p>
        )}
      </div>
    </div>
  );
}
