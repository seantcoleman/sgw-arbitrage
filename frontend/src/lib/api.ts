const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/backend";

async function authHeaders(): Promise<Record<string, string>> {
  try {
    const { authConfigured, createClient } = await import("@/lib/supabase/client");
    if (!authConfigured()) return {};
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = {
    "Content-Type": "application/json",
    ...(await authHeaders()),
    ...init?.headers,
  };
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const message = err.detail ?? "API error";
    const error = new Error(typeof message === "string" ? message : JSON.stringify(message));
    (error as Error & { status?: number }).status = res.status;
    throw error;
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

export const updateWatchlistMaxBid = (item_id: number, max_bid: number) =>
  apiFetch<{ success: boolean; item_id: number; max_bid: number }>(`/watchlist/${item_id}`, {
    method: "PATCH",
    body: JSON.stringify({ max_bid }),
  });

// Scanner
export const triggerScan = () => apiFetch("/scan", { method: "POST" });
export const getScanStatus = () => apiFetch<ScanStatus>("/scan/status");

// Sniper — bidding is always-on infrastructure, not a per-user toggle
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
    you_get: number;
    profit: number;
    margin: number;
    ebay_fee_pct: number;
    ebay_resale_shipping: number;
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
  you_get?: number | null;
  profit: number;
  margin: number;
  ebay_fee_pct?: number;
  ebay_resale_shipping?: number;
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
  you_get?: number | null;
  profit: number | null;
  ebay_fee_pct?: number;
  ebay_resale_shipping?: number;
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
  success_fee_cents?: number | null;
  success_fee_status?: string | null;
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
  mode: "workers" | "in-process";
  pending_snipes: number;
}

export interface SniperLogEntry {
  ts: string;
  line: string;
  item_id?: number | null;
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
  ebay_fee_pct: number;
  ebay_resale_shipping: number;
  ebay_display_mode: "net" | "gross";
  auctions_only: boolean;
}

export interface Category {
  id: number;
  name: string;
  children?: Category[];
}

/** Flatten a nested category tree for id → name lookups. */
export function flattenCategories(categories: Category[]): Category[] {
  const out: Category[] = [];
  const walk = (nodes: Category[]) => {
    for (const c of nodes) {
      out.push({ id: c.id, name: c.name });
      if (c.children?.length) walk(c.children);
    }
  };
  walk(categories);
  return out;
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
  you_get?: number | null;
  profit: number | null;
  margin: number | null;
  shipping_est: number | null;
  ebay_fee_pct?: number;
  ebay_resale_shipping?: number;
}

export interface SgwAccountSummary {
  id: number;
  user_id: string;
  label: string;
  auth_source: string;
  status: string;
  last_verified_at?: string | null;
  last_error?: string | null;
}

export interface BillingInfo {
  plan: string;
  has_payment_method: boolean;
  billing_blocked: boolean;
  stripe_subscription_status: string | null;
  tos_accepted_at: string | null;
  can_snipe: boolean;
  can_snipe_reason: string | null;
  success_fee_pct: number;
}

export interface WinFee {
  id: number;
  item_id: number;
  hammer_cents: number;
  fee_cents: number;
  status: string;
  stripe_invoice_id?: string | null;
  created_at?: string;
}

export interface MeResponse {
  id: string;
  email: string | null;
  sgw_accounts: SgwAccountSummary[];
  has_sgw: boolean;
  postgres: boolean;
  billing?: BillingInfo;
  win_fees?: WinFee[];
}

export const getMe = () => apiFetch<MeResponse>("/me");
export const listSgwAccounts = () =>
  apiFetch<{ accounts: SgwAccountSummary[] }>("/account/sgw");
export const connectSgwAccount = (username: string, password: string, label = "Default") =>
  apiFetch<{ success: boolean; account: SgwAccountSummary }>("/account/sgw", {
    method: "POST",
    body: JSON.stringify({ username, password, label }),
  });
export const verifySgwAccount = (accountId: number) =>
  apiFetch<{ success: boolean; status: string }>(`/account/sgw/${accountId}/verify`, {
    method: "POST",
  });

