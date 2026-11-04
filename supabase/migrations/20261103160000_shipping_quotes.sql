-- ShopGoodwill ZIP shipping quotes, saved so a page load does not ask again.
create table if not exists public.shipping_quotes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_id bigint not null,
  zip     text not null,
  amount  double precision not null,
  primary key (user_id, item_id, zip)
);

alter table public.shipping_quotes enable row level security;
