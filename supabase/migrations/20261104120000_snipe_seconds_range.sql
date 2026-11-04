-- Default lead is 6 seconds. Saved values stay between 6 and 15.

update public.user_settings
set snipe_seconds_before = least(15, greatest(6, snipe_seconds_before)),
    updated_at = now()
where snipe_seconds_before < 6
   or snipe_seconds_before > 15;

alter table public.user_settings
  alter column snipe_seconds_before set default 6;

alter table public.user_settings
  drop constraint if exists user_settings_snipe_seconds_before_range;

alter table public.user_settings
  add constraint user_settings_snipe_seconds_before_range
  check (snipe_seconds_before between 6 and 15);

-- Pending jobs keep the lead that is now stored on the account.
update public.snipe_jobs j
set snipe_at = to_char(
      (j.end_time::timestamptz - make_interval(secs => us.snipe_seconds_before))
        at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS"Z"'
    ),
    updated_at = now()
from public.user_settings us
where j.user_id = us.user_id
  and j.status = 'pending'
  and j.end_time ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$';
