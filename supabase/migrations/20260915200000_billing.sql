-- Billing: Stripe fields on profiles + win_fees ledger

alter table public.profiles
  add column if not exists stripe_customer_id text,
  add column if not exists plan text not null default 'standard',
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_subscription_status text,
  add column if not exists has_payment_method boolean not null default false,
  add column if not exists billing_blocked boolean not null default false,
  add column if not exists tos_accepted_at timestamptz;

create unique index if not exists idx_profiles_stripe_customer
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

create table if not exists public.win_fees (
  id                 bigserial primary key,
  user_id            uuid not null references public.profiles (id) on delete cascade,
  item_id            bigint not null,
  hammer_cents       integer not null,
  fee_cents          integer not null,
  status             text not null default 'pending',
  stripe_invoice_id  text,
  stripe_invoice_item_id text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (user_id, item_id)
);

create index if not exists idx_win_fees_user_status
  on public.win_fees (user_id, status);

create index if not exists idx_win_fees_pending
  on public.win_fees (status)
  where status = 'pending';

alter table public.win_fees enable row level security;

drop policy if exists win_fees_select_own on public.win_fees;
create policy win_fees_select_own on public.win_fees
  for select using (auth.uid() = user_id);
