const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/backend";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "API error");
  }
  return res.json();
}

// Deals
export const getDeals = (params?: {
  min_profit?: number;
  min_margin?: number;
  status?: string;
}) => {
  const filtered = Object.fromEntries(
    Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== "")
  );
  const qs = new URLSearchParams(filtered as Record<string, string>).toString();
  return apiFetch<{ deals: Deal[]; count: number }>(`/deals${qs ? `?${qs}` : ""}`);
};

// Watchlist
export const getWatchlist = () =>
  apiFetch<{ watchlist: WatchlistItem[] }>("/watchlist");

export const addToWatchlist = (item_id: number, max_bid: number) =>
  apiFetch("/watchlist", {
    method: "POST",
    body: JSON.stringify({ item_id, max_bid }),
  });

export const removeFromWatchlist = (item_id: number) =>
  apiFetch(`/watchlist/${item_id}`, { method: "DELETE" });

// Scanner
export const triggerScan = () => apiFetch("/scan", { method: "POST" });
export const getScanStatus = () => apiFetch<ScanStatus>("/scan/status");

// Sniper
export const startSniper = () => apiFetch("/sniper/start", { method: "POST" });
export const stopSniper = () => apiFetch("/sniper/stop", { method: "POST" });
export const getSniperStatus = () => apiFetch<SniperStatus>("/sniper/status");
export const getSniperLogs = (n = 100) =>
  apiFetch<{ logs: SniperLogEntry[] }>(`/sniper/logs?n=${n}`);

// Settings
export const getSettings = () => apiFetch<Settings>("/settings");
export const updateSetting = (key: string, value: unknown) =>
  apiFetch("/settings", { method: "PUT", body: JSON.stringify({ key, value }) });

// Favorites scan
export const triggerFavoritesScan = () => apiFetch("/favorites/scan", { method: "POST" });
export const getFavoritesScanStatus = () => apiFetch<{ running: boolean }>("/favorites/status");
export const getAllFavorites = () => apiFetch<{ favorites: FavoriteItem[]; count: number }>("/favorites");

// Categories
export const getCategories = () => apiFetch<{ categories: Category[] }>("/categories");

// Reprice with custom eBay search term
export const repriceItem = (item_id: number, search_term: string) =>
  apiFetch<{
    item_id: number;
    ebay_search: string;
    ebay_median: number;
    ebay_low: number;
    ebay_high: number;
    ebay_sold_count: number;
    profit: number;
    margin: number;
  }>(`/items/${item_id}/reprice`, {
    method: "POST",
    body: JSON.stringify({ search_term }),
  });

// Types
export interface Deal {
  item_id: number;
  title: string;
  sgw_url: string;
  current_bid: number;
  shipping_est: number | null;
  end_time: string | null;
  image_url: string | null;
  keyword: string;
  ebay_median: number;
  ebay_low: number;
  ebay_high: number;
  ebay_sold_count: number;
  ebay_search: string;
  profit: number;
  margin: number;
  status: string;
  last_updated: string;
}

export interface WatchlistItem {
  item_id: number;
  title: string;
  max_bid: number;
  current_bid: number | null;
  end_time: string | null;
  sgw_url: string | null;
  image_url: string | null;
  ebay_median: number | null;
  ebay_search: string | null;
  profit: number | null;
  sniper_status: string;
  final_price: number | null;
  final_shipping: number | null;
  handling_price: number | null;
  tax: number | null;
  order_id: number | null;
  tracking_number: string | null;
  shipper_name: string | null;
  due_date: string | null;
  added_at: string;
}

export interface ScanStatus {
  running: boolean;
  recent_scans: {
    id: number;
    started_at: string;
    finished_at: string | null;
    items_scanned: number;
    deals_found: number;
    error: string | null;
  }[];
}

export interface SniperStatus {
  running: boolean;
  pid: number | null;
}

export interface SniperLogEntry {
  ts: string;
  line: string;
}

export interface Settings {
  scan_keywords: string[];
  scan_category_ids: number[];
  min_profit_usd: number;
  min_margin_pct: number;
  min_sold_comps: number;
  max_bid_cap: number;
  min_bid_floor: number;
  scan_interval_minutes: number;
  snipe_seconds_before: number;
  your_zip_code: string;
  ebay_days_back: number;
  scan_max_items: number;
}

export interface Category {
  id: number;
  name: string;
}

export interface FavoriteItem {
  item_id: number;
  title: string;
  current_bid: number;
  end_time: string | null;
  image_url: string | null;
  sgw_url: string;
  seller_id: number | null;
  analyzed: boolean;
  is_deal: boolean;
  skip_reason: string | null;
  ebay_median: number | null;
  ebay_low: number | null;
  ebay_high: number | null;
  ebay_sold_count: number | null;
  ebay_search: string | null;
  profit: number | null;
  margin: number | null;
  shipping_est: number | null;
}
