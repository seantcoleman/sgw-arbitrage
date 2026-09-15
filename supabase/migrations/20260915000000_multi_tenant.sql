-- Multi-tenant SGW Arbitrage schema for Supabase Postgres
-- Run in the Supabase SQL editor (or via supabase db push).

create extension if not exists "pgcrypto";

-- ── Profiles (1:1 with auth.users) ──────────────────────────────────────────

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  display_name text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email, updated_at = now();

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Per-user settings ───────────────────────────────────────────────────────

create table if not exists public.user_settings (
  user_id               uuid primary key references public.profiles (id) on delete cascade,
  snipe_seconds_before  integer not null default 5,
  your_zip_code         text not null default '90210',
  ebay_fee_pct          double precision not null default 13,
  ebay_resale_shipping  double precision not null default 7,
  ebay_display_mode     text not null default 'net',
  ebay_days_back        integer not null default 90,
  updated_at            timestamptz not null default now()
);

-- ── Global app settings (shared scanner) ────────────────────────────────────

create table if not exists public.app_settings (
  key   text primary key,
  value text not null
);

insert into public.app_settings (key, value) values
  ('scan_keywords', '[]'),
  ('scan_category_ids', '[]'),
  ('min_profit_usd', '20'),
  ('min_margin_pct', '30'),
  ('min_sold_comps', '5'),
  ('max_bid_cap', '300'),
  ('min_bid_floor', '3'),
  ('scan_interval_minutes', '120'),
  ('max_scan_items', '200'),
  ('auctions_only', 'true')
on conflict (key) do nothing;

-- ── ShopGoodwill accounts (ciphertext never exposed to browser) ─────────────

create table if not exists public.sgw_accounts (
  id                   bigserial primary key,
  user_id              uuid not null references public.profiles (id) on delete cascade,
  label                text not null default 'Default',
  auth_source          text not null default 'user',  -- user | env
  encrypted_username   text,
  encrypted_password   text,
  nonce                text,
  key_version          integer not null default 1,
  status               text not null default 'pending', -- pending | active | invalid | revoked
  last_verified_at     timestamptz,
  last_error           text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists idx_sgw_accounts_user on public.sgw_accounts (user_id);

-- ── Shared deals pool ───────────────────────────────────────────────────────

create table if not exists public.deals (
  item_id         bigint primary key,
  title           text not null,
  sgw_url         text,
  current_bid     double precision not null,
  shipping_est    double precision,
  end_time        text,
  seller_id       bigint,
  image_url       text,
  keyword         text,
  ebay_median     double precision,
  ebay_low        double precision,
  ebay_high       double precision,
  ebay_sold_count integer,
  ebay_search     text,
  profit          double precision,
  margin          double precision,
  status          text not null default 'active',
  skip_reason     text,
  first_seen      timestamptz not null default now(),
  last_updated    timestamptz not null default now()
);

create index if not exists idx_deals_status_profit on public.deals (status, profit desc);

-- ── Watchlist (composite unique per user) ───────────────────────────────────

create table if not exists public.watchlist (
  id              bigserial primary key,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  item_id         bigint not null,
  sgw_account_id  bigint references public.sgw_accounts (id) on delete set null,
  title           text not null,
  max_bid         double precision not null,
  current_bid     double precision,
  end_time        text,
  sgw_url         text,
  image_url       text,
  ebay_median     double precision,
  profit          double precision,
  ebay_search     text,
  sniper_status   text not null default 'scheduled',
  final_price     double precision,
  final_shipping  double precision,
  handling_price  double precision,
  tax             double precision,
  order_id        bigint,
  tracking_number text,
  shipper_name    text,
  due_date        text,
  added_at        timestamptz not null default now(),
  unique (user_id, item_id)
);

create index if not exists idx_watchlist_user_status on public.watchlist (user_id, sniper_status);
create index if not exists idx_watchlist_item on public.watchlist (item_id);

-- ── Durable snipe jobs ──────────────────────────────────────────────────────

create table if not exists public.snipe_jobs (
  id                 bigserial primary key,
  watchlist_id       bigint not null references public.watchlist (id) on delete cascade,
  item_id            bigint not null,
  user_id            uuid not null references public.profiles (id) on delete cascade,
  sgw_account_id     bigint references public.sgw_accounts (id) on delete set null,
  max_bid            double precision not null,
  end_time           text,
  snipe_at           text not null,
  status             text not null default 'pending',
  lease_owner        text,
  lease_until        text,
  attempt_count      integer not null default 0,
  last_error         text,
  updated_at         timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  unique (watchlist_id)
);

create index if not exists idx_snipe_jobs_pending_at
  on public.snipe_jobs (status, snipe_at);

-- ── Per-user snipe activity feed ────────────────────────────────────────────

create table if not exists public.snipe_activity (
  id       bigserial primary key,
  user_id  uuid references public.profiles (id) on delete cascade,
  item_id  bigint,
  ts       timestamptz not null default now(),
  line     text not null
);

create index if not exists idx_snipe_activity_user_ts
  on public.snipe_activity (user_id, id desc);

-- ── Scan log + search term cache + eBay price cache ─────────────────────────

create table if not exists public.scan_log (
  id            bigserial primary key,
  started_at    timestamptz,
  finished_at   timestamptz,
  items_scanned integer not null default 0,
  deals_found   integer not null default 0,
  error         text
);

create table if not exists public.search_term_cache (
  cache_key   text primary key,
  search_term text not null,
  source      text not null default 'auto',
  hit_count   integer not null default 1,
  last_used   timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create table if not exists public.ebay_price_cache (
  cache_key   text primary key,
  payload     jsonb not null,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_ebay_price_cache_expires
  on public.ebay_price_cache (expires_at);

-- ── Row Level Security ──────────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.sgw_accounts enable row level security;
alter table public.watchlist enable row level security;
alter table public.snipe_jobs enable row level security;
alter table public.snipe_activity enable row level security;

-- Shared tables: readable by authenticated users, writable only by service role
alter table public.deals enable row level security;
alter table public.scan_log enable row level security;
alter table public.search_term_cache enable row level security;
alter table public.ebay_price_cache enable row level security;
alter table public.app_settings enable row level security;

-- Profiles: own row
drop policy if exists "profiles_own" on public.profiles;
create policy "profiles_own" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- User settings: own row
drop policy if exists "user_settings_own" on public.user_settings;
create policy "user_settings_own" on public.user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- SGW accounts: deny-all for authenticated (ciphertext stays server-only)
drop policy if exists "sgw_accounts_deny_authenticated" on public.sgw_accounts;
create policy "sgw_accounts_deny_authenticated" on public.sgw_accounts
  for all to authenticated using (false) with check (false);

-- Watchlist / snipe jobs: own rows
drop policy if exists "watchlist_own" on public.watchlist;
create policy "watchlist_own" on public.watchlist
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "snipe_jobs_own" on public.snipe_jobs;
create policy "snipe_jobs_own" on public.snipe_jobs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "snipe_activity_own" on public.snipe_activity;
create policy "snipe_activity_own" on public.snipe_activity
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Shared read policies (writes go through service role from the Oracle backend)
drop policy if exists "deals_read" on public.deals;
create policy "deals_read" on public.deals
  for select to authenticated using (true);

drop policy if exists "app_settings_read" on public.app_settings;
create policy "app_settings_read" on public.app_settings
  for select to authenticated using (true);

drop policy if exists "scan_log_read" on public.scan_log;
create policy "scan_log_read" on public.scan_log
  for select to authenticated using (true);

-- Service role bypasses RLS by default in Supabase — backend uses DATABASE_URL
-- with the service-role connection string.
