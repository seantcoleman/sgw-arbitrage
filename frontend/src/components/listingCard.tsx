"use client";

import { ReactNode } from "react";

export type Urgency = "normal" | "soon" | "urgent";

export function parseEndTime(endTime: string): Date {
  if (endTime.endsWith("Z") || endTime.includes("+") || endTime.includes("-0")) return new Date(endTime);
  const isDST = new Date().getTimezoneOffset() < new Date(new Date().getFullYear(), 0, 1).getTimezoneOffset();
  return new Date(endTime + (isDST ? "-07:00" : "-08:00"));
}

export function timeUntil(endTime: string | null): { label: string; urgency: Urgency } {
  if (!endTime) return { label: "—", urgency: "normal" };
  const diff = parseEndTime(endTime).getTime() - Date.now();
  if (diff < 0) return { label: "Ended", urgency: "urgent" };
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 48) return { label: `${Math.floor(h / 24)}d left`, urgency: "normal" };
  if (h > 24) return { label: `${Math.floor(h / 24)}d ${h % 24}h`, urgency: "normal" };
  if (h >= 4) return { label: `${h}h ${m}m`, urgency: "soon" };
  return { label: `${h}h ${m}m`, urgency: "urgent" };
}

export function formatRoi(margin: number): string {
  const pct = margin * 100;
  if (pct >= 1000) return `${margin.toFixed(0)}x ROI`;
  return `${Math.round(pct)}% ROI`;
}

const URGENCY_BADGE: Record<Urgency, string> = {
  normal: "text-neutral-300 bg-black/50",
  soon: "text-amber-300 bg-amber-950/70",
  urgent: "text-red-300 bg-red-950/70",
};

const URGENCY_DOT: Record<Urgency, string> = {
  normal: "bg-zinc-500",
  soon: "bg-amber-400",
  urgent: "bg-red-500 animate-pulse",
};

export function UrgencyBadge({ label, urgency }: { label: string; urgency: Urgency }) {
  return (
    <span className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full backdrop-blur-md border border-white/10 ${URGENCY_BADGE[urgency]}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${URGENCY_DOT[urgency]}`} />
      {label}
    </span>
  );
}

/** Solid filled ROI / profit pill (readable on photos). */
export function RoiBadge({ margin, profit }: { margin?: number | null; profit?: number | null }) {
  const label =
    margin != null
      ? formatRoi(margin)
      : profit != null
      ? `+$${profit.toFixed(0)}`
      : null;
  if (!label) return null;

  const m = margin ?? (profit != null && profit > 0 ? 1 : 0);
  const cls =
    m >= 3
      ? "bg-green-600 text-white border-green-500"
      : m >= 1
      ? "bg-emerald-600 text-white border-emerald-500"
      : "bg-amber-500 text-zinc-950 border-amber-400";

  return (
    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border backdrop-blur-md ${cls}`}>
      {label}
    </span>
  );
}

export function StatusPill({
  label,
  tone = "neutral",
  title,
  className = "",
}: {
  label: string;
  tone?: "neutral" | "muted" | "blue" | "amber" | "green" | "emerald" | "sky" | "red";
  title?: string;
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-zinc-700 text-zinc-200 border-zinc-600",
    muted: "bg-zinc-800/90 text-zinc-400 border-zinc-700/60",
    blue: "bg-blue-600 text-white border-blue-500",
    amber: "bg-amber-500 text-zinc-950 border-amber-400",
    green: "bg-green-600 text-white border-green-500",
    emerald: "bg-emerald-600 text-white border-emerald-500",
    sky: "bg-sky-600 text-white border-sky-500",
    red: "bg-red-600 text-white border-red-500",
  };
  return (
    <span
      title={title}
      className={`text-[11px] font-bold px-2.5 py-1 rounded-full border backdrop-blur-md max-w-[160px] truncate ${tones[tone]} ${className}`}
    >
      {label}
    </span>
  );
}

