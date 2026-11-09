"use client";

import { useMemo, useState } from "react";
import {
  PRO_MONTHLY_USD,
  STANDARD_SUCCESS_FEE_PCT,
} from "@/lib/seo";

function num(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

type Verdict = "snipe" | "skip" | "thin";

export function BidStrategyCalculator() {
  const [ebaySold, setEbaySold] = useState("80");
  const [ebayFeePct, setEbayFeePct] = useState("13");
  const [shipOut, setShipOut] = useState("12");
  const [shipIn, setShipIn] = useState("15");
  const [targetProfit, setTargetProfit] = useState("20");
  const [currentBid, setCurrentBid] = useState("25");
  const [winsPerMonth, setWinsPerMonth] = useState("8");
  const [avgHammer, setAvgHammer] = useState("60");

  const result = useMemo(() => {
    const sold = num(ebaySold);
    const feePct = num(ebayFeePct) / 100;
    const out = num(shipOut);
    const inn = num(shipIn);
    const profit = num(targetProfit);
    const current = num(currentBid);
    const wins = Math.max(0, num(winsPerMonth));
    const hammer = Math.max(0, num(avgHammer));

    const netFromSale = sold * (1 - feePct) - out;
    const maxBid = netFromSale - inn - profit;
    const tipFee = Math.max(0, maxBid) * (STANDARD_SUCCESS_FEE_PCT / 100);
    const profitAtMax = maxBid > 0 ? profit - tipFee : 0;

    let verdict: Verdict = "snipe";
    let reason =
      "Comps leave room for your profit target. Sniping near close keeps your max quiet.";
    if (maxBid <= 0) {
      verdict = "skip";
      reason =
        "Edge is negative after fees and shipping. Walk away or lower your profit target.";
    } else if (current > 0 && current >= maxBid) {
      verdict = "skip";
      reason =
        "Current bid is already at or above your max. Do not chase — wait for the next lot.";
    } else if (maxBid > 0 && profit > 0 && maxBid < profit * 1.5) {
      verdict = "thin";
      reason =
        "Margin is thin. You can snipe at this ceiling, but one shipping surprise wipes the trade.";
    }

    const standardMonthly = wins * hammer * (STANDARD_SUCCESS_FEE_PCT / 100);
    const proBetter = standardMonthly > PRO_MONTHLY_USD;
    const breakEvenWins =
      hammer > 0 ? PRO_MONTHLY_USD / (hammer * (STANDARD_SUCCESS_FEE_PCT / 100)) : Infinity;

    return {
      netFromSale,
      maxBid,
      tipFee,
      profitAtMax,
      verdict,
      reason,
      standardMonthly,
      proBetter,
      breakEvenWins,
    };
  }, [
    ebaySold,
    ebayFeePct,
    shipOut,
    shipIn,
    targetProfit,
    currentBid,
    winsPerMonth,
    avgHammer,
  ]);

  const field =
    "mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100";

  const verdictStyles: Record<Verdict, string> = {
    snipe: "border-emerald-800/50 text-emerald-400",
    thin: "border-amber-800/50 text-amber-400",
    skip: "border-rose-900/50 text-rose-400",
  };
  const verdictLabel: Record<Verdict, string> = {
    snipe: "Strategy: snipe at max",
    thin: "Strategy: snipe carefully",
    skip: "Strategy: skip this lot",
  };

  return (
    <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
      <p className="text-sm font-medium text-zinc-200">Lot economics</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
        <label className="block text-sm text-zinc-400">
          Target profit ($)
          <input
            className={field}
            inputMode="decimal"
            value={targetProfit}
            onChange={(e) => setTargetProfit(e.target.value)}
          />
        </label>
        <label className="block text-sm text-zinc-400">
          Current bid on the lot ($)
          <input
            className={field}
            inputMode="decimal"
            value={currentBid}
            onChange={(e) => setCurrentBid(e.target.value)}
          />
        </label>
      </div>

      <p className="mt-8 text-sm font-medium text-zinc-200">Monthly volume (for plan choice)</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-zinc-400">
          Expected wins / month
          <input
            className={field}
            inputMode="decimal"
            value={winsPerMonth}
            onChange={(e) => setWinsPerMonth(e.target.value)}
          />
        </label>
        <label className="block text-sm text-zinc-400">
          Average hammer when you win ($)
          <input
            className={field}
            inputMode="decimal"
            value={avgHammer}
            onChange={(e) => setAvgHammer(e.target.value)}
          />
        </label>
      </div>

      <div
        className={`mt-8 rounded-xl border bg-zinc-950 px-4 py-5 ${verdictStyles[result.verdict]}`}
      >
        <p className="text-xs uppercase tracking-wider">{verdictLabel[result.verdict]}</p>
        <p className="mt-2 text-4xl font-black text-zinc-100">
          {result.maxBid > 0 ? `$${result.maxBid.toFixed(2)}` : "$0.00"}
          <span className="ml-2 text-base font-medium text-zinc-500">max bid</span>
        </p>
        <p className="mt-2 text-sm text-zinc-400">{result.reason}</p>
        <ul className="mt-4 space-y-1.5 text-sm text-zinc-500">
          <li>Net after sale fees &amp; outbound ship: ${result.netFromSale.toFixed(2)}</li>
          {result.maxBid > 0 && (
            <li>
              BuzzerBidder Standard tip at this max ({STANDARD_SUCCESS_FEE_PCT}%): $
              {result.tipFee.toFixed(2)} — keep that in mind vs target profit
            </li>
          )}
        </ul>
      </div>

      <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-5">
        <p className="text-xs uppercase tracking-wider text-zinc-500">
          Standard vs Pro (at your volume)
        </p>
        <p className="mt-2 text-sm text-zinc-300">
          Estimated Standard fees:{" "}
          <strong className="font-semibold text-zinc-100">
            ${result.standardMonthly.toFixed(2)}/mo
          </strong>{" "}
          vs Pro at <strong className="font-semibold text-zinc-100">${PRO_MONTHLY_USD}/mo</strong>{" "}
          (0% success fee).
        </p>
        <p className="mt-2 text-sm text-zinc-500">
          {result.proBetter
            ? `At this volume, Pro is usually cheaper. Rough break-even ≈ ${
                Number.isFinite(result.breakEvenWins)
                  ? `${result.breakEvenWins.toFixed(1)} wins/mo`
                  : "n/a"
              } at your average hammer.`
            : `Standard is usually cheaper until ~${
                Number.isFinite(result.breakEvenWins)
                  ? result.breakEvenWins.toFixed(1)
                  : "?"
              } wins/mo at this hammer size.`}
        </p>
      </div>
    </div>
  );
}
