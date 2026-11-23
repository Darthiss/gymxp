-- Bro: database setup for private accounts (roadmap A.4, A.5). Paste into each project's
-- SQL Editor and run. It's safe to run again: everything is created only if missing,
-- and the rules are replaced.
--
-- What the server holds per person is one row: their data, sealed on their phone
-- before upload, and their data key, wrapped by their password and by their recovery
-- key. Nobody with access to this database can read either. See lib/e2e.ts.

-- ---------------------------------------------------------------------------
-- One vault per person
-- ---------------------------------------------------------------------------
create table if not exists public.vaults (
  user_id uuid primary key references auth.users (id) on delete cascade,
  keys jsonb not null,                  -- the KeyBundle (lib/e2e.ts)
  data text,                            -- data.json, sealed; null until the first save
  version bigint not null default 0,    -- goes up by one on every save
  updated_at timestamptz not null default now()
);

alter table public.vaults enable row level security;
revoke all on public.vaults from anon, authenticated;
grant select, insert, update on public.vaults to authenticated;

drop policy if exists "Own vault: read" on public.vaults;
drop policy if exists "Own vault: create" on public.vaults;
drop policy if exists "Own vault: change" on public.vaults;
create policy "Own vault: read" on public.vaults for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Own vault: create" on public.vaults for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Own vault: change" on public.vaults for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Save only if nobody saved since `expected`. Returns the new version, or null when
-- another device got there first (the app then fetches, merges and tries again).
create or replace function public.save_vault(expected bigint, body text)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved_version bigint;
begin
  update public.vaults
     set data = body, version = version + 1, updated_at = now()
   where user_id = (select auth.uid()) and version = expected
  returning version into saved_version;
  return saved_version;
end;
$$;

revoke execute on function public.save_vault(bigint, text) from public, anon;
grant execute on function public.save_vault(bigint, text) to authenticated;

-- ---------------------------------------------------------------------------
-- The guest list: only these emails can create an account
-- ---------------------------------------------------------------------------
create table if not exists public.guests (
  email text primary key,
  added_at timestamptz not null default now()
);

alter table public.guests enable row level security; -- no rules: the app can't read it
revoke all on public.guests from anon, authenticated;

-- Called by Supabase before it creates any user (Authentication > Hooks >
-- Before User Created). An empty object lets the sign-up through.
create or replace function public.check_guest_list(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.guests
     where lower(trim(email)) = lower(trim(event -> 'user' ->> 'email'))
  ) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'This email isn''t on the guest list yet. Ask whoever invited you to add it.'
  ));
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.check_guest_list(jsonb) to supabase_auth_admin;
revoke execute on function public.check_guest_list(jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Photos: a private bucket, one folder per person, files sealed before upload
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

drop policy if exists "Own photos: read" on storage.objects;
drop policy if exists "Own photos: add" on storage.objects;
drop policy if exists "Own photos: replace" on storage.objects;
create policy "Own photos: read" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Own photos: add" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Own photos: replace" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Own photos: delete" on storage.objects;
create policy "Own photos: delete" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- Delete account (Settings > Account). The app removes the photos first, through
-- the Storage API; deleting the user then deletes their vault (on delete cascade).
-- ---------------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Not signed in';
  end if;
  delete from auth.users where id = (select auth.uid());
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