export function CardImage({
  src,
  alt,
  heightClass = "h-48",
  children,
}: {
  src: string | null | undefined;
  alt: string;
  heightClass?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`relative ${heightClass} bg-neutral-800 overflow-hidden flex-shrink-0`}>
      {src ? (
        <>
          <img
            src={src}
            alt={alt}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />
        </>
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <span className="text-4xl opacity-20">📦</span>
        </div>
      )}
      {children}
    </div>
  );
}

export function CardTopBadges({ left, right }: { left?: ReactNode; right?: ReactNode }) {
  return (
    <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-2">
      {left ?? <span />}
      {right ?? <span />}
    </div>
  );
}

export function StatPill({
  label,
  value,
  align = "left",
  valueClassName = "text-white",
  size = "lg",
}: {
  label: string;
  value: string;
  align?: "left" | "right";
  valueClassName?: string;
  size?: "lg" | "md" | "sm";
}) {
  const valueSize = size === "lg" ? "text-3xl" : size === "md" ? "text-2xl" : "text-sm font-semibold";
  return (
    <div className={`rounded-xl bg-black/70 backdrop-blur-md border border-white/10 px-3 py-2 ${align === "right" ? "text-right" : ""}`}>
      <div className={`text-[10px] mb-0.5 ${align === "right" ? "text-neutral-300" : "text-neutral-300 uppercase tracking-widest font-semibold"}`}>
        {label}
      </div>
      <div className={`${valueSize} font-black leading-none ${valueClassName}`}>{value}</div>
    </div>
  );
}

/** Shared image-bottom stats for Deals / Favorites. */
export function DealImageOverlay({
  profit,
  ebayMedian,
  comps,
  size = "lg",
}: {
  profit: number;
  ebayMedian: number;
  comps: number | null;
  size?: "lg" | "md";
}) {
  return (
    <div className="absolute bottom-0 left-0 right-0 px-3 py-3">
      <div className="flex items-end justify-between gap-2">
        <StatPill
          label="Est. Profit"
          value={`${profit >= 0 ? "+" : ""}$${profit.toFixed(0)}`}
          size={size}
          valueClassName={profit >= 0 ? "text-white" : "text-red-400"}
        />
        <StatPill
          label={comps != null ? `${comps} comps` : "eBay"}
          value={`$${ebayMedian.toFixed(0)} eBay`}
          align="right"
          valueClassName="text-green-400"
          size="sm"
        />
      </div>
    </div>
  );
}

export function PriceCompareRow({
  youPay,
  youPayDetail,
  ebayValue,
  ebayDetail,
}: {
  youPay: string;
  youPayDetail?: string;
  ebayValue: string;
  ebayDetail?: string;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className={`flex-1 ${PRICE_WELL}`}>
        <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold mb-1">You Pay</div>
        <div className="font-bold text-zinc-100 text-[15px]">{youPay}</div>
        {youPayDetail && <div className="text-[10px] text-zinc-600 mt-0.5">{youPayDetail}</div>}
      </div>
      <svg className="w-4 h-4 text-zinc-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
      </svg>
      <div className={`flex-1 ${PRICE_WELL}`}>
        <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold mb-1">eBay Value</div>
        <div className="font-bold text-zinc-100 text-[15px]">{ebayValue}</div>
        {ebayDetail && <div className="text-[10px] text-zinc-600 mt-0.5">{ebayDetail}</div>}
      </div>
    </div>
  );
}

/** Follows the theme — dark well in dark mode, light well in light mode. */
export const PRICE_WELL =
  "rounded-xl bg-zinc-800/70 border border-zinc-700/50 px-3 py-2.5";

export const LISTING_CARD_SHELL =
  "group relative bg-zinc-900 border border-zinc-800/80 hover:border-zinc-600 rounded-2xl overflow-hidden flex flex-col transition-all duration-200 hover:shadow-2xl hover:shadow-black/50 light:hover:shadow-zinc-400/20";
