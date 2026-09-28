-- Users can read their profile and update non-billing fields only.
-- Billing columns are written by service role (Checkout/webhook) or Oracle backend.

drop policy if exists "profiles_own" on public.profiles;
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own_non_billing" on public.profiles;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

create policy "profiles_update_own_non_billing" on public.profiles
  for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and plan = (select p.plan from public.profiles p where p.id = auth.uid())
    and coalesce(has_payment_method, false) = (select coalesce(p.has_payment_method, false) from public.profiles p where p.id = auth.uid())
    and coalesce(billing_blocked, false) = (select coalesce(p.billing_blocked, false) from public.profiles p where p.id = auth.uid())
    and stripe_customer_id is not distinct from (select p.stripe_customer_id from public.profiles p where p.id = auth.uid())
    and stripe_subscription_id is not distinct from (select p.stripe_subscription_id from public.profiles p where p.id = auth.uid())
    and stripe_subscription_status is not distinct from (select p.stripe_subscription_status from public.profiles p where p.id = auth.uid())
  );
