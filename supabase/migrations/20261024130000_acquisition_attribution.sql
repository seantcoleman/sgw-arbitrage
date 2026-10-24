-- First-touch acquisition copied from signup user metadata onto profiles.
-- Columns are frozen by RLS so a signed-in user cannot rewrite their source.

alter table public.profiles
  add column if not exists acq_referrer text,
  add column if not exists acq_landing text,
  add column if not exists acq_utm_source text,
  add column if not exists acq_utm_medium text,
  add column if not exists acq_utm_campaign text,
  add column if not exists acq_utm_term text,
  add column if not exists acq_utm_content text,
  add column if not exists acq_first_seen_at timestamptz;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb;
  v_seen timestamptz;
begin
  meta := coalesce(new.raw_user_meta_data, '{}'::jsonb);

  begin
    if coalesce(meta->>'acq_first_seen_at', '') ~ '^\d{4}-\d{2}-\d{2}T'
       and left(meta->>'acq_first_seen_at', 4)::int between 2020 and 2100
    then
      v_seen := (meta->>'acq_first_seen_at')::timestamptz;
    end if;
  exception when others then
    v_seen := null;
  end;

  insert into public.profiles (
    id,
    email,
    acq_referrer,
    acq_landing,
    acq_utm_source,
    acq_utm_medium,
    acq_utm_campaign,
    acq_utm_term,
    acq_utm_content,
    acq_first_seen_at
  )
  values (
    new.id,
    new.email,
    nullif(left(meta->>'acq_referrer', 300), ''),
    nullif(left(meta->>'acq_landing', 300), ''),
    nullif(left(meta->>'acq_utm_source', 80), ''),
    nullif(left(meta->>'acq_utm_medium', 80), ''),
    nullif(left(meta->>'acq_utm_campaign', 80), ''),
    nullif(left(meta->>'acq_utm_term', 80), ''),
    nullif(left(meta->>'acq_utm_content', 80), ''),
    v_seen
  )
  on conflict (id) do update set
    email = excluded.email,
    updated_at = now(),
    acq_referrer = coalesce(profiles.acq_referrer, excluded.acq_referrer),
    acq_landing = coalesce(profiles.acq_landing, excluded.acq_landing),
    acq_utm_source = coalesce(profiles.acq_utm_source, excluded.acq_utm_source),
    acq_utm_medium = coalesce(profiles.acq_utm_medium, excluded.acq_utm_medium),
    acq_utm_campaign = coalesce(profiles.acq_utm_campaign, excluded.acq_utm_campaign),
    acq_utm_term = coalesce(profiles.acq_utm_term, excluded.acq_utm_term),
    acq_utm_content = coalesce(profiles.acq_utm_content, excluded.acq_utm_content),
    acq_first_seen_at = coalesce(profiles.acq_first_seen_at, excluded.acq_first_seen_at);

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop policy if exists "profiles_update_own_non_billing" on public.profiles;

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
    and acq_referrer is not distinct from (select p.acq_referrer from public.profiles p where p.id = auth.uid())
    and acq_landing is not distinct from (select p.acq_landing from public.profiles p where p.id = auth.uid())
    and acq_utm_source is not distinct from (select p.acq_utm_source from public.profiles p where p.id = auth.uid())
    and acq_utm_medium is not distinct from (select p.acq_utm_medium from public.profiles p where p.id = auth.uid())
    and acq_utm_campaign is not distinct from (select p.acq_utm_campaign from public.profiles p where p.id = auth.uid())
    and acq_utm_term is not distinct from (select p.acq_utm_term from public.profiles p where p.id = auth.uid())
    and acq_utm_content is not distinct from (select p.acq_utm_content from public.profiles p where p.id = auth.uid())
    and acq_first_seen_at is not distinct from (select p.acq_first_seen_at from public.profiles p where p.id = auth.uid())
  );
