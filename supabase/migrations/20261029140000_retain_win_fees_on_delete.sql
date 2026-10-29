-- Keep the fee ledger if a profile is deleted. Stripe invoices stay on the customer.
-- ShopGoodwill credentials and snipes still cascade away with the account.

alter table public.win_fees drop constraint if exists win_fees_user_id_fkey;

alter table public.win_fees alter column user_id drop not null;

alter table public.win_fees
  add constraint win_fees_user_id_fkey
  foreign key (user_id) references public.profiles (id) on delete set null;
