alter table public.user_settings
  add column if not exists zip_confirmed boolean not null default false;

-- A ZIP other than the untouched default was chosen by the user.
update public.user_settings
set zip_confirmed = true
where btrim(your_zip_code) <> ''
  and btrim(your_zip_code) <> '90210';
