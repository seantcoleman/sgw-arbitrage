-- Bid count from ShopGoodwill, and a private note that stays in BuzzerBidder.
alter table public.watchlist
  add column if not exists bid_count integer,
  add column if not exists note text;
